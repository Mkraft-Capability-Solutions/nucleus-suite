import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/v1/home` must not serve tenant-wide figures to an ordinary employee.
 *
 * The assertion that matters is not the shape of the JSON but the absence of
 * the queries: a component-only fix would still have left headcount, today's
 * whole-tenant attendance, the payroll run and the candidate pipeline sitting
 * in the network response. So each tenant-wide service is a spy, and the test
 * proves it is never called for a non-administrative principal.
 */

const services = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  getWorkforceOverview: vi.fn(),
  summarizeToday: vi.fn(),
  listRuns: vi.fn(),
  listLatestRunAnomalies: vi.fn(),
  listApplications: vi.fn(),
  listPostings: vi.fn(),
  listObligations: vi.fn(),
  capabilityByDepartment: vi.fn(),
  listNotifications: vi.fn(),
  listAnnouncements: vi.fn(),
  listLeaveRequests: vi.fn(),
}));

vi.mock("@/server/platform/access", () => ({ requireAccess: services.requireAccess }));
vi.mock("@/server/organization/service", () => ({ getWorkforceOverview: services.getWorkforceOverview }));
vi.mock("@/server/attendance/service", () => ({ summarizeToday: services.summarizeToday }));
vi.mock("@/server/payroll/service", () => ({ listRuns: services.listRuns, listLatestRunAnomalies: services.listLatestRunAnomalies }));
vi.mock("@/server/talent/service", () => ({ listApplications: services.listApplications }));
vi.mock("@/server/interviews/service", () => ({ listPostings: services.listPostings }));
vi.mock("@/server/compliance/service", () => ({ listObligations: services.listObligations }));
vi.mock("@/server/skills/service", () => ({ capabilityByDepartment: services.capabilityByDepartment }));
vi.mock("@/server/notifications/service", () => ({ listNotifications: services.listNotifications }));
vi.mock("@/server/engagement/service", () => ({ listAnnouncements: services.listAnnouncements }));
vi.mock("@/server/leave/service", () => ({ listLeaveRequests: services.listLeaveRequests }));

import { GET, TENANT_WIDE_SOURCES } from "./route";

const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";

function principal(permissions: string[], roles: string[]) {
  return {
    context: {
      actorUserId: "user-a",
      membershipId: "membership-a",
      tenantId: "tenant-a",
      employeeId: EMPLOYEE_ID,
      permissions,
      roles,
    },
    tenantId: "tenant-a",
  };
}

const TENANT_WIDE_SPIES = [
  services.getWorkforceOverview,
  services.summarizeToday,
  services.listRuns,
  services.listLatestRunAnomalies,
  services.listApplications,
  services.listPostings,
  services.listObligations,
  services.capabilityByDepartment,
];

beforeEach(() => {
  vi.clearAllMocks();
  services.listNotifications.mockResolvedValue({ items: [], unread: 2 });
  services.listAnnouncements.mockResolvedValue([{ id: "announcement-a" }]);
  services.listLeaveRequests.mockResolvedValue({
    items: [{ id: "leave-a", status: "pending_approval", requested_days: 2, starts_on: "2026-09-21" }],
    total: 1,
  });
  services.getWorkforceOverview.mockResolvedValue({ total: 412, joinerCounts: [], headcount: [{ name: "Ops", headcount: 12 }], openPositions: 7 });
  services.summarizeToday.mockResolvedValue({ date: "2026-09-15", present: 300, halfDay: 2, onLeave: 8, absent: 4, notRecorded: 98, total: 412, percentPresent: 72.8 });
  services.listRuns.mockResolvedValue({ items: [{ period: "2026-08", net_minor: 91_000_000, currency: "INR" }], total: 1 });
  services.listLatestRunAnomalies.mockResolvedValue([]);
  services.listApplications.mockResolvedValue({ items: [], total: 34 });
  services.listPostings.mockResolvedValue([{ id: "posting-a" }]);
  services.listObligations.mockResolvedValue([]);
  services.capabilityByDepartment.mockResolvedValue([{ name: "Ops", value: 3 }]);
});

async function body(): Promise<Record<string, never> & { data: Record<string, unknown> }> {
  const response = await GET(new Request("https://nucleus.test/api/v1/home"));
  return (await response.json()) as { data: Record<string, unknown> } & Record<string, never>;
}

describe("GET /api/v1/home for an ordinary employee", () => {
  beforeEach(() => {
    services.requireAccess.mockResolvedValue(principal(["employee.read", "attendance.read", "leave.read"], ["employee"]));
  });

  it("never runs a single tenant-wide query", async () => {
    await body();
    for (const spy of TENANT_WIDE_SPIES) expect(spy).not.toHaveBeenCalled();
  });

  it("returns no tenant-wide aggregate anywhere in the response", async () => {
    const payload = await body();
    const data = payload.data;
    const summary = data.summary as Record<string, unknown>;

    expect(data.scope).toBe("self");
    expect(summary.headcount).toBeNull();
    expect(summary.openPositions).toBeNull();
    expect(summary.attendanceToday).toBeNull();
    expect(summary.applications).toBeNull();
    expect(summary.activePostings).toBeNull();
    expect(summary.payrollNetMinor).toBeNull();
    expect(data.headcountByDepartment).toBeNull();
    expect(data.capabilityByDepartment).toBeNull();
    expect(data.commandCentre).toBeNull();
    expect(data.hiringStages).toBeNull();
    expect(data.compliance).toBeNull();
    expect(data.latestPayroll).toBeNull();

    // No withheld figure is replaced by a fabricated zero anywhere.
    expect(JSON.stringify(data)).not.toContain("412");
    expect(JSON.stringify(data)).not.toContain("72.8");
  });

  it("names every withheld source instead of silently dropping it", async () => {
    const data = (await body()).data;
    const withheld = data.withheldSources as Array<{ name: string; reason: string }>;
    expect(withheld.map((entry) => entry.name)).toEqual([...TENANT_WIDE_SOURCES]);
    for (const entry of withheld) expect(entry.reason).toMatch(/administrative principal/i);
  });

  it("reads only this employee's own leave, and reports only their own pending items", async () => {
    const data = (await body()).data;
    expect(services.listLeaveRequests).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ employeeId: EMPLOYEE_ID }),
    );
    const attention = data.attention as Array<{ domain: string; href: string }>;
    expect(attention).toHaveLength(1);
    expect(attention[0].domain).toBe("leave");
    expect((data.summary as Record<string, unknown>).pendingLeave).toBe(1);
  });

  it("still serves the strictly personal counts", async () => {
    const summary = (await body()).data.summary as Record<string, unknown>;
    expect(summary.unreadNotifications).toBe(2);
    expect(summary.announcements).toBe(1);
  });
});

describe("GET /api/v1/home for an administrative principal", () => {
  beforeEach(() => {
    services.requireAccess.mockResolvedValue(
      principal(["employee.read", "attendance.read", "leave.read", "tenant.manage"], ["hr_admin"]),
    );
  });

  it("still serves the command centre unchanged", async () => {
    const data = (await body()).data;
    const summary = data.summary as Record<string, unknown>;
    expect(data.scope).toBe("tenant");
    expect(summary.headcount).toBe(412);
    expect(summary.openPositions).toBe(7);
    expect(summary.attendanceToday).toMatchObject({ percentPresent: 72.8 });
    expect(data.commandCentre).not.toBeNull();
    expect(data.withheldSources).toEqual([]);
    for (const spy of TENANT_WIDE_SPIES) expect(spy).toHaveBeenCalled();
  });

  it("is decided by the admin role even without the tenant-management permission", async () => {
    services.requireAccess.mockResolvedValue(principal(["employee.read"], ["owner"]));
    expect((await body()).data.scope).toBe("tenant");
  });
});
