"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";

/**
 * Client helpers shared by the payroll and compensation workspace screens: a
 * read hook with honest loading / error / ready states, an idempotent write
 * helper that surfaces the server's message, and money / date formatting with
 * Intl (amounts arrive as integer minor units with an ISO 4217 currency).
 */

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

export type Resource<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; meta: Record<string, unknown> }
  | { status: "error"; message: string; code: number | null };

export type ResourceHandle<T> = { state: Resource<T>; reload: () => void };

type Envelope = { data?: unknown; meta?: Record<string, unknown> };

/** Load `path` (null = do not load) and expose `data` (and `meta`) from the `{ data, meta }` envelope. */
export function useResource<T>(path: string | null): ResourceHandle<T> {
  const [state, setState] = useState<Resource<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((body) => {
        const envelope = (body ?? {}) as Envelope;
        if (!cancelled) setState({ status: "ready", data: envelope.data as T, meta: envelope.meta ?? {} });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: number | null }).status : null;
        setState({ status: "error", message: error instanceof Error ? error.message : String(error), code: status });
      });
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);
  const reload = useCallback(() => {
    if (path) invalidateGetRequest(path);
    setState({ status: "loading" });
    setNonce((value) => value + 1);
  }, [path]);
  return { state, reload };
}

/** Flat (not discriminated) so it narrows the same with or without strictNullChecks. */
export type WriteResult<T> = { ok: boolean; data: T | null; message: string; details: Array<{ field: string; issue: string }> };

/** POST/PATCH JSON with an Idempotency-Key. The caller keeps the key for retries of the same submit. */
export async function sendJson<T>(path: string, body: unknown, options: { key: string; method?: "POST" | "PATCH"; fallbackError: string }): Promise<WriteResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": options.key },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, data: null, message: options.fallbackError, details: [] };
  }
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string; details?: Array<{ field: string; issue: string }> } } | null;
  if (!response.ok || !payload || payload.data === undefined) {
    return { ok: false, data: null, message: payload?.error?.message || options.fallbackError, details: payload?.error?.details ?? [] };
  }
  return { ok: true, data: payload.data, message: "", details: [] };
}

/** One Idempotency-Key per logical submit: reused on retry, renewed after success or a changed payload. */
export function useSubmitKey(): { key: (fingerprint: string) => string; reset: () => void } {
  const ref = useRef<{ fingerprint: string; key: string } | null>(null);
  const key = useCallback((fingerprint: string) => {
    if (!ref.current || ref.current.fingerprint !== fingerprint) ref.current = { fingerprint, key: crypto.randomUUID() };
    return ref.current.key;
  }, []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { key, reset };
}

/** Number of minor-unit digits for a currency (JPY 0, INR 2, KWD 3 …), from Intl. */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, currency: string, locale: string | undefined): string {
  const digits = currencyDigits(currency);
  try {
    return new Intl.NumberFormat(locale || undefined, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

/** Plain decimal (no symbol) for file exports such as Tally XML. */
export function decimalAmount(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

/** Parse a user-entered major-unit amount into integer minor units; null when invalid. */
export function toMinorUnits(input: string, currency: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const digits = currencyDigits(currency);
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatDate(iso: string | null | undefined, locale: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(date);
}

export function formatPeriod(period: string | null | undefined, locale: string | undefined): string | null {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period ?? null;
  const date = new Date(`${period}-01T00:00:00`);
  return new Intl.DateTimeFormat(locale || undefined, { month: "long", year: "numeric" }).format(date);
}

export function formatNumber(value: number, locale: string | undefined, digits = 0): string {
  return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: digits }).format(value);
}

/** Current month as YYYY-MM in the viewer's clock. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Trigger a browser download of text content. */
export function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
