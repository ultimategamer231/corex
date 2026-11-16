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

This is how Google learns about your site quickly and how you see what people search for.

1. Go to **search.google.com/search-console** and sign in with a Google account the company keeps.
2. Click **Add property**, choose **Domain** (the left box), type `corexlr.com`, and click **Continue**.
3. Google shows a **TXT** record. Add it in Cloudflare (as in the go-live guide): **DNS** → **Records** → **Add record** → Type **TXT**, Name `@`, Content: the value Google shows. Save.
4. Back in Google, click **Verify**. If it fails, wait 10 minutes and try again.
5. On the left, click **Sitemaps**, type `sitemap.xml`, and click **Submit**.

**Check:** after a few days, **Pages** shows your pages as indexed.

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
