# povolbach.sk — Monorepo Overview

> This repo contains the **povolbach.sk** public dashboard, shared data pipeline, and reference docs. Two related projects live in separate repos.

---

## Three Projects

| Project | URL | Repo | Location |
|---------|-----|------|----------|
| **povolbach.sk** (public dashboard) | https://povolbach.sk | `boriskrisko/povolbach-sk` (this repo) | `frontend/` |
| **dev.povolbach.sk** (internal ops dashboard) | https://dev.povolbach.sk | `boriskrisko/povolbach-dev` (separate) | `dashboard/` is a separate git context |
| **portal.povolbach.sk** (SaaS V0 — call alerts) | https://portal.povolbach.sk | `boriskrisko/povolbach-sk` (this repo) | `portal/` |

---

## Folder Structure

```
/
├── CLAUDE.md                  # This file — monorepo overview
├── frontend/                  # povolbach.sk public dashboard (Next.js)
│   └── CLAUDE.md              # Frontend-specific context
├── portal/                    # portal.povolbach.sk SaaS V0 (Next.js + Supabase)
│   └── CLAUDE.md              # Portal-specific context
├── dashboard/                 # dev.povolbach.sk (SEPARATE GIT REPO — boriskrisko/povolbach-dev)
│   └── CLAUDE.md              # Dashboard-specific context
├── data/                      # Shared data files (ITMS, RPO, municipal stats)
├── scripts/                   # Shared Python pipeline scripts
├── docs/                      # Project docs, specs, PDFs
│   ├── PROJECT_STATUS_REPORT.md
│   ├── PORTAL_README.md       # Portal SaaS spec overview
│   ├── PoVolbach_sk_Master_Plan_v2.pdf
│   ├── API cheatsheet.pdf
│   └── START-HERE.md
├── fetch_itms.py              # ITMS2014+ data fetcher
├── fetch_itms21.py            # ITMS2021+ data fetcher
└── match_municipalities.py    # Municipality ↔ IČO matching
```

---

## Shared Data Pipeline

All three projects share the same underlying data. The pipeline runs from repo root:

```bash
python3 fetch_itms.py                              # 2014-2020
python3 fetch_itms21.py                            # 2021-2027
python3 match_municipalities.py                    # IČO matching
python3 scripts/attribute_subsidiaries.py --period 14
python3 scripts/attribute_subsidiaries.py --period 21
python3 scripts/find_indirect_projects.py --period 14
python3 scripts/find_indirect_projects.py --period 21
python3 scripts/build_mikroregiony.py
python3 scripts/build_frontend_public.py           # → frontend/public/*.json
```

Output lands in `data/` (intermediate) and `frontend/public/` (final JSON for the dashboard).

---

## Universal Rules — Apply to ALL Projects

### Period identifiers: `_14` and `_21` ONLY — HARD RULE
- **File suffixes:** `_14` for 2014–2020, `_21` for 2021–2027
- **Internal period values in code:** `'14'` and `'21'`
- NEVER use: `_1420`, `_2127`, `'1420'`, `'2127'`, or any other format
- Display strings like `"2014–2020"` and `"2021–2027"` are fine for UI text

### IČO-only joins
IČO = Slovak company/entity registration number. The ONLY join key in this project.
- NEVER match or deduplicate by name
- NEVER use fuzzy matching on names

### Framing
Efficiency and opportunity to improve — NOT shaming. Municipalities are future customers.

### No cross-period contamination
Each period's data is independent.

---

## Tech Preferences

- **Python 3.10+**, stdlib preferred, `httpx` for async
- **No pandas** for simple transforms — plain dicts/lists
- **JSON pretty-printed** (indent=2) for all data/ output files
- **UTF-8** everywhere — Slovak diacritics: ď, š, č, ž, ľ, ŕ, ĺ, ä, ô, í, á, é, ú, ý, ó
- **Next.js App Router** with server components for metadata, client components for interactivity

## Autonomy Rules

1. **Never ask for clarification on the IČO rule** — it is final
2. **Self-heal on API errors** — 429 → wait and retry, timeout → retry up to 3x, 404 → skip
3. **Always check for cache files before fetching** — resumability is core
4. **Never block on ambiguity** — conservative choice, document in validation_report.txt
5. **Log progress** — stderr + log files, counts at every step

*Last updated: 2026-03-24*
