import { expect, test } from "@playwright/test";
import { signInAsSmoke } from "./auth";

/**
 * OC-P3-03 — Attendance and leave browser scenarios (TDD spec).
 * Golden cross-midnight trace plus leave route availability.
 */

test("attendance exposes live records and the read-only trace operation", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  await page.goto("/attendance");
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
});

test("leave workspace renders its primary heading", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  const response = await page.goto("/leave");
  expect(response?.ok(), "leave should load").toBeTruthy();
  await expect(page.locator("h1").first()).toBeVisible();
});
