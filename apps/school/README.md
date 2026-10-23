# School Management (`apps/school`)

Next.js app for the Corex School Management system (SPEC.md 7). Phase 1 contains only the shared app shell and placeholder sections; features are built in Phases 5 and 6.

The same app serves both school editions. Set `EDITION=college` or `EDITION=highschool`; each client or demo is its own Vercel project with its own environment variables.

## Run

```bash
cp apps/school/.env.example apps/school/.env.local   # then fill in values
pnpm --filter @corex/school dev                         # http://localhost:3001
```

## Test

```bash
pnpm --filter @corex/school lint
pnpm --filter @corex/school typecheck
pnpm --filter @corex/school test
pnpm --filter @corex/school build
pnpm test:e2e --project=school                          # from the repo root, after a build
```

## Deploy (Vercel)

Each client instance and each demo is its own Vercel project created from this monorepo:

- Root Directory: `apps/school`
- Framework preset: Next.js (install and build commands are detected; pnpm runs from the repo root)
- Environment variables: see `.env.example`
- `vercel.json` skips builds when nothing in this app or its packages changed (`turbo-ignore`).
