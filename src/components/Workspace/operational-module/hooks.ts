"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, fetchAudit, fetchLookup, fetchRecords, lookupKindFor, NS, recordsUrl,
  type AuditEvent, type LookupKind, type LookupState, type ModuleRecord, type OperationalModule, type Translate,
} from "./data";

export type RecordsState =
  | { status: "loading" }
  | { status: "ready"; items: ModuleRecord[]; total: number }
  | { status: "error"; message: string; code: string; httpStatus: number };

/** Server-paginated, server-searched records of one module. */
export function useModuleRecords(module: OperationalModule, t: Translate) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ key: string; state: RecordsState } | null>(null);
  const url = recordsUrl(module);
  const requestKey = `${url}|${page}|${pageSize}|${debounced}|${reloadToken}`;

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const fallback = t(`${NS}.text_load_failed`, "Records could not be loaded.");
    fetchRecords(url, { page, pageSize, search: debounced }, controller.signal, fallback)
      .then(({ items, total }) => setResult({ key: requestKey, state: { status: "ready", items, total } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = error instanceof ApiError ? error : null;
        setResult({ key: requestKey, state: {
          status: "error",
          message: error instanceof Error ? error.message : fallback,
          code: apiError?.code ?? "REQUEST_FAILED",
          httpStatus: apiError?.status ?? 0,
        } });
      });
    return () => controller.abort();
  }, [url, page, pageSize, debounced, requestKey, t]);

  const state: RecordsState = result && result.key === requestKey ? result.state : { status: "loading" };

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  const updateSearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);
  const updatePageSize = useCallback((value: number) => { setPageSize(value); setPage(1); }, []);
  /** Replace one record in place after the server confirmed a write. */
  const replace = useCallback((record: ModuleRecord) => {
    setResult((current) => current && current.state.status === "ready"
      ? { ...current, state: { ...current.state, items: current.state.items.map((item) => (item.id === record.id ? record : item)) } }
      : current);
  }, []);

  return { state, page, setPage, pageSize, setPageSize: updatePageSize, search, setSearch: updateSearch, reload, replace };
}

/** Master lists the module's lookup fields need (first 100 entries, used for pickers and label resolution). */
export function useLookups(module: OperationalModule, t: Translate) {
  // A string key keeps the effect stable when the registry hands out a fresh module object per render.
  const kindsKey = [...new Set(module.fields.map(lookupKindFor).filter((kind): kind is LookupKind => kind !== null))].join(",");
  const kinds = useMemo(() => (kindsKey ? (kindsKey.split(",") as LookupKind[]) : []), [kindsKey]);
  const [results, setLookups] = useState<Partial<Record<LookupKind, LookupState>>>({});

  useEffect(() => {
    const controller = new AbortController();
    for (const kind of kinds) {
      fetchLookup(kind, "", controller.signal, t(`${NS}.text_lookup_failed`, "This list could not be loaded."))
        .then((options) => setLookups((current) => ({ ...current, [kind]: { status: "ready", options } })))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : t(`${NS}.text_lookup_failed`, "This list could not be loaded.");
          setLookups((current) => ({ ...current, [kind]: { status: "error", message } }));
        });
    }
    return () => controller.abort();
  }, [kinds, t]);

  return useMemo(() => Object.fromEntries(kinds.map((kind) => [kind, results[kind] ?? { status: "loading" }])) as Partial<Record<LookupKind, LookupState>>, [kinds, results]);
}

export type AuditState = { status: "idle" | "loading" } | { status: "ready"; events: AuditEvent[] } | { status: "error"; message: string };

/** Audit events recorded for one record id. */
export function useAuditTrail(recordId: string | null, refreshToken: number, t: Translate): AuditState {
  const [result, setResult] = useState<{ key: string; state: AuditState } | null>(null);
  const requestKey = `${recordId ?? ""}|${refreshToken}`;
  useEffect(() => {
    if (!recordId) return;
    const controller = new AbortController();
    const fallback = t(`${NS}.text_audit_failed`, "The audit trail could not be loaded.");
    fetchAudit(recordId, controller.signal, fallback)
      .then((events) => setResult({ key: requestKey, state: { status: "ready", events } }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, state: { status: "error", message: error instanceof Error ? error.message : fallback } });
      });
    return () => controller.abort();
  }, [recordId, requestKey, t]);
  if (!recordId) return { status: "idle" };
  return result && result.key === requestKey ? result.state : { status: "loading" };
}

/** One Idempotency-Key per logical submit: reused while the payload is unchanged (retries), renewed otherwise. */
export function useIdempotencyKey() {
  const ref = useRef<{ key: string; fingerprint: string } | null>(null);
  const keyFor = useCallback((payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!ref.current || ref.current.fingerprint !== fingerprint) ref.current = { key: crypto.randomUUID(), fingerprint };
    return ref.current.key;
  }, []);
  const reset = useCallback(() => { ref.current = null; }, []);
  return { keyFor, reset };
}
