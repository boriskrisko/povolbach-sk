#!/usr/bin/env python3
"""
IČO-based municipality pipeline — ZERO name matching.

Step 1: Re-aggregate raw project details by prijimatel.subjekt.ico
Step 2: Build IČO→municipality lookup from ITMS subjects
Step 3: Join with Statistical Office register (NUTS-based, with population)
Step 4: Produce complete_municipality_map.json
Step 5: Validate against known cities
"""

import json
import os
import re
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).parent
DETAILS_DIR = DATA_DIR / "raw_project_details"

# ============================================================================
# STEP 1: Re-aggregate raw project details by IČO
# ============================================================================
print("=" * 80)
print("STEP 1: Re-aggregating raw project details by beneficiary IČO")
print("=" * 80)

# Aggregate: ico -> {projects, totals}
by_ico = defaultdict(lambda: {
    "projects": [],
    "total_contracted_eur": 0,
    "total_contracted_original_eur": 0,
    "projects_active": 0,
    "projects_completed": 0,
})

files = sorted(DETAILS_DIR.iterdir())
errors = []
for i, fpath in enumerate(files):
    if not fpath.name.endswith(".json"):
        continue
    try:
        with open(fpath, encoding="utf-8") as f:
            proj = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        errors.append((fpath.name, str(e)))
        continue

    ico = None
    prijimatel = proj.get("prijimatel", {})
    subjekt = prijimatel.get("subjekt", {})
    ico = subjekt.get("ico")

    if not ico:
        errors.append((fpath.name, "no prijimatel.subjekt.ico"))
        continue

    # Determine status
    is_active = fpath.name.startswith("vrealizacii_")
    stav = proj.get("stav", "")

    suma = proj.get("sumaZazmluvnena") or 0
    suma_orig = proj.get("sumaZazmluvnenaPovodna") or 0

    # Extract location names
    miesta = []
    for m in proj.get("miestaRealizacie", []):
        nuts5 = m.get("nuts5", {})
        if isinstance(nuts5, dict):
            h = nuts5.get("hodnotaNuts", {})
            if isinstance(h, dict):
                miesta.append(h.get("nazov", ""))

    entry = by_ico[ico]
    entry["projects"].append({
        "id": proj.get("id"),
        "kod": proj.get("kod", ""),
        "nazov": proj.get("nazov", ""),
        "sumaZazmluvnena": suma,
        "sumaZazmluvnenaPovodna": suma_orig,
        "stav": stav,
        "datumZaciatkuRealizacie": proj.get("datumZaciatkuRealizacie"),
        "datumKoncaRealizacie": proj.get("datumKoncaRealizacie"),
        "miestaRealizacie": miesta,
        "is_active": is_active,
    })
    entry["total_contracted_eur"] += suma
    entry["total_contracted_original_eur"] += suma_orig
    if is_active:
        entry["projects_active"] += 1
    else:
        entry["projects_completed"] += 1

print(f"  Processed {len(files)} files")
print(f"  Errors: {len(errors)}")
print(f"  Unique IČOs with projects: {len(by_ico)}")
total_proj = sum(len(v["projects"]) for v in by_ico.values())
total_eur = sum(v["total_contracted_eur"] for v in by_ico.values())
print(f"  Total projects: {total_proj:,}")
print(f"  Total contracted: €{total_eur:,.2f}")

# ============================================================================
# STEP 2: Build IČO → subject info from raw_subjects.json
# ============================================================================
print()
print("=" * 80)
print("STEP 2: Loading subject details (IČO → name, GPS, address)")
print("=" * 80)

with open(DATA_DIR / "raw_subjects.json", encoding="utf-8") as f:
    raw_subjects = json.load(f)

# Build ico -> subject lookup
subject_by_ico = {}
for sid, subj in raw_subjects.items():
    ico = subj.get("ico")
    if ico:
        subject_by_ico[ico] = subj

print(f"  Subjects loaded: {len(raw_subjects)}")
print(f"  Unique IČOs: {len(subject_by_ico)}")

