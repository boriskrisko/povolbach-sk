#!/usr/bin/env python3
"""
fetch_itms21.py — Fetch ITMS21+ (2021-2027) project data and produce municipal_stats_21.json.

Data source: https://api.itms21.sk/public/v1/
Endpoint: /aktivitaprojekt (project activities — need to dedupe by projekt.id)

Each activity record contains:
  - subjekt.ico: beneficiary IČO
  - subjekt.nazov: beneficiary name
  - projekt.id: unique project ID
  - projekt.celkovaZazmluvnenaSuma: contracted EUR
  - projekt.stav: project status string
  - miestoRealizacie[].nazovSk: region name
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

BASE_URL = "https://api.itms21.sk/public/v1"
DATA_DIR = Path("data")
CACHE_DIR = DATA_DIR / "itms21_raw_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = DATA_DIR / "itms21_fetch_log.txt"
AGGREGATED_FILE = DATA_DIR / "aggregated_by_beneficiary_21.json"
STATS_FILE = DATA_DIR / "municipal_stats_21.json"
NOTES_FILE = DATA_DIR / "itms21_notes.txt"
MUNICIPALITIES_FILE = DATA_DIR / "municipalities_isco.json"

PAGE_SIZE_FAST = 200   # for offsets < 55000 (API responds quickly)
PAGE_SIZE_SLOW = 100   # for offsets >= 55000 (API slows down significantly)
SLOW_OFFSET_THRESHOLD = 55000
MAX_RETRIES = 8
RATE_LIMIT = 0.5  # seconds between requests


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, file=sys.stderr)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch_json(url, retries=MAX_RETRIES, timeout=120):
    """Fetch JSON from URL with retry logic."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as e:
            wait = 5 * (attempt + 1)
            log(f"  Attempt {attempt+1}/{retries} failed for {url}: {e} — waiting {wait}s")
            if attempt < retries - 1:
                time.sleep(wait)
            else:
                raise


def step1_fetch_activities():
    """Fetch all project activities using minId-based pagination (fast, no slow offsets)."""
    cache_file = CACHE_DIR / "all_activities.json"
    partial_cache = CACHE_DIR / "activities_partial.json"

    log("Step 1: Fetching project activities from ITMS21+ API")

    # First, get total count
    url = f"{BASE_URL}/aktivitaprojekt?limit=1&offset=0"
    resp = fetch_json(url)
    total = resp["size"]
    log(f"  Total activities available: {total}")

    # Load any existing cached data
    activities = []
    existing_ids = set()

    for src in [cache_file, partial_cache]:
        if src.exists():
            with open(src, encoding="utf-8") as f:
                activities = json.load(f)
            existing_ids = {a["id"] for a in activities}
            log(f"  Loaded {len(activities)} cached activities from {src.name} (IDs: {len(existing_ids)} unique)")
            break

    if len(existing_ids) >= total:
        log(f"  Cache is complete ({len(existing_ids)} >= {total})")
        return activities

    missing = total - len(existing_ids)
    log(f"  Missing ~{missing} activities — fetching with minId pagination (ascending)")

    # Find the ID gap: our cache has high IDs (descending fetch), missing ones are low IDs
    # Use ascending=true + minId to fetch them quickly
    min_cached_id = min(existing_ids) if existing_ids else float("inf")
    page_size = PAGE_SIZE_FAST  # 200 — fast at low offsets with minId

    # Fetch all records with ascending order using minId cursor
    cursor_id = 0  # Start from the beginning
    new_activities = []
    consecutive_failures = 0

    while True:
        url = f"{BASE_URL}/aktivitaprojekt?limit={page_size}&minId={cursor_id}&ascending=true"
        try:
            resp = fetch_json(url, timeout=60)
            consecutive_failures = 0
        except Exception as e:
            consecutive_failures += 1
            log(f"  FAILED at minId={cursor_id} (failure {consecutive_failures}/5): {e}")
            if consecutive_failures >= 5:
                # Save what we have and raise
                activities.extend(new_activities)
                with open(partial_cache, "w", encoding="utf-8") as f:
                    json.dump(activities, f, ensure_ascii=False)
                log(f"  Saved {len(activities)} activities to partial cache")
                raise
            time.sleep(5 * consecutive_failures)
            continue

        batch = resp.get("results", [])
        if not batch:
            break

        # Only keep records we don't already have
        for rec in batch:
            if rec["id"] not in existing_ids:
                new_activities.append(rec)
                existing_ids.add(rec["id"])

        cursor_id = batch[-1]["id"] + 1  # Next page starts after last ID

        if len(new_activities) % 2000 < page_size:
            log(f"  Fetched {len(new_activities)} new + {len(activities)} cached = {len(existing_ids)}/{total} ({100*len(existing_ids)/total:.1f}%)")

        # Stop if we've reached our cached range (all missing records found)
        if cursor_id >= min_cached_id and min_cached_id < float("inf"):
            log(f"  Reached cached ID range at {cursor_id} — done fetching new records")
            break

        time.sleep(RATE_LIMIT)

    activities.extend(new_activities)
    log(f"  Total after merge: {len(activities)} activities ({len(existing_ids)} unique IDs)")

    # Save complete cache
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(activities, f, ensure_ascii=False)
    log(f"  Saved to complete cache")

    # Clean up partial cache
    if partial_cache.exists():
        partial_cache.unlink()

    return activities


