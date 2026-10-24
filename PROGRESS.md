# PROGRESS

Running log for the Corex MVP build. Read this first at the start of every session.

## Current status

- **Phase:** 3 (Core, SPEC.md Step 3): in progress. Phases 1-2 merged to `main`.
- **Block:** Phase 3 complete
- **Branch:** `claude/questions-clarity-qmgcs5` (Phase 1 branch; merge to `main` after the owner approves the phase report)

## Block log

- **1.1** (2026-10-23) Repo bootstrap: pnpm workspace, Turborepo, Prettier, docs (SPEC, mockup), README, PROGRESS.
- **1.2** (2026-10-23) `packages/config`: strict tsconfig bases, ESLint flat config (type-aware, jsx-a11y strict, no `any`/`console`), Vitest base, `withCorex` security headers. 9 tests.
- **1.3** (2026-10-23) `packages/ui`: Tailwind v4 theme tokens (SPEC + mockup, default palette removed), shadcn-pattern Button, Badge, Card, Input, Label, Dialog, Sheet, DropdownMenu, Toaster, Skeleton; Corex logo SVG; fonts. 56 tests including token contrast.
- **1.4** (2026-10-23) App shell (SPEC 5.4): dark sidebar collapsible to an icon rail (per-device preference), mobile bottom bar with "More" sheet, top bar with org name/logo from props (settings in Phase 3), online/offline badge with pending-sync count (live region), user menu, skip link. 70 tests.
- **1.5** (2026-10-23) Four Next.js 16 apps: `school`, `clinic`, `finance` render the shell with placeholder sections (static, 404 for unknown sections); `web` has a placeholder home with logo, real contacts (`content/site.ts`) and WhatsApp/tel links. Shared security headers verified on a running build. `.env.example`, `vercel.json` (turbo-ignore) and README per app. Official logo cropped to `apps/web/public/brand/corex-logo.png`. 14 app tests; all four builds pass.
- **1.6** (2026-10-23) Playwright 1.63 + axe (WCAG 2.2 AA tags): every app at 360/390/768/1440px checks zero serious/critical violations, no horizontal scroll, 44px touch targets, skip link, sidebar collapse persistence, mobile More sheet (Escape returns focus), offline badge via `context.setOffline`, keyboard user menu, 404s and security headers. Fixed two WCAG 2.5.3 label-in-name issues axe found (user menu, logo link). 40 e2e tests.
- **1.7** (2026-10-23) Local Supabase: CLI 2.122 as dev dependency, `supabase/config.toml` (sign-up off, 8-char mixed passwords, unused services off), `pnpm db:local:start|stop|status|check` wrapper (Docker Hub images), `docs/local-dev.md`, SessionStart hook for cloud sessions (pnpm install, start dockerd). Verified: auth and REST return 200, `psql` connects to Postgres 17.11.
- **1.8** (2026-10-23) GitHub Actions: `ci.yml` (format, lint, typecheck, unit tests, build, `pnpm audit --audit-level high`) on every push and PR; `e2e.yml` (build, Playwright + axe, report artifact) on `main` and on demand. A clean-checkout dry run caught lint depending on generated Next types; section pages now declare their own prop types.
- **1.9** (2026-10-23) Phase close: `pnpm check` green from a clean build, 40/40 e2e, `pnpm audit` clean, `CLAUDE.md` added, screenshots at 360/390/768/1440 reviewed.

