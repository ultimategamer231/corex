// The three ready-built systems (SPEC.md 6.1-6.3). Copy from the website mockup.
import type { PriceRow } from "./pricing";

export type ProductSlug = "school" | "clinic" | "finance";
export type PreviewKind = ProductSlug;

/** A demo login role: the button label and the `?role=` value the demo login page reads (SPEC.md 11.2). */
export type DemoRole = { label: string; slug: string };

export type Demo = {
  title: string;
  /** Subdomain under NEXT_PUBLIC_ROOT_DOMAIN (SPEC.md 11.1). */
  subdomain: string;
  roles: DemoRole[];
};

export type Product = {
  slug: ProductSlug;
  name: string;
  /** One line under the name on cards. */
  audience: string;
  badges: string[];
  tagline: string;
  /** Home page card: three key capabilities. */
  cardFeatures: [string, string, string];
  /** Software catalog entry. */
  catalog: { description: string; highlights: [string, string, string]; demoButtons: string[] };
  demoCta: string;
  problemTitle: string;
  problemText: string;
  modules: { title: string; items: string[] }[];
  note?: string;
  editions?: { feature: string; college: string; highSchool: string }[];
  roles: { role: string; can: string }[];
  callout?: string;
  /** Screens shown in the Screenshots section (SPEC.md 6.3). */
  screens: { title: string; description: string }[];
  demos: Demo[];
  priceIds: PriceRow["id"][];
  faqs: { q: string; a: string }[];
};

const role = (label: string, slug = label.toLowerCase()): DemoRole => ({ label, slug });

