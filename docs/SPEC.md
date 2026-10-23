# Corex Digital Solutions — Build Specification (MVP)

Version 1.0 · 23 October 2026

This is the build specification for the Corex MVP. It is written for the developer and for Claude Code. Business, pricing, legal and sales material lives in `BUSINESS.md` and is not needed to build.

---

## 0. Instructions for Claude Code

1. Read this whole file before writing code. Build in the order of **Section 12 (Build order)**. Do not start a step until the previous step's "Done when" checks pass.
2. Build only what this file specifies. Anything in **Section 13 (Not in MVP)** must not be built, even partially.
3. When something is ambiguous or missing, stop and ask. Do not invent business rules (grading rules, fee rules, tax rates, clinical rules).
4. Every rule marked **[must]** has a test. Write the test in the same step as the feature.
5. Never put a Supabase service-role key, database URL or secret in client code or in the repository.
6. Keep each app usable on a phone screen (360 px wide) as well as desktop.
7. After each build step, give a short report: what was built, which tests pass, what is left.

---

## 1. What we are building

Corex sells ready-built business software that each client organization can test in a live demo before buying. The MVP has:

| Deliverable | Description |
| --- | --- |
| `apps/web` | Corex marketing website: products, demos, services, use cases, pricing, quote requests |
| `apps/school` | School Management System, one codebase with two editions: **College/University** and **High School** |
| `apps/clinic` | Clinic Management System: patient records, appointments, billing |
| `apps/finance` | Financial Management System: income, expenses, invoices, payroll, reports |
| Demos | Four public demos with sample data and role logins, reset nightly |

The School app is adapted from the existing LCC records system (Corex has permission to reuse it). Reuse its code and data structures where they fit this spec; this spec wins where they differ.

---

## 2. Tech stack (fixed)

| Area | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Runtime | Node.js 22 LTS |
| Framework | Next.js (latest stable, App Router), TypeScript strict mode |
| UI | Tailwind CSS, shadcn/ui, lucide-react icons |
| Forms and validation | react-hook-form + zod (same zod schemas on client and server) |
| Tables | TanStack Table |
| Charts | Recharts |
| Dates | date-fns, default timezone `Africa/Monrovia` |
| Database, auth, storage | Supabase (Postgres, Supabase Auth, Supabase Storage) via `@supabase/ssr` and `@supabase/supabase-js` |
| PDFs | `@react-pdf/renderer`, generated on the server |
| Offline | Serwist (service worker / PWA) + Dexie (IndexedDB) |
| Excel export | `exceljs` |
| Unit and integration tests | Vitest |
| End-to-end tests | Playwright |
| CI | GitHub Actions: lint, typecheck, unit tests, build on every push; E2E on main |
| Local database | Supabase CLI (local Docker stack) for development |
| Packaging for handover | One Dockerfile per app |

Do not add other major libraries without asking.

---

## 3. Repository layout

```
apps/
  web/         marketing website
  school/      school app (EDITION=college | highschool)
  clinic/      clinic app
  finance/     finance app
packages/
  core/        auth helpers, roles, audit, settings, money, offline queue, billing module
  ui/          shadcn components, Corex theme tokens, layout shell (sidebar, header, offline badge)
  pdf/         PDF templates (letterhead, receipt, invoice, report card, transcript, payslip)
  db/          SQL migrations per product, migration runner, seed scripts, demo reset
  config/      shared tsconfig, eslint, tailwind preset
.github/workflows/
docs/          operations notes (provisioning, backup, restore)
```

---

## 4. Tenancy and hosting model

### 4.1 The model

- **One Supabase project can hold several clients. Each client gets its own Postgres schema** (for example `client_bethel_school`). A client's tables, data and storage bucket live only in that schema and bucket.
- Large or sensitive clients (clinics, big colleges) can get a **dedicated Supabase project**. The code must not care which: an app instance is pointed at a project + schema through environment variables.
- **Each client gets its own deployed app instance** (its own URL, its own environment variables). There is no shared multi-tenant front end.
- The four demos are four schemas in one Supabase project reserved for demos: `demo_college`, `demo_highschool`, `demo_clinic`, `demo_finance`. Demo projects never hold real client data.
- Corex's own website data (quote requests, use cases if stored) lives in a separate project or schema named `corex_web`, never in a demo or client schema.

### 4.2 Environment variables (per app instance)