- **2.0** (2026-10-24) Merged Dependabot PRs #1-#4 (checkout 7.0.1, setup-node 7.1.0, upload-artifact 7.0.2, pnpm/action-setup 6.1.0) with owner approval; CI and E2E green on `main`.
- **2.1** (2026-10-24) `packages/db`: migration runner (core + product folders, `{{schema}}` rendering with strict schema-name validation, SHA-256 checksums, one transaction per schema, advisory lock, product lock-in), `db:migrate` and `db:migrate:all`, `schemas.json` registry with per-project `DATABASE_URL_<PROJECT>`. 20 unit + 6 database tests.
- **2.2** (2026-10-24) Core tables (SPEC 5.1) in `core/migrations/0001_core_tables.sql`: single-row settings, memberships keyed by (user, role), append-only audit events, files, announcements, shared billing (invoices, lines, payments, receipts) with bigint minor units, USD/LRD checks, void-needs-reason; RLS enabled on every table. Shape tests compare columns with SPEC.
- **2.3** (2026-10-24) `0002_access.sql`: no privileges for anon, RLS-only access for authenticated, default privileges for later migrations; SECURITY DEFINER helpers `has_role`, `is_member`, `current_roles`, `is_admin` (empty search_path); policies for settings, memberships and admin access to shared tables, no delete on billing. 10 access tests run as the real `anon`/`authenticated` roles with JWT claims: anon denied, non-member and suspended member get no rows or writes, dual roles work.
- **2.4** (2026-10-24) `0003_audit.sql` (CORE-03): generic `audit_row()` trigger (create, update, delete; status to `void` = void, to `approved` = approve; no-op updates skipped; `actor_id = auth.uid()`; reason from `corex.audit_reason` or `void_reason`), `enable_audit(table)` for product tables, append-only audit log (blocked even for the owner), `log_view()` for CLN-02, admin-only reads with a product hook `audit_row_visible()` so Clinic can hide clinical rows. 9 audit tests.
- **2.5** (2026-10-24) `db:provision` (SPEC 4.4): validates input, enforces one email per client per project (4.3.7), migrates, writes settings, creates a private bucket, invites the first admin by email (super_admin / admin / owner by product), registers the schema, exposes it to the local API (prints the dashboard reminder for cloud). Idempotent re-runs. 8 tests plus a manual CLI run (invite email received in local Mailpit). Scripts read `SUPABASE_URL_<PROJECT>` / `SUPABASE_SERVICE_ROLE_KEY_<PROJECT>`.
- **2.6** (2026-10-24) Cross-client isolation through the real Supabase API (SPEC 4.3.3): two provisioned schemas, password sign-in; client A gets zero rows from all six of B's tables, cannot update B, cannot add itself as B's member, cannot write B's records, is not a member for B's helpers, cannot list/download/upload in B's bucket; anon gets 42501; public sign-up refused; suspended user sees nothing. 16 tests. Found and fixed a Phase 1 config bug: `[auth.email] enable_signup = false` disabled email login entirely.
- **2.7** (2026-10-24) `db:backup` (SPEC 4.5): `pg_dump` custom format (compressed, `--no-owner`) of one schema using a version-matched binary (`PG_DUMP`, local, or the `postgres:<major>-alpine` image with the URL kept out of process arguments), uploaded to S3-compatible storage as `<project>/<schema>/<schema>-<UTC timestamp>.dump`, then backups older than 30 days pruned by key date. `--all true` backs up every registered schema and reports failures after trying them all. Nightly workflow `.github/workflows/backup.yml` (01:30 Monrovia) stays off until `BACKUPS_ENABLED=true` and the R2 secrets exist. Verified against local Storage S3: archive contains only that schema. 7 unit + 3 database tests.
- **2.8** (2026-10-24) CI `database` job starts local Supabase on the runner and runs all database tests; `docs/database.md` (tenancy model, project labels and secrets, access rules, one-email-per-client limitation, provisioning runbook incl. Exposed schemas, migrations, R2 backup setup); README and CLAUDE.md updated; session hook clears stale Docker PID files after a container restore. Full check green from clean; 67 database tests; audit clean.
- **2.9** (2026-10-24) Phase 2 self-audit: code review (10 findings, all fixed), security review (no exploitable findings), CI green on PR #5 including the database job.

- **Phase 3** (2026-10-24) `core/migrations/0004_billing.sql`: `billing_roles()`/`can_bill()` (products extend), gapless per-schema document numbers (CORE-08, concurrency-tested), line amounts computed in the database, `issue_invoice`, idempotent `record_payment` with receipt (CORE-06), `void_payment`/`void_invoice` with reasons (CORE-07), currency match enforced (CORE-05), `invoice_balances` view, never-delete triggers, `log_login()`. `packages/core`: money (bigint, CORE-04/05), `requireMember` with role and session-age checks (CORE-02, 5.3), settings (CORE-01), env, Supabase server/browser clients with schema, billing client, Dexie offline outbox with auto-sync and logout wipe (SPEC 10), Monrovia dates. `packages/pdf`: letterhead, invoice and receipt PDFs with number and generation time (CORE-10). Tests: 89 database, 43 core, 3 PDF (text-checked) plus visual check.

## Owner answers (2026-10-23, 2026-10-24)

- **Working rule (2026-10-24, overrides earlier per-phase rules):** save tokens. Full review and audit after every 5 phases (next after Phase 5), reported in an `.md` file under `docs/audits/` covering only critical or important items. If an audit finds nothing needing the owner, push, merge and continue automatically. Between audits: build, test, push, merge each phase without stopping for plan approval; keep chat updates short. Still ask before must-ask decisions (money/grading/payroll/clinical rule changes, schema beyond SPEC, auth approach changes, risky dependencies).

- Phase 2 plan approved. Backups go to Cloudflare R2. Dependabot PRs merged.

