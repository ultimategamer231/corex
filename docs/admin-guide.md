# Corex Admin: user guide

How to use Corex Admin at **https://admin.corexlr.com**, step by step. It is written for everyone on the team, with no technical knowledge needed.

Corex Admin is where you follow every sale from the first website request to the paid invoice: **leads** (people interested in Corex), **clients** (organizations that signed), **invoices and receipts**, **subscriptions** (yearly renewals), and an **activity log** of everything that happens.

Button and page names below are written in **bold** exactly as they appear on screen.

---

## 1. Signing in

You need three things: your email (or username), your password, and your phone with the authenticator app (Google Authenticator or Microsoft Authenticator).

1. Open **https://admin.corexlr.com**.
2. Type your **email or username** and your **password** → click **Sign in**.
3. Open the authenticator app on your phone. Find **Corex Admin** and type the 6-digit number into **6-digit code**.
4. You arrive on the **Dashboard**.

**Trusted device:** on the code page you can tick **Trust this device for … days**. You then skip the 6-digit code on this computer until it expires. Only do this on your own computer, never on a shared one.

**You are signed out automatically** after a period of no use (4 hours unless changed in **Settings → Security**). Just sign in again.

**Forgot your password?** On the sign-in page click **Forgot password**, type your email or username, and follow the link in the email you receive.

**Too many wrong passwords?** After 5 wrong attempts, sign-in pauses for 15 minutes. Wait, then try again.

**Lost or changed your phone?** Ask another admin to open **Settings → Team** and reset your authenticator. You then set it up again the next time you sign in.

### Your first sign-in (new team members)

1. An admin invites you (see section 9). You receive the email **"Set up your Corex Admin account"** from `billing@corexlr.com`. Check spam if you do not see it.
2. Click the link (it works once, within 72 hours).
3. Choose a password of at least 12 characters and type it twice → **Continue**.
4. Install Google Authenticator on your phone. Tap **+** → **Scan a QR code** and scan the code on the screen. (Cannot scan? Use **Enter a setup key** in the app and type the key shown under the QR code.)
5. Type the 6-digit number the app shows → finish. You are in.

---

## 2. Finding your way around

- **Menu on the left** (on a phone: the bar at the bottom, and **More** for the rest): **Dashboard**, **Leads**, **Clients**, **Subscriptions**, **Invoices and receipts**, **Settings**, **Activity log**.
- **Search** (top bar, or press **Ctrl K** on a computer): type a name, phone number, invoice number (for example `CX-26-11-001`) or receipt number, and pick a result.
- **Bell** (top bar): new things that need you, such as a new website request or an overdue invoice. The red number is how many you have not seen.
- **Your name** (top right): your account menu and **Sign out**.

---

## 3. The Dashboard: your morning check

Open it every morning.

- **Figures** at the top: new leads in the last 7 days, the open pipeline (value of open quotes), money **Outstanding** (owed to you) and money collected.
- **Needs attention**: the list to work through each day. Each line is a link that opens the right page:
  - overdue invoices;
  - clients flagged for pause (30 days past their renewal without paying);
  - follow-ups due today and new leads nobody has contacted;
  - renewals coming up and warranties ending soon.
- Below: the sales pipeline, money collected by month, upcoming renewals and recent activity.

When a line is dealt with (for example, the invoice is paid), it disappears from the list by itself.

---

## 4. Leads: people interested in Corex

A **lead** is a person or organization that might buy. Requests sent from the website's quote form appear here automatically, with the original message. You can also add leads yourself, for example after a phone call.

### See your leads

1. Click **Leads**.
2. Use the tabs to filter by stage: **New**, **Contacted**, **Demo booked**, **Quoted**, **Won**, **Lost**.
3. Use the search box (name, organization, phone or email) and the filters for product and person assigned.
4. Switch the layout between a table and a **board** (columns by stage) with the layout buttons.
5. To download the list as a spreadsheet, click **Export CSV**. It exports what the filters show.

### Add a lead yourself

1. **Leads** → **Add lead**.
2. Fill in the name, organization, country, phone or WhatsApp, email (optional), the product they are **Interested in**, the plan, and **What they need**.
3. Save. If the phone or email matches someone already in the system, Corex warns you about a likely duplicate.

### Work a lead

Open the lead (click its name). On its page:

1. **Status** (right side): change the **Stage** as things progress, choose who it is **Assigned to**, set the **Next follow-up** date and the **Next step** → **Save status**. If the stage is **Lost**, say **Why was it lost?**.
2. **Quote**: enter the amount and **What it covers** once you have given them a price, and save. **Download quote** gives it as a PDF.
3. **Notes and activity**: record what happened (a call, a meeting, a WhatsApp chat). Choose the **Activity type**, write **What happened** → **Add to timeline**. Notes cannot be edited or deleted later, so everyone can trust the history.
4. The **WhatsApp** and **email** buttons open a message to the lead straight away.

