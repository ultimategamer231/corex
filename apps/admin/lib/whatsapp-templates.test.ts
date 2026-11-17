import { describe, expect, it } from "vitest";
import { demoUrl, leadTemplates, withText } from "./whatsapp-templates";

const lead = {
  name: "Musu Kollie",
  organization: "Greenfield Academy",
  product: "school-highschool",
  quoteText: "US$1,800.00",
  quoteNumber: "QT-26-11-001",
  quoteValidUntil: "17 December 2026",
};

describe("WhatsApp templates", () => {
  it("greets by first name and fills in the product, demo and quote", () => {
    const t = leadTemplates(lead, "Fatu Admin");
    expect(t.map((x) => x.key)).toEqual(["reply", "demo", "quote", "follow_up"]);
    expect(t[0]?.text).toMatch(
      /^Hello Musu, thank you for your request about School: High School for Greenfield Academy\. I am Fatu/,
    );
    expect(t[1]?.text).toContain("https://demo-school.corexlr.com");
    expect(t[2]?.text).toContain(
      "quote QT-26-11-001 for Greenfield Academy: US$1,800.00, valid until 17 December 2026",
    );
    expect(t[2]?.text).toContain("70% when you approve the mock-up and design");
  });

  it("leaves out the demo and quote messages when there is none", () => {
    const t = leadTemplates({ ...lead, product: "website", quoteText: "" }, "Fatu");
    expect(t.map((x) => x.key)).toEqual(["reply", "follow_up"]);
    expect(demoUrl("training")).toBeNull();
  });

  it("puts the message in the link", () => {
    expect(withText("https://wa.me/231770000001", "Hello & welcome")).toBe(
      "https://wa.me/231770000001?text=Hello%20%26%20welcome",
    );
  });
});
