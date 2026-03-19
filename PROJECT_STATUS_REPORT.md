# povolbach.sk — Project Status Report

Generated: 2026-03-19

---

## 1. Project Overview

**povolbach.sk** is a free public dashboard showing how well Slovak municipalities absorb EU funds. Data comes from ITMS2014+ and ITMS2021+ Open Data APIs. Two periods are supported: 2014-2020 (completed) and 2021-2027 (in progress).

**Stack:** Python data pipeline (ITMS API -> JSON) -> Next.js/React frontend (static export)
**Deployment:** Vercel (frontend), static JSON files served from `/public/`
**Key rule:** All data joins use IČO (Slovak entity registration number) — zero name matching anywhere

---

## 2. File Tree

```
/Users/boriskrisko/povolbach/
├── CLAUDE.md                          # AI assistant context file
├── PROJECT_STATUS_REPORT.md           # This file
├── fetch_itms.py                      # 2014-2020 data pipeline (569 lines)
├── fetch_itms21.py                    # 2021-2027 data pipeline (352 lines)
├── match_municipalities.py            # IČO-based municipality matching (610 lines)
├── scripts/
│   ├── attribute_subsidiaries.py      # RPO-based subsidiary attribution (240 lines)
│   ├── attribute_obecne_podniky.py    # Legacy attribution script (207 lines)
│   ├── build_frontend_public.py       # Merge + slim data for frontend (169 lines)
│   ├── build_mikroregiony.py          # Inter-municipal cooperation stats (147 lines)
│   ├── extract_rpo_founders.py        # RPO S3 dump founder extraction (287 lines)
│   ├── find_indirect_projects.py      # State project geo-mapping (169 lines)
│   └── validate_against_transparency.py # Cross-validation vs Transparency.sk (329 lines)
├── data/
│   ├── raw_project_lists.json         # Step 1 cache: paginated project IDs
│   ├── raw_project_details/           # Step 2 cache: 21,763 individual project JSONs
│   ├── raw_nuts_names.json            # Step 3 cache: NUTS5 code -> municipality name
│   ├── raw_subjects.json              # Step 4 cache: subject ID -> name/address/GPS
│   ├── raw_irregularities.json        # Raw irregularity data from ITMS
│   ├── aggregated_by_beneficiary_14.json  # Per-IČO stats, 2014-2020 (18MB)
│   ├── aggregated_by_beneficiary_21.json  # Per-IČO stats, 2021-2027 (1MB)
│   ├── municipal_stats_14.json        # Municipal stats, 2014-2020 (6.8MB)
│   ├── municipal_stats_21.json        # Municipal stats, 2021-2027 (2.3MB)
│   ├── vuc_stats_14.json             # VÚC (regional) stats, 2014-2020 (48KB)
│   ├── vuc_stats_21.json             # VÚC (regional) stats, 2021-2027 (44KB)
│   ├── mikroregiony_stats_14.json     # Inter-municipal stats, 2014-2020 (20KB)
│   ├── mikroregiony_stats_21.json     # Inter-municipal stats, 2021-2027 (4KB)
│   ├── subsidiaries_by_municipality_14.json  # Subsidiary attribution, 2014-2020 (316KB)
│   ├── subsidiaries_by_municipality_21.json  # Subsidiary attribution, 2021-2027 (60KB)
│   ├── subsidiaries_by_vuc_14.json    # VÚC subsidiary attribution (64KB)
│   ├── subsidiaries_by_vuc_21.json    # VÚC subsidiary attribution (20KB)
│   ├── indirect_by_municipality_14.json  # State projects geo-mapped, 2014-2020 (252KB)
│   ├── indirect_by_municipality_21.json  # State projects name-matched, 2021-2027 (32KB)
│   ├── rpo_founders.json              # RPO founder/owner lookup, 5,220 entities (1.4MB)
│   ├── municipalities_ico.json       # Official municipality IČO register (628KB)
│   ├── all_municipalities_register.json  # Extended municipality register (848KB)
│   ├── irregularities_by_ico_14.json  # Irregularities per IČO, 2014-2020 (2.4MB)
│   ├── irregularities_by_ico_21.json  # Irregularities per IČO, 2021-2027 (4KB, mostly empty)
│   ├── validation_200_sample.json     # 200-muni validation vs Transparency.sk (80KB)
│   ├── validation_vs_transparency.json # 10-muni validation results (4KB)
│   ├── rpo_ico_cache.json             # Legacy RPO API cache (12KB)
│   ├── itms21_raw_cache/              # Cached ITMS21 API responses
│   └── [various legacy/helper files]
├── frontend/
│   ├── package.json                   # Next.js 16.1.7 app
│   ├── next.config.ts                 # Static export config
│   ├── public/
│   │   ├── municipal_stats_14.json    # Slimmed 2014-2020 data (4.8MB)
│   │   ├── municipal_stats_21.json    # Slimmed 2021-2027 data (1.4MB)
│   │   ├── vuc_stats_14.json          # VÚC stats for frontend (32KB)
│   │   ├── vuc_stats_21.json          # VÚC stats for frontend (16KB)
│   │   ├── mikroregiony_stats_14.json # Mikroregión stats (20KB)
│   │   ├── mikroregiony_stats_21.json # Mikroregión stats (4KB)
│   │   └── sk-region-col.svg          # Slovakia map SVG
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Main page — orchestrates all sections
│       │   ├── layout.tsx             # Root layout with metadata
│       │   └── globals.css            # Theme, fonts, animations
│       ├── components/
│       │   ├── HeroSearch.tsx         # Hero banner + search + period toggle
│       │   ├── Leaderboard.tsx        # Top/bottom 10 municipalities
│       │   ├── StatsContext.tsx       # 4 aggregate stat cards
│       │   ├── SlovakiaMap.tsx        # Interactive SVG map with municipality dots
│       │   ├── VucSection.tsx         # Regional government cards
│       │   ├── VucModal.tsx           # VÚC detail modal
│       │   ├── MunicipalityModal.tsx  # Municipality detail modal
│       │   ├── MikroregiónySection.tsx # Inter-municipal cooperation section
│       │   ├── ViewModeToggle.tsx     # Total/Per capita toggle
│       │   └── Footer.tsx            # Footer with branding + links
│       └── lib/
│           ├── DataContext.tsx         # Data fetching + period caching
│           ├── types.ts               # TypeScript interfaces
│           ├── translations.ts        # SK/EN translation strings
│           └── utils.ts               # Formatting + search helpers
└── [reference PDFs, swagger.json, settings.json]
```

