"use client";

import { useRef, useState } from "react";
import { useHRMS } from "@/context/HRMSContext";
import { useT } from "@/hooks/useT";
import { newIdempotencyKey, sendJson } from "@/lib/api-mutation";

/**
 * Shared decision submitter for approval-queue items (GET /api/v1/workspace/approvals rows).
 * POST /api/v1/workspace/approvals { resource, id, decision, reason } with Idempotency-Key and If-Match (item version).
 * The server enforces permission, no self-approval and legal transitions; reason ≥ 3 characters (same rule here).
 */
export type ApprovalItem = { id: string; version: number; resource: string; title?: string; status?: string; feature?: string; updatedAt?: string; actions?: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isDecidable = (item: Partial<ApprovalItem> | null | undefined): item is ApprovalItem =>
  Boolean(item && typeof item.resource === "string" && item.resource && typeof item.id === "string" && UUID.test(item.id) && Number.isInteger(item.version));

export function useApprovalDecision(ns: string) {
  const { t } = useT();
  const { showToast } = useHRMS();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  const decide = async (item: ApprovalItem, decision: string, reason: string): Promise<boolean> => {
    if (busy) return false;
    if (reason.trim().length < 3) {
      setError(t(`${ns}.text_reason_required`, "Give a reason for this decision (at least 3 characters)."));
      return false;
    }
    const sig = `${item.resource}:${item.id}:${decision}:${reason.trim()}`;
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };
    setBusy(true);
    setError("");
    const result = await sendJson("/api/v1/workspace/approvals", {
      idempotencyKey: keyRef.current.key,
      ifMatch: item.version,
      body: { resource: item.resource, id: item.id, decision, reason: reason.trim() },
    });
    setBusy(false);
    if (!result.ok) {
      if (result.status !== null) keyRef.current = null;
      const message = result.message || t(`${ns}.text_decision_failed`, "The decision was not recorded. Try again.");
      setError(message);
      showToast(t(`${ns}.text_decision_failed_title`, "Decision not recorded"), message, "error");
      return false;
    }
    keyRef.current = null;
    window.dispatchEvent(new CustomEvent("nucleus:action-completed", { detail: { action: "approval", resource: item.resource, id: item.id, decision } }));
    showToast(t(`${ns}.text_decision_saved_title`, "Decision recorded"), t(`${ns}.text_decision_saved`, "{title} was updated.", { title: item.title || item.feature || item.resource }), "success");
    return true;
  };

  return { decide, busy, error, setError };
}
