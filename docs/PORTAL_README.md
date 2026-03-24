# portal.povolbach.sk — Municipal EU Fund Call Alerts (SaaS)

## Status: V0 LIVE

portal.povolbach.sk is a live SaaS platform (V0 freemium) that alerts Slovak municipalities about matching EU fund calls. Deployed on Vercel.

## Stack
- Next.js + Supabase (Auth + Postgres + RLS) + Resend + Vercel
- Domain: portal.povolbach.sk

## V0 Features
- Landing page with value proposition
- Registration with IČO auto-lookup (searches 2,926 pre-seeded organizations)
- Login via Supabase Auth (email + password)
- Dashboard with matched fund calls
- Call detail pages
- Email notifications via Resend

## Repo
Currently lives in `portal/` folder of the main monorepo (`boriskrisko/povolbach-sk`).
Will eventually move to its own repo: `boriskrisko/povolbach-portal`.

## Specs
Full specifications are in this docs/ folder:
- See the master plan PDFs for strategy and phases
- See PROJECT_STATUS_REPORT.md for current project state

## Target
2,934 Slovak municipalities as potential customers. Pricing tiers: €199/€399/€799 per month.
Target: €100K+/month within 18–24 months.
