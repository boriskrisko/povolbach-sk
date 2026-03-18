#!/usr/bin/env python3
"""
attribute_subsidiaries.py
--------------------------
Attribute excluded ITMS beneficiaries to their founding municipality or VÚC.

NOTE: The RPO API (api.statistics.sk/rpo/v1/subjects/{ico}) returns 404 for
all ICO lookups, and /rpo/v1/search only accepts fullName parameter with no
zakladatel field in response. Attribution uses NUTS5 address from raw_subjects.json
(municipality where org is registered) combined with name-pattern filtering to
identify likely municipal/VÚC subsidiaries.

Attribution logic:
1. Filter state/ministry entities → skip (go to indirect, handled separately)
2. Filter VÚC entities → skip
3. For remaining: check address municipality via NUTS5 ID → municipal ICO
4. Name-pattern filter: only attribute if org name suggests municipal subsidiary
5. If founder municipality = VÚC region → attribute to VÚC instead

Outputs:
  data/subsidiaries_by_municipality.json
  data/subsidiaries_by_vuc.json
  data/attribution_log.txt
"""

import json
import sys
import os
from collections import defaultdict
from pathlib import Path

DATA = Path('/Users/boriskrisko/ConveyorMind/data')
LOG_PATH = DATA / 'attribution_log.txt'

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

VUC_REGIONS = {
    '36126624': 'Trenčiansky kraj',
    '37870475': 'Prešovský kraj',
    '37828100': 'Banskobystrický kraj',
    '37808427': 'Žilinský kraj',
    '37861298': 'Nitriansky kraj',
    '35541016': 'Košický kraj',
    '37836901': 'Trnavský kraj',
    '36063606': 'Bratislavský kraj',
}

STATE_KW = [
    'Ministerstvo', 'Úrad vlády', 'Ústredie', 'Slovenská republika',
    'Národná agentúra', 'Slovenská agentúra', 'Fond', 'Správa',
    'Národná diaľničná', 'Železnice', 'Štátna', 'štátna', 'Sociálna poisťovňa',
    'Slovak Investment Holding', 'Slovenská inovačná', 'Dopravný podnik',
    'Slovenská správa', 'Národné centrum', 'Slovenské centrum',
]

# Name patterns for municipal/VÚC subsidiaries
MUNI_NAME_PATTERNS = [
    # Educational
    'ZŠ', 'MŠ', 'ZUŠ', 'CVČ', 'ŠKD', 'Gymnázium', 'gymnázium',
    'Základná škola', 'Materská škola', 'Stredná škola', 'Spojená škola',
    'SOŠ', 'SŠ', 'Odborná škola', 'Stredné odborné', 'Učňovská',
    'Špeciálna základná', 'Špeciálna škola', 'Konzervatórium',
    # Cultural
    'Kultúrny dom', 'kultúrny dom', 'Dom kultúry', 'Kultúrne centrum',
    'kultúrne centrum', 'Knižnica', 'knižnica', 'Múzeum', 'múzeum',
    'Galéria', 'galéria', 'Osvetové stredisko', 'Kultúrne zariadenie',
    # Social & health
    'Domov dôchodcov', 'Domov sociálnych', 'Centrum sociálnych',
    'Zariadenie pre seniorov', 'Zariadenie sociálnych', 'Denné centrum',
    'Sociálne centrum', 'Poliklinika', 'Nemocnica s poliklinikou',
    # City property / utilities
    'Správa mestskej', 'Správa mesta', 'Správa obecného', 'Správa obce',
    'Bytový podnik', 'Mestský bytový', 'Obecný bytový',
    'Mestské služby', 'Obecné služby', 'Technické služby mesta',
    'Technické služby obce', 'Verejnoprospešné', 'Komunálne',
    'Mestská zeleň', 'Správa zelene', 'Záhradnícke', 'Záhradníctvo',
    # Sports
    'Mestský stadión', 'Telovýchovná jednota', 'Mestská plaváreň',
]

VUC_NAME_PATTERNS = [
    # VÚC-level education
    'Stredná odborná škola', 'Stredné odborné učilište', 'Gymnázium',
    'gymnázium', 'Obchodná akadémia', 'Zdravotnícka škola',
    'Pedagogická a sociálna', 'Hotelová akadémia', 'Škola umeleckého',
    # VÚC hospitals/social
    'Nemocnica', 'nemocnica', 'Psychiatrická liečebňa', 'Psychiatrická nemocnica',
    'Domov sociálnych služieb pre', 'Domov pre postihnutých',
    'Centrum pre deti', 'Krízové centrum',
    # Regional museums/culture
    'Krajské múzeum', 'Krajská knižnica', 'Krajské kultúrne',
    'Hornonitrianské múzeum', 'Vihorlatské múzeum',
]

def is_state(name: str) -> bool:
    return any(kw in name for kw in STATE_KW)

