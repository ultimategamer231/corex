# Going live on corexlr.com

This guide takes you from "I own the domain" to "everything works on corexlr.com": the website, the four demos, Corex Admin and your email. You do not need any technical knowledge. Do the parts **in order**, and do every step, even if one looks unimportant.

Each part ends with a **Check**. Do not move on until the check passes. If a screen looks different from what is written here, or something fails, take a screenshot and ask for help. Small differences in button names are normal; websites change their buttons from time to time.

Everything here is free: Namecheap (where you bought the domain), Cloudflare, Zoho Mail, Vercel, Supabase, Resend and GitHub. Cloudflare asks for a payment card only in Part 8, and you will not be charged.

**Time needed:** about 3 hours spread over a day, because some steps make you wait (up to a few hours) while the internet catches up.

---

## Words you will see

- **Domain**: your name on the internet, `corexlr.com`. You bought it at Namecheap and it stays there.
- **DNS**: the internet's address book. It tells the world which computer shows your website and which one receives your email. Each line in that book is called a **record**.
- **Record**: one line in the address book. Every record has a **Type** (A, CNAME, MX or TXT), a **Name** (`@` means `corexlr.com` itself; `www` means `www.corexlr.com`), and a **Value** (also called **Content** or **Target**). You copy these exactly as shown.
- **Subdomain**: a name in front of your domain, like `admin.corexlr.com`.
- **Nameservers**: tell the internet who keeps your address book. In Part 1 you move it from Namecheap to Cloudflare, because Cloudflare is easier to use and also holds your backups.
- **Environment variable** (in Vercel): a setting an app reads when it starts, such as which email address it sends from. It has a **Name** and a **Value**.
- **Secret**: a setting that works like a password. Never paste a secret into chat, email, WhatsApp or a document. Keep it only in your password manager and in the place this guide tells you to put it.

## Your addresses when you are done

| Address                          | What it is                         | Vercel project       |
| -------------------------------- | ---------------------------------- | -------------------- |
| `corexlr.com`, `www.corexlr.com` | The website                        | `corex`              |
| `admin.corexlr.com`              | Corex Admin, for you and your team | `corex-admin`        |
| `demo-college.corexlr.com`       | School demo, College edition       | `corex-demo-college` |
| `demo-school.corexlr.com`        | School demo, High School edition   | `corex-demo-school`  |
| `demo-clinic.corexlr.com`        | Clinic demo                        | `corex-demo-clinic`  |
| `demo-finance.corexlr.com`       | Finance demo                       | `corex-demo-finance` |

Your email uses two services. They do different jobs and do not get in each other's way:

- **Zoho Mail** is where people **read and write** email: your own mailbox (for example `fatu@corexlr.com`) and shared addresses such as `hello@corexlr.com`.
- **Resend** is a robot that **sends** the apps' automatic emails (invoices, receipts, reminders, admin invitations, quote alerts). Nobody reads mail in Resend.

| Address               | In Zoho                                    | What the apps do with it                                              |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `hello@corexlr.com`   | A group that reaches you (and later staff) | Shown on the website; new quote requests are sent here                |
| `billing@corexlr.com` | A group                                    | Invoices and receipts are sent from it; clients' replies land in Zoho |
| `website@corexlr.com` | Nothing to create                          | Sends the quote-request alerts                                        |

---

## Part 0. Get ready

### 0a. A password manager and two secrets

1. If you do not have a password manager, install one. **Bitwarden** is free (bitwarden.com, and the Bitwarden app on your phone). Use it for every password and key in this guide.
2. Open **1password.com/password-generator** in your browser. Set:
   - Type: **Random password**;
   - Length: **48**;
   - **Numbers** on, **Symbols** off.
3. Copy the password it shows and save it in your password manager with the name **Corex Secret A**.
4. Click the refresh arrow to get a new one, and save it as **Corex Secret B**.

### 0b. Wake up Supabase

Your Supabase projects were paused while GitHub's daily jobs were not running. Wake them up first, because several later steps need them awake.

1. Go to **supabase.com/dashboard** and sign in.
2. You see your projects. Any project marked **Paused** needs waking: open it and click **Restore project** (or **Resume project**). Nothing is lost.
3. Do this for **both** projects: the website project (it also holds Corex Admin) and the demo project.
4. Wait until each project shows as **Healthy** or **Active**, usually 5 to 10 minutes. You can carry on with Part 1 meanwhile.

