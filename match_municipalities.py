#!/usr/bin/env python3
"""
match_municipalities.py — IČO-based municipality matching for povolbach.sk

Step 1: Load/create municipality reference list (municipalities_ico.json)
Step 2: Normalize IČOs everywhere
Step 3: IČO join with ITMS data
Step 4: Save municipal_stats.json
Step 5: Generate validation_report.txt
Step 6: Print final summary
"""

import json
import os
import sys
import re
import time
import urllib.request
import urllib.parse
from datetime import datetime

# ---------- paths ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

MUNICIPALITIES_ICO_PATH = os.path.join(DATA_DIR, "municipalities_ico.json")
AGGREGATED_PATH = os.path.join(DATA_DIR, "aggregated_by_beneficiary_14.json")
IRREGULARITIES_PATH = os.path.join(DATA_DIR, "irregularities_by_ico_14.json")
RAW_SUBJECTS_PATH = os.path.join(DATA_DIR, "raw_subjects.json")
RAW_NUTS_PATH = os.path.join(DATA_DIR, "raw_nuts_names.json")
ALL_REGISTER_PATH = os.path.join(DATA_DIR, "all_municipalities_register.json")
COMPLETE_MAP_PATH = os.path.join(DATA_DIR, "complete_municipality_map.json")

OUTPUT_STATS_PATH = os.path.join(DATA_DIR, "municipal_stats_14.json")
OUTPUT_EXCLUDED_PATH = os.path.join(DATA_DIR, "excluded_beneficiaries.json")
VALIDATION_REPORT_PATH = os.path.join(BASE_DIR, "validation_report.txt")
FIX_LOG_PATH = os.path.join(DATA_DIR, "fix_log.txt")

# ---------- logging ----------
_log_lines = []


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, file=sys.stderr)
    _log_lines.append(line)


def flush_log():
    with open(FIX_LOG_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(_log_lines) + "\n")


# ---------- IČO normalizer ----------
def normalize_ico(ico) -> str | None:
    """Normalize IČO to 8-digit zero-padded string. Returns None for invalid."""
    if ico is None:
        return None
    if isinstance(ico, (int, float)):
        ico = str(int(ico))
    ico = str(ico).strip()
    # Remove any non-digit characters
    digits = re.sub(r"\D", "", ico)
    if not digits:
        return None
    if len(digits) > 8:
        return None  # corrupt
    return digits.zfill(8)


# ---------- RPO API ----------
RPO_BASE = "https://api.statistics.sk/rpo/v1/search"
RPO_RATE_LIMIT = 0.3  # seconds between requests (conservative)


def search_rpo(name: str, retries: int = 3) -> dict | None:
    """Search RPO API by fullName. Returns {ico, name, nuts_code} or None."""
    encoded = urllib.parse.quote(name)
    url = f"{RPO_BASE}?fullName={encoded}&page=0&size=5"

    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                results = data.get("results", [])
                if not results:
                    return None

                # Take the first result
                r = results[0]
                ico = None
                if r.get("identifiers"):
                    ico = r["identifiers"][0].get("value")
                fname = ""
                if r.get("fullNames"):
                    fname = r["fullNames"][0].get("value", "")

                # Get current municipality NUTS code from addresses
                nuts_code = ""
                for addr in r.get("addresses", []):
                    if not addr.get("validTo"):  # current address
                        mc = addr.get("municipality", {})
                        nuts_code = mc.get("code", "")
                        if nuts_code:
                            break
                # Fallback to any address
                if not nuts_code:
                    for addr in r.get("addresses", []):
                        mc = addr.get("municipality", {})
                        nuts_code = mc.get("code", "")
                        if nuts_code:
                            break

                return {"ico": ico, "name": fname, "nuts_code": nuts_code}

        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 5 * (attempt + 1)
                log(f"  RPO 429 rate limit, waiting {wait}s...")
                time.sleep(wait)
                continue
            elif e.code == 400:
                return None
            else:
                log(f"  RPO HTTP {e.code} for '{name}' (attempt {attempt+1})")
                time.sleep(2)
        except Exception as e:
            log(f"  RPO error for '{name}': {e} (attempt {attempt+1})")
            time.sleep(2)

    return None


# ===================================================================
# STEP 1 — Load or create municipality reference list
# ===================================================================

# Incremental cache for RPO lookups — survives crashes
RPO_CACHE_PATH = os.path.join(DATA_DIR, "rpo_ico_cache.json")


