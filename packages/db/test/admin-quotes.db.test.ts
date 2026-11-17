// Quote lines and numbers, and demo visits (audit round A1, F3).
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, asServiceRole, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("quotes");
const users: string[] = [];
let admin: TestAdmin;
let outsider: string;
let leadId = "";

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

type Quote = { quote_amount_minor: string; quote_number: string | null };

const setQuote = (lines: unknown, currency = "USD") =>
  asAdmin((tx) =>
    tx.unsafe<Quote[]>(
      `update ${schema}.leads set quote_lines = $2::jsonb, quote_currency = $3,
         quote_amount_minor = coalesce(quote_amount_minor, 1)
       where id = $1 returning quote_amount_minor, quote_number`,
      [leadId, lines as never, currency],
    ),
  );

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "quotes", users);
  outsider = await createTestUser(keys, testEmail("quotes-outsider"), "Outsider-Test-2026!");
  users.push(outsider);
  const [row] = await asServiceRole(sql, (tx) =>
    tx.unsafe<{ id: string }[]>(
      `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
       values ('Musu Kollie', 'Greenfield Academy', 'Liberia', 'school-highschool', '+231 77 555 0101', 'Report cards please.', true)
       returning id`,
    ),
  );
  leadId = row?.id ?? "";
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("quotes", () => {
  it("totals the lines, numbers the quote once and keeps the number", async () => {
    const [first] = await setQuote([
      { description: "School Management: High School", quantity: 1, unit_amount_minor: 180000 },
      { description: "Staff training day", quantity: 2, unit_amount_minor: 15000 },
    ]);
    expect(Number(first?.quote_amount_minor)).toBe(210000);
    expect(first?.quote_number).toMatch(/^QT-\d{2}-\d{2}-001$/);
    const [second] = await setQuote([
      { description: "School Management: High School", quantity: 1, unit_amount_minor: 180000 },
    ]);
    expect(Number(second?.quote_amount_minor)).toBe(180000);
    expect(second?.quote_number).toBe(first?.quote_number);
    // The number cannot be changed by hand.
    const [kept] = await asAdmin((tx) =>
      tx.unsafe<Quote[]>(
        `update ${schema}.leads set quote_number = 'QT-FAKE' where id = $1 returning quote_number`,
        [leadId],
      ),
    );
    expect(kept?.quote_number).toBe(first?.quote_number);
  });

  it("refuses lines without a description, with a part quantity, or a zero total", async () => {
    await expect(
      setQuote([{ description: "", quantity: 1, unit_amount_minor: 100 }]),
    ).rejects.toThrow(/description/);
    await expect(
      setQuote([{ description: "Setup", quantity: 1.5, unit_amount_minor: 100 }]),
    ).rejects.toThrow(/whole quantity/);
    await expect(
      setQuote([{ description: "Free visit", quantity: 1, unit_amount_minor: 0 }]),
    ).rejects.toThrow(/above zero/);
    await expect(setQuote([])).rejects.toThrow(/above zero|check constraint/);
  });
});

describe("demo visits", () => {
  it("counts sign-ins per day, demo and role, written only by the server", async () => {
    for (const role of ["registrar", "registrar", "bursar"]) {
      await asServiceRole(sql, (tx) =>
        tx.unsafe(`select ${schema}.record_demo_visit('college', $1)`, [role]),
      );
    }
    const rows = await asAdmin((tx) =>
      tx.unsafe<{ role: string; sign_ins: number }[]>(
        `select role, sign_ins from ${schema}.demo_visits order by role`,
      ),
    );
    expect(rows).toEqual([
      { role: "bursar", sign_ins: 1 },
      { role: "registrar", sign_ins: 2 },
    ]);
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.record_demo_visit('college', 'admin')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asServiceRole(sql, (tx) =>
        tx.unsafe(`select ${schema}.record_demo_visit('elsewhere', 'admin')`),
      ),
    ).rejects.toThrow(/check constraint/);
    expect(
      await asUser(sql, outsider, (tx) => tx.unsafe(`select * from ${schema}.demo_visits`)),
    ).toHaveLength(0);
  });
});
