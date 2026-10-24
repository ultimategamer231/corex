# Financial Management (`apps/finance`)

Next.js app for the Corex Financial Management system (SPEC.md 9): accounts and balances, income, expenses and transfers with receipt photos, sales invoices with payments and receipts, payroll (employees, pay components, monthly runs, payslip PDFs), cash-basis reports with PDF and Excel export, settings and users. Roles: Owner/Admin, Accountant, Staff (Staff record entries and see only their own).

## Run

```bash
pnpm db:local:start
pnpm db:fixture --schema dev_finance --product finance   # sample business, one sign-in per role
node scripts/school-env.mjs --app finance --schema dev_finance
pnpm --filter @corex/finance dev                         # http://localhost:3003
```

Sign in as `owner@dev-finance.corex.test`, `accountant@…` or `staff@…` with `Test@2026pass`.

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
