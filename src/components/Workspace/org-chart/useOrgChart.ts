"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import type { OrgChartPayload } from "./data";

const PATH = "/api/v1/org-chart";

export type OrgChartState =
  | { status: "loading" }
  | { status: "ready"; data: OrgChartPayload }
  | { status: "error"; message: string };

/** Loads the tenant org chart (active and probation employees with stored manager links). */
export function useOrgChart() {
  const [state, setState] = useState<OrgChartState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson(PATH)
      .then((body) => {
        if (cancelled) return;
        const data = (body as { data?: OrgChartPayload } | null)?.data;
        setState(data && Array.isArray(data.roots) ? { status: "ready", data } : { status: "error", message: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    invalidateGetRequest(PATH);
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
