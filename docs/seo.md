# Search engines and AI search: what is set up, and your steps

The website now tells Google, Bing and AI assistants (ChatGPT, Claude, Perplexity, Gemini) clearly who Corex is, what it sells, where it is and how to reach it. A few steps can only be done by you, in your own accounts. Do them in order; each takes about 10 minutes.

## What the website now does on its own

- **Clear titles and descriptions** on every page, written around what people search for, such as "School Management System in Liberia" and "Custom Software Development in Liberia". Each description fits in Google's results (160 characters or fewer).
- **A share picture** (teal, with the Corex name and tagline) shown whenever someone shares a corexlr.com link on WhatsApp, Facebook, LinkedIn or X.
- **Structured data**, the hidden labels search engines read:
  - the company: name, logo, address on Mechlin Street, phones, email, founders and what Corex sells;
  - each product as software, with starting prices;
  - each service;
  - the questions and answers on the homepage, product pages and Pricing;
  - the page's place in the site (the breadcrumb).
- **Every FAQ answer is in the page**, even when it is folded closed, so search engines and AI tools can read it.
- **`/llms.txt`**: a plain summary of Corex, its software, prices, founders, contact details and FAQ, for AI assistants (the llmstxt.org convention).
- **`/robots.txt`** welcomes all search engines and names the AI crawlers (GPTBot, ClaudeBot, PerplexityBot and others) so they are clearly allowed. **`/sitemap.xml`** lists every public page with its date.

## Your steps

### 1. Make one address the main one (important)

Today the site says its main address is `https://corexlr.com`, but Vercel sends visitors on to `https://www.corexlr.com`. Search engines dislike that mismatch. Fix it in Vercel:

1. Vercel → **`corex`** project → **Settings** → **Environment Variables**.
2. Edit **`NEXT_PUBLIC_SITE_URL`** and change the value to `https://www.corexlr.com`. Keep Production and Preview ticked. Save.
3. **Deployments** → **⋯** next to the top one → **Redeploy**.

**Check:** open `https://www.corexlr.com/robots.txt`. The last line should read `Sitemap: https://www.corexlr.com/sitemap.xml`.

### 2. Register with Google (Google Search Console)

This tells Google the site is yours, sends it the list of pages, and shows you what people search for before they click on Corex. It takes about 15 minutes.

**A. Add the site**

1. On a computer, open **search.google.com/search-console**.
2. Sign in with a Google account the company will keep (not a personal one you may lose). Click **Start now** if Google asks.
3. A box **Select property type** opens. Use the left box, **Domain**. Type `corexlr.com` (no `www`, no `https://`). Click **Continue**.

**B. Prove you own the domain**

4. Google shows **Verify domain ownership via DNS record** and a long value that starts with `google-site-verification=`. Click **Copy**. Leave this tab open.
5. In a new tab, open Cloudflare → click **corexlr.com** → **DNS** → **Records** → **Add record**.
6. Fill in: **Type** `TXT`, **Name** `@`, **Content**: paste the value from Google, **TTL** Auto. Click **Save**. (Your Zoho and Resend TXT records stay; a domain can have several.)
7. Go back to the Google tab and click **Verify**. You should see **Ownership verified**. If Google says it could not find the record, wait 10 minutes and click **Verify** again.

**C. Send Google the page list**

8. Click **Go to property**. In the left menu, click **Sitemaps**.
9. Under **Add a new sitemap**, type the full address `https://www.corexlr.com/sitemap.xml` (with `www`) and click **Submit**. If Google says it **Couldn't fetch**, wait a day: that message is common at first and clears itself.

**D. Ask Google to visit the main pages now (optional, speeds things up)**

10. At the top, click the search bar **Inspect any URL**, paste `https://www.corexlr.com/` and press Enter.
11. Click **Request indexing**. Repeat for `https://www.corexlr.com/software` and `https://www.corexlr.com/pricing`.

**Check:** after 3 to 7 days, **Indexing** → **Pages** shows your pages under **Indexed**, and **Performance** starts showing searches, clicks and positions. Look at it once a week. Do not delete the TXT record later: Google checks it to keep you verified.

To let a teammate see it: **Settings** → **Users and permissions** → **Add user** (choose **Full**, not **Owner**).

### 3. Register with Bing (Bing Webmaster Tools)

Bing also feeds ChatGPT search and Microsoft Copilot, so this matters for AI search.

