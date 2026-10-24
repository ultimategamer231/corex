import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a native button by default and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses dark text on the orange accent variant", () => {
    render(<Button variant="accent">Try a live demo</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-accent", "text-accent-foreground");
    expect(button).not.toHaveClass("text-white");
  });

  it("keeps a 44px minimum touch target in every size", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="icon" aria-label="Icon" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Medium" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Icon" })).toHaveClass("size-11");
  });

  it("renders a link with button styles when asChild is set", () => {
    render(
      <Button asChild variant="outline">
        <a href="/contact">Request a quote</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Request a quote" });
    expect(link).toHaveAttribute("href", "/contact");
    expect(link).toHaveClass("border-primary");
  });

  it("does not submit forms unless type is submit", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Add row</Button>
        <Button type="submit">Save</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not fire clicks when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
