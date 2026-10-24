// Placeholder legal pages with a visible Draft notice (SPEC.md 6.1) until counsel supplies text.
export type LegalSlug = "terms" | "privacy" | "license";

export const legalDocs: Record<
  LegalSlug,
  { title: string; intro: string; sections: { heading: string; summary: string }[] }
> = {
  terms: {
    title: "Terms of service",
    intro:
      "These terms will explain how Corex Digital Solutions provides its software, demos and services, and what each side agrees to.",
    sections: [
      {
        heading: "Who we are",
        summary:
          "Corex Digital Solutions, a software studio based in Monrovia, Liberia, and how to reach us.",
      },
      {
        heading: "Our services",
        summary:
          "Ready-built software, systems built on request, websites, AI automation, IT consultancy and training.",
      },
      {
        heading: "Quotes, contracts and payment",
        summary:
          "How quotes become contracts, the payment milestones, and accepted payment methods.",
      },
      {
        heading: "Using the demos",
        summary:
          "Demos contain fictional sample data, reset every night, and may not be used for real records.",
      },
      {
        heading: "Managed plan renewals",
        summary: "What the yearly renewal covers, and what happens when a renewal is late.",
      },
      {
        heading: "Your responsibilities",
        summary: "Keeping logins secure and making sure the data you enter is lawful and accurate.",
      },
      { heading: "Limits of liability", summary: "The limits of what Corex is responsible for." },
      { heading: "Changes to these terms", summary: "How we will tell you about changes." },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro:
      "This policy will explain what personal information Corex collects through this website and how we handle data inside the systems we host.",
    sections: [
      {
        heading: "Information we collect",
        summary:
          "Details you send through the quote form: name, organization, country, phone or WhatsApp number, email and message.",
      },
      {
        heading: "How we use it",
        summary: "Only to reply to your request and prepare a quote. We do not sell it.",
      },
      {
        heading: "Where it is stored",
        summary: "Where website data and hosted client data are kept, and who can access them.",
      },
      {
        heading: "How long we keep it",
        summary: "How long quote requests and related messages are kept.",
      },
      {
        heading: "Data in client systems",
        summary:
          "On the Managed plan, the client owns its data and Corex processes it on the client’s behalf.",
      },
      {
        heading: "Your rights",
        summary: "How to ask us to see, correct or delete your information.",
      },
    ],
  },
  license: {
    title: "Software license",
    intro:
      "This license will apply to clients on the Handover plan who receive a copy of the source code.",
    sections: [
      {
        heading: "Who this applies to",
        summary: "Organizations that buy a system on the Handover plan.",
      },
      {
        heading: "What you may do",
        summary: "Use, run and modify the software for your own organization, with no time limit.",
      },
      {
        heading: "What you may not do",
        summary: "Resell, redistribute, sublicense or offer the software to other organizations.",
      },
      {
        heading: "Ownership",
        summary:
          "Corex keeps ownership of the software and its shared core. You own all of your data.",
      },
      {
        heading: "Warranty",
        summary:
          "A 60-day bug-fix warranty from go-live. It ends if the code is modified by anyone other than Corex.",
      },
      {
        heading: "Support after the warranty",
        summary: "Paid support and updates at the rate in your contract.",
      },
      {
        heading: "Ending the license",
        summary: "When the license can end, and what happens to the software if it does.",
      },
    ],
  },
};

export const legalOrder: LegalSlug[] = ["terms", "privacy", "license"];
