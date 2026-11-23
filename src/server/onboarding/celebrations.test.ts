import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), authorize: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx }));
vi.mock("@/server/identity/authorization", () => ({ authorize: mocks.authorize }));

const { listCelebrations, monthDayWindow, nextOccurrence, celebrationsQuerySchema } = await import("@/server/onboarding/celebrations");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;
const NOW = new Date("2026-12-20T09:00:00Z");
const row = (id: string, eventDate: string, first = "Asha") => ({ id, employee_code: `E-${id}`, first_name: first, last_name: "Rao", department: "Finance", event_date: eventDate });

describe("celebrations window helpers", () => {
  it("wraps the month-day window across the year end", () => {
    const keys = monthDayWindow("2026-12-30", 3);
    expect(keys).toEqual(["12-30", "12-31", "01-01", "01-02"]);
  });

  it("celebrates 29 February on 28 February in a non-leap year", () => {
    expect(monthDayWindow("2027-02-27", 1)).toContain("02-29");
    expect(nextOccurrence("1992-02-29", "2027-02-01")).toBe("2027-02-28");
    expect(nextOccurrence("1992-02-29", "2028-02-01")).toBe("2028-02-29");
  });

  it("rolls a date that already passed this year to next year", () => {
    expect(nextOccurrence("1990-01-05", "2026-12-20")).toBe("2027-01-05");
    expect(nextOccurrence("1990-12-20", "2026-12-20")).toBe("2026-12-20");
  });

  it("bounds the window between 1 and 60 days", () => {
    expect(celebrationsQuerySchema.safeParse({ days: "0" }).success).toBe(false);
    expect(celebrationsQuerySchema.safeParse({ days: "61" }).success).toBe(false);
    expect(celebrationsQuerySchema.parse({})).toEqual({ days: 30 });
  });
});

describe("listCelebrations", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("enforces employee.read, scopes every query to the tenant and never returns a birth year", async () => {
    mocks.authorize.mockReturnValue({ allowed: true });
    mocks.tenantTx.mockResolvedValue([
      [row("1", "1990-01-03", "Zed"), row("2", "1988-12-24")],
      [row("3", "2020-12-28")],
      [row("4", "2026-12-15")],
    ]);
    const result = await listCelebrations(access, { days: 30 }, NOW);
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    const statements = mocks.tenantTx.mock.calls[0][1] as Array<{ values: unknown[] }>;
    expect(statements).toHaveLength(3);
    statements.forEach((statement) => expect(statement.values).toContain("t-1"));
    expect(result.birthdays.available).toBe(true);
    expect(result.birthdays.items.map((item) => item.occursOn)).toEqual(["2026-12-24", "2027-01-03"]);
    expect(JSON.stringify(result.birthdays)).not.toContain("1990");
    expect(result.anniversaries.items[0]).toMatchObject({ occursOn: "2026-12-28", years: 6 });
    expect(result.newJoiners.items[0]).toMatchObject({ employeeCode: "E-4", occursOn: "2026-12-15" });
  });

  it("reports birthdays unavailable without the birthdate permission instead of an empty list", async () => {
    mocks.authorize.mockReturnValue({ allowed: false });
    mocks.tenantTx.mockResolvedValue([[], [], []]);
    const result = await listCelebrations(access, { days: 30 }, NOW);
    expect(result.birthdays).toEqual({ available: false, reason: "permission", items: [] });
    const birthdayStatement = (mocks.tenantTx.mock.calls[0][1] as Array<{ strings: string[] }>)[0];
    expect(birthdayStatement.strings.join("")).toContain("where false");
  });

  it("drops anniversaries in the joining year", async () => {
    mocks.authorize.mockReturnValue({ allowed: true });
    mocks.tenantTx.mockResolvedValue([[], [row("5", "2025-12-25"), row("6", "2026-12-21")], []]);
    const result = await listCelebrations(access, { days: 30 }, NOW);
    expect(result.anniversaries.items.map((item) => item.employeeCode)).toEqual(["E-5"]);
  });
});
