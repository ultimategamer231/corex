# Corex Admin (`apps/admin`)

Internal back office for Corex staff (`docs/SPEC-ADMIN.md`): leads, clients, subscriptions, invoices and receipts, the dashboard, a permanent activity log and settings. Data lives in the `corex_web` schema of the website's Supabase project; the admin never reads client system data.

Complete (Blocks A1 to A6): sign-in with an email or username, a password and an authenticator app; leads; clients, contracts and documents; invoices, payments, receipts, PDFs and client view links; the dashboard, subscriptions, the daily check, search and notifications; settings; the activity log.

## Run

```bash
pnpm db:local:start
pnpm db:fixture --schema dev_admin --product admin   # five admins; prints each authenticator secret
node scripts/school-env.mjs --app admin --schema dev_admin
pnpm --filter @corex/admin dev                       # http://localhost:3008
```

Sign in as `owner@dev-admin.corex.test` (or the username `owner`) with `Admin-Fixture-2026`, then enter the code from an authenticator app set up with the printed secret (or `node -e` with `packages/db/src/admin/totp.ts`).

## Test

```bash
pnpm --filter @corex/admin lint
pnpm --filter @corex/admin typecheck
pnpm --filter @corex/admin test
pnpm --filter @corex/db test:db                      # AUTH and LOG rules in packages/db/test/admin.db.test.ts
node scripts/school-env.mjs --app admin --schema e2e_admin && pnpm --filter @corex/admin build
pnpm test:e2e --project=admin                        # from the repo root
```

## Sign-in model

1. Email or username and password (at least 12 characters). Five failed passwords for a name, or 20 from one address, pause sign-in for 15 minutes.
2. A 6-digit code from an authenticator app (Supabase TOTP), unless the browser is a trusted device (7 or 30 days, Settings → Security).
3. Until step 2, the session reads nothing: the middleware, every server action and row-level security all check `admin_sessions` for the session's Supabase `session_id`.

New admins get a one-time invite link (72 hours) to send them; there is no public sign-up. Admins without an email address use a username and get password reset links from another admin.

## Commands

```bash
pnpm admin:invite --name "Name" --username name --email you@example.com --admin-url https://<admin address>   # first admin only
pnpm admin:reset-authenticator --username name --admin-url https://<admin address>                              # only admin lost their phone
pnpm admin:verify-log                                                                                          # recompute the activity log chain
```

They use `DATABASE_URL_WEB`, `SUPABASE_URL_WEB` and `SUPABASE_SERVICE_ROLE_KEY_WEB` (project label `web`).

Sample data (SPEC-ADMIN.md 13), never in production:

```bash
ADMIN_ALLOW_SEED=true pnpm admin:seed [--schema corex_web] [--project web]   # marked is_sample; shows a "Sample data" chip
pnpm admin:unseed [--schema corex_web] [--project web]                       # removes only the sample rows
```

## Daily check

Every morning at 07:00 Monrovia time the GitHub workflow `Admin daily check` calls `POST /api/cron/daily` with `Authorization: Bearer <CRON_SECRET>`. It prepares renewal invoices 30 days before (drafts while `CLIENT_EMAIL_ENABLED=false`), records reminders 14 and 3 days before due, and counts grace periods, pause flags and ending warranties. Running it twice in a day changes nothing; each run is in the activity log. Set `CRON_SECRET` in the Vercel project, the same value as the GitHub secret `ADMIN_CRON_SECRET`, and the GitHub variable `ADMIN_URL`. Until then the workflow passes without calling anything. Settings → Renewals can also run it by hand.

Every 10 minutes the GitHub workflow `Admin status check` calls `POST /api/cron/status` with the same secret. It checks the website, the four demos (or the list in `STATUS_CHECK_URLS`) and each client system that is live or in staging and has an app address, keeps 30 days of results, and emails active admins when a site goes down or comes back. Only public `https://` addresses are checked, redirects are not followed, and an answer below 500 counts as up. System status shows the results and has a Check now button; the dashboard shows a red line while a site is down.

The admin is installable (Install app in Chrome or Edge, Add to Home Screen on a phone). It has no service worker, so nothing is kept on the device.

## Deploy (Vercel)

One project, Root Directory `apps/admin`, with the settings in `.env.example`. Going live on `admin.corexlr.com`, step by step: `docs/go-live.md`; day-to-day use: `docs/admin-guide.md` (user guide) and `docs/admin-runbook.md` (owner checklist). Backups and restore of `corex_web`: `docs/restore.md`.

Money report (`/money`) shows payments received and Corex's own expenses by month, per currency, with what is left; add hosting, domains and other costs there. Support (`/support`, and a Support tab on each client) records each client's issues, requests and questions; items are resolved, never deleted.

Demo visits on the Analytics page come from the demos: set `DEMO_VISITS_SECRET` here (32 or more random characters) and, in each demo's Vercel project, `DEMO_VISITS_URL` (this admin's address plus `/api/demo-visit`) and the same `DEMO_VISITS_SECRET`. Only the demo, the role and a daily count are kept.