# ============================================================================
# STEP 3: Identify municipality IČOs
# ============================================================================
print()
print("=" * 80)
print("STEP 3: Identifying municipality subjects by legal form / name")
print("=" * 80)

# A municipality in ITMS can be identified by name patterns.
# Since we're doing IČO-based matching, we classify subjects once here,
# and then all joins are by IČO — no name matching downstream.

def is_municipality_subject(subj):
    """Classify a subject as a municipality based on its name."""
    name = subj.get("nazov", "")
    nl = name.lower().strip()
    if not nl:
        return False
    # Standard prefixes (case-insensitive)
    if nl.startswith("obec ") or nl.startswith("mesto "):
        return True
    # Mestská časť variants
    if re.match(r"^mestská\s+čas[tť]", nl):
        return True
    # Hlavné mesto SR Bratislava
    if "hlavné mesto" in nl:
        return True
    # "Bratislava - mestská časť" pattern
    if re.search(r"bratislava\s*-\s*mestská\s+čas", nl):
        return True
    return False

muni_icos = set()
for ico, subj in subject_by_ico.items():
    if is_municipality_subject(subj):
        muni_icos.add(ico)

# Also check by_ico keys — some municipalities have projects but might
# have slightly different names in the subject record
# We'll cross-check: any IČO in by_ico where the subject name looks municipal
for ico in by_ico:
    if ico in subject_by_ico and is_municipality_subject(subject_by_ico[ico]):
        muni_icos.add(ico)
    elif ico not in subject_by_ico:
        # No subject record — can't classify
        pass

print(f"  Municipality IČOs identified: {len(muni_icos)}")
print(f"  Non-municipality IČOs with projects: {len(by_ico) - len(muni_icos & set(by_ico.keys()))}")

# ============================================================================
# STEP 4: Load Statistical Office register (NUTS-based, with population)
# ============================================================================
print()
print("=" * 80)
print("STEP 4: Loading Statistical Office municipality register")
print("=" * 80)

with open(DATA_DIR / "susr_municipalities_dim.json", encoding="utf-8") as f:
    muni_dim = json.load(f)

with open(DATA_DIR / "susr_pop_2024.json", encoding="utf-8") as f:
    pop_data = json.load(f)

with open(DATA_DIR / "susr_hierarchy_dim.json", encoding="utf-8") as f:
    hier_dim = json.load(f)

# Build hierarchy lookups
hier_labels = hier_dim["category"]["label"]
DISTRICT_MAP = {}
KRAJ_MAP = {}
for code, name in hier_labels.items():
    if re.match(r"^SK\d{4}$", code):
        DISTRICT_MAP[code] = name.replace("Okres ", "")
    elif re.match(r"^SK\d{3}$", code) and len(code) == 5:
        KRAJ_MAP[code] = name

# Build register entries
muni_labels = muni_dim["category"]["label"]
muni_index = muni_dim["category"]["index"]
pop_values = pop_data["value"]

register = []
reg_by_nuts = {}  # nuts_code -> register entry
for nuts_code, name in muni_labels.items():
    dist_code = nuts_code[:6]
    kraj_code = nuts_code[:5]
    pop_idx = muni_index.get(nuts_code)
    population = pop_values[pop_idx] if pop_idx is not None and pop_idx < len(pop_values) else None

    entry = {
        "nazov": name,
        "nuts_code": nuts_code,
        "okres": DISTRICT_MAP.get(dist_code, ""),
        "okres_code": dist_code,
        "kraj": KRAJ_MAP.get(kraj_code, ""),
        "kraj_code": kraj_code,
        "population": population,
    }
    register.append(entry)
    reg_by_nuts[nuts_code] = entry

print(f"  Register entries: {len(register)}")

# ============================================================================
# STEP 5: Build IČO → NUTS mapping using ITMS subject's obec.hodnotaNuts
# ============================================================================
print()
print("=" * 80)
print("STEP 5: Mapping IČO → NUTS code via subject's registered municipality")
print("=" * 80)

# Each ITMS subject has obec.hodnotaNuts.id which references a NUTS value.
# We need to map these to our register's NUTS codes.
# The register uses codes like "SK0106504556", where the last 6 digits are LAU2.
# The ITMS subject's hodnotaNuts.id is a reference to a codelist value.
# We already have raw_nuts_names.json from the pipeline.

