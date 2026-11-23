"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/I18nContext";

/** Client data helpers for the compliance workspace: honest load states and idempotent writes. */

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;
export const NS = "components.Workspace.ComplianceView";

export function useT(): { t: Translate; locale: string } {
  const { t, locale } = useTranslation();
  return { t: t as Translate, locale };
}

export type FieldIssue = { field: string; issue: string };
/** One shape for every submit outcome (the project compiles without strict narrowing). */
export type SubmitResult<R> = { ok: boolean; data: R | null; problem: Problem | null };
export type Problem = { message: string; details: FieldIssue[]; status: number | null };

type Envelope<T> = { data?: T; error?: { message?: string; details?: FieldIssue[] } };

export type Resource<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

/** GET one resource; `url` null means "not requested yet" and stays loading-free. */
export function useResource<T>(url: string | null, fallbackMessage: string): { state: Resource<T> | { status: "idle" }; reload: () => Promise<void> } {
  const [state, setState] = useState<Resource<T> | { status: "idle" }>(url ? { status: "loading" } : { status: "idle" });
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!url) {
        setState({ status: "idle" });
        return;
      }
      setState((current) => (current.status === "ready" ? current : { status: "loading" }));
      try {
        const response = await fetch(url, { signal, cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
        if (!response.ok || !payload || payload.data === undefined) throw new Error(payload?.error?.message || fallbackMessage);
        setState({ status: "ready", data: payload.data });
      } catch (error) {
        if (!signal?.aborted) setState({ status: "error", message: error instanceof Error && error.message ? error.message : fallbackMessage });
      }
    },
    [url, fallbackMessage],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const reload = useCallback(() => load(), [load]);
  return { state, reload };
}

/**
 * One logical submit = one Idempotency-Key. The key is kept while the same payload is retried after a
 * failure and is discarded once the server accepts the write or the payload changes.
 */
export function useSubmit() {
  const keyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submit = useCallback(
    async <R,>(url: string, body: unknown, fallbackMessage: string, headers: Record<string, string> = {}): Promise<SubmitResult<R>> => {
      const fingerprint = `${url}:${JSON.stringify(body)}`;
      if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) keyRef.current = { key: crypto.randomUUID(), fingerprint };
      setPending(true);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current.key, ...headers },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as Envelope<R> | null;
        if (!response.ok) {
          return { ok: false, data: null, problem: { message: payload?.error?.message || fallbackMessage, details: payload?.error?.details ?? [], status: response.status } };
        }
        keyRef.current = null;
        return { ok: true, data: (payload?.data ?? null) as R | null, problem: null };
      } catch {
        return { ok: false, data: null, problem: { message: fallbackMessage, details: [], status: null } };
      } finally {
        setPending(false);
      }
    },
    [],
  );
  return { submit, pending };
}

export function fieldErrors(problem: Problem | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const detail of problem?.details ?? []) if (detail.field && !map[detail.field]) map[detail.field] = detail.issue;
  return map;
}

export function formatMoney(minor: number | null, currency: string | null, locale: string): string | null {
  if (minor === null || !currency) return null;
  return new Intl.NumberFormat(locale || undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100);
}

export function formatNumber(value: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: digits }).format(value);
}

export function formatDate(iso: string | null, locale: string, withTime = false): string | null {
  if (!iso) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale || undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/**
 * Opens a print view built only from escaped text. Used for statutory certificates and receipts so the
 * printed copy is reproducible from stored data.
 */
export function printRecord(args: { title: string; lang: string; sections: Array<{ heading?: string; rows?: Array<[string, string]>; table?: { headers: string[]; rows: string[][] }; paragraph?: string }> }): boolean {
  if (typeof window === "undefined") return false;
  const body = args.sections
    .map((section) => {
      const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : "";
      const paragraph = section.paragraph ? `<p>${escapeHtml(section.paragraph)}</p>` : "";
      const rows = section.rows ? `<dl>${section.rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>` : "";
      const table = section.table
        ? `<table><thead><tr>${section.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${section.table.rows
            .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
        : "";
      return `<section>${heading}${paragraph}${rows}${table}</section>`;
    })
    .join("");
  const html = `<!doctype html><html lang="${escapeHtml(args.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(args.title)}</title><style>body{font-family:Inter,system-ui,sans-serif;margin:24px;color:CanvasText;background:Canvas}h1{font-size:20px}h2{font-size:15px;margin-block:18px 6px}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}dt{font-weight:600}table{border-collapse:collapse;width:100%}th,td{border:1px solid GrayText;padding:6px 8px;text-align:start;font-size:13px}</style></head><body><h1>${escapeHtml(args.title)}</h1>${body}<script>window.onload=function(){window.print()}</script></body></html>`;
  const view = window.open("", "_blank");
  if (!view) return false;
  view.document.open();
  view.document.write(html);
  view.document.close();
  return true;
}
