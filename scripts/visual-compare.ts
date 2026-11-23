/**
 * Visual comparison: the live signed-in workspace against the Pulse reference mockup, at the same viewport sizes.
 *
 * Usage (credentials come from env vars only; they are never printed or written):
 *   VISUAL_BASE_URL=http://localhost:9000 VISUAL_USER_EMAIL=... VISUAL_USER_PASSWORD=... npx tsx scripts/visual-compare.ts
 *
 * Output: test-results/visual/<width>-live.png, <width>-reference.png, and summary.json with element-level
 * measurements (frame regions, card radii, fonts, colours) for both, so differences are listed, not guessed.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.VISUAL_BASE_URL ?? "http://localhost:9000";
const EMAIL = process.env.VISUAL_USER_EMAIL;
const PASSWORD = process.env.VISUAL_USER_PASSWORD;
const REFERENCE = resolve("docs/plans/V1.0/DASHBOARD-PULSE-MOCKUP.html");
const OUT = resolve("test-results/visual");
const WIDTHS = [1440, 1024, 390];

interface Measure {
  bodyBg: string;
  bodyFont: string;
  bodySize: string;
  header: { height: number; position: string; bg: string } | null;
  leftRail: { width: number; bg: string } | null;
  cards: { count: number; radius: string; padding: string; bg: string };
  minFontPx: number;
  horizontalOverflow: boolean;
}

async function measure(page: Page): Promise<Measure> {
  // tsx wraps named functions with a `__name` helper that does not exist inside the page.
  await page.evaluate("window.__name = window.__name || ((fn) => fn)");
  return page.evaluate(() => {
    const pick = (selectors: string[]) => selectors.map((s) => document.querySelector(s)).find(Boolean) as HTMLElement | undefined;
    const box = (el?: HTMLElement) => (el ? el.getBoundingClientRect() : null);
    const cs = (el?: Element | null) => (el ? getComputedStyle(el) : null);
    const header = pick(["header", ".top", "[class*='topNav']", "[class*='TopNav']"]);
    const rail = pick(["nav[aria-label='Modules']", ".rail", "[class*='sideNav']", "[class*='leftDock']"]);
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".card, [class*='widgetCard'], [class*='kpiTile']"));
    let min = 999;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) return;
      const v = parseFloat(getComputedStyle(el).fontSize);
      if (v > 0 && el.offsetParent) min = Math.min(min, v);
    });
    const b = getComputedStyle(document.body);
    const c0 = cs(cards[0]);
    return {
      bodyBg: b.backgroundColor,
      bodyFont: b.fontFamily.split(",")[0],
      bodySize: b.fontSize,
      header: header ? { height: Math.round(box(header)!.height), position: cs(header)!.position, bg: cs(header)!.backgroundColor } : null,
      leftRail: rail ? { width: Math.round(box(rail)!.width), bg: cs(rail)!.backgroundColor } : null,
      cards: { count: cards.length, radius: c0?.borderRadius ?? "", padding: c0?.padding ?? "", bg: c0?.backgroundColor ?? "" },
      minFontPx: min,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function main(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    console.error("Set VISUAL_USER_EMAIL and VISUAL_USER_PASSWORD (a test account). They are read from env only.");
    process.exit(2);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const summary: Record<string, { live: Measure; reference: Measure }> = {};
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.locator("input[type='email'], input[name='email']").first().fill(EMAIL);
    await page.locator("input[type='password']").first().fill(PASSWORD);
    await Promise.all([page.waitForURL(/workspace/, { timeout: 60_000 }), page.locator("button[type='submit']").first().click()]);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/workspace`, { waitUntil: "load" });
      await page.waitForSelector("header[role='banner']", { timeout: 90_000 });
      await page.waitForTimeout(16000);
      await page.screenshot({ path: join(OUT, `${width}-live.png`), fullPage: true });
      const live = await measure(page);
      const ref = await browser.newPage({ viewport: { width, height: 900 } });
      await ref.goto(`file://${REFERENCE}`, { waitUntil: "load" });
      await ref.waitForTimeout(1200);
      await ref.screenshot({ path: join(OUT, `${width}-reference.png`), fullPage: true });
      const reference = await measure(ref);
      await ref.close();
      summary[String(width)] = { live, reference };
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`Wrote ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