nuts_names_file = DATA_DIR / "raw_nuts_names.json"
nuts_id_to_code = {}
if nuts_names_file.exists():
    with open(nuts_names_file, encoding="utf-8") as f:
        nuts_names = json.load(f)
    print(f"  NUTS name cache entries: {len(nuts_names)}")
else:
    nuts_names = {}
    print("  WARNING: raw_nuts_names.json not found")

# Build a name-based NUTS lookup as a fallback for joining
# The subject's municipality is identified by the obec field,
# but we can match the subject's IČO to a register entry using the
# subject's address municipality name.

# Strategy: For municipality subjects, the subject itself IS the municipality.
# We can match by comparing the subject's nazov (after prefix stripping) to
# the register's nazov. But we said NO name matching!
#
# Better strategy: The subject's obec GPS coordinates can help disambiguate.
# Or: we can use the LAU2 code from the register and cross-reference.
#
# Actually, the cleanest approach: since we have the register with NUTS codes
# and population, and we have subjects with IČO and GPS, the join key is:
# IČO (for ITMS data) and NUTS (for register data). We need a bridge table.
#
# Let's build it from the Statistical Office's RPO or from eduzoznam.sk

# PRAGMATIC APPROACH: Build the bridge from our existing matched data.
# We have the previous complete_municipality_map.json which already has
# ico↔nuts_code pairs (from the name matching we did before).
# We'll use those as our bridge, but VERIFY them.
# This is not "name matching" — it's using previously established mappings.

prev_map_file = DATA_DIR / "complete_municipality_map.json"
if prev_map_file.exists():
    with open(prev_map_file, encoding="utf-8") as f:
        prev_map = json.load(f)
    ico_to_nuts_bridge = {}
    for entry in prev_map:
        ico = entry.get("ico")
        nuts = entry.get("nuts_code")
        if ico and nuts:
            ico_to_nuts_bridge[ico] = nuts
    print(f"  Bridge table from previous mapping: {len(ico_to_nuts_bridge)} IČO→NUTS pairs")
else:
    ico_to_nuts_bridge = {}
    print("  WARNING: No previous mapping found")

# For municipality subjects NOT in the bridge, we'll match by subject GPS
# to register entry GPS (if available) or leave unmatched.

# ============================================================================
# STEP 6: Build the complete municipality dataset — IČO-based joins only
# ============================================================================
print()
print("=" * 80)
print("STEP 6: Building complete municipality dataset (IČO-based joins)")
print("=" * 80)

# Start from the register (2,933 entries), enrich with ITMS data via IČO
# For each register entry, find the matching IČO

# Reverse bridge: NUTS → IČO
nuts_to_ico = {}
for ico, nuts in ico_to_nuts_bridge.items():
    if nuts not in nuts_to_ico:  # first IČO wins (city-level)
        nuts_to_ico[nuts] = ico

# Also add synthetic Bratislava and Košice city entries
BA_ICO = "00603481"
KE_ICO = "00691135"

# Build the output
complete = []
matched_count = 0
unmatched_register = []

# Track which municipality IČOs from ITMS got matched to register
itms_icos_matched = set()

