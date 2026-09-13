import { getLeaveEmployees, leaveCalendarPolicy } from "./leave-reference";
import { readData } from "./workspace-data.mjs";
import { dateDay, inclusiveDays } from "../lib/form-validation";
import {
  advanceApproval,
  evaluateCompOffValidity,
  calculateLeaveSpan,
  consumeCompOffFIFO,
  LEAVE_TYPES,
  processEarlyReturn,
} from "./leaveEngine";

export type LeaveActor = {
  id: string;
  employeeId?: string | null;
  role: string;
  name: string;
};
export type LeaveRequest = {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_code: string;
  leave_type_label: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  chargeable_days: number;
  status: string;
  current_approval_tier: string;
  reason: string;
  contact: string;
  applied_at: string;
  version: number;
  approval_history: Array<{
    action: string;
    reviewer: string;
    timestamp: string;
    remarks: string;
  }>;
  comp_allocations?: Array<{ credit_id: string; days: number }>;
  [key: string]: unknown;
};
export type LeaveState = {
  requests: LeaveRequest[];
  balances: Record<
    string,
    Record<string, { available: number; total: number }>
  >;
  credits: Array<{
    id: string;
    employee_id: string;
    credited_at: string;
    days: number;
    remaining_days?: number;
    status: string;
  }>;
  events: Array<{
    id: string;
    requestId: string;
    actor: string;
    action: string;
    from: string;
    to: string;
    at: string;
    remarks: string;
  }>;
};
export type LeaveInput = {
  employee: { id: string; name: string };
  leaveTypeCode: string;
  startDateStr: string;
  endDateStr: string;
  numberOfDays: number;
  reason?: string;
  contact?: string;
};
const balanceKeys: Record<string, string> = {
  PRIVILEGE: "privilege",
  SICK: "sick",
  CASUAL: "casual",
  WELLNESS: "wellness",
  COMP_OFF: "comp_off",
  BIRTHDAY: "birthday",
};
const copy = (key: string) =>
  readData("leave.workflow", "messages")[key] as string;
const fail = (key: string): never => {
  throw new Error(copy(key));
};
const privileged = (actor: LeaveActor) =>
  ["HR_MANAGER", "SUPER_ADMIN"].includes(actor.role);
