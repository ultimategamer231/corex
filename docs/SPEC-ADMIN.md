# Corex Admin — Build Specification (addition to SPEC.md)

Version 1.0 · 29 October 2026

This file adds the Corex Admin app to the existing monorepo. `SPEC.md` (Version 1) still applies; where the two conflict, this file wins for `apps/admin` only. Business context is in `BUSINESS.md`.

---

## 0. Instructions for Claude Code

1. Version 1 is complete. Reuse its packages (`core`, `ui`, `pdf`, `db`, `config`), conventions, migration runner and tests. Do not duplicate what exists; extend it.
2. Before building, compare this spec with the code that actually exists (especially the website `leads` table, the core billing module and the core `audit_events` table) and report any mismatch with a recommended resolution.
3. Build in the order of Section 14. Do not start a block until the previous one passes its "Done when" checks.
4. Every rule marked **[must]** has an automated test, written in the same block.
5. Nothing in Section 15 (Not in this release) gets built.

---

## 1. What we are building

An internal back-office app for Corex staff at `admin.<domain>`:

| Area | Purpose |
| --- | --- |
| Leads | Work the quote and contact requests from the website (today they are only in Supabase and in Resend emails) |
| Clients | Organizations with a contract: contacts, contract, deployment details, documents |
| Subscriptions | Managed-plan renewals and Handover-plan warranties |
| Invoices and receipts | Create, discount, download as PDF, email, share by link, record payments, issue receipts |
| Dashboard | One screen showing what needs attention and how the business is doing |
| Activity log | A permanent record of everything done in the admin |
| Settings | Company details, invoicing, price list, renewal rules, team, security |

**One role only:** every admin can do everything. Accountability comes from the activity log, not from permissions.

**The admin never reads client system data** (student records, patients, finance data inside client apps). It stores business facts about clients only.

---

## 2. App, hosting and environment

- New app `apps/admin`, Next.js App Router, same stack as Version 1 (`SPEC.md` Section 2). Shares `packages/ui` theme tokens and shell patterns.
- Own Vercel project. Domain `admin.<domain>` (domain still to be decided; use `NEXT_PUBLIC_ADMIN_URL`).
- Search engines blocked: `robots.txt` disallow all, `X-Robots-Tag: noindex, nofollow` on every response.
- Data lives in the existing `corex_web` schema (where website leads already are). Apply the core migrations (settings, audit, billing) to `corex_web` through the existing migration runner as product `admin`.
- Supabase plan: `corex_web` currently sits on the Free tier, which has no automatic backups. The nightly schema backup from `SPEC.md` 4.5 **[must]** include `corex_web`.

