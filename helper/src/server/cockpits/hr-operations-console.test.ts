import { describe, expect, it } from "vitest";
import {
  WEEKDAY_LABELS,
  absenceMatrix,
  onboardingFunnel,
  queueAgeDays,
  slaState,
  sortByAgeing,
  weekStart,
  type ApprovalItem,
} from "./hr-operations-console";
import type { JoiningChainRow } from "@/server/lifecycle/joining-chain";

function chain(overrides: Partial<JoiningChainRow>): JoiningChainRow {
  return {
    id: "instance-1",
    employee_id: "employee-1",
    employee_code: "E-1",
    employee_name: "A Joiner",
    department: "Spinning",
    location: "Unit 1",
    template_name: "Standard onboarding",
    joining_date: "2026-09-01",
    joining_deviation_reason: null,
    offer_id: null,
    candidate_id: null,
    owner: "People Ops",
    total: 6,
    done: 6,
    required_pending: 0,
    readiness: "Completed",
    status: "ready",
    ...overrides,
  };
}

function item(overrides: Partial<ApprovalItem>): ApprovalItem {
  return {
    id: "tickets:1",
    queue: "HR helpdesk",
    type: "Payroll",
    requester: "A Requester",
    reference: "Payslip query",
    status: "Open",
    createdAt: "2026-09-01",
    ageDays: 14,
    dueOn: "2026-09-10",
    dueBasis: "Due date on the record",
    sla: "breached",
    href: "/helpdesk",
    ...overrides,
  };
}

describe("queueAgeDays", () => {
  it("counts whole days since the record was created", () => {
    expect(queueAgeDays("2026-09-01", "2026-09-15")).toBe(14);
    expect(queueAgeDays("2026-09-15T08:30:00.000Z", "2026-09-15")).toBe(0);
  });

  it("returns null when the source records no creation time", () => {
    expect(queueAgeDays(null, "2026-09-15")).toBeNull();
    expect(queueAgeDays("", "2026-09-15")).toBeNull();
    expect(queueAgeDays("not-a-date", "2026-09-15")).toBeNull();
  });

  it("never reports a negative age for a future-dated record", () => {
    expect(queueAgeDays("2026-10-01", "2026-09-15")).toBe(0);
  });
});

describe("slaState", () => {
  it("reads the verdict off the date the record itself carries", () => {
    expect(slaState("2026-09-14", "2026-09-15")).toBe("breached");
    expect(slaState("2026-09-15", "2026-09-15")).toBe("due_today");
    expect(slaState("2026-09-16", "2026-09-15")).toBe("within");
  });

  it("reports unknown rather than on-track when no commitment date exists", () => {
    expect(slaState(null, "2026-09-15")).toBe("unknown");
    expect(slaState("", "2026-09-15")).toBe("unknown");
  });
});

describe("sortByAgeing", () => {
  it("puts the oldest aged item first", () => {
    const sorted = sortByAgeing([item({ id: "a", ageDays: 3 }), item({ id: "b", ageDays: 21 }), item({ id: "c", ageDays: 9 })]);
    expect(sorted.map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("sinks items with no recorded age below every aged item", () => {
    const sorted = sortByAgeing([
      item({ id: "leave:1", ageDays: null, requester: "Zoe" }),
      item({ id: "leave:2", ageDays: null, requester: "Ana" }),
      item({ id: "tickets:1", ageDays: 1 }),
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["tickets:1", "leave:2", "leave:1"]);
  });
});

describe("onboardingFunnel", () => {
  it("produces strictly nested stages so conversion can never exceed 100%", () => {
    const stages = onboardingFunnel([
      chain({ id: "1" }),
      chain({ id: "2", status: "in_progress", done: 3, required_pending: 2 }),
      chain({ id: "3", status: "not_started", total: 0, done: 0, required_pending: 0 }),
      chain({ id: "4", status: "blocked", done: 6, required_pending: 0 }),
    ]);
    expect(stages).toEqual([
      { label: "Onboarding raised", value: 4 },
      { label: "Tasks assigned", value: 3 },
      { label: "Tasks under way", value: 3 },
      { label: "Required steps cleared", value: 2 },
      { label: "Day-1 ready", value: 1 },
    ]);
    for (let index = 1; index < stages.length; index += 1) {
      expect(stages[index].value).toBeLessThanOrEqual(stages[index - 1].value);
    }
  });

  it("returns nothing at all rather than a funnel of zeros", () => {
    expect(onboardingFunnel([])).toEqual([]);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the containing ISO week", () => {
    expect(weekStart("2026-09-15")).toBe("2026-09-14"); // Tuesday -> Monday
    expect(weekStart("2026-09-14")).toBe("2026-09-14"); // Monday stays put
    expect(weekStart("2026-09-13")).toBe("2026-09-07"); // Sunday belongs to the prior week
  });
});

describe("absenceMatrix", () => {
  it("lays person-days out by week and weekday", () => {
    const matrix = absenceMatrix([{ startsOn: "2026-09-14", endsOn: "2026-09-15" }], "2026-09-15", 2);
    expect(matrix.columns).toEqual([...WEEKDAY_LABELS]);
    expect(matrix.rows).toHaveLength(2);
    const currentWeek = matrix.values[1];
    expect(currentWeek?.[0]).toBe(1); // Monday
    expect(currentWeek?.[1]).toBe(1); // Tuesday
    expect(currentWeek?.[2]).toBe(0); // Wednesday, inside the window and genuinely empty
  });

  it("counts a person-day once per overlapping span", () => {
    const matrix = absenceMatrix(
      [
        { startsOn: "2026-09-14", endsOn: "2026-09-14" },
        { startsOn: "2026-09-14", endsOn: "2026-09-14" },
      ],
      "2026-09-15",
      1,
    );
    expect(matrix.values[0][0]).toBe(2);
  });

  it("returns an empty matrix when nothing falls inside the window", () => {
    expect(absenceMatrix([{ startsOn: "2020-01-01", endsOn: "2020-01-02" }], "2026-09-15", 4)).toEqual({
      rows: [],
      columns: [],
      values: [],
    });
    expect(absenceMatrix([{ startsOn: null, endsOn: null }], "2026-09-15", 4).rows).toEqual([]);
  });

  it("never counts a day after today", () => {
    const matrix = absenceMatrix([{ startsOn: "2026-09-14", endsOn: "2026-09-20" }], "2026-09-15", 1);
    expect(matrix.values[0]).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });
});
