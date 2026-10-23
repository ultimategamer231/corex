import { describe, expect, it } from "vitest";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "./contact";

describe("whatsappLink", () => {
  it("uses the primary number by default", () => {
    expect(whatsappLink()).toBe("https://wa.me/231770021026");
  });

  it("encodes the prefilled message", () => {
    expect(whatsappLink("Hello Corex, I'd like a quote for School Management.")).toBe(
      "https://wa.me/231770021026?text=Hello%20Corex%2C%20I'd%20like%20a%20quote%20for%20School%20Management.",
    );
  });
});

describe("phone helpers", () => {
  it("formats Liberian numbers", () => {
    expect(formatPhone("231770021026")).toBe("+231 770 021 026");
    expect(formatPhone("15551234567")).toBe("+15551234567");
  });

  it("builds tel links", () => {
    expect(telLink("231775178905")).toBe("tel:+231775178905");
  });

  it("lists the primary WhatsApp number first", () => {
    expect(site.phones[0]).toBe(site.whatsapp.primary);
  });
});
