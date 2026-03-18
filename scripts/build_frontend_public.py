#!/usr/bin/env python3
"""
build_frontend_public.py
------------------------
Merge municipal_stats*.json + subsidiaries_by_municipality.json +
indirect_by_municipality.json → frontend/public/municipal_stats*.json

Also updates frontend/public/vuc_stats*.json with subsidiary data.
Processes both 2014-2020 and 2021-2027 periods.
"""

import json
from pathlib import Path

ROOT = Path('/Users/boriskrisko/povolbach')
DATA = ROOT / 'data'
PUBLIC = ROOT / 'frontend' / 'public'

MAX_PROJECTS = 5          # top direct projects shown in modal
MAX_SUBSIDIARY_ORGS = 5   # shown in modal
MAX_INDIRECT_PROJECTS = 5  # shown in modal


def load_json(path: Path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def process_municipalities(base_path: Path, subs: dict, indirect: dict, out_path: Path):
    base = load_json(base_path)
    print(f'\n  Processing {base_path.name} → {out_path.name}')
    print(f'    Municipalities: {len(base)}')

    merged = 0
    for ico, m in base.items():
        changed = False

        # Sort direct projects by contracted amount desc, keep top 5
        if 'projects' in m:
            m['projects'] = sorted(
                m['projects'],
                key=lambda p: p.get('sumaZazmluvnena', 0) or 0,
                reverse=True
            )[:MAX_PROJECTS]
            changed = True

        # Subsidiaries
        if ico in subs:
            s = subs[ico]
            orgs = sorted(s.get('subsidiary_orgs', []),
                          key=lambda o: o.get('total_contracted_eur', 0), reverse=True)
            m['subsidiary_total_eur'] = s.get('subsidiary_total_eur', 0) or 0
            m['subsidiary_orgs'] = orgs[:MAX_SUBSIDIARY_ORGS]
            changed = True
        else:
            m.pop('subsidiary_total_eur', None)
            m.pop('subsidiary_orgs', None)

        # Indirect
        if ico in indirect:
            ind = indirect[ico]
            projs_raw = ind.get('indirect_projects', ind.get('projects', []))
            projs = sorted(projs_raw,
                           key=lambda p: p.get('contracted_eur', 0) or 0,
                           reverse=True)[:MAX_INDIRECT_PROJECTS]
            m['indirect_total_eur'] = ind.get('indirect_total_eur', ind.get('total_eur', 0))
            m['indirect_projects'] = projs
            changed = True
        else:
            m.pop('indirect_total_eur', None)
            m.pop('indirect_projects', None)

        if changed:
            merged += 1

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(base, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = out_path.stat().st_size / 1e6
    print(f'    Saved {out_path} ({size_mb:.1f} MB, {len(base)} entries, {merged} merged)')

    total_sub_eur = sum(m.get('subsidiary_total_eur', 0) or 0 for m in base.values())
    count_with_subs = sum(1 for m in base.values() if m.get('subsidiary_total_eur', 0) > 0)
    print(f'    Subsidiary EUR: €{total_sub_eur/1e6:.1f}M ({count_with_subs} municipalities)')
    return base


def process_vuc(vuc_path: Path, vuc_subs: dict, out_path: Path):
    if not vuc_path.exists():
        print(f'    Skipping {vuc_path.name} (not found)')
        return
    vuc_stats = load_json(vuc_path)
    print(f'\n  Processing {vuc_path.name} → {out_path.name}')

    for vico, vs in vuc_stats.items():
        # Sort direct projects by contracted amount desc, keep top 5
        if 'projects' in vs:
            vs['projects'] = sorted(
                vs['projects'],
                key=lambda p: p.get('sumaZazmluvnena', 0) or 0,
                reverse=True
            )[:MAX_PROJECTS]

        if vico in vuc_subs:
            vs_data = vuc_subs[vico]
            vs['subsidiary_total_eur'] = vs_data.get('subsidiary_total_eur', 0)
            orgs = sorted(vs_data.get('subsidiary_orgs', []),
                          key=lambda o: o.get('total_contracted_eur', 0), reverse=True)
            vs['subsidiary_orgs'] = orgs[:MAX_SUBSIDIARY_ORGS]

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(vuc_stats, f, ensure_ascii=False, separators=(',', ':'))
    print(f'    Saved {out_path} ({len(vuc_stats)} VÚC entries)')


def main():
    print('Loading shared data files...')

    subs = load_json(DATA / 'subsidiaries_by_municipality_14.json')
    vuc_subs = load_json(DATA / 'subsidiaries_by_vuc_14.json')

    indirect_path = DATA / 'indirect_by_municipality_14.json'
    indirect = load_json(indirect_path) if indirect_path.exists() else {}

    print(f'  Municipalities with subsidiaries: {len(subs)}')
    print(f'  Municipalities with indirect projects: {len(indirect)}')

    # ── 2014-2020 period ──────────────────────────────────────────────────────
    base_1420 = process_municipalities(
        DATA / 'municipal_stats_14.json',
        subs, indirect,
        PUBLIC / 'municipal_stats_14.json',
    )
    process_vuc(PUBLIC / 'vuc_stats_14.json', vuc_subs, PUBLIC / 'vuc_stats_14.json')

    # ── 2021-2027 period ──────────────────────────────────────────────────────
    if (DATA / 'municipal_stats_21.json').exists():
        process_municipalities(
            DATA / 'municipal_stats_21.json',
            subs, indirect,
            PUBLIC / 'municipal_stats_21.json',
        )
        process_vuc(PUBLIC / 'vuc_stats_21.json', vuc_subs, PUBLIC / 'vuc_stats_21.json')
    else:
        print('\n  Skipping 2021-2027 (data/municipal_stats_21.json not found)')

    # ── Verification ──────────────────────────────────────────────────────────
    partizanske = next((m for m in base_1420.values() if 'Partizán' in m.get('official_name', '')), None)
    if partizanske:
        sub_eur = partizanske.get('subsidiary_total_eur', 0)
        orgs = partizanske.get('subsidiary_orgs', [])
        projs = partizanske.get('projects', [])
        print(f'\nVerification — Partizánske:')
        print(f'  direct:   €{partizanske["total_contracted_eur"]/1e6:.2f}M')
        print(f'  subs:     €{sub_eur/1e6:.2f}M ({len(orgs)} orgs)')
        print(f'  projects: {len(projs)} (top {MAX_PROJECTS})')
        for p in projs[:3]:
            print(f'    {p["nazov"][:55]} €{p["sumaZazmluvnena"]/1e6:.2f}M')


if __name__ == '__main__':
    main()
