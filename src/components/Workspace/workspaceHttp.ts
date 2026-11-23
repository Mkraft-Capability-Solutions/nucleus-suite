"use client";

import { useCallback, useRef } from "react";

/**
 * Small fetch helpers for the workspace views that talk to `/api/v1/**` directly.
 * Reads return the response `data`; failures throw `ApiError` carrying the server's message and the
 * per-field issues, so a form can show them next to the right control.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly fields: Record<string, string>;

  constructor(message: string, status: number, code: string | null, fields: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type ErrorPayload = { error?: { message?: string; code?: string; details?: Array<{ field?: string; issue?: string }> } };

async function unwrap<T>(response: Response | null, fallback: string): Promise<T> {
  if (!response) throw new ApiError(fallback, 0, null, {});
  const payload = (await response.json().catch(() => null)) as ({ data?: T } & ErrorPayload) | null;
  if (!response.ok || !payload || payload.data === undefined) {
    const fields: Record<string, string> = {};
    for (const detail of payload?.error?.details ?? []) {
      if (detail.field && detail.issue && !fields[detail.field]) fields[detail.field] = detail.issue;
    }
    throw new ApiError(payload?.error?.message || fallback, response.status, payload?.error?.code ?? null, fields);
  }
  return payload.data;
}

export async function getData<T>(url: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/json" } }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    return null;
  });
  return unwrap<T>(response, fallback);
}

export async function sendJson<T>(url: string, init: { method: "POST" | "PATCH"; body: unknown; idempotencyKey: string }, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: init.method,
    headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": init.idempotencyKey },
    body: JSON.stringify(init.body),
  }).catch(() => null);
  return unwrap<T>(response, fallback);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * One Idempotency-Key per logical submit: the same key is reused when the user retries after a failure,
 * and a new key is issued once the submit succeeds or the form content changes.
 */
export function useSubmitKey(): { current: () => string; reset: () => void } {
  const ref = useRef<string | null>(null);
  const current = useCallback(() => {
    if (!ref.current) ref.current = crypto.randomUUID();
    return ref.current;
  }, []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { current, reset };
}

export type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;

export type Employee = { id: string; employeeCode: string | null; firstName: string | null; lastName: string | null; designation: string | null; department: string | null };

export function employeeLabel(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return employee.employeeCode ? `${name || employee.employeeCode} (${employee.employeeCode})` : name || employee.id;
}