| Variable | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyz.supabase.co` | Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | | Public key (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | | Server only. Used for provisioning, seeding, admin user creation |
| `NEXT_PUBLIC_DB_SCHEMA` | `client_bethel_school` | Schema this instance reads and writes |
| `NEXT_PUBLIC_STORAGE_BUCKET` | `client_bethel_school` | Storage bucket for this client |
| `EDITION` | `college` / `highschool` | School app only |
| `DEMO_MODE` | `true` / `false` | Enables demo restrictions (Section 10) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | placeholder until decided | Used by the website for demo links |
| `DATABASE_URL` | | Migration runner and seed scripts only, never in an app |

Every Supabase client is created with `{ db: { schema: process.env.NEXT_PUBLIC_DB_SCHEMA } }`.

### 4.3 Isolation rules [must]

Supabase Auth is shared by all clients in one project, so isolation is enforced by **membership inside each schema**:

1. Each schema has a `memberships` table (`user_id`, `role`, `status`). A user can act on a schema only if they have an active membership row in **that** schema.
2. Every table in every client schema has RLS enabled. Every policy calls the schema's helper `has_role(text[])`, which checks the current user's active membership in that schema.
3. A logged-in user of client A who calls client B's schema through the API receives no rows and cannot write. Test this explicitly.
4. The `anon` role has no access to any client table. Only `authenticated` users with membership can read or write.
5. Server code (route handlers, server actions) re-checks role permissions before every write, in addition to RLS.
6. The service-role key is used only in scripts and server-only provisioning code.
7. Known limitation: one email address can belong to only one client inside the same Supabase project. Document this in `docs/`.

### 4.4 Migrations

- SQL migrations live in `packages/db/<product>/migrations/NNNN_name.sql` and use the placeholder `{{schema}}` for the schema name. Shared tables live in `packages/db/core/migrations/` and are applied to every schema.
- `pnpm db:migrate --schema <name> --product <school|clinic|finance>` applies core + product migrations to one schema, inside a transaction, and records them in `{{schema}}._migrations`.
- `pnpm db:migrate:all --product <x>` loops over every schema registered for that product (registry file `packages/db/schemas.json`) and stops on the first failure.
- `pnpm db:provision --schema <name> --product <x> --org "<name>" --admin-email <email>` creates the schema, applies migrations, grants `usage` to `authenticated`, creates the storage bucket and the first Super Admin, and prints the reminder to add the schema to **Exposed schemas** in the Supabase API settings.
- Do not use the Supabase CLI migration system for client schemas (it is per project, not per schema). The CLI is used for local development only.

### 4.5 Backups

- `pnpm db:backup --schema <name>` runs `pg_dump --schema=<name>` and writes a compressed, dated file to the configured backup storage (S3-compatible bucket; credentials via env).
- A GitHub Actions workflow runs it nightly for every registered client schema and keeps 30 days.
- `docs/restore.md` documents restoring one schema into a scratch schema and checking record counts. This restore must be tested once before the first real client goes live.

---

## 5. Shared core (`packages/core`, `packages/ui`, `packages/pdf`)

### 5.1 Tables present in every client schema

| Table | Key columns |
| --- | --- |
| `settings` | single row: `org_name`, `logo_path`, `address`, `phone`, `email`, `letterhead_text`, `base_currency` (`USD`/`LRD`), `enabled_currencies` text[], `timezone`, product-specific JSON `config` |
| `memberships` | `user_id` (auth.users), `role` text, `status` (`active`/`suspended`), `display_name`, `created_at` |
| `audit_events` | `id`, `actor_id`, `action` (`create`/`update`/`delete`/`view`/`approve`/`void`/`login`), `table_name`, `record_id`, `before` jsonb, `after` jsonb, `reason`, `created_at` |
| `files` | `id`, `bucket_path`, `owner_table`, `owner_id`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at` |
| `announcements` | `id`, `title`, `body`, `audience_roles` text[], `audience_filter` jsonb, `created_by`, `published_at` |
| `invoices` | `id`, `number` (sequential per schema), `party_type`, `party_id`, `currency`, `status` (`draft`/`issued`/`partially_paid`/`paid`/`void`), `issue_date`, `due_date`, `notes`, `created_by` |
| `invoice_lines` | `id`, `invoice_id`, `description`, `quantity`, `unit_amount_minor`, `amount_minor` |
| `payments` | `id`, `invoice_id`, `amount_minor`, `currency`, `method` (`cash`/`mobile_money`/`bank`/`other`), `reference`, `received_at`, `received_by`, `status` (`posted`/`void`), `void_reason` |
| `receipts` | `id`, `number` (sequential), `payment_id`, `issued_at` |

The invoice/payment/receipt module is shared by School (fees), Clinic (billing) and Finance (sales invoices).

### 5.2 Core rules [must]

| ID | Rule |
| --- | --- |
| CORE-01 | Organization name, logo, letterhead, currencies and enabled modules come from `settings`, never hardcoded |
| CORE-02 | Every write is permission-checked on the server and by RLS; bypassing the UI does not bypass permissions |
| CORE-03 | Create, update, delete, approve and void on business records write an `audit_events` row via a database trigger with `actor_id = auth.uid()` |
| CORE-04 | Money is stored as `bigint` minor units (cents) plus a `currency` code. Never use floating point for money |
| CORE-05 | Amounts in different currencies are never summed together without an explicit saved exchange rate; every total shows its currency |
| CORE-06 | Primary keys are UUIDs generated by the client for anything that can be created offline; inserts use `on conflict (id) do nothing` so a retried request never creates duplicates |
| CORE-07 | Posted payments and financial records are never deleted; they are voided with a reason, and the original stays visible |
| CORE-08 | Invoice and receipt numbers are sequential per schema and never reused |
| CORE-09 | Lists are paginated (25 per page default), searchable and filterable, with clear empty and error states |
| CORE-10 | PDFs carry the organization letterhead, the document number, generation date and time |

### 5.3 Auth

