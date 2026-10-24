// Demo data for the Finance demo (SPEC.md 11.4): three accounts in USD and LRD,
// eighteen months of income and expenses with seasonal variation, 25 customers and
// vendors, 30 invoices, 12 employees and 12 approved, paid payroll runs. Fully
// fictional, from a fixed random seed, dated relative to today.
import { randomUUID } from "node:crypto";
import { person } from "./people.ts";
import { addDays, asUser, day, insert, type Row, type SeedContext, userId } from "./seed.ts";

const COUNTERPARTIES: [name: string, type: "customer" | "vendor" | "both"][] = [
  ["Kollie Family Supermarket", "customer"],
  ["Gbarnga Farmers Cooperative", "both"],
  ["Sinkor Corner Pharmacy", "customer"],
  ["Red Light Wholesale Traders", "both"],
  ["Duala Market Women Group", "customer"],
  ["Buchanan Fresh Fish", "customer"],
  ["Ganta Building Supplies", "vendor"],
  ["Harper Beach Guesthouse", "customer"],
  ["Kakata Rice Mill", "vendor"],
  ["Voinjama Coffee Growers", "vendor"],
  ["Congo Town Bakery", "customer"],
  ["ELWA Junction Electronics", "customer"],
  ["Logan Town Tailoring", "customer"],
  ["Johnsonville Poultry Farm", "vendor"],
  ["Brewerville Garden Produce", "customer"],
  ["Mamba Point Office Supplies", "vendor"],
  ["Tubman Boulevard Cafe", "customer"],
  ["Zwedru Timber Works", "vendor"],
  ["Gardnersville Auto Parts", "both"],
  ["New Kru Town Fishermen Group", "customer"],
  ["Bomi Transport Union", "vendor"],
  ["Robertsport Surf Lodge", "customer"],
  ["Lofa Palm Oil Producers", "customer"],
  ["Sanniquellie Grocers", "customer"],
  ["Paynesville Print Shop", "customer"],
];

const INCOME = ["Sales", "Services", "Other income"] as const;
const EXPENSE = [
  "Rent",
  "Salaries",
  "Utilities",
  "Transport",
  "Supplies",
  "Stock purchases",
  "Marketing",
  "Bank charges",
] as const;

const ITEMS = [
  ["Rice, 25 kg bag", 3_200],
  ["Cooking oil, 20 litre", 4_500],
  ["Cement, 50 kg bag", 1_150],
  ["Zinc roofing sheet", 950],
  ["Printing and binding", 2_500],
  ["Delivery service", 3_000],
  ["Stationery pack", 1_800],
  ["Generator servicing", 6_500],
] as const;

/** Sales are higher before Christmas and lower in the rainy season. */
function season(month: number): number {
  return (
    ({ 12: 1.4, 11: 1.15, 1: 0.9, 7: 0.8, 8: 0.8, 9: 0.85 } as Record<number, number>)[month] ?? 1
  );
}

/** First day of the month `back` months before the current one, as yyyy-mm-dd. */
function monthStart(back: number): string {
  const now = new Date(`${day()}T00:00:00Z`);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    .toISOString()
    .slice(0, 10);
}

