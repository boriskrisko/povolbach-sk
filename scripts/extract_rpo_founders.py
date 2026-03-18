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

    # Build the founder lookup: for each entity, pick the CURRENT (no validTo or latest)
    # relationship to a municipality
    founders = {}
    for m in all_matches:
        eico = m['entity_ico']
        valid_to = m['valid_to']

        # Skip if we already have a "current" entry for this entity+municipality pair
        if eico in founders:
            existing = founders[eico]
            # Prefer current (no validTo) over historical
            if not existing['valid_to'] or existing['valid_to'] == 'current':
                continue
            # If new entry is current, replace
            if not valid_to or valid_to == 'current':
                pass  # will replace below
            # Otherwise keep the latest validTo
            elif valid_to <= existing['valid_to']:
                continue

        founders[eico] = {
            'founder_ico': m['stakeholder_ico'],
            'founder_name': m['stakeholder_name'],
            'entity_name': m['entity_name'],
            'relationship': m['stakeholder_type'],
            'valid_to': valid_to if valid_to and valid_to != '1800-01-01' else '',
        }

    # Filter to only CURRENT relationships (no validTo or validTo in future)
    current_founders = {}
    historical_count = 0
    for eico, info in founders.items():
        vt = info['valid_to']
        if not vt or vt >= '2024-01-01':  # Current or recent
            current_founders[eico] = {
                'founder_ico': info['founder_ico'],
                'founder_name': info['founder_name'],
                'entity_name': info['entity_name'],
                'relationship': info['relationship'],
            }
        else:
            historical_count += 1

    print(f'\nTotal unique entities with municipal stakeholder: {len(founders)}', file=sys.stderr)
    print(f'Current relationships: {len(current_founders)}', file=sys.stderr)
    print(f'Historical (expired before 2024): {historical_count}', file=sys.stderr)

    # Count by relationship type
    type_counts = {}
    for info in current_founders.values():
        rel = info['relationship']
        type_counts[rel] = type_counts.get(rel, 0) + 1
    print('\nBy relationship type:', file=sys.stderr)
    for rel, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'  {rel}: {count}', file=sys.stderr)

    # Save
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(current_founders, f, ensure_ascii=False, indent=2)

    print(f'\nSaved to {OUTPUT}', file=sys.stderr)

    # Verify Partizánske test case
    test_ico = '36311693'
    if test_ico in current_founders:
        info = current_founders[test_ico]
        print(f'\nTest: {test_ico} ({info["entity_name"]}) -> {info["founder_ico"]} ({info["founder_name"]}) [{info["relationship"]}]', file=sys.stderr)
    else:
        print(f'\nWARNING: Test IČO {test_ico} not found!', file=sys.stderr)

if __name__ == '__main__':
    main()
