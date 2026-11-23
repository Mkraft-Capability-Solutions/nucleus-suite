"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getData } from "./attendanceApi";

export type Resource<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

type Settled<T> = { path: string; generation: number; result: Resource<T> };

/**
 * Loads one API path and exposes loading / ready / error plus a reload. A null path stays idle (used when a
 * prerequisite such as the signed-in employee id is not known yet). A reload of the same path keeps its rows on
 * screen; a different path (another month) never shows stale data. Stale responses are dropped.
 */
export function useResource<T>(path: string | null, fallbackMessage: string): { state: Resource<T>; reload: () => void } {
  const [generation, setGeneration] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    getData<T>(path, fallbackMessage, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSettled({ path, generation, result: { status: "ready", data } }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setSettled({ path, generation, result: { status: "error", message: errorMessage(error, fallbackMessage) } }); });
    return () => controller.abort();
  }, [path, fallbackMessage, generation]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  let state: Resource<T>;
  if (!path) state = { status: "idle" };
  else if (settled && settled.path === path && (settled.generation === generation || settled.result.status === "ready")) state = settled.result;
  else state = { status: "loading" };
  return { state, reload };
}