function monthEnd(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export async function seedFinance(ctx: SeedContext): Promise<void> {
  const { random, tx, schema: s } = ctx;
  const today = day();
  const owner = userId(ctx, "owner");
  const accountant = userId(ctx, "accountant");
  const staff = userId(ctx, "staff");

  await insert(ctx, "settings", [
    {
      org_name: "Corex Demo Traders",
      address: "Randall Street, Monrovia",
      phone: "+231 770 000 300",
      email: "accounts@finance.demo.corex.test",
      letterhead_text: "General merchandise and delivery",
      base_currency: "USD",
    },
  ]);

  const opened = monthStart(17);
  const accounts = {
    cash: randomUUID(),
    bank: randomUUID(),
    mobile: randomUUID(),
  };
  await insert(ctx, "accounts", [
    {
      id: accounts.cash,
      name: "Cash box",
      type: "cash",
      currency: "USD",
      opening_balance_minor: 200_000,
      opened_on: opened,
    },
    {
      id: accounts.bank,
      name: "Bank account (USD)",
      type: "bank",
      currency: "USD",
      opening_balance_minor: 1_500_000,
      opened_on: opened,
    },
    {
      id: accounts.mobile,
      name: "Mobile money (LRD)",
      type: "mobile_money",
      currency: "LRD",
      opening_balance_minor: 35_000_000,
      opened_on: opened,
    },
  ]);

  const categories = new Map<string, string>();
  await insert(
    ctx,
    "categories",
    [...INCOME.map((n) => [n, "income"]), ...EXPENSE.map((n) => [n, "expense"])].map(
      ([name, type]) => {
        const id = randomUUID();
        categories.set(name ?? "", id);
        return { id, name: name ?? "", type: type ?? "" };
      },
    ),
  );
  const cat = (name: string) => categories.get(name) ?? "";

  const parties = COUNTERPARTIES.map(([name, type]) => ({ id: randomUUID(), name, type }));
  await insert(
    ctx,
    "counterparties",
    parties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      phone: `+231 77${random.int(0, 9)} ${random.int(100, 999)} ${random.int(100, 999)}`,
      email: null,
    })),
  );
  const customers = parties.filter((p) => p.type !== "vendor");
  const vendors = parties.filter((p) => p.type !== "customer");

  // Monthly reference rate, LRD per USD, drifting from about 186 to 194.
  const months = Array.from({ length: 18 }, (_v, i) => monthStart(17 - i));
  const lrdPerUsd = new Map(
    months.map((m, i) => [m, 186 + Math.round(i * 0.45 * 100) / 100 + random.int(0, 10) / 10]),
  );
  await insert(
    ctx,
    "exchange_rates",
    months.map((m) => ({
      date: m,
      from_currency: "USD",
      to_currency: "LRD",
      rate: lrdPerUsd.get(m) ?? 190,
    })),
  );

  // Income, expenses and transfers, entered directly with the month's rate saved.
  const entries: Row[] = [];
  const entry = (
    type: "income" | "expense" | "transfer",
    date: string,
    account: keyof typeof accounts,
    amountMinor: number,
    extra: {
      category?: string;
      to?: keyof typeof accounts;
      counterparty?: string;
      memo?: string;
      by?: string;
    } = {},
  ) => {
    if (date > today) return;
    const currency = account === "mobile" ? "LRD" : "USD";
    const rate =
      currency === "USD"
        ? 1
        : Math.round((1 / (lrdPerUsd.get(`${date.slice(0, 7)}-01`) ?? 190)) * 1e6) / 1e6;
    entries.push({
      id: randomUUID(),
      type,
      date,
      account_id: accounts[account],
      to_account_id: extra.to ? accounts[extra.to] : null,
      category_id: extra.category ? cat(extra.category) : null,
      counterparty_id: extra.counterparty ?? null,
      amount_minor: amountMinor,
      currency,
      fx_rate_to_base: rate,
      base_amount_minor: Math.round(amountMinor * rate),
      memo: extra.memo ?? null,
      created_by:
        extra.by ??
        random.weighted([
          [accountant, 5],
          [staff, 3],
          [owner, 1],
        ] as const),
    });
  };
  for (const start of months) {
    const end = monthEnd(start);
    const days = Number(end.slice(8, 10));
    const factor = season(Number(start.slice(5, 7)));
    const dateIn = () => addDays(start, random.int(0, days - 1));
    const sales = Math.round(random.int(26, 36) * factor);
    for (let i = 0; i < sales; i++) {
      const lrd = random.chance(0.3);
      entry(
        "income",
        dateIn(),
        lrd ? "mobile" : random.chance(0.6) ? "cash" : "bank",
        lrd ? random.int(60, 700) * 10_000 : random.int(8, 90) * 1_000,
        {
          category: "Sales",
          counterparty: random.chance(0.4) ? random.pick(customers).id : undefined,
          memo: random.pick([
            "Shop sales",
            "Wholesale order",
            "Market day sales",
            "Delivery and sale",
          ]),
        },
      );
    }
    for (let i = 0; i < random.int(1, 3); i++) {
      entry("income", dateIn(), "bank", random.int(15, 60) * 1_000, {
        category: "Services",
        counterparty: random.pick(customers).id,
        memo: "Delivery service",
      });
    }
    entry("expense", addDays(start, random.int(0, 2)), "bank", 120_000, {
      category: "Rent",
      memo: "Shop and store rent",
      by: accountant,
    });
    entry("expense", addDays(start, random.int(8, 14)), "mobile", random.int(25, 45) * 100_000, {
      category: "Utilities",
      memo: "Electricity and water",
    });
    for (let i = 0; i < random.int(5, 9); i++) {
      const lrd = random.chance(0.5);
      entry(
        "expense",
        dateIn(),
        lrd ? "mobile" : "cash",
        lrd ? random.int(10, 60) * 10_000 : random.int(10, 60) * 100,
        {
          category: "Transport",
          memo: random.pick(["Fuel", "Taxi to market", "Truck hire", "Motorbike delivery"]),
        },
      );
    }
    for (let i = 0; i < random.int(2, 4); i++) {
      entry("expense", dateIn(), "cash", random.int(20, 150) * 100, {
        category: "Supplies",
        counterparty: random.chance(0.5) ? random.pick(vendors).id : undefined,
        memo: random.pick(["Packaging", "Cleaning materials", "Stationery"]),
      });
    }
    for (let i = 0; i < random.int(2, 4); i++) {
      entry("expense", dateIn(), "bank", Math.round(random.int(40, 150) * 1_000 * factor), {
        category: "Stock purchases",
        counterparty: random.pick(vendors).id,
        memo: "Stock for resale",
        by: accountant,
      });
    }
    if (random.chance(0.4)) {
      entry("expense", dateIn(), "mobile", random.int(5, 25) * 100_000, {
        category: "Marketing",
        memo: random.pick(["Radio advert", "Flyers", "Banner printing"]),
      });
    }
    entry("expense", end, "bank", random.int(5, 15) * 100, {
      category: "Bank charges",
      memo: "Monthly charges",
      by: accountant,
    });
    for (const week of [7, 14, 21, 28]) {
      entry(
        "transfer",
        addDays(start, Math.min(week, days - 1)),
        "cash",
        random.int(4, 9) * 10_000,
        {
          to: "bank",
          memo: "Cash deposited at the bank",
          by: accountant,
        },
      );
    }
  }
  await insert(ctx, "transactions", entries);

  // Two mistakes voided, so visitors see how a reversal looks.
  for (const e of entries.filter((x) => x.type === "expense" && x.created_by === staff).slice(-2)) {
    await tx.unsafe(`select ${s}.void_transaction($1, 'Entered twice')`, [String(e.id)]);
  }

  // Employees and pay components.
  const employees: Row[] = [];
  for (let i = 0; i < 12; i++) {
    const p = person(random);
    const lrd = i >= 8;
    employees.push({
      id: randomUUID(),
      first_name: p.firstName,
      last_name: p.lastName,
      employee_number: `EMP-${String(i + 1).padStart(3, "0")}`,
      position: random.pick(
        lrd
          ? ["Driver", "Store keeper", "Cleaner"]
          : ["Sales assistant", "Cashier", "Store supervisor", "Delivery lead"],
      ),
      department: lrd ? "Operations" : "Sales",
      start_date: addDays(monthStart(24), random.int(0, 180)),
      base_salary_minor: lrd ? random.int(45, 75) * 100_000 : random.int(30, 70) * 1_000,
      currency: lrd ? "LRD" : "USD",
      payment_method: lrd ? "mobile_money" : random.pick(["bank", "mobile_money"]),
      bank_or_wallet_ref: lrd
        ? `0886 ${random.int(100, 999)} ${random.int(100, 999)}`
        : `ACC-${random.int(100000, 999999)}`,
    });
  }
  // The supervisor's name is fixed so the demo reads naturally.
  Object.assign(employees[0] ?? {}, {
    first_name: "Korpo",
    last_name: "Wleh",
    position: "Store supervisor",
  });
  await insert(ctx, "employees", employees);
  const components = { transport: randomUUID(), housing: randomUUID(), pension: randomUUID() };
  await insert(ctx, "pay_components", [
    {
      id: components.transport,
      name: "Transport allowance",
      kind: "allowance",
      calc: "fixed",
      default_value: 5_000,
    },
    {
      id: components.housing,
      name: "Housing allowance",
      kind: "allowance",
      calc: "percent_of_base",
      default_value: 10,
    },
    {
      id: components.pension,
      name: "Pension (staff scheme)",
      kind: "deduction",
      calc: "percent_of_base",
      default_value: 3,
    },
  ]);
  await insert(
    ctx,
    "employee_components",
    employees.flatMap((e, i) => [
      // LRD salaries get the transport allowance in LRD.
      {
        employee_id: String(e.id),
        pay_component_id: components.transport,
        value: e.currency === "LRD" ? 500_000 : null,
      },
      { employee_id: String(e.id), pay_component_id: components.pension, value: null },
      ...(i < 2
        ? [{ employee_id: String(e.id), pay_component_id: components.housing, value: null }]
        : []),
    ]),
  );

  // Twelve monthly runs, approved and paid by the Owner at the end of each month.
  await asUser(ctx, owner, async () => {
    for (let back = 12; back >= 1; back--) {
      const start = monthStart(back);
      const [run] = await tx.unsafe<{ id: string }[]>(`select ${s}.prepare_payroll_run($1) as id`, [
        start,
      ]);
      await tx.unsafe(`select ${s}.approve_payroll_run($1)`, [run?.id ?? ""]);
      await tx.unsafe(`select ${s}.pay_payroll_run($1, $2, $3, $4::text::jsonb)`, [
        run?.id ?? "",
        monthEnd(start),
        cat("Salaries"),
        JSON.stringify({ USD: accounts.bank, LRD: accounts.mobile }),
      ]);
    }
  });

  // Thirty invoices over the last six months: paid, part paid, unpaid (some overdue), void.
  for (let i = 0; i < 30; i++) {
    const issued = addDays(today, -random.int(3, 180));
    const due = addDays(issued, 30);
    const customer = random.pick(customers);
    const [invoice] = await tx.unsafe<{ id: string }[]>(
      `insert into ${s}.invoices (party_type, party_id, currency, notes)
       values ('counterparty', $1, 'USD', 'Payment by bank transfer or mobile money.') returning id`,
      [customer.id],
    );
    const id = invoice?.id ?? "";
    let total = 0;
    for (const [item, unit] of random.shuffle(ITEMS).slice(0, random.int(1, 3))) {
      const quantity = random.int(1, 12);
      total += quantity * unit;
      await tx.unsafe(
        `insert into ${s}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor) values ($1, $2, $3, $4, $5)`,
        [id, item, quantity, unit, quantity * unit],
      );
    }
    await tx.unsafe(`select ${s}.issue_invoice($1)`, [id]);
    await tx.unsafe(`update ${s}.invoices set issue_date = $2, due_date = $3 where id = $1`, [
      id,
      issued,
      due,
    ]);
    const state = i < 15 ? "paid" : i < 22 ? "partial" : i < 28 ? "unpaid" : "void";
    if (state === "void") {
      await tx.unsafe(`select ${s}.void_invoice($1, 'Issued to the wrong customer')`, [id]);
      continue;
    }
    if (state === "unpaid") continue;
    const paidOn = addDays(issued, random.int(2, 25));
    const amount =
      state === "paid" ? total : Math.round((total * random.int(30, 70)) / 100 / 100) * 100;
    await tx.unsafe(`select * from ${s}.record_invoice_payment($1, $2, $3, $4, $5, $6, $7, $8)`, [
      randomUUID(),
      id,
      amount,
      random.pick(["bank", "mobile_money", "cash"]),
      accounts.bank,
      cat("Sales"),
      paidOn > today ? today : paidOn,
      random.chance(0.5) ? `TRX${random.int(100_000, 999_999)}` : null,
    ]);
  }
}
