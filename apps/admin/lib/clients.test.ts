import { describe, expect, it } from "vitest";
import {
  clientStatus,
  createClientPayload,
  hostingCheck,
  inGroup,
  milestoneAmounts,
  newClientSchema,
  parseScheme,
  productFromLead,
  type StatusInput,
} from "./clients";

const live: StatusInput = {
  plan: "managed",
  environment: "live",
  warrantyEndsOn: null,
  nextRenewalOn: "2027-09-15",
  subscriptionPaused: false,
  subscriptionEnded: false,
};
const today = "2026-10-29";

describe("derived client status (SPEC-ADMIN.md 8.2)", () => {
  it("follows the deployment and the renewal date", () => {
    expect(clientStatus({ ...live, environment: "setup" }, today)).toBe("setting_up");
    expect(clientStatus({ ...live, environment: "staging" }, today)).toBe("setting_up");
    expect(clientStatus({ ...live, environment: null }, today)).toBe("setting_up");
    expect(clientStatus(live, today)).toBe("active");
    expect(clientStatus({ ...live, nextRenewalOn: "2026-11-28" }, today)).toBe("renewal_due");
    expect(clientStatus({ ...live, nextRenewalOn: "2026-11-29" }, today)).toBe("active");
    expect(clientStatus({ ...live, nextRenewalOn: "2026-10-29" }, today)).toBe("renewal_due");
    expect(clientStatus({ ...live, nextRenewalOn: "2026-10-17" }, today)).toBe("grace_period");
    expect(clientStatus({ ...live, environment: "paused" }, today)).toBe("paused");
    expect(clientStatus({ ...live, subscriptionPaused: true }, today)).toBe("paused");
    expect(clientStatus({ ...live, environment: "ended" }, today)).toBe("ended");
    expect(clientStatus({ ...live, subscriptionEnded: true }, today)).toBe("ended");
  });

  it("shows Handover clients in warranty until the warranty ends", () => {
    const handover = { ...live, plan: "handover", nextRenewalOn: null };
    expect(clientStatus({ ...handover, warrantyEndsOn: "2026-12-10" }, today)).toBe("in_warranty");
    expect(clientStatus({ ...handover, warrantyEndsOn: "2026-10-29" }, today)).toBe("in_warranty");
    expect(clientStatus({ ...handover, warrantyEndsOn: "2026-10-28" }, today)).toBe("active");
  });

  it("groups statuses into the list's tabs", () => {
    expect(inGroup("in_warranty", "active")).toBe(true);
    expect(inGroup("grace_period", "due")).toBe(true);
    expect(inGroup("renewal_due", "active")).toBe(false);
    expect(inGroup("ended", "all")).toBe(true);
  });
});

describe("payment milestones (SPEC-ADMIN.md 9.1)", () => {
  it("match the database rule and always add up to the total", () => {
    expect(milestoneAmounts(250000n, [50, 30, 20])).toEqual([125000n, 75000n, 50000n]);
    expect(milestoneAmounts(100001n, [50, 30, 20])).toEqual([50001n, 30000n, 20000n]);
    expect(milestoneAmounts(99999n, [33, 33, 34])).toEqual([33000n, 33000n, 33999n]);
    for (const total of [1n, 7n, 99999n, 123457n]) {
      const parts = milestoneAmounts(total, [40, 35, 25]);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
    }
  });

  it("accept only whole percentages that add up to 100", () => {
    expect(parseScheme("50/30/20")).toEqual([50, 30, 20]);
    expect(parseScheme("40% 60%")).toEqual([40, 60]);
    expect(parseScheme("100")).toEqual([100]);
    for (const bad of ["50/30", "50/50/10", "50.5/49.5", "0/100", "", "a/b"]) {
      expect(parseScheme(bad)).toBeNull();
    }
  });
});

describe("hosting-cost check", () => {
  it("warns below the minimum multiple and never compares across currencies", () => {
    const usd = (n: bigint) => ({ amountMinor: n, currency: "USD" });
    const hosting = { monthlyMinor: 1000n, currency: "USD" };
    expect(hostingCheck(usd(60000n), hosting, 3)).toEqual({ kind: "ok", multiple: 5, minimum: 3 });
    expect(hostingCheck(usd(30000n), hosting, 3)).toEqual({
      kind: "low",
      multiple: 2.5,
      minimum: 3,
    });
    expect(hostingCheck(usd(36000n), hosting, 3)).toMatchObject({ kind: "ok" });
    expect(hostingCheck({ amountMinor: 9000000n, currency: "LRD" }, hosting, 3)).toEqual({
      kind: "cannot_compare",
    });
    expect(hostingCheck(usd(60000n), null, 3)).toEqual({ kind: "none" });
  });
});

describe("new client form (LEAD-06)", () => {
  const form = {
    name: "Hope Medical Center",
    contactName: "Comfort Pewee",
    contactPhone: "+231 88 555 0202",
    product: "clinic",
    plan: "managed",
    currency: "USD",
    total: "2,500",
    signedOn: "2026-09-16",
    scheme: "50/30/20",
    renewal: "600",
    hostingCost: "10",
    hostingCurrency: "USD",
  };

  it("turns amounts into minor units and builds the database payload", () => {
    const data = newClientSchema.parse(form);
    expect(createClientPayload(data)).toMatchObject({
      total_minor: 250000,
      renewal_minor: 60000,
      hosting_cost_minor: 1000,
      milestone_scheme: [50, 30, 20],
      product: "clinic",
      plan: "managed",
    });
  });

  it("needs a renewal for Managed, a contact phone or email, and a valid split", () => {
    const result = newClientSchema.safeParse({
      ...form,
      renewal: "",
      contactPhone: "",
      scheme: "50/40",
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["renewal", "contactPhone", "scheme"]));
    const handover = newClientSchema.parse({ ...form, plan: "handover", renewal: "" });
    expect(createClientPayload(handover).renewal_minor).toBeNull();
  });

  it("maps a lead's interest to a contract product", () => {
    expect(productFromLead("school-highschool")).toBe("school_highschool");
    expect(productFromLead("website")).toBe("custom");
    expect(productFromLead(null)).toBe("custom");
  });
});
