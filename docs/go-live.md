# Going live on corexlr.com

One guide for everything: the domain, email, the website, the four demos and Corex Admin. Do the parts in order. Each step says where to click and what to type, and each part ends with a check.

Everything here is on free plans: Namecheap (where the domain was bought), Cloudflare, Zoho Mail, Vercel, Supabase, Resend and GitHub.

## The addresses

| Address                          | What it is                         | Vercel project       |
| -------------------------------- | ---------------------------------- | -------------------- |
| `corexlr.com`, `www.corexlr.com` | The website                        | `corex`              |
| `admin.corexlr.com`              | Corex Admin, for you and your team | `corex-admin`        |
| `demo-college.corexlr.com`       | School demo, College edition       | `corex-demo-college` |
| `demo-school.corexlr.com`        | School demo, High School edition   | `corex-demo-school`  |
| `demo-clinic.corexlr.com`        | Clinic demo                        | `corex-demo-clinic`  |
| `demo-finance.corexlr.com`       | Finance demo                       | `corex-demo-finance` |

Email. Two services share the domain without getting in each other's way:

- **Zoho Mail** holds the inboxes people read: your own mailbox (for example `fatu@corexlr.com`) and group addresses that reach several staff.
- **Resend** sends the apps' automatic emails (invoices, receipts, reminders, admin invites, quote alerts). Nobody reads mail in Resend.

| Address               | In Zoho                                   | Used by the apps                                                      |
| --------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `hello@corexlr.com`   | A group (or alias) reaching you and staff | Shown on the website; new quote requests are sent here                |
| `billing@corexlr.com` | A group (or alias)                        | Invoices and receipts are sent from it; clients' replies land in Zoho |
| `website@corexlr.com` | Nothing                                   | Sends the quote-request alerts                                        |

## Before you start: two random secrets

Make two passwords in a password manager or at 1password.com/password-generator: **48 characters, letters and numbers, no symbols**. Call them **Secret A** and **Secret B**. Keep them in your password manager. Never paste them into chat, email or a document.

---

## Part 1. Move the domain's settings (DNS) to Cloudflare

The domain stays registered at Namecheap. Cloudflare only manages its settings. The website keeps working while you do this.

1. Go to **dash.cloudflare.com** and create a free account (or sign in).
2. Click **Add a domain** (or **Onboard a domain**), type `corexlr.com`, and continue. Choose the **Free** plan.
3. Cloudflare copies the records it finds. On the **DNS records** list, make sure these two exist. Add any that are missing with **Add record**:

   | Type  | Name  | Content                | Proxy status |
   | ----- | ----- | ---------------------- | ------------ |
   | A     | `@`   | `76.76.21.21`          | DNS only     |
   | CNAME | `www` | `cname.vercel-dns.com` | DNS only     |

   **Proxy status must be "DNS only"** (a grey cloud, not orange) for every record that points to Vercel. Click the orange cloud to turn it grey. If Vercel's **Domains** page shows a different value for a record, use Vercel's value.

4. Cloudflare then shows **two nameservers**, for example `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`. Keep that page open.
5. In another tab, go to **namecheap.com** → **Domain List** → **Manage** next to `corexlr.com`.
6. Under **Nameservers**, choose **Custom DNS**, type the two Cloudflare nameservers, and click the green tick.
7. Back in Cloudflare, click **Continue** / **Check nameservers**. It can take from 10 minutes to a few hours. Cloudflare emails you when `corexlr.com` is **Active**.

**Check:** `https://corexlr.com` still opens the website. In Vercel → `corex` project → **Settings** → **Domains**, `corexlr.com` shows **Valid Configuration**.

---

## Part 2. Email

### 2a. Your mailboxes and group addresses (Zoho Mail)

Zoho's free plan has up to 5 users, used on the web at mail.zoho.com and in the Zoho Mail phone app. Do not turn on Cloudflare **Email Routing**: a domain's incoming mail can go to only one place, and here that is Zoho.

1. Go to **zoho.com/mail** → **Pricing**. Scroll to the **Forever Free** plan and click **Sign up now**.
2. Choose **Sign up with a domain I already own** and type `corexlr.com`. Create your own account first, for example `fatu@corexlr.com`. This account becomes the Zoho administrator.
3. **Verify the domain.** Zoho shows a **TXT** record (it starts with `zoho-verification=`).
   1. In Cloudflare → `corexlr.com` → **DNS** → **Records** → **Add record**, add it: Type **TXT**, Name `@`, Content as Zoho shows.
   2. Back in Zoho, click **Verify**.

   If Zoho offers to set up the records in Cloudflare for you, you can use that instead.