From now on, Supabase stays awake on its own: GitHub checks in on it every day, and so does Vercel. Part 6 makes sure GitHub's daily jobs are switched on.

**Check:** on the Supabase dashboard, no project says **Paused**.

---

## Part 1. Move the address book (DNS) to Cloudflare

The domain stays yours at Namecheap; you keep renewing it there. Cloudflare only keeps its address book. The website keeps working while you do this.

### 1a. Create your Cloudflare account

1. Go to **dash.cloudflare.com/sign-up**.
2. Type your email (your Gmail is fine) and a new password. Save the password in your password manager as **Cloudflare**. Click **Sign up**.
3. Cloudflare emails you a link. Open your email and click it to confirm your address.
4. If Cloudflare asks what you want to do first, or shows a list of products, close it or click **Skip**.

### 1b. Add corexlr.com to Cloudflare

1. On the Cloudflare home page, click **Add a domain** (it may say **Onboard a domain** or **Add a site**).
2. Type `corexlr.com`. Leave **Quick scan for DNS records** selected. Click **Continue**.
3. Choose the plan. Scroll down to **Free** ($0) and select it. Click **Continue** (or **Select plan**).
4. Cloudflare now shows the records it copied from Namecheap. Look for these two lines. They come from the Vercel record you added at Namecheap:

   | Type  | Name                   | Content                |
   | ----- | ---------------------- | ---------------------- |
   | A     | `corexlr.com` (or `@`) | `76.76.21.21`          |
   | CNAME | `www`                  | `cname.vercel-dns.com` |

   If one is missing, add it: click **Add record**, choose the **Type**, type the **Name** (`@` for the first, `www` for the second) and the **Content**, and click **Save**.

   If Vercel showed you a different value when you added the domain (Vercel → `corex` project → **Settings** → **Domains**), use Vercel's value instead.

5. **Turn every cloud grey.** At the end of each line there is a cloud icon under **Proxy status**. If it is **orange** ("Proxied"), click it so it turns **grey** ("DNS only"), then click **Save**. Vercel needs grey clouds. Do this for every A and CNAME record.
6. If you see records you do not recognise, such as **MX** records ending in `registrar-servers.com`, or a **TXT** record that starts with `v=spf1`, **delete them**: click the record → **Delete**. They are Namecheap's old email settings, and Zoho will replace them in Part 2.
7. Click **Continue** (or **Continue to activation**). Cloudflare shows **two nameservers**, for example `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`. Yours have different names. **Keep this page open.**

### 1c. Point Namecheap to Cloudflare

1. In a new browser tab, sign in at **namecheap.com**.
2. Click **Domain List** on the left, then **Manage** next to `corexlr.com`.
3. Find **Nameservers**. It probably says **Namecheap BasicDNS**. Click it and choose **Custom DNS**.
4. Two boxes appear. Copy the first Cloudflare nameserver into the first box and the second into the second box. Copy them exactly, with no space at the start or end.
5. Click the **green tick** to save. Namecheap may warn that its own DNS settings will stop being used. That is expected; Cloudflare now has them.
6. Go back to the Cloudflare tab and click **Check nameservers now** (or **Done, check nameservers**).

Now wait. It takes between 10 minutes and a few hours. Cloudflare emails you when `corexlr.com` is **Active**. You can do Part 2a step 1 and 2 meanwhile, but add no records until Cloudflare says **Active**.

**Check:**

- Cloudflare's home page shows `corexlr.com` as **Active**.
- `https://corexlr.com` still opens your website.
- Vercel → `corex` project → **Settings** → **Domains**: `corexlr.com` shows **Valid Configuration**.

---

## Part 2. Email

From here on, "**add a record in Cloudflare**" always means:

1. Cloudflare → click `corexlr.com` → **DNS** → **Records** → **Add record**.
2. Choose the **Type**.
3. Type the **Name** and the **Content** (or **Mail server**, **Target**) exactly as shown. For an MX record there is also a **Priority** box.
4. Leave **TTL** on **Auto**. If there is a cloud icon, make it **grey** (DNS only).
5. Click **Save**.

Tip: to copy a long value without mistakes, use the copy button next to it on the other website, then paste with Ctrl V (or long-press → Paste on a phone).

### 2a. Your mailboxes (Zoho Mail)

Zoho's free plan gives you up to 5 mailboxes. You read them at **mail.zoho.com** or in the Zoho Mail phone app.

Do **not** turn on Cloudflare's **Email Routing**. Your incoming email can go to only one place, and that is Zoho.

**Sign up**

