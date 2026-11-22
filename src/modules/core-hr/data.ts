"use client";

import useSWR, { type SWRConfiguration } from "swr";

/**
 * Reads for the Core HR module. Every hook calls an existing API route; nothing is synthesised.
 * A failed request surfaces as `error` (with the API's message and status), never as empty data.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = response.status === 403 ? "You do not have access to this information." : "The information could not be loaded.";
    throw new ApiError(body?.error?.message ?? fallback, response.status);
  }
  return body as T;
}

export async function sendJson<T>(url: string, method: "POST" | "PATCH", payload: unknown, idempotent = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotent) headers["Idempotency-Key"] = crypto.randomUUID();
  const response = await fetch(url, { method, credentials: "same-origin", headers, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details: Array<{ field: string; issue: string }> = body?.error?.details ?? [];
    const message = body?.error?.message ?? "The change could not be saved.";
    const error = new ApiError(details.length ? `${message} ${details.map((detail) => `${detail.field}: ${detail.issue}`).join("; ")}` : message, response.status);
    throw error;
  }
  return body as T;
}

const options: SWRConfiguration = { revalidateOnFocus: false, shouldRetryOnError: false };

/* ------------------------------------------------------------------ */
/* Shapes returned by the APIs                                         */
/* ------------------------------------------------------------------ */

export type DirectoryStatus = "active" | "on_leave" | "separated" | "archived";

export type DirectoryRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  location: string;
  band: string | null;
  worker_class: string | null;
  manager_code: string | null;
  manager_name: string | null;
  joining_date: string | null;
  work_email: string | null;
  record_status: string;
  status: DirectoryStatus;
};

export type LegalEntityRow = { id: string; code: string; legal_name: string; currency_code: string | null; status: string; headcount: number };
export type LocationRow = { id: string; code: string; name: string; city: string | null; state: string | null; establishment_type: string | null; headcount: number };
export type AuditRow = { id: string; action: string; entity_type: string; entity_id: string | null; reason: string | null; created_at: string };
export type PeopleSummary = {
  activeEmployees: number; sanctionedOpen: number | null; documentsTotal: number | null; documentsVerified: number | null;
  verifiedPercent: number | null; auditEvents: number | null;
};

export type PeoplePayload = {
  directory: DirectoryRow[];
  summary: PeopleSummary;
  legalEntities: LegalEntityRow[] | null;
  locations: LocationRow[] | null;
  auditTrail: AuditRow[] | null;
};

export type PositionRow = {
  id: string; code: string; title: string; department: string; location: string; cost_centre: string; worker_class: string | null;
  fte: number | null; available_from: string | null; budget_cost_minor: number | null; effective_from: string | null;
  incumbent_code: string | null; incumbent_name: string | null; vacancy: "filled" | "vacant"; status: string; record_status: string;
};

export type DocumentRow = {
  id: string; title: string; code: string; document_type: string; classification: string | null; employee_code: string | null;
  employee_name: string | null; issued_on: string | null; expires_on: string | null; verification: string; status: string;
  rejection_reason: string | null;
};

export type SanctionedRow = Record<string, unknown> & { id: string };

export type OrgNode = {
  id: string; employeeCode: string; firstName: string; lastName: string; designation: string; department: string; location: string;
  status: string; managerId: string | null; children?: OrgNode[];
};

export type EmployeeRecord = {
  id: string; version: number; employeeCode: string; firstName: string; lastName: string; workEmail: string | null; designation: string | null;
  department: string | null; location: string | null; category: string | null; status: string | null; joiningDate: string | null;
  basicSalary: { amount: string; minor?: number; currency: string } | null; salaryMasked?: boolean; currency?: string; metadata: Record<string, unknown>;
};

export type TimelinePayload = { employee: Record<string, unknown>; state: string; onLeave: boolean | null; auditTrail: AuditRow[] };

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function usePeople() {
  return useSWR("/api/v1/people/directory", (url: string) => getJson<{ data: PeoplePayload }>(url).then((body) => body.data), options);
}

export function usePositions(enabled = true) {
  return useSWR(enabled ? "/api/v1/organization/positions/register" : null, (url: string) => getJson<{ data: PositionRow[] }>(url).then((body) => body.data), options);
}

export function useSanctionedStrength(enabled = true) {
  return useSWR(enabled ? "/api/v1/organization/sanctioned-strength" : null, (url: string) => getJson<{ data: SanctionedRow[] }>(url).then((body) => body.data), options);
}

export function useDocuments(enabled = true) {
  return useSWR(enabled ? "/api/v1/documents/vault" : null, (url: string) => getJson<{ data: DocumentRow[] }>(url).then((body) => body.data), options);
}

export function useOrgChart(enabled = true) {
  return useSWR(enabled ? "/api/v1/org-chart" : null, (url: string) => getJson<{ data: { roots: OrgNode[] } }>(url).then((body) => body.data.roots ?? []), options);
}

export function useEmployee(id: string | null) {
  return useSWR(id ? `/api/v1/people/${encodeURIComponent(id)}` : null, (url: string) => getJson<{ data: EmployeeRecord }>(url).then((body) => body.data), options);
}

export function useTimeline(id: string | null) {
  return useSWR(id ? `/api/v1/people/${encodeURIComponent(id)}/timeline` : null, (url: string) => getJson<{ data: TimelinePayload }>(url).then((body) => body.data), options);
}

/** A dossier resource (contacts, emergency, dependants, bank, tax, employments) for one employee. */
export function useDossier(resource: string, employeeId: string | null) {
  return useSWR(
    employeeId ? `/api/v1/dossier/${resource}?employeeId=${encodeURIComponent(employeeId)}` : null,
    (url: string) => getJson<{ data: Array<{ id: string; attributes?: Record<string, unknown> } & Record<string, unknown>> }>(url).then((body) => body.data ?? []),
    options,
  );
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-04-01" → "1 Apr 2024"; anything else unchanged. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  // Postgres text timestamps look like "2026-11-20 15:19:28.318636+00": make them ISO 8601.
  const iso = value.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(date.toISOString().slice(0, 10))}, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function fullName(row: { first_name?: string; last_name?: string; firstName?: string; lastName?: string }): string {
  return `${row.first_name ?? row.firstName ?? ""} ${row.last_name ?? row.lastName ?? ""}`.replace(/\s+/g, " ").trim() || "Unnamed";
}

/** "audit.people.update" → "People update". */
export function humanise(code: string | null | undefined): string {
  const text = String(code ?? "").replace(/[._-]+/g, " ").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export const STATUS_LABELS: Record<DirectoryStatus, { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  on_leave: { label: "On leave", tone: "info" },
  separated: { label: "Separated", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
};

/** Whole years and months of service from a joining date. */
export function tenure(joiningDate: string | null | undefined, today = new Date()): string {
  if (!joiningDate) return "";
  const start = new Date(`${joiningDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start > today) return "";
  let months = (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + (today.getUTCMonth() - start.getUTCMonth());
  if (today.getUTCDate() < start.getUTCDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return "Less than a month";
  return [years ? `${years} ${years === 1 ? "yr" : "yrs"}` : "", rest ? `${rest} ${rest === 1 ? "mo" : "mos"}` : ""].filter(Boolean).join(" ");
}
