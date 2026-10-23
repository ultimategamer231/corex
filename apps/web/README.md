# Corex website (`apps/web`)

Marketing website (SPEC.md 6). Phase 1 contains a placeholder home page with the Corex theme, logo and contact details; all routes, content files and the quote form are built in Phase 4.

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
