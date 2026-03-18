#!/usr/bin/env python3
"""
ITMS2014+ Open Data Pipeline for povolbach.sk

Fetches all projects, resolves beneficiaries and municipalities,
fetches irregularities, and aggregates everything by beneficiary IČO.

Resumable: caches raw API responses to disk so partial runs can continue.
No external dependencies — Python 3.12+ stdlib only.

Output files:
  data/raw_project_lists.json        — cached list responses
  data/raw_project_details/          — individual project detail JSONs
  data/raw_subjects.json             — cached subject lookups
  data/raw_nuts_names.json           — cached NUTS name lookups
  data/raw_irregularities.json       — raw irregularity list
  data/aggregated_by_beneficiary.json — main output grouped by IČO
  data/irregularities_by_ico.json    — irregularities grouped by debtor IČO
  data/fetch_log.txt                 — progress log
"""

import asyncio
import json
import logging
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HOST = "https://opendata.itms2014.sk"
BASE = f"{HOST}/v2"
PAGE_SIZE = 1000
CONCURRENCY = 20
RETRY_ATTEMPTS = 3
RETRY_DELAY_429 = 5
RETRY_DELAY_TIMEOUT = 2

DATA_DIR = Path(__file__).parent / "data"
DETAILS_DIR = DATA_DIR / "raw_project_details"

executor = ThreadPoolExecutor(max_workers=CONCURRENCY)

# ---------------------------------------------------------------------------
# Logging — dual output to stderr + file
# ---------------------------------------------------------------------------
logger = logging.getLogger("itms")
logger.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s  %(message)s", datefmt="%H:%M:%S")

_sh = logging.StreamHandler(sys.stderr)
_sh.setFormatter(_fmt)
logger.addHandler(_sh)

# File handler added after DATA_DIR is created
_fh = None


def _init_logging():
    global _fh
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    _fh = logging.FileHandler(DATA_DIR / "fetch_log.txt", mode="w", encoding="utf-8")
    _fh.setFormatter(_fmt)
    logger.addHandler(_fh)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def _http_get(url: str) -> dict | list | None:
    """Synchronous HTTP GET with retry logic. Runs inside thread pool."""
    for attempt in range(RETRY_ATTEMPTS):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = RETRY_DELAY_429 * (attempt + 1)
                logger.warning(f"429 rate-limit on {url}, waiting {wait}s (attempt {attempt+1})")
                time.sleep(wait)
                continue
            logger.error(f"HTTP {e.code} for {url}")
            return None
        except (TimeoutError, urllib.error.URLError) as e:
            if attempt < 1:  # retry timeout once
                logger.warning(f"Timeout on {url}, retrying...")
                time.sleep(RETRY_DELAY_TIMEOUT)
                continue
            logger.error(f"Failed after retries: {url} ({e})")
            return None
        except Exception as e:
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY_TIMEOUT)
            else:
                logger.error(f"Failed: {url} ({e})")
                return None
    return None


async def fetch_json(url: str) -> dict | list | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _http_get, url)


# ---------------------------------------------------------------------------
# Step 1 — Fetch project lists
# ---------------------------------------------------------------------------
async def fetch_all_list(endpoint: str) -> list[dict]:
    """Paginate a list endpoint using minId."""
    all_items: list[dict] = []
    min_id = 0
    while True:
        url = f"{BASE}/projekty/{endpoint}?minId={min_id}&limit={PAGE_SIZE}"
        data = await fetch_json(url)
        if not data:
            break
        all_items.extend(data)
        min_id = max(p["id"] for p in data) + 1
        logger.info(f"  {endpoint}: {len(all_items)} projects fetched")
    return all_items


