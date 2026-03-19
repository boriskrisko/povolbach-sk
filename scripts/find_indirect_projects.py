#!/usr/bin/env python3
"""
find_indirect_projects.py
Build data/indirect_by_municipality.json — state/ministry projects mapped to the
municipalities in whose territory they were implemented.

Source: aggregated_by_beneficiary.json already has miestaRealizacie resolved to
municipality-name strings by the pipeline.
"""

import json
import sys
import argparse
from collections import defaultdict

DATA = '/Users/boriskrisko/povolbach/data'

STATE_KEYWORDS = [
    'Ministerstvo', 'Slovenská republika', 'Úrad vlády',
    'Správa', 'Fond', 'Agentúra', 'Národná diaľničná', 'Železnice',
]
EXCLUDE_KEYWORDS = [
    'ZŠ', 'MŠ', 'gymnázium', 'Gymnázium', 'kultúrne', 'knižnica', 'škola', 'Škola',
]

def log(msg):
    print(msg, file=sys.stderr)
    print(msg)

def is_state_agency(name: str) -> bool:
    if any(kw in name for kw in EXCLUDE_KEYWORDS):
        return False
    return any(kw in name for kw in STATE_KEYWORDS)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--period', choices=['14', '21'], default='14',
                        help='Period suffix: 14 (2014-2020) or 21 (2021-2027)')
    args = parser.parse_args()
    period = args.period

    log(f'=== Indirect project mapping for period _{period} ===')
    log('Loading data files...')

    with open(f'{DATA}/aggregated_by_beneficiary_{period}.json') as f:
        agg_data = json.load(f)
    # Normalize: _14 is a list, _21 is a dict
    if isinstance(agg_data, list):
        agg_by_ico = {e['ico']: e for e in agg_data}
    else:
        agg_by_ico = agg_data

    with open(f'{DATA}/municipalities_ico.json') as f:
        muni_register = json.load(f)
    muni_set = set(muni_register.keys())

    # Build excluded list from non-municipality entries
    excluded = [{'ico': ico, 'name': e.get('nazov', e.get('name', ''))}
                for ico, e in agg_by_ico.items() if ico not in muni_set]

    with open(f'{DATA}/municipal_stats_{period}.json') as f:
        muni_stats = json.load(f)

    # Build name -> ICO lookup from municipal_stats
    # Strip "Obec ", "Mesto ", "Mestská časť " prefixes to get plain name
    STRIP_PREFIXES = ['Obec ', 'Mesto ', 'Mestská časť ', 'Mestský úrad ', 'Municipalita ']

    def plain_name(official: str) -> str:
        for p in STRIP_PREFIXES:
            if official.startswith(p):
                return official[len(p):]
        return official

    name_to_icos = defaultdict(list)
    for ico, m in muni_stats.items():
        pn = plain_name(m.get('official_name', ''))
        name_to_icos[pn].append(ico)
        # Also index by official_name directly
        name_to_icos[m.get('official_name', '')].append(ico)

    log(f'Municipality name lookup: {len(name_to_icos)} name variants for {len(muni_stats)} municipalities')

    # Filter state agencies
    state_icos = {e['ico'] for e in excluded if is_state_agency(e.get('name', ''))}
    log(f'State agencies identified: {len(state_icos)}')

    # For each state agency, find their aggregated data and extract projects
    indirect_by_muni = defaultdict(lambda: {'indirect_projects': [], 'indirect_total_eur': 0})

    matched_agencies = 0
    total_projects = 0
    municipality_hits = 0
    ambiguous = 0
    unmatched_names = set()

    for ico in state_icos:
        if ico not in agg_by_ico:
            continue
        agency = agg_by_ico[ico]
        agency_name = agency.get('nazov', '')
        matched_agencies += 1

        for proj in agency.get('projects', []):
            total_projects += 1
            proj_name = proj.get('nazov', '')
            amount = proj.get('sumaZazmluvnena', 0) or 0
            stav = proj.get('stav', '')
            status = 'Ukončený' if 'ukon' in stav.lower() else 'V realizácii'

            muni_names = proj.get('miestaRealizacie', [])
            if not muni_names:
                continue

            for muni_name in muni_names:
                candidates = name_to_icos.get(muni_name, [])
                if not candidates:
                    unmatched_names.add(muni_name)
                    continue
                if len(candidates) > 1:
                    # Deduplicate (official_name and plain_name might both index same ICO)
                    candidates = list(dict.fromkeys(candidates))
                if len(candidates) > 1:
                    ambiguous += 1
                    continue  # Skip truly ambiguous matches

                target_ico = candidates[0]
                municipality_hits += 1

                entry = indirect_by_muni[target_ico]
                entry['ico'] = target_ico
                entry['municipality'] = muni_stats[target_ico].get('official_name', '')

                entry['indirect_projects'].append({
                    'name': proj_name,
                    'beneficiary_name': agency_name,
                    'beneficiary_ico': ico,
                    'contracted_eur': amount,
                    'status': status,
                })
                entry['indirect_total_eur'] = (entry.get('indirect_total_eur') or 0) + amount

    # Sort projects by contracted_eur desc within each municipality
    for ico, entry in indirect_by_muni.items():
        entry['indirect_projects'].sort(key=lambda p: p['contracted_eur'], reverse=True)

    result = dict(indirect_by_muni)

    out_path = f'{DATA}/indirect_by_municipality_{period}.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log(f'\n=== Results ===')
    log(f'State agencies processed: {matched_agencies}')
    log(f'Total state projects scanned: {total_projects}')
    log(f'Municipality assignment hits: {municipality_hits}')
    log(f'Municipalities with indirect projects: {len(result)}')
    log(f'Ambiguous NUTS5 matches skipped: {ambiguous}')
    log(f'Unmatched location names: {len(unmatched_names)}')
    log(f'Sample unmatched: {list(unmatched_names)[:10]}')
    log(f'Saved to {out_path}')

    # Show top municipalities by indirect EUR
    top = sorted(result.items(), key=lambda x: x[1].get('indirect_total_eur', 0), reverse=True)[:10]
    log('\nTop 10 municipalities by indirect EUR:')
    for ico, e in top:
        log(f"  {e.get('municipality','')}: €{e.get('indirect_total_eur',0):,.0f} ({len(e['indirect_projects'])} projects)")

if __name__ == '__main__':
    main()
