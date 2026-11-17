// Public demo instances and their sign-ins (SPEC.md 11.1, 11.2). Shared by the seed
// and reset scripts (packages/db), the demo login pages and the website. No imports,
// so Node can run it directly from the scripts.

/** Published password of every demo account. */
export const DEMO_PASSWORD = "Demo@2026";

export type DemoName = "college" | "highschool" | "clinic" | "finance";

export type DemoAccount = {
  /** The `?role=` value on the login page and the email's local part. */
  slug: string;
  /** Button text: "Log in as <label>". */
  label: string;
  /** Membership role in the schema. */
  role: string;
  email: string;
  /** Display name of the fictional person. */
  name: string;
  /** One line on what this role can do, shown on the demo sign-in page. */
  summary?: string;
};

export type DemoInstance = {
  name: DemoName;
  schema: string;
  product: "school" | "clinic" | "finance";
  /** Quote form product on the website (`/contact?product=`). */
  quoteProduct: string;
  /** Sign-ins published on the login page and the website. */
  accounts: DemoAccount[];
  /** Other fictional staff who teach classes; their passwords are random and never shown. */
  staff: DemoAccount[];
  /** Sign-in page copy: a short lead and a few things worth trying. */
  pitch: { tag: string; lead: string; tries: string[] };
  /** "Things to try" on the dashboard; a step ticks when one of its pages is opened. */
  steps: DemoStep[];
};

export type DemoStep = {
  id: string;
  label: string;
  /** Where the step starts; also the menu entry a role needs to see the step. */
  href: string;
  /** Regular expression (as text) for the pages that complete the step. */
  match: string;
};

const step = (id: string, label: string, href: string, match: string): DemoStep => ({
  id,
  label,
  href,
  match,
});

/** The steps this visitor's menu can reach. */
export function demoSteps(demo: DemoInstance, navHrefs: readonly string[]): DemoStep[] {
  return demo.steps.filter((s) => navHrefs.includes(s.href));
}

/** What each published demo role can do, keyed by "<demo domain>:<slug>". */
const SUMMARIES: Record<string, string> = {
  "college:admin": "Sees everything: students, fees, reports and settings.",
  "college:registrar": "Admits students, approves course plans and locks grades.",
  "college:instructor": "Takes attendance and enters grades for their own classes.",
  "college:bursar": "Issues fee invoices, records payments and prints receipts.",
  "college:student": "Plans courses, and sees grades and the fee balance.",
  "school:admin": "Sees everything: students, fees, reports and settings.",
  "school:registrar": "Admits students, sets up classes and promotes them at year end.",
  "school:teacher": "Takes attendance and enters marks for their own classes.",
  "school:bursar": "Issues fee invoices, records payments and prints receipts.",
  "school:student": "Sees report cards, attendance and the fee balance.",
  "school:parent": "Follows their child's marks, attendance and fees.",
  "clinic:admin": "Sees patients, appointments, reports and settings, and manages staff.",
  "clinic:doctor": "Opens visits, writes notes, diagnoses and prescriptions.",
  "clinic:nurse": "Records vital signs and prepares patients for the doctor.",
  "clinic:reception": "Registers patients, books appointments and runs the queue.",
  "clinic:cashier": "Bills visits, takes payments and prints receipts.",
  "finance:owner": "Sees everything: balances, reports, payroll and settings.",
  "finance:accountant": "Records income and expenses, invoices customers, runs payroll.",
  "finance:staff": "Records day-to-day sales and expenses only.",
};

const account = (
  domain: string,
  slug: string,
  label: string,
  role: string,
  name: string,
): DemoAccount => ({
  slug,
  label,
  role,
  email: `${slug}@${domain}`,
  name,
  summary: SUMMARIES[`${domain.split(".")[0]}:${slug}`],
});

