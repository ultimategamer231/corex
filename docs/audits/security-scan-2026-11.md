# Security scan, November 2026

Scope: the website (`apps/web`), the School, Clinic and Finance systems and their public
demos, Corex Admin (`apps/admin`), the database layer (`packages/db`) and the GitHub
workflows. Done on 17 November 2026, after the audit-round features (search, dashboards,
system status, money report, support log, quotes, demo visits, the School demo APK).

Method: dependency audit (`pnpm audit --prod`), a search of every tracked file for keys,
tokens and private keys, a review of every public endpoint and server action, of
row-level security (each new table has database tests that act as a real signed-in
user and as an outsider), of redirects, uploads, exports, security headers and of what
the GitHub workflows print. Only critical and important items are listed in detail.

## Summary

| #   | Finding                                              | Severity  | Status                          |
| --- | ---------------------------------------------------- | --------- | ------------------------------- |
| 1   | Next.js 16.4.3 had a published vulnerability         | Important | Fixed (16.4.6, PR #44)          |
| 2   | Admin invite link could appear in public GitHub logs | Important | Fixed (this PR)                 |
| 3   | Redirect after sign-in can lead to another website   | Important | Waiting for the owner (sign-in) |
| 4   | Scripts allowed inline in the security policy        | Medium    | Recommendation                  |
| 5   | Two moderate advisories in a build-only dependency   | Low       | Accepted, watched               |

Nothing critical was found: no secrets in the repository, no table readable or writable
without the right role, and every public endpoint checks a secret, a signed link or a
rate limit.

## Findings

### 1. Next.js 16.4.3 (fixed)

The framework version in use had a published security advisory; the build stopped with
`SecurityFatalError`. All apps were upgraded to 16.4.6 in PR #44 before any other work.

### 2. The admin invite link in public logs (fixed)

The repository is public, so anyone can read GitHub Actions logs. The **Invite the first
admin** workflow printed the account's 72-hour set-up link in its log whenever email was
not configured. Someone watching the repository could have opened the link first and
taken the account.

Fix: the workflow now refuses to run until `RESEND_API_KEY` and `EMAIL_FROM` are set, and
the invite command never prints the link when it runs inside GitHub Actions (it fails
with a clear message instead). On a computer it still prints the link as before. No
other workflow prints a link, password or key; the demo password is public by design.

### 3. Redirect after sign-in (fixed, owner approved)

The sign-in pages of School, Clinic, Finance and Admin return the person to the page they
asked for (`/login?next=/students`). The check refuses `//other-site`, but browsers read
`/\other-site` the same way, so a crafted link such as
`https://demo-school.corexlr.com/login?next=/%5Cevil.example` signs the person in and then
sends them to `evil.example`, which could imitate a Corex page and ask for the password
again. It needs someone to click a crafted link and sign in.

Fix (approved by the owner, 17 November 2026): one shared check, `safeRedirectPath` in
`@corex/core/auth`, reads the path the way a browser does and accepts it only if it stays
on the same site; anything else goes to the dashboard. School, Clinic, Finance and Admin
use it. Sign-in itself did not change. Unit tests cover the tricks above, and an
end-to-end test signs in through such a link and lands on the dashboard.

### 4. Inline scripts in the security policy (recommendation)

Every app sends a strict Content-Security-Policy (no plugins, no framing, forms and
connections only to our own site and Supabase, HSTS, nosniff, a strict referrer policy).
It still allows inline scripts, which Next.js needs unless each page is given a random
nonce. Moving to nonces would make every page rendered per request (slower, no static
pages). React already escapes all text and the one raw script (structured data on the
website) escapes `<`, so the risk is low. Revisit if a page ever has to show HTML that
users wrote.

### 5. Build-only dependency advisories (accepted)

`pnpm audit --prod` reports two moderate advisories (`glob` and `minimatch`), reached
only through `@serwist/build`, which runs while building the offline service worker. They
need a crafted file pattern, which only our own build supplies. Nothing in production
uses them. Update when Serwist moves to the patched versions.

## Checked and in order

- **Secrets**: no keys, tokens, private keys or real `.env` files are tracked. The
  service-role key is used only on the server; the only public `NEXT_PUBLIC_` value
  besides the Supabase URL and anonymous key is the Cloudflare analytics beacon token,
  which is public by design.
- **Database**: row-level security on every table, no access for anonymous users,
  admins-only policies on the new admin tables (status checks, expenses, support items,
  demo visits), and functions that write on behalf of the server granted to the service
  role only. Database tests: 275 passing.
- **Public endpoints**: the cron routes (daily check, status check) and the demo-visit
  route need a 32-character secret compared in constant time, with 10 wrong tries per
  hour per address before they answer 429. The website quote form drops bots and allows 5
  requests per address per hour. Demo sign-in: 10 per address per 15 minutes. Admin
  sign-in: password and authenticator code; 5 wrong passwords per name (20 per address)
  and 5 wrong codes per 15 minutes; idle timeout.
- **System status checks**: only public `https://` addresses, no IP addresses or local
  names, no ports or passwords in the address, redirects not followed, 15-second limit.
- **Old quote requests**: deleted after a year by a function only the server may run;
  setting its switch by hand does not let anyone else delete a lead (tested).
- **Exports and uploads**: CSV cells that start with `=`, `+`, `-` or `@` are quoted so
  spreadsheets do not run them; Excel exports write text cells only. Uploads accept only
  JPEG, PNG, WebP or PDF up to a size limit, into private storage.
- **Demo APK**: the app link file names only the package and the public fingerprint of
  the signing key; the signing key stays with the owner (`docs/apk.md`).
- **Backups**: written to a private Cloudflare R2 bucket (encrypted at rest), never to
  GitHub. End-to-end test reports uploaded by CI contain only test data.

## For the owner

1. Delete the unused Cloudflare API token made while testing analytics (Cloudflare →
   My Profile → API Tokens), so only the token the admin uses remains.
2. Keep the APK signing key and its passwords private (`docs/apk.md`, step 2).
