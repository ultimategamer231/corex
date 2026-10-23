import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { Input } from "./input";
import { Label } from "./label";

describe("Input and Label", () => {
  it("associates the label with the input", () => {
    render(
      <>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" />
      </>,
    );
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("uses the strong border token so the control meets 3:1 contrast", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox")).toHaveClass("border-border-strong");
  });

  it("exposes the invalid state to assistive technology", () => {
    render(<Input aria-label="Email" aria-invalid="true" />);
    expect(screen.getByRole("textbox")).toBeInvalid();
  });
});

describe("Badge", () => {
  it("renders the warning variant with token colors", () => {
    render(<Badge variant="warning">Sample data</Badge>);
    expect(screen.getByText("Sample data")).toHaveClass("bg-warning-subtle", "text-warning");
  });
});
