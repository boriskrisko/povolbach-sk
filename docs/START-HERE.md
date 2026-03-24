# povolbach.sk — Project Hub

## Čo je to
Platforma na sledovanie efektívnosti čerpania EU fondov slovenskými samosprávami.
- Stage 1: Verejný dashboard (aktuálne)
- Stage 2: Platený SaaS pre mestá a obce

## Kľúčové dokumenty
- `PoVolbach_sk.pdf` — Kompletný action plan a stratégia
- `CLAUDE.md` — Technická dokumentácia pre Claude Code
- `data/` — Všetky dátové súbory (ITMS, RPO, municipal stats)
- `frontend/` — React frontend

## Aktuálny stav (March 2026)
- ✅ Data pipeline hotový (ITMS 2014-2020 + 2021-2027)
- ✅ RPO subsidiary attribution (5,220 entít, vklad-based proportions)
- ✅ Validácia proti Transparency.sk (88% exact match, 2.13% delta)
- ✅ Cross-period contamination fixed
- ✅ Field name audit clean
- 🔧 Bugfixing a polish (GPS backfill _21, irregularity cross-check)
- ⏳ Share/export feature (deep-links + PDF export municipality reports)
- ⏳ "Potential funding" feature (open calls per municipality)
- ⏳ Per capita/total toggle on leaderboard + map
- ⏳ English version
- ⏳ Launch prep — PS network, media outreach

## Data Architecture
- **ITMS2014+ API** — 21,732 projects (2014-2020), ~1,200 projects (2021-2027)
- **RPO full export** — 1.7GB, 5,220 municipal subsidiary relationships
- **Transparency.sk** — validated against, our data is more current
- **ŠÚSR population data** — per-capita calculations
- **Municipality register** — 2,927 municipalities, GPS, okres, kraj

## Key Rules (from CLAUDE.md)
- **IČO is the only join key** — zero name matching anywhere
- **File naming: _14 and _21** — never _2127 or other variants
- **No cross-period contamination** — each period uses only its own source data
- **Efficiency framing** — "opportunity", not "failure" or "shaming"

## Weekly Priorities
Pozri PoVolbach_sk.pdf pre detailný action plan s fázami a milestones.

## Contacts & Distribution
- PS network — built-in launch distribution
- Slovak media targets: Denník N, SME, Aktuality.sk
- Municipal outreach — direct demos to mayors

## Revenue Target
€100K+/month within 18-24 months via Stage 2 SaaS (€199-799/month per municipality)
