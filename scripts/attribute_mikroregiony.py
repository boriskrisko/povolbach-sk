#!/usr/bin/env python3
"""
attribute_mikroregiony.py
Attribute mikroregión funding to member municipalities via RPO founder data.
Split proportionally by population. IČO-only joins — no name matching.
Includes individual project details with attributed amounts.
"""

import json
from pathlib import Path

ROOT = Path('/Users/boriskrisko/povolbach')
DATA = ROOT / 'data'
PUBLIC = ROOT / 'frontend' / 'public'


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def attribute_period(suffix: str):
    print(f'\n=== Period {suffix} ===')

    mikro = load_json(PUBLIC / f'mikroregiony_stats_{suffix}.json')
    rpo = load_json(DATA / 'rpo_founders.json')
    muni_stats = load_json(DATA / f'municipal_stats_{suffix}.json')

    # Load subsidiary data to deduplicate — skip mikro attribution if already a subsidiary
    subs_path = DATA / f'subsidiaries_by_municipality_{suffix}.json'
    subs = load_json(subs_path) if subs_path.exists() else {}

    # Build: for each municipality, set of subsidiary org names (uppercase for matching)
    muni_sub_names: dict[str, set[str]] = {}
    for muni_ico, sub_data in subs.items():
        names = set()
        for org in sub_data.get('subsidiary_orgs', []):
            n = org.get('name', '').upper().strip()
            if n:
                names.add(n)
        if names:
            muni_sub_names[muni_ico] = names

    # Load aggregated data for full project details
    agg_path = DATA / f'aggregated_by_beneficiary_{suffix}.json'
    agg_raw = load_json(agg_path)
    agg = agg_raw if isinstance(agg_raw, dict) else {e['ico']: e for e in agg_raw if 'ico' in e}

    # Flatten all mikroregión entries from categories
    entries = []
    for cat in mikro.get('categories', []):
        entries.extend(cat.get('entries', []))

    print(f'  Mikroregióny: {len(entries)}')

    attribution = {}  # { municipality_ico: { attributed_eur, sources, projects } }
    attributed_total = 0
    attributed_mikro = 0

    for entry in entries:
        mikro_ico = entry.get('ico', '')
        mikro_name = entry.get('name', '?')
        mikro_eur = entry.get('total_contracted_eur', 0)

        if mikro_ico not in rpo:
            continue

        rpo_entry = rpo[mikro_ico]
        founders = rpo_entry.get('founders', []) if isinstance(rpo_entry, dict) else rpo_entry

        # Filter to municipality founders only (must exist in municipal_stats)
        muni_founders = []
        for f in founders:
            if not isinstance(f, dict):
                continue
            f_ico = f.get('founder_ico', '')
            if f_ico and f_ico in muni_stats:
                pop = muni_stats[f_ico].get('population', 0) or 0
                if pop > 0:
                    muni_founders.append((f_ico, pop))

        if not muni_founders:
            continue

        total_pop = sum(pop for _, pop in muni_founders)
        if total_pop == 0:
            continue

        # Get project details from aggregated data
        mikro_projects = agg.get(mikro_ico, {}).get('projects', [])

        attributed_mikro += 1

        # Filter out municipalities where this mikroregión is already a subsidiary
        mikro_name_upper = mikro_name.upper().strip()
        deduped_founders = []
        skipped = 0
        for f_ico, pop in muni_founders:
            if f_ico in muni_sub_names and mikro_name_upper in muni_sub_names[f_ico]:
                skipped += 1
                continue
            deduped_founders.append((f_ico, pop))

        if skipped > 0:
            print(f'    Dedup: {mikro_name[:50]} — skipped {skipped}/{len(muni_founders)} (already subsidiary)')

        if not deduped_founders:
            continue

        deduped_pop = sum(pop for _, pop in deduped_founders)
        if deduped_pop == 0:
            continue

        attributed_total += mikro_eur * (len(deduped_founders) / len(muni_founders))

        for f_ico, pop in deduped_founders:
            share_ratio = pop / total_pop

            if f_ico not in attribution:
                attribution[f_ico] = {'attributed_eur': 0, 'sources': [], 'projects': []}

            attribution[f_ico]['attributed_eur'] += share_ratio * mikro_eur
            attribution[f_ico]['sources'].append(mikro_name)

            # Add project details with attributed amounts
            for p in mikro_projects:
                attributed_project = {
                    'nazov': p.get('nazov', ''),
                    'sumaZazmluvnena': round(share_ratio * (p.get('sumaZazmluvnena', 0) or 0)),
                    'fullProjectSum': p.get('sumaZazmluvnena', 0) or 0,
                    'stav': p.get('stav', ''),
                    'datumKoncaRealizacie': p.get('datumKoncaRealizacie', ''),
                    'source': mikro_name,
                    'isMikroregion': True,
                }
                attribution[f_ico]['projects'].append(attributed_project)

    # Round and deduplicate
    for ico in attribution:
        attribution[ico]['attributed_eur'] = round(attribution[ico]['attributed_eur'], 2)
        attribution[ico]['sources'] = list(set(attribution[ico]['sources']))
        # Sort projects by attributed amount desc
        attribution[ico]['projects'].sort(
            key=lambda p: p.get('sumaZazmluvnena', 0) or 0, reverse=True
        )

    out_path = DATA / f'mikroregion_attributed_{suffix}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(attribution, f, ensure_ascii=False, indent=2)

    print(f'  Attributed: {attributed_mikro} mikroregióny → {len(attribution)} municipalities')
    print(f'  Total attributed: €{attributed_total:,.0f}')
    print(f'  Saved: {out_path.name}')

    # Spot-check
    top = sorted(attribution.items(), key=lambda x: x[1]['attributed_eur'], reverse=True)[:3]
    for ico, d in top:
        name = muni_stats.get(ico, {}).get('official_name', ico)
        print(f'    {name}: €{d["attributed_eur"]:,.0f}, {len(d["projects"])} projects')
        for p in d['projects'][:2]:
            print(f'      {p["nazov"][:60]} — attributed €{p["sumaZazmluvnena"]:,}')


if __name__ == '__main__':
    attribute_period('14')
    attribute_period('21')
    print('\nDone.')
