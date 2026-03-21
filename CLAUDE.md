# povolbach.sk — Project Context for Claude Code

> Read this file at the start of every session.

---

## What we're building

**povolbach.sk** — free public dashboard showing how well Slovak municipalities absorb EU funds.

- **Stage 1 (current):** Public dashboard. Data from ITMS2014+ and ITMS2021+ Open Data APIs. Framing is *efficiency* (opportunity to improve), NOT shaming.
- **Stage 2 (future):** Paid SaaS — municipal EU project management tool.

**Target:** $100K+/month in 18–24 months.
**Stack:** Python data pipeline → static JSON → Next.js 16.1.7 / React / Tailwind CSS
**Hosting:** Vercel (serverless + edge). Live at https://povolbach.sk
**Founder:** Based in Košice, member of Progressive Slovakia.

---

## Architecture Rules — NON-NEGOTIABLE

### Period identifiers: `_14` and `_21` ONLY — HARD RULE
- **File suffixes:** `_14` for 2014–2020, `_21` for 2021–2027
- **Internal period values in code:** `'14'` and `'21'`
- ❌ **NEVER use:** `_1420`, `_2127`, `'1420'`, `'2127'`, or any other format
- This applies to: file names, JSON keys, variable names, string comparisons, URL parameters, translation keys, function names — **EVERYWHERE**
- ✅ Display strings like `"2014–2020"` and `"2021–2027"` are fine for UI text shown to users
- ✅ System names `"ITMS2014+"` and `"ITMS2021+"` are fine — these are official names, not period identifiers

### IČO-only joins
**IČO = Slovak company/entity registration number. The ONLY join key in this project.**
- ✅ Join by IČO
- ✅ Display names (from registers or API responses)
- ❌ NEVER match or deduplicate by name
- ❌ NEVER use fuzzy matching on names

### No cross-period contamination
Each period's data is independent. Clear period-specific data before regenerating.

### Static JSON architecture
No external DB in Stage 1. All data is pre-computed JSON served as static files.

---

## Data Pipeline

### How to run a full data refresh

```bash
# 1. Fetch raw data from ITMS APIs
python3 fetch_itms.py          # 2014-2020 (resumable, ~20 min first run)
python3 fetch_itms21.py        # 2021-2027 (resumable)

# 2. Match municipalities to IČO register
python3 match_municipalities.py

# 3. Attribute subsidiary organizations via RPO
python3 scripts/attribute_subsidiaries.py --period 14
python3 scripts/attribute_subsidiaries.py --period 21

# 4. Map state/indirect projects to municipalities
python3 scripts/find_indirect_projects.py --period 14
python3 scripts/find_indirect_projects.py --period 21

# 5. Build mikroregión stats
python3 scripts/build_mikroregiony.py

# 6. Merge + slim → frontend/public/
python3 scripts/build_frontend_public.py

# 7. Generate full-detail files for PDF export
# (run the Python snippet from the session that creates municipal_details_*.json and vuc_details_*.json)
```

### Pipeline scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `fetch_itms.py` | 6-step ITMS2014+ pipeline | `data/aggregated_by_beneficiary_14.json`, `data/irregularities_by_ico_14.json` |
| `fetch_itms21.py` | ITMS2021+ pipeline | `data/aggregated_by_beneficiary_21.json` |
| `match_municipalities.py` | IČO-based municipality matching + RPO lookup | `data/municipal_stats_14.json`, `data/municipalities_ico.json` |
| `scripts/build_frontend_public.py` | Merge + slim to top 5 projects | `frontend/public/municipal_stats_*.json`, `frontend/public/vuc_stats_*.json` |
| `scripts/attribute_subsidiaries.py` | RPO founder → municipality/VÚC attribution | `data/subsidiaries_by_municipality_*.json`, `data/subsidiaries_by_vuc_*.json` |
| `scripts/find_indirect_projects.py` | State project geo-mapping | `data/indirect_by_municipality_*.json` |
| `scripts/build_mikroregiony.py` | Inter-municipal cooperation stats | `data/mikroregiony_stats_*.json` |

---

## Frontend Structure

```
frontend/src/
├── app/
│   ├── page.tsx               # Server component — generateMetadata() for OG tags
│   ├── ClientPage.tsx         # Client component — DataProvider, deep-links, modals
│   ├── layout.tsx             # Root layout (metadataBase)
│   └── api/og/route.tsx       # OG image generation (edge, param-based)
├── components/
│   ├── HeroSearch.tsx         # Hero + diacritics search + global period toggle
│   ├── MunicipalityModal.tsx  # Municipality detail — comparison, local toggle, sharing, PDF
│   ├── VucModal.tsx           # VÚC detail — same pattern as municipality
│   ├── VucSection.tsx         # VÚC card grid + deep-link (?vuc=)
│   ├── MikroregiónySection.tsx # Mikroregión cards + modal with period toggle
│   ├── Leaderboard.tsx        # Top/bottom 10 rankings
│   ├── SlovakiaMap.tsx        # Interactive GPS dot map
│   ├── StatsContext.tsx       # Global aggregate stats
│   ├── ViewModeToggle.tsx     # Total / Per Capita
│   └── Footer.tsx
└── lib/
    ├── DataContext.tsx         # Period cache (both periods pre-fetched)
    ├── generatePdf.ts         # PDF export via window.print()
    ├── translations.ts        # SK/EN translations
    ├── types.ts               # TypeScript interfaces
    └── utils.ts               # Formatters, search functions
```

