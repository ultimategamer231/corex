import { describe, expect, it } from "vitest";
import { secretMatches } from "./daily-job";
import {
  chartSummary,
  mainAndRest,
  monthBars,
  perCurrency,
  reminderChips,
  renewalTiming,
  ruleOn,
  unreadCount,
  winRate,
} from "./dashboard";
import { priceItemSchema, priceOptions, renewalsConfig, renewalsSchema } from "./price-list";

describe("dashboard figures on screen (SPEC-ADMIN.md 7)", () => {
  it("never adds USD and LRD; USD first", () => {
    expect(perCurrency({ LRD: "4500000", USD: "175000" })).toBe("US$1,750.00 · L$45,000.00");
    expect(perCurrency({ USD: "0" })).toBe("—");
    expect(mainAndRest({ USD: "641000", LRD: "4500000" })).toEqual({
      main: "US$6,410.00",
      rest: "plus L$45,000.00",
    });
    expect(mainAndRest({ LRD: "100" })).toEqual({ main: "L$1.00", rest: null });
    expect(mainAndRest({})).toEqual({ main: "US$0.00", rest: null });
  });

  it("states the win rate this year", () => {
    expect(winRate(1, 1)).toBe("Win rate this year: 1 of 2 closed leads (50%)");
    expect(winRate(0, 0)).toBe("Win rate this year: no leads closed yet");
  });

  it("draws months up to this one, scaled to the best month, with a text summary", () => {
    const bars = monthBars(["0", "120000", "60000", "0"], 2);
    expect(bars.map((b) => [b.month, b.percent, b.current])).toEqual([
      ["Jan", 0, false],
      ["Feb", 100, false],
      ["Mar", 50, true],
    ]);
    expect(chartSummary(bars, "USD", 2026)).toBe(
      "US$1,800.00 collected in 2026. Highest month: Feb, US$1,200.00.",
    );
    expect(chartSummary(monthBars(undefined, 0), "USD", 2026)).toBe(
      "No USD payments collected in 2026 yet.",
    );
  });
});

describe("notifications (SPEC-ADMIN.md 11)", () => {
  const item = (since: string | null) => ({
    kind: "overdue" as const,
    title: "t",
    detail: "d",
    href: "/",
    since,
  });

  it("counts items that started after the bell was last opened", () => {
    const items = [item("2026-10-30T00:00:00Z"), item("2026-10-31T09:00:00Z"), item(null)];
    expect(unreadCount(items, null)).toBe(3);
    expect(unreadCount(items, "2026-10-31T08:00:00Z")).toBe(2);
    expect(unreadCount(items, "2026-10-31T10:00:00Z")).toBe(1);
  });
});

describe("subscriptions (SPEC-ADMIN.md 10)", () => {
  const day = (d: string) => d.slice(5);

  it("describes the time to or past the renewal date", () => {
    expect(renewalTiming(22, "due_soon", "2026-12-20", day)).toBe("In 22 days");
    expect(renewalTiming(1, "due_soon", null, day)).toBe("In 1 day");
    expect(renewalTiming(0, "due_soon", null, day)).toBe("Due today");
    expect(renewalTiming(-12, "grace", "2026-11-16", day)).toBe(
      "12 days overdue · pause flag on 11-16",
    );
    expect(renewalTiming(-31, "pause_flag", "2026-10-30", day)).toBe(
      "31 days overdue · pause flag",
    );
    expect(renewalTiming(null, "starts_at_go_live", null, day)).toBe("Starts at go-live");
  });

  it("shows the invoice and both reminders, including those not emailed", () => {
    expect(
      reminderChips({
        invoice_status: "issued",
        reminder_14d: "skipped_disabled",
        reminder_3d: null,
      }),
    ).toEqual([
      { label: "30d invoice sent", state: "done" },
      { label: "14d not emailed", state: "skipped" },
      { label: "3d", state: "todo" },
    ]);
    expect(
      reminderChips({ invoice_status: "draft", reminder_14d: null, reminder_3d: null })[0],
    ).toEqual({ label: "30d", state: "todo" });
  });

  it("treats every job rule as on unless switched off", () => {
    expect(ruleOn({}, "reminders")).toBe(true);
    expect(ruleOn({ job_reminders: "false" }, "reminders")).toBe(false);
    expect(ruleOn({ job_reminders: false }, "reminders")).toBe(false);
  });
});

describe("Settings → Price list and Renewals", () => {
  const form = (values: Record<string, string>) => ({
    id: "",
    name: "Clinic Management",
    kind: "product",
    currency: "USD",
    managed: "",
    renewal: "",
    handover: "",
    unitLabel: "",
    ...values,
  });

  it("reads prices in major units and needs at least one", () => {
    const ok = priceItemSchema.safeParse(
      form({ managed: "2500", renewal: "600.50", active: "on" }),
    );
    expect(ok.success && ok.data).toMatchObject({
      managed: 250000,
      renewal: 60050,
      handover: null,
      active: true,
    });
    const none = priceItemSchema.safeParse(form({}));
    expect(none.success).toBe(false);
    const bad = priceItemSchema.safeParse(form({ managed: "-5" }));
    expect(bad.success).toBe(false);
  });

  it("offers each price of an active item as an invoice line", () => {
    const options = priceOptions([
      {
        id: "a",
        name: "On-site training",
        kind: "addon",
        currency: "USD",
        managed_year1_minor: 10000,
        renewal_minor: null,
        handover_minor: 10000,
        unit_label: "per day",
        active: true,
      },
      {
        id: "b",
        name: "Old item",
        kind: "addon",
        currency: "USD",
        managed_year1_minor: 1,
        renewal_minor: null,
        handover_minor: null,
        unit_label: null,
        active: false,
      },
    ]);
    expect(options.map((o) => o.label)).toEqual([
      "On-site training, Managed: year 1 · US$100.00 per day",
      "On-site training, Handover · US$100.00 per day",
    ]);
    expect(options[0]).toMatchObject({ description: "On-site training", unitMinor: 10000 });
  });

  it("stores the job rules and the hosting multiple", () => {
    const parsed = renewalsSchema.parse({ renewal_invoice: "on", reminders: "on", multiple: "4" });
    expect(renewalsConfig(parsed)).toEqual({
      job_renewal_invoice: "true",
      job_reminders: "true",
      job_pause_flag: "false",
      job_warranty_flag: "false",
      renewal_min_hosting_multiple: 4,
    });
  });
});

describe("daily job secret (SPEC-ADMIN.md 10)", () => {
  const secret = "a".repeat(40);
  it("accepts only the exact secret, and never a short or missing one", () => {
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(`${secret}x`, secret)).toBe(false);
    expect(secretMatches("b".repeat(40), secret)).toBe(false);
    expect(secretMatches(null, secret)).toBe(false);
    expect(secretMatches("short", "short")).toBe(false);
    expect(secretMatches(secret, undefined)).toBe(false);
  });
});
