import { describe, expect, it } from "vitest";
import {
  assertSelfScopeTarget,
  attendanceScope,
  attendanceScopeKind,
  ingestPunchesSchema,
  normalizeTodayBucket,
  punchSequenceRefusal,
  requestGatePassSchema,
  SHIFT_DEFINITIONS,
} from "@/server/attendance/service";
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
        { at: "2026-09-10T08:00:00+05:30", type: "in", source: "biometric_device" },
        { at: "2026-09-10T20:30:00+05:30", type: "out", source: "biometric_device" },
        { at: "2026-09-10T21:15:00+05:30", type: "in", source: "biometric_device" },
        { at: "2026-09-11T03:20:00+05:30", type: "out", source: "biometric_device" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a lone punch, and rejects empty or oversized batches and bad dates", () => {
    const base = { employeeId: EMPLOYEE, workDate: "2026-09-10", punches: [{ at: "2026-09-10T08:00:00+05:30", type: "in" }] };
    // A batch is a slice of a device's stream, not a whole day. The tail of an overnight
    // session arrives on its own as a single OUT, so requiring a pair would have forced the
    // caller to re-post the previous day's IN just to file it. Pairing is decided by
    // attribution, not by the batch edges.
    expect(ingestPunchesSchema.safeParse(base).success).toBe(true);
    expect(ingestPunchesSchema.safeParse({ ...base, punches: [{ at: "2026-09-11T03:20:00+05:30", type: "out" }] }).success).toBe(true);
    expect(ingestPunchesSchema.safeParse({ ...base, punches: [] }).success).toBe(false);
    expect(ingestPunchesSchema.safeParse({ ...base, workDate: "10-09-2026", punches: [...base.punches, { at: "2026-09-10T17:00:00+05:30", type: "out" }] }).success).toBe(false);
    expect(ingestPunchesSchema.safeParse({ ...base, employeeId: "nope" }).success).toBe(false);
  });

  it("takes the gate-pass duration from its two times and refuses an inverted pair", () => {
    const base = { employeeId: EMPLOYEE, date: "2026-09-10", reason: "Bank visit", fromTime: "14:00", toTime: "16:00" };
    expect(requestGatePassSchema.safeParse(base).success).toBe(true);
    expect(requestGatePassSchema.safeParse({ ...base, passType: "official" }).success).toBe(true);
    expect(requestGatePassSchema.safeParse({ ...base, toTime: "13:00" }).success).toBe(false);
    expect(requestGatePassSchema.safeParse({ ...base, toTime: "14:00" }).success).toBe(false);
    expect(requestGatePassSchema.safeParse({ ...base, expectedReturn: "13:30" }).success).toBe(false);
    expect(requestGatePassSchema.safeParse({ ...base, reason: "Bank" }).success).toBe(false);
    expect(requestGatePassSchema.safeParse({ ...base, passType: "vendor" }).success).toBe(false);
  });

  it("makes a mobile punch carry its coordinates and geofence verdict", () => {
    const base = { employeeId: EMPLOYEE, workDate: "2026-09-10", punches: [
      { at: "2026-09-10T08:00:00+05:30", type: "in", source: "mobile_app" },
      { at: "2026-09-10T17:00:00+05:30", type: "out", source: "mobile_app" },
    ] };
    expect(ingestPunchesSchema.safeParse(base).success).toBe(false);
    const located = base.punches.map((punch) => ({ ...punch, geo: { lat: 12.9716, lng: 77.5946 }, geofenceResult: "inside" }));
    expect(ingestPunchesSchema.safeParse({ ...base, punches: located }).success).toBe(true);
    // Outside the fence is accepted and flagged, never blocked.
    const outside = located.map((punch) => ({ ...punch, geofenceResult: "outside" }));
    expect(ingestPunchesSchema.safeParse({ ...base, punches: outside }).success).toBe(true);
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

  it("requires a half-day session only when one of the ends is a half day", () => {
    const base = { employeeId: EMPLOYEE, leaveType: "CL", startsOn: "2026-09-01", endsOn: "2026-09-02", days: 1.5 };
    expect(requestLeaveSchema.safeParse({ ...base, isHalfDayStart: true }).success).toBe(false);
    expect(requestLeaveSchema.safeParse({ ...base, isHalfDayStart: true, halfDaySession: "first_half" }).success).toBe(true);
    expect(requestLeaveSchema.safeParse({ ...base, isHalfDayEnd: true, halfDaySession: "midday" }).success).toBe(false);
    expect(requestLeaveSchema.safeParse({ ...base, contact: "9876543210" }).success).toBe(false);
    expect(requestLeaveSchema.safeParse({ ...base, contact: "+919876543210" }).success).toBe(true);
  });

  it("validates early-return and COFF payloads", () => {
    expect(earlyReturnSchema.safeParse({ actualReturnDate: "2026-09-07" }).success).toBe(true);
    expect(earlyReturnSchema.safeParse({ actualReturnDate: "07-09-2026" }).success).toBe(false);
    // The comp-off credit is derived from the attendance day, so the claim carries only the date and its reason.
    expect(grantCoffSchema.safeParse({ employeeId: EMPLOYEE, earnedOn: "2026-09-10", reason: "Covered the plant shutdown" }).success).toBe(true);
    expect(grantCoffSchema.safeParse({ employeeId: EMPLOYEE, earnedOn: "2026-09-10", reason: "Worked" }).success).toBe(false);
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

/* ------------------------------------------------------------------ */
/* Employee self-service punch clock                                   */
/* ------------------------------------------------------------------ */

const TENANT = "8a2c4f10-1c2b-4a5e-9f21-0c9a7b3d5e11";
const OTHER_EMPLOYEE = "9f8e7d6c-5b4a-4938-8271-6150493827a1";

function contextFor(permissions: string[], employeeId: string | null) {
  return {
    context: {
      actorUserId: "1f0c0b0a-0000-4000-8000-000000000001",
      membershipId: "1f0c0b0a-0000-4000-8000-000000000002",
      tenantId: TENANT,
      employeeId,
      permissions,
      roles: ["employee"],
    },
    tenantId: TENANT,
  };
}

describe("attendanceScope (migration 0025 self keys)", () => {
  it("resolves the full key first, so nothing changes for the time office", () => {
    expect(attendanceScope(contextFor(["attendance.read", "attendance.write"], null), "write")).toBe("all");
    expect(attendanceScope(contextFor(["attendance.read", "attendance.write"], null), "read")).toBe("all");
  });

  it("admits an employee holding only the self keys", () => {
    const employee = contextFor(["attendance.self.read", "attendance.self.write"], EMPLOYEE);
    expect(attendanceScope(employee, "write")).toBe("self");
    expect(attendanceScope(employee, "read")).toBe("self");
  });

  it("prefers the full key when a principal happens to hold both", () => {
    const both = contextFor(["attendance.write", "attendance.self.write"], EMPLOYEE);
    expect(attendanceScope(both, "write")).toBe("all");
  });

  it("refuses a principal holding neither, and one whose account has no employee link", () => {
    expect(() => attendanceScope(contextFor(["leave.read"], EMPLOYEE), "write")).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(() => attendanceScope(contextFor(["attendance.self.write"], null), "write")).toThrow(
      expect.objectContaining({ status: 403, code: "EMPLOYEE_LINK_REQUIRED" }),
    );
  });
});

describe("assertSelfScopeTarget (a self key may only act on its own record)", () => {
  it("lets a self-scoped employee act on their own record", () => {
    expect(() => assertSelfScopeTarget("self", EMPLOYEE, EMPLOYEE)).not.toThrow();
  });

  it("refuses a self-scoped employee posting for somebody else", () => {
    expect(() => assertSelfScopeTarget("self", EMPLOYEE, OTHER_EMPLOYEE)).toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });

  it("refuses a self key with no linked employee profile rather than falling open", () => {
    expect(() => assertSelfScopeTarget("self", null, EMPLOYEE)).toThrow(
      expect.objectContaining({ status: 403, code: "EMPLOYEE_LINK_REQUIRED" }),
    );
    expect(() => assertSelfScopeTarget("self", undefined, EMPLOYEE)).toThrow(
      expect.objectContaining({ status: 403, code: "EMPLOYEE_LINK_REQUIRED" }),
    );
  });

  it("does not narrow a full-scope caller", () => {
    expect(() => assertSelfScopeTarget("all", EMPLOYEE, OTHER_EMPLOYEE)).not.toThrow();
    expect(() => assertSelfScopeTarget("all", null, OTHER_EMPLOYEE)).not.toThrow();
  });
});

describe("punchSequenceRefusal (RL-02 alternation against what is stored)", () => {
  it("accepts the first punch of a day in either direction", () => {
    // The tail of an overnight session arrives on its own, beginning with an OUT.
    expect(punchSequenceRefusal(null, ["in"])).toBeNull();
    expect(punchSequenceRefusal(null, ["out"])).toBeNull();
    expect(punchSequenceRefusal("", ["in"])).toBeNull();
  });

  it("refuses a second punch-in when an in is already on file", () => {
    expect(punchSequenceRefusal("in", ["in"])).toBe(
      "You are already punched in. Punch out before punching in again.",
    );
  });

  it("refuses a punch-out when the day's last stored punch is already an out", () => {
    expect(punchSequenceRefusal("out", ["out"])).toBe(
      "You are already punched out. Punch in before punching out again.",
    );
  });

  it("accepts the punch that alternates with the stored tail", () => {
    expect(punchSequenceRefusal("in", ["out"])).toBeNull();
    expect(punchSequenceRefusal("out", ["in"])).toBeNull();
  });

  it("still checks alternation inside a batch, and against the stored tail together", () => {
    expect(punchSequenceRefusal(null, ["in", "out", "in", "out"])).toBeNull();
    expect(punchSequenceRefusal(null, ["in", "in"])).not.toBeNull();
    expect(punchSequenceRefusal("in", ["out", "in", "in"])).not.toBeNull();
    // The batch's own first punch is compared with the stored tail, not just with
    // the punch beside it — this is the two-clicks case.
    expect(punchSequenceRefusal("in", ["in", "out"])).toBe(
      "You are already punched in. Punch out before punching in again.",
    );
  });

  it("reads the stored direction case- and whitespace-insensitively", () => {
    expect(punchSequenceRefusal(" IN ", ["in"])).not.toBeNull();
    expect(punchSequenceRefusal(" IN ", ["OUT"])).toBeNull();
  });
});