Follow-ups appear on the Dashboard on the day they are due.

### When a lead signs: convert it to a client

1. Open the lead → **Convert to client**.
2. Check the details copied from the lead, and fill in:
   - **City** and **Country**;
   - **Contract amount** and **Currency**;
   - **Plan**: **Managed** (you host it and they pay a yearly renewal) or **Handover** (they get the system, with a warranty period);
   - for Managed, the yearly renewal amount;
   - **Signing date**;
   - **Payment split (%)**: how the contract is paid in parts, for example 70, 30 (it must add up to 100). The usual split is 70% when the client approves the mock-up and design, and 30% when they approve the finished system.
3. Click **Convert to client**.

Corex then creates, in one go, the client, its contacts, a contract (numbered `CT-YY-MM-NNN`), a deployment and, for Managed clients, a subscription. The lead is marked **Won**. A lead can be converted only once.

---

## 5. Clients

Click **Clients** to see every organization with a signed contract. Tabs at the top group them by status: **Active**, **Setting up**, **Renewal due**, **Grace period**, **Paused**, **Ended**, **In warranty**. The cards at the top show totals.

**Add a client without a lead** (for example a referral): **Clients** → **Add client**, and fill in the same details as when converting.

### A client's page

Open a client. It has five tabs:

- **Overview**:
  - **Milestones**: each part payment of the contract, with a button to create its invoice.
  - **Deployment**: the state of their system. Click **Edit deployment** to set the **State** (setup, staging, live, paused, ended), the **App address**, **Target go-live**, and **Went live on**. When you mark a system **live**, a Managed client's subscription starts (renewal one year later) and a Handover client's warranty starts.
  - **Subscription**: the yearly renewal amount and the **Next renewal** date. Corex also compares the renewal with the **Hosting per month** cost so you do not undercharge.
  - **Edit client** changes the client's details.
- **Invoices**: every invoice for this client and what is still owed.
- **Contacts**: the people you deal with. There is one primary contact and one billing contact (the billing contact receives invoices). **Add contact** to add more.
- **Documents**: upload signed contracts, proposals and acceptance forms. Only admins can open them, through a link that lasts 10 minutes.
- **Activity**: everything that happened for this client.

---

## 6. Invoices, payments and receipts

### Invoice numbers

- Invoices: `CX-YY-MM-NNN`, for example `CX-26-11-001` (the year and month it is sent).
- Receipts: `RC-YY-MM-NNN`.
- The due date is the date sent plus the payment terms (7 days by default).

### Create an invoice for a milestone (the usual way)

1. Open the client → **Overview** → **Milestones** → click **Create invoice for milestone 1** (or 2, 3...).
2. The draft opens with the right amount filled in. Check the lines.
3. Optional:
   - **Discount**: choose the **Type** (percent or fixed amount), the value, and the **Reason (internal, never printed)**.
   - **Note to the client**: printed on the invoice.
   - **Payment terms (days)**.
4. The **Totals** box shows the result, with tax if it is set in Settings.
5. **Save draft**.

**Other invoices:** **Invoices and receipts** → **New invoice**, then choose the client and the kind (custom, for example extra training or a new feature). The **Price list** (Settings) fills in common items for you. Renewal invoices are created automatically (section 7).

### Send the invoice

1. On the draft, check everything once more. A draft can still be changed (**Edit draft**) or deleted (**Delete draft**).
2. Click **Send invoice** → confirm. The invoice gets its number and can no longer be changed. To correct a sent invoice, void it with a reason and create a new one.
3. Share it with the client in one or more ways:
   - **Email**: sends it with the PDF attached from `billing@corexlr.com`. The client's billing email is filled in; you can change the address. Tip: the first time, send it to yourself to see what clients receive.
   - **Copy for WhatsApp**: copies a short message with the amount, due date and a link. Paste it in WhatsApp.
   - **Download PDF**: to print or attach yourself.
   - **Client view link**: a private web link where the client sees the invoice and its balance. It lasts 30 days. **New client view link** creates a fresh one and ends the old one.

### Record a payment

When the client pays (in full or in part):

1. Open the invoice → **Record payment**.
2. Fill in:
   - the **Amount**;
   - the **Method**: Orange Money, MTN Mobile Money, Bank transfer, Wire transfer, Cash or USDT;
   - the **Reference** (the transaction ID from the mobile money message or bank);
   - the **Date received**.
3. Click **Record payment**.

A **receipt** (`RC-...`) is created automatically. Download it from the **Payments** list on the invoice and send it to the client. The invoice shows **Partly paid** until the full amount is in, then **Paid**. You cannot record more than what is owed.

**Mistake in a payment?** Use **Void payment** and give a reason. The payment and its receipt stay visible, marked void, and the balance goes back up. Payments and receipts are never deleted.

### See all invoices and receipts

**Invoices and receipts** has two tabs, **Invoices** and **Receipts**, with filters by status and totals per currency for what is outstanding and overdue.

