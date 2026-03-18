#!/usr/bin/env python3
"""
Filter aggregated_by_beneficiary.json to Slovak municipalities only.
Matches: Obec, Mesto, Mestská časť (+ Bratislava mestská časť variants).
Outputs municipalities_only.json + prints summary with top/bottom 20 and Košice detail.
"""

import json
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent
INPUT = DATA_DIR / "aggregated_by_beneficiary.json"
OUTPUT = DATA_DIR / "municipalities_only.json"

# ---------------------------------------------------------------------------
# Municipality detection
# ---------------------------------------------------------------------------
MUNICIPALITY_PREFIXES = (
    "Obec ",
    "obec ",
    "Mesto ",
    "mesto ",
    "Mestská časť ",
    "mestská časť ",
    "Mestská cast ",   # possible missing diacritics
)

# Regex for "Bratislava - mestská časť …" pattern (subject names from ITMS)
BRATISLAVA_MC_RE = re.compile(r"Bratislava\s*-\s*mestská\s+časť", re.IGNORECASE)

# Known municipality IČOs that don't match prefix patterns
# Bratislava's official name is "Hlavné mesto Slovenskej republiky Bratislava"
KNOWN_MUNICIPALITY_ICOS = {
    "00603481",  # Hlavné mesto SR Bratislava
}

# Additional name patterns for municipalities with non-standard naming
MUNICIPALITY_PATTERNS = [
    re.compile(r"^Hlavné\s+mesto", re.IGNORECASE),  # Bratislava
]


def is_municipality(entry: dict) -> bool:
    name = entry.get("nazov", "")
    ico = entry.get("ico", "")
    if not name:
        return False
    if ico in KNOWN_MUNICIPALITY_ICOS:
        return True
    # Case-insensitive prefix check
    name_lower = name.lower()
    if any(name_lower.startswith(p.lower()) for p in MUNICIPALITY_PREFIXES):
        return True
    # Also catch "Mestská časť-" (no space after časť, e.g. "Mestská časť-Košická Nová Ves")
    if re.match(r"^mestská\s+čas[tť][\s-]", name_lower):
        return True
    if BRATISLAVA_MC_RE.search(name):
        return True
    for pat in MUNICIPALITY_PATTERNS:
        if pat.search(name):
            return True
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(INPUT, encoding="utf-8") as f:
        data = json.load(f)

    municipalities = [e for e in data if is_municipality(e)]
    municipalities.sort(key=lambda e: e["total_contracted_eur"], reverse=True)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(municipalities, f, ensure_ascii=False, indent=2)

    # ---- Summary ----
    total_count = len(municipalities)
    total_eur = sum(e["total_contracted_eur"] for e in municipalities)
    total_projects = sum(e["projects_count"] for e in municipalities)
    total_active = sum(e["projects_active"] for e in municipalities)
    total_completed = sum(e["projects_completed"] for e in municipalities)

    sep = "=" * 80
    print(sep)
    print("MUNICIPALITIES FILTER — SUMMARY")
    print(sep)
    print(f"  Total municipalities found:   {total_count:,}")
    print(f"  Total projects:               {total_projects:,}")
    print(f"    Active:                      {total_active:,}")
    print(f"    Completed:                   {total_completed:,}")
    print(f"  Total contracted:             €{total_eur:,.2f}")
    print(f"  Output file:                  {OUTPUT}")
    print()

    # Top 20
    print("-" * 80)
    print("TOP 20 MUNICIPALITIES BY CONTRACTED AMOUNT")
    print("-" * 80)
    for i, e in enumerate(municipalities[:20], 1):
        print(f"  {i:>3}. {e['nazov']:<50s} €{e['total_contracted_eur']:>18,.2f}  ({e['projects_count']} projects)")

    # Bottom 20
    print()
    print("-" * 80)
    print("BOTTOM 20 MUNICIPALITIES BY CONTRACTED AMOUNT")
    print("-" * 80)
    bottom = municipalities[-20:]
    bottom_start = total_count - 19
    for i, e in enumerate(bottom, bottom_start):
        print(f"  {i:>3}. {e['nazov']:<50s} €{e['total_contracted_eur']:>18,.2f}  ({e['projects_count']} projects)")

    # Košice detail
    kosice_entries = [e for e in municipalities if "košice" in e.get("nazov", "").lower()]
    kosice_entries.sort(key=lambda e: e["total_contracted_eur"], reverse=True)

    print()
    print(sep)
    print(f"ALL KOŠICE ENTRIES ({len(kosice_entries)} found)")
    print(sep)
    kosice_total = 0
    kosice_projects = 0
    for e in kosice_entries:
        kosice_total += e["total_contracted_eur"]
        kosice_projects += e["projects_count"]
        print(f"  IČO {e['ico']}  {e['nazov']:<50s} €{e['total_contracted_eur']:>18,.2f}  ({e['projects_count']} projects)")
        # List individual projects
        for p in sorted(e.get("projects", []), key=lambda x: x.get("sumaZazmluvnena", 0), reverse=True):
            amt = p.get("sumaZazmluvnena", 0)
            print(f"        └─ {p.get('kod','?'):<14s} {p.get('nazov','')[:60]:<60s} €{amt:>14,.2f}")
        print()
    print(f"  KOŠICE TOTAL: €{kosice_total:,.2f} across {kosice_projects} projects")
    print(sep)


if __name__ == "__main__":
    main()
