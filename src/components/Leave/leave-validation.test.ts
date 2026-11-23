import { describe, expect, it } from "vitest";
import { validateLeaveApplication, type LeaveDraft } from "./leave-validation";
import { summariseCompOff } from "./LeaveCompOffTab";

const t = (_k: string, fallback: string) => fallback;
const draft: LeaveDraft = { leaveType: "CL", startsOn: "2026-03-02", endsOn: "2026-03-03", duration: "full", days: "2", reason: "", contact: "" };

describe("leave application validation", () => {
  it("accepts a valid request", () => expect(validateLeaveApplication(draft, { available: 5, hasEmployee: true }, t)).toEqual({}));
  it("mirrors the server rules", () => {
    expect(validateLeaveApplication({ ...draft, days: "3" }, { available: 5, hasEmployee: true }, t).days).toMatch(/More days/);
    expect(validateLeaveApplication(draft, { available: 1, hasEmployee: true }, t).days).toMatch(/available/);
    expect(validateLeaveApplication({ ...draft, endsOn: "2026-03-01" }, { available: 5, hasEmployee: true }, t).endsOn).toBeTruthy();
    expect(validateLeaveApplication({ ...draft, leaveType: "ML" }, { available: 5, hasEmployee: false }, t)).toMatchObject({ employee: expect.any(String), leaveType: expect.any(String) });
  });
  it("summarises the comp-off clock", () => {
    const row = { id: "1", creditId: null, employeeCode: null, employeeName: null, earnedOn: null, expiresOn: "2026-04-01", daysRemaining: 1, status: "open" as const, daysToExpiry: 5 };
    expect(summariseCompOff([row, { ...row, id: "2", status: "lapsed" }])).toMatchObject({ openDays: 1, lapsedDays: 1 });
  });
});