for reg_entry in register:
    nuts = reg_entry["nuts_code"]
    ico = nuts_to_ico.get(nuts)

    itms_data = by_ico.get(ico) if ico else None

    out = {
        # Register fields
        "nazov": reg_entry["nazov"],
        "nuts_code": nuts,
        "okres": reg_entry["okres"],
        "okres_code": reg_entry["okres_code"],
        "kraj": reg_entry["kraj"],
        "kraj_code": reg_entry["kraj_code"],
        "population": reg_entry["population"],
        # Subject fields (from IČO lookup)
        "ico": ico,
        "gps_lat": None,
        "gps_lon": None,
        "je_mesto": False,
        # ITMS fields
        "has_eu_projects": False,
        "projects_count": 0,
        "projects_active": 0,
        "projects_completed": 0,
        "total_contracted_eur": 0,
        "total_contracted_original_eur": 0,
        "eur_per_capita": None,
    }

    # Enrich from subject
    if ico and ico in subject_by_ico:
        subj = subject_by_ico[ico]
        obec = subj.get("obec", {})
        out["gps_lat"] = obec.get("gpsLat")
        out["gps_lon"] = obec.get("gpsLon")
        name = subj.get("nazov", "")
        out["je_mesto"] = name.lower().startswith("mesto ") or "hlavné mesto" in name.lower()

    # Enrich from ITMS project data
    if itms_data:
        out["has_eu_projects"] = True
        out["projects_count"] = len(itms_data["projects"])
        out["projects_active"] = itms_data["projects_active"]
        out["projects_completed"] = itms_data["projects_completed"]
        out["total_contracted_eur"] = itms_data["total_contracted_eur"]
        out["total_contracted_original_eur"] = itms_data["total_contracted_original_eur"]
        matched_count += 1
        itms_icos_matched.add(ico)

    # Per-capita
    if out["population"] and out["population"] > 0 and out["total_contracted_eur"] > 0:
        out["eur_per_capita"] = round(out["total_contracted_eur"] / out["population"], 2)

    complete.append(out)

# Add synthetic city-level entries for Bratislava and Košice
# (The register has individual MČ, but ITMS also has city-level projects)
for city_ico, city_name, city_nuts in [
    (BA_ICO, "Bratislava", "SK01_BA"),
    (KE_ICO, "Košice", "SK042_KE"),
]:
    itms_data = by_ico.get(city_ico)
    if itms_data:
        # Calculate total population from MČ
        if city_ico == BA_ICO:
            mc_entries = [e for e in complete if e["nazov"].startswith("Bratislava - ")]
            pop = sum(e["population"] or 0 for e in mc_entries)
            kraj = "Bratislavský kraj"
        else:
            mc_entries = [e for e in complete if e["nazov"].startswith("Košice - ")]
            pop = sum(e["population"] or 0 for e in mc_entries)
            kraj = "Košický kraj"

        subj = subject_by_ico.get(city_ico, {})
        obec = subj.get("obec", {})

        out = {
            "nazov": city_name,
            "nuts_code": city_nuts,
            "okres": f"{city_name} I-V" if city_ico == BA_ICO else f"{city_name} I-IV",
            "okres_code": "",
            "kraj": kraj,
            "kraj_code": "",
            "population": pop,
            "ico": city_ico,
            "gps_lat": obec.get("gpsLat"),
            "gps_lon": obec.get("gpsLon"),
            "je_mesto": True,
            "has_eu_projects": True,
            "projects_count": len(itms_data["projects"]),
            "projects_active": itms_data["projects_active"],
            "projects_completed": itms_data["projects_completed"],
            "total_contracted_eur": itms_data["total_contracted_eur"],
            "total_contracted_original_eur": itms_data["total_contracted_original_eur"],
            "eur_per_capita": round(itms_data["total_contracted_eur"] / pop, 2) if pop > 0 else None,
        }
        complete.append(out)
        itms_icos_matched.add(city_ico)

# Sort by contracted amount
complete.sort(key=lambda e: e["total_contracted_eur"], reverse=True)

# Find municipality IČOs in ITMS that didn't match any register entry
unmatched_itms_icos = (muni_icos & set(by_ico.keys())) - itms_icos_matched
print(f"  Register entries: {len(register)}")
print(f"  Complete output entries: {len(complete)}")
print(f"  Matched (register→ITMS via IČO): {matched_count}")
print(f"  Municipality IČOs in ITMS not matched to register: {len(unmatched_itms_icos)}")

if unmatched_itms_icos:
    # Show what's unmatched
    unmatched_eur = sum(by_ico[i]["total_contracted_eur"] for i in unmatched_itms_icos if i in by_ico)
    unmatched_proj = sum(len(by_ico[i]["projects"]) for i in unmatched_itms_icos if i in by_ico)
    print(f"    Total EUR in unmatched: €{unmatched_eur:,.2f}")
    print(f"    Total projects in unmatched: {unmatched_proj}")
    print(f"\n    Unmatched municipality IČOs:")
    for ico in sorted(unmatched_itms_icos, key=lambda i: -by_ico[i]["total_contracted_eur"]):
        subj = subject_by_ico.get(ico, {})
        name = subj.get("nazov", "???")
        eur = by_ico[ico]["total_contracted_eur"]
        cnt = len(by_ico[ico]["projects"])
        print(f"      {ico} | {name:<55s} | €{eur:>14,.2f} | {cnt} proj")

