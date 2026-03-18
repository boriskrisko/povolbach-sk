#!/usr/bin/env python3
"""
attribute_obecne_podniky.py
----------------------------
Find municipal enterprises (obecné podniky) in excluded_beneficiaries.json,
extract city name, match to municipality ICO, and merge into
subsidiaries_by_municipality.json.
"""

import json, re
from pathlib import Path

DATA = Path('/Users/boriskrisko/ConveyorMind/data')

T1_KW = [
    'mestský podnik', 'mestske služby', 'mestské služby', 'technické služby mesta',
    'mestské lesy', 'mestské kultúrne', 'kultúrne stredisko', 'domov dôchodcov',
    'domov pre seniorov', 'centrum sociálnych služieb', 'bytové hospodárstvo',
    'správa bytov', 'správa mestskej', 'stredisko sociálnych', 'mestský dom kultúry',
    'príspevková organizácia mesta', 'mestské centrum sociálnych',
]

# Legal form suffixes to strip from end of name
LEGAL_SUFFIXES = [
    ', spol. s r.o.', ' spol. s r.o.', ', s.r.o.', ' s.r.o.',
    ', a.s.', ' a.s.', ', n.o.', ' n.o.', ', príspevková organizácia',
    ' príspevková organizácia',
]

# Slovak locative → nominative for common city names
LOCATIVE_MAP = {
    'bratislave': 'Bratislava',
    'košiciach': 'Košice',
    'galante': 'Galanta',
    'trnave': 'Trnava',
    'sabinove': 'Sabinov',
    'jelšave': 'Jelšava',
    'revúcej': 'Revúca',
    'považskej bystrici': 'Považská Bystrica',
    'banskej štiavnici': 'Banská Štiavnica',
    'štiavnici': 'Banská Štiavnica',
    'zákamennom': 'Zákamenné',
    'zákamenné': 'Zákamenné',
    'spišskom štvrtku': 'Spišský Štvrtok',
    'spišský štvrtok': 'Spišský Štvrtok',
    'partizánskom': 'Partizánske',
    'partizánske': 'Partizánske',
}

# Manual ICO overrides for orgs where name doesn't contain a resolvable city
MANUAL_ICO = {
    '34112502': '00603481',  # Mestský podnik bytového hospodárstva → Bratislava (HQ confirmed)
    '17078202': '00691135',  # Správa mestskej zelene v Košiciach → Košice
    '31814735': '00603481',  # Stredisko sociálnych služieb Petržalka → Bratislava
}

def strip_legal(name: str) -> str:
    for suf in LEGAL_SUFFIXES:
        if name.lower().endswith(suf.lower()):
            name = name[:len(name) - len(suf)]
    return name.strip()

def extract_city_candidates(name: str) -> list[str]:
    """Return candidate city strings from org name, best first."""
    n = strip_legal(name)
    candidates = []

    # Pattern: "... mesta [City]" or "... podnik [City]" or "... obce [City]"
    for pat in [r'mesta\s+(.+)$', r'podnik\s+(.+)$', r'obce\s+(.+)$',
                r'v\s+(.+)$', r'–\s*(.+)', r'-\s*(.+)',
                r'stredisko\s+(.+)$', r'centrum\s+(.+)$']:
        m = re.search(pat, n, re.IGNORECASE)
        if m:
            cand = m.group(1).strip()
            # Skip if it still looks like a keyword phrase
            if len(cand.split()) <= 4 and not any(
                kw in cand.lower() for kw in ['mestský', 'mestské', 'technické', 'sociálnych', 'kultúrne']
            ):
                candidates.append(cand)

    # Last 1-3 words of stripped name
    words = n.split()
    for n_words in [3, 2, 1]:
        if len(words) >= n_words:
            candidates.append(' '.join(words[-n_words:]))

    return candidates

def lookup_muni(candidate: str, name_to_ico: dict) -> str | None:
    """Try to find municipality ICO for a candidate city name."""
    # Direct
    c = candidate.lower()
    if c in name_to_ico:
        return name_to_ico[c]

    # Locative map
    if c in LOCATIVE_MAP:
        city = LOCATIVE_MAP[c].lower()
        if city in name_to_ico:
            return name_to_ico[city]

    # Try stripping common Slovak locative endings
    for strip in ['iach', 'ách', 'och', 'ove', 'ave', 'eje', 'ou', 'ej', 'om', 'e', 'a']:
        if c.endswith(strip) and len(c) > len(strip) + 3:
            base = c[:-len(strip)]
            if base in name_to_ico:
                return name_to_ico[base]
            # Try adding common nominative endings
            for add in ['', 'a', 'o', 'y']:
                if base + add in name_to_ico:
                    return name_to_ico[base + add]

    return None