export const DEMOS: Record<DemoName, DemoInstance> = {
  college: {
    name: "college",
    schema: "demo_college",
    product: "school",
    quoteProduct: "school-college",
    accounts: [
      account("college.demo.corex.test", "admin", "Admin", "super_admin", "Korpo Wleh"),
      account("college.demo.corex.test", "registrar", "Registrar", "registrar", "Jartu Kollie"),
      account("college.demo.corex.test", "instructor", "Instructor", "instructor", "Emmanuel Toe"),
      account("college.demo.corex.test", "bursar", "Bursar", "bursar", "Hawa Sackor"),
      account("college.demo.corex.test", "student", "Student", "student", "Ama Kpadeh"),
    ],
    staff: [
      ["faculty1", "Josephine Mulbah"],
      ["faculty2", "Augustine Kiazolu"],
      ["faculty3", "Oretha Pewee"],
      ["faculty4", "Benedict Zinnah"],
      ["faculty5", "Garmai Tarr"],
      ["faculty6", "Darius Nyumah"],
    ].map(([slug = "", name = ""]) =>
      account("college.demo.corex.test", slug, "Instructor", "instructor", name),
    ),
    pitch: {
      tag: "College demo",
      lead: "A working copy with 300 sample students. Pick a role and you are signed in straight away. Nothing you do here affects anyone.",
      tries: [
        "Approve course registrations",
        "Enter grades and print a transcript",
        "Record a fee payment in USD or LRD",
        "Take attendance without internet",
      ],
    },
    steps: [
      step("student", "Open a student's record", "/students", "^/students/[^/]+"),
      step("registration", "Review course registrations", "/registration", "^/registration"),
      step("attendance", "Open an attendance register", "/attendance", "^/attendance"),
      step("grades", "Open a class grade sheet", "/grades", "^/grades/.+"),
      step("fees", "See who owes fees", "/fees", "^/fees"),
      step("reports", "Open the reports", "/reports", "^/reports"),
      step("planning", "Plan your courses", "/planning", "^/planning"),
    ],
  },
  highschool: {
    name: "highschool",
    schema: "demo_highschool",
    product: "school",
    quoteProduct: "school-highschool",
    accounts: [
      account("school.demo.corex.test", "admin", "Admin", "super_admin", "Rebecca Nagbe"),
      account("school.demo.corex.test", "registrar", "Registrar", "registrar", "Lusu Massaquoi"),
      account("school.demo.corex.test", "teacher", "Teacher", "teacher", "Musa Kromah"),
      account("school.demo.corex.test", "bursar", "Bursar", "bursar", "Patience Flomo"),
      account("school.demo.corex.test", "student", "Student", "student", "Kebeh Doe"),
      account("school.demo.corex.test", "parent", "Parent", "parent", "Comfort Doe"),
    ],
    staff: [
      ["faculty1", "Esther Karnga"],
      ["faculty2", "Samuel Dolo"],
      ["faculty3", "Watta Sumo"],
      ["faculty4", "Moses Fahnbulleh"],
      ["faculty5", "Decontee Quaye"],
      ["faculty6", "Isaac Yarkpawolo"],
      ["faculty7", "Teta Garnett"],
    ].map(([slug = "", name = ""]) =>
      account("school.demo.corex.test", slug, "Teacher", "teacher", name),
    ),
    pitch: {
      tag: "High School demo",
      lead: "A working copy with sample students, classes and marks. Pick a role and you are signed in straight away. Nothing you do here affects anyone.",
      tries: [
        "Enter marks and print a report card",
        "Take attendance without internet",
        "Record a fee payment in USD or LRD",
        "Promote a class to the next grade",
      ],
    },
    steps: [
      step("student", "Open a student's record", "/students", "^/students/[^/]+"),
      step("attendance", "Open an attendance register", "/attendance", "^/attendance"),
      step("grades", "Open a class mark sheet", "/grades", "^/grades"),
      step("fees", "See who owes fees", "/fees", "^/fees"),
      step("reports", "Open the reports", "/reports", "^/reports"),
    ],
  },
  clinic: {
    name: "clinic",
    schema: "demo_clinic",
    product: "clinic",
    quoteProduct: "clinic",
    accounts: [
      account("clinic.demo.corex.test", "admin", "Admin", "admin", "Siah Gray"),
      account("clinic.demo.corex.test", "doctor", "Doctor", "clinician", "Dr. Martha Tamba"),
      account("clinic.demo.corex.test", "nurse", "Nurse", "nurse", "Precious Kpoto"),
      account(
        "clinic.demo.corex.test",
        "reception",
        "Receptionist",
        "receptionist",
        "Mamie Cooper",
      ),
      account("clinic.demo.corex.test", "cashier", "Cashier", "cashier", "Joseph Harris"),
    ],
    staff: [
      account("clinic.demo.corex.test", "doctor2", "Doctor", "clinician", "Dr. Francis Zayzay"),
      account("clinic.demo.corex.test", "doctor3", "Doctor", "clinician", "Dr. Weade Barclay"),
    ],
    pitch: {
      tag: "Clinic demo",
      lead: "A working copy with 400 sample patients. Pick a role and you are signed in straight away. Nothing you do here affects anyone.",
      tries: [
        "Register a patient and book an appointment",
        "Run the queue and open a visit",
        "Bill a visit and print the receipt",
        "Keep working when the internet drops",
      ],
    },
    steps: [
      step("patient", "Open a patient's record", "/patients", "^/patients/[^/]+"),
      step("appointments", "See today's appointments", "/appointments", "^/appointments"),
      step("queue", "Open the waiting queue", "/queue", "^/queue"),
      step("billing", "Open billing", "/billing", "^/billing"),
      step("reports", "Open the reports", "/reports", "^/reports"),
    ],
  },
  finance: {
    name: "finance",
    schema: "demo_finance",
    product: "finance",
    quoteProduct: "finance",
    accounts: [
      account("finance.demo.corex.test", "owner", "Owner", "owner", "Musu Johnson"),
      account("finance.demo.corex.test", "accountant", "Accountant", "accountant", "Prince Kollie"),
      account("finance.demo.corex.test", "staff", "Staff", "staff", "Fatu Kamara"),
    ],
    staff: [],
    pitch: {
      tag: "Finance demo",
      lead: "A working copy with a year of sample income and expenses. Pick a role and you are signed in straight away. Nothing you do here affects anyone.",
      tries: [
        "Record income and expenses in USD or LRD",
        "Send an invoice and record its payment",
        "Run payroll and print payslips",
        "See profit and loss for any period",
      ],
    },
    steps: [
      step("transactions", "See money in and out", "/transactions", "^/transactions"),
      step("invoice", "Open an invoice", "/invoices", "^/invoices/[^/]+"),
      step("accounts", "Check the account balances", "/accounts", "^/accounts"),
      step("payroll", "Open payroll", "/payroll", "^/payroll"),
      step("reports", "Open the reports", "/reports", "^/reports"),
    ],
  },
};