1. Go to **zoho.com/mail** and click **Pricing** (or **Sign up**).
2. Scroll down past the paid plans to **Forever Free Plan** and click **Sign up now**. If you cannot find it, search the page (Ctrl F) for "Forever Free".
3. When asked about a domain, choose **Sign up with a domain I already own**, type `corexlr.com`, and continue.
4. Fill in the form. For the email address, choose your own name, for example `fatu` (this makes `fatu@corexlr.com`). This first account is the **administrator** of your Zoho email. Save its password in your password manager as **Zoho**.
5. Confirm your mobile number with the code Zoho sends.

**Prove you own the domain**

6. Zoho shows a **TXT** record that starts with `zoho-verification=`. Choose the **TXT** method if Zoho asks which method you prefer.
7. Add a record in Cloudflare: Type **TXT**, Name `@`, Content: the `zoho-verification=...` value from Zoho.
8. Back in Zoho, click **Verify**. If it says it cannot find the record, wait 5 minutes and click **Verify** again.

If Zoho instead offers to set up the records in Cloudflare for you (a button such as "Sign in to Cloudflare"), you may use it; then check afterwards that the records below are there.

**Create your shared addresses** (Zoho shows these steps after verification; you can skip any it does not show and do them later in the **Admin Console**)

9. **Users**: you are already the first user. Add staff later, up to 5 people in total.
10. **Groups**: click **Create group** (or **Add group**).
    - Name: `Hello`. Address: `hello@corexlr.com`. Members: you.
    - In the group's settings, set **who can send email to this group** to **Everyone** (it may be called **Public** or **Anyone**). Without this, customers cannot write to it.
    - Do the same again for `Billing` with the address `billing@corexlr.com`.
    - If Zoho does not let you create groups on the free plan, add the two addresses as **aliases** of your own mailbox instead: **Admin Console** → **Users** → your name → **Email alias** → **Add** → `hello`, then again for `billing`.

**Tell the internet that Zoho receives your email**

11. Zoho now shows the email records (the step may be called **Configure email delivery** or **DNS mapping**). Add each one in Cloudflare. Normally they are:

    Three **MX** records (Type **MX**, Name `@`):

    | Mail server    | Priority |
    | -------------- | -------- |
    | `mx.zoho.com`  | 10       |
    | `mx2.zoho.com` | 20       |
    | `mx3.zoho.com` | 50       |

    If Zoho shows different values (for example ending in `.eu`), use Zoho's values.

    One **SPF** record: Type **TXT**, Name `@`, Content as Zoho shows (usually `v=spf1 include:zohomail.com ~all`). You must have only **one** TXT record on `@` that starts with `v=spf1`. If there is an old one, delete it.

12. **DKIM** (a signature that stops your mail landing in spam). In Zoho: **Admin Console** → **Domains** → `corexlr.com` → **Email configuration** (or **DKIM**) → **Add**. Selector: `zmail`. Zoho shows a TXT record. Add it in Cloudflare: Type **TXT**, Name `zmail._domainkey`, Content: the long value Zoho shows. Then click **Verify** in Zoho.
13. In Zoho, the domain page shows a tick next to **MX**, **SPF** and **DKIM**. If one is not ticked, wait up to an hour and click **Verify** again.
14. Install the **Zoho Mail** app on your phone and sign in with `fatu@corexlr.com` (your address).

**Check:**

- From your Gmail, send an email to `hello@corexlr.com`. Within a few minutes it arrives in Zoho.
- Reply from Zoho. The reply arrives in Gmail from your corexlr.com address and is not in spam.

### 2b. Let the apps send email (Resend)

1. Go to **resend.com** and sign in. (You already have an account if quote requests are emailed to you today; otherwise click **Sign up**.)
2. On the left, click **Domains** → **Add domain**. Type `corexlr.com`. Region: **Ireland (eu-west-1)**. Click **Add**.
3. Resend shows 3 or 4 records. If there is an **Auto configure** or **Sign in to Cloudflare** button, use it and allow access. Otherwise add each record in Cloudflare exactly as shown. They are usually:
   - **MX**, Name `send`, Mail server `feedback-smtp.eu-west-1.amazonses.com`, Priority `10`;
   - **TXT**, Name `send`, Content starting with `v=spf1 include:amazonses.com`;
   - **TXT**, Name `resend._domainkey`, a long Content starting with `p=`;
   - **TXT**, Name `_dmarc`, Content `v=DMARC1; p=none;` (this one is optional; add it once only).

   These do **not** replace Zoho's. Zoho's records are on `@` and `zmail._domainkey`; Resend's are on `send`, `resend._domainkey` and `_dmarc`. Never delete Zoho's records.

