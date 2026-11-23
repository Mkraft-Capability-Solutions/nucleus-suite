"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Clock, CornerUpRight, Undo2, X, XCircle } from "lucide-react";
import { useT } from "@/hooks/useT";
import { isDecidable, useApprovalDecision, type ApprovalItem } from "./ApprovalDecisionForm";
import styles from "./ApprovalActionModal.module.css";

/**
 * Approve / reject / return a queue item through POST /api/v1/workspace/approvals (Idempotency-Key + If-Match).
 * Only the decisions the server lists for the item (`item.actions`) are enabled. Re-route has no workflow
 * transition (no per-item reassignment API), so it stays visible but disabled with the reason.
 * `onSubmit` is called only after the server accepted the decision.
 */
const NS = "components.Dashboard.Modals.ApprovalActionModal";
type Decision = "approve" | "reject" | "return" | "reroute";
type Props = { isOpen: boolean; onClose: () => void; item: (Partial<ApprovalItem> & { name?: string; type?: string }) | null; initialAction?: Decision; onSubmit?: (result: { id: string; actionType: string; remarks: string; item: unknown }) => void };

export default function ApprovalActionModal(props: Props) {
  if (!props.isOpen || !props.item) return null;
  return <ApprovalActionForm key={`${props.item.id}:${props.initialAction ?? "approve"}`} {...props} />;
}

function ApprovalActionForm({ onClose, item, initialAction = "approve", onSubmit }: Props) {
  const { t, locale } = useT();
  const { decide, busy, error, setError } = useApprovalDecision(NS);
  const [action, setAction] = useState<Decision>(initialAction);
  const [remarks, setRemarks] = useState("");
  const decidable = isDecidable(item);
  const allowed = new Set(decidable ? item.actions ?? [] : []);
  const enabled = (decision: Decision) => decision !== "reroute" && allowed.has(decision);

  const tabs: Array<{ id: Decision; icon: typeof CheckCircle2; label: string }> = [
    { id: "approve", icon: CheckCircle2, label: t(`${NS}.content_text_9`, "Approve") },
    { id: "reject", icon: XCircle, label: t(`${NS}.content_text_10`, "Reject") },
    { id: "return", icon: Undo2, label: t(`${NS}.text_return`, "Return") },
    { id: "reroute", icon: CornerUpRight, label: t(`${NS}.content_text_11`, "Re-route") },
  ];
  const reason = !decidable
    ? t(`${NS}.text_not_decidable`, "This item is not linked to an approval record, so no decision can be recorded.")
    : action === "reroute"
      ? t(`${NS}.text_reroute_unavailable`, "Re-routing is not supported by the approval workflow. Use Return to send the item back to the requester.")
      : !enabled(action)
        ? t(`${NS}.text_decision_not_allowed`, "This decision is not available for the item in its current state.")
        : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!decidable || reason) return;
    if (await decide(item, action, remarks)) {
      onSubmit?.({ id: item.id, actionType: action, remarks: remarks.trim(), item });
      onClose();
    }
  };
  const updated = item?.updatedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updatedAt)) : null;

  return (
    <div className={styles.overlay} onClick={() => !busy && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="approval-action-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <h3 id="approval-action-title" className={styles.headerTitle}>{t(`${NS}.text_title`, "Decide approval request")}</h3>
              <div className={styles.headerSubtitle}>{t(`${NS}.text_subtitle`, "Every decision is recorded with your reason in the audit trail.")}</div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.content_title_8`, "Close")}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className={styles.body} noValidate>
          <div className={styles.actionTabs} role="group" aria-label={t(`${NS}.text_decision`, "Decision")}>
            {tabs.map(({ id, icon: Icon, label }) => (
              <button key={id} type="button" aria-pressed={action === id} className={`${styles.actionTabBtn} ${action === id ? styles.tabActiveApprove : ""}`} onClick={() => { setAction(id); setError(""); }}>
                <Icon size={14} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLeft}>
              <span className={styles.summaryName}>{item?.title || item?.name || "—"}</span>
              <span className={styles.summaryType}>{item?.feature || item?.type || ""}</span>
            </div>
            {updated && <span className={styles.summaryType}><Clock size={11} aria-hidden="true" /> {updated}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="approval-remarks">{t(`${NS}.text_reason`, "Reason")} <span className={styles.badgeCompulsory}>{t(`${NS}.content_text_17`, "Required")}</span></label>
            <textarea id="approval-remarks" className={styles.textareaInput} rows={3} maxLength={1000} value={remarks} disabled={Boolean(reason) || busy} onChange={(e) => { setRemarks(e.target.value); setError(""); }} aria-invalid={Boolean(error) || undefined} />
          </div>
          {(reason || error) && <div className={styles.errorBanner} role={error ? "alert" : "note"}><AlertCircle size={15} aria-hidden="true" /><span>{error || reason}</span></div>}
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={busy}>{t(`${NS}.content_text_19`, "Cancel")}</button>
            <button type="submit" className={styles.submitBtnApprove} disabled={busy || Boolean(reason)}>{busy ? t(`${NS}.text_saving`, "Recording…") : t(`${NS}.text_confirm`, "Confirm decision")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
