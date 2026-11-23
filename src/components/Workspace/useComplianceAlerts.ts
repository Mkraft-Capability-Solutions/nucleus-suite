"use client";

import { useCallback, useEffect, useState } from "react";
import { navigationFor, type AlertListResponse, type ComplianceAlert } from "@/lib/compliance-alerts";

/**
 * Compliance alerts for the header bell and the critical banner: GET /api/v1/alerts (scope from the
 * session), polled every 60 s, refreshed at once on `nucleus:alerts-changed` (sent after an
 * acknowledgement) and `nucleus:people-changed` (an employee record changed).
 */

export const ALERTS_CHANGED_EVENT = "nucleus:alerts-changed";
const POLL_MS = 60_000;

export type AlertsState = { status: "loading" } | { status: "ready"; data: AlertListResponse } | { status: "error" } | { status: "unavailable" };

export function useComplianceAlerts(query = "status=ACTIVE&pageSize=20") {
  const [state, setState] = useState<AlertsState>({ status: "loading" });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/v1/alerts?${query}`, { signal, cache: "no-store" });
      // Not entitled or not permitted: the feature is simply hidden.
      if (response.status === 403 || response.status === 401) { setState({ status: "unavailable" }); return; }
      const payload = (await response.json().catch(() => null)) as { data?: AlertListResponse } | null;
      if (!response.ok || !payload?.data) throw new Error("unavailable");
      setState({ status: "ready", data: payload.data });
    } catch {
      if (!signal?.aborted) setState({ status: "error" });
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(controller.signal), POLL_MS);
    const refresh = () => void load(controller.signal);
    window.addEventListener(ALERTS_CHANGED_EVENT, refresh);
    window.addEventListener("nucleus:people-changed", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(ALERTS_CHANGED_EVENT, refresh);
      window.removeEventListener("nucleus:people-changed", refresh);
    };
  }, [load]);

  return { state, reload: load };
}

/** PATCH /api/v1/alerts/:id/acknowledge; on success every alert view refreshes. */
export async function acknowledgeAlert(id: string): Promise<boolean> {
  const response = await fetch(`/api/v1/alerts/${encodeURIComponent(id)}/acknowledge`, {
    method: "PATCH",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  }).catch(() => null);
  if (response?.ok) window.dispatchEvent(new CustomEvent(ALERTS_CHANGED_EVENT, { detail: { id } }));
  return Boolean(response?.ok);
}

/** Open the employee profile at the section the alert concerns. */
export function openAlert(alert: ComplianceAlert) {
  window.dispatchEvent(new CustomEvent("nucleus:navigate_tab", { detail: navigationFor(alert) }));
}
