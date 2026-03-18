#!/usr/bin/env python3
"""
Build a complete register of all Slovak municipalities (~2,933) from the
Statistical Office API (data.statistics.sk), merge with ITMS EU fund data,
and produce:
  - all_municipalities_register.json   (the register itself)
  - complete_municipality_map.json     (register + ITMS data merged)
  - match_quality_report.txt           (diagnostics)
"""

import json
import re
import unicodedata
from pathlib import Path

DATA_DIR = Path(__file__).parent

# ---------------------------------------------------------------------------
# 1. Load Statistical Office data
# ---------------------------------------------------------------------------
print("=" * 80)
print("STEP 1: Loading Statistical Office municipality data")
print("=" * 80)

with open(DATA_DIR / "susr_municipalities_dim.json", encoding="utf-8") as f:
    muni_dim = json.load(f)

with open(DATA_DIR / "susr_pop_2024.json", encoding="utf-8") as f:
    pop_data = json.load(f)

with open(DATA_DIR / "susr_hierarchy_dim.json", encoding="utf-8") as f:
    hier_dim = json.load(f)

# Build district/region lookup from hierarchy
hier_labels = hier_dim["category"]["label"]

REGION_MAP = {}   # 3-char code (e.g. "010") -> region name
DISTRICT_MAP = {} # 4-char code (e.g. "SK0106") -> district name
KRAJ_MAP = {}     # 3-char code (e.g. "010") -> kraj name

for code, name in hier_labels.items():
    if re.match(r"^SK\d{4}$", code):
        # District: SK0106 -> "Okres Malacky"
        DISTRICT_MAP[code] = name
    elif re.match(r"^SK\d{3}$", code) and len(code) == 5:
        # Kraj: SK010 -> "Bratislavský kraj"
        KRAJ_MAP[code] = name

# Build municipality list
muni_labels = muni_dim["category"]["label"]
muni_index = muni_dim["category"]["index"]
pop_values = pop_data["value"]

# Map NUTS code to population
pop_by_code = {}
for code, idx in muni_index.items():
    if idx < len(pop_values):
        pop_by_code[code] = pop_values[idx]

# Identify towns (mestá) — from the GitHub data and known Slovak towns
# We'll use the Statistical Office hierarchy: municipalities in "M" (Mestá) category
# For now, we'll infer from ITMS data or mark based on known prefixes

print(f"  Municipalities from Statistical Office: {len(muni_labels)}")
print(f"  Population values: {len(pop_by_code)}")

# ---------------------------------------------------------------------------
# 2. Build the register
# ---------------------------------------------------------------------------
print()
print("=" * 80)
print("STEP 2: Building municipality register")
print("=" * 80)

register = []
for code, name in muni_labels.items():
    # Parse NUTS code: SK0106504556
    # SK = country (2)
    # 01 = NUTS2 region (2)
    # 06 = district within NUTS2 (2) -> full district code is first 6 chars
    # 504556 = LAU2 municipality code (6)
    dist_code = code[:6]  # e.g. "SK0106"
    kraj_code = code[:5]  # e.g. "SK010"

    # Look up district name
    okres = DISTRICT_MAP.get(dist_code, "")
    # Strip "Okres " prefix for cleaner output
    okres_clean = okres.replace("Okres ", "") if okres.startswith("Okres ") else okres

    # Look up kraj name
    kraj = KRAJ_MAP.get(kraj_code, "")

    # Determine if it's a town (mesto)
    # Simple heuristic: names that are well-known cities, or we'll cross-reference later
    je_mesto = False  # Will be enriched during merge

    population = pop_by_code.get(code)

    entry = {
        "nazov": name,
        "nuts_code": code,
        "lau2_code": code[6:] if len(code) > 6 else code,
        "okres": okres_clean,
        "okres_code": dist_code,
        "kraj": kraj,
        "kraj_code": kraj_code,
        "je_mesto": je_mesto,
        "population": population,
        "gps_lat": None,
        "gps_lon": None,
    }
    register.append(entry)

