"use client";

import { useId, useRef, useState } from "react";
import { useTranslation } from "@/context/I18nContext";
import type { Source } from "@/lib/cockpits/source-types";
import type { TriageItem } from "@/lib/cockpits/manager-cockpit-types";
import { formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./ManagerCockpit.module.css";

/**
 * Approvals waiting on the manager. Leave and comp-off decide through POST /api/v1/leave-requests/{id}/decide;
 * expense and timesheet rows are operational records and decide through POST /api/v1/workspace/approvals with
 * Idempotency-Key and If-Match. A row leaves the list only after the server accepts the decision.
 */

const NS = "components.Dashboard.Views.ManagerCockpit";
const MIN_REASON = 3;

type Decision = "approve" | "reject";
type Pending = { id: string; decision: Decision };
type ErrorEnvelope = { error?: { message?: string } };

function formatMoney(amountMinor: number, currency: string, locale: string | undefined): string {
  try {
    const format = new Intl.NumberFormat(locale || undefined, { style: "currency", currency });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(amountMinor / 10 ** digits);
  } catch {
    return `${formatNumber(amountMinor, locale)} ${currency}`;
  }
}

/** `failure` is null when the server accepted the decision, otherwise the server's message (possibly empty). */
async function sendDecision(item: TriageItem, decision: Decision, reason: string, key: string): Promise<{ failure: string | null }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": key };
  let url: string;
  let body: string;
  if (item.resource === null) {
    url = `/api/v1/leave-requests/${encodeURIComponent(item.id)}/decide`;
    body = JSON.stringify({ approve: decision === "approve", comment: reason });
  } else {
    url = "/api/v1/workspace/approvals";
    headers["If-Match"] = String(item.version);
    body = JSON.stringify({ resource: item.resource, id: item.id, decision, reason });
  }
  try {
    const response = await fetch(url, { method: "POST", headers, body, cache: "no-store" });
    if (response.ok) return { failure: null };
    const payload = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    return { failure: payload?.error?.message ?? "" };
  } catch {
    return { failure: "" };
  }
}

export default function TriageList({ source, onDecided }: { source: Source<TriageItem[]>; onDecided: (count: number) => void }) {
  const t = useT();
  const { locale } = useTranslation();
  const reasonId = useId();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  /** One key per logical request (item + decision + reason), so a retry of the same request reuses it. */
  const keys = useRef(new Map<string, string>());

  const rows = source.value.filter((item) => !hidden.has(item.id));

  const open = (id: string, decision: Decision) => {
    setPending({ id, decision });
    setReason("");
    setError("");
  };

  const submit = async (item: TriageItem, decision: Decision) => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setError(t(`${NS}.text_reason_required`, "Give a reason of at least {min} characters.", { min: MIN_REASON }));
      return;
    }
    const logical = `${item.id}|${decision}|${trimmed}`;
    const key = keys.current.get(logical) ?? crypto.randomUUID();
    keys.current.set(logical, key);
    setBusy(true);
    setError("");
    const result = await sendDecision(item, decision, trimmed, key);
    setBusy(false);
    if (result.failure !== null) {
      setError(result.failure || t(`${NS}.text_decision_failed`, "The decision could not be recorded. Try again."));
      return;
    }
    keys.current.delete(logical);
    const next = new Set(hidden);
    next.add(item.id);
    setHidden(next);
    setPending(null);
    setAnnouncement(decision === "approve"
      ? t(`${NS}.text_approved_toast`, "Approved {name} ({type}).", { name: item.employeeName, type: item.kindLabel })
      : t(`${NS}.text_rejected_toast`, "Rejected {name} ({type}).", { name: item.employeeName, type: item.kindLabel }));
    onDecided(next.size);
  };

  return (
    <>
      <p className={announcement ? styles.toast : styles.srOnly} role="status" aria-live="polite">{announcement}</p>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t(`${NS}.text_no_approvals`, "No approvals are waiting on you.")}</p>
      ) : (
        <ul className={styles.triageList}>
          {rows.map((item) => {
            const isOpen = pending?.id === item.id;
            return (
              <li key={`${item.kind}:${item.id}`} className={styles.triageRow}>
                <div className={styles.triageHead}>
                  <div className={styles.triageText}>
                    <strong>{item.employeeName}</strong>
                    <span className={styles.muted}>{item.title}</span>
                    <span className={styles.muted}>{item.detail}</span>
                  </div>
                  <div className={styles.triageActions}>
                    <span className={`${shared.pillBadge} ${shared.pillSlate}`}>{item.kindLabel}</span>
                    {item.amountMinor !== null && item.currency && <span className={styles.amount}>{formatMoney(item.amountMinor, item.currency, locale)}</span>}
                    <button type="button" className={`${shared.btnRowAction} ${styles.approveBtn}`} onClick={() => open(item.id, "approve")} aria-expanded={isOpen && pending?.decision === "approve"}>
                      {t(`${NS}.text_approve`, "Approve")}
                    </button>
                    <button type="button" className={`${shared.btnRowAction} ${styles.rejectBtn}`} onClick={() => open(item.id, "reject")} aria-expanded={isOpen && pending?.decision === "reject"}>
                      {t(`${NS}.text_reject`, "Reject")}
                    </button>
                    <button type="button" className={`${shared.btnRowAction} ${styles.rerouteBtn}`} disabled title={t(`${NS}.text_reroute_unavailable`, "Re-routing to another approver is not available yet.")}>
                      {t(`${NS}.text_reroute`, "Re-route")}
                    </button>
                  </div>
                </div>
                {isOpen && pending && (
                  <form className={styles.decisionForm} onSubmit={(event) => { event.preventDefault(); void submit(item, pending.decision); }}>
                    <label htmlFor={`${reasonId}-${item.id}`} className={styles.reasonLabel}>
                      {pending.decision === "approve" ? t(`${NS}.text_reason_approve`, "Reason for approving") : t(`${NS}.text_reason_reject`, "Reason for rejecting")} *
                    </label>
                    <textarea
                      id={`${reasonId}-${item.id}`}
                      className={styles.reasonInput}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      required
                      aria-required="true"
                      aria-invalid={error !== ""}
                      aria-describedby={error ? `${reasonId}-${item.id}-error` : undefined}
                    />
                    {error && <p id={`${reasonId}-${item.id}-error`} className={styles.error} role="alert">{error}</p>}
                    <div className={styles.formActions}>
                      <button type="button" className={shared.btnRowAction} onClick={() => setPending(null)} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
                      <button type="submit" className={`${shared.btnRowAction} ${pending.decision === "approve" ? styles.approveBtn : styles.rejectBtn}`} disabled={busy}>
                        {busy ? t(`${NS}.text_sending`, "Sending…") : pending.decision === "approve" ? t(`${NS}.text_confirm_approve`, "Confirm approval") : t(`${NS}.text_confirm_reject`, "Confirm rejection")}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
