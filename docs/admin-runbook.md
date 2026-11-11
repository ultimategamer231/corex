# Corex Admin: running it

Plain steps for the owner.

Setting it up (the domain, email, Vercel, Supabase, GitHub, your first admin account and backups) is in **`docs/go-live.md`**, with every value filled in for `corexlr.com`. This page covers using the admin afterwards.

## Day to day

- **Every morning**: the dashboard's **Needs attention** list and the bell show overdue invoices, follow-ups, new leads, renewals and ending warranties.
- **Renewals**: 30 days before a renewal, the daily check sends the renewal invoice by email from `billing@corexlr.com` (with `CLIENT_EMAIL_ENABLED=true`). You can also share it with **Copy for WhatsApp**.
- **Invoices**: after **Send invoice**, use **Email** (PDF attached, with a client view link) or **Copy for WhatsApp**.
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
