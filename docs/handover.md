# Handing a system over to a client

A checklist for each new client, from an empty schema to staff using the system. Each step links to the detailed guide.

## 1. Before the first client

Once for the whole business:

- [ ] Supabase project for clients (separate from the demo project), with an email provider (custom SMTP, for example Resend) so invitations and password resets are delivered (`docs/database.md`).
- [ ] Vercel account on the Pro plan, or a server for Docker (`docs/deploy.md`).
- [ ] Nightly backups on: R2 bucket, GitHub secrets, `BACKUPS_ENABLED=true`, and one run checked by hand (`docs/database.md`).
- [ ] A restore rehearsal on a scratch schema (`docs/restore.md`).
- [ ] The real contact email on the website instead of the placeholder (`apps/web/content/site.ts`).

## 2. Set up the client

- [ ] Agree the schema name (`client_<short_name>`), the product and, for schools, the edition (College or High School).
- [ ] Provision: `pnpm db:provision --schema ... --product ... --org ... --admin-email ... --admin-name ... --project clients --redirect-to https://<client address>/auth/callback` (`docs/database.md`). Commit `schemas.json`.
- [ ] Expose the schema in Supabase (Project Settings > Data API).
- [ ] Deploy the app with the client's settings and domain (`docs/deploy.md`), and add the address to Supabase Auth's redirect URLs.
- [ ] The administrator accepts the invitation and signs in.

## 3. Configure with the client

- [ ] Settings: organization name, address, phone, email, letterhead line (shown on every PDF), currencies.
- [ ] Users: create each staff sign-in with the right role. Temporary passwords are shown once; staff change them with "Forgot your password?".
- [ ] Product setup:
  - **School:** calendar and terms, departments and programs or grade levels and sections, courses or subjects, fee structures, grade scale.
  - **Clinic:** service price list, and sign-ins for each clinician, nurse, receptionist and cashier.
  - **Finance:** accounts with opening balances, categories, customers and vendors, exchange rate, pay components and employees.
- [ ] Import existing records if agreed (students, patients, opening balances), then spot-check them with the client.

## 4. Train and go live

- [ ] Walk each role through its daily work, using the matching demo first if helpful (`docs/demos.md`).
- [ ] Install the app on staff devices and show offline use where it matters: attendance, patient registration and vitals, expenses (`docs/offline.md`).
- [ ] Agree a go-live date. On the day, check the first records, PDFs and reports together.
- [ ] Give the administrator: the address, their responsibilities (users, settings), and how to reach support.

## 5. After go-live

- [ ] Confirm the next morning that the nightly backup includes the new schema.
- [ ] Check in after the first week: questions, missing setup, and any records staff could not enter.
- [ ] Keep the client on the release train: new migrations are applied with `pnpm db:migrate:all --product <product> --project clients`, then the app is redeployed.
