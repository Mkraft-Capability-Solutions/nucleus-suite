import { expect, test } from "@playwright/test";
import { signInAsSmoke } from "./auth";

test("login exposes the real email/password contract", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel(/Work email/i)).toHaveAttribute("type", "email");
  await expect(page.locator("input#password")).toHaveAttribute("minlength", "12");
  await expect(page.getByRole("button", { name: "Enter Workspace" })).toBeVisible();
});

test("private workspace redirects an unauthenticated browser", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?next=.*)?$/);
});

test("authenticated dashboard and every module render live integration surfaces", async ({ page }) => {
  test.skip(!process.env.MKRAFT_SMOKE_PASSWORD, "needs MKRAFT_SMOKE_PASSWORD for authenticated UI verification");
  await signInAsSmoke(page);
  await expect(page.getByText("Total headcount")).toBeVisible();
  await expect(page.getByText("Approvals waiting on you")).toBeVisible();

  const routes = ["inbox", "people", "organization", "onboarding", "engagement", "attendance", "leave", "payroll", "loans", "performance", "talent", "learning", "compensation", "insights", "compliance", "integrations", "settings"];
  for (const route of routes) {
    const response = await page.goto(`/${route}`);
    expect(response?.ok(), `${route} should load`).toBeTruthy();
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

test("mobile module launcher opens and moves between authorised modules", async ({ page, isMobile }) => {
  test.skip(!isMobile || !process.env.MKRAFT_SMOKE_PASSWORD, "Mobile authenticated navigation check");
  await signInAsSmoke(page);
  await page.getByRole("button", { name: "Open modules" }).click();
  await page.getByRole("button", { name: /Work & pay/ }).click();
  await page.getByRole("link", { name: /Time office/ }).click();
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
});