export const products: Record<ProductSlug, Product> = {
  school: {
    slug: "school",
    name: "School Management",
    audience: "College/University and High School editions",
    badges: ["College / University", "High School"],
    tagline:
      "Admissions, academics, attendance, grades, fees and portals for colleges and high schools, with two editions built for how each one works.",
    cardFeatures: [
      "Admissions, student records and portals",
      "Grades, transcripts and report cards",
      "Fees and receipts in USD and LRD",
    ],
    catalog: {
      description:
        "Admissions, academics, attendance, grades, fees and portals in one system. Colleges get course planning, credits and GPA. High schools get sections, marking periods and report cards.",
      highlights: [
        "Students plan their courses online (College)",
        "Grades approved and locked by the registrar",
        "Transcripts and report cards on your letterhead",
      ],
      demoButtons: ["College demo", "High School demo"],
    },
    demoCta: "Try the demos",
    problemTitle: "Stop chasing records across spreadsheets and paper files",
    problemText:
      "Grades sit in one teacher’s notebook, fee balances in another office, and transcripts are typed by hand. School Management keeps every record in one place, with approvals so results cannot change after they are published.",
    modules: [
      {
        title: "Admissions and records",
        items: [
          "Student registration with photo and guardians",
          "Generated student numbers with duplicate warnings",
          "Student and parent portals",
        ],
      },
      {
        title: "Academics",
        items: [
          "College: programs, courses, credits and prerequisites",
          "High School: grades, sections, subjects and marking periods",
          "Academic years and terms",
        ],
      },
      {
        title: "Course planning (College)",
        items: [
          "Students build a course plan when registration opens",
          "Checks for prerequisites, credit limits and full classes",
          "Registrar approves or returns each plan",
        ],
      },
      {
        title: "Attendance",
        items: [
          "Daily by class or by course session",
          "Works offline and syncs later",
          "Corrections recorded with a reason",
        ],
      },
      {
        title: "Grades and results",
        items: [
          "Teachers enter scores for their own classes only",
          "Registrar approves and locks results",
          "Transcripts, grade reports and report cards as PDF",
        ],
      },
      {
        title: "Fees",
        items: [
          "Fee items per program or grade",
          "Bulk invoices, part payments and receipts",
          "Debtor lists in USD and LRD",
        ],
      },
    ],
    editions: [
      {
        feature: "Structure",
        college: "Programs, departments, courses and credit hours",
        highSchool: "Grade levels, sections and subjects",
      },
      {
        feature: "Calendar",
        college: "Semesters with a registration window",
        highSchool: "Semesters with marking periods and exams",
      },
      {
        feature: "Grading",
        college: "Letter grades, GPA and CGPA",
        highSchool: "Scores from 0 to 100, period and semester averages",
      },
      {
        feature: "Course choice",
        college: "Students plan their own courses",
        highSchool: "Subjects come from the student’s section",
      },
      {
        feature: "Main documents",
        college: "Transcripts and semester grade reports",
        highSchool: "Report cards per period and semester",
      },
      {
        feature: "Year end",
        college: "Credits earned toward the program",
        highSchool: "Promotion decisions by the registrar",
      },
      { feature: "Parent portal", college: "Not included", highSchool: "Included" },
    ],
    roles: [
      { role: "Super Admin", can: "School settings, users and roles." },
      {
        role: "Registrar",
        can: "Admissions, academic setup, course plan approval, grade approval, transcripts and report cards.",
      },
      { role: "Instructor / Teacher", can: "Attendance and grades for their own classes only." },
      { role: "Bursar", can: "Fee items, invoices, payments, receipts and fee reports." },
      {
        role: "Student",
        can: "Own grades, attendance and balance. College students plan their courses.",
      },
      {
        role: "Parent",
        can: "Their children’s published grades, attendance and balance (High School).",
      },
    ],
    screens: [
      {
        title: "Registrar dashboard",
        description: "Enrollment, attendance today, fees collected and items waiting for approval.",
      },
      {
        title: "Grade approval",
        description: "Submitted grades by class, approved and locked by the registrar.",
      },
      {
        title: "Fees and receipts",
        description: "Invoices, part payments and debtor balances in USD and LRD.",
      },
    ],
    demos: [
      {
        title: "College / University demo",
        subdomain: "demo-college",
        roles: [
          role("Admin"),
          role("Registrar"),
          role("Instructor"),
          role("Bursar"),
          role("Student"),
        ],
      },
      {
        title: "High School demo",
        subdomain: "demo-school",
        roles: [
          role("Admin"),
          role("Registrar"),
          role("Teacher"),
          role("Bursar"),
          role("Student"),
          role("Parent"),
        ],
      },
    ],
    priceIds: ["school-highschool", "school-college"],
    faqs: [
      {
        q: "Can we bring in our existing student records?",
        a: "Yes. We move your records in from Excel or your old system as a data migration add-on.",
      },
      {
        q: "Can we use our own grading scale?",
        a: "Yes. The grading scale, pass mark and marking periods are settings we configure for your school.",
      },
      {
        q: "Do parents need to install an app?",
        a: "No. The portal works in a phone browser and can be added to the home screen.",
      },
      {
        q: "Can a locked grade be changed?",
        a: "Only the registrar can reopen it, and the reason is recorded.",
      },
    ],
  },
  clinic: {
    slug: "clinic",
    name: "Clinic Management",
    audience: "For outpatient clinics and medical centers",
    badges: ["Outpatient clinics", "Medical centers"],
    tagline:
      "Patient records, appointments and billing for outpatient clinics and medical centers.",
    cardFeatures: [
      "Patient records and visit history",
      "Appointments and walk-in queue",
      "Billing, receipts and daily cash report",
    ],
    catalog: {
      description:
        "Register patients, run appointments and the walk-in queue, record vitals and clinical notes, and bill each visit. Clinical notes are visible only to clinical staff.",
      highlights: [
        "Full visit history on one patient screen",
        "Every view of a patient record is logged",
        "Daily cash report and revenue by service",
      ],
      demoButtons: ["Try the Clinic demo"],
    },
    demoCta: "Try the demo",
    problemTitle: "Find any patient’s history in seconds",
    problemText:
      "Paper cards get lost and visits go unbilled. Clinic Management puts registration, visits, vitals, notes and billing in one system, and keeps clinical notes away from staff who do not need them.",
    modules: [
      {
        title: "Patients",
        items: [
          "Registration with next of kin and allergy alerts",
          "Search by name, phone or patient number",
          "Possible duplicate patients flagged",
        ],
      },
      {
        title: "Appointments and queue",
        items: [
          "Day calendar for each doctor",
          "Double booking blocked",
          "Walk-in queue from arrival to doctor",
        ],
      },
      {
        title: "Visits",
        items: [
          "Nurses record vitals, even offline",
          "Doctors write and sign clinical notes",
          "Corrections saved as new versions",
        ],
      },
      {
        title: "Files",
        items: [
          "Attach scans and lab results as PDF or image",
          "Opened through links that expire",
          "Access follows clinical permissions",
        ],
      },
      {
        title: "Billing",
        items: [
          "Price list of your services",
          "Invoices per visit, part payments and receipts",
          "Self, insurance or company as payer",
        ],
      },
      {
        title: "Reports",
        items: [
          "Daily cash report",
          "Revenue by service",
          "Visits by period, exported to PDF and Excel",
        ],
      },
    ],
    roles: [
      {
        role: "Admin",
        can: "Settings, users, service price list and reports. No access to clinical notes.",
      },
      { role: "Doctor", can: "Opens visits, writes and signs notes, sees full patient history." },
      { role: "Nurse", can: "Records vitals and intake; sees vitals and allergies." },
      { role: "Receptionist", can: "Registers patients, books appointments and runs the queue." },
      { role: "Cashier", can: "Invoices, payments, receipts and balances." },
    ],
    callout:
      "Clinical notes are visible only to doctors, and vitals only to doctors and nurses. Every time a patient record is opened, the system records who opened it and when.",
    screens: [
      { title: "Today", description: "Patients seen, appointments and revenue for the day." },
      {
        title: "Walk-in queue",
        description: "Each patient from arrival, to the nurse, to the doctor.",
      },
      {
        title: "Billing",
        description: "Invoices from visit services, part payments and receipts.",
      },
    ],
    demos: [
      {
        title: "Clinic demo",
        subdomain: "demo-clinic",
        roles: [
          role("Admin"),
          role("Doctor"),
          role("Nurse"),
          role("Receptionist", "reception"),
          role("Cashier"),
        ],
      },
    ],
    priceIds: ["clinic"],
    faqs: [
      {
        q: "Is patient data stored on staff phones?",
        a: "Only registrations and vitals entered offline, until they sync. Doctors’ notes are never stored on the device.",
      },
      {
        q: "Can we bill insurance companies?",
        a: "You can mark a visit as insurance- or company-paid and track the balance. Claim submission is not included.",
      },
      {
        q: "Does it include pharmacy stock or lab orders?",
        a: "Not in this version. We can build them on request.",
      },
      { q: "Are the demo patients real?", a: "No. Every patient in the demo is fictional." },
    ],
  },
  finance: {
    slug: "finance",
    name: "Financial Management",
    audience: "For small businesses and NGOs",
    badges: ["Small businesses", "NGOs"],
    tagline:
      "Income, expenses, invoices and payroll for small businesses and NGOs, in USD and LRD.",
    cardFeatures: [
      "Income and expenses across cash, bank and mobile money",
      "Invoices and monthly payroll with payslips",
      "Dashboards and reports you can export",
    ],
    catalog: {
      description:
        "Track money in and out across cash, bank and mobile money, send invoices, run monthly payroll and see where you stand on one dashboard.",
      highlights: [
        "Snap a receipt photo with each expense",
        "Payslips as PDF, with your own allowances and deductions",
        "Reports exported to Excel and PDF",
      ],
      demoButtons: ["Try the Finance demo"],
    },
    demoCta: "Try the demo",
    problemTitle: "Know where your money is, every day",
    problemText:
      "Cash in one drawer, mobile money on one phone, a bank account somewhere else. Financial Management brings them together so you can see income, spending and balances at a glance.",
    modules: [
      {
        title: "Income and expenses",
        items: [
          "Categories, customers and vendors",
          "Receipt photo on each expense",
          "New entries work offline",
        ],
      },
      {
        title: "Accounts",
        items: [
          "Cash, bank and mobile money",
          "Transfers between accounts",
          "Balances always up to date",
        ],
      },
      {
        title: "Invoices",
        items: ["Create and send as PDF", "Part payments and receipts", "List of overdue invoices"],
      },
      {
        title: "Payroll",
        items: [
          "Employees and monthly pay runs",
          "Your own allowances and deductions",
          "Payslips as PDF after owner approval",
        ],
      },
      {
        title: "Currencies",
        items: [
          "USD and LRD side by side",
          "Exchange rate saved on each transaction",
          "Past reports never shift",
        ],
      },
      {
        title: "Dashboard and reports",
        items: ["Income and expenses by month", "Spending by category", "Export to PDF and Excel"],
      },
    ],
    note: "Built for cash flow, invoices and payroll. It is not a full accounting package and does not replace your accountant.",
    roles: [
      { role: "Owner / Admin", can: "Everything, including settings, users and payroll approval." },
      { role: "Accountant", can: "Transactions, invoices, payroll preparation and reports." },
      { role: "Staff", can: "Records income and expenses only. No payroll or exports." },
    ],
    screens: [
      { title: "Overview", description: "Income and expenses by month and your cash position." },
      { title: "Overdue invoices", description: "Who owes you, and for how long." },
      { title: "Payroll", description: "Monthly runs approved by the owner, with payslips." },
    ],
    demos: [
      {
        title: "Finance demo",
        subdomain: "demo-finance",
        roles: [role("Owner"), role("Accountant"), role("Staff")],
      },
    ],
    priceIds: ["finance"],
    faqs: [
      {
        q: "Does it calculate tax for us?",
        a: "No. You set your own deduction rates, and your accountant confirms them.",
      },
      { q: "Can staff see payroll?", a: "No. Staff can only record income and expenses." },
      {
        q: "Can we delete a wrong entry?",
        a: "Posted entries are voided with a reason instead, so the history stays complete.",
      },
      {
        q: "Can it track donor or grant funds?",
        a: "Not in this version. We can build it on request.",
      },
    ],
  },
};

export const productOrder: ProductSlug[] = ["school", "clinic", "finance"];
