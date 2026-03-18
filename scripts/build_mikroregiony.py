#!/usr/bin/env python3
"""
build_mikroregiony.py
---------------------
Build data/mikroregiony_stats_{period}.json from aggregated_by_beneficiary_{period}.json.
Covers inter-municipal cooperation entities (združenia obcí, mikroregióny).
"""

import json
import argparse
from pathlib import Path

DATA = Path('/Users/boriskrisko/povolbach/data')

# Keywords that identify inter-municipal cooperation bodies
MIKRO_KW = [
    'mikroregión', 'mikroregion', 'združenie obcí', 'združenie miest',
    'zoskupenie obcí', 'združenie samospráv',
]

# Category keywords (checked in order — first match wins)
CATEGORIES = [
    {
        'key': 'voda',
        'label_sk': 'Vodné hospodárstvo',
        'label_en': 'Water & Sewage',
        'desc_sk': 'Kanalizácie, čistiarne odpadových vôd, vodovody',
        'desc_en': 'Sewage networks, wastewater treatment, water supply',
        'keywords': ['kanalizácia', 'čov', 'aglomerácia', 'enviropark', 'vodovod', 'hrádza',
                     'potôň', 'hronovce', 'pomoravie', 'čistiareň', 'splaškov'],
    },
    {
        'key': 'odpad',
        'label_sk': 'Odpadové hospodárstvo',
        'label_en': 'Waste Management',
        'desc_sk': 'Triedenie a likvidácia odpadu, zberné dvory',
        'desc_en': 'Waste sorting, disposal, collection facilities',
        'keywords': ['odpad', 'likvidácia', 'triedenie', 'nakladanie', 'skládka', 'zberný'],
    },
    {
        'key': 'doprava',
        'label_sk': 'Doprava a cestovný ruch',
        'label_en': 'Transport & Tourism',
        'desc_sk': 'Cyklotrasy, cesty, turistická infraštruktúra',
        'desc_en': 'Cycling paths, roads, tourist infrastructure',
        'keywords': ['cyklo', 'cesta', 'turizmus', 'cestovný ruch', 'trasa'],
    },
    {
        'key': 'rozvoj',
        'label_sk': 'Regionálny rozvoj',
        'label_en': 'Regional Development',
        'desc_sk': 'Rozvojové projekty, spolupráca obcí, územný rozvoj',
        'desc_en': 'Development projects, inter-municipal cooperation',
        'keywords': [],  # catch-all
    },
]


def categorize(name: str) -> str:
    n = name.lower()
    for cat in CATEGORIES[:-1]:  # all except catch-all
        if any(kw in n for kw in cat['keywords']):
            return cat['key']
    return 'rozvoj'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--period', choices=['14', '21'], default='14',
                        help='Period suffix: 14 (2014-2020) or 21 (2021-2027)')
    args = parser.parse_args()
    period = args.period

    # Load aggregated data
    agg_path = DATA / f'aggregated_by_beneficiary_{period}.json'
    with open(agg_path) as f:
        agg_data = json.load(f)
    if isinstance(agg_data, list):
        agg_by_ico = {e['ico']: e for e in agg_data}
    else:
        agg_by_ico = agg_data

    # Load municipality register to exclude municipalities
    with open(DATA / 'municipalities_isco.json') as f:
        muni_register = json.load(f)
    muni_set = set(muni_register.keys())

    # Find mikroregión/združenie entities among non-municipalities
    mikro = []
    for ico, e in agg_by_ico.items():
        if ico in muni_set:
            continue
        name = e.get('nazov', e.get('name', ''))
        if any(kw.lower() in name.lower() for kw in MIKRO_KW):
            mikro.append({
                'ico': ico,
                'name': name,
                'total_contracted_eur': e.get('total_contracted_eur', 0) or 0,
                'projects_count': e.get('projects_count', 0) or
                    ((e.get('projects_active', e.get('active_projects', 0)) or 0) +
                     (e.get('projects_completed', e.get('completed_projects', 0)) or 0)),
            })

    mikro.sort(key=lambda e: -e['total_contracted_eur'])

    # Build category groups
    by_cat = {cat['key']: [] for cat in CATEGORIES}
    for e in mikro:
        cat_key = categorize(e['name'])
        by_cat[cat_key].append(e)

    # Build output
    categories_out = []
    for cat in CATEGORIES:
        entries = by_cat[cat['key']]
        total = sum(e['total_contracted_eur'] for e in entries)
        categories_out.append({
            'key': cat['key'],
            'label_sk': cat['label_sk'],
            'label_en': cat['label_en'],
            'desc_sk': cat['desc_sk'],
            'desc_en': cat['desc_en'],
            'count': len(entries),
            'total_contracted_eur': total,
            'entries': entries,
        })

    total_count = len(mikro)
    total_eur = sum(e['total_contracted_eur'] for e in mikro)

    out = {
        'total_count': total_count,
        'total_contracted_eur': total_eur,
        'categories': categories_out,
    }

    out_path = DATA / f'mikroregiony_stats_{period}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f'Period _{period}: Total mikroregióny: {total_count}, €{total_eur/1e6:.1f}M')
    for cat in categories_out:
        print(f'  {cat["label_sk"]}: {cat["count"]} entities, €{cat["total_contracted_eur"]/1e6:.1f}M')


if __name__ == '__main__':
    main()