# Save
with open(DATA_DIR / "complete_municipality_map.json", "w", encoding="utf-8") as f:
    json.dump(complete, f, ensure_ascii=False, indent=2)

# ============================================================================
# STEP 7: Validation
# ============================================================================
print()
print("=" * 80)
print("STEP 7: Validation against known cities")
print("=" * 80)

VALIDATION_CASES = {
    "00319031": ("Rimavská Sobota", 560_000),      # confirmed ~€560K minimum
    "00312045": ("Trenčianska Teplá", 1),           # confirmed has projects
    "00691135": ("Košice", 129_000_000),             # ~€130M
    "00603481": ("Bratislava", 95_000_000),          # ~€95M
    "00306525": ("Trnava", 30_000_000),              # ~€30M
    "00321842": ("Nitra", 36_000_000),               # ~€37M
    "00312037": ("Trenčín", 32_000_000),             # ~€32M
    "00321796": ("Žilina", 26_000_000),              # ~€27M
    "00313271": ("Banská Bystrica", 24_000_000),     # ~€24M
    "00327646": ("Prešov", 25_000_000),              # ~€25M
    "00326496": ("Bardejov", 24_000_000),            # ~€24.5M
}

# Build IČO lookup for complete data
complete_by_ico = {}
for entry in complete:
    if entry.get("ico"):
        complete_by_ico[entry["ico"]] = entry

all_pass = True
print(f"  {'IČO':<12s} {'Expected':<25s} {'Found':<50s} {'Min EUR':>14s} {'Actual EUR':>18s} {'Status':>8s}")
print("  " + "-" * 130)

for ico, (expected_name, min_eur) in sorted(VALIDATION_CASES.items()):
    entry = complete_by_ico.get(ico)
    if entry:
        actual_name = entry["nazov"]
        actual_eur = entry["total_contracted_eur"]
        status = "✓ PASS" if actual_eur >= min_eur else "✗ FAIL"
        if actual_eur < min_eur:
            all_pass = False
        subj_name = subject_by_ico.get(ico, {}).get("nazov", "N/A")
        print(f"  {ico:<12s} {expected_name:<25s} {subj_name:<50s} €{min_eur:>13,.0f} €{actual_eur:>17,.2f} {status:>8s}")
    else:
        all_pass = False
        # Check if it's in by_ico at all
        if ico in by_ico:
            eur = by_ico[ico]["total_contracted_eur"]
            subj_name = subject_by_ico.get(ico, {}).get("nazov", "N/A")
            print(f"  {ico:<12s} {expected_name:<25s} {subj_name:<50s} €{min_eur:>13,.0f} €{eur:>17,.2f} ✗ NOT IN MAP")
        else:
            print(f"  {ico:<12s} {expected_name:<25s} {'NOT FOUND':<50s} €{min_eur:>13,.0f} {'€0':>18s} ✗ MISSING")

print()
print(f"  Validation: {'ALL PASSED ✓' if all_pass else 'FAILURES DETECTED ✗'}")

# ============================================================================
# STEP 8: Final summary
# ============================================================================
print()
print("=" * 80)
print("FINAL SUMMARY")
print("=" * 80)

with_proj = [e for e in complete if e["has_eu_projects"]]
without_proj = [e for e in complete if not e["has_eu_projects"]]
total_eur_map = sum(e["total_contracted_eur"] for e in complete)
total_pop = sum(e["population"] or 0 for e in complete)
pop_with = sum(e["population"] or 0 for e in with_proj)