def has_commercial_suffix(name: str) -> bool:
    """Commercial entities are usually not subsidiaries."""
    suffixes = [', a.s.', ', s.r.o.', ' a.s.', ' s.r.o.', ', spol.', 'akciová spoločnosť', ', n.p.']
    nl = name.lower()
    return any(s.lower() in nl for s in suffixes)

def is_municipal_subsidiary(name: str) -> bool:
    if has_commercial_suffix(name):
        return False
    return any(pat in name for pat in MUNI_NAME_PATTERNS)

def is_vuc_subsidiary(name: str) -> bool:
    if has_commercial_suffix(name):
        return False
    return any(pat in name for pat in VUC_NAME_PATTERNS)

def log(msg: str):
    print(msg, file=sys.stderr)


def main():
    log('Loading data files...')

    with open(DATA / 'excluded_beneficiaries.json') as f:
        excluded = json.load(f)

    with open(DATA / 'raw_subjects.json') as f:
        raw_subj = json.load(f)
    subj_by_ico = {str(v.get('ico', '')): v for v in raw_subj.values()}

    with open(DATA / 'raw_nuts_names.json') as f:
        nuts_names = json.load(f)  # numeric_id -> municipality_name

    with open(DATA / 'municipal_stats.json') as f:
        muni_stats = json.load(f)

    with open(DATA / 'aggregated_by_beneficiary.json') as f:
        agg_list = json.load(f)
    agg_by_ico = {e['ico']: e for e in agg_list}

    # Build municipality name → ICO lookup
    STRIP = ['Obec ', 'Mesto ', 'Mestská časť ']
    def plain(n):
        for p in STRIP:
            if n.startswith(p):
                return n[len(p):]
        return n

    name_to_ico_muni = {}
    for ico, m in muni_stats.items():
        on = m.get('official_name', '')
        pn = plain(on)
        # Only store if unique
        for nm in [on, pn]:
            if nm not in name_to_ico_muni:
                name_to_ico_muni[nm] = ico

    # Build NUTS5 numeric id → municipality ICO (unique matches only)
    from collections import defaultdict
    name_to_icos_all = defaultdict(list)
    for ico, m in muni_stats.items():
        on = m.get('official_name', '')
        pn = plain(on)
        name_to_icos_all[on].append(ico)
        name_to_icos_all[pn].append(ico)

    nuts_id_to_ico = {}
    for nid, name in nuts_names.items():
        cands = name_to_icos_all.get(name, [])
        uniq = list(dict.fromkeys(cands))
        if len(uniq) == 1:
            nuts_id_to_ico[nid] = uniq[0]

    # Manual overrides: multi-district cities (Košice I-IV, Bratislava sub-districts)
    # All resolve to the single city municipality ICO
    KOŠICE_ICO = '00691135'
    BRATISLAVA_ICO = '00603481'
    KOŠICE_SUB_IDS = [
        '89', '90', '91', '92',  # Košice I, II, III, IV
        '2704','2705','2706','2707','2708','2709','2710','2711','2712','2713',
        '2714','2715','2716','2717','2718','2719','2720','2721','2722','2723',
        '2724','2725',  # Košice mestské časti
    ]
    BRATISLAVA_SUB_IDS = [
        '18', '19', '20', '21', '22',  # Bratislava I–V
        '99','100','101','102','103','104','105','106','107','108',
        '109','110','111','112','113','114','115',  # Bratislava mestské časti
    ]
    for nid in KOŠICE_SUB_IDS:
        nuts_id_to_ico[nid] = KOŠICE_ICO
    for nid in BRATISLAVA_SUB_IDS:
        nuts_id_to_ico[nid] = BRATISLAVA_ICO

    log(f'NUTS5 IDs with unique ICO mapping: {len(nuts_id_to_ico)}')

    # Build VÚC region name → ICO lookup
    region_to_vuc = {v: k for k, v in VUC_REGIONS.items()}

    # ── Main attribution loop ──────────────────────────────────────────────
    by_muni = defaultdict(lambda: {'subsidiary_orgs': [], 'subsidiary_total_eur': 0})
    by_vuc = {ico: {'subsidiary_orgs': [], 'subsidiary_total_eur': 0} for ico in VUC_ICOS}

    counters = defaultdict(int)
    log_lines = []

    for e in excluded:
        ico = e.get('ico', '')
        name = e.get('name', '')
        total_eur = e.get('total_contracted_eur', 0) or 0
        projects_count = e.get('projects_count', 0) or 0

        # Skip VÚC
        if ico in VUC_ICOS:
            counters['skip_vuc'] += 1
            continue

        # Skip state entities
        if is_state(name):
            counters['skip_state'] += 1
            continue

        # Get NUTS5 municipality from address
        sv = subj_by_ico.get(ico)
        if not sv:
            counters['no_subject'] += 1
            log_lines.append(f'NO_SUBJECT\t{ico}\t{name}')
            continue

        nuts_id = str(sv.get('obec', {}).get('hodnotaNuts', {}).get('id', ''))
        if not nuts_id:
            counters['no_nuts'] += 1
            log_lines.append(f'NO_NUTS\t{ico}\t{name}')
            continue

        # Resolve NUTS5 to municipality name
        muni_name = nuts_names.get(nuts_id, '')
        muni_ico = nuts_id_to_ico.get(nuts_id)

        if not muni_ico:
            counters['ambig_nuts'] += 1
            log_lines.append(f'AMBIG_NUTS\t{ico}\t{name}\tnuts_id={nuts_id}\tname={muni_name}')
            continue

        # Get the region for this municipality (to check VÚC attribution)
        muni_region = muni_stats.get(muni_ico, {}).get('region', '')
        vuc_ico = region_to_vuc.get(muni_region)

        # Determine attribution type
        org_entry = {
            'ico': ico,
            'name': name,
            'total_contracted_eur': total_eur,
            'projects_count': projects_count,
        }

        if is_vuc_subsidiary(name) and not is_municipal_subsidiary(name):
            # Regional hospitals, secondary schools → VÚC
            if vuc_ico:
                by_vuc[vuc_ico]['subsidiary_orgs'].append(org_entry)
                by_vuc[vuc_ico]['subsidiary_total_eur'] += total_eur
                counters['attributed_vuc'] += 1
            else:
                counters['unresolved_region'] += 1
                log_lines.append(f'UNRESOLVED_REGION\t{ico}\t{name}\tregion={muni_region}')
        elif is_municipal_subsidiary(name):
            # Schools, libraries, cultural centers → municipality
            by_muni[muni_ico]['ico'] = muni_ico
            by_muni[muni_ico]['municipality'] = muni_stats.get(muni_ico, {}).get('official_name', '')
            by_muni[muni_ico]['subsidiary_orgs'].append(org_entry)
            by_muni[muni_ico]['subsidiary_total_eur'] += total_eur
            counters['attributed_muni'] += 1
        else:
            # Doesn't match patterns → log and skip
            counters['unmatched_pattern'] += 1
            log_lines.append(f'NO_PATTERN\t{ico}\t{name}')

    # Sort subsidiary orgs by EUR desc
    for mico, d in by_muni.items():
        d['subsidiary_orgs'].sort(key=lambda o: o['total_contracted_eur'], reverse=True)
    for vico, d in by_vuc.items():
        d['subsidiary_orgs'].sort(key=lambda o: o['total_contracted_eur'], reverse=True)

    # Save
    with open(DATA / 'subsidiaries_by_municipality.json', 'w', encoding='utf-8') as f:
        json.dump(dict(by_muni), f, ensure_ascii=False, indent=2)

    # For VÚC: add name fields
    vuc_sub_out = {}
    for vico, d in by_vuc.items():
        vuc_sub_out[vico] = {
            'ico': vico,
            'name': VUC_ICOS[vico],
            **d,
        }
    with open(DATA / 'subsidiaries_by_vuc.json', 'w', encoding='utf-8') as f:
        json.dump(vuc_sub_out, f, ensure_ascii=False, indent=2)

    with open(LOG_PATH, 'w', encoding='utf-8') as f:
        f.write('SUBSIDIARY ATTRIBUTION LOG\n')
        f.write('=' * 80 + '\n\n')
        f.write('NOTE: RPO API (api.statistics.sk/rpo/v1) does not expose zakladatel\n')
        f.write('field via ICO lookup. Attribution uses NUTS5 address from ITMS\n')
        f.write('raw_subjects.json combined with name-pattern classification.\n\n')
        for k, v in counters.items():
            f.write(f'{k}: {v}\n')
        f.write('\nUNRESOLVED ENTRIES:\n')
        for line in log_lines:
            f.write(line + '\n')

    log('\n=== Attribution Results ===')
    for k, v in counters.items():
        log(f'  {k}: {v}')
    log(f'  Municipalities with subsidiaries: {len(by_muni)}')
    log(f'  VÚC entries with subsidiaries: {sum(1 for d in by_vuc.values() if d["subsidiary_orgs"])}')

    muni_total = sum(d['subsidiary_total_eur'] for d in by_muni.values())
    vuc_total = sum(d['subsidiary_total_eur'] for d in by_vuc.values())
    log(f'  Total EUR attributed to municipalities: €{muni_total:,.0f}')
    log(f'  Total EUR attributed to VÚC: €{vuc_total:,.0f}')
    log(f'  Log written to {LOG_PATH}')

    # Top municipalities by subsidiary EUR
    top_muni = sorted(by_muni.items(), key=lambda x: x[1]['subsidiary_total_eur'], reverse=True)[:10]
    log('\nTop 10 municipalities by subsidiary EUR:')
    for ico, d in top_muni:
        log(f"  {d.get('municipality','')}: €{d['subsidiary_total_eur']:,.0f} ({len(d['subsidiary_orgs'])} orgs)")


if __name__ == '__main__':
    main()
