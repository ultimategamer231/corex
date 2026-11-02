# Corex Admin: going live and running it

Plain steps for the owner. Each step says where to click. Do them in order; each takes a few minutes. Nothing here costs money: Supabase, Vercel, GitHub and Resend free plans are enough.

You will need: the GitHub repository, the website's Supabase project, the Vercel account that hosts the website, and a Resend account.

## Before you start: two random secrets

Two settings below need a long random secret: `TRUSTED_DEVICE_SECRET` and `CRON_SECRET`. Make each one separately, for example with a password manager's generator: **48 characters, letters and numbers**. Keep them in your password manager. Never paste them into chat, email or a document.

## 1. Close public sign-up on the website's Supabase project

Supabase dashboard → the **website** project → **Authentication** → **Sign In / Providers** → turn off **Allow new users to sign up** → Save. Admin accounts are only created by invitation.

## 2. Add the admin tables to the website's database

1. GitHub → the repository → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → **New repository variable**: name `WEB_DB_PRODUCT`, value `admin`.
2. GitHub → **Actions** → **Website database** → **Run workflow** → Run.
3. Wait for the green tick. This cannot be undone, and the website keeps working as before.

## 3. Create the admin site on Vercel

1. Vercel → **Add New** → **Project** → import the same repository.
2. **Root Directory**: `apps/admin`. Framework: Next.js (detected).
3. **Environment Variables** (all for Production):

| Name                            | Value                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → website project → **Project Settings** → **API** → Project URL                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → publishable (anon) key                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Same page → secret (service_role) key. Server only; never share it                                                                    |
| `NEXT_PUBLIC_DB_SCHEMA`         | `corex_web`                                                                                                                           |
| `NEXT_PUBLIC_ADMIN_URL`         | The admin address, for example `https://corex-admin.vercel.app` (you will see it after the first deploy; update it then and redeploy) |
| `RESEND_API_KEY`                | Resend → **API Keys** → create one                                                                                                    |
| `EMAIL_FROM`                    | `Corex Admin <onboarding@resend.dev>` until your domain is verified                                                                   |
| `CLIENT_EMAIL_ENABLED`          | `false` (step 8 turns it on)                                                                                                          |
| `TRUSTED_DEVICE_SECRET`         | Your first random secret                                                                                                              |
| `CRON_SECRET`                   | Your second random secret                                                                                                             |

4. **Deploy**. Opening the address should show the Corex Admin sign-in page.

## 4. Tell GitHub where the admin is

GitHub → **Settings** → **Secrets and variables** → **Actions**:

- **Variables**: `ADMIN_URL` = the admin address from step 3; `EMAIL_FROM` = the same sender as in Vercel.
- **Secrets**: `ADMIN_CRON_SECRET` = the same value as `CRON_SECRET` in Vercel; `RESEND_API_KEY` = the same Resend key; `SUPABASE_URL_WEB` and `SUPABASE_SERVICE_ROLE_KEY_WEB` = the website project's URL and secret key (`DATABASE_URL_WEB` is already there from the website setup).

From now on the **Admin daily check** runs every morning at 07:00 Monrovia time. To check it once: **Actions** → **Admin daily check** → **Run workflow**; the log ends with `"ok":true`.

## 5. Invite yourself as the first admin

GitHub → **Actions** → **Admin first invite** → **Run workflow** → your name, a username (for example `fatu`) and `agamer0297@gmail.com` → Run.

- If your Resend account uses that same email address, the set-up link arrives by email.
- Otherwise open the run's log: the link is printed there. Use it straight away. It works once and expires after 72 hours.

Open the link, choose a password (at least 12 characters) and scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or 1Password). Then sign in.

## 6. Fill in your details

In the admin, **Settings**:

- **Company details**: legal name, address, phone, billing email. Printed on every invoice and receipt.
- **Invoicing and payments**: payment terms (7 days), and the **payment instructions** printed on invoices (Orange Money and MTN numbers, bank account).
- **Price list**: starting prices from the business plan. Correct them before the first invoice.
- **Renewals**: the rules are on by default; leave them on.
- **Team**: invite other admins. Each gets a one-time link to send them yourself (WhatsApp is fine).

## 7. Backups

Nightly backups are switched on separately (`docs/database.md`, "Backups": the `BACKUP_S3_*` secrets and the `BACKUPS_ENABLED` variable). Once on, they include all admin data. Restoring: `docs/restore.md`.

## 8. Later: email to clients

Until your own domain is verified in Resend, invoices are shared with **Download PDF** and **Copy for WhatsApp**, and renewal invoices wait as drafts for you to send. When the domain is verified (Resend → **Domains**):

1. Vercel → the admin project → **Settings** → **Environment Variables**: `EMAIL_FROM` = `Corex <billing@your-domain>`, `CLIENT_EMAIL_ENABLED` = `true` → redeploy.
2. GitHub variable `EMAIL_FROM` = the same sender.

From then on the daily check sends renewal invoices and reminders by email, and the **Email** button on invoices works.

## Day to day

- **Every morning**: the dashboard's **Needs attention** list and the bell show overdue invoices, follow-ups, new leads, renewals and ending warranties.
- **Renewals**: 30 days before a renewal, its invoice appears as a draft. Open it, check it, **Send invoice**, then **Copy for WhatsApp**.
- **Pause flag**: a client 30 days past renewal is flagged. Export their data, send it to them, and pause their system yourself. Nothing is paused automatically.
- **Lost phone**: another admin resets your authenticator in **Settings** → **Team**. If you are the only admin: `pnpm admin:reset-authenticator` (`apps/admin/README.md`).
- **Checking the activity log**: `pnpm admin:verify-log --project web` reports whether any entry was changed.

## If something goes wrong

| What you see                             | What to do                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in says it is paused for 15 minutes | Too many wrong passwords. Wait 15 minutes.                                                                                         |
| The daily check run is red               | Open the run: a 401 means `ADMIN_CRON_SECRET` differs from Vercel's `CRON_SECRET`; a 503 means `CRON_SECRET` is not set in Vercel. |
| A client says their link no longer works | Links last 30 days, and a new one replaces the old. Open the invoice → **New client view link**.                                   |
| The admin shows a "Sample data" chip     | Example data was loaded. Remove it: `pnpm admin:unseed --project web`.                                                             |