4. Back in Resend, click **Verify DNS records**. Wait until `corexlr.com` shows **Verified**. Usually a few minutes, sometimes up to an hour.
5. On the left, click **API Keys** → **Create API key**.
   - Name: `corex`;
   - Permission: **Sending access**;
   - Domain: `corexlr.com`.

   Click **Add**. Resend shows the key once (it starts with `re_`). Copy it into your password manager as **Resend key**.

**Check:** Resend → **Domains** shows `corexlr.com` as **Verified**.

---

## Part 3. Give each app its address

You will do the same two small steps five times, once for each line of the table below.

| Vercel project       | Address to add             | Cloudflare Name |
| -------------------- | -------------------------- | --------------- |
| `corex-admin`        | `admin.corexlr.com`        | `admin`         |
| `corex-demo-college` | `demo-college.corexlr.com` | `demo-college`  |
| `corex-demo-school`  | `demo-school.corexlr.com`  | `demo-school`   |
| `corex-demo-clinic`  | `demo-clinic.corexlr.com`  | `demo-clinic`   |
| `corex-demo-finance` | `demo-finance.corexlr.com` | `demo-finance`  |

For each line:

1. **In Vercel**: go to **vercel.com**, open the project → **Settings** (top) → **Domains** (left) → **Add domain** (or **Add**). Type the address → **Add** (if asked, choose to **connect it to Production**). Vercel now says **Invalid Configuration** and shows a **CNAME** value. That is expected.
2. **In Cloudflare**: add a record. Type **CNAME**, Name: the Cloudflare Name from the table, Target: `cname.vercel-dns.com` (or the value Vercel shows), cloud **grey** (DNS only). Save.

After a few minutes, Vercel changes **Invalid Configuration** to **Valid Configuration**.

No `corex-admin` project in Vercel yet? Create it first:

1. Vercel → **Add New** → **Project** → next to the `corex` repository click **Import**.
2. Project Name: `corex-admin`. **Root Directory**: click **Edit** → choose `apps/admin` → **Continue**.
3. Click **Deploy**. It fails the first time, because it has no settings yet. That is fine; Part 4 adds them.
4. In the new project: **Settings** → **Build and Deployment** → **Node.js Version**: choose **22.x** → **Save**.

**Check:** all five addresses show **Valid Configuration** in Vercel.

---

## Part 4. Settings for each Vercel project

**How to add a setting in Vercel** (you will do this many times):

1. Open the project → **Settings** → **Environment Variables**.
2. If the Name is already in the list: click **⋯** next to it → **Edit**, replace the Value, **Save**.
3. If it is not there: click **Add** (or **Add Environment Variable**). Type the **Key** (the Name) and the **Value**. Tick **Production** and **Preview**. For a setting marked **secret**, also turn on **Sensitive**. Click **Save**.

Copy Names exactly, including capitals and underscores.

**Where to find the Supabase values:** supabase.com/dashboard → open the project → **Project Settings** (the gear icon, bottom left):

- **Data API** → **Project URL** (it looks like `https://abcd.supabase.co`);
- **API Keys** → the **publishable** key (older screens call it **anon public**) and the **secret** key (older screens: **service_role**; click **Reveal** to see it). The secret key is a secret.

### 4a. Website (`corex`)

| Name                            | Value                                     |
| ------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://corexlr.com`                     |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | `corexlr.com`                             |
| `NEXT_PUBLIC_DEMO_HOST_PATTERN` | **Delete it** if it is there (⋯ → Remove) |
| `LEAD_NOTIFY_TO`                | `hello@corexlr.com`                       |
| `LEAD_NOTIFY_FROM`              | `Corex Website <website@corexlr.com>`     |
| `RESEND_API_KEY` (secret)       | your Resend key                           |

Leave `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `LEADS_SCHEMA` as they are.

### 4b. The four demos

In **each** of `corex-demo-college`, `corex-demo-school`, `corex-demo-clinic` and `corex-demo-finance`:

| Name                      | Value         |
| ------------------------- | ------------- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `corexlr.com` |

In the two School demos **only**, also:

| Project              | Name      | Value                              |
| -------------------- | --------- | ---------------------------------- |
| `corex-demo-college` | `APP_URL` | `https://demo-college.corexlr.com` |
| `corex-demo-school`  | `APP_URL` | `https://demo-school.corexlr.com`  |

