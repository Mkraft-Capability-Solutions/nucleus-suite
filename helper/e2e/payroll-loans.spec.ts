import { expect, test } from "@playwright/test";
import { signInAsSmoke } from "./auth";

/**
 * OC-P4-03 — Payroll and loan browser scenarios (TDD spec).
 * Route availability and payslip/trace surface readiness.
 */

test("payroll workspace renders its primary heading", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  const response = await page.goto("/payroll");
  expect(response?.ok(), "payroll should load").toBeTruthy();
  await expect(page.locator("h1").first()).toBeVisible();
});

test("loans workspace renders its primary heading", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  const response = await page.goto("/loans");
  expect(response?.ok(), "loans should load").toBeTruthy();
  await expect(page.locator("h1").first()).toBeVisible();
});