- No manual reviews by the owner: Claude reviews and audits its own work (code review, security review, tests, screenshots against the mockup), fixes findings, confirms CI is green, then asks permission to push/merge. Send screenshots when a phase includes UI.
- Install essential dependencies without asking; ask when a dependency is risky or critical.
- Leads storage: `corex_web` lives in its own Supabase project; the website server may use that project's service-role key (server-only). Rate limiting uses a Postgres table, not a new service.
- The LCC records system is out of scope for the MVP and moves to version 2. The School app is built from SPEC.md alone.
- Contacts: primary WhatsApp **+231 770 021 026**; also +231 775 178 905 and +231 777 352 002 (calls or WhatsApp).
- Address: Carey & Johnson Street, Monrovia, Liberia.
- Email: no real address yet. Use `info@cds.com` as a **placeholder** (see open questions).
- Logo: the supplied image is the official logo (`apps/web/public/brand/corex-logo.png`); the mockup's SVG mark matches it and is used for crisp rendering.

## Decisions made on the owner's behalf

| #   | Decision                                                                                                                                                          | Reason                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Lighthouse targets follow the prompt's Section 7 (Perf ≥ 90; A11y, Best Practices, SEO ≥ 95), stricter than SPEC 6.7                                              | Prompt Section 3 makes Section 7 part of every "Done when"                                                                       |
| D2  | Extra theme tokens beyond SPEC 5.4 (surface, primary-darker, ink-soft, border-subtle, border-strong, on-dark, warning, info, chart-2)                             | The mockup uses ~20 more colors; tokens keep them consistent. SPEC's 9 tokens stay canonical                                     |
| D3  | Footer uses `primary-darker` `#052F2D` (mockup) instead of `primary-dark`                                                                                         | Separates the footer from the dark CTA band above it                                                                             |
| D4  | `border-strong` `#7E918F` for form controls                                                                                                                       | `#D9E3E2` is 1.3:1 on white and fails WCAG 1.4.11 (needs 3:1)                                                                    |
| D5  | Tailwind v4 CSS-first theme in `packages/ui/src/styles/theme.css` instead of a JS "tailwind preset" in `packages/config`                                          | Tailwind v4 has no JS preset; `packages/config` holds tsconfig, ESLint, Prettier, Vitest and Next.js config                      |
| D6  | Phase 1 creates four minimal Next.js apps (no features)                                                                                                           | The shell needs a host to render; CI and Vercel need real targets                                                                |
| D7  | Tool versions: TypeScript 6.0, ESLint 9.39, Vitest 4.1, Playwright 1.63                                                                                           | Newest majors (TS 7, ESLint 10) are not yet supported by typescript-eslint / jsx-a11y; Playwright matches the installed browsers |
| D8  | Baseline CSP uses `'unsafe-inline'` for scripts and styles (no nonces) in Phase 1                                                                                 | Nonces force dynamic rendering. Revisit per app: apps (auth, dynamic) in Phase 3, website in Phase 4                             |
| D9  | Design-skill conflicts resolved in favor of SPEC: Inter and lucide-react kept (SPEC 2, 5.4); no dark mode (SPEC defines light tokens only)                        | SPEC outranks skills                                                                                                             |
| D10 | `typedRoutes` off in all apps                                                                                                                                     | The shared shell passes string hrefs to `next/link`; typed routes would reject them. Revisit if apps need it                     |
| D11 | jsdom 29 instead of 30                                                                                                                                            | jsdom 30 needs Node 22.22.2+; this environment has 22.22.0                                                                       |
| D12 | Top bar spans the full width with the sidebar below it                                                                                                            | Matches the mockup's AppPreview layout                                                                                           |
| D13 | `memberships` primary key is (user_id, role)                                                                                                                      | SPEC lets one user hold two roles (Admin + Clinician, Owner + Accountant); `has_role` checks any active row                      |
| D14 | Core grants administrators read access to billing tables but no writes; issuing invoices and posting payments go through Phase 3 server code and product policies | Keeps money rules (CORE-05..08) in one tested path                                                                               |
| D15 | Corrected core migrations 0002/0003 in place during the Phase 2 audit                                                                                             | They had never run outside throwaway test schemas; from now on applied migrations are immutable                                  |
| D16 | Invoice line amount = quantity x unit price rounded half away from zero to the minor unit (database and TypeScript agree)                                         | Standard commercial rounding; SPEC gives no rule                                                                                 |
| D17 | Payments above the balance due are refused; an invoice with posted payments must have them voided before the invoice can be voided                                | Conservative default; no credit or refund flow in SPEC                                                                           |
| D18 | Login pages and wiring the apps to Supabase move to each app's own phase (School: Phase 5)                                                                        | Phase 3 delivers the shared helpers; apps keep placeholders until their phase                                                    |

## Planned deviations from the mockup (Phase 4)