---

## 3. Frontend Features Inventory

### page.tsx — Main Page Orchestrator
- Wraps everything in `DataProvider` for period-aware data loading
- Computes `GlobalStats` via `useMemo` from active municipality data (total funds, municipalities with/without projects, indirect project dedup)
- Manages: `selectedMunicipality`, `selectedVuc`, `viewMode` (total/capita), `locale` (sk/en)
- Auto-closes modals on period change
- Section order: HeroSearch → StatsContext → Leaderboard → SlovakiaMap → VucSection → MikroregiónySection → Footer

### HeroSearch.tsx — Hero + Search + Navigation
- Hero heading with animated text
- **Search box**: filters municipalities by name (diacritics-insensitive), shows dropdown with top 8 results sorted by funds, keyboard navigation (arrows/Enter/Escape)
- **Period toggle**: switches between 2014-2020 and 2021-2027, shows availability dot, persists scroll position on switch
- **Language toggle**: SK/EN buttons in navbar
- **Floating period toggle**: sticky bar that appears when scrolling past hero section
- Displays: total municipality count, total funds from `globalStats`

### StatsContext.tsx — 4 Key Stat Cards
- 2x2 grid (mobile) / 4-column grid (desktop)
- Card 1 (blue): Total EU funds (€ mil./mld.)
- Card 2 (emerald): Municipalities absorbing funds (count + %)
- Card 3 (amber): Municipalities with €0 absorption (count + %)
- Card 4 (indigo): State investments in municipalities (deduplicated indirect projects)
- Animated number counters with intersection observer
- Period-specific data source disclaimer

### Leaderboard.tsx — Top/Bottom Rankings
- Two-column layout: Top 10 (green) + Bottom 10 (orange)
- Uses combined total (direct + subsidiary EUR) for ranking
- Per capita mode divides by population
- Animated bar charts showing relative amounts
- Clickable rows open MunicipalityModal
- "Zero absorption" callout with count

