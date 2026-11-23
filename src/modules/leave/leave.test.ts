import { describe, expect, it } from "vitest";
import { redesignedModuleForTab } from "@/lib/ui-mode";
import { foldBalanceSummary } from "@/server/leave/balance-summary";
import { canReturnEarly, daysLabel, inclusiveDays, isPending, leaveName, overlaps, rangeLabel, requestState } from "./format";

describe("leave formatting", () => {
  it("names leave types and states", () => {
    expect(leaveName("EL")).toBe("Earned leave");
    expect(leaveName("CL", "Casual Leave")).toBe("Casual Leave");
    expect(leaveName("XYZ")).toBe("XYZ");
    expect(requestState("pending_supervisor").label).toBe("With manager");
    expect(requestState("pending_hr").label).toBe("With HR");
    expect(requestState("approved", "2099-01-01", "2026-11-23")).toEqual({ label: "Approved", tone: "success" });
    expect(requestState("approved", "2026-11-01", "2026-11-23")).toEqual({ label: "Taken", tone: "neutral" });
    expect(requestState("rejected").tone).toBe("danger");
    expect(isPending("pending_hod")).toBe(true);
    expect(isPending("approved")).toBe(false);
  });

  it("counts days and ranges", () => {
    expect(inclusiveDays("2026-11-03", "2026-11-07")).toBe(5);
    expect(inclusiveDays("2026-11-07", "2026-11-03")).toBeNull();
    expect(daysLabel(1)).toBe("1 day");
    expect(daysLabel(2.5)).toBe("2.5 days");
    expect(overlaps("2026-10-30", "2026-11-02", "2026-11-01", "2026-11-30")).toBe(true);
    expect(overlaps("2026-12-01", "2026-12-02", "2026-11-01", "2026-11-30")).toBe(false);
    expect(rangeLabel("2026-11-03", "2026-11-03")).toBe(new Date("2026-11-03T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
  });

  it("allows an early return only during approved leave", () => {
    expect(canReturnEarly("approved", "2026-11-20", "2026-11-28", "2026-11-23")).toBe(true);
    expect(canReturnEarly("approved", "2026-11-20", "2026-11-23", "2026-11-23")).toBe(false);
    expect(canReturnEarly("pending_supervisor", "2026-11-20", "2026-11-28", "2026-11-23")).toBe(false);
    expect(canReturnEarly("approved", "2026-11-25", "2026-11-28", "2026-11-23")).toBe(false);
  });

  it("shows the leave screen in Redesigned mode for the leaves tab", () => {
    expect(redesignedModuleForTab("leaves")).toBe("leave");
  });
});

describe("leave balance summary", () => {
  it("takes the stored balance, less leave approved since, plus credits since, and keeps pending apart", () => {
    const lines = foldBalanceSummary({
      stored: [{ leave_type: "EL", balance: 24, as_of: "2026-11-22", expires_on: null }, { leave_type: "CL", balance: 1, as_of: "2026-11-22", expires_on: "2026-12-31" }],
      approvedSince: [{ leave_type: "EL", days: 3 }],
      creditedSince: [{ leave_type: "EL", days: 1 }],
      pending: [{ leave_type: "CL", days: 1 }, { leave_type: "SL", days: 2 }],
      takenThisYear: [{ leave_type: "EL", days: 8 }],
      names: [{ code: "EL", name: "Earned Leave" }],
    });
    expect(lines.map((line) => line.leaveType)).toEqual(["CL", "EL", "SL"]);
    expect(lines.find((line) => line.leaveType === "EL")).toMatchObject({ available: 22, approvedSince: 3, creditedSince: 1, takenThisYear: 8, leaveTypeName: "Earned Leave" });
    expect(lines.find((line) => line.leaveType === "CL")).toMatchObject({ available: 1, pending: 1, expiresOn: "2026-12-31" });
    expect(lines.find((line) => line.leaveType === "SL")).toMatchObject({ available: null, pending: 2 });
  });
});
