import type { FormField } from "@/lib/form-validation";

/**
 * Types and API helpers for OperationalModuleView. Records come from
 * GET/POST /api/v1/ops/modules/{moduleId}/records and PATCH .../records/{id}[/state];
 * lookups from /api/v1/dossier-lookups/{employees|locations|departments} and the shift_master register;
 * the audit trail from GET /api/v1/ops/audit-events?entityId=.
 */

export const NS = "components.Workspace.OperationalModuleView";

export type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;

export type ModuleField = FormField & { options?: Array<string | { value: string; label?: string }>; derive?: FormField["derive"] };

export type OperationalModule = {
  id: string;
  screenId: string;
  title: string;
  description?: string;
  primary: string;
  fields: ModuleField[];
  states: string[];
  actions: string[];
  columns: string[];
  endpoint?: string | null;
};

export type ModuleRecord = {
  id: string;
  status: string | null;
  employeeId: string | null;
  attributes: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Option = { value: string; label: string };
export type LookupKind = "employees" | "locations" | "departments" | "shifts";
export type LookupState = { status: "idle" | "loading" } | { status: "ready"; options: Option[] } | { status: "error"; message: string };
export type ResolvedField = ModuleField & { lookup: LookupKind | null; choices: Option[] };

export type AuditEvent = { id: string; action: string; reason: string | null; created_at: string; actor_user_id: string | null };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  constructor(message: string, status: number, code: string, fieldErrors: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type ErrorBody = { error?: { message?: string; code?: string; details?: Array<{ field?: string; issue?: string }> } };

export async function requestJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(fallbackMessage, 0, "NETWORK_ERROR", {});
  }
  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok || body === null) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of body?.error?.details ?? []) {
      if (detail.field && detail.issue && !fieldErrors[detail.field]) fieldErrors[detail.field] = detail.issue;
    }
    throw new ApiError(body?.error?.message || fallbackMessage, response.status, body?.error?.code || "REQUEST_FAILED", fieldErrors);
  }
  return body;
}

export function recordsUrl(module: OperationalModule): string {
  return module.endpoint || `/api/v1/ops/modules/${encodeURIComponent(module.id)}/records`;
}

type Envelope<T> = { data: T; meta?: { total?: number } };

export function toRecord(raw: Partial<ModuleRecord> & { id: string }): ModuleRecord {
  return {
    id: raw.id,
    status: raw.status ?? null,
    employeeId: raw.employeeId ?? null,
    attributes: raw.attributes ?? {},
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function fetchRecords(url: string, args: { page: number; pageSize: number; search: string }, signal: AbortSignal, fallback: string) {
  const query = new URLSearchParams({ page: String(args.page), pageSize: String(args.pageSize) });
  if (args.search.trim()) query.set("search", args.search.trim());
  const body = await requestJson<Envelope<Array<ModuleRecord & { id: string }>>>(`${url}?${query}`, { signal }, fallback);
  return { items: (Array.isArray(body.data) ? body.data : []).map(toRecord), total: body.meta?.total ?? 0 };
}

export async function saveRecord(module: OperationalModule, target: { id: string } | null, payload: Record<string, unknown>, idempotencyKey: string, fallback: string): Promise<ModuleRecord> {
  const url = target ? `${recordsUrl(module)}/${encodeURIComponent(target.id)}` : recordsUrl(module);
  const body = await requestJson<Envelope<ModuleRecord>>(url, {
    method: target ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  }, fallback);
  return toRecord(body.data);
}

export async function transitionRecord(module: OperationalModule, id: string, state: string, idempotencyKey: string, fallback: string): Promise<ModuleRecord> {
  const body = await requestJson<Envelope<ModuleRecord>>(`${recordsUrl(module)}/${encodeURIComponent(id)}/state`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ state }),
  }, fallback);
  return toRecord(body.data);
}

export async function fetchAudit(id: string, signal: AbortSignal, fallback: string): Promise<AuditEvent[]> {
  const body = await requestJson<Envelope<AuditEvent[]>>(`/api/v1/ops/audit-events?entityId=${encodeURIComponent(id)}&pageSize=10`, { signal }, fallback);
  return Array.isArray(body.data) ? body.data : [];
}

export async function fetchLookup(kind: LookupKind, search: string, signal: AbortSignal, fallback: string): Promise<Option[]> {
  const query = new URLSearchParams({ pageSize: "100" });
  if (search.trim()) query.set("search", search.trim());
  if (kind === "shifts") {
    const body = await requestJson<Envelope<ModuleRecord[]>>(`/api/v1/ops/modules/shift_master/records?${query}`, { signal }, fallback);
    return dedupeOptions((body.data ?? []).map((item) => {
      const attrs = item.attributes ?? {};
      const code = String(attrs.shiftCode ?? attrs.code ?? "").trim();
      const name = String(attrs.shiftName ?? attrs.name ?? "").trim();
      return code ? { value: code, label: name ? `${code} · ${name}` : code } : null;
    }));
  }
  const body = await requestJson<Envelope<Array<{ id: string; name: string }>>>(`/api/v1/dossier-lookups/${kind}?${query}`, { signal }, fallback);
  return dedupeOptions((body.data ?? []).map((item) => ({ value: item.id, label: item.name })));
}