### SlovakiaMap.tsx — Interactive Map
- SVG map of Slovakia with 8 region outlines
- Municipality dots plotted by GPS coordinates, colored by absorption level
- Hover tooltips on dots and regions
- Region cards below map (4-column grid) showing per-region stats
- Clickable dots → MunicipalityModal, clickable region cards → VucModal
- Color legend with 5 bands
- Supports total and per capita color modes

### VucSection.tsx — Regional Government Cards
- Fetches VÚC stats from `/vuc_stats_{period}.json`
- 4-column grid of VÚC cards sorted by funds
- Shows direct + subsidiary breakdown
- Clickable cards open VucModal

### VucModal.tsx — VÚC Detail
- Header: VÚC name, IČO, population
- Stats: total funds (direct + subsidiary breakdown), project counts, per capita
- Irregularities callout (amber)
- Top 5 projects by amount
- Top 5 subsidiary organizations with joint venture indicators
- Period-specific disclaimer

### MunicipalityModal.tsx — Municipality Detail
- Header: name, region, district, IČO, NUTS5 code, population
- Stats: total funds (direct + subsidiary breakdown), project counts, per capita
- Irregularities callout
- **Top 5 direct projects**: name, amount, status (active/completed), end date
- **Top 5 subsidiary orgs**: name, proportional amount, project count, joint venture note (e.g. "podiel 78.62% z €38.8 mil.")
- **Top 5 state projects in territory**: name, amount, beneficiary agency name
- Joint venture footnote when applicable
- Period-specific disclaimer

### MikroregiónySection.tsx — Inter-Municipal Cooperation
- Fetches from `/mikroregiony_stats_{period}.json`
- 4 category cards: Water, Waste, Transport, Regional Development
- Color-coded left borders
- Expandable detail showing individual entities
- Note: funds not counted in municipality scores

### ViewModeToggle.tsx — Reusable Toggle
- Two-button toggle: "Celkovo" / "Na obyvateľa" (SK) or "Total" / "Per capita" (EN)
- Used in Leaderboard, Map, and VucSection

### Footer.tsx — Footer
- Branding, data source, last updated, disclaimer
- GitHub and email links

### DataContext.tsx — Data Provider
- Fetches and caches both period JSON files
- Initial load: _14 immediately, _21 in background
- Instant period switching when cached
- Exposes: `data`, `loading`, `period`, `setPeriod`, `periodAvailable`, `isTransitioning`

### Shared Libraries
- **types.ts**: TypeScript interfaces for Municipality, VucStats, GlobalStats, ProjectSummary, SubsidiaryOrg (with co_owners, share_pct, full_amount_eur), IndirectProject
- **translations.ts**: Full SK/EN translation strings with dynamic interpolation
- **utils.ts**: `formatAmount`, `formatBillions`, `getCombinedTotal`, `getRegionStats`, `searchMunicipalitiesFlexible`, `formatProjects`, `removeDiacritics`

---

## 4. Data Files Inventory

### Frontend Public (served to browser)

| File | Size | Description |
|------|------|-------------|
| municipal_stats_14.json | 4.8MB | 2,928 municipalities with projects, GPS, subsidiaries, indirect projects (2014-2020) |
| municipal_stats_21.json | 1.4MB | 2,928 municipalities (2021-2027), GPS backfilled from _14 |
| vuc_stats_14.json | 32KB | 8 VÚC regions with direct + subsidiary stats (2014-2020) |
| vuc_stats_21.json | 16KB | 8 VÚC regions (2021-2027) |
| mikroregiony_stats_14.json | 20KB | 94 inter-municipal entities in 4 categories (2014-2020) |
| mikroregiony_stats_21.json | 4KB | 14 inter-municipal entities (2021-2027) |

### Pipeline Data (not served to browser)

