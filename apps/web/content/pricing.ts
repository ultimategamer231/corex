// Starting prices in US dollars (SPEC.md 6.1: from a config file). Values from the
// website mockup until BUSINESS.md confirms them (PROGRESS.md open question).

export type PriceRow = {
  id: "finance" | "school-highschool" | "clinic" | "school-college";
  name: string;
  /** Short label on a product page's price table. */
  productLabel: string;
  managedFirstYear: number;
  managedRenewal: number;
  handover: number;
};

export const prices: PriceRow[] = [
  {
    id: "finance",
    name: "Financial Management (SME)",
    productLabel: "Financial Management (SME)",
    managedFirstYear: 1200,
    managedRenewal: 300,
    handover: 1800,
  },
  {
    id: "school-highschool",
    name: "School Management: High School",
    productLabel: "High School",
    managedFirstYear: 1800,
    managedRenewal: 450,
    handover: 2500,
  },
  {
    id: "clinic",
    name: "Clinic Management",
    productLabel: "Clinic Management",
    managedFirstYear: 2500,
    managedRenewal: 600,
    handover: 3500,
  },
  {
    id: "school-college",
    name: "School Management: College / University",
    productLabel: "College / University",
    managedFirstYear: 3000,
    managedRenewal: 750,
    handover: 4000,
  },
];

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export const plans = {
  managed: {
    key: "managed",
    label: "Plan A",
    tag: "We host it",
    name: "Managed",
    homeSummary:
      "We build, host and look after it. You pay a first-year fee, then a yearly renewal.",
    homePoints: [
      "Hosting, database and daily backups included",
      "Updates, security patches and support",
      "Your data can be exported any time",
    ],
    bestFor: "Best if you have no IT staff and want someone responsible for keeping it running.",
    youPay:
      "A first-year fee that covers building, setup, hosting and training, then a yearly renewal.",
    points: [
      "Hosting and your own database",
      "Daily backups kept for 30 days",
      "Updates and security patches",
      "Support while your plan is active",
      "Export your data whenever you want",
    ],
  },
  handover: {
    key: "handover",
    label: "Plan B",
    tag: "You host it",
    name: "Handover",
    homeSummary: "We build it and hand it over. You pay once and run it on your own server.",
    homePoints: [
      "One-time fee, no yearly renewal",
      "Source code under a license for your organization",
      "60-day bug-fix warranty, then paid support",
    ],
    bestFor: "Best if you have your own IT team and server, and want to run it yourselves.",
    youPay: "A one-time fee. No yearly renewal.",
    points: [
      "Source code under a license for your organization",
      "Setup guide and handover documents",
      "60-day bug-fix warranty",
      "Paid support and updates after the warranty",
      "Full control of your server and data",
    ],
  },
} as const;

export const comparison: { feature: string; managed: string; handover: string }[] = [
  { feature: "Who hosts it", managed: "Corex", handover: "You" },
  {
    feature: "How you pay",
    managed: "First-year fee, then yearly renewal",
    handover: "One-time fee",
  },
  { feature: "Backups", managed: "Daily, kept 30 days", handover: "Your responsibility" },
  {
    feature: "Updates and new features",
    managed: "Included in renewal",
    handover: "Paid per request",
  },
  { feature: "Support", managed: "Included while active", handover: "60-day warranty, then paid" },
  {
    feature: "Source code",
    managed: "Stays with Corex",
    handover: "Licensed to your organization",
  },
  {
    feature: "Your data",
    managed: "Yours, exportable any time",
    handover: "Yours, on your server",
  },
];

export const addOns: { name: string; price: string }[] = [
  { name: "Data migration from Excel or an old system", price: "$200 to $500" },
  { name: "On-site training in Monrovia", price: "$100 per day" },
  { name: "Custom work outside the agreed scope", price: "$25 to $40 per hour" },
  { name: "Extra branches or many more users", price: "Quoted" },
];

export const paymentSchedule = [
  { percent: 50, when: "when the contract is signed" },
  { percent: 30, when: "when you approve the test version" },
  { percent: 20, when: "at go-live" },
] as const;

export const paymentMethods = [
  "In Liberia: Orange Money, MTN Mobile Money, or USD bank transfer",
  "International: bank wire or another method we agree on",
  "Every payment gets an invoice and a receipt",
];

export const pricingFaqs = [
  {
    q: "What happens if we do not renew the managed plan?",
    a: "After 30 days without payment, we export all your data, send it to you, and pause your system. Nothing is deleted without warning.",
  },
  {
    q: "Can we switch from Managed to Handover later?",
    a: "Yes. We quote the difference and hand over the code and your data.",
  },
  {
    q: "Can we resell the software after a Handover?",
    a: "No. The license covers use and changes within your own organization only.",
  },
];
