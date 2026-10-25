import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Widths checked on every page: small phone, mockup phone, tablet, desktop. */
export const widths = [360, 390, 768, 1440] as const;

export async function setWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
}

/** WCAG 2.2 AA scan; fails on any serious or critical violation. */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

/** No horizontal page scroll. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Visible links, buttons and form controls are at least 44x44px. Links inside
 * running text are exempt (WCAG 2.5.8 inline exception), and a checkbox or radio
 * is measured by the label that wraps it, since the whole label is the target.
 */
export async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const selector = "a[href], button, input:not([type=hidden]), select, textarea, [role=button]";
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const target =
          el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")
            ? (el.closest("label") as HTMLElement)
            : el;
        const r = target.getBoundingClientRect();
        const style = getComputedStyle(el);
        const visible =
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== "hidden" &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.top < window.innerHeight * 4;
        const inline = el.tagName === "A" && el.closest("p, li > p, dd, label") !== null;
        return visible && !inline && (r.width < 44 || r.height < 44);
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
        return `${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
  });
  expect(small).toEqual([]);
}

/** Full-page screenshot kept as a test artifact for visual review against the mockup. */
export async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  // Show content that would fade in on scroll (website Reveal) before capturing.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-reveal]"))
      el.setAttribute("data-revealed", "");
  });
  await page.waitForTimeout(600);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

/** Records waiting in this app's outbox, read straight from IndexedDB. */
export function outboxItems(
  page: Page,
  app: string,
): Promise<{ id: string; table: string; payload: Record<string, unknown> }[]> {
  return page.evaluate(async (prefix) => {
    const dbs = await indexedDB.databases();
    const name = dbs.find((d) => d.name?.startsWith(prefix))?.name;
    if (!name) return [];
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("open failed"));
    });
    const items = await new Promise<
      { id: string; table: string; payload: Record<string, unknown> }[]
    >((resolve, reject) => {
      const req = db.transaction("outbox").objectStore("outbox").getAll();
      req.onsuccess = () =>
        resolve(req.result as { id: string; table: string; payload: Record<string, unknown> }[]);
      req.onerror = () => reject(new Error("read failed"));
    });
    db.close();
    return items;
  }, `corex-${app}-`);
}
