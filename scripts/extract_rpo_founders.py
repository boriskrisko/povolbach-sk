#!/usr/bin/env python3
"""
Extract municipal ownership relationships from the RPO (Register právnických osôb) full export.

Downloads all init chunks from the ŠÚSR S3 bucket, then scans every entity's stakeholders.
If ANY stakeholder's IČO (identifier field) matches a municipality IČO from our register,
that entity is flagged as a municipal subsidiary — regardless of stakeholder type
(Spoločník, Zakladateľ, Zriaďovateľ, Akcionár, etc.).

Output: data/rpo_founders.json
"""

import json
import gzip
import os
import sys
import urllib.request
import time

BASE = '/Users/boriskrisko/povolbach'
BUCKET = 'https://frkqbrydxwdp.compat.objectstorage.eu-frankfurt-1.oraclecloud.com/susr-rpo'
CACHE_DIR = '/tmp/rpo_chunks'
OUTPUT = os.path.join(BASE, 'data', 'rpo_founders.json')

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

def load_target_icos():
    """Load municipality IČOs + VÚC IČOs as the set of potential founders."""
    path = os.path.join(BASE, 'data', 'municipalities_isco.json')
    with open(path) as f:
        data = json.load(f)
    icos = set(data.keys())
    icos.update(VUC_ICOS.keys())
    return icos

def get_chunk_list():
    """Get list of init chunk files from the bucket."""
    # Use the latest init batch (2026-03-07)
    chunks = []
    for i in range(1, 24):  # 001 to 023
        chunks.append(f'init_2026-03-07_{i:03d}.json.gz')
    return chunks

def download_chunk(filename):
    """Download a chunk if not already cached."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    local_path = os.path.join(CACHE_DIR, filename)
    if os.path.exists(local_path):
        return local_path

    url = f'{BUCKET}/batch-init/{filename}'
    print(f'  Downloading {filename}...', file=sys.stderr, end=' ', flush=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'povolbach.sk/rpo-extract'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    with open(local_path, 'wb') as f:
        f.write(data)
    print(f'{len(data) // 1024 // 1024}MB', file=sys.stderr, flush=True)
    return local_path

def process_chunk(path, target_icos):
    """Process a single chunk, return list of (entity_ico, entity_name, stakeholder_ico, stakeholder_type, valid_to) tuples."""
    results = []
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        data = json.load(f)

    for entity in data['results']:
        entity_ico = entity.get('identifiers', [{}])[0].get('value', '')
        if not entity_ico:
            continue

        entity_name = entity.get('fullNames', [{}])[0].get('value', '')

        for s in entity.get('stakeholders', []):
            sid = s.get('identifier', '')
            if not sid or sid == 'Neuvedené':
                continue

            # Normalize IČO — strip spaces, pad to 8 digits
            sid_clean = sid.strip().lstrip('0') or '0'
            sid_padded = sid_clean.zfill(8)

            if sid_padded in target_icos:
                st = s.get('stakeholderType', {})
                valid_to = s.get('validTo', '')
                results.append({
                    'entity_ico': entity_ico,
                    'entity_name': entity_name,
                    'stakeholder_ico': sid_padded,
                    'stakeholder_type_code': st.get('code', ''),
                    'stakeholder_type': st.get('value', ''),
                    'stakeholder_name': s.get('fullName', ''),
                    'valid_to': valid_to,
                })

    return results

def main():
    target_icos = load_target_icos()
    print(f'Target IČOs loaded (municipalities + VÚC): {len(target_icos)}', file=sys.stderr)

    chunks = get_chunk_list()
    all_matches = []

    for i, chunk_name in enumerate(chunks):
        print(f'[{i+1}/{len(chunks)}] {chunk_name}', file=sys.stderr, end=' ', flush=True)
        path = download_chunk(chunk_name)
        matches = process_chunk(path, target_icos)
        all_matches.extend(matches)
        print(f'-> {len(matches)} matches', file=sys.stderr, flush=True)

    # Build founder lookup: for each entity, collect ALL unique municipal/VÚC
    # stakeholder IČOs. An entity can have multiple founders (joint ventures).
    # Per founder, keep the most current entry (prefer no validTo over expired).
    from collections import defaultdict

    # entity_ico -> stakeholder_ico -> best entry
    by_entity_founder = defaultdict(dict)
    for m in all_matches:
        eico = m['entity_ico']
        sico = m['stakeholder_ico']
        valid_to = m['valid_to']
        vt_clean = valid_to if valid_to and valid_to != '1800-01-01' else ''

        if sico in by_entity_founder[eico]:
            existing_vt = by_entity_founder[eico][sico]['valid_to']
            # Prefer current (no validTo) over historical
            if not existing_vt:
                continue
            if not vt_clean:
                pass  # will replace
            elif vt_clean <= existing_vt:
                continue

        by_entity_founder[eico][sico] = {
            'founder_ico': sico,
            'founder_name': m['stakeholder_name'],
            'entity_name': m['entity_name'],
            'relationship': m['stakeholder_type'],
            'valid_to': vt_clean,
        }

    # Flatten: each entity gets a list of ALL its municipal/VÚC founders
    # For single-founder entities (vast majority), output is same as before
    founders = {}
    multi_founder_count = 0
    for eico, founder_map in by_entity_founder.items():
        entries = list(founder_map.values())
        if len(entries) == 1:
            founders[eico] = entries[0]
        else:
            multi_founder_count += 1
            # Store all founders
            founders[eico] = {
                'founders': [{
                    'founder_ico': e['founder_ico'],
                    'founder_name': e['founder_name'],
                    'relationship': e['relationship'],
                    'valid_to': e['valid_to'],
                } for e in entries],
                'entity_name': entries[0]['entity_name'],
                # Primary founder: prefer current, then latest validTo
                'founder_ico': next(
                    (e['founder_ico'] for e in entries if not e['valid_to']),
                    max(entries, key=lambda e: e['valid_to'] or '')['founder_ico']
                ),
                'founder_name': next(
                    (e['founder_name'] for e in entries if not e['valid_to']),
                    max(entries, key=lambda e: e['valid_to'] or '')['founder_name']
                ),
                'relationship': next(
                    (e['relationship'] for e in entries if not e['valid_to']),
                    max(entries, key=lambda e: e['valid_to'] or '')['relationship']
                ),
                'valid_to': '',  # at least one is current if any is
            }

    print(f'\nTotal unique entities: {len(founders)}', file=sys.stderr)
    print(f'Single-founder: {len(founders) - multi_founder_count}', file=sys.stderr)
    print(f'Multi-founder (joint ventures): {multi_founder_count}', file=sys.stderr)

    # Count by relationship type
    type_counts = {}
    for info in founders.values():
        rel = info['relationship']
        type_counts[rel] = type_counts.get(rel, 0) + 1
    print('\nBy relationship type:', file=sys.stderr)
    for rel, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'  {rel}: {count}', file=sys.stderr)

    # Save — no date filter, include all (expired ownership still matters for
    # historical EU fund attribution)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(founders, f, ensure_ascii=False, indent=2)

    print(f'\nSaved {len(founders)} entries to {OUTPUT}', file=sys.stderr)

    # Verify Partizánske test case
    test_ico = '36311693'
    if test_ico in founders:
        info = founders[test_ico]
        print(f'\nTest: {test_ico} ({info["entity_name"]}) -> {info["founder_ico"]} ({info["founder_name"]}) [{info["relationship"]}]', file=sys.stderr)
    else:
        print(f'\nWARNING: Test IČO {test_ico} not found!', file=sys.stderr)

if __name__ == '__main__':
    main()