def step2_dedupe_and_aggregate(activities):
    """Deduplicate by project ID, then aggregate by IČO."""
    log("Step 2: Deduplicating by project ID and aggregating by IČO")

    # First pass: unique projects by projekt.id
    projects = {}
    for act in activities:
        proj = act.get("projekt", {})
        pid = proj.get("id")
        if pid is None:
            continue
        if pid in projects:
            continue  # Already seen this project

        ico = act.get("subjekt", {}).get("ico")
        if not ico:
            continue

        # Normalize IČO to 8-digit zero-padded
        ico = str(ico).strip().zfill(8)

        stav = proj.get("stav", "")
        contracted = proj.get("celkovaZazmluvnenaSuma", 0) or 0

        # Determine if active or completed
        is_completed = "ukončen" in stav.lower() if stav else False
        is_active = not is_completed and contracted > 0

        miesta = act.get("miestoRealizacie", [])
        region = miesta[0].get("nazovSk", "") if miesta else ""

        projects[pid] = {
            "project_id": pid,
            "ico": ico,
            "beneficiary_name": act.get("subjekt", {}).get("nazov", ""),
            "project_name": proj.get("nazov", ""),
            "project_code": proj.get("kod", ""),
            "contracted_eur": contracted,
            "status": stav,
            "is_active": is_active,
            "is_completed": is_completed,
            "region": region,
        }

    log(f"  Unique projects: {len(projects)}")

    # Second pass: aggregate by IČO
    by_ico = {}
    for p in projects.values():
        ico = p["ico"]
        if ico not in by_ico:
            by_ico[ico] = {
                "ico": ico,
                "nazov": p["beneficiary_name"],
                "active_projects": 0,
                "completed_projects": 0,
                "total_contracted_eur": 0,
                "projects": [],
            }

        entry = by_ico[ico]
        if p["is_active"]:
            entry["active_projects"] += 1
        if p["is_completed"]:
            entry["completed_projects"] += 1
        entry["total_contracted_eur"] += p["contracted_eur"]
        entry["projects"].append({
            "nazov": p["project_name"],
            "sumaZazmluvnena": p["contracted_eur"],
            "stav": p["status"],
        })

    log(f"  Unique beneficiaries (IČOs): {len(by_ico)}")

    total_eur = sum(e["total_contracted_eur"] for e in by_ico.values())
    log(f"  Total contracted EUR: €{total_eur:,.0f}")

    # Save aggregated
    with open(AGGREGATED_FILE, "w", encoding="utf-8") as f:
        json.dump(by_ico, f, ensure_ascii=False, indent=2)
    log(f"  Saved aggregated data to {AGGREGATED_FILE}")

    return by_ico


