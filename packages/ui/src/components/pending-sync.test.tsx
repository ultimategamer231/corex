import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PendingSync } from "./pending-sync";

describe("PendingSync", () => {
  it("shows waiting records with their state and nothing when empty", () => {
    const { rerender, container } = render(
      <PendingSync
        label="Waiting to sync"
        records={[
          { id: "1", title: "Musu Kollie" },
          { id: "2", title: "Vitals for Saye Toe", error: "Your access was suspended" },
        ]}
        onRetry={() => undefined}
        onDiscard={() => undefined}
      />,
    );
    expect(screen.getByRole("region", { name: "Waiting to sync" })).toBeInTheDocument();
    expect(screen.getByText("Pending sync")).toBeInTheDocument();
    expect(screen.getByText("Not synced")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your access was suspended");
    rerender(
      <PendingSync
        label="Waiting"
        records={[]}
        onRetry={() => undefined}
        onDiscard={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("asks before discarding a record", async () => {
    const onDiscard = vi.fn();
    render(
      <PendingSync
        label="Waiting to sync"
        records={[{ id: "1", title: "Musu Kollie" }]}
        onRetry={() => undefined}
        onDiscard={onDiscard}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledWith("1");
  });
});
