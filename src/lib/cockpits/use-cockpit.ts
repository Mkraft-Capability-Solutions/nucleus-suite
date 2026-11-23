"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Loads one cockpit aggregation from GET /api/v1/cockpits/{id}. The server enforces who may open it (403) and
 * scopes every figure to the caller's tenant; this hook only exposes loading / ready / error and a reload.
 */
export type CockpitState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; completeness: "complete" | "partial"; generatedAt: string | null }
  | { status: "error"; message: string; forbidden: boolean };

type Envelope<T> = { data?: T; meta?: { completeness?: "complete" | "partial"; generatedAt?: string }; error?: { message?: string } };

export function useCockpit<T>(cockpitId: string): { state: CockpitState<T>; reload: () => void } {
  const [state, setState] = useState<CockpitState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/cockpits/${encodeURIComponent(cockpitId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
        if (!response.ok || !payload?.data) {
          setState({ status: "error", message: payload?.error?.message ?? "", forbidden: response.status === 403 });
          return;
        }
        setState({ status: "ready", data: payload.data, completeness: payload.meta?.completeness ?? "complete", generatedAt: payload.meta?.generatedAt ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", message: "", forbidden: false });
      });
    return () => controller.abort();
  }, [cockpitId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