def step3_match_municipalities(by_ico):
    """Match against municipality IČO register to produce municipal_stats_21.json."""
    log("Step 3: Matching against municipality register")

    if not MUNICIPALITIES_FILE.exists():
        log(f"  ERROR: {MUNICIPALITIES_FILE} not found!")
        return

    with open(MUNICIPALITIES_FILE, encoding="utf-8") as f:
        municipalities = json.load(f)

    log(f"  Municipality register: {len(municipalities)} entries")

    stats = {}
    matched = 0
    zero_count = 0

    for ico, muni in municipalities.items():
        entry = {
            "ico": ico,
            "official_name": muni.get("official_name", ""),
            "nuts5_code": muni.get("nuts5_code", ""),
            "region": muni.get("region", ""),
            "district": muni.get("district", ""),
            "population": muni.get("population", 0),
            "type": muni.get("type", ""),
            "active_projects": 0,
            "completed_projects": 0,
            "total_contracted_eur": 0,
            "total_contracted_amended_eur": 0,
            "projects": [],
            "gps_lat": None,
            "gps_lon": None,
            "irregularities_count": 0,
            "irregularities_total_eur": 0,
        }

        if ico in by_ico:
            agg = by_ico[ico]
            entry["active_projects"] = agg["active_projects"]
            entry["completed_projects"] = agg["completed_projects"]
            entry["total_contracted_eur"] = agg["total_contracted_eur"]
            entry["total_contracted_amended_eur"] = agg["total_contracted_eur"]
            # Keep top 5 projects by amount
            sorted_projects = sorted(
                agg["projects"],
                key=lambda p: p.get("sumaZazmluvnena", 0),
                reverse=True
            )[:5]
            entry["projects"] = sorted_projects
            matched += 1
        else:
            zero_count += 1

        stats[ico] = entry

    total_eur = sum(e["total_contracted_eur"] for e in stats.values())
    log(f"  Matched municipalities: {matched}")
    log(f"  Zero-project municipalities: {zero_count}")
    log(f"  Total municipal EUR: €{total_eur:,.0f}")

    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    log(f"  Saved to {STATS_FILE}")

    # Write notes
    with open(NOTES_FILE, "w", encoding="utf-8") as f:
        f.write("ITMS21+ (2021-2027) Data Notes\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Source: {BASE_URL}/aktivitaprojekt\n")
        f.write(f"Fetched: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        f.write("Schema differences from ITMS2014+:\n")
        f.write("- Endpoint: /aktivitaprojekt (not /projektoveUkoncene + /projektoveVrealizacii)\n")
        f.write("- Multiple activities per project — deduplicated by projekt.id\n")
        f.write("- Financial field: projekt.celkovaZazmluvnenaSuma (not per-project sumaZazmluvnena)\n")
        f.write("- Many projects are in preparation (stav='Projekt v príprave') with €0\n")
        f.write("- No separate irregularities endpoint currently used\n\n")
        f.write(f"Results:\n")
        f.write(f"- Total activities fetched: (see log)\n")
        f.write(f"- Unique projects: (see log)\n")
        f.write(f"- Unique beneficiaries: {len(by_ico)}\n")
        f.write(f"- Municipalities matched: {matched}\n")
        f.write(f"- Municipalities with €0: {zero_count}\n")
        f.write(f"- Total municipal contracted EUR: €{total_eur:,.0f}\n")


def main():
    log("=" * 60)
    log("fetch_itms21.py — Starting")
    log("=" * 60)

    activities = step1_fetch_activities()
    by_ico = step2_dedupe_and_aggregate(activities)
    step3_match_municipalities(by_ico)

    log("=" * 60)
    log("fetch_itms21.py — Complete")
    log("=" * 60)


if __name__ == "__main__":
    main()
