#!/usr/bin/env python3
"""
attribute_subsidiaries.py
--------------------------
Attribute ITMS beneficiaries to their founding municipality or VÚC
using RPO (Register právnických osôb) full export data.

Attribution logic — ZERO name matching, IČO only:
1. Load rpo_founders.json (extracted from RPO S3 dump by extract_rpo_founders.py)
2. For each non-municipality beneficiary in aggregated_by_beneficiary_{period}.json:
   - If RPO says its founder/stakeholder IČO matches a municipality → municipal subsidiary
   - If RPO says its founder/stakeholder IČO matches a VÚC → VÚC subsidiary
   - Otherwise → excluded (not municipally-controlled)

Outputs:
  data/subsidiaries_by_municipality_{period}.json
  data/subsidiaries_by_vuc_{period}.json
  data/attribution_log_{period}.txt
"""

import json
import sys
import argparse
from collections import defaultdict
from pathlib import Path

ROOT = Path('/Users/boriskrisko/povolbach')
DATA = ROOT / 'data'

# ── VÚC IČOs ──────────────────────────────────────────────────────────────
VUC_ICOS = {
    '36126624': 'Trenčiansky samosprávny kraj',
    '37870475': 'Prešovský samosprávny kraj',
    '37828100': 'Banskobystrický samosprávny kraj',
    '37808427': 'Žilinský samosprávny kraj',
    '37861298': 'Nitriansky samosprávny kraj',
    '35541016': 'Košický samosprávny kraj',
    '37836901': 'Trnavský samosprávny kraj',
    '36063606': 'Bratislavský samosprávny kraj',
}

