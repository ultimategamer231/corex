# Audit after Phases 11 and 12

Date: 2026-10-25. Scope: the Clinic demo (Phase 11) and offline mode, Docker, restore and the guides (Phase 12). This completes the build order in SPEC.md 12. Only critical or important items are listed.

## Result

No critical defects found. Checks on the final branch:

- `pnpm check`: format, lint, typecheck, unit tests and all builds. `pnpm audit` is clean.
- 185 database tests, including the demo layer and a full backup and restore round trip.
- End-to-end tests for every app, the four demos, and offline mode in each product app (OFF-01 to OFF-04 in the Clinic, plus Finance and School).
- The Clinic Docker image was built, started and checked: pages, service worker, security headers, non-root user.

Security review of the offline sync:

- Every synced record is checked twice. The sync action checks the member's current access and role, and validates the record with the same rules as the online form. Row-level security then checks the insert again.
- Who recorded it (`recorded_by`, `entered_by`) is always the signed-in member, never a value sent by the device.
- Inserts never overwrite: an id that already exists is reported as already stored.
- Demo write limits apply to sync as to any other change.

## Fixed during this audit

1. **Clinical pages were kept on the device** (important, SPEC.md 10.1: clinical notes are never stored on the device). The service worker kept every page opened online, including visits with notes and patient records with the latest assessment.
   - Clinic visits and patient records now always go to the network.
   - In all apps, PDFs, report exports and files from storage are never kept.
   - An end-to-end test reads the device cache to prove it. It fails without the fix.
2. **Dependency advisory.** The service-worker tooling pulled in `zod` 4.6.5 (GHSA-mrhx-c7xc-m3w5). Every copy is now pinned to 4.6.7.
3. **Sign-ins waited on demo resets.** While a demo was being rebuilt, every sign-in in that Supabase project waited up to about 20 seconds (demo migration `0004`).

## Needs your decision (important, not blocking)

1. **Pages kept on staff devices (D51).** Offline forms rely on the service worker keeping the pages last opened online. It never keeps clinical pages, PDFs or files.
   - They are deleted on sign-out and when a session expires.
   - A device whose browser is simply closed keeps them until the next sign-in.
   - Staff on shared computers should sign out at the end of the day. If you prefer, offline mode can be offered only on devices the clinic or school owns.
2. **Vercel.** The website project on Vercel fails a few seconds after it starts, before the website is built. A clean local build of the same code succeeds. The cause is in the Vercel project settings; the first lines of its build log will show it. Client systems and demos also need the Pro plan.
3. **Still deferred:**
   - the email provider;
   - demo hosting and the root domain;
   - the real contact email (`info@cds.com` is a placeholder);
   - `BUSINESS.md`;
   - R2 secrets for backups.

   `docs/handover.md` lists them as the steps before the first client.

## Known limits

- **Offline vitals** are recorded from the queue's intake page. A visit page needs a connection, because it holds clinical notes.
- **Restore** brings back the database only. Sign-ins (Supabase Auth) and uploaded files are not in a backup, so restore within the same Supabase project (`docs/restore.md`).
