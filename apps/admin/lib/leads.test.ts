import { describe, expect, it } from "vitest";
import { formatDay, relativeDay } from "./format";
import {
  leadStatusSchema,
  leadsQuery,
  manualLeadSchema,
  parseLeadFilters,
  phoneKey,
  quoteSchema,
  whatsappLink,
} from "./leads";
import { leadsCsv, type LeadRow } from "./leads-data";

const leadId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("LEAD-02: leads added by hand", () => {
  it("need a name, an organization and a phone or email", () => {
    const base = { name: "Ibrahim Konneh", organization: "Mano River Logistics" };
    const none = manualLeadSchema.safeParse(base);
    expect(none.success).toBe(false);
    expect(none.error?.issues[0]?.path).toEqual(["phone"]);
    expect(manualLeadSchema.safeParse({ ...base, email: "ik@example.com" }).success).toBe(true);
    expect(manualLeadSchema.safeParse({ ...base, phone: "+231 770 000 000" }).success).toBe(true);
    expect(
      manualLeadSchema.safeParse({ ...base, organization: " ", phone: "0770000000" }).success,
    ).toBe(false);
    expect(manualLeadSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
  });

  it("turn empty optional fields into nothing", () => {
    const parsed = manualLeadSchema.parse({
      name: " Grace Flomo ",
      organization: "Unity Pharmacy",
      phone: "0886 111 222",
      email: "",
      country: "",
      product: "",
      plan: "bogus",
      message: "  ",
    });
    expect(parsed).toEqual({
      name: "Grace Flomo",
      organization: "Unity Pharmacy",
      phone: "0886 111 222",
      email: null,
      country: null,
      product: null,
      plan: "unsure",
      message: null,
    });
  });
});

describe("LEAD-04: status", () => {
  it("Lost needs a reason", () => {
    const lost = leadStatusSchema.safeParse({ leadId, stage: "lost", lostReason: "" });
    expect(lost.success).toBe(false);
    expect(lost.error?.issues[0]?.path).toEqual(["lostReason"]);
    expect(
      leadStatusSchema.safeParse({ leadId, stage: "lost", lostReason: "Chose another supplier" })
        .success,
    ).toBe(true);
    const contacted = leadStatusSchema.parse({
      leadId,
      stage: "contacted",
      assigned: "",
      followUp: "",
    });
    expect(contacted).toMatchObject({ assigned: null, followUp: null, lostReason: null });
  });
});

describe("quotes", () => {
  it("are kept as minor units and must be above zero", () => {
    expect(quoteSchema.parse({ leadId, currency: "USD", amount: "4,000" }).amountMinor).toBe(
      400000n,
    );
    expect(quoteSchema.parse({ leadId, currency: "LRD", amount: "12500.5" }).amountMinor).toBe(
      1250050n,
    );
    for (const amount of ["0", "-5", "12.345", "abc"]) {
      expect(quoteSchema.safeParse({ leadId, currency: "USD", amount }).success).toBe(false);
    }
  });
});

describe("LEAD-03: phone matching", () => {
  it("uses the last 8 digits, so local and international formats match", () => {
    expect(phoneKey("+231 77 123 4567")).toBe(phoneKey("0771234567"));
    expect(phoneKey("12-34")).toBeNull();
  });
});

describe("WhatsApp links", () => {
  it("use the country's calling code for local numbers and never guess", () => {
    expect(whatsappLink("+231 77 123 4567", null)).toBe("https://wa.me/231771234567");
    expect(whatsappLink("0771234567", "Liberia")).toBe("https://wa.me/231771234567");
    expect(whatsappLink("076 123 456", "Sierra Leone")).toBe("https://wa.me/23276123456");
    expect(whatsappLink("0771234567", "Mars")).toBeNull();
    expect(whatsappLink(null, "Liberia")).toBeNull();
  });
});

describe("LEAD-07: filters and export", () => {
  it("ignore unknown filter values and keep the rest in links", () => {
    const filters = parseLeadFilters({ q: "kollie", stage: "maybe", product: "clinic", page: "2" });
    expect(filters).toEqual({ q: "kollie", product: "clinic", page: 2 });
    expect(leadsQuery(filters, { page: undefined })).toBe("?q=kollie&product=clinic");
  });

  it("writes one row per lead and neutralizes spreadsheet formulas", () => {
    const lead = {
      created_at: "2026-10-12T14:06:00Z",
      name: '=HYPERLINK("x")',
      organization: "St. Peter's College",
      country: "Liberia",
      product: "school-college",
      plan_interest: "handover",
      phone: "+231 77 123 4567",
      email: null,
      stage: "quoted",
      assigned_admin_id: "a1",
      follow_up_on: "2026-11-04",
      next_step: null,
      quote_amount_minor: 400000,
      quote_currency: "USD",
      quote_sent_on: "2026-10-27",
      lost_reason: null,
      source: "website",
      message: "We have about 900 students, across 4 programs.",
    } as unknown as LeadRow;
    const csv = leadsCsv([lead], new Map([["a1", "Maima Gbessay"]]));
    const [header, row] = csv.trim().split("\r\n");
    expect(header?.startsWith("Received (GMT),Name,Organization")).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain("'+231 77 123 4567");
    expect(row).toContain("Maima Gbessay");
    expect(row).toContain("US$4,000.00");
    expect(row).toContain('"We have about 900 students, across 4 programs."');
  });
});

describe("dates", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  it("show today, tomorrow and other days in Monrovia time", () => {
    expect(relativeDay("2026-10-29", now)).toBe("Today");
    expect(relativeDay("2026-10-30", now)).toBe("Tomorrow");
    expect(relativeDay("2026-10-28T23:30:00Z", now)).toBe("Yesterday");
    expect(relativeDay("2026-11-03", now)).toBe("3 Nov");
    expect(formatDay("2025-07-18", now)).toBe("18 Jul 2025");
  });
});