def log(msg: str):
    print(msg, file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--period', choices=['14', '21'], default='14',
                        help='Period suffix: 14 (2014-2020) or 21 (2021-2027)')
    args = parser.parse_args()
    period = args.period

    log(f'=== RPO-based Attribution for period _{period} ===')

    # ── Load data ────────────────────────────────────────────────────────
    # RPO founder lookup (entity_ico -> {founder_ico, founder_name, ...})
    with open(DATA / 'rpo_founders.json') as f:
        rpo_founders = json.load(f)
    log(f'RPO founder entries: {len(rpo_founders)}')

    # Aggregated beneficiaries for this period
    agg_path = DATA / f'aggregated_by_beneficiary_{period}.json'
    with open(agg_path) as f:
        agg_data = json.load(f)
    if isinstance(agg_data, list):
        agg_by_ico = {e['ico']: e for e in agg_data}
    else:
        agg_by_ico = agg_data

    # Municipality register
    with open(DATA / 'municipalities_isco.json') as f:
        muni_register = json.load(f)
    muni_set = set(muni_register.keys())

    # Municipal stats (for official_name lookup)
    muni_stats_path = DATA / f'municipal_stats_{period}.json'
    with open(muni_stats_path) as f:
        muni_stats = json.load(f)

    vuc_set = set(VUC_ICOS.keys())

    # ── Main attribution loop ────────────────────────────────────────────
    by_muni = defaultdict(lambda: {'subsidiary_orgs': [], 'subsidiary_total_eur': 0})
    by_vuc = {ico: {'subsidiary_orgs': [], 'subsidiary_total_eur': 0} for ico in VUC_ICOS}

    counters = defaultdict(int)
    log_lines = []

    for ico, e in agg_by_ico.items():
        # Skip municipalities themselves
        if ico in muni_set:
            continue
        # Skip VÚCs themselves
        if ico in vuc_set:
            continue

        name = e.get('nazov', e.get('name', ''))
        total_eur = e.get('total_contracted_eur', 0) or 0
        projects_count = (e.get('active_projects', 0) or 0) + (e.get('completed_projects', 0) or 0)

        # Look up in RPO founders
        rpo_entry = rpo_founders.get(ico)
        if not rpo_entry:
            counters['no_rpo_match'] += 1
            log_lines.append(f'NO_RPO\t{ico}\t{name}\t€{total_eur:,.0f}')
            continue

        founder_ico = rpo_entry['founder_ico']

        org_entry = {
            'ico': ico,
            'name': name,
            'total_contracted_eur': total_eur,
            'projects_count': projects_count,
            'rpo_relationship': rpo_entry.get('relationship', ''),
        }

        if founder_ico in muni_set:
            # Municipal subsidiary
            muni_name = muni_stats.get(founder_ico, {}).get('official_name', '')
            by_muni[founder_ico]['ico'] = founder_ico
            by_muni[founder_ico]['municipality'] = muni_name
            by_muni[founder_ico]['subsidiary_orgs'].append(org_entry)
            by_muni[founder_ico]['subsidiary_total_eur'] += total_eur
            counters['attributed_muni'] += 1
        elif founder_ico in vuc_set:
            # VÚC subsidiary
            by_vuc[founder_ico]['subsidiary_orgs'].append(org_entry)
            by_vuc[founder_ico]['subsidiary_total_eur'] += total_eur
            counters['attributed_vuc'] += 1
        else:
            # Founder is neither municipality nor VÚC (e.g. another company)
            counters['non_muni_founder'] += 1
            log_lines.append(f'NON_MUNI_FOUNDER\t{ico}\t{name}\tfounder={founder_ico}\t{rpo_entry.get("founder_name","")}')

    # Sort subsidiary orgs by EUR desc
    for d in by_muni.values():
        d['subsidiary_orgs'].sort(key=lambda o: o['total_contracted_eur'], reverse=True)
    for d in by_vuc.values():
        d['subsidiary_orgs'].sort(key=lambda o: o['total_contracted_eur'], reverse=True)

    # ── Save ─────────────────────────────────────────────────────────────
    with open(DATA / f'subsidiaries_by_municipality_{period}.json', 'w', encoding='utf-8') as f:
        json.dump(dict(by_muni), f, ensure_ascii=False, indent=2)

    vuc_sub_out = {}
    for vico, d in by_vuc.items():
        vuc_sub_out[vico] = {
            'ico': vico,
            'name': VUC_ICOS[vico],
            **d,
        }
    with open(DATA / f'subsidiaries_by_vuc_{period}.json', 'w', encoding='utf-8') as f:
        json.dump(vuc_sub_out, f, ensure_ascii=False, indent=2)

    log_path = DATA / f'attribution_log_{period}.txt'
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write('SUBSIDIARY ATTRIBUTION LOG (RPO-based)\n')
        f.write('=' * 80 + '\n\n')
        f.write('Method: RPO full export from ŠÚSR S3 bucket (rpo_founders.json)\n')
        f.write('Rule: If entity stakeholder IČO matches municipality → subsidiary\n')
        f.write('Zero name matching. IČO only.\n\n')
        for k, v in sorted(counters.items()):
            f.write(f'{k}: {v}\n')
        f.write(f'\nMunicipalities with subsidiaries: {len(by_muni)}\n')
        f.write(f'VÚCs with subsidiaries: {sum(1 for d in by_vuc.values() if d["subsidiary_orgs"])}\n')
        f.write('\nUNRESOLVED ENTRIES:\n')
        for line in log_lines:
            f.write(line + '\n')

    log('\n=== Attribution Results ===')
    for k, v in sorted(counters.items()):
        log(f'  {k}: {v}')
    log(f'  Municipalities with subsidiaries: {len(by_muni)}')
    log(f'  VÚC entries with subsidiaries: {sum(1 for d in by_vuc.values() if d["subsidiary_orgs"])}')

    muni_total = sum(d['subsidiary_total_eur'] for d in by_muni.values())
    vuc_total = sum(d['subsidiary_total_eur'] for d in by_vuc.values())
    log(f'  Total EUR attributed to municipalities: €{muni_total:,.0f}')
    log(f'  Total EUR attributed to VÚC: €{vuc_total:,.0f}')

    # Top municipalities by subsidiary EUR
    top_muni = sorted(by_muni.items(), key=lambda x: x[1]['subsidiary_total_eur'], reverse=True)[:10]
    log('\nTop 10 municipalities by subsidiary EUR:')
    for ico, d in top_muni:
        log(f"  {d.get('municipality','')}: €{d['subsidiary_total_eur']:,.0f} ({len(d['subsidiary_orgs'])} orgs)")


if __name__ == '__main__':
    main()