1. Go to **bing.com/webmasters** and sign in.
2. Choose **Import from Google Search Console** and allow access. Your site and sitemap are copied over.

### 4. Create your Google Business Profile

This is what puts Corex on Google Maps and in "software company near me" results in Monrovia.

1. Go to **business.google.com** → **Manage now**.
2. Business name: **Corex Digital Solutions**. Category: **Software company**.
3. Address: **Mechlin Street, Monrovia**. Add your phone `+231 770 021 026` and website `https://www.corexlr.com`.
4. Follow Google's steps to verify (usually a video or a code).
5. Add photos of your office and team, and your opening hours.
6. Ask your first clients for a Google review. Reviews strongly help local ranking.

### 5. Turn on visitor analytics (Cloudflare Web Analytics)

This counts visits, popular pages, where visitors come from and which devices they use. It uses no cookies, so the site needs no cookie pop-up. The Privacy policy already mentions it.

1. Cloudflare → **Analytics & Logs** → **Web Analytics** → **Add a site**.
2. Type `www.corexlr.com` and click **Done**. Cloudflare shows a short piece of code (a JS snippet).
3. In that code, find `"token": "..."` and copy only the value between the quotes after `token`.
4. Vercel → **`corex`** project → **Settings** → **Environment Variables** → **Add**: Key `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`, Value: the token. Tick Production and Preview. It is not a secret (visitors' browsers see it), so leave **Sensitive** off. Save.
5. **Deployments** → **⋯** next to the top one → **Redeploy**.

**Check:** open the website, click a few pages, then look at Cloudflare → **Web Analytics** after a few minutes. Visits appear there.

**See the visits inside Corex Admin** (the **Website visits** page). Three more values, for the **`corex-admin`** project this time:

6. **Account ID:** Cloudflare home page (the list of your domains) → on the right, under **Account details** or **API**, copy **Account ID**. (It is also the long code in the browser address after `dash.cloudflare.com/`.)
7. **Site tag:** Cloudflare → **Analytics & Logs** → **Web Analytics** → click **www.corexlr.com**. In the browser address bar, copy the code after `siteTag~in=` (letters and numbers only).
8. **API token:** click the person icon at the top right → **My Profile** → **API Tokens** → **Create Token** → at the bottom, **Create Custom Token** → **Get started**. Name it `Corex Admin analytics`. Under **Permissions** choose **Account** · **Account Analytics** · **Read**. Under **Account Resources** choose **Include** · your account. Click **Continue to summary** → **Create Token**, then **Copy**. Cloudflare shows it only once.
9. Vercel → **`corex-admin`** project → **Settings** → **Environment Variables**. Add three, ticking Production and Preview:
   - `CLOUDFLARE_ACCOUNT_ID`: the account ID (Sensitive off)
   - `CLOUDFLARE_WEB_ANALYTICS_SITE_TAG`: the site tag (Sensitive off)
   - `CLOUDFLARE_API_TOKEN`: the token (**Sensitive on**: it is a secret; never paste it in chat or email)
10. **Deployments** → **⋯** next to the top one → **Redeploy**.

**Check:** sign in to admin.corexlr.com → **Website visits**. You see the number of visits, a chart per day, top pages, where visitors came from, countries and devices. If the page shows "Could not load the numbers from Cloudflare", the message under it says why (most often the token permission or a mistyped site tag).

### 6. Send me your social media links

When you have Facebook, LinkedIn, X or YouTube pages for Corex, send me the links. I will add them to the footer and to the company's structured data, which helps Google and AI tools connect them to Corex.

## What brings more visitors over time

Search engines and AI assistants recommend companies they can see real evidence for. In order of impact:

1. **Case studies.** Each real project (for example LCC E-Portal) as its own page under "Our work", with the problem, what was built and the result.
2. **Client testimonials** with name, role and organization, with their permission.
3. **Google reviews** on your Business Profile.
4. **Helpful articles** answering questions your clients ask, such as "How to move school records from Excel" or "Choosing a clinic system in Liberia".
5. **Mentions on other sites**: business directories, partner organizations, local news.

Send me any of these and I will add them to the website.

## Checking the work

- **Rich Results Test** (search.google.com/test/rich-results): paste any page address to see the structured data Google reads.
- **PageSpeed Insights** (pagespeed.web.dev): paste `https://www.corexlr.com` to check speed on phones.
- `https://www.corexlr.com/llms.txt`: shows the summary AI assistants read.