def main():
    with open(DATA / 'excluded_beneficiaries.json') as f:
        excl = json.load(f)

    with open(DATA / 'municipalities_isco.json') as f:
        muni_isco = json.load(f)

    with open(DATA / 'subsidiaries_by_municipality_14.json') as f:
        subs = json.load(f)

    with open(DATA / 'municipal_stats_14.json') as f:
        muni_stats = json.load(f)

    # Build name → ICO lookup
    name_to_ico: dict[str, str] = {}
    for ico, m in muni_isco.items():
        on = m.get('official_name', '')
        name_to_ico[on.lower()] = ico
        for p in ['obec ', 'mesto ', 'mestská časť ']:
            if on.lower().startswith(p):
                name_to_ico[on.lower()[len(p):]] = ico

    # Filter obecné podniky
    t1 = [e for e in excl if any(kw.lower() in e['name'].lower() for kw in T1_KW)]
    print(f'Obecné podniky found: {len(t1)}, total EUR: €{sum(e["total_contracted_eur"] for e in t1)/1e6:.1f}M')

    matched, unmatched = [], []
    total_matched_eur = 0.0

    for e in t1:
        ico = e['ico']
        name = e['name']
        eur = e['total_contracted_eur'] or 0

        # Manual overrides first
        muni_ico = MANUAL_ICO.get(ico)

        if not muni_ico:
            candidates = extract_city_candidates(name)
            for cand in candidates:
                muni_ico = lookup_muni(cand, name_to_ico)
                if muni_ico:
                    break

        if muni_ico and muni_ico in muni_stats:
            # Merge into subsidiaries
            if muni_ico not in subs:
                subs[muni_ico] = {
                    'ico': muni_ico,
                    'municipality': muni_stats[muni_ico].get('official_name', ''),
                    'subsidiary_orgs': [],
                    'subsidiary_total_eur': 0,
                }
            # Avoid duplicates
            existing_icos = {o['ico'] for o in subs[muni_ico]['subsidiary_orgs']}
            if ico not in existing_icos:
                subs[muni_ico]['subsidiary_orgs'].append({
                    'ico': ico,
                    'name': name,
                    'total_contracted_eur': eur,
                    'projects_count': e.get('projects_count', 0),
                })
                subs[muni_ico]['subsidiary_total_eur'] = (subs[muni_ico].get('subsidiary_total_eur', 0) or 0) + eur
                matched.append((ico, name, eur, muni_ico, muni_stats[muni_ico].get('official_name','')))
                total_matched_eur += eur
        else:
            unmatched.append((ico, name, eur))

    with open(DATA / 'subsidiaries_by_municipality_14.json', 'w', encoding='utf-8') as f:
        json.dump(subs, f, ensure_ascii=False, indent=2)

    # Append to attribution log
    with open(DATA / 'attribution_log.txt', 'a', encoding='utf-8') as f:
        f.write('\n\n=== OBECNÝ PODNIK ATTRIBUTION ===\n')
        f.write(f'Matched: {len(matched)}, Unmatched: {len(unmatched)}\n')
        f.write(f'Total matched EUR: €{total_matched_eur/1e6:.1f}M\n\n')
        f.write('MATCHED:\n')
        for ico, name, eur, mico, mname in matched:
            f.write(f'  {ico} {name[:50]:50} → {mname} (€{eur/1e6:.1f}M)\n')
        f.write('\nOBECNY_PODNIK_UNMATCHED:\n')
        for ico, name, eur in unmatched:
            f.write(f'  OBECNY_PODNIK_UNMATCHED\t{ico}\t{name}\t€{eur/1e6:.2f}M\n')

    print(f'\nMatched: {len(matched)}, Total EUR attributed: €{total_matched_eur/1e6:.1f}M')
    print('Matched entries:')
    for ico, name, eur, mico, mname in matched:
        print(f'  {name[:45]:45} → {mname} €{eur/1e6:.1f}M')
    print(f'\nUnmatched ({len(unmatched)}):')
    for ico, name, eur in unmatched:
        print(f'  {name[:60]} €{eur/1e6:.2f}M')

if __name__ == '__main__':
    main()