async def step1_fetch_lists() -> dict:
    """Fetch or load cached project lists."""
    cache_path = DATA_DIR / "raw_project_lists.json"
    if cache_path.exists():
        logger.info(f"Loading cached project lists from {cache_path}")
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        logger.info(
            f"  vrealizacii: {len(cached['vrealizacii'])}, "
            f"ukoncene: {len(cached['ukoncene'])}"
        )
        return cached

    logger.info("Step 1: Fetching project lists...")
    vrealizacii, ukoncene = await asyncio.gather(
        fetch_all_list("vrealizacii"),
        fetch_all_list("ukoncene"),
    )
    result = {"vrealizacii": vrealizacii, "ukoncene": ukoncene}
    cache_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    logger.info(
        f"  Saved {len(vrealizacii)} + {len(ukoncene)} = "
        f"{len(vrealizacii) + len(ukoncene)} projects to {cache_path}"
    )
    return result


# ---------------------------------------------------------------------------
# Step 2 — Fetch project details (resumable)
# ---------------------------------------------------------------------------
async def fetch_and_cache_detail(
    sem: asyncio.Semaphore, project: dict, endpoint: str
) -> dict | None:
    """Fetch a single project detail, using on-disk cache."""
    pid = project["id"]
    cache_file = DETAILS_DIR / f"{endpoint}_{pid}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    href = project.get("href", f"/v2/projekty/{endpoint}/{pid}")
    async with sem:
        detail = await fetch_json(f"{HOST}{href}")
    if detail:
        cache_file.write_text(json.dumps(detail, ensure_ascii=False), encoding="utf-8")
    return detail


async def step2_fetch_details(lists: dict) -> list[tuple[str, dict]]:
    """Fetch all project details with concurrency limit. Returns (endpoint, detail) pairs."""
    sem = asyncio.Semaphore(CONCURRENCY)
    all_tasks = []

    for endpoint, projects in [("vrealizacii", lists["vrealizacii"]),
                                ("ukoncene", lists["ukoncene"])]:
        for p in projects:
            all_tasks.append((endpoint, p))

    total = len(all_tasks)
    logger.info(f"Step 2: Fetching details for {total} projects (cached ones will be skipped)...")

    results: list[tuple[str, dict]] = []
    batch_size = 200

    for i in range(0, total, batch_size):
        batch = all_tasks[i : i + batch_size]
        coros = [fetch_and_cache_detail(sem, p, ep) for ep, p in batch]
        batch_results = await asyncio.gather(*coros)
        for (ep, _), detail in zip(batch, batch_results):
            if detail:
                results.append((ep, detail))
        done = min(i + batch_size, total)
        logger.info(f"  Details: {done}/{total} processed ({len(results)} successful)")

    logger.info(f"  Total details fetched: {len(results)}")
    return results


