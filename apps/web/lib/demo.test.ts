import { DEMOS } from "@corex/core/demo";
import { describe, expect, it } from "vitest";
import { products } from "@/content/products";
import { demoLoginUrl } from "./demo";

describe("demo links", () => {
  const [college, highSchool] = products.school.demos;

  it("offer exactly the roles the demo login pages know (SPEC.md 11.2)", () => {
    expect(college?.roles.map((r) => r.slug)).toEqual(DEMOS.college.accounts.map((a) => a.slug));
    expect(highSchool?.roles.map((r) => r.slug)).toEqual(
      DEMOS.highschool.accounts.map((a) => a.slug),
    );
  });

  it("include the Clinic demo roles", () => {
    expect(products.clinic.demos[0]?.roles.map((r) => r.slug)).toEqual(
      DEMOS.clinic.accounts.map((a) => a.slug),
    );
  });

  it("include the Finance demo roles", () => {
    expect(products.finance.demos[0]?.roles.map((r) => r.slug)).toEqual(
      DEMOS.finance.accounts.map((a) => a.slug),
    );
  });

  it("open the demo subdomain with the role preselected", () => {
    if (!college?.roles[1]) throw new Error("missing demo");
    expect(demoLoginUrl(college, college.roles[1], { NEXT_PUBLIC_ROOT_DOMAIN: "corex.lr" })).toBe(
      "https://demo-college.corex.lr/login?role=registrar",
    );
  });

  it("follow the host pattern while demos run without the domain", () => {
    if (!college?.roles[0]) throw new Error("missing demo");
    const env = {
      NEXT_PUBLIC_ROOT_DOMAIN: "corex.lr",
      NEXT_PUBLIC_DEMO_HOST_PATTERN: "corex-{subdomain}.vercel.app",
    };
    expect(demoLoginUrl(college, college.roles[0], env)).toBe(
      `https://corex-demo-college.vercel.app/login?role=${college.roles[0].slug}`,
    );
  });
});