export function canReviewLeave(actor: LeaveActor, app: LeaveRequest) {
  if (actor.employeeId === app.employee_id) return false;
  if (privileged(actor)) return true;
  const reports = readData("leave.workflow", "reportingManagers") as Record<
    string,
    string
  >;
  return (
    actor.role === "MANAGER" &&
    app.current_approval_tier === "SUPERVISOR" &&
    reports[app.employee_id] === actor.employeeId
  );
}
function ledger(
  state: LeaveState,
  employeeId: string,
  code: string,
  delta: number,
) {
  const key = balanceKeys[code];
  if (!key) return state.balances;
  const accounts = state.balances[employeeId];
  const account = accounts?.[key];
  if (!account) fail("allocation");
  if (account.available + delta < 0) fail("balance");
  return {
    ...state.balances,
    [employeeId]: {
      ...accounts,
      [key]: { ...account, available: account.available + delta },
    },
  };
}
function event(
  state: LeaveState,
  actor: LeaveActor,
  app: LeaveRequest,
  action: string,
  from: string,
  remarks = "",
) {
  return [
    ...state.events,
    {
      id: crypto.randomUUID(),
      requestId: app.id,
      actor: actor.id,
      action,
      from,
      to: app.status,
      at: new Date().toISOString(),
      remarks,
    },
  ];
}
function chargeAllocation(
  days: Array<{ date: string; chargeable: boolean }>,
  quantity: number,
  end: string,
) {
  const allocation: Record<string, number> = {};
  let remaining = quantity;
  for (const day of days) {
    if (!day.chargeable || remaining <= 0) continue;
    const debit = Math.min(1, remaining);
    allocation[day.date] = debit;
    remaining -= debit;
  }
  if (remaining > 0) allocation[end] = (allocation[end] ?? 0) + remaining;
  return allocation;
}
function monthlyUsage(allocation: Record<string, number>) {
  const months: Record<string, number> = {};
  for (const [date, days] of Object.entries(allocation)) {
    const month = date.slice(0, 7);
    months[month] = (months[month] ?? 0) + days;
  }
  return months;
}
export function createLeave(
  state: LeaveState,
  actor: LeaveActor,
  input: LeaveInput,
): LeaveState {
  if (
    !actor?.id ||
    (!privileged(actor) && actor.employeeId !== input.employee.id)
  )
    fail("permission");
  const policy = leaveCalendarPolicy(input.employee.id);
  const days = inclusiveDays(input.startDateStr, input.endDateStr);
  if (days === null || days > policy.maxCalendarDays) fail("date");
  if (!Object.hasOwn(LEAVE_TYPES, input.leaveTypeCode)) fail("type");
  if (LEAVE_TYPES[input.leaveTypeCode].requestable === false)
    fail("eligibility");
  const employee = getLeaveEmployees().find(
    (profile) => profile.employeeId === input.employee.id,
  );
  if (!employee) fail("employee");
  if (employee.active === false || employee.leaveEligible === false)
    fail("eligibility");
  if (employee.joinedOn && input.startDateStr < employee.joinedOn)
    fail("joined");
  const sourceCode = Object.entries(
    readData("leave.workflow", "typeAliases"),
  ).find(([, code]) => code === input.leaveTypeCode)?.[0];
  if (
    employee.band &&
    ["PRIVILEGE", "CASUAL", "SICK", "BIRTHDAY"].includes(input.leaveTypeCode)
  ) {
    const rule = readData("workbook").sheets["15_Leave_Accrual_Policy"].find(
      (row: Record<string, string>) =>
        row["Leave band"] === employee.band && row["Leave type"] === sourceCode,
    );
    if (!rule) fail("band");
    const wait = Number(rule["Eligibility wait (months)"] ?? 0);
    if (wait > 0 && employee.joinedOn) {
      const [year, month, day] = employee.joinedOn.split("-").map(Number);
      const eligibility = new Date(Date.UTC(year, month - 1 + wait, 1));
      const lastDay = new Date(
        Date.UTC(
          eligibility.getUTCFullYear(),
          eligibility.getUTCMonth() + 1,
          0,
        ),
      ).getUTCDate();
      eligibility.setUTCDate(Math.min(day, lastDay));
      if (input.startDateStr < eligibility.toISOString().slice(0, 10))
        fail("waitingPeriod");
    }
  }
  if (
    input.leaveTypeCode === "BIRTHDAY" &&
    (!employee.birthDate ||
      input.startDateStr.slice(5, 7) !== employee.birthDate.slice(5, 7) ||
      input.endDateStr.slice(5, 7) !== employee.birthDate.slice(5, 7))
  )
    fail("birthday");

  if (
    !Number.isFinite(input.numberOfDays) ||
    input.numberOfDays < 0.5 ||
    input.numberOfDays > policy.maxRequestedDays ||
    !Number.isInteger(input.numberOfDays * 2)
  )
    fail("quantity");
  if (
    (input.reason?.length ?? 0) > policy.maxReasonLength ||
    (input.contact?.length ?? 0) > policy.maxContactLength
  )
    fail("length");
  const today = dateDay(new Date().toISOString().slice(0, 10))!;
  const start = dateDay(input.startDateStr)!;
  if (
    today - start > policy.maxBackdatedDays ||
    start - today > policy.maxAdvanceDays
  )
    fail("notice");
  if (
    state.requests.some(
      (app) =>
        app.employee_id === input.employee.id &&
        !["REJECTED", "CANCELLED", "WITHDRAWN"].includes(app.status) &&
        input.startDateStr <= String(app.adjusted_end_date ?? app.end_date) &&
        input.endDateStr >= app.start_date,
    )
  )
    fail("overlap");
  const aliases = readData("leave.workflow", "typeAliases");
  const rule = readData("workbook").sheets["14_Leave_Types"].find(
    (row: Record<string, string>) => row["Leave type"] === sourceCode,
  );
  const incompatible = (rule?.["Cannot be combined with"] ?? "")
    .split(",")
    .map((code: string) => aliases[code.trim()])
    .filter(Boolean);
  for (const request of state.requests) {
    if (
      request.employee_id !== input.employee.id ||
      ["REJECTED", "CANCELLED", "WITHDRAWN"].includes(request.status) ||
      !incompatible.includes(request.leave_type_code)
    )
      continue;
    const oldEnd = dateDay(
      String(request.adjusted_end_date ?? request.end_date),
    );
    const oldStart = dateDay(request.start_date);
    if (oldEnd === null || oldStart === null) continue;
    const newEnd = dateDay(input.endDateStr)!;
    const gapStart = oldEnd < start ? oldEnd + 1 : newEnd + 1;
    const gapEnd = oldEnd < start ? start - 1 : oldStart - 1;
    // Consecutive leave periods, including a bridge containing only non-working days.
    let consecutive = true;
    for (let day = gapStart; day <= gapEnd; day++) {
      const date = new Date(day * 86400000);
      const iso = date.toISOString().slice(0, 10);
      if (
        !policy.weekendDays.includes(date.getUTCDay()) &&
        !policy.holidays.includes(iso)
      ) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) fail("combination");
  }
  const span = calculateLeaveSpan({
    ...input,
    sandwichRuleEnabled: policy.sandwichEnabled,
    holidays: policy.holidays,
    weekendDays: policy.weekendDays,
  });
  // SCR-030 explicitly permits manual quantities above or below the calendar span.
  // An unchanged inclusive value follows the calendar policy; an override is an explicit debit.
  const charge =
    input.numberOfDays === days ? span.chargeable_days : input.numberOfDays;
  if (charge <= 0) fail("nonworking");
  const allocation = chargeAllocation(
    span.days_breakdown,
    charge,
    input.endDateStr,
  );
  const limit = policy.monthlyLimits[input.leaveTypeCode];
  if (limit !== undefined) {
    const totals = monthlyUsage(allocation);
    for (const request of state.requests) {
      if (
        request.employee_id !== input.employee.id ||
        request.leave_type_code !== input.leaveTypeCode ||
        ["REJECTED", "CANCELLED", "WITHDRAWN"].includes(request.status)
      )
        continue;
      const prior = monthlyUsage(
        (request.charge_allocations as Record<string, number>) ?? {
          [request.start_date]: request.chargeable_days,
        },
      );
      for (const month of Object.keys(totals))
        totals[month] += prior[month] ?? 0;
    }
    if (Object.values(totals).some((days) => days > limit))
      fail("monthlyLimit");
  }

  let credits = state.credits;
  let allocations: LeaveRequest["comp_allocations"];
  if (input.leaveTypeCode === "COMP_OFF") {
    const used = new Map<string, number>();
    const todayISO = new Date().toISOString().slice(0, 10);
    for (const [date, debit] of Object.entries(allocation).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      // A grant must already exist and remain valid on the actual debit date.
      const result = consumeCompOffFIFO(
        credits.filter(
          (c) =>
            c.employee_id === input.employee.id &&
            c.credited_at <= todayISO &&
            c.credited_at <= date,
        ),
        debit,
        date > todayISO ? date : todayISO,
      );
      if (!result.success) fail("creditDate");
      const changed = new Map(result.updated_credits!.map((c) => [c.id, c]));
      credits = credits.map((c) => changed.get(c.id) ?? c);
      for (const item of result.allocations!)
        used.set(item.credit_id, (used.get(item.credit_id) ?? 0) + item.days);
    }
    allocations = Array.from(used, ([credit_id, days]) => ({
      credit_id,
      days,
    }));
  }
  const app: LeaveRequest = {
    ...span,
    id: crypto.randomUUID(),
    employee_id: input.employee.id,
    employee_name: employee.name,
    leave_type_code: input.leaveTypeCode,
    leave_type_label: LEAVE_TYPES[input.leaveTypeCode].label,
    start_date: input.startDateStr,
    end_date: input.endDateStr,
    duration_days: input.numberOfDays,
    chargeable_days: charge,
    status: "PENDING_SUPERVISOR",
    current_approval_tier: "SUPERVISOR",
    reason: input.reason?.trim() ?? "",
    contact: input.contact?.trim() ?? "",
    applied_at: new Date().toISOString(),
    version: 1,
    approval_history: [],
    charge_allocations: allocation,
    calendar_policy: {
      holidays: policy.holidays,
      weekendDays: policy.weekendDays,
    },
    comp_allocations: allocations,
  };
  return {
    ...state,
    credits,
    balances: ledger(state, app.employee_id, app.leave_type_code, -charge),
    requests: [app, ...state.requests],
    events: event(state, actor, app, "SUBMITTED", ""),
  };
}
export function decideLeave(
  state: LeaveState,
  actor: LeaveActor,
  id: string,
  action: string,
  remarks = "",
  expectedVersion?: number,
): LeaveState {
  const app = state.requests.find((request) => request.id === id);
  if (!app) fail("missing");
  if (
    app.leave_type_code !== "LOP" &&
    !state.balances[app.employee_id]?.[balanceKeys[app.leave_type_code]]
  )
    fail("allocation");
  if (app.reference_only) fail("reference");
  if (expectedVersion !== undefined && expectedVersion !== app.version)
    fail("stale");
  let updated: LeaveRequest;
  if (action === "WITHDRAW" || action === "CANCEL") {
    if (!privileged(actor) && actor.employeeId !== app.employee_id)
      fail("permission");
    if (
      action === "WITHDRAW"
        ? !app.status.startsWith("PENDING_")
        : app.status !== "APPROVED"
    )
      fail("status");
    if (
      action === "CANCEL" &&
      app.start_date < new Date().toISOString().slice(0, 10)
    )
      fail("earlyReturn");
    updated = {
      ...app,
      status: action === "CANCEL" ? "CANCELLED" : "WITHDRAWN",
      approval_history: [
        ...app.approval_history,
        {
          action,
          reviewer: actor.name,
          timestamp: new Date().toISOString(),
          remarks: remarks.trim(),
        },
      ],
    };
  } else {
    if (!canReviewLeave(actor, app)) fail("permission");
    updated = advanceApproval({
      application: app,
      approverRole: app.current_approval_tier,
      action,
      remarks,
      reviewerName: actor.name,
    }) as LeaveRequest;
  }
  updated.version = (app.version ?? 0) + 1;
  const restore = ["REJECTED", "CANCELLED", "WITHDRAWN"].includes(
    updated.status,
  );
  const balances = restore
    ? ledger(state, app.employee_id, app.leave_type_code, app.chargeable_days)
    : state.balances;
  const credits = restore
    ? state.credits.map((credit) => {
        const allocation = app.comp_allocations?.find(
          (item) => item.credit_id === credit.id,
        );
        return allocation
          ? {
              ...credit,
              remaining_days: (credit.remaining_days ?? 0) + allocation.days,
              status: "ACTIVE",
            }
          : credit;
      })
    : state.credits;
  return {
    ...state,
    balances,
    credits,
    requests: state.requests.map((item) => (item.id === id ? updated : item)),
    events: event(state, actor, updated, action, app.status, remarks.trim()),
  };
}
export function returnFromLeave(
  state: LeaveState,
  actor: LeaveActor,
  id: string,
  date: string,
): LeaveState {
  const app = state.requests.find((request) => request.id === id);
  if (!app) fail("missing");
  if (!privileged(actor)) fail("permission");
  if (app.reference_only) fail("reference");
  const result = processEarlyReturn({
    application: app,
    actualReturnDateStr: date,
    currentBalance:
      state.balances[app.employee_id]?.[balanceKeys[app.leave_type_code]]
        ?.available ?? 0,
  });
  const remainingDays =
    (
      app.days_breakdown as
        | Array<{ date: string; chargeable: boolean }>
        | undefined
    )?.filter((day) => day.date < date) ?? [];
  const updated = {
    ...result.updated_application,
    charge_allocations: chargeAllocation(
      remainingDays,
      result.updated_application.chargeable_days,
      String(result.updated_application.adjusted_end_date),
    ),
    version: (app.version ?? 0) + 1,
  } as LeaveRequest;
  let refund = result.days_recredited;
  const restored = new Map<string, number>();
  for (const allocation of [...(app.comp_allocations ?? [])].reverse()) {
    const amount = Math.min(refund, allocation.days);
    restored.set(allocation.credit_id, amount);
    refund -= amount;
  }
  if (app.leave_type_code === "COMP_OFF" && refund > 0) fail("allocation");
  const credits = state.credits.map((credit) =>
    restored.has(credit.id)
      ? {
          ...credit,
          remaining_days:
            (credit.remaining_days ?? 0) + restored.get(credit.id)!,
          status: "ACTIVE",
        }
      : credit,
  );
  return {
    ...state,
    credits,
    balances: ledger(
      state,
      app.employee_id,
      app.leave_type_code,
      result.days_recredited,
    ),
    requests: state.requests.map((item) => (item.id === id ? updated : item)),
    events: event(state, actor, updated, "EARLY_RETURN", app.status, date),
  };
}
function normalizeCompOff(state: LeaveState): LeaveState {
  const balances = { ...state.balances };
  let credits: LeaveState["credits"] = [];
  for (const employeeId of new Set(
    state.credits.map((credit) => credit.employee_id),
  )) {
    const result = evaluateCompOffValidity(
      state.credits.filter((credit) => credit.employee_id === employeeId),
    );
    credits = [...credits, ...result.credits];
    balances[employeeId] = {
      ...balances[employeeId],
      comp_off: {
        available: result.active_balance,
        total: result.credits.reduce((sum, credit) => sum + credit.days, 0),
      },
    };
  }
  return { ...state, credits, balances };
}
/** A single serialized in-memory adapter. Replace this port with authenticated HTTP after backend approval. */
export function createLeavePreviewService(initial: LeaveState) {
  let state = normalizeCompOff(structuredClone(initial));
  let queue = Promise.resolve();
  return {
    snapshot: () => state,
    execute(
      operation: (current: LeaveState) => LeaveState,
    ): Promise<LeaveState> {
      const next = queue.then(() => {
        state = normalizeCompOff(operation(normalizeCompOff(state)));
        return state;
      });
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

/** Audited preview allocation/correction; never silently replaces an account's used balance. */
export function adjustLeaveBalance(
  state: LeaveState,
  actor: LeaveActor,
  employeeId: string,
  code: string,
  days: number,
  reason: string,
): LeaveState {
  if (!privileged(actor)) fail("permission");
  const profiles = getLeaveEmployees();
  const employee = profiles.find(
    (profile) => profile.employeeId === employeeId,
  );
  if (!employee) fail("missing");
  if (code === "BIRTHDAY" && !employee.birthDate) fail("birthday");
  const key = balanceKeys[code];
  if (!Object.hasOwn(balanceKeys, code) || !key || code === "COMP_OFF")
    fail("allocationType");
  if (
    !Number.isFinite(days) ||
    days === 0 ||
    Math.abs(days) > 366 ||
    !Number.isInteger(days * 2)
  )
    fail("adjustment");
  if (!reason.trim() || reason.length > 2000) fail("adjustmentReason");
  const account = state.balances[employeeId]?.[key] ?? {
    available: 0,
    total: 0,
  };
  if (account.available + days < 0 || account.total + days < 0) fail("balance");
  const balances = {
    ...state.balances,
    [employeeId]: {
      ...state.balances[employeeId],
      [key]: {
        available: account.available + days,
        total: account.total + days,
      },
    },
  };
  return {
    ...state,
    balances,
    events: [
      ...state.events,
      {
        id: crypto.randomUUID(),
        requestId: `balance:${employeeId}:${code}`,
        actor: actor.id,
        action: "BALANCE_ADJUSTED",
        from: String(account.available),
        to: String(account.available + days),
        at: new Date().toISOString(),
        remarks: reason.trim(),
      },
    ],
  };
}
