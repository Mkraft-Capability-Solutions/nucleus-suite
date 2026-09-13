import { describe, expect, it } from "vitest";
import { attendanceScopeKind, ingestPunchesSchema, normalizeTodayBucket, requestGatePassSchema, SHIFT_DEFINITIONS } from "@/server/attendance/service";
import { earlyReturnSchema, grantCoffSchema, requestLeaveSchema } from "@/server/leave/service";

const EMPLOYEE = "123e4567-e89b-12d3-a456-426614174000";

describe("attendance schemas (OC-P3-01/02)", () => {
  it("defines canonical shift durations: A 720, B 720, C 480", () => {
    expect(SHIFT_DEFINITIONS.A.durationMinutes).toBe(720);
    expect(SHIFT_DEFINITIONS.B.durationMinutes).toBe(720);
    expect(SHIFT_DEFINITIONS.C.durationMinutes).toBe(480);
  });

  it("accepts a well-formed overnight punch batch", () => {
    const parsed = ingestPunchesSchema.safeParse({
      employeeId: EMPLOYEE,
      workDate: "2026-09-10",
      shiftCode: "A",
      punches: [
        { at: "2026-09-10T08:00:00+05:30", type: "in", source: "biometric" },
        { at: "2026-09-10T20:30:00+05:30", type: "out", source: "biometric" },
        { at: "2026-09-10T21:15:00+05:30", type: "in", source: "biometric" },
        { at: "2026-09-11T03:20:00+05:30", type: "out", source: "biometric" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects single punches, oversized batches and bad dates", () => {
    const base = { employeeId: EMPLOYEE, workDate: "2026-09-10", punches: [{ at: "2026-09-10T08:00:00+05:30", type: "in" }] };
    expect(ingestPunchesSchema.safeParse(base).success).toBe(false);
    expect(ingestPunchesSchema.safeParse({ ...base, workDate: "10-09-2026", punches: [...base.punches, { at: "2026-09-10T17:00:00+05:30", type: "out" }] }).success).toBe(false);
    expect(ingestPunchesSchema.safeParse({ ...base, employeeId: "nope" }).success).toBe(false);
  });

  it("restricts gate passes to 2h or 4h options", () => {
    const base = { employeeId: EMPLOYEE, date: "2026-09-10", reason: "Bank visit" };
    expect(requestGatePassSchema.safeParse({ ...base, minutes: 120 }).success).toBe(true);
    expect(requestGatePassSchema.safeParse({ ...base, minutes: 240 }).success).toBe(true);
    expect(requestGatePassSchema.safeParse({ ...base, minutes: 60 }).success).toBe(false);
  });
});

describe("leave schemas (OC-P3-01/02)", () => {
  it("validates leave requests with bounded day counts", () => {
    const base = { employeeId: EMPLOYEE, leaveType: "EL", startsOn: "2026-09-01", endsOn: "2026-09-10", days: 10 };
    expect(requestLeaveSchema.safeParse(base).success).toBe(true);
    expect(requestLeaveSchema.safeParse({ ...base, days: 0 }).success).toBe(false);
    expect(requestLeaveSchema.safeParse({ ...base, days: 61 }).success).toBe(false);
    expect(requestLeaveSchema.safeParse({ ...base, leaveType: "ANNUAL" }).success).toBe(false);
  });

  it("validates early-return and COFF payloads", () => {
    expect(earlyReturnSchema.safeParse({ actualReturnDate: "2026-09-07" }).success).toBe(true);
    expect(earlyReturnSchema.safeParse({ actualReturnDate: "07-09-2026" }).success).toBe(false);
    expect(grantCoffSchema.safeParse({ employeeId: EMPLOYEE, earnedOn: "2026-09-10", days: 1 }).success).toBe(true);
    expect(grantCoffSchema.safeParse({ employeeId: EMPLOYEE, earnedOn: "2026-09-10", days: 11 }).success).toBe(false);
  });
});

describe("today-summary normalizer (command centre)", () => {
  it("buckets canonical day statuses", () => {
    expect(normalizeTodayBucket("present")).toBe("present");
    expect(normalizeTodayBucket("Present")).toBe("present");
    expect(normalizeTodayBucket("locked")).toBe("present");
    expect(normalizeTodayBucket("half_day")).toBe("halfDay");
    expect(normalizeTodayBucket("Half day")).toBe("halfDay");
    expect(normalizeTodayBucket("absent")).toBe("absent");
  });

  it("returns null for pending and unknown statuses (never assumed)", () => {
    expect(normalizeTodayBucket("pending")).toBeNull();
    expect(normalizeTodayBucket("computed")).toBeNull();
    expect(normalizeTodayBucket("")).toBeNull();
  });
});

describe("attendance hierarchy scope", () => {
  it.each(["owner", "super-admin", "hr-manager", "time-office", "payroll-admin"])("gives %s tenant-wide visibility", (role) => {
    expect(attendanceScopeKind({ roles: [role], permissions: ["attendance.read"] })).toBe("tenant");
  });

  it("gives tenant administrators tenant-wide visibility regardless of role naming", () => {
    expect(attendanceScopeKind({ roles: ["custom-admin"], permissions: ["attendance.read", "tenant.manage"] })).toBe("tenant");
    expect(attendanceScopeKind({ roles: ["people-operator"], permissions: ["attendance.read", "membership.manage"] })).toBe("tenant");
  });

  it("restricts ordinary users and managers to their recursive employee hierarchy", () => {
    expect(attendanceScopeKind({ roles: ["employee"], permissions: ["attendance.read"] })).toBe("hierarchy");
    expect(attendanceScopeKind({ roles: ["manager"], permissions: ["attendance.read"] })).toBe("hierarchy");
  });
});