---

## 7. Subscriptions and renewals

Managed clients pay a yearly renewal. Corex handles most of it for you:

1. **30 days before** the renewal date, the daily check creates the renewal invoice and emails it to the client from `billing@corexlr.com`.
2. Reminders go out **14 days** and **3 days** before the due date.
3. When the renewal invoice is paid, the next renewal date moves forward one year automatically.
4. If it is still unpaid after the due date, the client goes into the **Grace period**. **30 days past** the renewal, the client is flagged for pause on the Dashboard.

**Nothing is paused automatically.** When a client is flagged, contact them first. If you decide to pause, export their data, send it to them, then set their deployment **State** to paused on the client's page.

The **Subscriptions** page shows every Managed client with its renewal date, status (for example **Due soon**), the reminders sent and a link to the renewal invoice. It also lists Handover clients' warranty end dates.

The daily check runs by itself every morning. To run it at once (for example after changing a renewal date), use **Settings → Renewals → Run the daily check now**. Running it twice never sends anything twice.

---

## 7a. Analytics

**Analytics** in the menu shows how many people visited www.corexlr.com, counted by Cloudflare without cookies. Choose **Last 7 days** or **Last 30 days** at the top right; **Open in Cloudflare** shows the full detail.

- **Visits**: one person's time on the site. **Pages viewed**: every page they opened. Under each number, the change from the period before (for example "Up 20% vs previous 7 days").
- **Viewed on phones**: the share of pages opened on a phone.
- **Visits per day**: point at a bar to see that day's number.
- **Most viewed pages**, **Where visitors came from** (Google, Facebook, WhatsApp; "Direct or unknown" means they typed the address or the source was hidden), **Countries** and **Devices**.

Numbers refresh every 15 minutes. If the page says it is not connected yet, follow `docs/seo.md`, step 5.

## 8. Activity log

**Activity log** lists every change made in the admin: who did it, what changed and when. That includes sign-ins, leads, clients, invoices, payments and settings.

- Filter by person, type of activity or dates, or search by name or number.
- Click an entry to see the details.
- **Export CSV** if your accountant or auditor asks.

Nobody can edit or delete entries, not even an admin.

---

## 9. Settings

Open **Settings** in the menu. Each section has its own **Save** button.

- **Company details**: your company name, address, phone, billing email and Tax ID (TIN). They are printed on invoices, receipts and emails.
- **Invoicing and payments**:
  - the **Payment instructions** printed on every invoice (your Orange Money and MTN numbers, bank account details);
  - tax (for example GST) and payment terms;
  - the invoice and receipt prefixes.
- **Price list**: your standard products and services with their prices. They fill in invoice lines for you. Check these before your first invoice. **Add item** to add one.
- **Renewals**: switch each automatic step of the daily check on or off (renewal invoices, reminders, and so on), set the minimum renewal compared with hosting cost, and **Run the daily check now**. The 30-day grace period always applies.
- **Team**: everyone who can use Corex Admin.
  - **Invite an admin**: their name, a username and their email. They receive the set-up email (section 1). If it expired, use **New invite link**.
  - **Reset authenticator** for someone who lost their phone, and **Reset link** to send someone a new password link.
  - **Remove** someone who leaves (or **Cancel invite** if they never joined). They are signed out at once.
- **Security**: how long before inactive people are signed out, and how many days a trusted device lasts. **Forget trusted devices** removes the ones saved for your account, for example after losing a laptop.

---

## 10. Good habits

- Check the **Dashboard** and the **bell** every morning, and work through **Needs attention**.
- After every call or meeting, add a note to the lead or client, so anyone on the team can pick up where you left off.
- Record each payment on the day you receive it, with the transaction reference, and send the receipt.
- Keep your phone with the authenticator app safe. Have at least two admins, so one can reset the other.
- Never share your password or your 6-digit codes, including with Corex staff. Nobody legitimate will ask for them.

## 11. If something is not right

| What you see                                   | What to do                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "Sign-in is paused for 15 minutes"             | Too many wrong passwords. Wait 15 minutes, or use **Forgot password**.                                                           |
| The 6-digit code is refused                    | Wait for the next number in the app. Check the phone's time is set automatically.                                                |
| Lost your phone                                | Ask another admin: **Settings → Team → Reset authenticator**.                                                                    |
| A client says the invoice link no longer works | Links last 30 days. Open the invoice → **New client view link** and send the new one.                                            |
| The **Email** button is greyed out             | Client emails are switched off for the admin. Use **Copy for WhatsApp** or **Download PDF**, and tell whoever manages the setup. |
| An invoice was sent with a mistake             | **Void invoice** (with a reason), then create and send a corrected one.                                                          |
| A payment was recorded by mistake              | Open the invoice → **Void payment** with a reason.                                                                               |
| You see a "Sample data" chip in the top bar    | Example data is loaded. Ask whoever manages the setup to remove it before real use.                                              |
