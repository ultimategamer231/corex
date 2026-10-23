# Clinic Management (`apps/clinic`)

Next.js app for the Corex Clinic Management system (SPEC.md 8). Phase 1 contains only the shared app shell and placeholder sections; features are built in Phase 10.

## Run

```bash
cp apps/clinic/.env.example apps/clinic/.env.local   # then fill in values
pnpm --filter @corex/clinic dev                         # http://localhost:3002
```

## Test

```bash
pnpm --filter @corex/clinic lint
pnpm --filter @corex/clinic typecheck
pnpm --filter @corex/clinic test
pnpm --filter @corex/clinic build
pnpm test:e2e --project=clinic                          # from the repo root, after a build
```

## Deploy (Vercel)

Each client instance and each demo is its own Vercel project created from this monorepo:

- Root Directory: `apps/clinic`
- Framework preset: Next.js (install and build commands are detected; pnpm runs from the repo root)
- Environment variables: see `.env.example`
- `vercel.json` skips builds when nothing in this app or its packages changed (`turbo-ignore`).