Leave their other settings as they are.

### 4c. Corex Admin (`corex-admin`)

Settings (not secret). The Supabase values come from the **website** project, not the demo project:

| Name                            | Value                                     |
| ------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | the website project's **Project URL**     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the website project's **publishable** key |
| `NEXT_PUBLIC_DB_SCHEMA`         | `corex_web`                               |
| `NEXT_PUBLIC_ADMIN_URL`         | `https://admin.corexlr.com`               |
| `EMAIL_FROM`                    | `Corex <billing@corexlr.com>`             |
| `CLIENT_EMAIL_ENABLED`          | `true`                                    |

Secrets (turn on **Sensitive** for each):

| Name                        | Value                                |
| --------------------------- | ------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | the website project's **secret** key |
| `RESEND_API_KEY`            | your Resend key                      |
| `TRUSTED_DEVICE_SECRET`     | Corex Secret A                       |
| `CRON_SECRET`               | Corex Secret B                       |

### 4d. Restart all six apps

An app reads its settings only when it is built again. In **each** of the six projects: **Deployments** (top) → **⋯** next to the top deployment → **Redeploy** → **Redeploy**. Wait for **Ready**.

**Check:**

- `https://corexlr.com`: on a product page, the demo's **Log in as** button opens a `demo-...corexlr.com` address.
- `https://demo-clinic.corexlr.com`: the demo opens, and **Get this system** takes you back to `corexlr.com`.
- `https://admin.corexlr.com`: you see the Corex Admin sign-in page.

---

## Part 5. Supabase settings

### 5a. The website project (it also holds Corex Admin)

Open the website project in supabase.com/dashboard.

1. **Authentication** (left) → **Sign In / Providers** → turn **off** "Allow new users to sign up" → **Save**. Admin accounts are created only by invitation.
2. **Authentication** → **URL Configuration** → **Site URL**: `https://admin.corexlr.com` → **Save**.
3. **Authentication** → **Multi-Factor**: check that **TOTP** (authenticator app) is on. It is on by default.

### 5b. The demo project

Open the demo project. **Authentication** → **URL Configuration**:

1. **Site URL**: `https://corexlr.com` → **Save**.
2. **Redirect URLs** → **Add URL**, and add these four, one at a time:
   - `https://demo-college.corexlr.com/**`
   - `https://demo-school.corexlr.com/**`
   - `https://demo-clinic.corexlr.com/**`
   - `https://demo-finance.corexlr.com/**`
3. **Save**.

### 5c. If a project is ever paused again

A free Supabase project pauses after 7 days with no activity. Two things now keep yours awake, so one can fail without harm: GitHub's daily jobs (Part 6), and a daily check from Vercel to `/api/keepalive` on the website and each demo (nothing to set up).

If Supabase ever shows a project as **Paused**: open it and click **Restore project**. Nothing is lost.

**Check:** both URL settings are saved.

---

## Part 6. GitHub

Go to **github.com**, sign in as **ultimategamer231**, and open the `corex` repository.

### 6a. Make sure the daily jobs are switched on

1. Click **Actions** (top).
2. If a yellow or grey notice says workflows are disabled, click the button in it to **enable** them.
3. On the left, click **Demo reset**. If it says "This scheduled workflow is disabled", click **Enable workflow**. Do the same for **Website database**, **Admin daily check**, **Admin status check** and **Nightly backup**.

### 6b. Add the settings

Click **Settings** (top, the gear) → on the left **Secrets and variables** → **Actions**. There are two tabs: **Secrets** and **Variables**. If a Name already exists, click its pencil icon to change it; otherwise click **New repository secret** (or **New repository variable**).

**Variables** tab:

| Name             | Value                         |
| ---------------- | ----------------------------- |
| `WEB_DB_PRODUCT` | `admin`                       |
| `ADMIN_URL`      | `https://admin.corexlr.com`   |
| `EMAIL_FROM`     | `Corex <billing@corexlr.com>` |

**Secrets** tab:

