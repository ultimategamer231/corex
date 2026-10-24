import { DEMOS } from "@corex/core/demo";
import { describe, expect, it } from "vitest";
import { products } from "@/content/products";
import { demoLoginUrl } from "./demo";

describe("School demo links", () => {
  const [college, highSchool] = products.school.demos;

  it("offer exactly the roles the demo login pages know (SPEC.md 11.2)", () => {
    expect(college?.roles.map((r) => r.slug)).toEqual(DEMOS.college.accounts.map((a) => a.slug));
    expect(highSchool?.roles.map((r) => r.slug)).toEqual(
      DEMOS.highschool.accounts.map((a) => a.slug),
    );
  });

  it("open the demo subdomain with the role preselected", () => {
    if (!college?.roles[1]) throw new Error("missing demo");
    expect(demoLoginUrl(college, college.roles[1], { NEXT_PUBLIC_ROOT_DOMAIN: "corex.lr" })).toBe(
      "https://demo-college.corex.lr/login?role=registrar",
    );
  });
});
