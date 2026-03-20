#!/usr/bin/env python3
"""
attribute_mikroregiony.py
Attribute mikroregión funding to member municipalities via RPO founder data.
Split proportionally by population. IČO-only joins — no name matching.
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

    # Flatten all mikroregión entries from categories
    entries = []
    for cat in mikro.get('categories', []):
        entries.extend(cat.get('entries', []))

    print(f'  Mikroregióny: {len(entries)}')

    attribution = {}  # { municipality_ico: { attributed_eur: X, sources: [...] } }
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

        attributed_mikro += 1
        attributed_total += mikro_eur

        for f_ico, pop in muni_founders:
            share = (pop / total_pop) * mikro_eur

            if f_ico not in attribution:
                attribution[f_ico] = {'attributed_eur': 0, 'sources': []}

            attribution[f_ico]['attributed_eur'] += share
            attribution[f_ico]['sources'].append(mikro_name)

    # Round amounts
    for ico in attribution:
        attribution[ico]['attributed_eur'] = round(attribution[ico]['attributed_eur'], 2)
        # Deduplicate sources
        attribution[ico]['sources'] = list(set(attribution[ico]['sources']))

    out_path = DATA / f'mikroregion_attributed_{suffix}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(attribution, f, ensure_ascii=False, indent=2)

    print(f'  Attributed: {attributed_mikro} mikroregióny → {len(attribution)} municipalities')
    print(f'  Total attributed: €{attributed_total:,.0f}')
    print(f'  Saved: {out_path.name}')

    # Spot-check top 5 municipalities by attributed amount
    top = sorted(attribution.items(), key=lambda x: x[1]['attributed_eur'], reverse=True)[:5]
    print(f'  Top 5 recipients:')
    for ico, d in top:
        name = muni_stats.get(ico, {}).get('official_name', ico)
        print(f'    {name}: €{d["attributed_eur"]:,.0f} from {len(d["sources"])} mikroregión(y)')


if __name__ == '__main__':
    attribute_period('14')
    attribute_period('21')
    print('\nDone.')
