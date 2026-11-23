"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { getJson, postJson } from "@/modules/attendance/data";

/**
 * Reads and writes for the redesigned leave module, on the existing /api/v1 leave routes plus the
 * additive GET /api/v1/leave-balances/summary. Nothing is synthesised.
 */

const options: SWRConfiguration = { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true };
const list = <T,>(url: string) => getJson<{ data: T[] }>(url).then((body) => body.data);

export type BalanceLine = {
  leaveType: string; leaveTypeName: string | null; available: number | null; storedBalance: number | null; approvedSince: number;
  pending: number; takenThisYear: number; asOf: string | null; expiresOn: string | null;
};

export function useBalanceSummary(employeeId: string | null | undefined) {
  return useSWR(employeeId ? `/api/v1/leave-balances/summary?employeeId=${employeeId}` : null,
    (url: string) => getJson<{ data: { employeeId: string; lines: BalanceLine[] } }>(url).then((body) => body.data.lines), options);
}

/** One person's requests (newest first). */
export type MyRequest = { id: string; employee_id: string; leave_type: string; starts_on: string; ends_on: string; requested_days: number; status: string; reason: string | null };

export function useMyRequests(employeeId: string | null | undefined) {
  return useSWR(employeeId ? `/api/v1/leave-requests?employeeId=${employeeId}&pageSize=100` : null, (url: string) => list<MyRequest>(url), options);
}

/** The organisation's request register (newest 100), with names and the approval step. */
export type RegisterRow = {
  id: string; employee_id: string; employee_code: string | null; employee_name: string | null; department: string | null;
  leave_type: string; leave_type_name: string | null; starts_on: string | null; ends_on: string | null; requested_days: number;
  actual_return_date: string | null; reason: string | null; contact: string | null; handover_person_name: string | null;
  raw_status: string; status: "draft" | "validated" | "pending_approval" | "approved" | "availed" | "closed";
};

export function useRegister(enabled = true) {
  return useSWR(enabled ? "/api/v1/leave-requests/register" : null, (url: string) => list<RegisterRow>(url), options);
}

export type LeaveEngine = {
  engine: { rulePackCode: string | null; rulePackVersion: string | null; effectiveFrom: string | null; rules: string[] };
  pipeline: { stages: Array<{ stage: string; label: string; count: number }>; totalPending: number };
  bandRules: Array<{ policyCode: string; leaveBand: string | null; leaveType: string; annualDays: number | null; accrualFrequency: string | null; creditDate: string | null }>;
  leaveTypeRules: Array<{ code: string; name: string; carryForward: string | null; expiryRule: string | null; yearEndAction: string | null; maxPerMonth: number | null; cannotCombineWith: string[] }>;
};

export function useLeaveEngine(enabled = true) {
  return useSWR(enabled ? "/api/v1/leave/engine" : null, (url: string) => getJson<{ data: LeaveEngine }>(url).then((body) => body.data), options);
}

export type LeaveTypeRow = { id: string; attributes: { code?: string; name?: string; unit?: string } & Record<string, unknown> };
export function useLeaveTypes() {
  return useSWR("/api/v1/leave-types", (url: string) => list<LeaveTypeRow>(url), options);
}

export type CompOffEntry = {
  id: string; creditId: string | null; employeeCode: string | null; employeeName: string | null; earnedOn: string | null; expiresOn: string | null;
  daysRemaining: number; status: "open" | "consumed" | "lapsed"; daysToExpiry: number | null;
};
export function useCompOffs(enabled = true) {
  return useSWR(enabled ? "/api/v1/leave/comp-off-clock" : null, (url: string) => list<CompOffEntry>(url), options);
}

export type EarlyReturn = {
  id: string; employeeCode: string | null; employeeName: string | null; leaveType: string; startsOn: string | null; endsOn: string | null;
  requestedDays: number; actualReturnDate: string; recreditedDays: number | null;
};
export function useEarlyReturns(enabled = true) {
  return useSWR(enabled ? "/api/v1/leave/early-returns" : null, (url: string) => list<EarlyReturn>(url), options);
}

export type LeaveCode = "EL" | "CL" | "SL" | "COFF" | "BIRTHDAY";
export type ApplyInput = { employeeId: string; leaveType: LeaveCode; startsOn: string; endsOn: string; days: number; reason?: string };
export const applyLeave = (input: ApplyInput) => postJson("/api/v1/leave-requests", input);
export const decideLeave = (id: string, approve: boolean, comment?: string) => postJson(`/api/v1/leave-requests/${id}/decide`, { approve, ...(comment ? { comment } : {}) });
export const returnEarly = (id: string, actualReturnDate: string) =>
  postJson<{ data: { attributes: { leaveDaysCreditedBack?: number } } }>(`/api/v1/leave-requests/${id}/early-return`, { actualReturnDate });
export const grantCompOff = (input: { employeeId: string; earnedOn: string; days: number; note?: string }) => postJson("/api/v1/coff-grants", input);
