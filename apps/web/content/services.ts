// Services pages (SPEC.md 6.1). Copy from the website mockup.

export type ServiceSlug = "ai-automation" | "it-consultancy" | "training";

export type Service = {
  slug: ServiceSlug;
  name: string;
  /** Short line on cards and in the services menu. */
  summary: string;
  tagline: string;
  audience: string[];
  offerTitle: string;
  offers: { title: string; text: string }[];
  steps: { title: string; text: string }[];
};

export const services: Record<ServiceSlug, Service> = {
  "ai-automation": {
    slug: "ai-automation",
    name: "AI Automation",
    summary: "WhatsApp assistants and automated tasks",
    tagline:
      "Let software handle the repetitive work: answering common questions, taking orders and bookings, and preparing routine reports.",
    audience: [
      "Restaurants and shops taking orders on WhatsApp",
      "Hotels and guesthouses handling bookings",
      "Schools and NGOs answering the same questions every day",
      "Teams preparing the same report every week",
    ],
    offerTitle: "Automation that fits how you already work",
    offers: [
      {
        title: "WhatsApp assistants",
        text: "Answer common questions, take orders and bookings, and hand the chat to a person when needed.",
      },
      {
        title: "Automated reports",
        text: "Pull figures from your systems into a daily or weekly summary, sent by email or WhatsApp.",
      },
      {
        title: "Document processing",
        text: "Read forms, invoices or receipts and put the data into a spreadsheet or your system.",
      },
      {
        title: "Connected tools",
        text: "Link your website, forms, spreadsheets and Corex systems so data is entered once.",
      },
    ],
    steps: [
      {
        title: "Find the task",
        text: "We look at where your staff repeat the same work and pick one task to start with.",
      },
      {
        title: "Build a pilot",
        text: "A small working version, tested with real conversations or documents.",
      },
      {
        title: "Check it with your team",
        text: "We adjust it until your staff trust the results.",
      },
      { title: "Roll out and support", text: "We expand it and keep it running." },
    ],
  },
  "it-consultancy": {
    slug: "it-consultancy",
    name: "IT Consultancy",
    summary: "Systems, networks and planning",
    tagline:
      "Practical advice on the systems, networks and devices your organization depends on, from people who build and run them.",
    audience: [
      "Schools and colleges setting up labs or records",
      "Clinics moving from paper to digital",
      "NGOs planning a digital project for donors",
      "Businesses choosing software",
    ],
    offerTitle: "Clear advice you can act on",
    offers: [
      {
        title: "Systems review",
        text: "We look at your current tools, data and problems, then give a written report with priorities.",
      },
      {
        title: "Software selection",
        text: "We compare options against your budget and needs, including products we do not sell.",
      },
      {
        title: "Network and device setup",
        text: "We plan and set up office networks, Wi-Fi, computers and backups.",
      },
      {
        title: "Digital roadmap",
        text: "A phased plan for moving work online, with costs and timelines.",
      },
    ],
    steps: [
      { title: "Listen", text: "We meet the people who do the work, not only management." },
      { title: "Review", text: "We check your systems, data and network on site." },
      { title: "Recommend", text: "You receive a written report with priorities and costs." },
      { title: "Implement", text: "We carry out the plan with you, or hand it to your team." },
    ],
  },
  training: {
    slug: "training",
    name: "Training & Capacity Building",
    summary: "Staff training and digital skills",
    tagline:
      "Hands-on training so your staff use technology with confidence, delivered on site in Monrovia or online.",
    audience: [
      "Staff using a Corex system for the first time",
      "Schools building digital skills for teachers",
      "NGOs running capacity-building programs",
      "Offices moving from paper to computers",
    ],
    offerTitle: "Training built around real tasks",
    offers: [
      {
        title: "System training",
        text: "Role-based sessions for admins, registrars, teachers, cashiers and accountants.",
      },
      {
        title: "Digital skills",
        text: "Computer basics, email, and office tools such as Microsoft Office or Google Workspace.",
      },
      {
        title: "Train the trainer",
        text: "We prepare key staff to train new colleagues after we leave.",
      },
      {
        title: "Program workshops",
        text: "Custom workshops for NGO and institutional programs, with printed materials.",
      },
    ],
    steps: [
      { title: "Assess", text: "We check current skill levels and what each role needs." },
      { title: "Plan", text: "A schedule of short, practical sessions." },
      { title: "Train", text: "Hands-on practice with your own systems and data." },
      { title: "Follow up", text: "A check-in after a few weeks to answer new questions." },
    ],
  },
};

export const serviceOrder: ServiceSlug[] = ["ai-automation", "it-consultancy", "training"];
