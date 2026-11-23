"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import type { AnalyticsPeriod, WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";

export type InsightsState =
  | { status: "loading" }
  | { status: "ready"; data: WorkforceInsightsPayload }
  | { status: "error"; message: string };

export function insightsPath(period: AnalyticsPeriod, department: string | null): string {
  const params = new URLSearchParams({ period });
  if (department) params.set("department", department);
  return `/api/v1/analytics/workforce-insights?${params.toString()}`;
}

/** Loads GET /api/v1/analytics/workforce-insights for one period and department; exposes reload. */
export function useWorkforceInsights(period: AnalyticsPeriod, department: string | null) {
  const [state, setState] = useState<InsightsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson(insightsPath(period, department))
      .then((body) => {
        if (cancelled) return;
        const data = (body as { data?: WorkforceInsightsPayload } | null)?.data;
        setState(data ? { status: "ready", data } : { status: "error", message: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "" });
      });
    return () => {
      cancelled = true;
    };
  }, [period, department, attempt]);

  const reload = useCallback(() => {
    invalidateGetRequest(insightsPath(period, department));
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, [period, department]);

  return { state, reload };
}
