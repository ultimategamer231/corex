import { cn } from "@corex/ui/lib/utils";
import type { PreviewKind } from "@/content/products";

// Illustrated dashboard of each product with sample data (mockup AppPreview).
// Decorative for screen readers except the caption.

type Tone = "teal" | "orange" | "gray";
const toneClass: Record<Tone, string> = {
  teal: "bg-tint text-primary-dark",
  orange: "bg-warning-subtle text-warning",
  gray: "bg-surface-muted text-ink-soft",
};

const data: Record<
  PreviewKind,
  {
    org: string;
    page: string;
    period: string;
    nav: string[];
    kpis: [string, string][];
    chartTitle: string;
    legend: [string, string?];
    bars: [number, number?][];
    rowsTitle: string;
    rows: [string, string, Tone][];
  }
> = {
  school: {
    org: "Sample College",
    page: "Dashboard",
    period: "Semester 1, 2026/2027",
    nav: ["Dashboard", "Students", "Courses", "Grades", "Fees", "Reports"],
    kpis: [
      ["Students", "1,248"],
      ["Attendance today", "92%"],
      ["Fees collected", "US$48,210"],
    ],
    chartTitle: "Fees collected by month",
    legend: ["USD"],
    bars: [[38], [52], [61], [47], [70], [83], [66], [74]],
    rowsTitle: "Waiting for your approval",
    rows: [
      ["BIO 201 · Section A grades", "Submitted", "orange"],
      ["Course plan · Jartu Kollie", "Submitted", "orange"],
      ["MTH 110 · Section B grades", "Approved", "teal"],
    ],
  },
  clinic: {
    org: "Sample Medical Center",
    page: "Today",
    period: "Thursday",
    nav: ["Today", "Patients", "Appointments", "Queue", "Billing", "Reports"],
    kpis: [
      ["Patients seen", "38"],
      ["Appointments", "24"],
      ["Revenue today", "US$1,140"],
    ],
    chartTitle: "Visits this week",
    legend: ["Visits"],
    bars: [[55], [72], [64], [80], [68], [40], [28]],
    rowsTitle: "Walk-in queue",
    rows: [
      ["Musu Johnson", "With nurse", "teal"],
      ["Emmanuel Toe", "Waiting", "orange"],
      ["Fatu Kamara", "With doctor", "gray"],
    ],
  },
  finance: {
    org: "Sample Trading Ltd",
    page: "Overview",
    period: "October 2026",
    nav: ["Overview", "Transactions", "Invoices", "Accounts", "Payroll", "Reports"],
    kpis: [
      ["Income", "US$18,420"],
      ["Expenses", "US$11,965"],
      ["Cash position", "US$32,780"],
    ],
    chartTitle: "Income and expenses by month",
    legend: ["Income", "Expenses"],
    bars: [
      [62, 48],
      [70, 51],
      [58, 55],
      [76, 49],
      [81, 60],
      [74, 57],
    ],
    rowsTitle: "Overdue invoices",
    rows: [
      ["INV-0142 · Kpelle Traders", "14 days", "orange"],
      ["INV-0139 · Bong Supplies", "21 days", "orange"],
      ["INV-0131 · Harper Hardware", "Part paid", "gray"],
    ],
  },
};

export function AppPreview({
  kind,
  size = "full",
  className,
}: {
  kind: PreviewKind;
  size?: "full" | "compact";
  className?: string;
}) {
  const d = data[kind];
  const full = size === "full";
  return (
    <figure
      className={cn(
        "@container overflow-hidden rounded-xl border border-border bg-background shadow-preview",
        className,
      )}
    >
      <figcaption className="sr-only">
        Preview of the {d.org} {d.page.toLowerCase()} screen, with sample data
      </figcaption>
      <div aria-hidden="true">
        <div className="flex h-11 items-center justify-between gap-3 border-b border-border-subtle px-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-white">
              {d.org.charAt(0)}
            </span>
            <span className="truncate text-[13px] font-bold">{d.org}</span>
          </div>
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-warning">
            Sample data
          </span>
        </div>
        <div className="flex">
          {full ? (
            <div className="hidden w-[148px] shrink-0 flex-col gap-0.5 bg-primary-dark px-2 py-3 @[480px]:flex">
              {d.nav.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    "rounded-[7px] px-2.5 py-2 text-[12.5px] font-semibold",
                    i === 0 ? "bg-primary text-white" : "text-on-dark-muted",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3 bg-surface p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-display text-[15px] font-bold">{d.page}</div>
              <div className="text-[11.5px] whitespace-nowrap text-muted">{d.period}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {d.kpis.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-0.5 rounded-[9px] border border-border-subtle bg-background px-2.5 py-2"
                >
                  <div className="truncate text-[11px] font-medium text-muted">{label}</div>
                  <div
                    className={cn(
                      "truncate font-display font-bold",
                      full ? "text-base" : "text-[13px]",
                    )}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-[9px] border border-border-subtle bg-background px-3 py-2.5">
              <div className="flex justify-between gap-2 text-[11.5px]">
                <span className="font-bold">{d.chartTitle}</span>
                <span className="flex gap-2.5 text-muted">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-[2px] bg-chart-1" />
                    {d.legend[0]}
                  </span>
                  {d.legend[1] ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-[2px] bg-chart-2" />
                      {d.legend[1]}
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                className={cn(
                  "flex items-end gap-1.5 border-b border-border-subtle",
                  full ? "h-[110px]" : "h-16",
                )}
              >
                {d.bars.map(([a, b], i) => (
                  <div key={i} className="flex h-full flex-1 items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t-[3px] bg-chart-1"
                      style={{ height: `${a}%` }}
                    />
                    {b !== undefined ? (
                      <div
                        className="flex-1 rounded-t-[3px] bg-chart-2"
                        style={{ height: `${b}%` }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            {full ? (
              <div className="overflow-hidden rounded-[9px] border border-border-subtle bg-background">
                <div className="border-b border-border-subtle px-3 py-2 text-[11.5px] font-bold">
                  {d.rowsTitle}
                </div>
                {d.rows.map(([label, status, tone]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2.5 border-b border-surface-muted px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="truncate">{label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap",
                        toneClass[tone],
                      )}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </figure>
  );
}
