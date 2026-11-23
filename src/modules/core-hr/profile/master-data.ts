"use client";

import useSWR from "swr";
import type { EmployeeMasterView, FieldIssue, PatchEmployeeMaster } from "@/lib/employee-master/contract";
import { ApiError, getJson } from "../data";

export const PEOPLE_CHANGED_EVENT = "nucleus:people-changed";

export function useEmployeeMaster(id: string | null) {
  return useSWR<EmployeeMasterView, ApiError>(id ? `/api/v1/employees/${id}` : null, async (url: string) => (await getJson<{ data: EmployeeMasterView }>(url)).data, { revalidateOnFocus: false, shouldRetryOnError: false });
}

export class MasterSaveError extends ApiError {
  constructor(message: string, status: number, readonly details: FieldIssue[]) {
    super(message, status);
  }
}

/** PATCH with an Idempotency-Key; on success broadcasts `nucleus:people-changed` so dependent views re-fetch. */
export async function saveEmployeeMaster(id: string, patch: PatchEmployeeMaster, kind: string, idempotencyKey: string): Promise<EmployeeMasterView> {
  const response = await fetch(`/api/v1/employees/${id}`, {
    method: "PATCH", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(patch),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MasterSaveError(body?.error?.message ?? "The change could not be saved.", response.status, body?.error?.details ?? []);
  window.dispatchEvent(new CustomEvent(PEOPLE_CHANGED_EVENT, { detail: { employeeId: id, kind } }));
  return (body as { data: EmployeeMasterView }).data;
}

/** Map `{field, issue}` from the API (or zod paths) onto form field keys, dropping the section prefix. */
export function issuesByField(details: FieldIssue[], section: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const detail of details) {
    const field = detail.field.startsWith(`${section}.`) ? detail.field.slice(section.length + 1) : detail.field;
    if (!out[field]) out[field] = detail.issue;
  }
  return out;
}
