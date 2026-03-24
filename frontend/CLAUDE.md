# povolbach.sk — Public Dashboard

> Free public dashboard showing how well Slovak municipalities absorb EU funds.
> Live at https://povolbach.sk

**Stack:** Python data pipeline → static JSON → Next.js 16.1.7 / React / Tailwind CSS → Vercel
**Repo:** `boriskrisko/povolbach-sk`
**Architecture:** No external DB. All data is pre-computed JSON served as static files.

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

## Data Flow

1. `DataContext` loads `municipal_stats_14.json` immediately, pre-fetches `_21` in background
2. Both periods cached in `useRef` — switching is instant
3. `VucSection` independently fetches `vuc_stats_14.json` + `_21.json`
4. `MikroregiónySection` independently fetches both mikroregión files
5. Modals access both periods via `getDataForPeriod()` from DataContext (municipalities) or props (VÚC)
6. PDF export fetches `municipal_details_*.json` or `vuc_details_*.json` on-demand (full project lists)

## Public Data Files

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

## Data Pipeline

Run from repo root (not from `frontend/`):

```bash
python3 fetch_itms.py                              # 2014-2020 (resumable, ~20 min first run)
python3 fetch_itms21.py                            # 2021-2027 (resumable)
python3 match_municipalities.py                    # IČO matching
python3 scripts/attribute_subsidiaries.py --period 14
python3 scripts/attribute_subsidiaries.py --period 21
python3 scripts/find_indirect_projects.py --period 14
python3 scripts/find_indirect_projects.py --period 21
python3 scripts/build_mikroregiony.py
python3 scripts/build_frontend_public.py           # → frontend/public/*.json
```

## Features

- 2,928 municipality scorecards with EU fund absorption data
- Both programming periods (2014–2020 and 2021–2027)
- Period comparison tables in all modals (side-by-side)
- Deep-links: `?ico={ico}&obdobie=14|21` and `?vuc={ico}&obdobie=14|21`
- OG meta tags + image generation for sharing
- Sharing: navigator.share, Copy link, Facebook, Threads
- PDF export via window.print() with full project lists
- Diacritics-aware search with keyboard navigation
- Interactive Slovakia GPS dot map
- Leaderboard (top/bottom 10, total/per-capita toggle)
- 8 VÚC (regional governments) with projects + subsidiaries
- Mikroregióny (inter-municipal cooperation) by 4 categories
- RPO-based subsidiary attribution with proportional joint venture splits
- Indirect/state projects mapped to municipalities by geography
- Irregularities per municipality and VÚC
- Bilingual SK/EN translations
- Per capita toggle for rankings
- Responsive design (mobile + desktop)

## Known Issues

- Safari macOS: PDF title requires two-phase document.write
- No automated data refresh pipeline (manual Python script re-runs)
- No tests (unit or e2e)
- _21 indirect projects use project name → municipality matching (ITMS21 API lacks NUTS5 location data)
- ~280/308 multi-founder subsidiary entities use equal 1/N split (RPO deposit data unavailable)
- ITMS2021+ fetch uses offset-based pagination (slow); could switch to minId cursor

## Architecture Rules

See root `CLAUDE.md` for universal rules: `_14`/`_21` suffixes, IČO-only joins, no cross-period contamination, efficiency framing.

*Last updated: 2026-03-24*
