"use client";

import { useCallback, useRef } from "react";
import { useTranslation } from "@/context/I18nContext";

/**
 * Small client helpers shared by the helpdesk, CMS, workflow studio and experience screens:
 * JSON reads that surface the server's error message, writes that carry an Idempotency-Key reused while the
 * same payload is retried, and a typed translate function.
 */

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

export function useT(): { t: Translate; locale: string } {
  const { t, locale } = useTranslation();
  return { t: t as Translate, locale };
}

export type FieldIssue = { field: string; issue: string };
/**
 * One shape for success and failure: tsconfig runs with `strict: false`, where a discriminated union does not
 * narrow on `ok`. On success `body` is set and `message` is empty; on failure `body` is undefined.
 */
export type ApiResult<T> = { ok: boolean; status: number | null; body?: T; message: string; details: FieldIssue[] };
export type ApiFailure = ApiResult<unknown>;

type ErrorEnvelope = { error?: { message?: string; details?: FieldIssue[] } };

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  const body = (await response.json().catch(() => null)) as (T & ErrorEnvelope) | null;
  if (!response.ok) {
    return { ok: false, status: response.status, message: body?.error?.message ?? "", details: Array.isArray(body?.error?.details) ? body.error.details : [] };
  }
  return { ok: true, status: response.status, body: body as T, message: "", details: [] };
}

export async function readJson<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await fetch(path, { cache: "no-store", signal }));
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, status: null, message: "", details: [] };
  }
}

export async function sendJson<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  options: { idempotencyKey?: string; ifMatch?: number | string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.ifMatch !== undefined) headers["If-Match"] = String(options.ifMatch);
  try {
    return await parse<T>(await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  } catch {
    return { ok: false, status: null, message: "", details: [] };
  }
}

/**
 * One Idempotency-Key per logical submit: the same key is returned while the payload signature is unchanged
 * (a retry after a failure), and a fresh key once it changes or after `reset()` (a successful submit).
 */
export function useSubmitKey() {
  const ref = useRef<{ key: string; signature: string } | null>(null);
  const keyFor = useCallback((payload: unknown) => {
    const signature = JSON.stringify(payload ?? null);
    if (!ref.current || ref.current.signature !== signature) ref.current = { key: crypto.randomUUID(), signature };
    return ref.current.key;
  }, []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { keyFor, reset };
}

/** The server's message, or a localized fallback for network failures and empty error bodies. */
export function failureMessage(result: { status: number | null; message: string }, t: Translate, fallback: string): string {
  if (result.message) return result.message;
  if (result.status === null) return t("components.Workspace.common.text_network_error", "The server could not be reached. Try again.");
  return fallback;
}

/** Map server `details` onto form fields (first issue per field wins). */
export function fieldErrors(details: FieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const detail of details) {
    const field = detail.field.split(".")[0] ?? detail.field;
    if (field && !map[field]) map[field] = detail.issue;
  }
  return map;
}

export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(date);
}
