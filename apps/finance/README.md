# Financial Management (`apps/finance`)

Next.js app for the Corex Financial Management system (SPEC.md 9). Phase 1 contains only the shared app shell and placeholder sections; features are built in Phase 8.

## Run

```bash
cp apps/finance/.env.example apps/finance/.env.local   # then fill in values
pnpm --filter @corex/finance dev                         # http://localhost:3003
```

## Test

```bash
pnpm --filter @corex/finance lint
pnpm --filter @corex/finance typecheck
pnpm --filter @corex/finance test
pnpm --filter @corex/finance build
pnpm test:e2e --project=finance                          # from the repo root, after a build
```

## Deploy (Vercel)

Each client instance and each demo is its own Vercel project created from this monorepo:

- Root Directory: `apps/finance`
- Framework preset: Next.js (install and build commands are detected; pnpm runs from the repo root)
- Environment variables: see `.env.example`
- `vercel.json` skips builds when nothing in this app or its packages changed (`turbo-ignore`).