# ---------------------------------------------------------------------------
# Step 3 — Resolve NUTS codes to municipality names
# ---------------------------------------------------------------------------
async def step3_resolve_nuts(details: list[tuple[str, dict]]) -> dict[int, str]:
    """Resolve all NUTS IDs to names, with file-based cache."""
    cache_path = DATA_DIR / "raw_nuts_names.json"
    nuts_cache: dict[int, str] = {}
    if cache_path.exists():
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
        nuts_cache = {int(k): v for k, v in raw.items()}
        logger.info(f"  Loaded {len(nuts_cache)} cached NUTS names")

    # Collect all unique NUTS IDs we need to resolve
    to_resolve: dict[int, str] = {}  # id -> href
    for _, detail in details:
        for m in detail.get("miestaRealizacie", []):
            for level in ("nuts5", "nuts4", "nuts3"):
                nuts = m.get(level)
                if nuts and nuts.get("hodnotaNuts"):
                    hv = nuts["hodnotaNuts"]
                    if hv["id"] not in nuts_cache:
                        to_resolve[hv["id"]] = hv["href"]
                    break

    logger.info(f"Step 3: Resolving {len(to_resolve)} new NUTS codes "
                f"({len(nuts_cache)} already cached)...")

    sem = asyncio.Semaphore(CONCURRENCY)

    async def resolve_one(nid: int, href: str):
        url = f"{HOST}{href}" if href.startswith("/") else href
        async with sem:
            data = await fetch_json(url)
        return nid, data.get("nazov", f"unknown-{nid}") if data else f"unknown-{nid}"

    batch_size = 200
    items = list(to_resolve.items())
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        results = await asyncio.gather(*[resolve_one(nid, href) for nid, href in batch])
        for nid, name in results:
            nuts_cache[nid] = name
        done = min(i + batch_size, len(items))
        if items:
            logger.info(f"  NUTS: {done}/{len(items)} resolved")

    # Save cache
    cache_path.write_text(
        json.dumps({str(k): v for k, v in nuts_cache.items()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return nuts_cache


# ---------------------------------------------------------------------------
# Step 4 — Resolve beneficiary (subjekt) details
# ---------------------------------------------------------------------------
async def step4_resolve_subjects(details: list[tuple[str, dict]]) -> dict[int, dict]:
    """Fetch full subject info for all unique beneficiary IDs."""
    cache_path = DATA_DIR / "raw_subjects.json"
    subj_cache: dict[int, dict] = {}
    if cache_path.exists():
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
        subj_cache = {int(k): v for k, v in raw.items()}
        logger.info(f"  Loaded {len(subj_cache)} cached subjects")

    # Collect unique subject IDs
    to_resolve: dict[int, str] = {}  # id -> href
    for _, detail in details:
        subj = detail.get("prijimatel", {}).get("subjekt", {})
        sid = subj.get("id")
        href = subj.get("href", "")
        if sid and sid not in subj_cache:
            to_resolve[sid] = href

    logger.info(f"Step 4: Resolving {len(to_resolve)} new subjects "
                f"({len(subj_cache)} already cached)...")

    sem = asyncio.Semaphore(CONCURRENCY)

    async def resolve_one(sid: int, href: str):
        url = f"{HOST}{href}" if href.startswith("/") else href
        async with sem:
            data = await fetch_json(url)
        return sid, data

    batch_size = 200
    items = list(to_resolve.items())
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        results = await asyncio.gather(*[resolve_one(sid, href) for sid, href in batch])
        for sid, data in results:
            if data:
                subj_cache[sid] = data
        done = min(i + batch_size, len(items))
        if items:
            logger.info(f"  Subjects: {done}/{len(items)} resolved")

    cache_path.write_text(
        json.dumps({str(k): v for k, v in subj_cache.items()}, ensure_ascii=False),
        encoding="utf-8",
    )
    return subj_cache


# ---------------------------------------------------------------------------
# Step 5 — Aggregate by beneficiary IČO
# ---------------------------------------------------------------------------
def resolve_municipalities(detail: dict, nuts_cache: dict[int, str]) -> list[str]:
    """Extract resolved municipality names from project detail."""
    names = []
    for m in detail.get("miestaRealizacie", []):
        for level in ("nuts5", "nuts4", "nuts3"):
            nuts = m.get(level)
            if nuts and nuts.get("hodnotaNuts"):
                nid = nuts["hodnotaNuts"]["id"]
                names.append(nuts_cache.get(nid, f"unknown-{nid}"))
                break
    return names


def resolve_intervention_areas(detail: dict) -> list[dict]:
    """Extract oblastiIntervencie references (unresolved, with IDs)."""
    areas = []
    for oi in detail.get("oblastiIntervencie", []):
        hc = oi.get("hodnotaCiselnika", {})
        areas.append({
            "ciselnikKod": hc.get("ciselnikKod"),
            "id": hc.get("id"),
            "href": hc.get("href", ""),
        })
    return areas


def step5_aggregate(
    details: list[tuple[str, dict]],
    nuts_cache: dict[int, str],
    subj_cache: dict[int, dict],
) -> list[dict]:
    """Aggregate projects by beneficiary IČO."""
    logger.info("Step 5: Aggregating by beneficiary IČO...")

    ico_data: dict[str, dict] = {}

    for endpoint, detail in details:
        subj = detail.get("prijimatel", {}).get("subjekt", {})
        ico = subj.get("ico", "")
        sid = subj.get("id")
        if not ico:
            continue

        if ico not in ico_data:
            # Resolve subject info
            subj_info = subj_cache.get(sid, {}) if sid else {}
            obec = subj_info.get("obec", {})
            obec_nuts = obec.get("hodnotaNuts", {})
            obec_nid = obec_nuts.get("id")
            municipality = nuts_cache.get(obec_nid, "") if obec_nid else ""

            ico_data[ico] = {
                "ico": ico,
                "nazov": subj_info.get("nazov", ""),
                "municipality_name": municipality,
                "gps_lat": obec.get("gpsLat"),
                "gps_lon": obec.get("gpsLon"),
                "address": {
                    "ulica": subj_info.get("ulica", ""),
                    "ulicaCislo": subj_info.get("ulicaCislo", ""),
                    "psc": subj_info.get("psc", ""),
                },
                "projects_count": 0,
                "projects_active": 0,
                "projects_completed": 0,
                "total_contracted_eur": 0.0,
                "total_contracted_original_eur": 0.0,
                "projects": [],
            }

        entry = ico_data[ico]
        entry["projects_count"] += 1
        if endpoint == "vrealizacii":
            entry["projects_active"] += 1
        else:
            entry["projects_completed"] += 1

        contracted = detail.get("sumaZazmluvnena", 0) or 0
        contracted_orig = detail.get("sumaZazmluvnenaPovodna", 0) or 0
        entry["total_contracted_eur"] += contracted
        entry["total_contracted_original_eur"] += contracted_orig

        municipalities = resolve_municipalities(detail, nuts_cache)

        entry["projects"].append({
            "id": detail.get("id"),
            "kod": detail.get("kod", ""),
            "nazov": detail.get("nazov", ""),
            "sumaZazmluvnena": contracted,
            "sumaZazmluvnenaPovodna": contracted_orig,
            "stav": detail.get("stav", ""),
            "datumZaciatkuRealizacie": detail.get("datumZaciatkuRealizacie", ""),
            "datumKoncaRealizacie": detail.get("datumKoncaRealizacie", ""),
            "miestaRealizacie": municipalities,
            "oblastiIntervencie": resolve_intervention_areas(detail),
        })

    # Round and sort
    output = []
    for ico in sorted(ico_data):
        d = ico_data[ico]
        d["total_contracted_eur"] = round(d["total_contracted_eur"], 2)
        d["total_contracted_original_eur"] = round(d["total_contracted_original_eur"], 2)
        output.append(d)

    out_path = DATA_DIR / "aggregated_by_beneficiary.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"  Written {len(output)} beneficiaries to {out_path}")
    return output


# ---------------------------------------------------------------------------
# Step 6 — Irregularities
# ---------------------------------------------------------------------------
async def step6_irregularities() -> list[dict]:
    """Fetch all irregularities and group by debtor IČO."""
    cache_path = DATA_DIR / "raw_irregularities.json"

    if cache_path.exists():
        logger.info(f"  Loading cached irregularities from {cache_path}")
        all_items = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        logger.info("Step 6: Fetching irregularities...")
        all_items: list[dict] = []
        min_id = 0
        while True:
            url = f"{BASE}/nezrovnalost?minId={min_id}&limit={PAGE_SIZE}"
            data = await fetch_json(url)
            if not data:
                break
            all_items.extend(data)
            min_id = max(n["id"] for n in data) + 1
            logger.info(f"  Irregularities: {len(all_items)} fetched")
        cache_path.write_text(json.dumps(all_items, ensure_ascii=False), encoding="utf-8")

    # Group by debtor IČO
    by_ico: dict[str, dict] = {}
    for item in all_items:
        dlznik = item.get("dlznik", {})
        ico = dlznik.get("ico", "")
        if not ico:
            continue
        if ico not in by_ico:
            by_ico[ico] = {
                "ico": ico,
                "total_irregularity_eur": 0.0,
                "total_to_recover_eur": 0.0,
                "total_returned_eur": 0.0,
                "count": 0,
                "items": [],
            }
        entry = by_ico[ico]
        entry["count"] += 1
        entry["total_irregularity_eur"] += item.get("celkovaSumaNezrovnalosti", 0) or 0
        entry["total_to_recover_eur"] += item.get("sumaNaVymahanie", 0) or 0
        entry["total_returned_eur"] += item.get("vratenaSuma", 0) or 0
        entry["items"].append({
            "kod": item.get("kod", ""),
            "celkovaSumaNezrovnalosti": item.get("celkovaSumaNezrovnalosti", 0),
            "sumaNaVymahanie": item.get("sumaNaVymahanie", 0),
            "vratenaSuma": item.get("vratenaSuma", 0),
            "stav": item.get("stav", ""),
            "dopadNaRozpocetEU": item.get("dopadNaRozpocetEU", ""),
            "datumZistenia": item.get("datumZistenia", ""),
        })

    # Round totals
    for entry in by_ico.values():
        entry["total_irregularity_eur"] = round(entry["total_irregularity_eur"], 2)
        entry["total_to_recover_eur"] = round(entry["total_to_recover_eur"], 2)
        entry["total_returned_eur"] = round(entry["total_returned_eur"], 2)

    output = [by_ico[ico] for ico in sorted(by_ico)]
    out_path = DATA_DIR / "irregularities_by_ico.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"  {len(all_items)} irregularities → {len(output)} debtors, saved to {out_path}")
    return output


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def print_summary(aggregated: list[dict], irregularities: list[dict], elapsed: float):
    total_projects = sum(b["projects_count"] for b in aggregated)
    total_active = sum(b["projects_active"] for b in aggregated)
    total_completed = sum(b["projects_completed"] for b in aggregated)
    total_eur = sum(b["total_contracted_eur"] for b in aggregated)
    total_irreg = sum(e["count"] for e in irregularities)

    top10 = sorted(aggregated, key=lambda x: -x["total_contracted_eur"])[:10]

    mins, secs = divmod(int(elapsed), 60)
    hours, mins = divmod(mins, 60)

    lines = [
        "",
        "=" * 70,
        "ITMS2014+ DATA PIPELINE — SUMMARY",
        "=" * 70,
        f"Total projects fetched:     {total_projects:>8,}",
        f"  In realization:           {total_active:>8,}",
        f"  Completed:                {total_completed:>8,}",
        f"Unique beneficiaries (IČO): {len(aggregated):>8,}",
        f"Total contracted:           €{total_eur:>16,.2f}",
        f"Irregularities:             {total_irreg:>8,} ({len(irregularities)} debtors)",
        f"Elapsed time:               {hours:02d}:{mins:02d}:{secs:02d}",
        "",
        "TOP 10 BENEFICIARIES BY CONTRACTED AMOUNT:",
        "-" * 70,
    ]
    for i, b in enumerate(top10, 1):
        name = b["nazov"] or b["ico"]
        lines.append(
            f"  {i:2d}. {name[:45]:<45s} €{b['total_contracted_eur']:>14,.2f}"
        )
    lines.append("=" * 70)

    summary = "\n".join(lines)
    logger.info(summary)
    print(summary)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    t0 = time.monotonic()
    _init_logging()

    logger.info("ITMS2014+ Data Pipeline starting...")
    logger.info(f"Output directory: {DATA_DIR}")

    # Step 1 — Project lists
    lists = await step1_fetch_lists()

    # Step 2 — Project details
    details = await step2_fetch_details(lists)

    # Step 3 — NUTS names
    nuts_cache = await step3_resolve_nuts(details)

    # Step 4 — Subject details
    subj_cache = await step4_resolve_subjects(details)

    # Step 5 — Aggregate
    aggregated = step5_aggregate(details, nuts_cache, subj_cache)

    # Step 6 — Irregularities
    irregularities = await step6_irregularities()

    elapsed = time.monotonic() - t0
    print_summary(aggregated, irregularities, elapsed)


if __name__ == "__main__":
    asyncio.run(main())
