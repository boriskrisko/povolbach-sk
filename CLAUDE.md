# povolbach.sk — Project Context for Claude Code

> Read this file at the start of every session. It contains everything you need to work autonomously without asking for background.

---

## What we're building

**povolbach.sk** is a two-stage product:

- **Stage 1 (current):** Free public dashboard showing how well Slovak municipalities absorb EU funds. Data comes from ITMS2014+ Open Data API. Framing is *efficiency* (opportunity to improve), NOT shaming.
- **Stage 2 (future):** Paid SaaS — municipal EU project management tool. Stage 1 builds the audience; Stage 2 monetises it.

**Target:** $100K+/month in 18–24 months.
**Stack:** Python data pipeline → static JSON → Next.js/React frontend.
**Founder:** Based in Košice, member of Progressive Slovakia.

---

## Data source

**API:** ITMS2014+ Open Data
- Base URL: `https://opendata.itms2014.sk/v2/`
- Key endpoints: `/projektoveUkoncene`, `/projektoveVrealizacii`, `/projekt/{id}`, `/subjekt/{id}`, `/ciselnik/nuts5`, `/nezrovnalosti`
- Rate limits: ~20 concurrent requests safe, retry on 429/timeout
- All requests are GET, no auth required

---

## File structure

```
/
├── CLAUDE.md                          ← you are here
├── fetch_itms.py                      ← main data pipeline
├── match_municipalities.py            ← IČO-based municipality matching (IN PROGRESS)
├── data/
│   ├── raw_project_lists.json         ← paginated project IDs (step 1 cache)
│   ├── raw_project_details/           ← individual project JSONs (step 2 cache)
│   │   ├── ukoncene_{id}.json
│   │   └── vrealizacii_{id}.json
│   ├── raw_nuts_names.json            ← NUTS5 code → municipality name (step 3 cache)
│   ├── raw_subjects.json              ← subject ID → name/address/GPS/municipality (step 4 cache)
│   ├── aggregated_by_beneficiary.json ← main output: per-IČO aggregated stats (step 5)
│   ├── irregularities_by_ico.json     ← irregularities per IČO (step 6)
│   ├── municipality_icos.json         ← official Slovak municipality IČO register ← NEEDS CREATION
│   ├── municipal_eu_stats.json        ← filtered + enriched municipal data ← NEEDS CREATION
│   └── validation_report.txt          ← matching QA report ← NEEDS CREATION
└── frontend/                          ← Next.js app (not yet built)
```

---

## The IČO rule — CRITICAL

**IČO = Slovak company/entity registration number. It is the only join key used anywhere in this project.**

- ✅ Join by IČO
- ✅ Display names (from registers or API responses)
- ❌ NEVER match or deduplicate by name (names have typos, abbreviations, encoding issues)
- ❌ NEVER use fuzzy matching on names

This rule exists because name-based matching produced collisions and false matches in early testing. Every join, filter, and aggregation in the pipeline must use IČO as the primary key.

---

## Pipeline overview (fetch_itms.py)

| Step | What it does | Cache file |
|------|-------------|-----------|
| 1 | Fetch project IDs from both endpoints with `minId` pagination | `data/raw_project_lists.json` |
| 2 | Fetch each project detail (20 concurrent, retry on 429) | `data/raw_project_details/{endpoint}_{id}.json` |
| 3 | Resolve NUTS5 codes → municipality names | `data/raw_nuts_names.json` |
| 4 | Resolve subject IDs → name, address, GPS, municipality | `data/raw_subjects.json` |
| 5 | Aggregate by IČO: name, location, active/completed counts, total contracted | `data/aggregated_by_beneficiary.json` |
| 6 | Fetch all irregularities, group by debtor IČO | `data/irregularities_by_ico.json` |

**Resumability:** Steps 2–4 cache individual files. Re-running skips already-fetched records. Always check if a cache file exists before re-fetching.

---

## Municipality matching (match_municipalities.py) — CURRENT TASK

This script takes `aggregated_by_beneficiary.json` and filters it down to only Slovak municipalities, enriched with official register data.

### Input
- `data/aggregated_by_beneficiary.json` — all beneficiaries from ITMS (IČO as key)
- `data/municipality_icos.json` — official Slovak municipality IČO list (must be sourced or created)

### Output
- `data/municipal_eu_stats.json` — municipalities only, with full stats
- `data/validation_report.txt` — QA summary

### Municipality IČO source
Slovak municipality IČOs are public. Authoritative sources:
1. **REGOB register** (registerUO.sk or data.gov.sk) — official list of self-governing units
2. **ITMS data itself** — beneficiaries with `pravnaForma` == `Obec` or `Mesto`
3. **Manually curated list** — fallback if neither above is available

The script must fetch or load this list, then do a pure IČO intersection — no name matching at any point.

### Logic
```python
# CORRECT approach
municipal_stats = {
    ico: aggregated_data[ico]
    for ico in municipality_icos
    if ico in aggregated_data
}

# WRONG — never do this
for name in municipality_names:
    match = find_similar(name, all_beneficiary_names)  # ← forbidden
```

