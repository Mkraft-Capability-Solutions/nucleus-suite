"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/I18nContext";

/**
 * Client access to the leave APIs: response types, a GET hook with honest
 * loading/error states, and a POST helper that sends one Idempotency-Key per
 * logical submit and returns the server's error message on failure.
 */

export type LeaveEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  designationLevel: number;
  hasBirthDate: boolean;
};

export type LeaveContext = {
  employee: LeaveEmployee | null;
  canApprove: boolean;
  canMaintain: boolean;
  actsForOthers: boolean;
};

export type BalanceCard = {
  leaveType: string;
  leaveTypeName: string | null;
  allocated: number;
  availed: number;
  available: number;
  accrualNote: string | null;
};

export type LeaveState = "draft" | "validated" | "pending_approval" | "approved" | "availed" | "closed";

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  leave_type: string;
  leave_type_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  requested_days: number;
  actual_return_date: string | null;
  reason: string | null;
  half_day_session: string | null;
  contact: string | null;
  raw_status: string;
  status: LeaveState;
};

export type CompOffEntry = {
  id: string;
  creditId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  earnedOn: string | null;
  expiresOn: string | null;
  daysRemaining: number;
  status: "open" | "consumed" | "lapsed";
  daysToExpiry: number | null;
};

export type EarlyReturnEntry = {
  id: string;
  employeeCode: string | null;
  employeeName: string | null;
  leaveType: string;
  startsOn: string | null;
  endsOn: string | null;
  requestedDays: number;
  actualReturnDate: string;
  recreditedDays: number | null;
};

export type LeaveTypeRule = {
  code: string;
  name: string;
  carryForward: string | null;
  expiryRule: string | null;
  yearEndAction: string | null;
  maxPerMonth: number | null;
  cannotCombineWith: string[];
};

export type BandRule = {
  policyCode: string;
  leaveBand: string | null;
  leaveType: string;
  annualDays: number | null;
  accrualFrequency: string | null;
  creditDate: string | null;
};

export type LeaveEngine = {
  engine: { rulePackCode: string | null; rulePackVersion: string | null; effectiveFrom: string | null; rules: string[] };
  pipeline: { stages: Array<{ stage: string; label: string; count: number }>; totalPending: number };
  bandRules: BandRule[];
  leaveTypeRules: LeaveTypeRule[];
};

export type LeaveHoliday = { date: string; name: string; applicableLocations: string };

export type LeaveActivity = { id: string; action: string; entityId: string; reason: string | null; createdAt: string; employeeName: string | null };

export type AllocationNote =
  | "senior_management_annual"
  | "regular_monthly_el"
  | "new_joiner_waiting"
  | "prorated_cl_sl"
  | "trainee_cl_only"
  | "birthday_eligible"
  | "contractual_no_credit";

export type AllocationPreview = {
  employeeId: string;
  eligible: boolean;
  seniorManagement: boolean;
  year: number;
  days: { EL: number; CL: number; SL: number; BIRTHDAY: number };
  monthlyEL: number;
  notes: AllocationNote[];
  alreadyCredited: boolean;
};

export type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;

/** The i18n hook typed for `t(key, fallback, params)` calls. */
export function useLeaveT(): { t: Translate; locale: string } {
  const { t, locale } = useTranslation();
  return { t: t as unknown as Translate, locale };
}

type Envelope<T> = { data?: T; error?: { message?: string; details?: Array<{ field: string; issue: string }> } };

export type Resource<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

/** GET a leave API and keep its state; `url` null means "not requested". */
export function useLeaveResource<T>(url: string | null, fallbackError: string): { state: Resource<T>; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const requestKey = url ? `${url}#${nonce}` : null;
  // The settled result is tagged with the request it answers, so a newer request reads as loading.
  const [settled, setSettled] = useState<{ key: string; result: Resource<T> } | null>(null);
  useEffect(() => {
    if (!url || !requestKey) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
        if (!response.ok || payload?.data === undefined) throw new Error(payload?.error?.message || fallbackError);
        setSettled({ key: requestKey, result: { status: "ready", data: payload.data } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error && error.message ? error.message : fallbackError;
        setSettled({ key: requestKey, result: { status: "error", message } });
      });
    return () => controller.abort();
  }, [url, requestKey, fallbackError]);
  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const state: Resource<T> = settled && settled.key === requestKey ? settled.result : { status: "loading" };
  return { state, reload };
}

/** Outcome of a leave write: `data` on success, otherwise the server's message and field details. */
export type PostResult<T> = { ok: boolean; data: T | null; message: string; details: Array<{ field: string; issue: string }> };

export async function postLeave<T>(url: string, body: unknown, idempotencyKey: string, fallbackError: string): Promise<PostResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok || payload?.data === undefined) {
      return { ok: false, data: null, message: payload?.error?.message || fallbackError, details: payload?.error?.details ?? [] };
    }
    return { ok: true, data: payload.data, message: "", details: [] };
  } catch {
    return { ok: false, data: null, message: fallbackError, details: [] };
  }
}

/**
 * One Idempotency-Key per logical submit: the same key is reused when the same
 * payload is retried after a failure, and a fresh one is issued after success
 * or when the payload changes.
 */
export function useSubmitKey(): { keyFor: (payload: unknown) => string; settle: () => void } {
  const current = useRef<{ fingerprint: string; key: string } | null>(null);
  const keyFor = useCallback((payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { fingerprint, key: crypto.randomUUID() };
    }
    return current.current.key;
  }, []);
  const settle = useCallback(() => {
    current.current = null;
  }, []);
  return { keyFor, settle };
}

/** Dates as the viewer's locale renders them; a missing date stays visibly missing. */
export function formatLeaveDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatDays(days: number, locale: string): string {
  return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 2 }).format(days);
}

/** Today in ISO form (UTC), for date bounds. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const LEAVE_CHANGED = "nucleus:leave-changed";

/** Re-runs `reload` whenever any leave write in the workspace succeeds. */
export function useLeaveChanged(reload: () => void): void {
  useEffect(() => {
    window.addEventListener(LEAVE_CHANGED, reload);
    return () => window.removeEventListener(LEAVE_CHANGED, reload);
  }, [reload]);
}

/** Announces a successful leave write so every leave panel refetches. */
export function announceLeaveChanged(): void {
  window.dispatchEvent(new CustomEvent(LEAVE_CHANGED));
}
