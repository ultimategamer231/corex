import { describe, expect, it } from "vitest";
import { ageText, dayBounds, shiftDay, timeOf, zonedInstant } from "./clinic";

describe("clinic times", () => {
  it("reads wall-clock times in the organization's time zone", () => {
    expect(zonedInstant("2026-10-24", "09:30", "Africa/Monrovia").toISOString()).toBe(
      "2026-10-24T09:30:00.000Z",
    );
    expect(zonedInstant("2026-10-24", "09:30", "Africa/Lagos").toISOString()).toBe(
      "2026-10-24T08:30:00.000Z",
    );
    expect(timeOf("2026-10-24T08:30:00Z", "Africa/Lagos")).toBe("09:30");
  });

  it("gives a day's bounds and neighbours", () => {
    expect(dayBounds("2026-10-24", "Africa/Lagos")).toEqual({
      start: "2026-10-23T23:00:00.000Z",
      end: "2026-10-24T23:00:00.000Z",
    });
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("describes ages", () => {
    expect(ageText("1990-10-25", "2026-10-24")).toBe("35 years");
    expect(ageText("2026-03-10", "2026-10-24")).toBe("7 months");
    expect(ageText("2026-10-14", "2026-10-24")).toBe("10 days");
    expect(ageText(null, "2026-10-24")).toBeNull();
  });
});
