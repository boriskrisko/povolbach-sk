#!/usr/bin/env python3
"""
build_mikroregiony.py
---------------------
Build data/mikroregiony_stats.json from excluded_beneficiaries.json.
Covers inter-municipal cooperation entities (združenia obcí, mikroregióny).
"""

import json
from pathlib import Path

DATA = Path('/Users/boriskrisko/ConveyorMind/data')

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
    with open(DATA / 'excluded_beneficiaries.json') as f:
        excl = json.load(f)

    mikro = [e for e in excl if any(kw.lower() in e['name'].lower() for kw in MIKRO_KW)]
    mikro.sort(key=lambda e: -e['total_contracted_eur'])

    # Build category groups
    by_cat = {cat['key']: [] for cat in CATEGORIES}
    for e in mikro:
        cat_key = categorize(e['name'])
        by_cat[cat_key].append({
            'ico': e['ico'],
            'name': e['name'],
            'total_contracted_eur': e['total_contracted_eur'],
            'projects_count': e.get('projects_count', 0),
        })

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

    with open(DATA / 'mikroregiony_stats.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f'Total mikroregióny: {total_count}, €{total_eur/1e6:.1f}M')
    for cat in categories_out:
        print(f'  {cat["label_sk"]}: {cat["count"]} entities, €{cat["total_contracted_eur"]/1e6:.1f}M')


if __name__ == '__main__':
    main()
