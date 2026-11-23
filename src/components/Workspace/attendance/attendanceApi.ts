/**
 * Client access to the attendance API routes used by AttendanceView. Reads return the route's `data`; failures
 * throw an Error carrying the server's own `error.message`. Writes always send an Idempotency-Key that the caller
 * keeps for the life of one logical submit, so a retry of the same submit can never create a second record.
 */

export type ApiFailure = { message: string; fields: Record<string, string> };

type Envelope<T> = { data?: T; meta?: { total?: number }; error?: { message?: string; details?: Array<{ field: string; issue: string }> } };

export class AttendanceApiError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}, readonly status: number | null = null) {
    super(message);
  }
}

function fieldsFrom(details: Array<{ field: string; issue: string }> | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const detail of details ?? []) {
    if (detail.field && !fields[detail.field]) fields[detail.field] = detail.issue;
  }
  return fields;
}

export async function getData<T>(path: string, fallbackMessage: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AttendanceApiError(fallbackMessage);
  }
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || body === null || body.data === undefined) {
    throw new AttendanceApiError(body?.error?.message || fallbackMessage, fieldsFrom(body?.error?.details), response.status);
  }
  return body.data;
}

export async function sendJson<T>(path: string, body: unknown, idempotencyKey: string | null, fallbackMessage: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new AttendanceApiError(fallbackMessage);
  }
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || payload === null || payload.data === undefined) {
    throw new AttendanceApiError(payload?.error?.message || fallbackMessage, fieldsFrom(payload?.error?.details), response.status);
  }
  return payload.data;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function errorFields(error: unknown): Record<string, string> {
  return error instanceof AttendanceApiError ? error.fields : {};
}

/* ---------------- Response shapes (mirror the server read models) ---------------- */

export type OwnProfile = { id: string; employeeId: string | null; employeeCode: string | null; name: string | null };

export type SessionStrip = {
  session: { employeeId: string; checkedInAt: string | null; elapsedMinutes: number | null; open: boolean };
  shift: { shiftCode: string | null; shiftName: string | null; startsAt: string | null; endsAt: string | null; graceMinutes: number | null };
  gatePassAllowance: {
    period: string; usedMinutes: number; usedRequests: number; ceilingMinutes: number | null; requestLimit: number | null;
    remainingMinutes: number | null; remainingRequests: number | null; allowedMinutes: number[];
  };
};

export type TimesheetDay = { id: string; date: string; status: "in" | "late" | "off" | "absent" | "leave" | "not_recorded"; shiftCode: string | null; grossMinutes: number | null };

export type EngineConsole = {
  engine: { rulePackCode: string | null; rulePackVersion: string | null; effectiveFrom: string | null; rules: string[] };
  workerCategories: Array<{ code: string; name: string; wageType: string | null; restDayPattern: string | null; otEligibility: string | null; leaveEligible: string | null; statutorySet: string | null }>;
  plantCalendars: Array<{ locationCode: string | null; locationName: string | null; holidayCount: number; holidays: Array<{ date: string; name: string }> }>;
};

export type Anomaly = { id: string; employeeCode: string | null; employeeName: string | null; date: string | null; kind: string; detail: string | null; status: string };

export type GatePass = {
  id: string; employee_id: string; employee_code: string; employee_name: string; date: string | null; minutes: number | null;
  pass_type: string | null; reason: string | null; approver_code: string | null; decision_remarks: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "credited"; rejection_note: string | null;
};

export type Regularization = {
  id: string; employeeId: string | null; employeeCode: string | null; employeeName: string | null; date: string | null; kind: string | null;
  reason: string | null; claimedIn: string | null; claimedOut: string | null; status: string; remarks: string | null; createdAt: string;
};

export type LedgerRow = {
  id: string; employee_id: string; employee_code: string | null; employee_name: string | null; designation: string | null;
  worker_category_code: string | null; date: string | null; day_type: string | null; shift_assigned: string | null; shift_applied: string | null;
  shift_inferred: boolean; gross_minutes: number | null; break_minutes: number | null; gate_pass_minutes: number | null;
  net_minutes: number | null; ot_minutes: number | null; status: string | null; status_reason: string | null;
};

export type DayDetail = LedgerRowLike & {
  punches: Array<{ id: string; event_reference: string; direction: "in" | "out" | "unknown"; punch_time: string | null; punch_date: string | null; device: string | null; note: string | null }>;
};
type LedgerRowLike = { id: string; date: string | null; shift_code: string | null; net_minutes: number; overtime_minutes: number; first_in: string | null; last_out: string | null };

export type ShiftOption = { id: string; code: string; name: string | null; startsAt: string | null; endsAt: string | null; crossesMidnight: boolean };

/* ---------------- Pure helpers ---------------- */

/** H:MM for a stored minute count; null when nothing was recorded. */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  const total = Math.max(0, Math.trunc(minutes));
  return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [year = 1970, month = 1] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Neutralises spreadsheet formula injection and quotes one CSV cell. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
