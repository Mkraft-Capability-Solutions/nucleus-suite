"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import { unwrapRecords } from "@/lib/workflow-catalog";

/**
 * Shared client data-access for the Workforce Operations surfaces.
 *
 * Every Workforce Operations page reads through the catalog-driven operational
 * engine (`/api/v1/operations/<resource>`), which supplies optimistic
 * concurrency (`If-Match`), idempotency and permission scoping. These helpers
 * keep that contract in one place so pages never hand-roll it.
 */

export type UnknownRecord = Record<string, unknown>;

export type OperationalRecord = UnknownRecord & {
  id: string;
  version: number;
  status: string;
};

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function listFromEnvelope(payload: unknown): UnknownRecord[] {
  return unwrapRecords(payload) as UnknownRecord[];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartISO(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Renders a minute count as `9h 15m`, the notation used across attendance surfaces. */
export function minutesLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** Formats an integer minor-unit amount (paise) as Indian rupees. */
export function currencyLabel(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export function dateLabel(value: unknown, fallback = "Not set"): string {
  const raw = str(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

export type LiveState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};

/** Fetches a JSON endpoint, re-fetching whenever `path` changes or `refresh()` is called. */
export function useLive<T = unknown>(path: string): LiveState<T> {
  const [entry, setEntry] = useState<{ path: string; value: unknown } | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (cancelled) return;
        setEntry({ path, value });
        setError("");
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "This data could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const data = entry && entry.path === path ? (entry.value as T) : null;
  const refresh = useCallback(() => {
    if (path) invalidateGetRequest(path);
    setTick((current) => current + 1);
  }, [path]);

  return { data, loading: Boolean(path) && data === null && !error, error, refresh };
}

export function operationalPath(resource: string, query: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams({ pageSize: "100" });
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return `/api/v1/operations/${resource}?${params.toString()}`;
}

export type OperationalState = {
  rows: OperationalRecord[];
  loading: boolean;
  error: string;
  refresh: () => void;
};

/** Lists records for one catalog resource. */
export function useOperational(resource: string, query: Record<string, string | undefined> = {}): OperationalState {
  const path = operationalPath(resource, query);
  const state = useLive(path);
  const rows = useMemo(
    () =>
      listFromEnvelope(state.data).map((row) => ({
        ...row,
        id: str(row.id),
        version: num(row.version, 1),
        status: str(row.status, "unknown"),
      })),
    [state.data],
  );
  return { rows, loading: state.loading, error: state.error, refresh: state.refresh };
}

export type MutationResult = { ok: boolean; message: string };

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function send(path: string, method: string, body: UnknownRecord, version?: number): Promise<MutationResult> {
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey(),
    };
    if (version !== undefined) headers["if-match"] = `"${version}"`;
    const response = await fetch(path, { method, headers, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    const error = asRecord(payload.error);
    if (response.status === 409) {
      return { ok: false, message: str(error.message, "This record changed while you were editing. Reload and try again.") };
    }
    return { ok: false, message: str(error.message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

/** Creates a record in a catalog resource. */
export function createRecord(resource: string, input: UnknownRecord): Promise<MutationResult> {
  return send(`/api/v1/operations/${resource}`, "POST", input);
}

/** Edits a record. Only allowed while the record is in an editable status. */
export function editRecord(resource: string, id: string, version: number, input: UnknownRecord): Promise<MutationResult> {
  return send(`/api/v1/operations/${resource}/${id}`, "PATCH", input, version);
}

/**
 * Runs a declared workflow transition. The engine rejects any field the action
 * does not declare, so `body` carries only the transition's own inputs.
 */
export function runTransition(
  resource: string,
  id: string,
  version: number,
  action: string,
  body: UnknownRecord = {},
): Promise<MutationResult> {
  return send(`/api/v1/operations/${resource}/${id}/${action}`, "POST", { reason: "Actioned from the workforce console.", ...body }, version);
}

/** Maps a workflow status onto the shared StatusPill tones. */
export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["approved", "active", "published", "completed", "done", "resolved", "reimbursed", "accepted", "allocated"].includes(status)) return "success";
  if (["submitted", "pending", "open", "in_progress", "review", "filed"].includes(status)) return "warning";
  if (["rejected", "returned", "maintenance", "overdue", "cancelled"].includes(status)) return "danger";
  if (["draft", "todo", "available", "finalized", "retired", "archived", "withdrawn"].includes(status)) return "info";
  return "neutral";
}

/** Employee directory, used wherever a record names a person. */
export function usePeople() {
  const state = useLive("/api/v1/people?search=&page=1&pageSize=100");
  const people = useMemo(() => listFromEnvelope(state.data), [state.data]);
  const byId = useMemo(() => {
    const index = new Map<string, UnknownRecord>();
    for (const person of people) index.set(str(person.id), person);
    return index;
  }, [people]);
  const nameOf = useCallback(
    (id: unknown, fallback = "Unassigned") => {
      const person = byId.get(str(id));
      if (!person) return fallback;
      const attributes = asRecord(person.attributes);
      return str(person.displayName, str(person.fullName, str(attributes.fullName, str(attributes.displayName, fallback))));
    },
    [byId],
  );
  return { people, byId, nameOf, loading: state.loading, error: state.error };
}
