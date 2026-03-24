# povolbach.sk — Project Status Report

**Generated:** 2026-03-20
**Live URL:** https://povolbach.sk
**Stack:** Python data pipeline → static JSON → Next.js 16.1.7 / React / Tailwind CSS
**Hosting:** Vercel (serverless + edge)

---

## File Structure

```
povolbach/
├── CLAUDE.md                          # Project context for Claude Code
├── fetch_itms.py                      # 2014-2020 ITMS data pipeline (6 steps)
├── fetch_itms21.py                    # 2021-2027 ITMS data pipeline
├── match_municipalities.py            # IČO-based municipality matching + RPO lookup
├── scripts/
│   ├── build_frontend_public.py       # Merge + slim data → frontend/public/
│   ├── attribute_subsidiaries.py      # RPO-based subsidiary attribution
│   ├── find_indirect_projects.py      # State project geo-mapping
│   ├── build_mikroregiony.py          # Mikroregión stats aggregation
│   ├── extract_rpo_founders.py        # RPO founder extraction from S3 dump
│   └── validate_against_transparency.py
├── data/                              # Raw + processed data (not deployed)
│   ├── aggregated_by_beneficiary_14.json / _21.json
│   ├── municipal_stats_14.json / _21.json
│   ├── vuc_stats_14.json / _21.json
│   ├── mikroregiony_stats_14.json / _21.json
│   ├── irregularities_by_ico_14.json / _21.json
│   ├── subsidiaries_by_municipality_14.json / _21.json
│   ├── subsidiaries_by_vuc_14.json / _21.json
│   ├── indirect_by_municipality_14.json / _21.json
│   ├── municipalities_ico.json
│   └── rpo_founders.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx               # Server component — generateMetadata()
    │   │   ├── ClientPage.tsx         # Client component — main app logic
    │   │   ├── layout.tsx             # Root layout
    │   │   └── api/og/route.tsx       # OG image (edge, param-based)
    │   ├── components/
    │   │   ├── HeroSearch.tsx         # Hero + search + global period toggle
    │   │   ├── MunicipalityModal.tsx  # Municipality detail modal
    │   │   ├── VucModal.tsx           # VÚC detail modal
    │   │   ├── VucSection.tsx         # VÚC grid + deep-link
    │   │   ├── MikroregiónySection.tsx # Mikroregión cards + modal
    │   │   ├── Leaderboard.tsx        # Top/bottom rankings
    │   │   ├── SlovakiaMap.tsx        # Interactive GPS map
    │   │   ├── StatsContext.tsx       # Global stats
    │   │   ├── ViewModeToggle.tsx     # Total / Per Capita
    │   │   └── Footer.tsx
    │   └── lib/
    │       ├── DataContext.tsx         # Period cache + switching
    │       ├── generatePdf.ts         # PDF export (window.print)
    │       ├── translations.ts        # SK/EN
    │       ├── types.ts               # Interfaces
    │       └── utils.ts               # Formatters, search
    └── public/
        ├── municipal_stats_14.json    # 4.8 MB (top 5 projects)
        ├── municipal_stats_21.json    # 1.4 MB
        ├── municipal_details_14.json  # 5.4 MB (ALL projects for PDF)
        ├── municipal_details_21.json  # 361 KB
        ├── vuc_stats_14.json          # 29 KB (top 5 projects)
        ├── vuc_stats_21.json          # 15 KB
        ├── vuc_details_14.json        # 245 KB (ALL projects for PDF)
        ├── vuc_details_21.json        # 37 KB
        ├── mikroregiony_stats_14.json # 19 KB
        └── mikroregiony_stats_21.json # 4 KB
```

---

## Frontend Components

| Component | Purpose | Data |
|-----------|---------|------|
| `page.tsx` | Server-side `generateMetadata()` for per-entity OG tags | readFileSync from public/ |
| `ClientPage.tsx` | DataProvider, deep-links (?ico=, ?vuc=), modal state | DataContext |
| `HeroSearch.tsx` | Hero, search (diacritics-aware), global period toggle | DataContext |
| `MunicipalityModal.tsx` | Comparison table, local toggle, sharing, PDF | Both periods cached |
| `VucModal.tsx` | Same as municipality modal (comparison, toggle, PDF) | Props + both periods |
| `VucSection.tsx` | VÚC card grid, fetches both periods, ?vuc= deep-link | vuc_stats_14/21.json |
| `MikroregiónySection.tsx` | Category cards + modal with period toggle | mikroregiony_stats_14/21.json |
| `Leaderboard.tsx` | Top/bottom 10 by total or per-capita | DataContext |
| `SlovakiaMap.tsx` | GPS dot map, color by absorption | DataContext |
| `api/og/route.tsx` | 1200×630 OG image, edge runtime, URL params | No file reads |
| `generatePdf.ts` | PDF via window.print(), fetches detail JSONs on-demand | municipal_details + vuc_details |
| `DataContext.tsx` | Caches both periods, pre-fetches _21 after _14 | municipal_stats_14/21.json |

---

## Key Features

- **2,928 municipalities** across 2 programming periods
- **8 VÚC** (regional governments) with full project + subsidiary data
- **Period comparison** — side-by-side table in every modal
- **Local period toggle** — modals switch independently of global dashboard
- **Deep-links** — `?ico={ico}&obdobie=14|21` and `?vuc={ico}&obdobie=14|21`
- **Server-side OG** — `generateMetadata()` for Threads/Facebook crawlers
- **OG images** — `/api/og?name=&total=&projects=` edge-rendered PNG
- **Sharing** — Share, Copy link, Facebook, Threads buttons
- **PDF export** — print-ready HTML with ALL projects (fetched on-demand)
- **Search** — diacritics-flexible, keyboard navigable
- **Map** — GPS dot map of all municipalities

---

## Last 10 Commits

```
cfe3625 Fix modal centering — use left/right/margin-auto instead of transform
0ea1d9d Fix modal horizontal centering
9377873 Fix mikroregióny modal layout, anchor all modals to top
7f5655a Fix Safari macOS PDF window — focus before print
51dfc0e Fix Safari PDF title — write title synchronously before async fetch
ca663ae Fix Safari PDF title — use HTML title tag only, no document.title
d204315 Pass municipality name to PDF function for immediate title
7956ef2 Fix municipality PDF title — copy exact VUC approach
bf05eb4 Fix municipality PDF title timing — set before print()
13b547f Fix municipality PDF popup, update PDF window titles
```

---

## Known Issues / TODOs

- Modal flex-based top-anchoring — recently refactored, needs verification
- PDF Safari title uses two-phase document.write pattern
- No automated data refresh pipeline (manual Python script re-runs)
- No tests (unit or e2e)
- CLAUDE.md "What's in progress" section outdated
- Indirect _21 projects from name-matching, not ITMS API locations

*Last updated: 2026-03-20*
