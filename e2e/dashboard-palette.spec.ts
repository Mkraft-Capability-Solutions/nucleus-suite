import { test, expect } from '@playwright/test';

test('executive filters and narrative actions use readable theme pairs', async ({ page }, info) => {
  test.setTimeout(150000);
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('superadmin@nucleus.com');
  await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await page.getByRole('button', { name: 'Switch Dashboard Console', exact: true }).click();
  await page.getByRole('menu').getByRole('button', { name: /^S1\b/ }).click();
  const panel = page.locator('[class*="workforceFilters"]');
  await expect(panel).toBeVisible();
  for (const theme of ['Pearl violet', 'Graphite night', 'Slate blue', 'Sage teal']) {
    await page.getByRole('button', { name: 'Choose theme' }).click();
    await page.getByRole('menuitemradio', { name: theme }).click();
    await expect(page.getByRole('menuitemradio', { name: theme })).toBeHidden();
    await expect.poll(() => panel.evaluate(root => {
      const rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const lum = (s: string) => rgb(s).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      return [...Array.from(root.querySelectorAll('h3, span, select, button')), ...Array.from(document.querySelectorAll('[class*=narrativeBtn]'))].filter(el => el.textContent?.trim()).flatMap(el => {
        let background: Element | null = el;
        while (background && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(background).backgroundColor)) background = background.parentElement;
        if (!background) return [];
        const layers: number[][] = [];
        for (let node: Element | null = el; node; node = node.parentElement) {
          const values = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)!.map(Number);
          layers.push([values[0], values[1], values[2], values[3] ?? 1]);
        }
        const composite = layers.reverse().reduce((base, layer) => base.map((v, i) => layer[i] * layer[3] + v * (1 - layer[3])), [255, 255, 255]);
        const a = lum(getComputedStyle(el).color), b = lum(`rgb(${composite.join(',')})`);
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        return ratio < 4.5 ? [{ text: el.textContent?.trim(), ratio }] : [];
      });
    }), { message: theme }).toEqual([]);
    await expect(panel.locator('select')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`dashboard-${theme}.png`), fullPage: true });
  }
});
