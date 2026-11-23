"use client";

import useSWR, { type SWRConfiguration } from "swr";

/**
 * Reads and writes for the redesigned attendance module. Every call goes to an existing
 * /api/v1 route (plus the additive POST /api/v1/gate-passes/register); nothing is synthesised.
 * A failed request surfaces the API's own message, never empty data.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readBody(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details: Array<{ field: string; issue: string }> = body?.error?.details ?? [];
    const message = body?.error?.message ?? body?.error ?? (response.status === 403 ? "You do not have access to this." : fallback);
    throw new ApiError(details.length ? `${message} ${details.map((detail) => detail.issue).join(" ")}` : String(message), response.status);
  }
  return body;
}

export async function getJson<T>(url: string): Promise<T> {
  return readBody(await fetch(url, { cache: "no-store", credentials: "same-origin" }), "The information could not be loaded.") as Promise<T>;
}

export async function postJson<T = unknown>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
  return readBody(response, "The change could not be saved.") as Promise<T>;
}

const options: SWRConfiguration = { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true };
const list = <T,>(url: string) => getJson<{ data: T[] }>(url).then((body) => body.data);

/* ------------------------------------------------------------------ */
/* Who is looking                                                      */
/* ------------------------------------------------------------------ */

export type Viewer = { employeeId: string | null; permissions: string[]; roles: string[] };

/** Roles whose attendance scope is the whole organisation (src/server/attendance/service.ts). */
const TENANT_WIDE = new Set(["owner", "super-admin", "hr-manager", "time-office", "payroll-admin"]);

export function viewerAccess(viewer: Viewer | undefined) {
  const has = (key: string) => Boolean(viewer?.permissions.includes(key));
  const roles = new Set(viewer?.roles ?? []);
  const tenantWide = [...roles].some((role) => TENANT_WIDE.has(role)) || has("tenant.manage") || has("membership.manage");
  return {
    /** Approve, reject, lock, recompute: the API checks attendance.write. */
    canDecide: has("attendance.write"),
    /** Raising a request also needs attendance.write today (see ATTENDANCE.md, known issues). */
    canRequest: has("attendance.write"),
    selfOnlyRequests: !has("attendance.write") && has("attendance.self.write"),
    /** Team views: the organisation (HR, time office) or a manager's reporting line. */
    seesTeam: tenantWide || roles.has("manager"),
    tenantWide,
  };
}

export function useViewer() {
  return useSWR("/api/v1/identity/context", async (url: string) => {
    const body = await getJson<{ context?: { employeeId?: string | null; permissions?: string[]; roles?: string[] } }>(url);
    return { employeeId: body.context?.employeeId ?? null, permissions: [...(body.context?.permissions ?? [])], roles: [...(body.context?.roles ?? [])] } satisfies Viewer;
  }, options);
}

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

export type AttendanceDay = {
  id: string;
  employee_id: string;
  work_date: string;
  assigned_shift: string | null;
  gross_span_minutes: number | null;
  productive_minutes: number | null;
  break_minutes: number | null;
  payable_ot_minutes: number | null;
  status: string;
  locked: boolean;
};

/** One employee's days between two dates (a month is at most 31, the API pages at 100). */
export function useDays(employeeId: string | null | undefined, from: string, to: string) {
  const url = employeeId ? `/api/v1/attendance/days?employeeId=${employeeId}&from=${from}&to=${to}&pageSize=100` : null;
  return useSWR(url, (key: string) => list<AttendanceDay>(key), options);
}

export type DayTrace = {
  day: { id: string; employee_id: string; work_date: string; assigned_shift: string; status: string; locked_at: string | null; computedStatus?: string };
  trace: null | {
    grossSpanMinutes: number; productiveMinutes: number; rawProductiveMinutes: number; breakMinutes: number;
    breaks: Array<{ from: string; to: string; minutes: number }>; overtimeMinutes: number; gatePassMinutes: number; shiftMinutes: number; evidencePunches: number;
  };
  reason?: string;
};

export function useDayTrace(dayId: string | null) {
  return useSWR(dayId ? `/api/v1/attendance/days/${dayId}/trace` : null, (url: string) => getJson<{ data: DayTrace }>(url).then((body) => body.data), options);
}

export const transitionDay = (dayId: string, action: "approve" | "lock" | "reopen") => postJson(`/api/v1/attendance/days/${dayId}/transition`, { action });
export const recomputeDay = (dayId: string) => postJson(`/api/v1/attendance/days/${dayId}/recompute`, {});

/* ------------------------------------------------------------------ */
/* Today: open session, shift and gate-pass quota                      */
/* ------------------------------------------------------------------ */

export type SessionStrip = {
  session: { employeeId: string; checkedInAt: string | null; elapsedMinutes: number | null; open: boolean };
  shift: { shiftCode: string | null; shiftName: string | null; startsAt: string | null; endsAt: string | null; graceMinutes: number | null };
  gatePassQuota: { usedMinutes: number; ceilingMinutes: number; requestsRemaining: number | null; period: string };
};

