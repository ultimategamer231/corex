# Audit of Corex Admin (Blocks A1 to A6)

Date: 2026-11-02. Scope: `apps/admin` and its database (`packages/db/admin/migrations` 0001 to 0007), built in Blocks A1 to A6 (`docs/SPEC-ADMIN.md`). Only critical or important items are listed.

## Result

No critical defects found. Checks on the final branch:

- `pnpm check`: format, lint, typecheck, unit tests and all builds.
- Database tests for every admin `[must]` rule (AUTH, LOG, LEAD, INV, PAY, LINK), the daily job's idempotency, dashboard figures, search, sample data, and a backup and restore round trip of the admin data with the activity log still verifying.
- End-to-end tests of every admin page with axe (WCAG 2.2 AA), overflow and 44px touch targets at 360, 390, 768 and 1440px. They include the full journey: a website request becomes a client, a discounted milestone invoice is sent, its PDF downloads, a part payment gets a receipt, the daily check drafts the renewal, and the activity log verifies.

Security review:

- **Access.** Every page, export and download needs an active admin whose session passed the authenticator step. The middleware, every server action and row-level security check this, and an end-to-end test confirms that signed-out requests reach nothing. Only two routes are public, and each has its own check:
  - `/i/<token>`: an unguessable 30-day token stored only as a hash, limited to 60 opens an hour per address.
  - `/api/cron/daily`: a secret of at least 32 characters, compared in constant time.
- **Money and records.** Invoices, lines, payments and receipts change only through database functions, and sent invoices, payments and receipts are never deleted. The activity log is a hash chain that no role can change.
- **Headers.** A Content-Security-Policy with `frame-ancestors 'none'`, HSTS, nosniff, X-Frame-Options and `noindex` on every response, including PDFs, CSVs and the public routes (tested).
- **Secrets.** The service-role key and the secrets are server-only, and no secret is written to the activity log.

## Fixed during this audit

1. **The daily-check secret could be guessed without limit** (important). Wrong secrets are now counted per address: after 10 in an hour the endpoint answers 429. Tested.
2. **Backups did not include the admin data** (important). The nightly backup now also saves `corex_web` when `DATABASE_URL_WEB` is set. `docs/restore.md` explains restoring it, and a database test rehearses the round trip.
3. **The admin migrations could reach the live database by surprise** (important). The **Website database** workflow runs twice a week on its own. It now applies the admin migrations only when the owner sets the variable `WEB_DB_PRODUCT=admin` (`docs/admin-runbook.md`, step 2).
4. **First admin needed a terminal.** A manual **Admin first invite** workflow creates the first account. It takes its inputs through the environment, not the script text. The set-up link is emailed, or printed in the run log only if the email could not be sent.

## Needs your decision (not blocking)

- **Dependency advisories (moderate).** `minimatch` and `glob`, pulled in by the offline-mode build tool (`@serwist`) of the Clinic, Finance and School apps, have moderate advisories. They run only at build time on our own files, and the admin does not use them. Recommendation: pin the patched versions with `pnpm.overrides` in a small follow-up, as was done for `zod`.
- **Client email** stays off until a sending domain is verified in Resend (`docs/admin-runbook.md`, step 8).
