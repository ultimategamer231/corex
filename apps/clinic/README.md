# Clinic Management (`apps/clinic`)

Next.js app for the Corex Clinic Management system (SPEC.md 8): patients, appointments, walk-in queue, visits with vitals and signed clinical notes, bills, payments and receipts, reports with PDF and Excel export. Roles: Admin, Clinician, Nurse, Receptionist, Cashier. Sessions end after 4 hours.

## Run

```bash
pnpm db:local:start
pnpm db:fixture --schema dev_clinic --product clinic      # sample clinic, password Test@2026pass
node scripts/school-env.mjs --app clinic --schema dev_clinic   # writes .env.local
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