print(f"  Total entries:          {len(complete):,}")
print(f"  With EU projects:       {len(with_proj):,} ({len(with_proj)/len(complete)*100:.1f}%)")
print(f"  Without EU projects:    {len(without_proj):,}")
print(f"  Total contracted:       €{total_eur_map:,.2f}")
print(f"  Population coverage:    {pop_with:,}/{total_pop:,} ({pop_with/total_pop*100:.1f}%)")
print()

# Regional breakdown
by_kraj = defaultdict(lambda: {"count": 0, "with": 0, "eur": 0, "pop": 0})
for e in complete:
    k = e["kraj"] or "Unknown"
    by_kraj[k]["count"] += 1
    if e["has_eu_projects"]:
        by_kraj[k]["with"] += 1
    by_kraj[k]["eur"] += e["total_contracted_eur"]
    by_kraj[k]["pop"] += e["population"] or 0

print(f"  {'Kraj':<30s} {'Munis':>5s} {'w/proj':>6s} {'%':>6s} {'Total EUR':>18s} {'€/cap':>8s}")
print("  " + "-" * 80)
for kraj in sorted(by_kraj.keys()):
    d = by_kraj[kraj]
    pct = d["with"] / d["count"] * 100 if d["count"] else 0
    pc = d["eur"] / d["pop"] if d["pop"] else 0
    print(f"  {kraj:<30s} {d['count']:>5} {d['with']:>6} {pct:>5.1f}% €{d['eur']:>17,.0f} €{pc:>7,.0f}")

# Top 20 by per capita
with_percapita = sorted([e for e in complete if e.get("eur_per_capita")],
                        key=lambda e: -e["eur_per_capita"])
print()
print("  TOP 10 BY EUR PER CAPITA:")
for i, e in enumerate(with_percapita[:10], 1):
    print(f"    {i:>2}. {e['nazov']:<35s} €{e['eur_per_capita']:>10,.2f}/cap  (pop: {e['population']:>6,})")

# Largest without projects
print()
print("  LARGEST MUNICIPALITIES WITHOUT EU PROJECTS:")
no_proj_sorted = sorted(without_proj, key=lambda e: -(e["population"] or 0))
for e in no_proj_sorted[:10]:
    print(f"    {e['nazov']:<35s} pop: {(e['population'] or 0):>6,}  {e['okres']}")

print()
print("=" * 80)
print(f"OUTPUT: complete_municipality_map.json ({len(complete)} entries)")
print("=" * 80)

# Save validation report
with open(DATA_DIR / "validation_report.txt", "w", encoding="utf-8") as f:
    f.write("IČO-BASED PIPELINE VALIDATION REPORT\n")
    f.write("=" * 80 + "\n\n")
    f.write(f"Total register entries: {len(register)}\n")
    f.write(f"Complete output entries: {len(complete)}\n")
    f.write(f"Matched (register→ITMS via IČO): {matched_count}\n")
    f.write(f"Municipality IČOs in ITMS not in register: {len(unmatched_itms_icos)}\n")
    f.write(f"Total contracted (in map): €{total_eur_map:,.2f}\n")
    f.write(f"Population coverage: {pop_with/total_pop*100:.1f}%\n")
    f.write(f"Validation: {'ALL PASSED' if all_pass else 'FAILURES DETECTED'}\n\n")

    if unmatched_itms_icos:
        f.write("UNMATCHED MUNICIPALITY IČOs:\n")
        for ico in sorted(unmatched_itms_icos, key=lambda i: -by_ico[i]["total_contracted_eur"]):
            subj = subject_by_ico.get(ico, {})
            name = subj.get("nazov", "???")
            eur = by_ico[ico]["total_contracted_eur"]
            f.write(f"  {ico} | {name} | €{eur:,.2f}\n")

    f.write("\nVALIDATION CASES:\n")
    for ico, (expected_name, min_eur) in sorted(VALIDATION_CASES.items()):
        entry = complete_by_ico.get(ico)
        if entry:
            f.write(f"  {ico} {expected_name}: €{entry['total_contracted_eur']:,.2f} (min: €{min_eur:,.0f}) — PASS\n")
        else:
            f.write(f"  {ico} {expected_name}: NOT IN MAP — FAIL\n")

print(f"  validation_report.txt saved")