New environment variables (add to `.env.example`, commented):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ADMIN_URL` | Base URL, used in emails and client view links |
| `RESEND_API_KEY` | Email sending (already used by the website) |
| `EMAIL_FROM` | Sender, e.g. `Corex Billing <billing@<domain>>` |
| `CLIENT_EMAIL_ENABLED` | `false` until the sending domain is verified in Resend (Section 9.6) |
| `CRON_SECRET` | Protects the scheduled job route |
| `TRUSTED_DEVICE_SECRET` | Signs the "trust this device" cookie |

---

## 3. Sign-in and team

### 3.1 Flow

1. **Invite:** an admin enters name and email in Settings → Team. The invited person receives an email with a one-time link (valid 72 hours) to set a password. No public sign-up exists.
2. **Password:** email + password through Supabase Auth. Minimum 12 characters.
3. **Email code:** after a correct password, a 6-digit code is emailed. The session is not usable until the code is verified.
4. **Trust this device (optional checkbox):** skips the email code on that device for 30 days.

### 3.2 Rules [must]

| ID | Rule |
| --- | --- |
| AUTH-01 | No admin route, server action, API route or database read works until the email code is verified. Enforce in middleware, in every server action, **and** in RLS (table `admin_sessions` keyed by the Supabase JWT `session_id` claim with `code_verified_at`), so a password-only session reads nothing |
| AUTH-02 | Codes: cryptographically random, stored hashed, expire after 10 minutes, single use, max 5 wrong attempts then the code is void |
| AUTH-03 | Code resend: at most 1 per minute and 5 per hour per admin |
| AUTH-04 | 5 failed passwords for an email (or 20 from one IP) in 15 minutes pauses sign-in for 15 minutes; the message never reveals whether the email exists |
| AUTH-05 | Sessions end after the inactivity timeout set in Settings (default 4 hours) |
| AUTH-06 | Trusted-device cookie: HttpOnly, Secure, SameSite=Lax, signed, bound to the admin; stored as a hash in `trusted_devices`; revoked when the admin is removed |
| AUTH-07 | Removing an admin signs them out everywhere at once. The last remaining admin cannot be removed |
| AUTH-08 | Sign-ins, failed sign-ins, code sends, invites, removals and password resets are written to the activity log |

In development, when `CLIENT_EMAIL_ENABLED=false` and Resend cannot deliver, print sign-in codes to the server console only. Never in production.

---

## 4. Data model (schema `corex_web`)

Money follows `SPEC.md` CORE-04/05: integer minor units plus currency; USD and LRD are never summed together. All tables use UUID keys, `created_at`, `updated_at`, `created_by`.

| Table | Key columns |
| --- | --- |
| `admins` | `user_id` (auth.users), `name`, `email`, `status` (`invited`/`active`/`removed`), `invited_by`, `last_active_at` |
| `admin_sessions` | `user_id`, `session_id` (Supabase JWT claim), `code_verified_at`, `ip`, `user_agent`, `last_seen_at` |
| `login_codes` | `user_id`, `code_hash`, `expires_at`, `attempts`, `used_at` |
| `trusted_devices` | `user_id`, `token_hash`, `expires_at`, `revoked_at` |
| `leads` | **existing table, extended:** `stage` (`new`/`contacted`/`demo_booked`/`quoted`/`won`/`lost`), `assigned_admin_id`, `follow_up_on`, `next_step`, `lost_reason`, `quote_amount_minor`, `quote_currency`, `quote_sent_at`, `converted_client_id`, `source` (`website`/`manual`) |
| `lead_activities` | `lead_id`, `type` (`note`/`call`/`whatsapp`/`meeting`/`demo`/`stage_change`/`form`/`quote`), `body`, `admin_id`. Append-only, like the activity log |
| `clients` | `name`, `country`, `city`, `address`, `source_lead_id`, `notes` |
| `client_contacts` | `client_id`, `name`, `title`, `email`, `phone`, `is_primary`, `is_billing` |
| `contracts` | `client_id`, `number` (`CT-YYYY-NNN`, sequential), `product` (`school_college`/`school_highschool`/`clinic`/`finance`/`custom`), `plan` (`managed`/`handover`), `total_minor`, `currency`, `signed_on`, `milestone_scheme` (default `50/30/20`) |
| `deployments` | `client_id`, `contract_id`, `product_version`, `environment` (`setup`/`staging`/`live`/`paused`/`ended`), `app_url`, `supabase_project_ref`, `schema_name`, `hosting`, `target_go_live`, `went_live_on`, `warranty_ends_on`, `hosting_cost_minor_per_month`, `hosting_cost_currency` |
| `subscriptions` | `client_id`, `contract_id`, `renewal_amount_minor`, `currency`, `starts_on` (go-live), `next_renewal_on`, `paused_at`, `ended_at` |
| `client_documents` | `client_id`, `name`, `storage_path`, `size_bytes`, `mime_type`; private bucket, signed URLs (10 minutes) |
| `price_list_items` | `name`, `kind` (`product`/`addon`), `managed_year1_minor`, `renewal_minor`, `handover_minor`, `unit_label`, `active` |
| `invoices`, `invoice_lines`, `payments`, `receipts` | **reuse the Version 1 core billing tables.** Add to `invoices`: `party_type = 'client'`, `contract_id`, `kind` (`milestone`/`renewal`/`custom`), `milestone_no`, `discount_type` (`percent`/`fixed`/null), `discount_value`, `discount_minor`, `discount_reason` (internal), `tax_rate_bp`, `tax_minor`, `note`, `sent_at`, `emailed_to`, `public_token_hash`, `public_expires_at` |
| `email_log` | `to`, `cc`, `subject`, `template`, `entity_type`, `entity_id`, `resend_id`, `status` (`queued`/`sent`/`failed`/`skipped_disabled`), `error` |
| `settings` | **reuse core table.** `config` holds: company details, tax ID, invoice and receipt prefixes, default terms (days), default currency, tax on/off and rate, payment methods (shown/hidden + text), renewal rules on/off, minimum renewal-to-hosting multiplier (default 3), session timeout |

Every table has RLS enabled, readable and writable only by an `active` admin with a verified session (AUTH-01). The anon role reads nothing except through the client view link route (Section 9.5).

---

## 5. Activity log

### 5.1 Contents

One append-only table. If the Version 1 core `audit_events` table can carry these columns, extend it instead of creating a second table, and report the choice.

Columns: `id`, `at`, `actor_type` (`admin`/`system`/`website`/`client_link`), `actor_admin_id`, `area` (`sign_in`/`leads`/`clients`/`invoices`/`payments`/`subscriptions`/`settings`/`team`/`system`), `action`, `entity_type`, `entity_id`, `summary`, `changes` (jsonb before → after), `ip`, `user_agent`, `prev_hash`, `row_hash`.

Written by:
- **Database triggers** on every admin-owned table for insert, update and delete, so no change can bypass the log.
- **Server code** for events that are not row changes: sign-in success and failure, code sent, invite sent, email sent or failed, PDF downloaded, CSV exported, client view link opened, scheduled job runs.

### 5.2 Rules [must]

| ID | Rule |
| --- | --- |
| LOG-01 | No role, including `service_role`, can update, delete or truncate log rows: privileges revoked **and** a `BEFORE UPDATE OR DELETE` trigger that raises an error. A test proves an update and a delete both fail |
| LOG-02 | Each row stores `row_hash = sha256(prev_hash + row content)`. `pnpm admin:verify-log` recomputes the chain and reports the first broken row |
| LOG-03 | Corrections are new entries, never edits. Voiding an invoice or payment writes its own entry with the reason |
| LOG-04 | The log page lists entries newest first, filters by admin, area and date range, searches summaries, expands to show `changes`, and exports the filtered set to CSV |
| LOG-05 | Secrets are never logged: no passwords, codes, tokens or full card/account numbers |

---

## 6. Screens and routes

The mockup (`corex-admin-mockup.zip`) is the visual reference. Rebuild it with the Version 1 UI kit and tokens. Text in square brackets is placeholder content.

| Route | Mockup file | Contents |
| --- | --- | --- |
| `/login` | `Login.dc.html` (step 1) | Email, password, forgot password |
| `/login/code` | `Login.dc.html` (step 2) | 6-digit email code, trust device, send new code |
| `/forgot-password`, `/reset-password`, `/invite/[token]` | — | Standard flows, same layout |
| `/` | `Main.dc.html`, `DashboardMobile.dc.html` | Dashboard (Section 7) |
| `/leads` | `Leads.dc.html`, `LeadsMobile.dc.html` | Table, board and mobile card views; stage tabs with counts; search; filters; CSV export; add lead |
| `/leads/[id]` | `LeadDetail.dc.html` | Original request, stage stepper, notes and activity, assignment, follow-up, quote, convert to client |
| `/clients` | `Clients.dc.html` | List with status filters and totals |
| `/clients/[id]` | `ClientDetail.dc.html` | Tabs: Overview (milestones, deployment, subscription, hosting-cost check), Invoices, Contacts, Documents, Activity |
| `/subscriptions` | `Subscriptions.dc.html` | Renewals with reminder status, Handover warranties, renewal rules summary |
| `/invoices` | `Invoices.dc.html` | Invoices and Receipts tabs; status chips; totals per currency |
| `/invoices/new` | `InvoiceNew.dc.html` | Client, terms, currency, milestone picker, line items, price list, discount, note, live preview |
| `/invoices/[id]` | `InvoiceDetail.dc.html`, `InvoiceDetailMobile.dc.html` | Document preview, download, email, WhatsApp text, client view link, record payment, receipts, history, void |
| `/activity` | `ActivityLog.dc.html` | Section 5 |
| `/settings/[section]` | `Settings.dc.html` | Company, Invoicing and payments, Price list, Renewals, Team, Security |
| `/i/[token]` | `InvoiceDoc.dc.html` | Public client view of one invoice (Section 9.5) |
| `/api/cron/daily` | — | Scheduled job (Section 10), protected by `CRON_SECRET` |

Shared: `Sidebar.dc.html` and `Topbar.dc.html` (global search, notifications, New menu, mobile drawer). The "Sample data" chip in the mockup appears only when sample data is loaded (Section 13).

---

## 7. Dashboard

| Block | Definition |
| --- | --- |
| New leads, last 7 days | Leads created in the last 7 days; sub-line: how many are still `new` |
| Open pipeline | Leads in `new`, `contacted`, `demo_booked`, `quoted`; sub-line: count and sum of quotes sent (per currency) |
| Outstanding | Sum of balances of `sent`, `partially_paid` and overdue invoices, **per currency**; sub-line: overdue count |
| Collected this year | Sum of posted payments this calendar year, per currency |
| Needs attention | Overdue invoices; follow-ups due today or tomorrow; uncontacted new leads; renewals due within 30 days; warranties ending within 45 days; clients past 30 days overdue (pause flag). Each links to its record |
| Lead pipeline | Count per stage; win rate = won ÷ (won + lost) this year |
| Collected by month | USD by month for the current year as a bar chart; LRD shown separately, never added |
| Renewals | Next renewals and grace periods |
| Recent activity | Last 6 activity log entries |

All figures come from the database through tested query functions, not computed in components.

---

## 8. Leads and clients

### 8.1 Leads [must]

| ID | Rule |
| --- | --- |
| LEAD-01 | Website submissions appear as stage `new`, source `website`, with every original form field read-only |
| LEAD-02 | Manual leads (source `manual`) need name, organization and phone or email |
| LEAD-03 | A likely duplicate (same phone or email as an existing lead or client contact) shows a warning with a link |
| LEAD-04 | Moving to `lost` requires a reason. Every stage change writes a `stage_change` activity |
| LEAD-05 | Notes and activities are append-only |
| LEAD-06 | A lead can be converted once. Conversion runs in one database transaction and creates: client, primary contact, contract, deployment (`setup`), subscription (Managed plan only), and optionally the milestone draft invoices; then sets stage `won` and `converted_client_id` |
| LEAD-07 | Leads export to CSV with the current filters |

### 8.2 Clients

- Status shown in lists is derived, not stored: `setting up` (deployment not live), `active`, `renewal due` (within 30 days), `grace period` (renewal unpaid past due), `paused`, `ended`, `in warranty` (Handover, before `warranty_ends_on`).
- Hosting-cost check: show a warning when the yearly renewal amount is below (monthly hosting cost × 12 × the multiplier from Settings). Compare only when both use the same currency; otherwise show "cannot compare".
- Documents: PDF, JPG, PNG up to 10 MB in a private bucket; download through signed URLs.

---

## 9. Invoices, payments and receipts

### 9.1 Creating

- Kinds: `milestone` (from a contract), `renewal`, `custom`.
- Milestones: the contract total split by the scheme (default 50/30/20). Amounts are computed in minor units; the last milestone takes any rounding remainder so the milestones always add up to the total.
- Lines: description, quantity, unit price; or prefilled from the price list. Price list changes never alter existing invoices.
- Currency per invoice: USD or LRD. One currency per invoice.

### 9.2 Totals [must]

| ID | Rule |
| --- | --- |
| INV-01 | subtotal = sum of lines |
| INV-02 | Discount is optional: percent (0–100) or fixed amount; percent rounds half up to the nearest minor unit; discount can never exceed the subtotal; the internal reason never prints |
| INV-03 | Tax applies only when turned on in Settings: one rate, applied after the discount, rounded half up. Off by default |
| INV-04 | total = subtotal − discount + tax. The discount and tax lines print only when they are not zero |
| INV-05 | Numbers (`CX-YYYY-NNNN`, `RC-YYYY-NNNN`) are assigned when an invoice is sent or a receipt is issued, sequential per prefix, never reused. Drafts have no number |
| INV-06 | Sent invoices cannot be edited; they are voided with a reason and replaced. Voided invoices stay visible, struck through |

### 9.3 Payments [must]

| ID | Rule |
| --- | --- |
| PAY-01 | Record amount, date, method (`orange_money`/`mtn_momo`/`bank_transfer`/`wire`/`cash`/`usdt`), reference. Currency must match the invoice |
| PAY-02 | Part payments allowed; a payment larger than the balance is rejected |
| PAY-03 | Each posted payment creates a receipt automatically, in the same transaction |
| PAY-04 | Status updates automatically: `sent` → `partially_paid` → `paid`; overdue is derived from the due date |
| PAY-05 | Payments are voided with a reason, never deleted; voiding recalculates the balance and status and voids its receipt |
| PAY-06 | Paying a renewal invoice moves the subscription's `next_renewal_on` forward one year |

### 9.4 Documents (PDF)

- New templates in `packages/pdf` matching `InvoiceDoc.dc.html`: invoice, receipt, and quote (same layout, title "QUOTE"). A4.
- Layout: logo and company name top left; large "INVOICE" / "RECEIPT" title, date and number top right; office address and "To:" block; teal table header row; lines with bold titles and small descriptions; totals right-aligned with a solid "TOTAL DUE" block (green "AMOUNT PAID" block on receipts); note on the left; "Thank you for your business"; footer in three columns: Questions, Payment info (from Settings), Terms and notes; generated date and time and page number (`SPEC.md` CORE-10).
- Drafts carry a "DRAFT" watermark and "Number assigned on sending".
- The on-screen preview and the PDF use the same data and must match.

### 9.5 Client view link [must]

| ID | Rule |
| --- | --- |
| LINK-01 | Each sent invoice gets a link `/i/<token>`: 32 random bytes, stored hashed, valid 30 days, can be regenerated (which revokes the old one) |
| LINK-02 | The page shows only that invoice, its status and balance, the payment instructions, and a PDF download. No other client or Corex data |
| LINK-03 | Expired, revoked or voided links show a plain "This link is no longer valid. Contact Corex." page |
| LINK-04 | Rate limited, `noindex`, and each first open per day is written to the activity log |

### 9.6 Email

- Templates (React Email or plain HTML through Resend): sign-in code, invite, invoice (PDF attached + client view link), receipt (PDF attached), renewal reminders.
- **The sending domain is not verified in Resend yet.** While `CLIENT_EMAIL_ENABLED=false`, the Email buttons show as disabled with the hint "Verify the sending domain in Settings to email clients", and Download plus Copy for WhatsApp still work. Every attempt is recorded in `email_log`.
- **Sign-in codes also need a verified domain to reach other admins.** Domain verification is a launch blocker for the admin in production.
- WhatsApp: "Copy for WhatsApp" copies a prepared message with amount, due date and client view link. No WhatsApp API in this release.

---

## 10. Scheduled job (daily, 07:00 Africa/Monrovia)

Use the scheduler Version 1 already uses (GitHub Actions or Vercel Cron) to call `/api/cron/daily` with `CRON_SECRET`.

| Step | Rule |
| --- | --- |
| Renewal invoice | 30 days before `next_renewal_on`, create the renewal invoice if none exists for that period, send it (email if enabled) |
| Reminders | 14 and 3 days before due, if unpaid |
| Grace | After the due date, the subscription is in grace for 30 days; nothing is switched off |
| Pause flag | At 30 days overdue, show "Pause flag" on dashboard and subscription. An admin exports the client's data, sends it and pauses by hand; the job never pauses anything |
| Warranties | Flag Handover warranties ending within 45 days |

**[must]** The job is idempotent (running it twice in a day changes nothing the second time), each rule can be switched off in Settings, and every run is logged.

---

## 11. Search, notifications and exports

- Global search (`Ctrl K` / `Cmd K` and the top bar field): leads by name, organization, phone or email; clients by name; invoices and receipts by number. Results grouped by type, keyboard navigable.
- Notifications bell: the "Needs attention" items, with an unread count.
- CSV exports: leads, invoices, receipts and the activity log, all respecting current filters, all written to the activity log.

---

## 12. Quality

All Version 1 quality standards apply (WCAG 2.2 AA, OWASP Top 10, security headers, Core Web Vitals, TypeScript strict, tests per `[must]` rule). In addition:

- Every write goes through a server action that validates with zod, checks the verified session, and runs inside a transaction where more than one table changes.
- Money and totals are computed in one tested module shared by the screen, the PDF and the database checks.
- Mobile: dashboard, leads, lead detail and invoice detail must be fully usable at 390 px.

---

## 13. Sample data

`pnpm admin:seed` loads the mockup's placeholder data (the leads, clients, contracts and invoices shown in the mockup) and marks every row `is_sample = true`. It refuses to run unless `ADMIN_ALLOW_SEED=true`, and never runs in production. `pnpm admin:unseed` removes only `is_sample` rows. The "Sample data" chip shows while any sample rows exist.

---

## 14. Build order

| Block | Build | Done when |
| --- | --- | --- |
| A1 | `apps/admin` scaffold, Vercel config, noindex, admin tables, sessions, invite, password + email code, lockout, timeout, trusted devices, activity log with hash chain and immutability | AUTH-01 to 08 and LOG-01 to 05 tests pass; sign-in works end to end in development |
| A2 | Leads list (table, board, cards), lead detail, notes, assignment, follow-ups, quotes, CSV export | LEAD-01 to 05 and 07 pass |
| A3 | Clients, contacts, contracts, deployments, subscriptions, documents, lead-to-client conversion | LEAD-06 passes; derived statuses tested |
| A4 | Invoices, discounts, tax setting, PDFs, numbering, payments, receipts, voids, client view link, email (behind the flag), WhatsApp text | INV, PAY and LINK rules pass; PDF matches preview |
| A5 | Dashboard, subscriptions page, daily job, search, notifications, settings, sample data seed | Dashboard figures match fixtures; job idempotency test passes |
| A6 | Hardening: security headers, rate limits, accessibility, E2E tests, backups include `corex_web`, README and runbook | Section 12 checks pass; E2E: website lead → convert → milestone invoice with discount → PDF → part payment → receipt → renewal job → log verified |

---

## 15. Not in this release

Multiple roles or permissions, authenticator apps, client portal accounts, online card or mobile money payments, WhatsApp API sending, support tickets, expense tracking, multi-branch billing, currency conversion between USD and LRD, automatic pausing of client systems.
