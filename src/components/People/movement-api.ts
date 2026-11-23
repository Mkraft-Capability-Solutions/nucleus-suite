import type { CreateMovementInput, MovementList, PeopleChangedDetail } from "@/lib/employment-movements";
import { PEOPLE_CHANGED_EVENT } from "@/lib/employment-movements";

export type CompanyOption = { id: string; name: string; code: string | null; industry: string | null; status: string; currencyCode: string; parentId: string | null };

export type ApiResult<T> = { ok: boolean; status: number; data: T | null; message: string; details: Array<{ field: string; issue: string }> };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init }).catch(() => null);
  if (!response) return { ok: false, status: 0, data: null, message: "", details: [] };
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string; details?: Array<{ field: string; issue: string }> } } | null;
  if (!response.ok) return { ok: false, status: response.status, data: null, message: body?.error?.message ?? "", details: body?.error?.details ?? [] };
  return { ok: true, status: response.status, data: body?.data ?? null, message: "", details: [] };
}

export function fetchMovements(employeeId: string, page = 1, pageSize = 100): Promise<ApiResult<MovementList>> {
  return request<MovementList>(`/api/v1/employees/${encodeURIComponent(employeeId)}/movements?page=${page}&pageSize=${pageSize}`);
}

export function fetchCompanies(): Promise<ApiResult<CompanyOption[]>> {
  return request<CompanyOption[]>("/api/v1/organization/companies");
}

export function postMovement(employeeId: string, input: CreateMovementInput, idempotencyKey: string): Promise<ApiResult<{ id: string; status?: "applied" | "scheduled" }>> {
  return request(`/api/v1/employees/${encodeURIComponent(employeeId)}/movements`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
  });
}

export function announcePeopleChange(detail: PeopleChangedDetail) {
  window.dispatchEvent(new CustomEvent<PeopleChangedDetail>(PEOPLE_CHANGED_EVENT, { detail }));
}