export function dedupeOptions(options: ReadonlyArray<string | { value?: unknown; label?: unknown; name?: unknown; id?: unknown } | null | undefined>): Option[] {
  const seenValues = new Set<string>();
  const seenLabels = new Set<string>();
  const result: Option[] = [];
  for (const option of options) {
    if (!option) continue;
    const rawValue = typeof option === "string" ? option : (option.value ?? option.label ?? option.id ?? "");
    const rawLabel = typeof option === "string" ? option : (option.label ?? option.value ?? option.name ?? "");
    const value = String(rawValue).trim() || String(rawLabel).trim();
    const label = String(rawLabel).trim() || value;
    if (!value) continue;
    if (seenValues.has(value.toLowerCase()) || seenLabels.has(label.toLowerCase())) continue;
    seenValues.add(value.toLowerCase());
    seenLabels.add(label.toLowerCase());
    result.push({ value, label });
  }
  return result;
}

/** Which master list a select/lookup field draws from, by its key. */
export function lookupKindFor(field: ModuleField): LookupKind | null {
  const isLookup = field.type === "select" || /select|lookup/i.test(field.control ?? "") || Boolean(field.options?.length);
  if (!isLookup) return null;
  const key = (field.key || "").toLowerCase();
  if (["personid", "employee", "referrerpersonid", "panel", "assigneeid", "allocatedto", "manager", "user", "leaver"].includes(key) || key.includes("person") || (key.includes("employee") && key !== "employeecode")) return "employees";
  if (key.includes("location") || key.includes("site")) return "locations";
  if (["orgunit", "department", "costcenter", "section"].includes(key) || key.includes("department") || key.includes("orgunit")) return "departments";
  if (key.includes("shift") && !key.includes("group") && !key.includes("hour") && !key.includes("night")) return "shifts";
  return null;
}

export function resolveFields(fields: ModuleField[], lookups: Partial<Record<LookupKind, LookupState>>): ResolvedField[] {
  return fields.map((field) => {
    const lookup = lookupKindFor(field);
    const configured = dedupeOptions(field.options ?? []);
    const state = lookup ? lookups[lookup] : undefined;
    const master = state?.status === "ready" ? state.options : [];
    return { ...field, lookup: configured.length ? null : lookup, choices: configured.length ? configured : master };
  });
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string[]> = {
  location: ["locationId", "location", "worksite", "locationCode"],
  worksite: ["locationId", "location", "worksite", "locationCode"],
  orgunitsection: ["orgUnit", "department", "section", "costCenter"],
  orgunit: ["orgUnit", "department", "section", "costCenter"],
  department: ["orgUnit", "department", "section", "costCenter"],
  section: ["orgUnit", "department", "section", "costCenter"],
  employee: ["personId", "employee", "employeeCode", "employeeId"],
  person: ["personId", "employee", "employeeCode", "employeeId"],
  worker: ["personId", "employee", "employeeCode", "employeeId"],
  date: ["rosterDate", "date", "effectiveDate", "fromDate"],
  rosterdate: ["rosterDate", "date", "effectiveDate", "fromDate"],
  status: ["publishStatus", "status", "state", "recordStatus"],
  publishstatus: ["publishStatus", "status", "state", "recordStatus"],
  starttime: ["startTime"],
  start: ["startTime"],
  endtime: ["endTime"],
  end: ["endTime"],
  shift: ["shiftCode", "shift", "shiftId"],
  shiftcode: ["shiftCode", "shift", "shiftId"],
  form: ["formCode", "form"],
};

const LOOKUP_BY_COLUMN: Record<string, LookupKind> = {
  employee: "employees", person: "employees", worker: "employees",
  location: "locations", worksite: "locations",
  orgunitsection: "departments", department: "departments", orgunit: "departments",
  shift: "shifts", shiftcode: "shifts",
};

const present = (value: unknown) => value !== undefined && value !== null && value !== "";

/** Cell text for a registry column; resolves ids to master labels; "—" when the record has no value. */
export function recordValue(record: ModuleRecord, column: string, module: OperationalModule, lookups: Partial<Record<LookupKind, LookupState>>): string {
  const attrs = record.attributes;
  const key = norm(column);
  let value: unknown = attrs[column];
  if (!present(value)) {
    const field = module.fields.find((item) => norm(item.label || "") === key || norm(item.key || "") === key);
    if (field) value = attrs[field.key];
  }
  if (!present(value) && ALIASES[key]) value = ALIASES[key].map((alias) => attrs[alias]).find(present);
  if (!present(value) && (key === "period" || key === "periodfromto")) {
    value = attrs.periodFromPeriodTo ?? attrs.period ?? (attrs.startTime && attrs.endTime ? `${String(attrs.startTime)} – ${String(attrs.endTime)}` : undefined);
  }
  if (!present(value) && key === "assignment") value = [attrs.designation, attrs.location].filter(present).join(" · ") || undefined;
  if (!present(value) && (key === "status" || key === "publishstatus")) value = record.status;
  if (!present(value)) return "—";
  const text = Array.isArray(value) ? value.map(String).join(", ") : String(value);
  const kind = LOOKUP_BY_COLUMN[key];
  const state = kind ? lookups[kind] : undefined;
  if (state?.status === "ready") {
    const match = state.options.find((option) => option.value === text);
    if (match) return match.label;
  }
  return text;
}

export function currentState(record: ModuleRecord | null, module: OperationalModule): string | null {
  if (!record) return null;
  const raw = [record.attributes.state, record.attributes.status, record.attributes.publishStatus, record.status].find((value) => typeof value === "string" && value);
  if (typeof raw !== "string") return null;
  return module.states.find((state) => state.toLowerCase() === raw.toLowerCase()) ?? raw;
}

/** Payload with derived period text, ready for the server schema. */
export function buildPayload(values: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...values };
  if (payload.startTime && payload.endTime && !payload.periodFromPeriodTo) payload.periodFromPeriodTo = `${String(payload.startTime)} - ${String(payload.endTime)}`;
  return payload;
}