- Email + password via Supabase Auth. No public sign-up in client apps: users are created by Admin/Super Admin (server action using service role, then a `memberships` row).
- Password reset by email. Session timeout: 8 hours for School and Finance, 4 hours for Clinic.
- Suspended membership = user cannot access the schema even with a valid session.

### 5.4 UI shell and brand

Layout: left sidebar (collapsible to a bottom bar on mobile), top bar with organization name and logo, user menu, online/offline badge with pending-sync count.

Theme tokens (use as Tailwind CSS variables; the marketing site and all apps share them; client apps may override `primary` with the client's brand color later):

| Token | Hex | Use |
| --- | --- | --- |
| `primary` | `#0B6A67` | Navigation, headings, brand |
| `primary-dark` | `#064644` | Footer, dark panels, hover on primary |
| `accent` | `#FF5A12` | Primary call-to-action buttons only |
| `accent-hover` | `#E04A08` | Hover / pressed on accent |
| `tint` | `#E6F2F1` | Light sections, cards |
| `ink` | `#0F1F1E` | Body text |
| `muted` | `#5B6B6A` | Secondary text |
| `border` | `#D9E3E2` | Dividers, inputs |
| `background` | `#FFFFFF` | Page background |

Fonts: Plus Jakarta Sans (headings), Inter (body), via `next/font`. Logo file: `apps/web/public/brand/corex-logo.png` (to be supplied; use a text placeholder until it exists).

UX rules: inline validation messages, confirmation dialog for void/delete/lock actions, visible keyboard focus, currency and date units shown in every table header that holds them.

---

## 6. Website (`apps/web`)

### 6.1 Routes

| Route | Content |
| --- | --- |
| `/` | Home (6.2) |
| `/software` | Catalog: 3 core products (School shown with both editions) + link to on-request systems |
| `/software/school` | School product page with two demo buttons: College and High School |
| `/software/clinic` | Clinic product page |
| `/software/finance` | Finance product page |
| `/software/on-request` | Other systems built on request (6.4) |
| `/services/ai-automation`, `/services/it-consultancy`, `/services/training` | One page each |
| `/work` | Use cases list (6.5) |
| `/work/[slug]` | Use case detail |
| `/pricing` | Plans A and B explained, starting prices (from a config file) |
| `/about` | Company page |
| `/contact` | Quote request form + WhatsApp + email |
| `/legal/terms`, `/legal/privacy`, `/legal/license` | Placeholder legal pages with a visible "Draft" notice until real text is supplied |

All product, pricing, service and use case content lives in typed files under `apps/web/content/` (TypeScript or MDX), not in a database.

### 6.2 Home page sections, in order

1. Hero: headline "Business software you can test before you pay", one supporting line, buttons **Try a live demo** (accent) and **Talk to us on WhatsApp**
2. Three product cards (School, Clinic, Finance): screenshot, three key capabilities, **Try demo** and **Learn more**
3. **See all systems** link to `/software`
4. How it works: Try the demo → Get a quote → We customize and deploy → You go live
5. Two plans side by side: Managed (we host) vs Handover (you host)
6. Why Corex: works offline for key tasks, USD and LRD support, local support, you own your data
7. Our work: 3 use case cards linking to `/work/[slug]`
8. Services strip: AI Automation, IT Consultancy, Training
9. FAQ (accordion)
10. Final call to action and footer (WhatsApp, email, social links, legal links)

### 6.3 Product page template

Problem it solves → feature list grouped by module → roles → screenshots → **demo credentials box** with one-click "Log in as" buttons per role (links to the demo subdomain with the role preselected) → plan pricing → FAQ → **Request this system** (WhatsApp link with the product name prefilled).

### 6.4 On-request systems

List these with a short description and a **Request this** button only (no demo button, no "coming soon" label): Business & POS, Church Management, Pharmacy, Hotel & Guesthouse, Property & Rental, Payroll & HR, NGO & Project, Construction, Fleet & Transport, Tender & Procurement, Warehouse & Inventory, Auto Repair & Spare Parts, Restaurant & Food Business, Delivery & Dispatch, Loan & Microfinance, Printing & Graphics Shop, Farm & Agricultural, Membership & Association.

### 6.5 Use cases (`/work`)

Content file `apps/web/content/work/*.mdx` with frontmatter:

```yaml
slug: sample-use-case-1
title: "Placeholder: Website for a Monrovia travel agency"
client: "Placeholder Client"
industry: "Travel"
type: client        # client | concept
year: 2026
summary: "One-sentence result."
stack: ["Next.js", "Tailwind", "Supabase"]
liveUrl: ""
cover: /work/placeholder-1.png
gallery: []
draft: true
```

Body sections: The problem · What we built · Result · Screenshots.

- Create **3 placeholder use cases** (`sample-use-case-1/2/3`) with `draft: true`, neutral placeholder images and text clearly marked "Placeholder".
- In production builds, entries with `draft: true` are hidden; if no published entries exist, the "Our work" home section and `/work` nav link are hidden. In development, drafts show with a "Draft" badge.
- `type: concept` entries show a "Concept project" badge on the card and detail page.

### 6.6 Leads

- Quote form fields: name, organization, country, product (select), plan interest (Managed/Handover/Not sure), phone/WhatsApp, email (optional), message, consent checkbox ("Corex may contact me about this request").
- Server action validates with zod, rejects honeypot-filled submissions, rate-limits by IP (5 per hour), stores in `corex_web.leads` (`id`, fields above, `source_page`, `created_at`, `status` default `new`), and sends a notification email to the team (provider via env; skip silently in development).
- WhatsApp links: `https://wa.me/<number>?text=<encoded message>`; the number comes from `apps/web/content/site.ts`.
- No lead-management UI in MVP; leads are viewed in the Supabase dashboard.

### 6.7 Website done when

- All routes render on mobile and desktop with no broken links (Playwright crawl test).
- Quote form stores a lead and shows a success state; invalid input shows inline errors.
- Demo buttons open the correct demo subdomain.
- Draft use cases hidden in production build, shown in development.
- Lighthouse performance and accessibility ≥ 90 on Home.

---

## 7. School Management System (`apps/school`)

One app, two editions selected by `EDITION`. Shared: students, guardians, attendance, fees, announcements, portals, dashboard. Different: academic structure, grading, and course planning (College only).

### 7.1 Roles

| Role | College | High School | Can | Cannot |
| --- | --- | --- | --- | --- |
| Super Admin | yes | yes | Settings, users, roles, everything below | Bypass audit log |
| Registrar | yes | yes | Admissions, academic setup, enrollments, approve course plans (College), approve and lock grades, publish results, transcripts/report cards | Record payments |
| Instructor / Teacher | Instructor | Teacher | Attendance and grade entry for **assigned** offerings/subjects only | Approve own grades, see other classes |
| Bursar | yes | yes | Fee structures, invoices, payments, receipts, fee reports | Edit grades |
| Student | yes | yes | View own profile, published grades, attendance, balance; College: plan and submit course registration | Change approved records |
| Parent | no | yes | View linked children's published grades, attendance, balance | View other students |

### 7.2 Shared tables

| Table | Key columns |
| --- | --- |
| `academic_years` | `name` (e.g. 2026/2027), `starts_on`, `ends_on`, `is_current` |
| `terms` | `academic_year_id`, `name` (Semester 1/2), `starts_on`, `ends_on`, `is_current`, College: `registration_opens_on`, `registration_closes_on` |
| `students` | `student_number` (unique, generated: `<prefix>-<year>-<seq>`), names, `sex`, `date_of_birth`, `phone`, `email`, `address`, `photo_file_id`, `status` (`active`/`withdrawn`/`graduated`/`suspended`), `user_id` (nullable link to portal login) |
| `guardians` | names, `relationship`, `phone`, `email`, `user_id` (Parent login, High School) |
| `student_guardians` | `student_id`, `guardian_id`, `is_primary` |
| `attendance` | `id` (client UUID), `date`, `student_id`, `class_ref_type`, `class_ref_id`, `status` (`present`/`absent`/`late`/`excused`), `recorded_by`, `note` |
| `fee_structures` | `academic_year_id`, `term_id` (nullable), `applies_to` (program or grade level), `item`, `amount_minor`, `currency` |

Fees use the shared invoices/payments/receipts (Section 5.1) with `party_type = 'student'`.

### 7.3 College edition

| Table | Key columns |
| --- | --- |
| `departments` | `name`, `code` |
| `programs` | `department_id`, `name`, `code`, `award` (Certificate/Diploma/Associate/Bachelor), `total_credits_required`, `duration_terms` |
| `courses` | `department_id`, `code`, `title`, `credits`, `description` |
| `course_prerequisites` | `course_id`, `prerequisite_course_id` |
| `program_requirements` | `program_id`, `course_id`, `requirement_type` (`core`/`elective`), `recommended_term` (1..n) |
| `program_enrollments` | `student_id`, `program_id`, `start_term_id`, `status` (`active`/`completed`/`withdrawn`) |
| `course_offerings` | `course_id`, `term_id`, `section`, `instructor_membership_id`, `capacity`, `schedule_text`, `status` (`open`/`closed`) |
| `course_registrations` | `student_id`, `offering_id`, `status` (`planned`/`submitted`/`approved`/`rejected`/`dropped`), `submitted_at`, `decided_by`, `decided_at`, `decision_note` |
| `assessments` | `offering_id`, `name`, `weight_percent`, `max_score` |
| `assessment_scores` | `id` (client UUID), `assessment_id`, `student_id`, `score`, `entered_by` |
| `final_grades` | `offering_id`, `student_id`, `numeric_score`, `letter`, `grade_points`, `status` (`draft`/`submitted`/`approved`/`locked`), `approved_by`, `locked_at` |
| `grade_scale` | `min_score`, `max_score`, `letter`, `grade_points`, `is_passing` (configured per institution) |

**Course planning (College only) [must]:**

1. While a term's registration window is open, a Student opens **Course planning**: sees their program requirements, courses completed (approved/locked passing grades), courses in progress, and open offerings for the term.
2. The student adds offerings to a plan (`planned`). The app validates and blocks with clear messages: prerequisite not passed, course already passed, offering full, duplicate course in the same term, total credits above `settings.config.max_credits_per_term` (default 21) or below `min_credits_per_term` (default 12, warning only).
3. The student submits the plan (`submitted`); after submission they cannot edit unless the Registrar returns it.
4. The Registrar sees a queue of submitted plans, approves or rejects each course with an optional note. Approved registrations become the offering's class list.
5. Capacity is checked again at approval; concurrent approvals must not exceed capacity (enforce in the database).
6. After the window closes, only the Registrar can add or drop registrations, with a reason (audited).

**Grades (College):** Instructor enters assessment scores → system computes the weighted numeric score and maps letter and grade points from `grade_scale` → Instructor submits → Registrar approves → Registrar locks. Locked grades cannot be edited; the Registrar can reopen with a mandatory reason (audited).

**GPA [must]:** term GPA = Σ(grade_points × credits) / Σ(credits) over locked grades in the term; CGPA over all terms. Courses without grade points (e.g. withdrawn) excluded. Test against hand-computed fixtures across at least 3 terms, including a repeated course (latest attempt counts; confirm this rule with the Registrar setting `settings.config.repeat_policy`, default `latest`).

**Outputs:** semester grade report PDF and transcript PDF (all terms, GPA per term, CGPA, credits earned), both with letterhead and document number.

### 7.4 High School edition

| Table | Key columns |
| --- | --- |
| `grade_levels` | `name` (Grade 7 … Grade 12), `order` |
| `sections` | `grade_level_id`, `academic_year_id`, `name` (A, B…), `homeroom_teacher_membership_id` |
| `subjects` | `name`, `code` |
| `section_subjects` | `section_id`, `subject_id`, `teacher_membership_id` |
| `student_placements` | `student_id`, `section_id`, `academic_year_id` (one per student per year) |
| `marking_periods` | `term_id`, `number`, `name`, `is_exam`, `weight` |
| `period_scores` | `id` (client UUID), `student_id`, `section_subject_id`, `marking_period_id`, `score` (0–100), `status` (`draft`/`submitted`/`approved`/`locked`), `entered_by` |
| `promotions` | `student_id`, `academic_year_id`, `decision` (`promoted`/`repeat`/`conditional`), `decided_by`, `note` |

- High School students **cannot** choose courses. Subjects come from their section.
- Marking periods are configurable per school. Default: 2 semesters, each with 3 marking periods and 1 semester exam; semester average = average of periods and exam using `weight`. Pass mark from `settings.config.pass_mark` (default 70). Confirm these defaults with the first school client before go-live.
- Same approve/lock/reopen flow as College, per section-subject and marking period.
- Outputs: report card PDF per marking period and per semester (subjects, scores, averages, rank in section optional via setting, attendance summary, teacher remarks field).
- Year end: Registrar records promotion decisions; next year's placements are created from them.

### 7.5 Shared school workflows

- **Admissions:** create student (photo optional), link guardian(s), generate student number, warn on likely duplicates (same name + date of birth), then enroll (College: program enrollment; High School: section placement). Optionally create portal logins for student and guardian.
- **Attendance:** daily per section (High School) or per offering session (College), by assigned teacher/instructor. Corrections by Registrar with reason.
- **Fees:** Bursar defines fee structures; generate invoices per student for a term in bulk; record full or partial payments in USD or LRD; issue receipts; debtor list with balances per currency.
- **Portals:** Student and Parent see only published (locked) grades, attendance summary, fee balance and announcements.
- **Dashboard:** enrollment counts, today's attendance rate, fees collected vs outstanding (per currency), pending approvals.

### 7.6 School done when [must]

- SCH-01: Duplicate student numbers impossible; duplicate-person warning shown.
- SCH-02: Teacher cannot record attendance or scores for a class they are not assigned to (API test).
- SCH-03: Locked grade edit fails; reopen requires reason and writes audit event.
- SCH-04: GPA/CGPA fixtures match; High School averages fixtures match.
- SCH-05: Course plan validations (prerequisite, credit limit, capacity, duplicate) each have a passing test; capacity cannot be exceeded under concurrent approvals.
- SCH-06: Partial fee payment in LRD produces correct balance, receipt and debtor report.
- SCH-07: Student can view only their own records; Parent only linked children (API test).
- SCH-08: Report card, grade report and transcript PDFs render with correct data and letterhead.
- E2E: new student → enrollment → course plan approved (College) / placement (High School) → scores → approval → lock → PDF.

---

## 8. Clinic Management System (`apps/clinic`)

Scope: outpatient clinics and medical centers. Patient records, appointments, billing.

### 8.1 Roles

| Role | Can | Cannot |
| --- | --- | --- |
| Admin | Settings, users, service price list, operational reports | Read clinical notes (unless also given Clinician role) |
| Clinician (Doctor) | Open encounters, write and sign clinical notes, view full patient history | Billing changes |
| Nurse | Record vitals and intake for an encounter; view vitals and allergies | Write or change diagnosis/assessment |
| Receptionist | Register and search patients, book/reschedule/cancel appointments, manage walk-in queue | See clinical notes or vitals |
| Cashier | Invoices for visits, payments, receipts, balances | See clinical notes or vitals |

### 8.2 Tables

| Table | Key columns |
| --- | --- |
| `patients` | `id` (client UUID), `patient_number` (generated), names, `sex`, `date_of_birth`, `phone`, `address`, `next_of_kin_name`, `next_of_kin_phone`, `has_allergies` bool, `allergy_notes`, `possible_duplicate_of` (nullable), `created_by` |
| `appointments` | `patient_id`, `clinician_membership_id`, `starts_at`, `duration_minutes`, `reason`, `status` (`booked`/`checked_in`/`completed`/`cancelled`/`no_show`), `cancel_reason` |
| `queue_entries` | `patient_id`, `arrived_at`, `status` (`waiting`/`with_nurse`/`with_clinician`/`done`), `encounter_id` |
| `encounters` | `patient_id`, `appointment_id` (nullable), `clinician_membership_id`, `status` (`open`/`closed`), `opened_at`, `closed_at` |
| `vitals` | `id` (client UUID), `encounter_id` (nullable while offline), `patient_id`, `temperature_c`, `pulse_bpm`, `bp_systolic`, `bp_diastolic`, `resp_rate`, `weight_kg`, `height_cm`, `spo2`, `recorded_by`, `recorded_at` |
| `clinical_notes` | `encounter_id`, `complaints`, `history`, `examination`, `assessment` (diagnosis text), `plan`, `prescriptions_text`, `author_membership_id`, `version`, `supersedes_id`, `signed_at` |
| `services` | `name`, `code`, `price_minor`, `currency`, `active` |
| `patient_files` | uses core `files` with `owner_table = 'patients'` |

Billing uses the shared invoices/payments/receipts with `party_type = 'patient'` and an added `payer_type` (`self`/`insurance`/`company`) and `payer_name` on invoices.

### 8.3 Rules [must]

- CLN-01: `clinical_notes` and `vitals` are readable only by Clinician (notes and vitals) and Nurse (vitals only). Receptionist, Cashier and Admin get zero rows (RLS test, including direct API calls and direct URLs).
- CLN-02: Opening a patient's clinical record writes an `audit_events` row with `action = 'view'` (server-side, not client-side).
- CLN-03: Signed notes are never edited in place. A correction creates a new version with `supersedes_id`; the history shows all versions with authors and times.
- CLN-04: Appointment double-booking for the same clinician at overlapping times is blocked with a clear message.
- CLN-05: Cancelled appointments remain in history.
- CLN-06: Attachments: PDF, JPG or PNG only, max 10 MB, stored in the client bucket under `patients/<patient_id>/`, served via signed URLs that expire in 10 minutes, access follows clinical permissions.
- CLN-07: Invoice totals equal the sum of service lines; receipts reconcile to payments.
- CLN-08: Possible duplicate patients (same name + date of birth, or same phone) are flagged at registration and after offline sync; merge is not in MVP (flag only).

### 8.4 Screens

Patient search/registration · Patient profile (demographics, allergies banner, visits timeline, files) · Appointments calendar (day view per clinician) · Walk-in queue · Encounter screen (vitals panel + notes form + sign) · Billing (create invoice from encounter services, payments, receipt) · Dashboard (patients seen today, appointments today, revenue today and month per currency, outstanding balances) · Reports (daily cash report, revenue by service, visits by period; PDF and Excel export).

### 8.5 Clinic done when

- All [must] rules above have passing tests.
- E2E: register patient → book appointment → check in → nurse vitals → clinician note signed → cashier invoice → partial payment → receipt.
- Demo data contains only fictional patients.

---

## 9. Financial Management System (`apps/finance`)

A cash-flow, invoice and payroll manager for small businesses and NGOs. Not a full accounting package; the UI and reports must not call themselves "accounting" or "balance sheet".

### 9.1 Roles

| Role | Can | Cannot |
| --- | --- | --- |
| Owner / Admin | Everything, including settings, users, payroll approval | Delete posted records |
| Accountant | Transactions, invoices, payroll preparation, reports | Manage users; approve payroll unless also Owner |
| Staff | Record income and expense entries | Payroll, reports export, settings, voiding |

### 9.2 Tables

| Table | Key columns |
| --- | --- |
| `accounts` | `name`, `type` (`cash`/`bank`/`mobile_money`), `currency`, `opening_balance_minor`, `opened_on`, `active` |
| `categories` | `name`, `type` (`income`/`expense`), `active` |
| `counterparties` | `name`, `type` (`customer`/`vendor`/`both`), `phone`, `email` |
| `transactions` | `id` (client UUID), `type` (`income`/`expense`/`transfer`), `date`, `account_id`, `to_account_id` (transfers), `category_id`, `counterparty_id`, `amount_minor`, `currency`, `fx_rate_to_base` numeric(18,6), `base_amount_minor`, `memo`, `receipt_file_id`, `status` (`posted`/`void`), `void_reason`, `reversal_of_id`, `invoice_payment_id`, `created_by` |
| `exchange_rates` | `date`, `from_currency`, `to_currency`, `rate` (reference values to prefill entry; the rate saved on each transaction is what reports use) |
| `employees` | names, `employee_number`, `position`, `department`, `start_date`, `base_salary_minor`, `currency`, `payment_method`, `bank_or_wallet_ref`, `status` |
| `pay_components` | `name`, `kind` (`allowance`/`deduction`), `calc` (`fixed`/`percent_of_base`), `default_value`, `active` |
| `employee_components` | `employee_id`, `pay_component_id`, `value` (overrides default) |
| `payroll_runs` | `period_month`, `status` (`draft`/`approved`/`paid`), `prepared_by`, `approved_by`, `approved_at` |
| `payslips` | `payroll_run_id`, `employee_id`, `gross_minor`, `total_allowances_minor`, `total_deductions_minor`, `net_minor`, `currency` |
| `payslip_lines` | `payslip_id`, `name`, `kind`, `amount_minor` (snapshot of components at approval time) |

Account balance = opening balance + posted transactions (computed, never stored). Sales invoices use the shared invoices/payments/receipts with `party_type = 'counterparty'`; recording an invoice payment also creates the matching income transaction.

### 9.3 Rules [must]

- FIN-01: Every transaction needs date, account, currency, amount > 0, and category (income/expense). Invalid input rejected on server.
- FIN-02: A retried submission with the same transaction ID creates one transaction (idempotency test).
- FIN-03: `fx_rate_to_base` and `base_amount_minor` are saved on each transaction and never recalculated; changing exchange rates later does not change past reports.
- FIN-04: A transfer moves money between two accounts and leaves the total of all balances (in base currency) unchanged.
- FIN-05: Posted transactions are voided, not deleted; voiding creates a reversal and keeps the original visible.
- FIN-06: Payroll: components are configurable per client; no tax or social security rate is hardcoded. Payslips snapshot their lines at approval, so later component changes do not alter past payslips. Approval requires Owner/Admin; approved runs are read-only. Marking a run `paid` creates expense transactions.
- FIN-07: Staff cannot see payroll or export reports (RLS test).
- FIN-08: Exports (PDF/Excel) match on-screen totals for the same filters.

### 9.4 Screens

Dashboard (income vs expenses by month chart, expenses by category, balances per account, top customers, overdue invoices) · Transactions (list, filters, add income/expense/transfer, attach receipt photo) · Invoices · Counterparties · Accounts · Payroll (employees, components, runs, payslip PDFs) · Reports: Income & Expense Summary (labelled "cash basis"), Income/Expense by category and period, Payroll summary, Account statement; PDF and Excel export · Settings.

### 9.5 Finance done when

- All [must] rules have passing tests with fixed fixtures (including mixed USD/LRD data).
- E2E: create accounts → record income and expense (one offline) → transfer → invoice with partial payment → payroll run approved and paid → reports match expected totals.

---

## 10. Offline mode (all three apps)

### 10.1 Rule

**Offline mode only creates new records. Editing or deleting existing records always requires a connection.** New records cannot conflict, which removes merge logic from the MVP.

| App | Works offline | Requires connection |
| --- | --- | --- |
| School | Recording attendance; entering scores for an assessment/marking period that has no scores yet for that student | Login, editing existing scores, approvals, locking, course planning, fees, PDFs, settings |
| Clinic | Patient registration; recording vitals | Login, clinical notes (never stored on the device), appointments, billing, patient search beyond the device's cached list, reports |
| Finance | New income and expense entries (with receipt photo up to 2 MB) | Login, transfers, invoices, payroll, voids, reports, settings |

### 10.2 Implementation

- PWA via Serwist: installable on Windows, Android and other platforms; app shell and static assets cached.
- Dexie stores an outbox: `{ id (UUID), table, payload, created_at, attempts, last_error, status }`.
- Each offline form writes to the outbox and shows the record immediately with a "Pending sync" badge.
- Sync runs on reconnect, on app focus and every 60 seconds while online. Each item is sent via a server action that re-checks the user's current membership and role (a user suspended while offline cannot sync).
- Server inserts use `on conflict (id) do nothing`; a success or "already exists" response removes the item from the outbox.
- Failed items stay in the outbox with the error shown; the user can retry or discard (discard asks for confirmation).
- Top bar shows: Online / Offline, and "N changes waiting".
- Cached reference data for offline forms (class lists, patient list for vitals, accounts and categories) is refreshed on each online login.
- On logout or session expiry, the Dexie database for that user is cleared. If the outbox is not empty, warn before logout.

### 10.3 Offline done when [must]

- OFF-01: Record attendance / patient registration / expense in airplane mode, reconnect, and the record appears once on the server.
- OFF-02: Sending the same outbox item twice creates one record.
- OFF-03: A user suspended while offline cannot sync; items show a clear error.
- OFF-04: Logout clears local data after warning about unsynced items.

---

## 11. Demos

### 11.1 Demo instances

| Demo | Subdomain | Schema | App + env |
| --- | --- | --- | --- |
| College | `demo-college.<domain>` | `demo_college` | `apps/school`, `EDITION=college`, `DEMO_MODE=true` |
| High School | `demo-school.<domain>` | `demo_highschool` | `apps/school`, `EDITION=highschool`, `DEMO_MODE=true` |
| Clinic | `demo-clinic.<domain>` | `demo_clinic` | `apps/clinic`, `DEMO_MODE=true` |
| Finance | `demo-finance.<domain>` | `demo_finance` | `apps/finance`, `DEMO_MODE=true` |

`<domain>` comes from `NEXT_PUBLIC_ROOT_DOMAIN` (not yet decided).

### 11.2 Demo logins

Password for every demo account: `Demo@2026`. Emails:

| Demo | Accounts |
| --- | --- |
| College | `admin@college.demo.corex.test`, `registrar@…`, `instructor@…`, `bursar@…`, `student@…` |
| High School | `admin@school.demo.corex.test`, `registrar@…`, `teacher@…`, `bursar@…`, `student@…`, `parent@…` |
| Clinic | `admin@clinic.demo.corex.test`, `doctor@…`, `nurse@…`, `reception@…`, `cashier@…` |
| Finance | `owner@finance.demo.corex.test`, `accountant@…`, `staff@…` |

The demo login page lists every role with a **Log in as** button that fills the credentials. The website links can preselect a role via `?role=registrar`.

### 11.3 Demo behaviour when `DEMO_MODE=true`

- Fixed banner on every screen: "Demo with sample data. Resets every night." plus a **Get this system** button linking to the website quote page with the product prefilled.
- Disabled (button hidden and server rejects): password change, creating or suspending users, changing roles, settings changes, real email sending, uploads over 1 MB, exports over 200 rows.
- Rate limit: 10 logins per IP per 15 minutes; 60 writes per user per minute.
- Seed records created by the seed script are marked `is_seed = true` (column added to main tables in demo schemas via a demo-only migration); visitors can view but not edit or void them. Visitors can create and edit their own new records, which are wiped at reset.

### 11.4 Seed data

`pnpm demo:seed --demo <college|highschool|clinic|finance>` builds realistic, fully fictional Liberian data with fixed random seed (same data every run):

| Demo | Data |
| --- | --- |
| College | 3 departments, 4 programs, 40 courses with prerequisites, 2 years of terms, 300 students across programs, offerings with instructors, completed grades for past terms (GPAs varied), current term open for registration with some plans submitted, fee invoices with mixed payment states in USD and LRD |
| High School | Grades 7–12, 2 sections each, 12 subjects, 360 students with guardians, marking periods with scores for completed periods, attendance for the last 60 school days, fees with mixed states |
| Clinic | 400 fictional patients, 18 months of visits with vitals and notes, appointments for the coming 2 weeks, today's queue, service price list, invoices with mixed payment states |
| Finance | 3 accounts (cash, bank, mobile money) in USD and LRD, 18 months of income and expenses with seasonal variation, 25 customers/vendors, 30 invoices, 12 employees, 12 approved payroll runs |

Use Liberian names, counties and towns, realistic amounts. Never use real people's data.

### 11.5 Nightly reset

GitHub Actions workflow at 02:00 Africa/Monrovia: for each demo schema, truncate data tables, re-run the seed, ensure demo auth users and memberships exist with the published password. The job also keeps the demo Supabase project active. Log success/failure; on failure, notify the team email.

---

## 12. Build order

Each step ends with its "Done when" checks passing in CI.

| Step | Build | Done when |
| --- | --- | --- |
| 1 | Monorepo, tooling, CI, `packages/config`, `packages/ui` theme + shell, local Supabase | `pnpm build`, lint, typecheck and an empty test pass in CI; shell renders with Corex tokens |
| 2 | `packages/db`: migration runner, provision, backup scripts, core tables, RLS helpers, audit triggers | Provision two test schemas; cross-schema isolation test passes (4.3); audit trigger test passes |
| 3 | `packages/core`: auth, memberships, roles, settings, money utilities, shared billing module, offline outbox; `packages/pdf` letterhead, invoice, receipt | Money, idempotency and billing tests pass; receipt PDF renders |
| 4 | `apps/web` (all routes, content files, 3 draft use cases, quote form) | Section 6.7 checks pass |
| 5 | `apps/school` College edition, adapted from the LCC system | Section 7.6 checks for College pass |
| 6 | `apps/school` High School edition | Section 7.6 checks for High School pass |
| 7 | College and High School demos: seed, demo mode, reset workflow; deploy and link from website | Both demos live on subdomains; reset job green |
| 8 | `apps/finance` | Section 9.5 checks pass |
| 9 | Finance demo | Live and resetting |
| 10 | `apps/clinic` | Section 8.5 checks pass |
| 11 | Clinic demo | Live and resetting |
| 12 | Offline tests across apps, Dockerfiles, `docs/` (provision, backup, restore, handover) | Section 10.3 passes; restore of one schema tested and documented |

---

## 13. Not in MVP (do not build)

- **Website:** online payments or checkout, lead-management UI, blog, multi-language
- **All apps:** native desktop or mobile apps (PWA only), SMS/WhatsApp notifications, two-factor authentication, per-visitor demo sandboxes, editing existing records offline, conflict merging
- **School:** timetable generation, learning management (assignments, online classes), library, hostel, online fee payment, WAEC export formats, advisor role separate from Registrar
- **Clinic:** pharmacy and stock, lab order workflow, inpatient wards and beds, insurance claim submission, telemedicine, patient merge, emergency-access override, malware scanning of uploads
- **Finance:** double-entry ledger and chart of accounts, balance sheet, bank reconciliation, inventory, budgets, NGO grant/donor tracking, tax filing, automatic tax calculation

When the code makes a later version easier at no extra cost (for example, transactions stored against accounts so a ledger can be added later), do it; otherwise leave it out.
