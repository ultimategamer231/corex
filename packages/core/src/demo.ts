// Public demo instances and their sign-ins (SPEC.md 11.1, 11.2). Shared by the seed
// and reset scripts (packages/db), the demo login pages and the website. No imports,
// so Node can run it directly from the scripts.

/** Published password of every demo account. */
export const DEMO_PASSWORD = "Demo@2026";

export type DemoName = "college" | "highschool";

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
};

export type DemoInstance = {
  name: DemoName;
  schema: string;
  product: "school";
  /** Quote form product on the website (`/contact?product=`). */
  quoteProduct: string;
  /** Sign-ins published on the login page and the website. */
  accounts: DemoAccount[];
  /** Other fictional staff who teach classes; their passwords are random and never shown. */
  staff: DemoAccount[];
};

const account = (
  domain: string,
  slug: string,
  label: string,
  role: string,
  name: string,
): DemoAccount => ({ slug, label, role, email: `${slug}@${domain}`, name });

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
  },
};
