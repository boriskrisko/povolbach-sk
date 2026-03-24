# portal.povolbach.sk — Municipal EU Fund Call Alerts (SaaS V0)

> Freemium SaaS platform that alerts Slovak municipalities about matching EU fund calls.
> Live at https://portal.povolbach.sk

**Stack:** Next.js + Supabase (Auth + Postgres + RLS) + Resend → Vercel
**Repo:** `boriskrisko/povolbach-sk` (monorepo, `portal/` folder). Will eventually move to `boriskrisko/povolbach-portal`.

---

## Features (V0)

- Landing page with value proposition
- Registration with IČO auto-lookup (searches 2,926 pre-seeded organizations)
- Login via Supabase Auth (email + password)
- Dashboard with matched fund calls per organization
- Call detail pages
- Email notifications via Resend
- Settings page

## App Structure

```
portal/src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── register/         # Registration with IČO lookup
│   ├── login/            # Login
│   ├── dashboard/        # Matched calls dashboard
│   ├── calls/            # Call detail pages
│   ├── settings/         # User settings
│   ├── auth/             # Auth callbacks
│   └── api/              # API routes
├── components/           # Shared UI components
├── lib/                  # Utilities, Supabase client
└── middleware.ts         # Auth middleware
```

## Database (Supabase Postgres with RLS)

Tables:
- `organizations` — 2,926 pre-seeded Slovak municipalities (IČO, name, region, etc.)
- `users` — registered users linked to organizations
- `fund_calls` — EU fund call listings
- `call_matches` — matched calls per organization
- `subscriptions` — subscription tiers and status

## Auth

Supabase Auth with email + password. Middleware protects dashboard routes.

## Reference Specs

Full specifications in `docs/` folder at repo root:
- Master plan PDFs for strategy and phases
- PROJECT_STATUS_REPORT.md for current project state

## Architecture Rules

See root `CLAUDE.md` for universal rules: IČO-only joins, efficiency framing, municipalities are future customers.

*Last updated: 2026-03-24*
