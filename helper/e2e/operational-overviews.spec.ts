import { expect, test } from "@playwright/test";

test("operational landing pages show live work instead of instruction placeholders", async ({ page }) => {
  const permissions = [
    "workforce.rosters.read", "workforce.rosters.write", "workforce.rosters.approve",
    "workforce.projects.read", "workforce.projects.write", "workforce.projects.approve",
    "workforce.assets.read", "workforce.assets.write", "workforce.assets.approve",
  ];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/workspace/bootstrap") return route.fulfill({ json: { data: {
      user: { id: "manager", name: "Operations manager", email: "manager@example.invalid" }, platformAdmin: false,
      memberships: [{ membershipId: "membership", tenantId: "tenant", tenantName: "Operations", tenantSlug: "operations", employeeId: "employee" }],
      context: { actorUserId: "manager", membershipId: "membership", employeeId: "employee", tenantId: "tenant", roles: ["manager"], permissions },
      settings: null, notifications: { items: [], unread: 0 },
    } } });
    const data: Record<string, Record<string, unknown>[]> = {
      "/api/v1/operations/rosters": [{ id: "roster-1", version: 1, shiftCode: "A", startDate: "2026-09-15", status: "submitted", updatedAt: "2026-09-13T10:00:00Z" }],
      "/api/v1/operations/projects": [{ id: "project-1", version: 1, name: "Plant modernization", status: "active", updatedAt: "2026-09-13T10:00:00Z" }],
      "/api/v1/operations/allocations": [{ id: "allocation-1", version: 1, role: "Site engineer", startDate: "2026-09-15", status: "approved", updatedAt: "2026-09-13T09:00:00Z" }],
      "/api/v1/operations/assets": [{ id: "asset-1", version: 1, assetTag: "LT-101", name: "Field laptop", status: "allocated", updatedAt: "2026-09-13T08:00:00Z" }],
    };
    return route.fulfill({ json: { data: data[path] ?? [] } });
  });

  for (const example of [
    { path: "/rosters", heading: "Shift Planning & Rosters", action: "Plan roster", record: "A shift · 2026-09-15" },
    { path: "/projects", heading: "Projects & Workforce Allocation", action: "Manage projects", record: "Plant modernization" },
    { path: "/assets", heading: "Assets & Custody", action: "Manage inventory", record: "Field laptop" },
  ]) {
    await page.goto(example.path);
    await expect(page.getByRole("heading", { name: example.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: example.action })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work areas" })).toBeVisible();
    await expect(page.getByRole("link", { name: example.record })).toBeVisible();
    await expect(page.getByText("Open a workflow tab above to create a request or select a record for its next action.")).toHaveCount(0);
    await page.getByRole("link", { name: example.record }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`Selected: ${example.record.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
  }
});