| File | Size | Description |
|------|------|-------------|
| aggregated_by_beneficiary_14.json | 18MB | All 8,290 ITMS beneficiaries with projects (2014-2020) |
| aggregated_by_beneficiary_21.json | 1MB | All 717 ITMS21 beneficiaries (2021-2027) |
| municipal_stats_14.json | 6.8MB | Full municipal stats before slimming |
| municipal_stats_21.json | 2.3MB | Full municipal stats before slimming |
| rpo_founders.json | 1.4MB | 5,220 entities with municipal/VÚC ownership from RPO full export |
| municipalities_ico.json | 628KB | Official register of 2,928 Slovak municipalities |
| irregularities_by_ico_14.json | 2.4MB | Irregularities data per beneficiary IČO |
| subsidiaries_by_municipality_14.json | 316KB | 631 municipalities with 671 subsidiary orgs |
| subsidiaries_by_municipality_21.json | 60KB | 122 municipalities with subsidiary orgs |
| indirect_by_municipality_14.json | 252KB | 374 municipalities with 169 state projects (NUTS5 geo-mapped) |
| indirect_by_municipality_21.json | 32KB | 55 municipalities with 49 state projects (name-matched) |
| raw_project_details/ | ~2GB | 21,763 cached individual project JSONs from ITMS API |
| raw_subjects.json | 4.1MB | Cached subject (beneficiary) details with GPS |
| raw_nuts_names.json | 76KB | NUTS5 code to municipality name mapping |
| validation_200_sample.json | 80KB | Cross-validation results vs Transparency.sk |

---

## 5. Python Scripts Inventory

| Script | Lines | Description |
|--------|------:|-------------|
| fetch_itms.py | 569 | 2014-2020 pipeline: fetch projects, subjects, NUTS5, irregularities from ITMS API. 6-step resumable pipeline with caching. |
| fetch_itms21.py | 352 | 2021-2027 pipeline: fetch from ITMS21 API (/aktivitaprojekt), dedupe by project ID, aggregate by IČO. |
| match_municipalities.py | 610 | Filter aggregated beneficiaries to municipalities only using IČO intersection with official register. |
| scripts/attribute_subsidiaries.py | 240 | Attribute non-municipality beneficiaries to their founding municipality/VÚC using RPO IČO-only lookup. Splits joint ventures proportionally by deposit data. |
| scripts/extract_rpo_founders.py | 287 | Download RPO full export from ŠÚSR S3 bucket (23 chunks, 1.7GB), extract 5,220 municipal/VÚC ownership relationships with deposit-based proportions. |
| scripts/build_frontend_public.py | 169 | Merge municipal stats + subsidiaries + indirect projects, slim to top 5 per section, output to frontend/public/. |
| scripts/find_indirect_projects.py | 169 | Map state agency projects to municipalities via miestaRealizacie NUTS5 codes. |
| scripts/build_mikroregiony.py | 147 | Build inter-municipal cooperation stats from aggregated beneficiary data, categorize into water/waste/transport/development. |
| scripts/validate_against_transparency.py | 329 | Cross-validate our data against Transparency.sk "Faktúra za eurofondy" API (200-municipality sample). |
| scripts/attribute_obecne_podniky.py | 207 | Legacy subsidiary attribution script (pre-RPO, name-based — superseded). |
| data/build_municipality_register.py | 602 | Build municipality register from ŠÚSR, ITMS, and manual sources. |
| data/build_ico_pipeline.py | 592 | IČO-based municipality pipeline helper. |
| data/filter_municipalities.py | 140 | Filter aggregated data to municipalities only. |

---

## 6. Current Website State

### What works
- Single-page dashboard with all sections rendering
- Period toggle between 2014-2020 and 2021-2027 with instant switching
- Municipality search with diacritics-insensitive matching
- Top/bottom 10 leaderboard with combined (direct + subsidiary) totals
- Interactive SVG map with 2,540 municipality dots (2014-2020 period)
- Municipality detail modal with 3 project sections (direct, subsidiary, state)
- VÚC cards and detail modals with subsidiary breakdown
- Joint venture subsidiary display with actual ownership proportions from RPO deposits
- Mikroregión cooperation section with 4 categories
- Bilingual SK/EN interface
- Per capita view toggle
- Data validated against Transparency.sk (176/200 OK, 7 warnings, 17 minor discrepancies)

### Period-specific data quality

| Feature | 2014-2020 | 2021-2027 |
|---------|-----------|-----------|
| Municipalities | 2,928 | 2,928 |
| With GPS | 2,540 | 2,540 (backfilled from _14) |
| Total EU funds | ~€16B+ | ~€3.5B |
| Subsidiary orgs | 671 (€669M) | 79 (€265M) |
| Indirect/state projects | 169 (€2.87B, NUTS5 geo-mapped) | 49 (€1.98B, name-matched) |
| Mikroregióny | 94 (€128M) | 14 (€74M) |
| Irregularities | Full data | Mostly empty |