# Sort by kraj, okres, name
register.sort(key=lambda e: (e["kraj"], e["okres"], e["nazov"]))

print(f"  Register entries: {len(register)}")
pop_count = sum(1 for e in register if e["population"] is not None)
print(f"  With population data: {pop_count}")
total_pop = sum(e["population"] for e in register if e["population"])
print(f"  Total population: {total_pop:,}")

# Save register
with open(DATA_DIR / "all_municipalities_register.json", "w", encoding="utf-8") as f:
    json.dump(register, f, ensure_ascii=False, indent=2)
print(f"  Saved: all_municipalities_register.json")

# ---------------------------------------------------------------------------
# 3. Load ITMS municipality data
# ---------------------------------------------------------------------------
print()
print("=" * 80)
print("STEP 3: Loading ITMS municipality data for merge")
print("=" * 80)

with open(DATA_DIR / "municipalities_only.json", encoding="utf-8") as f:
    itms_munis = json.load(f)

print(f"  ITMS municipality entries: {len(itms_munis)}")

# ---------------------------------------------------------------------------
# 4. Name normalization for fuzzy matching
# ---------------------------------------------------------------------------

def normalize(name: str) -> str:
    """Normalize a municipality name for matching."""
    s = name.strip()
    # Case-insensitive prefix removal
    s_lower = s.lower()
    for prefix in ["obec ", "mesto ", "mestská časť ", "mestská cast "]:
        if s_lower.startswith(prefix):
            s = s[len(prefix):]
            break
    # Handle "Hlavné mesto Slovenskej republiky Bratislava"
    if "hlavné mesto" in name.lower() and "bratislava" in name.lower():
        s = "Bratislava"
    # Remove "mestská časť" from middle of name (e.g. "Bratislava - mestská časť Jarovce")
    # Also handle "Mestská časť-" (dash without space)
    s = re.sub(r"mestská\s+čas[tť][\s-]+", "", s, flags=re.IGNORECASE)
    # Normalize whitespace and dashes
    s = re.sub(r"\s*[-–—]\s*", " - ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Lowercase for comparison
    s = s.lower()
    return s


def strip_diacritics(s: str) -> str:
    """Remove diacritics for fallback matching."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Build lookup tables for register
reg_by_name = {}  # normalized name -> list of register entries
reg_by_name_nodiac = {}  # diacritics-stripped -> list

for entry in register:
    norm = normalize(entry["nazov"])
    reg_by_name.setdefault(norm, []).append(entry)
    nodiac = strip_diacritics(norm)
    reg_by_name_nodiac.setdefault(nodiac, []).append(entry)

# ---------------------------------------------------------------------------
# 4b. Special handling: city-level entries for Bratislava & Košice
# ---------------------------------------------------------------------------
# The Statistical Office lists individual mestské časti (city boroughs) for
# both Bratislava and Košice. The ITMS dataset has BOTH city-level entries
# ("Mesto Košice", "Hlavné mesto SR Bratislava") AND individual MČ entries.
# We need to handle the city-level entries specially — they don't map 1:1.
# Strategy: Create synthetic "city aggregate" entries in the register for
# Bratislava and Košice, summing population across their MČ.

ba_mc_entries = [e for e in register if e["nazov"].startswith("Bratislava - ")]
ke_mc_entries = [e for e in register if e["nazov"].startswith("Košice - ") or e["nazov"].startswith("Košice ")]
# Filter out the "Košice 1" through "Košice 5" aggregate entries (no population)
ke_mc_real = [e for e in ke_mc_entries if e["population"] is not None]

ba_total_pop = sum(e["population"] or 0 for e in ba_mc_entries)
ke_total_pop = sum(e["population"] or 0 for e in ke_mc_real)

# Create synthetic city-level register entries
ba_city_entry = {
    "nazov": "Bratislava",
    "nuts_code": "SK01_BA",
    "lau2_code": "BA_CITY",
    "okres": "Bratislava I-V",
    "okres_code": "SK010",
    "kraj": "Bratislavský kraj",
    "kraj_code": "SK010",
    "je_mesto": True,
    "population": ba_total_pop,
    "gps_lat": None,
    "gps_lon": None,
    "_synthetic": True,
}

ke_city_entry = {
    "nazov": "Košice",
    "nuts_code": "SK042_KE",
    "lau2_code": "KE_CITY",
    "okres": "Košice I-IV",
    "okres_code": "SK042",
    "kraj": "Košický kraj",
    "kraj_code": "SK042",
    "je_mesto": True,
    "population": ke_total_pop,
    "gps_lat": None,
    "gps_lon": None,
    "_synthetic": True,
}

# Add synthetic entries to the name lookup (but NOT to register to avoid
# double-counting population)
reg_by_name.setdefault("bratislava", []).append(ba_city_entry)
reg_by_name.setdefault("košice", []).insert(0, ke_city_entry)

# Also add Bratislava MČ names with "bratislava - " prefix for ITMS matching
for entry in register:
    name = entry["nazov"]
    # "Bratislava - Jarovce" is in register; ITMS has "Bratislava - mestská časť Jarovce"
    # normalize() strips "Mestská časť " and "Bratislava - mestská časť" -> "Jarovce"
    # But we also need "bratislava - jarovce" in the lookup
    if name.startswith("Bratislava - "):
        part = name[len("Bratislava - "):]
        reg_by_name.setdefault(f"bratislava - {part.lower()}", []).append(entry)
    if name.startswith("Košice - "):
        part = name[len("Košice - "):]
        reg_by_name.setdefault(f"košice - {part.lower()}", []).append(entry)

# Known Czech municipalities in ITMS (cross-border projects)
CZECH_ICOS = {
    "00303780",  # Horní Lideč
    "00544701",  # Kuželov
    "00290823",  # Boršice
    "00283631",  # Tvrdonice
    "00283274",  # Kostice
    "00285188",  # Nová Lhota
    "00284858",  # Dolní Bojanovice
}

# Known non-municipality entries that slipped through
SKIP_ICOS = {
    "36821292",  # "Obec Nitrianske Pravno, s. r. o." — company, not municipality
}

# Manual IČO-to-register-NUTS mappings for entries that can't be name-matched
MANUAL_ICO_TO_NUTS = {
    "00690996": "SK0424598682",  # "Mestská časť-Košická Nová Ves" -> "Košice - Košická Nová Ves"
}
# Build reverse lookup: NUTS -> register entry
_reg_by_nuts = {e["nuts_code"]: e for e in register}
for ico_manual, nuts_manual in MANUAL_ICO_TO_NUTS.items():
    if nuts_manual not in _reg_by_nuts:
        # Try to find partial match
        for e in register:
            if "Košická Nová Ves" in e["nazov"]:
                MANUAL_ICO_TO_NUTS[ico_manual] = e["nuts_code"]
                _reg_by_nuts[e["nuts_code"]] = e
                break

# ---------------------------------------------------------------------------
# 5. Match ITMS entries to register
# ---------------------------------------------------------------------------
print()
print("=" * 80)
print("STEP 4: Matching ITMS beneficiaries to municipality register")
print("=" * 80)

matched = []
unmatched_itms = []
czech_entries = []
skipped_entries = []
multi_match = []


def disambiguate(itms_entry, candidates):
    """Try to pick the right candidate when multiple register entries match."""
    # Use ITMS municipality_name field
    itms_muni = (itms_entry.get("municipality_name") or "").lower()
    itms_addr = json.dumps(itms_entry.get("address", {})).lower()

    for c in candidates:
        # Check if district name appears in ITMS municipality_name or address
        if c["okres"].lower() in itms_muni or c["okres"].lower() in itms_addr:
            return c
        # Check if kraj appears
        if c["kraj"].lower() in itms_muni:
            return c

    # Try GPS proximity if available
    itms_lat = itms_entry.get("gps_lat")
    itms_lon = itms_entry.get("gps_lon")
    if itms_lat and itms_lon:
        # Not enough data in register for GPS, but we could compare okres
        pass

    # Fallback: return first candidate
    return candidates[0]


for itms in itms_munis:
    ico = itms.get("ico", "")
    itms_name = itms.get("nazov", "")

    # Skip known non-municipalities
    if ico in SKIP_ICOS:
        skipped_entries.append(itms)
        continue

    # Flag Czech municipalities
    if ico in CZECH_ICOS:
        czech_entries.append(itms)
        continue

    # Manual IČO-to-NUTS mapping
    if ico in MANUAL_ICO_TO_NUTS:
        nuts_target = MANUAL_ICO_TO_NUTS[ico]
        reg_target = _reg_by_nuts.get(nuts_target)
        if reg_target:
            matched.append((itms, reg_target, "manual_ico"))
            continue

    norm = normalize(itms_name)
    candidates = reg_by_name.get(norm, [])

    if len(candidates) == 1:
        matched.append((itms, candidates[0], "exact"))
        continue
    elif len(candidates) > 1:
        best = disambiguate(itms, candidates)
        matched.append((itms, best, "disambiguated"))
        multi_match.append((itms_name, [c["nazov"] + " (" + c["okres"] + ")" for c in candidates],
                            best["nazov"] + " (" + best["okres"] + ")"))
        continue

    # Try without diacritics
    nodiac = strip_diacritics(norm)
    candidates = reg_by_name_nodiac.get(nodiac, [])
    if len(candidates) == 1:
        matched.append((itms, candidates[0], "nodiac"))
        continue
    elif len(candidates) > 1:
        best = disambiguate(itms, candidates)
        matched.append((itms, best, "nodiac_disambiguated"))
        continue

    # Try Bratislava mestské časti special handling
    # ITMS: "Mestská časť Bratislava - Rača" -> normalize -> "bratislava - rača"
    # Register: "Bratislava - Rača" -> normalize -> "bratislava - rača" (already in lookup)
    if "bratislava" in norm:
        ba_part = norm
        # Try "bratislava - X" pattern
        for sep in ["bratislava - ", "bratislava- ", "bratislava–"]:
            if sep in ba_part:
                part_name = ba_part.split(sep, 1)[-1].strip()
                lookup = f"bratislava - {part_name}"
                candidates = reg_by_name.get(lookup, [])
                if candidates:
                    matched.append((itms, candidates[0], "bratislava_mc"))
                    break
        else:
            unmatched_itms.append(itms)
        continue

    # Try Košice mestské časti
    if "košice" in norm:
        ke_norm = re.sub(r"košice\s*[-–—]\s*", "košice - ", norm)
        candidates = reg_by_name.get(ke_norm, [])
        if candidates:
            matched.append((itms, candidates[0], "kosice_mc"))
            continue

    unmatched_itms.append(itms)

print(f"  Matched: {len(matched)}")
print(f"    Exact: {sum(1 for _,_,m in matched if m == 'exact')}")
print(f"    Disambiguated (multi-candidate): {sum(1 for _,_,m in matched if 'disambiguated' in m)}")
print(f"    No-diacritics: {sum(1 for _,_,m in matched if m.startswith('nodiac'))}")
print(f"    Bratislava MČ: {sum(1 for _,_,m in matched if m == 'bratislava_mc')}")
print(f"    Košice MČ: {sum(1 for _,_,m in matched if m == 'kosice_mc')}")
print(f"  Czech municipalities (cross-border): {len(czech_entries)}")
print(f"  Skipped (non-municipality):          {len(skipped_entries)}")
print(f"  Unmatched ITMS entries:              {len(unmatched_itms)}")

if multi_match:
    print(f"\n  Disambiguated cases: {len(multi_match)}")
    for name, cands, chosen in multi_match[:10]:
        print(f"    {name} -> CHOSEN: {chosen}")
        print(f"      candidates: {cands}")

if czech_entries:
    print(f"\n  Czech municipalities (cross-border projects):")
    for itms in czech_entries:
        print(f"    {itms['ico']} | {itms['nazov']} | €{itms['total_contracted_eur']:,.2f}")

if unmatched_itms:
    print(f"\n  Unmatched ITMS entries:")
    for itms in unmatched_itms[:30]:
        print(f"    {itms['ico']} | {itms['nazov']} | €{itms['total_contracted_eur']:,.2f}")

# ---------------------------------------------------------------------------
# 6. Build merged output
# ---------------------------------------------------------------------------
print()
print("=" * 80)
print("STEP 5: Building complete_municipality_map.json")
print("=" * 80)

# Track which register entries got matched
matched_nuts = set()
for itms, reg, _ in matched:
    matched_nuts.add(reg["nuts_code"])

# Mark je_mesto based on ITMS name
for itms, reg, _ in matched:
    itms_name = itms.get("nazov", "")
    if itms_name.startswith("Mesto ") or itms_name.startswith("Hlavné mesto"):
        reg["je_mesto"] = True

complete = []

# Build ITMS lookup by register NUTS code
itms_by_nuts = {}
for itms, reg, method in matched:
    nuts = reg["nuts_code"]
    if nuts not in itms_by_nuts:
        itms_by_nuts[nuts] = itms

# Include synthetic city-level entries (Bratislava, Košice) in the register for output
# These are city aggregates — their MČ entries still appear separately
all_entries = list(register)
# Add synthetics only if they were matched
for synth in [ba_city_entry, ke_city_entry]:
    if synth["nuts_code"] in itms_by_nuts:
        all_entries.append(synth)

for reg_entry in all_entries:
    nuts = reg_entry["nuts_code"]
    itms = itms_by_nuts.get(nuts)

    entry = {
        # Register fields
        "nazov": reg_entry["nazov"],
        "nuts_code": reg_entry["nuts_code"],
        "lau2_code": reg_entry["lau2_code"],
        "okres": reg_entry["okres"],
        "okres_code": reg_entry["okres_code"],
        "kraj": reg_entry["kraj"],
        "kraj_code": reg_entry["kraj_code"],
        "je_mesto": reg_entry["je_mesto"],
        "population": reg_entry["population"],
        # GPS: prefer ITMS data, fall back to register
        "gps_lat": None,
        "gps_lon": None,
        # ITMS fields
        "ico": None,
        "has_eu_projects": False,
        "projects_count": 0,
        "projects_active": 0,
        "projects_completed": 0,
        "total_contracted_eur": 0,
        "total_contracted_original_eur": 0,
        "eur_per_capita": None,
    }

    if itms:
        entry["ico"] = itms.get("ico")
        entry["has_eu_projects"] = True
        entry["projects_count"] = itms.get("projects_count", 0)
        entry["projects_active"] = itms.get("projects_active", 0)
        entry["projects_completed"] = itms.get("projects_completed", 0)
        entry["total_contracted_eur"] = itms.get("total_contracted_eur", 0)
        entry["total_contracted_original_eur"] = itms.get("total_contracted_original_eur", 0)
        entry["gps_lat"] = itms.get("gps_lat")
        entry["gps_lon"] = itms.get("gps_lon")

    # Calculate per-capita
    if entry["population"] and entry["population"] > 0 and entry["total_contracted_eur"] > 0:
        entry["eur_per_capita"] = round(entry["total_contracted_eur"] / entry["population"], 2)

    complete.append(entry)

# Sort: by total_contracted_eur desc for convenience, but also provide sorted-by-name
complete.sort(key=lambda e: e["total_contracted_eur"], reverse=True)

with open(DATA_DIR / "complete_municipality_map.json", "w", encoding="utf-8") as f:
    json.dump(complete, f, ensure_ascii=False, indent=2)

# Also save unmatched and czech for inspection
with open(DATA_DIR / "unmatched_itms_entries.json", "w", encoding="utf-8") as f:
    json.dump([{
        "ico": e["ico"],
        "nazov": e["nazov"],
        "total_contracted_eur": e["total_contracted_eur"],
        "projects_count": e["projects_count"],
    } for e in unmatched_itms], f, ensure_ascii=False, indent=2)

with open(DATA_DIR / "czech_crossborder_entries.json", "w", encoding="utf-8") as f:
    json.dump([{
        "ico": e["ico"],
        "nazov": e["nazov"],
        "total_contracted_eur": e["total_contracted_eur"],
        "projects_count": e["projects_count"],
    } for e in czech_entries], f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------------
# 7. Summary statistics
# ---------------------------------------------------------------------------
print()
print("=" * 80)
print("FINAL SUMMARY")
print("=" * 80)

with_projects = [e for e in complete if e["has_eu_projects"]]
without_projects = [e for e in complete if not e["has_eu_projects"]]
total_eur = sum(e["total_contracted_eur"] for e in complete)

print(f"  Total municipalities in register:    {len(complete):,}")
print(f"  With EU projects (matched):          {len(with_projects):,}")
print(f"  Without EU projects (€0):            {len(without_projects):,}")
print(f"  Unmatched ITMS entries (lost):        {len(unmatched_itms)}")
print(f"  Total contracted (matched):          €{total_eur:,.2f}")
print()

# Per-capita stats
with_percapita = [e for e in complete if e["eur_per_capita"] is not None]
print(f"  Municipalities with per-capita data: {len(with_percapita)}")
if with_percapita:
    with_percapita.sort(key=lambda e: e["eur_per_capita"], reverse=True)
    print()
    print("-" * 80)
    print("TOP 20 BY EUR PER CAPITA")
    print("-" * 80)
    for i, e in enumerate(with_percapita[:20], 1):
        print(f"  {i:>3}. {e['nazov']:<40s} €{e['eur_per_capita']:>10,.2f}/cap  (pop: {e['population']:>6,}, total: €{e['total_contracted_eur']:>14,.2f})")

    print()
    print("-" * 80)
    print("BOTTOM 20 (with projects) BY EUR PER CAPITA")
    print("-" * 80)
    for i, e in enumerate(with_percapita[-20:], len(with_percapita) - 19):
        print(f"  {i:>3}. {e['nazov']:<40s} €{e['eur_per_capita']:>10,.2f}/cap  (pop: {e['population']:>6,}, total: €{e['total_contracted_eur']:>14,.2f})")

# Regions summary
print()
print("-" * 80)
print("BY REGION (KRAJ)")
print("-" * 80)
from collections import defaultdict
by_kraj = defaultdict(lambda: {"count": 0, "with_proj": 0, "eur": 0, "pop": 0})
for e in complete:
    k = e["kraj"] or "Unknown"
    by_kraj[k]["count"] += 1
    if e["has_eu_projects"]:
        by_kraj[k]["with_proj"] += 1
    by_kraj[k]["eur"] += e["total_contracted_eur"]
    by_kraj[k]["pop"] += e["population"] or 0

for kraj in sorted(by_kraj.keys()):
    d = by_kraj[kraj]
    pct = d["with_proj"] / d["count"] * 100 if d["count"] else 0
    pc = d["eur"] / d["pop"] if d["pop"] else 0
    print(f"  {kraj:<30s} {d['count']:>4} munis, {d['with_proj']:>4} with projects ({pct:>5.1f}%), €{d['eur']:>14,.0f} total, €{pc:>8,.0f}/cap")

# Without projects — sample
print()
print("-" * 80)
print(f"SAMPLE: MUNICIPALITIES WITHOUT EU PROJECTS ({len(without_projects)} total)")
print("-" * 80)
without_projects.sort(key=lambda e: -(e["population"] or 0))
for e in without_projects[:20]:
    pop = e["population"] or 0
    print(f"  {e['nazov']:<40s} pop: {pop:>6,}  {e['okres']:<25s} {e['kraj']}")

print()
print("=" * 80)
print("OUTPUT FILES:")
print(f"  all_municipalities_register.json     ({len(register)} entries)")
print(f"  complete_municipality_map.json        ({len(complete)} entries)")
print(f"  unmatched_itms_entries.json           ({len(unmatched_itms)} entries)")
print("=" * 80)
