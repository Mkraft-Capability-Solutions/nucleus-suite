"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";

/**
 * Minimal read hook over the coalescing `getJson` client: an explicit loading / ready / error state machine
 * (never a fake value while loading or after a failure) and a `reload` that bypasses in-flight reuse.
 * `path === null` means "not requested" (for example, the caller has no linked employee yet).
 * After a reload the previous data stays visible until the fresh response arrives.
 */
export type ResourceState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string; httpStatus: number | null };

type Settled<T> = { key: string; path: string; result: Exclude<ResourceState<T>, { status: "idle" } | { status: "loading" }> };

export function useApiResource<T>(path: string | null, select: (payload: unknown) => T): { state: ResourceState<T>; reload: () => void } {
  const [generation, setGeneration] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  // `select` is a pure projection usually supplied inline; keep the latest one without re-fetching on its identity.
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });
  const key = path ? `${generation}:${path}` : null;

  useEffect(() => {
    if (!path || !key) return;
    let active = true;
    getJson(path)
      .then((payload) => {
        if (active) setSettled({ key, path, result: { status: "ready", data: selectRef.current(payload) } });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const httpStatus = typeof error === "object" && error !== null && "status" in error ? ((error as { status: number | null }).status ?? null) : null;
        setSettled({ key, path, result: { status: "error", message: error instanceof Error ? error.message : "", httpStatus } });
      });
    return () => {
      active = false;
    };
  }, [path, key]);

  const reload = useCallback(() => {
    if (path) invalidateGetRequest(path);
    setGeneration((value) => value + 1);
  }, [path]);

  let state: ResourceState<T>;
  if (!path) state = { status: "idle" };
  else if (settled?.key === key) state = settled.result;
  else if (settled?.path === path && settled.result.status === "ready") state = settled.result;
  else state = { status: "loading" };
  return { state, reload };
}

/** `{ data: [...] }` envelope → array (collection routes). */
export function selectList<T>(payload: unknown): T[] {
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

/** `{ data: {...} }` envelope → object (ok() routes). */
export function selectData<T>(payload: unknown): T {
  return ((payload as { data?: unknown } | null)?.data ?? null) as T;
}
