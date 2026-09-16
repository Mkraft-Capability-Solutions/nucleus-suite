import { expect, test } from "@playwright/test";
import { signInAsSmoke } from "./auth";

/**
 * OC-P1-03 — Authentication and tenant-context browser scenarios (TDD spec).
 * Extends e2e/product.spec.ts with denial-path coverage for Slice 1.
 */

test("login enforces email/password contract with a 12-character minimum", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Work email")).toHaveAttribute("type", "email");
  await expect(page.locator("input#password")).toHaveAttribute("minlength", "12");
});

test("invite-only contract: no public signup path when disabled", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  // With ALLOW_INITIAL_ADMIN_SIGNUP=false the Create Account tab is not rendered.
  await expect(page.getByRole("button", { name: "Create Account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter Workspace" })).toBeVisible();
});

test("workspace shell exposes tenant scope and command-center signals", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  await expect(page.getByText("Total headcount")).toBeVisible();
  await expect(page.getByText("Headcount by department")).toBeVisible();
});
