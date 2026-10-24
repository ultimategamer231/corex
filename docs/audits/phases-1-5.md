# Audit after Phases 1 to 5

Date: 2026-10-24. Scope: everything on `main` plus Phase 5 (PR #8). Only critical or important items are listed.

## Result

No critical defects found. The checks below passed on the Phase 5 branch:

- `pnpm check`: format, lint, typecheck, unit tests and all five builds.
- 117 database tests, run as real `anon` and `authenticated` users. They cover isolation between clients, the audit trail, billing, and SCH-01, 02, 03, 05, 06 and 07.
- 70 website e2e tests and 23 School e2e tests. The School tests cover the full SPEC 7.6 flow, with axe, overflow and touch-target checks at 360/390/768/1440.
- The dependency audit is clean.

Security review of Phase 5:

- Every School write is checked twice: by role in the server action and again by row-level security or a database function.
- The rules SPEC marks [must] are enforced in the database, so calling the API directly does not bypass them: capacity, prerequisites, credit limit, grade lock, and reopen with a reason.
- The service-role key is used only after a Super Admin role check, and only to create sign-ins.
- Students see only their own published (locked) grades and their own fees.
- Instructors see only students on their own class lists.

## Needs your decision (important, not blocking)

1. **Grading details (D26).** SPEC gives the grading flow but not these details, so I chose conservative rules. Please confirm or change them:
   - The final score is the weighted average of the assessments, rounded to 2 decimals.
   - The letter comes from the grade scale.
   - Grades can only be submitted when the weights add up to 100% and every score is entered.
   - A Registrar who teaches a course cannot approve its grades.
   - For a repeated course, the latest attempt counts in the CGPA. This can be changed per school in Settings.
2. **An email provider is needed before going live.** Password-reset emails go through Supabase. Its built-in mailer allows only a few emails per hour and is not meant for production. A custom SMTP account must be added in Supabase (for example Resend, which the website can also use). Until then, new users get a temporary password shown once to the Super Admin (D25).
3. **Hosting for the demos (Phase 7).** Putting the demos online needs:
   - the root domain (`NEXT_PUBLIC_ROOT_DOMAIN` is still a placeholder);
   - a Vercel account on the Pro plan (Hobby does not allow commercial use);
   - a Supabase project for the demos.

   Phase 6 can be built without these, but Phase 7 cannot go live.

4. **Still open from earlier:**
   - `info@cds.com` is a placeholder; that domain belongs to someone else, so it must be replaced before launch.
   - `BUSINESS.md` has not been received; prices come from the mockup.
   - Nightly backups need the Cloudflare R2 secrets and `BACKUPS_ENABLED=true`.

## Known limits, planned for later phases

- **Offline.** Recording attendance and scores without a connection is built in Step 12 together with Clinic and Finance (D24). The School writes already use ids made on the device and inserts that ignore duplicates, so a retried save never creates two records.
- **Lower-risk findings from Phase 2, unchanged:**
  - a member can confirm whether a record id exists through `log_view`;
  - an administrator could bypass the one-email-per-client rule with a crafted multi-row update;
  - Clinic must hide clinical audit rows (`audit_row_visible`) before its clinical tables exist (Phase 10).