### Data flow
1. `DataContext` loads `municipal_stats_14.json` immediately, pre-fetches `_21` in background
2. Both periods cached in `useRef` — switching is instant
3. `VucSection` independently fetches `vuc_stats_14.json` + `_21.json`
4. `MikroregiónySection` independently fetches both mikroregión files
5. Modals access both periods via `getDataForPeriod()` from DataContext (municipalities) or props (VÚC)
6. PDF export fetches `municipal_details_*.json` or `vuc_details_*.json` on-demand (full project lists)

### Frontend public data files

| File | Size | Content |
|------|------|---------|
| `municipal_stats_14.json` | 4.8 MB | 2,928 municipalities, top 5 projects each |
| `municipal_stats_21.json` | 1.4 MB | 2,928 municipalities, top 5 projects each |
| `municipal_details_14.json` | 5.4 MB | ALL projects per municipality (for PDF) |
| `municipal_details_21.json` | 361 KB | ALL projects per municipality (for PDF) |
| `vuc_stats_14.json` | 29 KB | 8 VÚCs, top 5 projects each |
| `vuc_stats_21.json` | 15 KB | 8 VÚCs, top 5 projects each |
| `vuc_details_14.json` | 245 KB | ALL projects per VÚC (for PDF) |
| `vuc_details_21.json` | 37 KB | ALL projects per VÚC (for PDF) |
| `mikroregiony_stats_14.json` | 19 KB | Inter-municipal cooperation by category |
| `mikroregiony_stats_21.json` | 4 KB | Inter-municipal cooperation by category |

---

## What's Done ✅

- [x] Both programming periods (2014-2020, 2021-2027) with full data
- [x] Period comparison tables in all modals (side-by-side total, projects, per capita)
- [x] Local period toggles in Municipality, VÚC, and Mikroregióny modals
- [x] Deep-links: `?ico={ico}&obdobie=14|21` and `?vuc={ico}&obdobie=14|21`
- [x] Server-side OG meta tags via `generateMetadata()` (visible to crawlers)
- [x] OG image generation at `/api/og` (edge runtime, param-based, no file reads)
- [x] Sharing: Share (navigator.share), Copy link, Facebook, Threads
- [x] PDF export via window.print() with on-demand full detail fetch
- [x] Diacritics-aware search with keyboard navigation
- [x] Interactive Slovakia GPS dot map
- [x] Leaderboard (top/bottom 10, total/per-capita toggle)
- [x] 8 VÚC (regional governments) with projects + subsidiaries
- [x] Mikroregióny (inter-municipal cooperation) by 4 categories
- [x] RPO-based subsidiary attribution with proportional joint venture splits
- [x] Indirect/state projects mapped to municipalities by geography
- [x] Irregularities per municipality and VÚC
- [x] Bilingual SK/EN translations
- [x] Per capita toggle for rankings
- [x] Responsive design (mobile + desktop)

---

## Known Issues / Technical Debt

- Safari macOS: PDF title requires two-phase document.write (loading placeholder → full content)
- No automated data refresh pipeline (manual Python script re-runs)
- No tests (unit or e2e)
- _21 indirect projects use project name→municipality matching (ITMS21 API lacks NUTS5 location data)
- ~280/308 multi-founder subsidiary entities use equal 1/N split (RPO deposit data unavailable for those)
- ITMS2021+ fetch uses offset-based pagination (slow); could switch to minId cursor

---

## TODO — Future Work

- [ ] Historical population data from ŠÚSR DATAcube (currently static 2024 population)
- [ ] Multi-municipality project split by population proportion
- [ ] GitHub Actions for automated weekly data refresh
- [ ] E2E tests (Playwright)
- [ ] Stage 2: paid SaaS for municipality project management
- [ ] Potential funding / open calls feature
- [ ] Instagram sharing support

---

## Tech Preferences

- **Python 3.10+**, stdlib preferred, `httpx` or `aiohttp` for async
- **No pandas** for simple transforms — plain dicts/lists
- **JSON pretty-printed** (indent=2) for all data/ output files
- **UTF-8** everywhere — Slovak diacritics: ď, š, č, ž, ľ, ŕ, ĺ, ä, ô, í, á, é, ú, ý, ó
- **No external DB** in Stage 1 — flat JSON files only
- **Next.js App Router** with server components for metadata, client components for interactivity

## Autonomy Rules

1. **Never ask for clarification on the IČO rule** — it is final
2. **Self-heal on API errors** — 429 → wait and retry, timeout → retry up to 3x, 404 → skip
3. **Always check for cache files before fetching** — resumability is core
4. **Never block on ambiguity** — conservative choice, document in validation_report.txt
5. **Log progress** — stderr + log files, counts at every step

*Last updated: 2026-03-21*