### Known gaps / incomplete
- 388 municipalities lack GPS in both periods (zero EU projects, no ITMS subject data)
- 2021-2027 indirect projects limited to 49/214 (ITMS21 API lacks NUTS5 location data, using project name extraction as fallback)
- 2021-2027 irregularities data mostly empty
- No individual municipality pages (single-page app only)
- No data refresh automation (manual pipeline runs)

---

## 7. Recent Git History (last 10 commits)

```
2b00a7d Generate _21 indirect projects from project name→municipality matching
1181380 Fix cross-period contamination: clear _21 indirect data
ddbc8b8 Fix three _21 data gaps: GPS, indirect projects, mikroregióny
b382733 Use RPO deposit data for actual ownership proportions in joint ventures
363c3d7 Fix subsidiary project counts — use correct field names from aggregated data
79221af Show joint venture indicator for multi-owner subsidiaries in modals
8a1b642 Fix double-counting: split multi-founder subsidiary EUR proportionally
dfe1255 Remove date filter, add multi-founder attribution from RPO data
e958437 Use RPO full export for subsidiary attribution — IČO-only, zero name matching
ae4b8f0 Use combined total (direct + subsidiaries) for all rankings and comparisons
```

---

## 8. Known Issues & TODOs

### From CLAUDE.md
- [ ] `match_municipalities.py` marked as "in progress" (actually done)
- [ ] Deploy: Vercel (frontend) + GitHub Actions (weekly data refresh) — not set up
- [ ] CLAUDE.md checklist is outdated (still shows V1.1 subsidiary rollup as future work — already implemented)

### Technical debt
- `fetch_itms21.py` does not extract `miestaRealizacie` from project details (only NUTS3 region from activity records) — indirect project geo-mapping for _21 relies on project name extraction instead
- `data/excluded_beneficiaries.json` is a legacy file referenced by old scripts but no longer used by the active pipeline
- `scripts/attribute_obecne_podniky.py` is superseded by `attribute_subsidiaries.py` (RPO-based) — can be removed
- `data/build_ico_pipeline.py`, `data/build_municipality_register.py`, `data/filter_municipalities.py` are legacy helper scripts — may be removable
- `rpo_ico_cache.json` is a legacy cache from the old RPO API approach (now using S3 full dump) — can be removed
- `indirect_dedup_stats.json` in frontend/public/ is a legacy static file — no longer used by frontend (dedup computed client-side)

### Data quality
- 280/308 multi-founder entities use equal 1/N split (RPO deposits unavailable for non-commercial entities like associations)
- 164/214 state projects in _21 cannot be geo-mapped (ITMS21 API limitation)
- Cross-validation showed our data has 1-2 more projects than Transparency.sk for 17/200 municipalities (likely data freshness difference, not bug)

### Feature roadmap (from CLAUDE.md)
- [ ] Stage 2: Paid SaaS — municipal EU project management tool
- [ ] Individual municipality pages (SEO, shareable URLs)
- [ ] GitHub Actions for automated weekly data refresh
- [ ] Vercel deployment pipeline

---

## 9. Key Architecture Decisions

1. **IČO-only joins**: All entity matching uses 8-digit IČO numbers, never names. Enforced project-wide.
2. **RPO full export for subsidiary attribution**: Downloaded 1.7GB RPO register from ŠÚSR S3 bucket. 5,220 ownership relationships extracted. No API calls needed — deterministic, reproducible.
3. **Proportional joint venture splits**: Multi-owner subsidiaries split EUR by actual RPO deposit data (28/308 entities) or equal 1/N (280/308).
4. **Static JSON architecture**: No database. Python pipeline produces JSON files, frontend is a static Next.js export. All data fits in browser memory.
5. **Period-aware data**: Strict `_14`/`_21` suffix convention. No cross-period data contamination. Each period loads from its own JSON file.
6. **Client-side dedup**: Indirect project deduplication happens in `globalStats` useMemo, not in the build pipeline. This ensures period-correct stats.
