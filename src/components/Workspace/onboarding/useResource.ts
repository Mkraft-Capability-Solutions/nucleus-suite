"use client";

import { useCallback, useEffect, useState } from "react";
import { getData } from "./api";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

/**
 * Loads one GET resource with loading / ready / error states and a `reload` for after a
 * confirmed write. `url === null` keeps the resource idle (loading) until it is needed.
 */
export function useResource<T>(url: string | null, fallback: string): { state: ResourceState<T>; reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    getData<T>(url, fallback, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ status: "ready", data }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : fallback }); },
    );
    return () => controller.abort();
  }, [url, fallback, generation]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  return { state, reload };
}