- Desktop "Services" nav item becomes a dropdown of the three services (mockup links straight to AI Automation; there is no `/services` index).
- On-request intro: drop "There is no demo yet" (SPEC 6.4 forbids a "coming soon" label). Finance FAQ: drop "planned for a later version" (SPEC 13).
- Product pages gain a Screenshots section (SPEC 6.3); AppPreview illustrations until real demo screenshots exist (Phases 7, 9, 11).
- Footer social links (SPEC 6.2) render only when set in `content/site.ts`.
- `/work` hidden from nav, footer and home when no published use cases; route 404s in production.
- Privacy draft: omit "We record which demo roles are used" unless cookie-free analytics is approved.
- Contact form: product options from the mockup, `?product=` prefill, honeypot field, plan radio optional (empty saved as `unsure`).

## Audit findings and fixes

Phase 1 self-checks (the formal audit of Phase 1 opens Phase 2):

- axe found two WCAG 2.5.3 label-in-name failures (user menu button, logo link); fixed in 1.6.
- Clean-checkout run found lint depending on generated Next types; fixed in 1.8.
- Found in Phase 2: `supabase/config.toml` `[auth.email] enable_signup = false` disabled email login entirely; fixed (public sign-up stays off via `[auth]`).
- Desktop sidebar was taller than the viewport after the full-width top bar change; fixed in 1.5.
- Prettier's Tailwind plugin did not know the custom theme; now reads `apps/web/app/globals.css`.
- Not yet measured: Lighthouse (website content arrives in Phase 4; the target applies there).

Phase 1 self-audit (code review + security review, 2026-10-24), all fixed:

- Top bar could overflow at 360px with pending changes: the count shows as a number on small phones (words kept for screen readers).
- CSP blocked Supabase Storage images (future org logos): `withCorex` now takes `supabaseUrl` for connect-src (https + wss) and img-src.
- Toasts covered the mobile bottom bar: offset above it.
- `Button` defaulted to submit inside forms: now `type="button"` unless set.
- Website skip link did not move focus: `main` is focusable; e2e asserts focus.
- `--project=<app>` started all four servers: only selected apps start.
- Turbo build cache ignored `.env*.local`: env files now part of the build hash.
- Duplicated page header and empty state in three apps: moved to `@corex/ui` (`PageHeader`, `EmptyState`).
- Session hook could rewrite the lockfile: now `--frozen-lockfile` like CI.
- Supabase helper hid a missing CLI and failed on a half-running stack: clear error, PATH includes local bin, start stops first.
- Security: no secrets tracked, no server env in client bundles, CI tokens read-only, `pnpm audit` clean; GitHub Actions pinned to commit SHAs with weekly Dependabot updates.

Phase 2 self-audit (code review + security review, 2026-10-24), all fixed:

- Postgres grants EXECUTE on new functions to PUBLIC and that cannot be revoked per schema: the runner now revokes it from PUBLIC and anon on every function after each run.
- Runner guard: any migration leaving a table without RLS or a view without `security_invoker` is rolled back.
- One email per client is enforced by a `memberships` trigger (admins and scripts), not only by provisioning; non-admins are rejected by RLS without learning about other organizations.
- `log_view` takes a uuid, needs a signed-in member, an existing table and an existing record; no service-role path.
- Project labels resolve only their own `DATABASE_URL_<P>` / `SUPABASE_*_<P>`; `db:provision` requires `--project`; local schemas go to the git-ignored `schemas.local.json`.
- Backups: R2-compatible checksum settings; per-object delete errors and write-stream errors are reported.
- Shared helpers for local Supabase status and PostgREST exposed schemas (never writes an empty list).
- CI database job pulls images from Docker Hub (ECR rate-limits GitHub runners).
- Migrations 0002/0003 were corrected in place: they had only run in throwaway test schemas, never in a real database (D15).

Security review notes below the exploit bar, for later phases: `log_view` lets a member confirm a record UUID exists in a table they cannot read (UUIDs are unguessable; revisit with CLN-02 in Phase 10); a target-organization admin could bypass the one-email rule with a crafted multi-row update (business rule only, no data exposure); Clinic must override `audit_row_visible()` before clinical tables exist (CLN-01).

## Open questions for the owner

1. **`BUSINESS.md` not received.** Needed before Phase 4 to confirm pricing copy (mockup prices are used until then).
1. **Placeholder email `info@cds.com`.** `cds.com` is a registered domain owned by someone else; mail sent to it would reach them. It stays a marked placeholder in content and must be replaced before the site goes public.
1. **Later-phase gaps** (to be raised in those phases' plans): per-app session timeout when demos share one Supabase project (5.3); cross-currency transfers (FIN-04); whether demo visitors may approve seeded records (11.3); notification email provider (6.6); backup storage provider (4.5); Vercel Pro plan before going public.
