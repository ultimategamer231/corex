# Audit after Phases 6 to 10

Date: 2026-10-25. Scope: everything on `main` (Phases 6-9) plus Phase 10 (PR #13). Only critical or important items are listed.

## Result

No critical defects found. Checks run on the Phase 10 branch:

- `pnpm check`: format, lint, typecheck, unit tests and all five builds.
- 181 database tests, run as real `anon` and `authenticated` users. They cover client isolation, audit, billing, SCH, FIN and CLN-01 to CLN-08, and the demo layer.
- End-to-end tests with axe, overflow and touch-target checks at 360/390/768/1440: School (both editions), the College demo, Finance, the Finance demo and Clinic. Clinic and Finance were re-run after the last change (59 passed).

Security review:

- Every write is checked twice: by role in the server action, then again by row-level security or a database function.
- The service-role key is used in only four places. Each one comes after a role check, or after the member's own read of the record:
  - creating sign-ins;
  - counting demo sign-in attempts;
  - storing receipt and patient files;
  - signing short-lived file links.
- Clinical notes and vitals stay private through the API, the audit log and direct URLs (CLN-01). Clinicians read notes and vitals, Nurses read vitals only, and everyone else gets nothing.
- Patient files are hidden even from the Admin unless they also hold a clinical role.

## Fixed during this audit

1. **Clinic workflow steps could be skipped through the API** (important). Front desk staff could update appointments and queue entries directly. That let a direct API call:
   - mark an appointment checked in or completed;
   - move an appointment to another patient;
   - link a queue entry to any visit.

   No data was exposed, but the visit workflow could be bypassed. Migration `clinic/0002_workflow_guards.sql` now limits direct changes to what the screens do (cancel, no show, reschedule while booked, queue status before the visit). It has 2 new database tests.

2. **One-line forms were pushed to the right** (visual), in Clinic and in three Finance forms. Fixed in PR #13.

## Needs your decision (important, not blocking)

1. **Clinic defaults (D44-D49).** SPEC gives the rules but not these details. Please confirm or change:
   - Allergies show to every role, as a safety banner. Vitals and notes stay clinical-only (D46).
   - Bills come only from the price list, have no due date, and may be linked to a visit (D45).
   - A visit closes only after its draft notes are signed or deleted (D48).
2. **Vercel plan.** You are deploying the website on the free Hobby plan. That is fine for previews, but Hobby is for non-commercial use. Client systems and the public demos need the Pro plan.
3. **Each product app needs a hosted Supabase project** before it can be deployed: School, Finance and Clinic. That is the deferred demo-hosting item.
4. **Still open from earlier:**
   - an email provider for password resets;
   - the root domain for demo links;
   - `info@cds.com` is a placeholder;
   - `BUSINESS.md` has not been received;
   - R2 secrets for backups.

## Known limits, planned for later phases

- **Offline capture** is built in Step 12 for all three apps (D24). Writes already use ids made on the device, so a retried save never creates two records.
- **Clinic demo** is Phase 11; the Clinic demo login page is a stub until then.
- **Lower-risk findings, unchanged:**
  - a member can confirm whether a record id exists through `log_view`;
  - an administrator could bypass the one-email rule with a crafted multi-row update;
  - demo write limits are checked by the app, not on direct API calls (D35). The database still blocks the risky demo writes.
