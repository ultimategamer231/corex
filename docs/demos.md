# Public demos

The College, High School, Clinic and Finance demos (SPEC.md 11) are the School, Clinic and Finance apps with `DEMO_MODE=true`, each on its own schema in one Supabase project reserved for demos.

| Demo        | Subdomain                    | Schema            | App env                                                                         |
| ----------- | ---------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| College     | `demo-college.<root domain>` | `demo_college`    | `EDITION=college`, `DEMO_MODE=true`, `NEXT_PUBLIC_DB_SCHEMA=demo_college`       |
| High School | `demo-school.<root domain>`  | `demo_highschool` | `EDITION=highschool`, `DEMO_MODE=true`, `NEXT_PUBLIC_DB_SCHEMA=demo_highschool` |
| Clinic      | `demo-clinic.<root domain>`  | `demo_clinic`     | `apps/clinic`, `DEMO_MODE=true`, `NEXT_PUBLIC_DB_SCHEMA=demo_clinic`            |
| Finance     | `demo-finance.<root domain>` | `demo_finance`    | `apps/finance`, `DEMO_MODE=true`, `NEXT_PUBLIC_DB_SCHEMA=demo_finance`          |

Sign-ins (password `Demo@2026`) are listed in `packages/core/src/demo.ts`; the demo login page and the website's "Log in as" links use the same list.

## Try it locally

```bash
pnpm db:local:start
pnpm demo:seed --demo college            # or highschool, clinic or finance; seconds (clinic about 20)
node scripts/school-env.mjs --schema demo_college
DEMO_MODE=true pnpm --filter @corex/school dev
```

Open <http://localhost:3001/login> and pick a role. Running the seed again resets the demo.

## What demo mode changes

- A banner on every screen: "Demo with sample data. Resets every night." with **Get this system** (website quote page, product prefilled).
- Settings, users, roles and sign-in creation are read-only (hidden in the app, rejected by the app server and by the database). Password reset and change are off, so no email is sent. Finance categories and exchange rates stay editable, like any visitor record.
- Uploads are limited to 1 MB and exports to 200 rows (Clinic and Finance reports say so and refuse longer exports).
- Seeded records are marked `is_seed`. Visitors can view them and move them through workflows (approve a submitted plan, record a payment), but cannot edit, delete, void, correct or reopen them. Their own new records work normally until the reset. In the Clinic demo visitors can check in sample appointments, open visits from the queue and take payments on sample bills, but cannot cancel, reschedule or edit sample records; they book and register their own to try those.
- Rate limits: 10 sign-in attempts per IP per 15 minutes, 60 writes per user per minute.
- The demo database layer ignores Auth API changes to a demo account's password, email or phone, so the published password keeps working.

The demo layer is `packages/db/demo/migrations`, applied only by `pnpm demo:seed`, after the School migrations.

## Going live (waiting on the owner)

1. **Supabase project for demos.** Create it (it never holds client data). In Authentication settings: turn off public sign-ups and leave email sending off (no SMTP). Expose `demo_college`, `demo_highschool`, `demo_clinic` and `demo_finance` under API settings after the first seed. Storage needs private buckets named `demo_finance` (receipt photos) and `demo_clinic` (patient files).
2. **Secrets.** In the GitHub repository secrets add `DATABASE_URL_DEMO` (direct connection string), `SUPABASE_URL_DEMO` and `SUPABASE_SERVICE_ROLE_KEY_DEMO`. Run the **Demo reset** workflow once by hand to seed both demos.
3. **Vercel.** Two projects from `apps/school` (College, High School), one from `apps/clinic` and one from `apps/finance`, with the env above plus `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only; used for the sign-in rate limit), `NEXT_PUBLIC_STORAGE_BUCKET` (the schema name), `NEXT_PUBLIC_ROOT_DOMAIN` and `APP_URL`. Add the subdomains.
4. **Website.** Set `NEXT_PUBLIC_ROOT_DOMAIN` on the website deployment; its demo buttons and "Log in as" links then point at the subdomains.

## Nightly reset

`.github/workflows/demo-reset.yml` runs at 02:00 Africa/Monrovia (UTC) and on demand. For each demo it creates any missing sign-ins, sets the published password, applies pending migrations and the demo layer, then empties and reseeds every table in one transaction, so visitors keep the old data until the new data is complete. The nightly connection also keeps the Supabase project active. Until the secrets exist the job passes with a notice.

A failed run leaves yesterday's data in place. GitHub emails the workflow owner about failed scheduled runs; a team email notice will be added with the email provider. During the few seconds of a reset, sign-ins to the demos wait for it to finish.
