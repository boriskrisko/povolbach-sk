#!/usr/bin/env python3
"""
build_frontend_public.py
------------------------
Merge municipal_stats.json + subsidiaries_by_municipality.json +
indirect_by_municipality.json → frontend/public/municipal_stats.json

Also updates frontend/public/vuc_stats.json with subsidiary data.
"""

import json
from pathlib import Path

ROOT = Path('/Users/boriskrisko/ConveyorMind')
DATA = ROOT / 'data'
PUBLIC = ROOT / 'frontend' / 'public'

MAX_SUBSIDIARY_ORGS = 5   # shown in modal
MAX_INDIRECT_PROJECTS = 3  # shown in modal


def main():
    print('Loading data files...')

    with open(DATA / 'municipal_stats.json') as f:
        base = json.load(f)  # dict: ICO → municipality dict

    with open(DATA / 'subsidiaries_by_municipality.json') as f:
        subs = json.load(f)  # dict: ICO → {subsidiary_orgs, subsidiary_total_eur}

    indirect_path = DATA / 'indirect_by_municipality.json'
    indirect = {}
    if indirect_path.exists():
        with open(indirect_path) as f:
            indirect = json.load(f)  # dict: ICO → {projects, total_eur}

    with open(DATA / 'subsidiaries_by_vuc.json') as f:
        vuc_subs = json.load(f)  # dict: ICO → {subsidiary_orgs, subsidiary_total_eur}

    # Load vuc_stats if already exists in public
    vuc_path = PUBLIC / 'vuc_stats.json'
    vuc_stats = {}
    if vuc_path.exists():
        with open(vuc_path) as f:
            vuc_stats = json.load(f)

    print(f'  Base municipalities: {len(base)}')
    print(f'  Municipalities with subsidiaries: {len(subs)}')
    print(f'  Municipalities with indirect projects: {len(indirect)}')

    # ── Merge municipal data ──────────────────────────────────────────────────
    merged = 0
    for ico, m in base.items():
        changed = False

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
            projs = ind.get('indirect_projects', ind.get('projects', []))[:MAX_INDIRECT_PROJECTS]
            m['indirect_total_eur'] = ind.get('indirect_total_eur', ind.get('total_eur', 0))
            m['indirect_projects'] = projs
            changed = True
        else:
            m.pop('indirect_total_eur', None)
            m.pop('indirect_projects', None)

        if changed:
            merged += 1

    print(f'  Municipalities with subsidiary or indirect data merged: {merged}')

    # ── Save municipal_stats.json ─────────────────────────────────────────────
    out_path = PUBLIC / 'municipal_stats.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(base, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = out_path.stat().st_size / 1e6
    print(f'  Saved {out_path} ({size_mb:.1f} MB, {len(base)} entries)')

    # ── Update VÚC subsidiary data ────────────────────────────────────────────
    for vico, vs in vuc_stats.items():
        if vico in vuc_subs:
            vs_data = vuc_subs[vico]
            vs['subsidiary_total_eur'] = vs_data.get('subsidiary_total_eur', 0)
            vs['subsidiary_orgs'] = vs_data.get('subsidiary_orgs', [])[:MAX_SUBSIDIARY_ORGS]

    with open(vuc_path, 'w', encoding='utf-8') as f:
        json.dump(vuc_stats, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  Saved {vuc_path} ({len(vuc_stats)} VÚC entries)')

    # ── Verification ──────────────────────────────────────────────────────────
    partizanske = next((m for m in base.values() if 'Partizán' in m.get('official_name', '')), None)
    if partizanske:
        sub_eur = partizanske.get('subsidiary_total_eur', 0)
        orgs = partizanske.get('subsidiary_orgs', [])
        print(f'\nVerification — Partizánske:')
        print(f'  direct:  €{partizanske["total_contracted_eur"]/1e6:.2f}M')
        print(f'  subs:    €{sub_eur/1e6:.2f}M ({len(orgs)} orgs)')
        for o in orgs:
            print(f'    {o["name"][:55]} €{o["total_contracted_eur"]/1e6:.2f}M')

    total_sub_eur = sum(m.get('subsidiary_total_eur', 0) or 0 for m in base.values())
    count_with_subs = sum(1 for m in base.values() if m.get('subsidiary_total_eur', 0) > 0)
    print(f'\nTotal subsidiary EUR in output: €{total_sub_eur/1e6:.1f}M ({count_with_subs} municipalities)')


if __name__ == '__main__':
    main()
