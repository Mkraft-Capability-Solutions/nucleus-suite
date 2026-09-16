import { expect, test } from "@playwright/test";

// Local UI contract test. All API calls are intercepted; no real HR data is mutated.
test("section navigation and course creation use the API contract", async ({ page }) => {
  const courses: Array<Record<string, unknown>> = [];
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/workspace/bootstrap") {
      return route.fulfill({ json: { data: {
        user: { id: "u", name: "Test HR Manager", email: "hr@example.test" }, platformAdmin: false,
        memberships: [{ membershipId: "m", tenantId: "t", tenantName: "Test workspace", tenantSlug: "test", employeeId: null }],
        context: { actorUserId: "u", membershipId: "m", tenantId: "t", roles: ["HR manager"], permissions: ["employee.read", "employee.write"] },
        settings: { locale: "en-IN", timezone: "Asia/Kolkata", currency: "INR", policy_schema_version: 1, settings: {} },
        notifications: { items: [], unread: 0 },
      } } });
    }
    if (path === "/api/v1/courses" && route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      const course = { id: "course-1", ...submitted };
      courses.push(course);
      return route.fulfill({ json: { data: course } });
    }
    return route.fulfill({ json: { data: path === "/api/v1/courses" ? courses : [] } });
  });
  await page.goto("/learning?section=courses");
  await expect(page.getByRole("heading", { name: "Courses", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Module sections" }).getByRole("link", { name: "Learning catalogue" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Module sections" }).getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("complementary", { name: "Primary modules" }).getByRole("link", { name: "Talent", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: /^Create course$/i }).click();
  await page.getByLabel(/^Code/).fill("SAFE");
  await page.getByLabel(/^Title/).fill("Workplace safety");
  await page.getByLabel(/^Duration minutes/i).fill("45");
  await page.locator("form").getByRole("button", { name: /^Create course$/i }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  expect(submitted).toEqual({ code: "SAFE", title: "Workplace safety", mandatory: false, durationMinutes: 45 });
  await expect(page.getByRole("cell", { name: "Workplace safety", exact: true })).toBeVisible();
  await page.getByLabel("Work with").selectOption("learning-paths");
  await expect(page).toHaveURL(/section=learning-paths/);
  await expect(page.getByRole("heading", { name: "Learning paths", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Module sections" }).getByRole("link", { name: "Learning catalogue" })).toHaveAttribute("aria-current", "page");
});
