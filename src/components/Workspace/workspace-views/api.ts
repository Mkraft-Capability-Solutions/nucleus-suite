"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";

export type LoadState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

/** Loads one GET route and returns the `data.attributes` projection, with reload. */
export function useApiResource<T>(path: string | null) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((body) => {
        if (cancelled) return;
        const data = (body as { data?: { attributes?: T } | T[] } | null)?.data;
        const value = Array.isArray(data) ? (data as T) : (data as { attributes?: T } | undefined)?.attributes;
        setState(value === undefined ? { status: "error", message: "" } : { status: "ready", data: value });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "" });
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const reload = useCallback(() => {
    if (path) invalidateGetRequest(path);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, [path]);

  return { state, reload };
}
