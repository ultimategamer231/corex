# Corex website (`apps/web`)

Marketing website (SPEC.md 6). All copy lives in typed files under `content/`; components hold no placeholder text.

- Pages: `/`, `/software`, `/software/{school,clinic,finance,on-request}`, `/services/{ai-automation,it-consultancy,training}`, `/work` (hidden until a case study is published), `/pricing`, `/about`, `/contact`, `/legal/{terms,privacy,license}`.
- Case studies: MDX in `content/work/`; `draft: true` shows only in development.
- Quote form: `app/contact/actions.ts` validates with `lib/leads/schema.ts`, rate-limits (5 per IP per hour) and stores leads in the `corex_web` schema of the website's own Supabase project (`pnpm db:migrate --schema corex_web --product web --project web`). Email notification is optional (Resend).

- Design reference: `docs/mockup/` (see the route mapping in the master prompt)
- Contact details: `content/site.ts`
- Official logo: `public/brand/corex-logo.png`

## Run

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @corex/web dev        # http://localhost:3000
```

## Test

```bash
pnpm --filter @corex/web lint
pnpm --filter @corex/web typecheck
pnpm --filter @corex/web test
pnpm --filter @corex/web build
pnpm test:e2e --project=web         # from the repo root, after a build
```

## Deploy (Vercel)

Its own Vercel project from this monorepo, Root Directory `apps/web`. The free Hobby plan does not allow commercial use, so the Pro plan is needed before the site goes public.