4. **Clear out old email records first.** In Cloudflare's DNS list, delete any **MX** records that are not Zoho's (for example ones ending in `registrar-servers.com`, left over from Namecheap) and any other TXT record on `@` that starts with `v=spf1`.
5. **Add Zoho's mail records.** Zoho's setup shows them; add each one in Cloudflare exactly as shown.
   - **Three MX records**, Name `@`, each with its priority (usually `mx.zoho.com` 10, `mx2.zoho.com` 20 and `mx3.zoho.com` 50; use Zoho's values if they differ, for example `.eu`).
   - **One SPF** record: TXT, Name `@`, the value Zoho shows (it starts with `v=spf1 include:`). Have only one `v=spf1` record on `@`.
   - **DKIM**: Zoho → **Admin Console** → **Domains** → `corexlr.com` → **DKIM** → **Add** (selector `zmail`). Add the TXT record it shows (Name `zmail._domainkey`), then click **Verify** in Zoho.

   Wait until Zoho shows the MX, SPF and DKIM checks green. It can take up to an hour.

6. **Create the shared addresses**, in Zoho **Admin Console**:
   - **Users** → add your staff (up to 5 in total, you included).
   - **Groups** → **Create group** named `Hello`, address `hello@corexlr.com`, members: you and whoever answers customers. In the group's settings, set **who can send to this group** to **Everyone** (or "Public"), so customers outside Corex can write to it.
   - Do the same for `billing@corexlr.com`.
   - If your plan does not offer Groups, add each address as an **alias** instead: **Users** → your account → **Email alias** → add `hello@corexlr.com` and `billing@corexlr.com`.
7. Install the **Zoho Mail** app on your phone and sign in.

**Check:** from Gmail, send a message to `hello@corexlr.com`. It arrives in Zoho, in your inbox or the group's, within a minute. Reply from Zoho: the answer arrives in Gmail from your corexlr.com address.

### 2b. Send mail from corexlr.com (Resend)

1. Go to **resend.com** and sign up (or sign in).
2. **Domains** → **Add Domain** → `corexlr.com`. Region: **Ireland (eu-west-1)**, the closest to Liberia.
3. If Resend offers **Auto configure** with Cloudflare, use it and allow access. Otherwise, add each record Resend shows in Cloudflare → **DNS** → **Records** → **Add record**: same Type, Name and Value/Content, Proxy status **DNS only**. There are usually 3 or 4 records, named `resend._domainkey`, `send` (MX and TXT) and `_dmarc`.

   These are separate from Zoho's: Resend's records are on `send` and `resend._domainkey`, Zoho's on `@` and `zmail._domainkey`. Do not delete or change Zoho's records. Add a `_dmarc` record only once; if one is already there, keep it.

4. Back in Resend, click **Verify DNS Records**. Wait until the domain shows **Verified**. This usually takes a few minutes, sometimes up to an hour.
5. **API Keys** → **Create API Key**: name `corex`, permission **Sending access**, domain `corexlr.com`. Copy the key (it starts with `re_`). Resend shows it once, so save it in your password manager as the **Resend key**.

**Check:** Resend → **Domains** shows `corexlr.com` as **Verified**.

---

## Part 3. Give each app its address

Do this once for each row in the table below, in Vercel and then in Cloudflare.

1. Vercel → open the project → **Settings** → **Domains** → **Add** → type the address → **Add**. Vercel then says **Invalid Configuration** and shows a CNAME record to create.
2. Cloudflare → `corexlr.com` → **DNS** → **Records** → **Add record**: Type **CNAME**, the Name from the table, Target `cname.vercel-dns.com` (or the value Vercel shows), Proxy status **DNS only**. Save.

| Vercel project       | Address to add             | Cloudflare record Name |
| -------------------- | -------------------------- | ---------------------- |
| `corex-admin`        | `admin.corexlr.com`        | `admin`                |
| `corex-demo-college` | `demo-college.corexlr.com` | `demo-college`         |
| `corex-demo-school`  | `demo-school.corexlr.com`  | `demo-school`          |
| `corex-demo-clinic`  | `demo-clinic.corexlr.com`  | `demo-clinic`          |
| `corex-demo-finance` | `demo-finance.corexlr.com` | `demo-finance`         |

If you have not created the `corex-admin` project yet: Vercel → **Add New** → **Project** → the `corex` repository → Root Directory `apps/admin` → Deploy (it fails at first without its settings; Part 4 adds them). In **Settings** → **Build and Deployment** → **Node.js Version** → **Project Settings**, choose **22.x**.

**Check:** after a few minutes each address shows **Valid Configuration** in Vercel.

---

## Part 4. Settings for each Vercel project

In each project: **Settings** → **Environment Variables**. For a setting that already exists, click **⋯** → **Edit** and replace its value; for a new one, click **Add**. Choose **Production** (and **Preview**). For the ones marked secret, also turn on **Sensitive**.

Supabase values are in Supabase → the project → **Project Settings**:

- **Data API** → **Project URL**.
- **API Keys** → the **publishable** (or anon) key and the **secret** (or service_role) key.

### 4a. Website (`corex`)

| Name                            | Value                                 |
| ------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://corexlr.com`                 |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | `corexlr.com`                         |
| `NEXT_PUBLIC_DEMO_HOST_PATTERN` | **Delete this setting** (⋯ → Remove)  |
| `LEAD_NOTIFY_TO`                | `hello@corexlr.com`                   |
| `LEAD_NOTIFY_FROM`              | `Corex Website <website@corexlr.com>` |
| `RESEND_API_KEY` (secret)       | the Resend key                        |

Keep `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `LEADS_SCHEMA` as they are.

### 4b. The four demos

In each of `corex-demo-college`, `corex-demo-school`, `corex-demo-clinic` and `corex-demo-finance`:

| Name                      | Value         |
| ------------------------- | ------------- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `corexlr.com` |

In the two School demos only, also:

| Project              | Name      | Value                              |
| -------------------- | --------- | ---------------------------------- |
| `corex-demo-college` | `APP_URL` | `https://demo-college.corexlr.com` |
| `corex-demo-school`  | `APP_URL` | `https://demo-school.corexlr.com`  |

Keep their other settings as they are.

### 4c. Corex Admin (`corex-admin`)

Configuration:

| Name                            | Value                                  |
| ------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | the **website** Supabase project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the website project's publishable key  |
| `NEXT_PUBLIC_DB_SCHEMA`         | `corex_web`                            |
| `NEXT_PUBLIC_ADMIN_URL`         | `https://admin.corexlr.com`            |
| `EMAIL_FROM`                    | `Corex <billing@corexlr.com>`          |
| `CLIENT_EMAIL_ENABLED`          | `true`                                 |

Secrets (turn on **Sensitive**):

| Name                        | Value                            |
| --------------------------- | -------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | the website project's secret key |
| `RESEND_API_KEY`            | the Resend key                   |
| `TRUSTED_DEVICE_SECRET`     | Secret A                         |
| `CRON_SECRET`               | Secret B                         |

### 4d. Redeploy all six

Settings only reach an app when it is built again. In each of the six projects: **Deployments** → **⋯** next to the latest → **Redeploy**.

**Check:**

- `https://corexlr.com`: a demo's **Log in as** button opens `demo-...corexlr.com`.
- `https://demo-clinic.corexlr.com`: the demo opens, and **Get this system** goes back to `corexlr.com`.
- `https://admin.corexlr.com`: the Corex Admin sign-in page.

---

## Part 5. Supabase

### 5a. The website project (it also holds Corex Admin)

1. **Authentication** → **Sign In / Providers** → turn **off** "Allow new users to sign up" → **Save**. Admin accounts are only created by invitation.
2. **Authentication** → **URL Configuration** → **Site URL**: `https://admin.corexlr.com` → **Save**.
3. **Authentication** → **Multi-Factor**: make sure **TOTP** (authenticator app) is enabled. It is on by default.

### 5b. The demo project

**Authentication** → **URL Configuration**:

- **Site URL**: `https://corexlr.com`.
- **Redirect URLs** → add `https://demo-college.corexlr.com/**`, `https://demo-school.corexlr.com/**`, `https://demo-clinic.corexlr.com/**` and `https://demo-finance.corexlr.com/**`.
- **Save**.

---

## Part 6. GitHub

The repository → **Settings** → **Secrets and variables** → **Actions**. Edit any that already exist (pencil icon).

**Variables** tab:

| Name             | Value                         |
| ---------------- | ----------------------------- |
| `WEB_DB_PRODUCT` | `admin`                       |
| `ADMIN_URL`      | `https://admin.corexlr.com`   |
| `EMAIL_FROM`     | `Corex <billing@corexlr.com>` |

**Secrets** tab:

| Name                            | Value                                |
| ------------------------------- | ------------------------------------ |
| `ADMIN_CRON_SECRET`             | Secret B (the same as `CRON_SECRET`) |
| `RESEND_API_KEY`                | the Resend key                       |
| `SUPABASE_URL_WEB`              | the website Supabase project's URL   |
| `SUPABASE_SERVICE_ROLE_KEY_WEB` | the website project's secret key     |

`DATABASE_URL_WEB` is already there from the website setup.

Then, in **Actions**:

1. **Website database** → **Run workflow**. Wait for the green tick. This adds the admin tables. It cannot be undone, and the website keeps working.
2. **Admin daily check** → **Run workflow**. A green tick means the daily check can reach the admin.

---

## Part 7. Your admin account

1. Install an authenticator app on your phone (Google Authenticator or Microsoft Authenticator).
2. GitHub → **Actions** → **Admin first invite** → **Run workflow**:
   - name: your full name;
   - username: for example `fatu`;
   - email: `agamer0297@gmail.com`, or your new Zoho address (for example `fatu@corexlr.com`).

   Then click **Run workflow**.

3. Open the email "Set up your Corex Admin account". It comes from `billing@corexlr.com`. The link works once, for 72 hours.
4. Choose a password (at least 12 characters), scan the QR code with the app, type the 6-digit code, and sign in.
5. In **Settings**:
   - **Company details**: legal name, address, phone, billing email `billing@corexlr.com`.
   - **Invoicing and payments**: the payment instructions printed on invoices (Orange Money, MTN and bank details).
   - **Price list**: check the prices before your first invoice.

**Check:** the Dashboard opens. On any sent invoice, the **Email** button works.

---

## Part 8. Nightly backups (same Cloudflare account)

1. Cloudflare → **R2 Object Storage** → **Create bucket** → name `corex-backups`. R2 needs a payment card on file, but this use stays within the free allowance.
2. On the bucket: **Settings** → **Object lifecycle rules** → add a rule that deletes objects after **31 days**.
3. R2 → **Manage API tokens** → **Create API token**: permission **Object Read & Write**, only the `corex-backups` bucket. Copy the **Access Key ID**, the **Secret Access Key** and the **endpoint** (`https://<account-id>.r2.cloudflarestorage.com`).
4. GitHub → **Secrets** tab:
   - `BACKUP_S3_ENDPOINT`: the endpoint;
   - `BACKUP_S3_BUCKET`: `corex-backups`;
   - `BACKUP_S3_ACCESS_KEY_ID`: the Access Key ID;
   - `BACKUP_S3_SECRET_ACCESS_KEY`: the Secret Access Key.

   `DATABASE_URL_WEB` is already there; that is all the website and admin backup needs. Client projects added later need their own `DATABASE_URL_<PROJECT>` (`docs/database.md`, "Backups").

5. GitHub → **Variables** tab: `BACKUPS_ENABLED` = `true`.
6. **Actions** → **Nightly backup** → **Run workflow**.

**Check:** files appear in the `corex-backups` bucket.

---

## Done: the checklist

- [ ] Part 1: Cloudflare shows `corexlr.com` **Active**, and the website opens.
- [ ] Part 2: mail to `hello@corexlr.com` reaches Zoho, and Resend shows **Verified**.
- [ ] Part 3: all five new addresses show **Valid Configuration** in Vercel.
- [ ] Part 4: the settings are in all six projects, and each one is redeployed.
- [ ] Part 5: sign-up is off, and the URL settings are saved.
- [ ] Part 6: both workflows have a green tick.
- [ ] Part 7: you can sign in to `admin.corexlr.com`, and Settings is filled in.
- [ ] Part 8: backups appear in R2.

Day-to-day use of Corex Admin, and what to do if something goes wrong: `docs/admin-runbook.md`.
