import { getLeaveEmployees } from "./leave-reference";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
import {
  createLeave,
  adjustLeaveBalance,
  decideLeave,
  returnFromLeave,
  createLeavePreviewService,
  type LeaveState,
  type LeaveActor,
} from "./leave-workflow";
import {
  calculateLeaveSpan,
  consumeCompOffFIFO,
  evaluateCompOffValidity,
  advanceApproval,
} from "./leaveEngine";
const employee: LeaveActor = {
  id: "MK-107",
  employeeId: "MK-107",
  name: "Employee",
  role: "EMPLOYEE",
};
const hr: LeaveActor = {
  id: "MK-102",
  employeeId: "MK-102",
  name: "HR",
  role: "HR_MANAGER",
};
const manager: LeaveActor = {
  id: "MK-104",
  employeeId: "MK-104",
  name: "Manager",
  role: "MANAGER",
};
const input = {
  employee: { id: "MK-107", name: "Employee" },
  leaveTypeCode: "SICK",
  startDateStr: "2026-09-14",
  endDateStr: "2026-09-15",
  numberOfDays: 1.5,
};
const initial = (): LeaveState => ({
  requests: [],
  credits: [],
  events: [],
  balances: {
    "MK-107": {
      sick: { available: 8, total: 10 },
      casual: { available: 8, total: 12 },
      wellness: { available: 3, total: 4 },
      privilege: { available: 10, total: 18 },
    },
  },
});
describe("leave calendar and credit rules", () => {
  it.each(["", "2026-02-30", "not-a-date"])(
    "rejects invalid calendar date %s",
    (date) => {
      expect(() =>
        calculateLeaveSpan({ startDateStr: date, endDateStr: "2026-09-15" }),
      ).toThrow();
    },
  );
  it("retains exact ISO dates in positive UTC offsets and applies only intervening weekends", () => {
    const span = calculateLeaveSpan({
      startDateStr: "2026-09-11",
      endDateStr: "2026-09-14",
    });
    expect(span.days_breakdown.map((d) => d.date)).toEqual([
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
    expect(span.chargeable_days).toBe(4);
    expect(
      calculateLeaveSpan({
        startDateStr: "2026-09-12",
        endDateStr: "2026-09-14",
      }).chargeable_days,
    ).toBe(1);
  });
  it("excludes configured holidays and non-sandwich weekends", () => {
    expect(
      calculateLeaveSpan({
        startDateStr: "2026-09-11",
        endDateStr: "2026-09-15",
        leaveTypeCode: "SICK",
        holidays: ["2026-09-14"],
      }).chargeable_days,
    ).toBe(2);
  });
  it("consumes oldest credits first and preserves half-day remainder", () => {
    const credits = [
      { id: "new", credited_at: "2026-09-10", days: 1, status: "ACTIVE" },
      { id: "old", credited_at: "2026-09-01", days: 2, status: "ACTIVE" },
    ];
    const result = consumeCompOffFIFO(credits, 1.5, "2026-09-13");
    expect(result.allocations).toEqual([{ credit_id: "old", days: 1.5 }]);
    expect(
      result.updated_credits?.find((c) => c.id === "old")?.remaining_days,
    ).toBe(0.5);
    expect(
      evaluateCompOffValidity(result.updated_credits, "2026-09-13")
        .active_balance,
    ).toBe(1.5);
  });
  it("expires credits at the boundary and excludes future credits", () => {
    expect(
      evaluateCompOffValidity(
        [
          { id: "x", credited_at: "2026-07-15", days: 1, status: "ACTIVE" },
          { id: "y", credited_at: "2026-09-14", days: 1, status: "ACTIVE" },
        ],
        "2026-09-13",
      ).active_balance,
    ).toBe(0);
  });
  it.each([0, -1, 0.25, NaN, Infinity])(
    "rejects invalid comp-off quantity %s",
    (quantity) => expect(() => consumeCompOffFIFO([], quantity)).toThrow(),
  );
});
describe("atomic leave workflow", () => {
  it("reserves fractional balances, preserves optional fields and stores an event", () => {
    const state = createLeave(initial(), employee, input);
    expect(state.balances["MK-107"].sick.available).toBe(6.5);
    expect(state.requests[0].contact).toBe("");
    expect(state.events).toHaveLength(1);
  });
  it("does not mutate the input on failure", () => {
    const state = initial();
    expect(() =>
      createLeave(state, employee, { ...input, numberOfDays: 20 }),
    ).toThrow();
    expect(state.requests).toEqual([]);
    expect(state.balances["MK-107"].sick.available).toBe(8);
  });
  it("allows explicit half-day override above date span", () => {
    expect(
      createLeave(initial(), employee, { ...input, numberOfDays: 2.5 })
        .requests[0].chargeable_days,
    ).toBe(2.5);
  });
  it("rejects overlaps regardless of leave type", () => {
    const state = createLeave(initial(), employee, input);
    expect(() =>
      createLeave(state, employee, { ...input, leaveTypeCode: "CASUAL" }),
    ).toThrow(/overlapping/);
  });
  it("sequences all three approvals and refuses stale repeated actions", () => {
    let state = createLeave(initial(), employee, input);
    const id = state.requests[0].id;
    state = decideLeave(state, manager, id, "APPROVE", "", 1);
    expect(state.requests[0].status).toBe("PENDING_HOD");
    expect(() => decideLeave(state, hr, id, "APPROVE", "", 1)).toThrow(
      /changed/,
    );
    expect(() => decideLeave(state, manager, id, "APPROVE")).toThrow();
    state = decideLeave(state, hr, id, "APPROVE");
    state = decideLeave(state, hr, id, "APPROVE");
    expect(state.requests[0].status).toBe("APPROVED");
    expect(state.requests[0].approval_history).toHaveLength(3);
    expect(() => decideLeave(state, hr, id, "APPROVE")).toThrow();
  });
  it("blocks self approval and direct tier bypass", () => {
    const state = createLeave(initial(), employee, input);
    expect(() =>
      decideLeave(state, employee, state.requests[0].id, "APPROVE"),
    ).toThrow();
    expect(() =>
      advanceApproval({
        application: state.requests[0],
        approverRole: "HR_HEAD",
        action: "APPROVE",
      }),
    ).toThrow();
  });
  it("requires rejection remarks and restores the exact type once", () => {
    let state = createLeave(initial(), employee, {
      ...input,
      leaveTypeCode: "WELLNESS",
    });
    const id = state.requests[0].id;
    expect(() => decideLeave(state, hr, id, "REJECT", "   ")).toThrow();
    state = decideLeave(state, hr, id, "REJECT", "Policy review");
    expect(state.balances["MK-107"].wellness.available).toBe(3);
    expect(state.balances["MK-107"].sick.available).toBe(8);
    expect(() => decideLeave(state, hr, id, "REJECT", "Again")).toThrow();
  });
  it("withdraws pending requests and releases overlap reservation", () => {
    let state = createLeave(initial(), employee, input);
    state = decideLeave(state, employee, state.requests[0].id, "WITHDRAW");
    expect(state.balances["MK-107"].sick.available).toBe(8);
    expect(createLeave(state, employee, input).requests).toHaveLength(2);
  });
  it("never debits unrelated balances for unpaid leave", () => {
    const state = createLeave(initial(), employee, {
      ...input,
      leaveTypeCode: "LOP",
      numberOfDays: 5,
    });
    expect(state.balances).toEqual(initial().balances);
  });
  it("rejects foreign employee submissions and unknown accounts", () => {
    expect(() =>
      createLeave(initial(), employee, {
        ...input,
        employee: { id: "other", name: "Other" },
      }),
    ).toThrow();
    expect(() =>
      createLeave(initial(), hr, {
        ...input,
        employee: { id: "other", name: "Other" },
      }),
    ).toThrow(/identity/);
  });
  it("recredits early return to the actual leave type once", () => {
    let state = createLeave(initial(), employee, { ...input, numberOfDays: 2 });
    const id = state.requests[0].id;
    for (let i = 0; i < 3; i++) state = decideLeave(state, hr, id, "APPROVE");
    state = returnFromLeave(state, hr, id, "2026-09-15");
    expect(state.balances["MK-107"].sick.available).toBe(7);
    expect(state.balances["MK-107"].privilege.available).toBe(10);
    expect(() => returnFromLeave(state, hr, id, "2026-09-15")).toThrow();
  });
  it("serializes concurrent duplicate submissions and continues after failure", async () => {
    const service = createLeavePreviewService(initial());
    const results = await Promise.allSettled([
      service.execute((s) => createLeave(s, employee, input)),
      service.execute((s) => createLeave(s, employee, input)),
    ]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(service.snapshot().requests).toHaveLength(1);
    await service.execute((s) =>
      decideLeave(s, employee, s.requests[0].id, "WITHDRAW"),
    );
    expect(service.snapshot().balances["MK-107"].sick.available).toBe(8);
  });
});

describe("audited balance allocation", () => {
  it("allows HR half-day adjustments and records a reason", () => {
    const state = adjustLeaveBalance(
      initial(),
      hr,
      "MK-107",
      "SICK",
      0.5,
      "Allocation correction",
    );
    expect(state.balances["MK-107"].sick.available).toBe(8.5);
    expect(state.balances["MK-107"].sick.total).toBe(10.5);
    expect(state.events[0].remarks).toBe("Allocation correction");
  });
  it("rejects employee adjustments, empty reasons and negative availability", () => {
    expect(() =>
      adjustLeaveBalance(
        initial(),
        employee,
        "MK-107",
        "SICK",
        1,
        "Correction",
      ),
    ).toThrow();
    expect(() =>
      adjustLeaveBalance(initial(), hr, "MK-107", "SICK", 1, "  "),
    ).toThrow();
    expect(() =>
      adjustLeaveBalance(initial(), hr, "MK-107", "SICK", -9, "Correction"),
    ).toThrow();
  });
});

describe("leave boundary regressions", () => {
  it("rejects prototype property names as leave types", () => {
    expect(() =>
      createLeave(initial(), employee, {
        ...input,
        leaveTypeCode: "__proto__",
      }),
    ).toThrow();
    expect(() =>
      calculateLeaveSpan({
        startDateStr: "2026-09-14",
        endDateStr: "2026-09-15",
        leaveTypeCode: "constructor",
      }),
    ).toThrow();
  });
  it("requires a known employee even for unpaid requests", () => {
    expect(() =>
      createLeave(initial(), hr, {
        ...input,
        employee: { id: "unknown", name: "Unknown" },
        leaveTypeCode: "LOP",
      }),
    ).toThrow(/identity/);
  });
  it("returns fractional comp-off to the consumed grant without extending expiry", () => {
    let state = initial();
    state.balances["MK-107"].comp_off = { available: 2, total: 2 };
    state.credits = [
      {
        id: "credit",
        employee_id: "MK-107",
        credited_at: "2026-09-10",
        days: 2,
        status: "ACTIVE",
      },
    ];
    state = createLeave(state, employee, {
      ...input,
      leaveTypeCode: "COMP_OFF",
      numberOfDays: 1.5,
    });
    const id = state.requests[0].id;
    for (let i = 0; i < 3; i++) state = decideLeave(state, hr, id, "APPROVE");
    state = returnFromLeave(state, hr, id, "2026-09-15");
    expect(state.balances["MK-107"].comp_off.available).toBe(1);
    expect(state.credits[0].remaining_days).toBe(1);
    expect(state.credits[0].credited_at).toBe("2026-09-10");
  });
});

describe("workbook monthly policies", () => {
  it("enforces the two-day casual limit before reservation", () => {
    expect(() =>
      createLeave(initial(), employee, {
        ...input,
        leaveTypeCode: "CASUAL",
        numberOfDays: 2.5,
      }),
    ).toThrow(/monthly limit/);
  });
  it("accounts for prior non-overlapping requests in the same month", () => {
    const state = createLeave(initial(), employee, {
      ...input,
      leaveTypeCode: "CASUAL",
      numberOfDays: 1.5,
    });
    expect(() =>
      createLeave(state, employee, {
        ...input,
        leaveTypeCode: "CASUAL",
        startDateStr: "2026-09-17",
        endDateStr: "2026-09-17",
        numberOfDays: 1,
      }),
    ).toThrow(/monthly limit/);
  });
  it("splits month-crossing debits by chargeable dates", () => {
    const state = createLeave(initial(), employee, {
      ...input,
      leaveTypeCode: "CASUAL",
      startDateStr: "2026-01-29",
      endDateStr: "2026-02-03",
      numberOfDays: 6,
    });
    expect(state.requests[0].chargeable_days).toBe(4);
    expect(state.requests[0].charge_allocations).toEqual({
      "2026-01-29": 1,
      "2026-01-30": 1,
      "2026-02-02": 1,
      "2026-02-03": 1,
    });
  });
  it.each(["BIRTHDAY", "MATERNITY"])(
    "retains %s but blocks it until eligibility is configured",
    (leaveTypeCode) => {
      expect(() =>
        createLeave(initial(), employee, { ...input, leaveTypeCode }),
      ).toThrow(/eligibility/);
    },
  );
});

describe("workbook employee boundary", () => {
  it("requires a leave-eligible worker class even when an account is funded", () => {
    const record = getLeaveEmployees().find(
      (item) => item.leaveEligible === false,
    )!;
    const state = initial();
    state.balances[record.employeeId] = { sick: { available: 8, total: 8 } };
    expect(() =>
      createLeave(state, hr, {
        ...input,
        employee: { id: record.employeeId, name: "Injected name" },
      }),
    ).toThrow(/eligibility/);
  });
  it("keeps historical reference requests read-only after an account is allocated", () => {
    const state = createLeave(initial(), employee, input);
    state.requests[0].reference_only = true;
    expect(() =>
      decideLeave(state, hr, state.requests[0].id, "APPROVE"),
    ).toThrow(/reconciliation/);
  });
});

describe("birthday entitlement", () => {
  it("uses the source birth month and canonical employee name", () => {
    const state = initial();
    state.balances["E1002"] = { birthday: { available: 1, total: 1 } };
    const result = createLeave(state, hr, {
      ...input,
      employee: { id: "E1002", name: "Untrusted name" },
      leaveTypeCode: "BIRTHDAY",
      startDateStr: "2026-09-04",
      endDateStr: "2026-09-04",
      numberOfDays: 1,
    });
    expect(result.requests[0].employee_name).toBe("Meenakshi Sundaram");
    expect(result.balances["E1002"].birthday.available).toBe(0);
    expect(() =>
      createLeave(state, hr, {
        ...input,
        employee: { id: "E1002", name: "Untrusted name" },
        leaveTypeCode: "BIRTHDAY",
        startDateStr: "2026-10-01",
        endDateStr: "2026-10-01",
        numberOfDays: 1,
      }),
    ).toThrow(/birth month/);
  });
});

describe("source leave eligibility and combinations", () => {
  it("blocks earned leave before the six-month anniversary even when funded", () => {
    const state = initial();
    state.balances["E1067"] = { privilege: { available: 18, total: 18 } };
    expect(() =>
      createLeave(state, hr, {
        ...input,
        employee: { id: "E1067", name: "Source employee" },
        leaveTypeCode: "PRIVILEGE",
        startDateStr: "2026-09-15",
        endDateStr: "2026-09-15",
        numberOfDays: 1,
      }),
    ).toThrow(/waiting period/);
    expect(
      createLeave(state, hr, {
        ...input,
        employee: { id: "E1067", name: "Source employee" },
        leaveTypeCode: "PRIVILEGE",
        startDateStr: "2026-09-16",
        endDateStr: "2026-09-16",
        numberOfDays: 1,
      }).requests,
    ).toHaveLength(1);
  });
  it.each(["SICK", "PRIVILEGE"])(
    "rejects adjacent casual and %s requests in either order",
    (code) => {
      const casual = {
        ...input,
        leaveTypeCode: "CASUAL",
        startDateStr: "2026-09-14",
        endDateStr: "2026-09-14",
        numberOfDays: 1,
      };
      const other = {
        ...input,
        leaveTypeCode: code,
        startDateStr: "2026-09-15",
        endDateStr: "2026-09-15",
        numberOfDays: 1,
      };
      expect(() =>
        createLeave(createLeave(initial(), employee, casual), employee, other),
      ).toThrow(/combined/);
      expect(() =>
        createLeave(createLeave(initial(), employee, other), employee, casual),
      ).toThrow(/combined/);
    },
  );
  it("ignores withdrawn periods and allows a working-day separation", () => {
    const casual = {
      ...input,
      leaveTypeCode: "CASUAL",
      startDateStr: "2026-09-14",
      endDateStr: "2026-09-14",
      numberOfDays: 1,
    };
    let state = createLeave(initial(), employee, casual);
    expect(
      createLeave(state, employee, {
        ...input,
        startDateStr: "2026-09-16",
        endDateStr: "2026-09-16",
        numberOfDays: 1,
      }).requests,
    ).toHaveLength(2);
    state = decideLeave(state, employee, state.requests[0].id, "WITHDRAW");
    expect(
      createLeave(state, employee, {
        ...input,
        startDateStr: "2026-09-15",
        endDateStr: "2026-09-15",
        numberOfDays: 1,
      }).requests,
    ).toHaveLength(2);
  });
  it("does not allow an excluded combination across a non-working bridge", () => {
    const state = createLeave(initial(), employee, {
      ...input,
      leaveTypeCode: "CASUAL",
      startDateStr: "2026-09-11",
      endDateStr: "2026-09-11",
      numberOfDays: 1,
    });
    expect(() =>
      createLeave(state, employee, {
        ...input,
        startDateStr: "2026-09-14",
        endDateStr: "2026-09-14",
        numberOfDays: 1,
      }),
    ).toThrow(/combined/);
  });
});

describe("comp-off debit-date validity", () => {
  it("rejects a future absence after the grant expiry without consuming the original credit", () => {
    const state = initial();
    state.balances["MK-107"].comp_off = { available: 2, total: 2 };
    state.credits = [
      {
        id: "old",
        employee_id: "MK-107",
        credited_at: "2026-07-20",
        days: 2,
        status: "ACTIVE",
      },
    ];
    expect(() =>
      createLeave(state, employee, {
        ...input,
        leaveTypeCode: "COMP_OFF",
        startDateStr: "2026-09-21",
        endDateStr: "2026-09-21",
        numberOfDays: 1,
      }),
    ).toThrow(/remain valid/);
    expect(state.credits[0].remaining_days).toBeUndefined();
  });
  it("can use an expiring credit on the first day and a later grant on the next day", () => {
    const state = initial();
    state.balances["MK-107"].comp_off = { available: 2, total: 2 };
    state.credits = [
      {
        id: "old",
        employee_id: "MK-107",
        credited_at: "2026-07-17",
        days: 1,
        status: "ACTIVE",
      },
      {
        id: "new",
        employee_id: "MK-107",
        credited_at: "2026-09-10",
        days: 1,
        status: "ACTIVE",
      },
    ];
    const result = createLeave(state, employee, {
      ...input,
      leaveTypeCode: "COMP_OFF",
      numberOfDays: 2,
    });
    expect(result.requests[0].comp_allocations).toEqual([
      { credit_id: "old", days: 1 },
      { credit_id: "new", days: 1 },
    ]);
  });
});
