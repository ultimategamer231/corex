import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

describe("EmptyState", () => {
  it("is a labelled region with a heading and optional action", () => {
    render(
      <EmptyState
        icon={<svg />}
        title="No students yet"
        description="Add your first student to get started."
        action={<button type="button">Add student</button>}
      />,
    );
    expect(screen.getByRole("region", { name: "No students yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "No students yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add student" })).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders one h1 with description and actions", () => {
    render(
      <PageHeader
        title="Students"
        description="All enrolled students"
        actions={<a href="/x">New</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Students" })).toBeInTheDocument();
    expect(screen.getByText("All enrolled students")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New" })).toBeInTheDocument();
  });
});
