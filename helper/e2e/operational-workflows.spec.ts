import { expect, test } from "@playwright/test";

test("travel request, submission and independent approval remain in one workspace", async ({ page }) => {
  const employeeId = "123e4567-e89b-42d3-a456-426614174000";
  const recordId = "123e4567-e89b-42d3-a456-426614174001";
  let manager = false;
  let record: Record<string, unknown> | undefined;
  const writes: Array<{ path: string; body: Record<string, unknown>; version?: string }> = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/workspace/bootstrap") return route.fulfill({ json: { data: {
      user: { id: manager ? "manager" : "requester", name: manager ? "Test manager" : "Test requester", email: "test@example.invalid" }, platformAdmin: false,
      memberships: [{ membershipId: manager ? "m2" : "m1", tenantId: "t", tenantName: "Contract-test workspace", tenantSlug: "test", employeeId }],
      context: { actorUserId: manager ? "manager" : "requester", membershipId: manager ? "m2" : "m1", tenantId: "t", roles: [manager ? "manager" : "employee"], permissions: ["employee.read", "workforce.travel.read", "workforce.travel.write", "workforce.travel.approve"] },
      settings: { locale: "en-IN", timezone: "Asia/Kolkata", currency: "INR", policy_schema_version: 1, settings: {} }, notifications: { items: [], unread: 0 },
    } } });
    if (path === "/api/v1/dossier-lookups/employees") return route.fulfill({ json: { data: [{ id: employeeId, name: "Test employee" }] } });
    if (path.startsWith("/api/v1/operations/travel") && request.method() === "POST") {
      const body = request.postDataJSON();
      writes.push({ path, body, version: request.headers()["if-match"] });
      const status = path.endsWith("/submit") ? "submitted" : path.endsWith("/approve") ? "approved" : "draft";
      record = { ...record, ...body, id: recordId, status, version: Number(record?.version ?? 0) + 1, createdByMembershipId: "m1" };
      return route.fulfill({ json: { data: record } });
    }
    return route.fulfill({ json: { data: path === "/api/v1/operations/travel" && record ? [record] : [] } });
  });

  await page.goto("/travel?section=journeys");
  await page.getByRole("button", { name: "Create Travel & duty requests", exact: true }).click();
  await page.getByLabel(/^Employee reference/i).fill(employeeId);
  await page.getByLabel(/^Request type/i).selectOption("business_travel");
  await page.getByLabel(/^Purpose/i).fill("Inspect factory");
  await page.getByLabel(/^Origin/i).fill("Pune");
  await page.getByLabel(/^Destination/i).fill("Mumbai");
  await page.getByLabel(/^Start date/i).fill("2026-09-20");
  await page.getByLabel(/^End date/i).fill("2026-09-21");
  await page.getByLabel(/^Transport/i).selectOption("rail");
  await page.getByLabel(/^Estimated cost/i).fill("50000");
  await page.getByLabel(/^Advance/i).fill("10000");
  await page.getByLabel(/^Contact phone/i).fill("+911234567890");
  await page.locator("form").getByRole("button", { name: "Create Travel & duty requests", exact: true }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  expect(writes[0].body.estimatedCostMinor).toBe(50000);
  expect(writes[0].body.advanceMinor).toBe(10000);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Select / view", exact: true }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByLabel(/^Reason/i).fill("Ready for manager review");
  await page.getByRole("checkbox").check();
  await page.locator("form").getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  expect(writes[1].version).toBe('"1"');
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

  manager = true;
  await page.reload();
  await page.getByRole("button", { name: "Select / view", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByLabel(/^Reason/i).fill("Budget and travel approved");
  await page.getByRole("checkbox").check();
  await page.locator("form").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  expect(writes[2].version).toBe('"2"');
  expect(record?.status).toBe("approved");
});
