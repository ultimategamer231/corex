import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, type AppShellProps } from "./app-shell";

const pathname = vi.hoisted(() => ({ current: "/students" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const nav: AppShellProps["nav"] = [
  { href: "/", label: "Dashboard", icon: <svg />, exact: true, primary: true },
  { href: "/students", label: "Students", icon: <svg />, primary: true },
  { href: "/grades", label: "Grades", icon: <svg />, primary: true },
  { href: "/fees", label: "Fees", icon: <svg />, primary: true },
  { href: "/reports", label: "Reports", icon: <svg /> },
  { href: "/settings", label: "Settings", icon: <svg /> },
];

function renderShell(props: Partial<AppShellProps> = {}) {
  return render(
    <AppShell
      org={{ name: "Sample College" }}
      nav={nav}
      user={{ displayName: "Jartu Kollie", roleLabel: "Registrar" }}
      {...props}
    >
      <h1>Students</h1>
    </AppShell>,
  );
}

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
}

beforeEach(() => {
  pathname.current = "/students";
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("shows the organization name passed in from settings (CORE-01)", () => {
    renderShell({ org: { name: "Bethel High School" } });
    expect(screen.getByText("Bethel High School")).toBeInTheDocument();
  });

  it("starts with a skip link that targets the main landmark", async () => {
    renderShell();
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("marks the current section in the navigation", () => {
    pathname.current = "/students/42";
    renderShell();
    const current = screen
      .getAllByRole("link", { name: "Students" })
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", { name: "Dashboard" })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("collapses the sidebar but keeps link names for screen readers", async () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(window.localStorage.getItem("corex.sidebar.collapsed")).toBe("1");
    expect(screen.getAllByRole("link", { name: "Reports" }).length).toBeGreaterThan(0);
  });

  it("shows online and offline status with the pending-sync count", () => {
    renderShell({ pendingSyncCount: 3 });
    const status = screen.getAllByRole("status")[0];
    if (!status) throw new Error("status region missing");
    setOnline(true);
    expect(within(status).getByText("Online")).toBeInTheDocument();
    expect(within(status).getByText("3 changes waiting")).toBeInTheDocument();
    setOnline(false);
    expect(within(status).getByText("Offline")).toBeInTheDocument();
  });

  it("uses singular wording for one pending change and hides the count at zero", () => {
    const { rerender } = renderShell({ pendingSyncCount: 1 });
    expect(screen.getByText("1 change waiting")).toBeInTheDocument();
    rerender(
      <AppShell
        org={{ name: "Sample College" }}
        nav={nav}
        user={{ displayName: "Jartu Kollie", roleLabel: "Registrar" }}
        pendingSyncCount={0}
      >
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it("puts extra sections under More in the mobile bar", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const dialog = await screen.findByRole("dialog", { name: "More" });
    expect(within(dialog).getByRole("link", { name: "Reports" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Students" })).not.toBeInTheDocument();
  });

  it("signs out from the keyboard-accessible user menu", async () => {
    const onSignOut = vi.fn();
    renderShell({ onSignOut });
    const trigger = screen.getByRole("button", { name: /^Account menu for Jartu Kollie/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    await userEvent.click(item);
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("hides sign out when no handler is given", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: /^Account menu for Jartu Kollie/ }));
    await screen.findByRole("menu");
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