def _load_rpo_cache() -> dict:
    """Load incremental RPO lookup cache (NUTS→IČO)."""
    if os.path.exists(RPO_CACHE_PATH):
        with open(RPO_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_rpo_cache(cache: dict):
    """Save RPO cache after each successful lookup — crash-safe."""
    with open(RPO_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def _rpo_lookup_with_validation(name: str, nuts: str, okres: str, je_mesto: bool) -> str | None:
    """Query RPO for a municipality IČO. Validates NUTS code matches.
    Returns normalized IČO or None."""
    prefix = "Mesto" if je_mesto else "Obec"
    search_name = f"{prefix} {name}"

    log(f"  RPO lookup: {search_name} (NUTS: {nuts})")
    rpo_result = search_rpo(search_name)

    if rpo_result and rpo_result.get("ico"):
        rpo_nuts = rpo_result.get("nuts_code", "")
        if rpo_nuts == nuts or not rpo_nuts:
            return normalize_ico(rpo_result["ico"])

        # NUTS mismatch — try with district for disambiguation
        if okres:
            search_name2 = f"{prefix} {name}, {okres}"
            time.sleep(RPO_RATE_LIMIT)
            rpo_result2 = search_rpo(search_name2)
            if rpo_result2 and rpo_result2.get("nuts_code") == nuts:
                return normalize_ico(rpo_result2["ico"])

        # Still mismatched — try searching all results for NUTS match
        time.sleep(RPO_RATE_LIMIT)
        encoded = urllib.parse.quote(search_name)
        url = f"{RPO_BASE}?fullName={encoded}&page=0&size=20"
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                for r in data.get("results", []):
                    for addr in r.get("addresses", []):
                        if not addr.get("validTo"):
                            mc = addr.get("municipality", {}).get("code", "")
                            if mc == nuts and r.get("identifiers"):
                                ico = normalize_ico(r["identifiers"][0].get("value"))
                                log(f"    Found exact NUTS match in results: IČO={ico}")
                                return ico
        except Exception:
            pass

        # Last resort: accept first result but log warning
        ico = normalize_ico(rpo_result["ico"])
        log(f"    NUTS mismatch: RPO={rpo_nuts} vs REG={nuts}, accepting RPO IČO={ico}")
        return ico

    # Primary search failed — try alternative patterns
    alt_searches = [name, f"Mestská časť {name}"]
    for alt in alt_searches:
        time.sleep(RPO_RATE_LIMIT)
        rpo_result = search_rpo(alt)
        if rpo_result and rpo_result.get("ico"):
            ico = normalize_ico(rpo_result["ico"])
            log(f"    Found via alt search '{alt}': IČO={ico}")
            return ico

    return None


def step1_load_or_create_reference() -> dict:
    """Returns dict keyed by normalized IČO with municipality info.
    Uses incremental caching so RPO lookups survive crashes."""

    # If fully built, just load it
    if os.path.exists(MUNICIPALITIES_ICO_PATH):
        log(f"Step 1: Loading existing {MUNICIPALITIES_ICO_PATH}")
        with open(MUNICIPALITIES_ICO_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        log(f"  Loaded {len(data)} municipalities from cache")
        return data

    log("Step 1: Building municipalities_ico.json from available data")

    # --- Source 1: existing complete_municipality_map.json (has IČOs for ~2476) ---
    existing_ico_map = {}  # nuts_code -> ico
    if os.path.exists(COMPLETE_MAP_PATH):
        log("  Loading complete_municipality_map.json for existing IČO mappings...")
        with open(COMPLETE_MAP_PATH, "r", encoding="utf-8") as f:
            cmap = json.load(f)
        for e in cmap:
            ico = normalize_ico(e.get("ico"))
            nuts = e.get("nuts_code", "")
            if ico and nuts:
                existing_ico_map[nuts] = ico
        log(f"  Found {len(existing_ico_map)} IČO→NUTS mappings from complete_municipality_map")

    # --- Load incremental RPO cache (from previous partial runs) ---
    rpo_cache = _load_rpo_cache()
    if rpo_cache:
        log(f"  Resuming with {len(rpo_cache)} cached RPO lookups from previous run")

    # --- Source 2: all_municipalities_register.json (2933 municipalities, no IČOs) ---
    if not os.path.exists(ALL_REGISTER_PATH):
        log("  ERROR: all_municipalities_register.json not found!")
        sys.exit(1)

    with open(ALL_REGISTER_PATH, "r", encoding="utf-8") as f:
        register = json.load(f)
    log(f"  Loaded {len(register)} municipalities from register")

    # --- Build reference ---
    result = {}
    rpo_fetched = 0
    rpo_cached_hits = 0
    rpo_failed = []

    for i, m in enumerate(register):
        nuts = m.get("nuts_code", "")
        name = m.get("nazov", "")
        okres = m.get("okres", "")
        kraj = m.get("kraj", "")
        population = m.get("population", 0)
        je_mesto = m.get("je_mesto", False)

        # Skip military districts
        if "vojenský obvod" in name.lower():
            log(f"  SKIP military district: {name}")
            continue

        ico = None

        # Priority 1: existing complete_municipality_map (by NUTS)
        if nuts in existing_ico_map:
            ico = existing_ico_map[nuts]

        # Priority 2: RPO cache from previous partial run
        if not ico and nuts in rpo_cache:
            cached = rpo_cache[nuts]
            if cached:  # None means "looked up, not found"
                ico = cached
                rpo_cached_hits += 1
            else:
                rpo_failed.append({"name": name, "nuts_code": nuts})
                continue

        # Priority 3: Fresh RPO API lookup
        if not ico and nuts not in rpo_cache:
            ico = _rpo_lookup_with_validation(name, nuts, okres, je_mesto)
            # Cache result (even None = "not found") for crash resilience
            rpo_cache[nuts] = ico
            _save_rpo_cache(rpo_cache)
            if ico:
                rpo_fetched += 1
            else:
                rpo_failed.append({"name": name, "nuts_code": nuts})
                log(f"    FAILED to find IČO for: {name}")
            time.sleep(RPO_RATE_LIMIT)

        if ico:
            muni_type = "mesto" if je_mesto else "obec"
            result[ico] = {
                "ico": ico,
                "official_name": name,
                "nuts5_code": nuts,
                "region": kraj,
                "district": okres,
                "population": population,
                "type": muni_type,
            }

        # Progress every 100
        if (i + 1) % 500 == 0:
            log(f"  Progress: {i+1}/{len(register)} processed, {len(result)} with IČO")

    log(f"  RPO fresh lookups: {rpo_fetched}, cached hits: {rpo_cached_hits}, failed: {len(rpo_failed)}")
    log(f"  Total municipalities with IČO: {len(result)}")

    if rpo_failed:
        log(f"  Failed ({len(rpo_failed)}): {[f['name'] for f in rpo_failed[:20]]}")

    # Save the complete reference
    with open(MUNICIPALITIES_ICO_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    log(f"  Saved {len(result)} municipalities to {MUNICIPALITIES_ICO_PATH}")

    return result


def is_municipality_name(name: str) -> bool:
    """Check if a name looks like a municipality (for ITMS subject filtering)."""
    if not name:
        return False
    n = name.lower()
    prefixes = ["obec ", "mesto ", "mestská čas", "hlavné mesto"]
    return any(n.startswith(p) for p in prefixes)


# ===================================================================
# STEP 2 — Normalize IČOs in all data sources
# ===================================================================
def step2_load_and_normalize():
    """Load and normalize aggregated and irregularities data."""
    log("Step 2: Loading and normalizing IČOs")

    # Load aggregated_by_beneficiary.json
    if not os.path.exists(AGGREGATED_PATH):
        log(f"  ERROR: {AGGREGATED_PATH} not found!")
        log("  Run fetch_itms.py first to generate aggregated data.")
        sys.exit(1)

    with open(AGGREGATED_PATH, "r", encoding="utf-8") as f:
        aggregated_raw = json.load(f)

    # Normalize — it's a list, convert to dict keyed by normalized IČO
    aggregated = {}
    ico_anomalies = []
    for entry in aggregated_raw:
        raw_ico = entry.get("ico")
        ico = normalize_ico(raw_ico)
        if ico:
            entry["ico"] = ico
            aggregated[ico] = entry
        else:
            ico_anomalies.append({"raw_ico": str(raw_ico), "name": entry.get("nazov", "?")})

    log(f"  Aggregated: {len(aggregated)} beneficiaries loaded")
    if ico_anomalies:
        log(f"  IČO anomalies in aggregated: {len(ico_anomalies)}")
        for a in ico_anomalies[:5]:
            log(f"    {a}")

    # Load irregularities_by_ico.json
    irregularities = {}
    if os.path.exists(IRREGULARITIES_PATH):
        with open(IRREGULARITIES_PATH, "r", encoding="utf-8") as f:
            irreg_raw = json.load(f)
        for entry in irreg_raw:
            raw_ico = entry.get("ico")
            ico = normalize_ico(raw_ico)
            if ico:
                entry["ico"] = ico
                irregularities[ico] = entry
        log(f"  Irregularities: {len(irregularities)} IČOs loaded")
    else:
        log(f"  Irregularities file not found at {IRREGULARITIES_PATH}, skipping")

    return aggregated, irregularities, ico_anomalies


# ===================================================================
# STEP 3 — IČO join
# ===================================================================
def step3_join(municipalities, aggregated, irregularities):
    """Join municipality reference with ITMS data by IČO."""
    log("Step 3: Running IČO join")

    municipal_stats = {}
    matched = 0
    zero_project = 0
    excluded = []

    # For each municipality in reference → look up in aggregated
    for ico, muni in municipalities.items():
        record = {
            "ico": ico,
            "official_name": muni.get("official_name", ""),
            "nuts5_code": muni.get("nuts5_code", ""),
            "region": muni.get("region", ""),
            "district": muni.get("district", ""),
            "population": muni.get("population", 0),
            "type": muni.get("type", "obec"),
            "active_projects": 0,
            "completed_projects": 0,
            "total_contracted_eur": 0.0,
            "total_contracted_amended_eur": 0.0,
            "projects": [],
            "gps_lat": None,
            "gps_lon": None,
            "irregularities_count": 0,
            "irregularities_total_eur": 0.0,
        }

        if ico in aggregated:
            a = aggregated[ico]
            record["active_projects"] = a.get("projects_active", 0)
            record["completed_projects"] = a.get("projects_completed", 0)
            record["total_contracted_eur"] = a.get("total_contracted_eur", 0.0)
            record["total_contracted_amended_eur"] = a.get("total_contracted_original_eur", 0.0)
            record["projects"] = a.get("projects", [])
            record["gps_lat"] = a.get("gps_lat")
            record["gps_lon"] = a.get("gps_lon")
            # Use ITMS name if we don't have an official one
            if not record["official_name"]:
                record["official_name"] = a.get("nazov", "")
            matched += 1
        else:
            zero_project += 1

        if ico in irregularities:
            ir = irregularities[ico]
            record["irregularities_count"] = ir.get("count", 0)
            record["irregularities_total_eur"] = ir.get("total_irregularity_eur", 0.0)

        municipal_stats[ico] = record

    # Build excluded list — IČOs in aggregated but NOT in municipality reference
    for ico, a in aggregated.items():
        if ico not in municipalities:
            excluded.append({
                "ico": ico,
                "name": a.get("nazov", ""),
                "total_contracted_eur": a.get("total_contracted_eur", 0.0),
                "projects_count": a.get("projects_count", 0),
            })

    excluded.sort(key=lambda x: x["total_contracted_eur"], reverse=True)

    log(f"  Matched municipalities: {matched}")
    log(f"  Zero-project municipalities: {zero_project}")
    log(f"  Excluded non-municipality IČOs: {len(excluded)}")

    return municipal_stats, excluded, matched, zero_project


# ===================================================================
# STEP 4 — Save outputs
# ===================================================================
def step4_save(municipal_stats, excluded):
    log("Step 4: Saving outputs")

    with open(OUTPUT_STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(municipal_stats, f, ensure_ascii=False, indent=2)
    log(f"  Saved {len(municipal_stats)} municipalities to {OUTPUT_STATS_PATH}")

    with open(OUTPUT_EXCLUDED_PATH, "w", encoding="utf-8") as f:
        json.dump(excluded, f, ensure_ascii=False, indent=2)
    log(f"  Saved {len(excluded)} excluded beneficiaries to {OUTPUT_EXCLUDED_PATH}")


# ===================================================================
# STEP 5 — Validation report
# ===================================================================
def step5_report(municipalities, municipal_stats, excluded, ico_anomalies, matched, zero_project):
    log("Step 5: Generating validation report")

    # Top 10 by total contracted
    sorted_by_amount = sorted(
        [(ico, r) for ico, r in municipal_stats.items() if r["total_contracted_eur"] > 0],
        key=lambda x: x[1]["total_contracted_eur"],
        reverse=True,
    )
    top10 = sorted_by_amount[:10]
    bottom10 = sorted_by_amount[-10:] if len(sorted_by_amount) >= 10 else sorted_by_amount

    # IČO anomalies
    non_8digit = [ico for ico in municipalities if len(ico) != 8]
    non_numeric = [ico for ico in municipalities if not ico.isdigit()]
    # Duplicate detection
    icos = list(municipalities.keys())
    duplicates = [ico for ico in set(icos) if icos.count(ico) > 1]

    # Excluded totals
    excluded_total = sum(e["total_contracted_eur"] for e in excluded)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = []
    lines.append("=== POVOLBACH.SK — IČO Matching Validation Report ===")
    lines.append(f"Generated: {now}")
    lines.append("")
    lines.append("MUNICIPALITY REFERENCE LIST")
    lines.append(f"  Total municipalities in reference: {len(municipalities)}")
    lines.append("")
    lines.append("MATCHING RESULTS")
    lines.append(f"  Municipalities with ≥1 project: {matched}")
    lines.append(f"  Municipalities with €0 (no projects found): {zero_project}")
    lines.append("")
    lines.append("EXCLUDED BENEFICIARIES (not municipalities)")
    lines.append(f"  Total excluded IČOs: {len(excluded)}")
    lines.append(f"  Total excluded contracted amount: €{excluded_total:,.0f}")
    lines.append(f"  Sample (top 10 by amount):")
    for e in excluded[:10]:
        lines.append(f"    {e['ico']} | {e['name']} | €{e['total_contracted_eur']:,.0f}")
    lines.append("")
    lines.append("IČO FORMAT ANOMALIES")
    lines.append(f"  Non-8-digit IČOs found: {non_8digit if non_8digit else 'none'}")
    lines.append(f"  Non-numeric IČOs found: {non_numeric if non_numeric else 'none'}")
    lines.append(f"  Duplicate IČOs in reference: {duplicates if duplicates else 'none'}")
    if ico_anomalies:
        lines.append(f"  Anomalies in aggregated data: {len(ico_anomalies)}")
        for a in ico_anomalies[:5]:
            lines.append(f"    raw={a['raw_ico']} | {a['name']}")
    lines.append("")
    lines.append("TOP 10 MUNICIPALITIES BY TOTAL CONTRACTED EUR")
    for i, (ico, r) in enumerate(top10, 1):
        n_proj = r["active_projects"] + r["completed_projects"]
        lines.append(f"  {i}. {r['official_name']} ({ico}) — €{r['total_contracted_eur']:,.0f} — {n_proj} projects")
    lines.append("")
    lines.append("BOTTOM 10 MUNICIPALITIES (with projects, by amount)")
    for i, (ico, r) in enumerate(bottom10, 1):
        n_proj = r["active_projects"] + r["completed_projects"]
        lines.append(f"  {i}. {r['official_name']} ({ico}) — €{r['total_contracted_eur']:,.0f} — {n_proj} projects")

    report = "\n".join(lines)

    with open(VALIDATION_REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report + "\n")
    log(f"  Saved validation report to {VALIDATION_REPORT_PATH}")

    return report


# ===================================================================
# STEP 6 — Final summary
# ===================================================================
def step6_summary(municipal_stats, matched, zero_project):
    total_funds = sum(r["total_contracted_eur"] for r in municipal_stats.values())

    print("\n=== DONE ===")
    print(f"municipal_stats.json: {len(municipal_stats)} municipalities")
    print(f"Matched: {matched} | Zero-project: {zero_project}")
    print(f"Total EU funds tracked: €{total_funds:,.0f}")
    print(f"See validation_report.txt for full details")

    # Warnings
    if zero_project > 500:
        print(f"\n⚠ WARNING: {zero_project} municipalities with €0 — this is higher than expected")
    if matched < 2400:
        print(f"\n⚠ WARNING: Only {matched} matches — expected ~2,500+")


# ===================================================================
# MAIN
# ===================================================================
def main():
    log("=" * 60)
    log("match_municipalities.py — Starting")
    log("=" * 60)

    try:
        municipalities = step1_load_or_create_reference()
        aggregated, irregularities, ico_anomalies = step2_load_and_normalize()
        municipal_stats, excluded, matched, zero_project = step3_join(
            municipalities, aggregated, irregularities
        )
        step4_save(municipal_stats, excluded)
        step5_report(municipalities, municipal_stats, excluded, ico_anomalies, matched, zero_project)
        step6_summary(municipal_stats, matched, zero_project)
    except SystemExit:
        raise
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        log(traceback.format_exc())
        raise
    finally:
        flush_log()


if __name__ == "__main__":
    main()
