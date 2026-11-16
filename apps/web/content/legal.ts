// The website's legal pages (SPEC.md 6.1): terms of service, privacy policy and the
// Handover software license. Plain English, written from how Corex works today.
import { site } from "@/content/site";

export type LegalSlug = "terms" | "privacy" | "license";

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { list: string[] };

export type LegalDoc = {
  title: string;
  /** Short text for search results (160 characters or fewer). */
  description: string;
  intro: string;
  sections: { heading: string; body: LegalBlock[] }[];
};

/** Shown as "Last updated" on every legal page. Change it whenever the text changes. */
export const legalUpdated = { iso: "2026-11-16", label: "16 November 2026" };

const contactLine = `email ${site.email.address}, call or WhatsApp +${site.whatsapp.primary}, or visit us at ${site.address.street}, ${site.address.city}, ${site.address.country}`;

export const legalDocs: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Terms of service",
    description:
      "The terms for using the Corex website, live demos, software and services: quotes, payments, renewals, support and responsibilities.",
    intro: `These terms apply when you use the ${site.name} website and demos, ask us for a quote, or buy software or services from us. Your signed contract or accepted quote can add to these terms; where they differ, the contract wins.`,
    sections: [
      {
        heading: "Who we are",
        body: [
          `${site.name} ("Corex", "we", "us") is a software company based in ${site.address.city}, ${site.address.country}. We build, host and support the systems that schools, clinics, businesses, NGOs and other organizations use for their daily work.`,
          `To reach us, ${contactLine}.`,
        ],
      },
      {
        heading: "Our services",
        body: [
          "We offer ready-made systems with live demos (School, Clinic and Financial Management), custom software built around your work, websites, AI automation, IT consultancy, training, and data migration and hosting. Each system is offered on one of two plans:",
          {
            list: [
              "Managed: we build, host and look after the system for a first-year fee, then a yearly renewal.",
              "Handover: we build the system and hand it over for a one-time fee. You run it on your own server under the Software license.",
            ],
          },
          "What is included in your system (features, number of users, training, launch date) is set out in your quote or contract.",
        ],
      },
      {
        heading: "Quotes and contracts",
        body: [
          "Prices on this website are starting prices. Your final price is the one in your written quote. A quote becomes a contract when you accept it in writing (a signed contract, an email or a WhatsApp message) and pay the first payment.",
          "Changes you ask for after the design is agreed may change the price and the launch date. We will tell you the cost before doing the work.",
        ],
      },
      {
        heading: "Payments",
        body: [
          "Unless your contract says otherwise, you pay in two parts:",
          {
            list: [
              "70% when you approve the mock-up and design, before we build the system.",
              "30% when we deliver the finished system and you approve it.",
            ],
          },
          "We invoice in US dollars (USD) or Liberian dollars (LRD). You can pay by Orange Money, MTN Mobile Money, bank transfer, international wire, cash or USDT. We send a receipt for every payment. Transfer and mobile money fees are paid by the sender.",
          "Payments already made are not refunded for work that has been delivered. If a project stops before delivery, we will agree a fair settlement for the work done so far.",
        ],
      },
      {
        heading: "Using the demos",
        body: [
          "The live demos are for trying the software only. They contain made-up sample data, are shared with other visitors and reset every night.",
          {
            list: [
              "Do not enter real names, health records, financial details or any other real personal information.",
              "Do not try to break, overload or get around the demo's limits or security.",
              "Anything you enter is deleted at the nightly reset.",
            ],
          },
        ],
      },
      {
        heading: "Managed plan renewals",
        body: [
          "On the Managed plan, the first-year fee covers building, setup, hosting, backups, updates and support for the first year from launch. After that, a yearly renewal keeps the system running.",
          {
            list: [
              "We remind you before each renewal is due.",
              "If the renewal is not paid by the due date, a 30-day grace period starts. Nothing is switched off during the grace period.",
              "If it is still unpaid after the grace period, we pause access to the system until payment. Your data is kept safe and you can still ask us for a full export.",
              "If the system stays paused for 90 days, we will give you written notice and may then delete the system and its data.",
            ],
          },
          "You can stop renewing at any time. Before the system is closed we give you a full export of your data.",
        ],
      },
      {
        heading: "Hosting, backups and support",
        body: [
          "On the Managed plan we keep the system online, back it up every day and keep each backup for 30 days. We apply updates and security fixes and help your staff by WhatsApp, phone and email during working hours.",
          "We work hard to keep systems available, but we cannot promise they will never be interrupted, for example during internet or power outages, provider failures or planned maintenance. We tell you in advance about planned maintenance where we can.",
          "On the Handover plan, hosting, backups and security of your server are your responsibility. Support is covered by the warranty in the Software license, then paid.",
        ],
      },
      {
        heading: "Your data",
        body: [
          "You own all the data you put into your system. We use it only to run, support and back up the system for you, and never sell it. You can ask for a full export at any time. Our Privacy policy explains how we handle personal information.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          {
            list: [
              "Keep passwords and authenticator codes private, and remove access for staff who leave.",
              "Make sure the information you enter is accurate and that you are allowed to collect it, including any consent needed from students, parents, patients, staff, members or customers.",
              "Use the software only for lawful purposes and only inside your own organization.",
              "Pay invoices on time.",
            ],
          },
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "Corex owns the software, its design and its shared code. On the Managed plan you receive the right to use the system while your plan is active. On the Handover plan you receive the license described in our Software license. Your logo, documents and data remain yours.",
        ],
      },
      {
        heading: "Limits of liability",
        body: [
          "We are responsible for doing our work with reasonable care and skill. To the extent the law allows:",
          {
            list: [
              "We are not responsible for indirect losses such as lost profit, lost business or lost opportunity.",
              "We are not responsible for problems caused by incorrect data entered by your staff, by changes to the system made by anyone other than Corex, or by events outside our reasonable control.",
              "Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.",
            ],
          },
          "Nothing in these terms limits liability that cannot be limited by law.",
        ],
      },
      {
        heading: "Ending the service",
        body: [
          "You can end a Managed plan by not renewing it, or earlier by written notice. Fees already paid for the current year are not refunded. We can end the service with written notice if you seriously break these terms, for example by not paying or by misusing the system, and do not fix it within 30 days.",
          "When the service ends, we give you a full export of your data before closing the system.",
        ],
      },
      {
        heading: "Disputes and governing law",
        body: [
          `These terms are governed by the laws of the Republic of ${site.address.country}. If there is a disagreement, please contact us first and we will try to settle it in good faith within 30 days. If we cannot, either side may take it to the courts of ${site.address.country}.`,
        ],
      },
      {
        heading: "Changes to these terms",
        body: [
          "We may update these terms. The date at the top shows the latest version. If a change affects an active client, we will tell you by email or WhatsApp before it applies. Your signed contract stays as agreed.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    description:
      "How Corex collects, uses and protects personal information on its website and inside the systems it hosts for clients.",
    intro: `This policy explains what personal information ${site.name} collects through this website, how we use it and protect it, and how we handle the data our clients keep in the systems we host.`,
    sections: [
      {
        heading: "Who is responsible",
        body: [
          `${site.name}, ${site.address.street}, ${site.address.city}, ${site.address.country}, is responsible for the personal information collected on this website. For any privacy question, ${contactLine}.`,
        ],
      },
      {
        heading: "Information we collect",
        body: [
          "When you send the quote form, we collect what you type in:",
          {
            list: [
              "your name and organization",
              "your country",
              "your phone or WhatsApp number and, if you give it, your email address",
              "the system you are interested in, the plan, and your message",
              "the page you sent the form from",
            ],
          },
          "When you contact us by WhatsApp, phone or email, we keep the messages so we can reply and follow up.",
          "When you visit the website, our hosting provider records technical information such as your IP address and browser type to deliver pages and protect the site. We use your IP address for one hour to stop the quote form being misused. We also count visits with Cloudflare Web Analytics, which does not use cookies and does not track you across other websites.",
          "This website does not use advertising or tracking cookies.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          {
            list: [
              "to reply to your request and prepare a quote",
              "to provide, support and bill the services you buy from us",
              "to keep the website and our systems secure",
              "to understand which pages are useful, using visit counts only",
            ],
          },
          "We use your information because you asked us to contact you, because we need it to carry out our contract with you, or because we have a legitimate interest in running and protecting our business. We do not sell or rent personal information, and we do not use it for advertising.",
        ],
      },
      {
        heading: "Who we share it with",
        body: [
          "Only with the trusted providers that run our services for us, and only what each one needs:",
          {
            list: [
              "Vercel: hosts the website and our apps",
              "Supabase: stores our databases",
              "Cloudflare: domain name service, website analytics and backup storage",
              "Resend: sends emails from our systems",
              "Zoho: our company email",
            ],
          },
          "These providers may store data outside Liberia, for example in the United States or the European Union. We choose providers that protect data with strong security and contracts. We may also share information if the law requires it.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          {
            list: [
              "Quote requests that do not lead to a contract: deleted 1 year after our last contact.",
              "Client records, contracts, invoices and receipts: kept as long as the law requires for business and tax records.",
              "Website visit counts: kept as summaries that do not identify you.",
            ],
          },
        ],
      },
      {
        heading: "How we protect it",
        body: [
          "Data is encrypted between your browser and our servers. Access is limited to Corex staff who need it, and our team signs in with a password and an authenticator code. Our databases are backed up every day, and we keep a log of important actions in our systems.",
        ],
      },
      {
        heading: "Data in client systems",
        body: [
          "Schools, clinics, businesses, NGOs and other organizations that use our software on the Managed plan own the data they put into it, such as student, patient, staff, member, borrower and financial records. Patient and other health records are treated as sensitive: access is limited to what support needs. They decide what is collected and why. Corex stores and processes that data only on their instructions, to run, support and back up their system. The same applies to WhatsApp assistants and other automations we run for a client.",
          "Our staff look at client data only when needed to provide support or fix a problem, and keep it confidential. If you want to see, correct or delete information a school, clinic, business or other organization holds about you, please contact that organization. We will help them respond.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can ask us to:",
          {
            list: [
              "tell you what personal information we hold about you and give you a copy",
              "correct information that is wrong",
              "delete your information when we no longer need it",
              "stop contacting you",
            ],
          },
          `Send your request to ${site.email.address}. We will reply within 30 days. We may ask you to confirm who you are first.`,
        ],
      },
      {
        heading: "Children",
        body: [
          "This website is meant for organizations, not children, and we do not knowingly collect information from children through it. Student information in school systems is entered and controlled by the school.",
        ],
      },
      {
        heading: "Changes to this policy",
        body: [
          "We may update this policy. The date at the top shows the latest version. If a change is important, we will tell active clients by email or WhatsApp.",
        ],
      },
    ],
  },
  license: {
    title: "Software license",
    description:
      "The license for clients on the Corex Handover plan: what you may and may not do with the software, ownership, warranty and support.",
    intro: `This license applies to organizations that buy a system from ${site.name} on the Handover plan and receive a copy of the software to run on their own server. Your contract can add to it; where they differ, the contract wins.`,
    sections: [
      {
        heading: "Who this applies to",
        body: [
          'The organization named in the Handover contract ("you"), once the contract is signed and the full price is paid. The license covers the system named in the contract, its source code, documentation and the updates we deliver to you.',
        ],
      },
      {
        heading: "What you may do",
        body: [
          {
            list: [
              "Install and run the software on servers you control or rent, for as long as you like.",
              "Use it for your own organization, including all of its branches and campuses named in the contract.",
              "Change the code to suit your needs.",
              "Make copies for backup, testing and training.",
              "Hire your own developers or another company to work on it for you, as long as they keep it confidential.",
            ],
          },
        ],
      },
      {
        heading: "What you may not do",
        body: [
          {
            list: [
              "Sell, rent, share, sublicense or give the software, or a copy or changed version of it, to any other organization.",
              "Offer the software to others as a hosted service.",
              "Remove Corex copyright notices from the code.",
              "Use the code to build a product that competes with Corex.",
            ],
          },
        ],
      },
      {
        heading: "Ownership",
        body: [
          "Corex keeps ownership of the software, including the shared core used across our products. This license gives you the right to use it; it does not transfer ownership. You own all of your data, and any documents and branding you provide.",
        ],
      },
      {
        heading: "Warranty",
        body: [
          "For 60 days from the day the system goes live, we fix, at no cost, any defect where the software does not work as described in your contract. Report problems by WhatsApp, phone or email with enough detail for us to reproduce them.",
          "The warranty ends early if anyone other than Corex changes the code. It does not cover problems caused by your server, network, other software, or data entered incorrectly.",
          "Apart from this warranty, the software is provided as it is, and our liability is limited as set out in our Terms of service.",
        ],
      },
      {
        heading: "Support after the warranty",
        body: [
          "After the warranty, we offer paid support, fixes, updates and new features at the rate in your contract or in a new quote. You are free to use your own developers instead.",
        ],
      },
      {
        heading: "Ending the license",
        body: [
          'The license has no end date. It ends only if you break the rules in "What you may not do" and do not fix the problem within 30 days of our written notice. If it ends, you must stop using the software, but you keep your data and we will help you export it.',
        ],
      },
      {
        heading: "Governing law",
        body: [
          `This license is governed by the laws of the Republic of ${site.address.country}, as set out in our Terms of service.`,
        ],
      },
    ],
  },
};

export const legalOrder: LegalSlug[] = ["terms", "privacy", "license"];
