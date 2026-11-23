"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import type { TeamHistoryPayload } from "./data";

export type HistoryState =
  | { status: "loading" }
  | { status: "ready"; data: TeamHistoryPayload; loadedAt: Date }
  | { status: "error"; message: string };

const path = (from: string, to: string) => `/api/v1/reports/team-history?${new URLSearchParams({ from, to }).toString()}`;

/** Loads per-day attendance, OT and (unless masked) basic salary for the permitted scope. */
export function useTeamHistory(from: string, to: string) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson(path(from, to))
      .then((body) => {
        if (cancelled) return;
        const data = (body as { data?: TeamHistoryPayload } | null)?.data;
        setState(data && Array.isArray(data.rows) ? { status: "ready", data, loadedAt: new Date() } : { status: "error", message: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "" });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, attempt]);

  const reload = useCallback(() => {
    invalidateGetRequest(path(from, to));
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, [from, to]);

  return { state, reload };
}