| Name                            | Value                                             |
| ------------------------------- | ------------------------------------------------- |
| `ADMIN_CRON_SECRET`             | Corex Secret B (the same as Vercel's CRON_SECRET) |
| `RESEND_API_KEY`                | your Resend key                                   |
| `SUPABASE_URL_WEB`              | the website project's **Project URL**             |
| `SUPABASE_SERVICE_ROLE_KEY_WEB` | the website project's **secret** key              |

`DATABASE_URL_WEB` is already there. Do not change it.

### 6c. Run two jobs

Click **Actions** (top).

1. On the left, click **Website database** → **Run workflow** (right) → green **Run workflow**. After a minute, refresh the page. Wait for a **green tick**. This adds Corex Admin's tables. The website keeps working.
2. Then **Admin daily check** → **Run workflow** → **Run workflow**. A green tick means GitHub can reach Corex Admin.

A red cross instead? Click it, take a screenshot of the red lines, and ask for help.

**Check:** both runs have a green tick.

---

## Part 7. Your admin account

1. Install **Google Authenticator** or **Microsoft Authenticator** on your phone.
2. GitHub → **Actions** → **Admin first invite** → **Run workflow**, and fill in:
   - **name**: your full name;
   - **username**: for example `fatu`;
   - **email**: your Zoho address (for example `fatu@corexlr.com`) or `agamer0297@gmail.com`.

   Click **Run workflow** and wait for the green tick.

3. Open your email. You receive "Set up your Corex Admin account" from `billing@corexlr.com`. The link works once, within 72 hours. Not there after 5 minutes? Look in spam.
4. Choose a password of at least 12 characters (save it in your password manager). Open the authenticator app, tap **+**, scan the QR code on the screen, type the 6-digit code the app shows, and sign in.
5. In Corex Admin, open **Settings** and fill in:
   - **Company details**: legal name, address, phone, billing email `billing@corexlr.com`;
   - **Invoicing and payments**: the payment instructions printed on invoices (Orange Money, MTN and bank details);
   - **Price list**: check the prices before your first invoice.

**Check:** the Dashboard opens. On a sent invoice, the **Email** button sends it.

---

## Part 8. Nightly backups

This uses the same Cloudflare account. Cloudflare asks for a payment card to turn on R2 storage, but backups this size stay inside the free allowance, so you are not charged.

1. Cloudflare → on the left **R2 Object Storage** (it may be under **Storage & Databases**). Add your card if asked, and choose the free plan.
2. Click **Create bucket**. Name: `corex-backups`. Click **Create bucket**.
3. In the bucket: **Settings** → **Object lifecycle rules** → **Add rule**. Name it `delete old`, choose to **delete objects** after **31 days**, and save. Old backups then clean themselves up.
4. Go back to **R2 Object Storage** → **Manage API tokens** (or **API** → **Manage API tokens**) → **Create API token** (choose **Account API token** if asked).
   - Permission: **Object Read & Write**;
   - Apply to: **specific bucket only** → `corex-backups`.

   Click **Create API Token**. Cloudflare shows three values once: **Access Key ID**, **Secret Access Key** and the **endpoint** (`https://<numbers>.r2.cloudflarestorage.com`). Save all three in your password manager.

5. GitHub → **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab. Add:
   - `BACKUP_S3_ENDPOINT`: the endpoint;
   - `BACKUP_S3_BUCKET`: `corex-backups`;
   - `BACKUP_S3_ACCESS_KEY_ID`: the Access Key ID;
   - `BACKUP_S3_SECRET_ACCESS_KEY`: the Secret Access Key.
6. **Variables** tab: add `BACKUPS_ENABLED` with the value `true`.
7. **Actions** → **Nightly backup** → **Run workflow** → **Run workflow**. Wait for the green tick.

`DATABASE_URL_WEB` is already there, and that is all the website and admin backup needs. Client projects added later need their own `DATABASE_URL_<PROJECT>` (`docs/database.md`, "Backups").

**Check:** Cloudflare → R2 → `corex-backups` shows new files.

---

## Done: the checklist

- [ ] Part 0: no Supabase project says **Paused**.
- [ ] Part 1: Cloudflare shows `corexlr.com` **Active**, and the website still opens.
- [ ] Part 2: email to `hello@corexlr.com` reaches Zoho, and Resend shows **Verified**.
- [ ] Part 3: all five new addresses show **Valid Configuration** in Vercel.
- [ ] Part 4: the settings are in all six projects, and each one is redeployed.
- [ ] Part 5: sign-up is off, and the URL settings are saved.
- [ ] Part 6: the daily jobs are enabled, and both runs have a green tick.
- [ ] Part 7: you can sign in to `admin.corexlr.com`, and Settings is filled in.
- [ ] Part 8: backups appear in R2.

Day-to-day use of Corex Admin, and what to do if something goes wrong: `docs/admin-runbook.md`.
