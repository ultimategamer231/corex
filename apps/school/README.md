# School Management (`apps/school`)

Next.js app for the Corex School Management system (SPEC.md 7). The College edition is built (Phase 5); the High School edition follows in Phase 6.

- Sign-in with Supabase Auth; every page checks the member's role (`lib/session.ts`) and row-level security checks again. Sessions end after 8 hours.
- Server actions go through `lib/action.ts` (session, role, zod validation, readable database errors).
- Rules that must hold whatever the client sends (course planning, capacity, grade locking, fees) live in the database (`packages/db/school/migrations`).
- Queries are typed from `packages/db/types/school.ts` (`pnpm db:types`).
- PDFs: transcript, grade report, invoice and receipt (`app/(app)/**/route.ts`).

The same app serves both school editions. Set `EDITION=college` or `EDITION=highschool`; each client or demo is its own Vercel project with its own environment variables.

## Run

With the local Supabase stack (`pnpm db:local:start`) and a fictional sample College:

```bash
pnpm db:fixture --schema dev_college                     # sign-ins per role, password Test@2026pass
node scripts/school-env.mjs --schema dev_college         # writes .env.local for that schema
pnpm --filter @corex/school dev                          # http://localhost:3001
```

Against a real project, copy `.env.example` to `.env.local` and fill in the values.

## Test

```bash
pnpm --filter @corex/school lint
pnpm --filter @corex/school typecheck
pnpm --filter @corex/school test
pnpm --filter @corex/school build
node scripts/school-env.mjs --schema e2e_college        # before building for end-to-end tests
pnpm test:e2e --project=school                          # from the repo root, after a build
```

## Deploy (Vercel)

Each client instance and each demo is its own Vercel project created from this monorepo:

- Root Directory: `apps/school`
- Framework preset: Next.js (install and build commands are detected; pnpm runs from the repo root)
- Environment variables: see `.env.example`
- `vercel.json` skips builds when nothing in this app or its packages changed (`turbo-ignore`).