### Edge cases to handle
- Municipality IČO in register but NOT in ITMS data → include with zero values, not excluded
- ITMS beneficiary is a municipal organisation (school, etc.) not the municipality itself → exclude from V1
- IČO in ITMS but not in municipality register → not a municipality, exclude
- Always output counts of each category in `validation_report.txt`

### validation_report.txt must contain
```
Total municipalities in register: X
Municipalities matched in ITMS: X
Municipalities with €0 absorption: X
Excluded (org not in register): X
Excluded (name-based match attempt detected): 0  ← should always be 0
IČO collisions or anomalies: X
Top 10 municipalities by total contracted: [list]
Bottom 10 matched municipalities by total contracted: [list]
```

---

## Key data shapes

### aggregated_by_beneficiary.json entry
```json
{
  "12345678": {
    "ico": "12345678",
    "name": "Obec Rimavská Sobota",
    "address": "...",
    "municipality": "Rimavská Sobota",
    "nuts5_code": "SK041...",
    "gps_lat": 48.38,
    "gps_lon": 20.01,
    "active_projects": 3,
    "completed_projects": 7,
    "total_contracted_eur": 1250000.00,
    "total_contracted_amended_eur": 1180000.00,
    "projects": [...]
  }
}
```

### municipality_icos.json (target shape)
```json
{
  "12345678": {
    "ico": "12345678",
    "official_name": "Obec Rimavská Sobota",
    "nuts5_code": "SK041...",
    "region": "Banskobystrický kraj",
    "district": "Rimavská Sobota",
    "population": 24000,
    "type": "mesto"
  }
}
```

---

## Autonomy rules for Claude Code

When working on this project, Claude Code should:

1. **Never ask for clarification on the IČO rule** — it is final and non-negotiable
2. **Self-heal on API errors** — 429 → wait and retry, timeout → retry up to 3x, 404 → log and skip
3. **Always check for cache files before fetching** — resumability is a core requirement
4. **When a source file is missing**, log clearly what's missing and why, then create it from available data or output a clear error
5. **Never block on ambiguity** — make the conservative choice (exclude rather than include uncertain records), document it in `validation_report.txt`, and continue
6. **Log progress to stderr and a log file** (`data/match_log.txt`)
7. **Output counts at every major step** — how many records in, how many out, how many excluded and why

---

## What's done ✅

- [x] ITMS2014+ API explored and documented
- [x] `fetch_itms.py` — 6-step pipeline written and tested
- [x] IČO-only join rule established
- [x] Data shapes defined

## What's in progress 🔄

- [ ] `match_municipalities.py` — IČO-based municipality filter + enrichment
- [ ] `data/municipality_icos.json` — need to source official Slovak municipality IČO list

## What's next ⏳

- [ ] `data/municipal_eu_stats.json` — clean output for frontend
- [ ] Frontend: Next.js dashboard (municipality cards, search, map view)
- [ ] Deploy: Vercel (frontend) + GitHub Actions (weekly data refresh)

---

## Tech preferences

- **Python 3.10+**, stdlib preferred, `httpx` or `aiohttp` for async if needed
- **No pandas** for simple transforms — plain dicts/lists are fine
- **JSON pretty-printed** (indent=2) for all output files
- **UTF-8** everywhere — Slovak has ď, š, č, ž, ľ, ŕ, etc.
- **No external DB** in Stage 1 — flat JSON files only

---

## Post-Launch Roadmap

### V1 (current) — Option A: Disclaimer
Municipality pages show direct funding only.
Every municipality card/page includes a note:
"Zahŕňa len priame čerpanie. Nezahŕňa financovanie škôl, kultúrnych zariadení 
a iných organizácií v zriaďovateľskej pôsobnosti obce."

### V1.1 — Option C: Subsidiary org rollup ← DO NOT FORGET
For each municipality, show a secondary line:
"+ N organizácie v zriaďovateľskej pôsobnosti (€X.XM)" — clickable to breakdown.

Data work required:
1. Take excluded_beneficiaries.json (5,746 non-municipality beneficiaries, €22.9B)
2. For each, query RPO API for zakladateľ (founder IČO)
3. If zakladateľ IČO matches a municipality in municipalities_isco.json → 
   tag as municipal subsidiary
4. Aggregate per municipality: count of orgs + total contracted EUR
5. Add subsidiary_orgs array and subsidiary_total_eur field to municipal_stats.json

This gives genuinely unique data no Slovak platform has. Build after first public launch.

---

## Pipeline Notes

### ITMS2021+ fetch performance
The 2021-2027 pipeline (fetch_itms21.py) currently uses offset-based pagination for resume 
(slow ~5 min/1k projects). If re-running from scratch, switch to minId cursor approach 
(same as fetch_itms.py) for significantly faster fetching.

*Last updated: March 2026*