export function useSession(employeeId: string | null | undefined, period: string) {
  return useSWR(employeeId ? `/api/v1/attendance/session?employeeId=${employeeId}&period=${period}` : null,
    (url: string) => getJson<{ data: SessionStrip }>(url).then((body) => body.data), { ...options, refreshInterval: 60_000 });
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export type TeamMember = {
  id: string; employeeCode: string; firstName: string; lastName: string; designation: string; department: string; location: string;
  managerEmployeeId: string | null; managerName: string | null;
  recordedDays: number; present: number; halfDay: number; absent: number; other: number; productiveMinutes: number; payableOtMinutes: number;
};
export type TeamSummary = {
  scope: { kind: "tenant" | "hierarchy"; rootEmployeeId: string | null; visibleEmployees: number };
  summary: { visibleEmployees: number; recordedDays: number; present: number; halfDay: number; absent: number; other: number; productiveMinutes: number; payableOtMinutes: number };
  employees: TeamMember[];
};

export function useTeam(from: string, to: string, enabled: boolean) {
  return useSWR(enabled ? `/api/v1/attendance/team-summary?from=${from}&to=${to}` : null,
    (url: string) => getJson<{ data: TeamSummary }>(url).then((body) => body.data), options);
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export type Regularisation = {
  id: string; attendanceEntryId: string; employeeCode: string | null; employeeName: string | null; date: string | null;
  kind: string | null; reason: string | null; claimedIn: string | null; claimedOut: string | null; status: string; createdAt: string;
  /** The stored record; `employee_id` says whose request it is. */
  attributes?: { employee_id?: string } & Record<string, unknown>;
};

export function useRegularisations(enabled = true) {
  return useSWR(enabled ? "/api/v1/regularizations" : null, (url: string) => list<Regularisation>(url), options);
}
export type RegularisationInput = { employeeId: string; date: string; kind: "missing-punch" | "shift-correct" | "break-correct"; reason: string; claimedIn?: string; claimedOut?: string };
export const requestRegularisation = (input: RegularisationInput) => postJson("/api/v1/regularizations", input);
export const decideRegularisation = (id: string, approve: boolean) => postJson(`/api/v1/regularizations/${id}/decide`, { approve });

export type GatePass = {
  id: string; employee_id: string; employee_code: string; employee_name: string; date: string | null; minutes: number | null;
  from_time: string | null; to_time: string | null; pass_type: string | null; reason: string | null; expected_return: string | null;
  actual_out_ts: string | null; actual_in_ts: string | null; decision_remarks: string | null; approver_code: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "credited"; rejection_note: string | null;
};

export function useGatePasses(enabled = true) {
  return useSWR(enabled ? "/api/v1/gate-passes/register" : null, (url: string) => list<GatePass>(url), options);
}
export type GatePassInput = { employeeId: string; date: string; fromTime: string; toTime: string; passType: "personal" | "official"; reason: string };
export const requestGatePass = (input: GatePassInput) => postJson("/api/v1/gate-passes/register", input);
export const decideGatePass = (id: string, approve: boolean, decisionRemarks?: string) =>
  postJson(`/api/v1/gate-passes/${id}/decide`, { approve, ...(decisionRemarks ? { decisionRemarks } : {}) });

/* ------------------------------------------------------------------ */
/* Exceptions                                                          */
/* ------------------------------------------------------------------ */

export type AttendanceException = {
  id: string; exception_reference: string; employee_id: string; employee_code: string | null; employee_name: string | null; date: string | null;
  kind: string; severity: string | null; detail: string | null; proposal: string | null; resolution_action: string | null; amended_value: string | null;
  age_days: number | null; status: "open" | "proposed" | "resolved" | "rejected";
};

export function useExceptions(enabled = true) {
  return useSWR(enabled ? "/api/v1/attendance/exceptions/register" : null, (url: string) => list<AttendanceException>(url), options);
}
export const acceptProposal = (id: string, reason: string) => postJson(`/api/v1/attendance/exceptions/register/${id}/accept`, { reason });
export type ResolveInput = { action: "accept_proposal" | "amend" | "reject" | "escalate"; amendedValue?: string; reason: string };
export const resolveException = (id: string, input: ResolveInput) => postJson(`/api/v1/attendance/exceptions/register/${id}/resolve`, input);

/* ------------------------------------------------------------------ */
/* Overtime                                                            */
/* ------------------------------------------------------------------ */

export type OvertimeEntry = {
  id: string; employee_id: string; employee_code: string; employee_name: string; date: string | null;
  overtime_minutes: number | null; overtime_minutes_raw: number | null; overtime_label: string; multiplier: string | null;
  reduction_reason: string | null; weekly_cap_status: string | null; eligibility_basis: string | null; day_type: string | null;
  pay_run: string | null; approved_by: string | null; approved_on: string | null; record_reference: string | null;
  status: "pending_approval" | "approved" | "tagged_to_run" | "paid";
};

export function useOvertime(enabled = true) {
  return useSWR(enabled ? "/api/v1/overtime/register" : null, (url: string) => list<OvertimeEntry>(url), options);
}
export type ApproveOvertimeInput = { reason: string; payableMinutes?: number; reductionReason?: string };
export const approveOvertime = (id: string, input: ApproveOvertimeInput) => postJson(`/api/v1/overtime/register/${id}/approve`, input);
export const tagPayRun = (id: string, payRun: string, reason: string) => postJson(`/api/v1/overtime/register/${id}/tag-run`, { payRun, reason });

/* ------------------------------------------------------------------ */
/* Rules and calendars                                                 */
/* ------------------------------------------------------------------ */

export type EngineConsole = {
  engine: { rulePackCode: string | null; rulePackVersion: string | null; effectiveFrom: string | null; rules: string[] };
  workerCategories: Array<{ code: string; name: string; wageType: string | null; restDayPattern: string | null; otEligibility: string | null; leaveEligible: string | null; statutorySet: string | null }>;
  plantCalendars: Array<{ locationCode: string | null; locationName: string | null; holidayCount: number; holidays: Array<{ date: string; name: string }> }>;
};

export function useEngine(year: number, enabled = true) {
  return useSWR(enabled ? `/api/v1/attendance/engine?year=${year}` : null, (url: string) => getJson<{ data: EngineConsole }>(url).then((body) => body.data), options);
}
