"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { getJson, postJson } from "@/modules/attendance/data";

/**
 * Reads and writes for the redesigned onboarding & exit module, on the existing lifecycle routes
 * (/api/v1/onboarding/*, /api/v1/offboarding/*). Nothing is synthesised.
 */

const options: SWRConfiguration = { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true };

export type OnboardingTask = { id: string; key: string; title: string; owner: string; required: boolean; status: string };
export type Joiner = {
  id: string; employeeId: string; status: string; createdAt: string; templateName: string;
  employee: { code: string; firstName: string; lastName: string; department: string; designation: string; joiningDate: string | null };
  tasks: OnboardingTask[]; total: number; done: number; day1Ready: boolean;
};

export function useJoiners(enabled = true) {
  return useSWR(enabled ? "/api/v1/onboarding/instances" : null, (url: string) => getJson<{ data: Joiner[] }>(url).then((body) => body.data), options);
}
export const completeTask = (taskId: string, note?: string) => postJson(`/api/v1/onboarding/tasks/${taskId}/complete`, note ? { note } : {});
export const startOnboarding = (employeeId: string, templateCode: string) => postJson("/api/v1/onboarding/instances", { employeeId, templateCode });

export type TemplateTask = { key: string; title: string; required: boolean; owner: string };
export type Template = { id: string; created_at: string; attributes: { code?: string; name?: string; status?: string; tasks?: Array<Partial<TemplateTask> & { code?: string }> } };

export function useTemplates(enabled = true) {
  return useSWR(enabled ? "/api/v1/onboarding/templates?archived=true" : null, (url: string) => getJson<{ data: Template[] }>(url).then((body) => body.data), options);
}
export const createTemplate = (input: { code: string; name: string; tasks: TemplateTask[] }) => postJson("/api/v1/onboarding/templates", input);
export async function updateTemplate(id: string, input: { name?: string; tasks?: TemplateTask[]; status?: "active" | "archived" }) {
  const response = await fetch(`/api/v1/onboarding/templates/${id}`, {
    method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "The template could not be saved.");
  return body;
}

export type ClearanceItem = {
  id: string; case_id: string; leaver_code: string | null; leaver_name: string | null; owner_code: string | null; owner_name: string | null;
  item_name: string; blocking: boolean; cleared_on: string | null; recovery_amount_minor: number | string | null; recovery_description: string | null;
  waive_reason: string | null; status: "open" | "cleared" | "waived" | "held"; last_working_day: string | null; resigned_on: string | null; ff_state: string | null; case_status?: string | null;
};

export function useClearance(enabled = true) {
  return useSWR(enabled ? "/api/v1/offboarding/clearance-board" : null, (url: string) => getJson<{ data: ClearanceItem[] }>(url).then((body) => body.data), options);
}
export const clearItem = (id: string, note?: string) => postJson(`/api/v1/offboarding/items/${id}/clear`, note ? { note } : {});
export const waiveItem = (id: string, reason: string) => postJson(`/api/v1/offboarding/items/${id}/waive`, { reason });
export const startExit = (input: { employeeId: string; reason: string; lastWorkingDate: string }) => postJson("/api/v1/offboarding/cases", input);
export const settleCase = (caseId: string) => postJson<{ data: { attributes: Record<string, unknown> } }>(`/api/v1/offboarding/cases/${caseId}/settle`, {});

/** One exit case: the clearance board's rows grouped by case. */
export type ExitCase = {
  caseId: string; leaverName: string | null; leaverCode: string | null; lastWorkingDay: string | null; resignedOn: string | null; ffState: string | null; settledCase: boolean;
  items: ClearanceItem[]; settled: number; blockingOpen: number;
};

export function groupCases(items: ClearanceItem[]): ExitCase[] {
  const cases = new Map<string, ExitCase>();
  for (const item of items) {
    const entry = cases.get(item.case_id) ?? {
      caseId: item.case_id, leaverName: item.leaver_name, leaverCode: item.leaver_code, lastWorkingDay: item.last_working_day,
      resignedOn: item.resigned_on, ffState: item.ff_state, settledCase: (item.case_status ?? "").toLowerCase() === "settled" || (item.ff_state ?? "").toLowerCase() === "settled", items: [], settled: 0, blockingOpen: 0,
    };
    entry.items.push(item);
    if (item.status === "cleared" || item.status === "waived") entry.settled += 1;
    else if (item.blocking) entry.blockingOpen += 1;
    cases.set(item.case_id, entry);
  }
  return [...cases.values()].sort((a, b) => (a.lastWorkingDay ?? "9999").localeCompare(b.lastWorkingDay ?? "9999"));
}
