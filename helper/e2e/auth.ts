import { expect, type Page } from "@playwright/test";

export async function signInAsSmoke(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Work email/i).fill("opencode-smoke@example.test");
  await page.locator("input#password").fill(process.env.MKRAFT_SMOKE_PASSWORD ?? "");
  await page.getByRole("button", { name: "Enter Workspace" }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
}
