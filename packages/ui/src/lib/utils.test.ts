import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets later theme colors override earlier ones", () => {
    expect(cn("bg-primary text-ink", "bg-accent")).toBe("text-ink bg-accent");
  });

  it("does not drop a text color when a font size is added", () => {
    expect(cn("text-accent-foreground", "text-[15px]")).toBe("text-accent-foreground text-[15px]");
  });
});
