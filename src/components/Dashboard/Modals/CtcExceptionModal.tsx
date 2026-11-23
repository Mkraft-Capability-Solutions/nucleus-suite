"use client";

import { useState } from "react";
import Close from "@mui/icons-material/Close";
import CheckCircle from "@mui/icons-material/CheckCircleOutline";
import Cancel from "@mui/icons-material/CancelOutlined";
import TrendingUp from "@mui/icons-material/TrendingUp";
import { useT } from "@/hooks/useT";
import { isDecidable, useApprovalDecision, type ApprovalItem } from "./ApprovalDecisionForm";
import styles from "./CtcExceptionModal.module.css";

/**
 * CTC exception decision. Decisions go only through POST /api/v1/workspace/approvals (Idempotency-Key + If-Match)
 * for a real approval-queue item ({ resource, id, version, actions }). No demo request is ever shown: values not
 * supplied by the caller render as "not available". CTC exceptions are not yet a workflow resource, so an item
 * without a linked approval record renders its decision buttons disabled with the reason. Money via Intl.
 */
const NS = "components.Dashboard.Modals.CtcExceptionModal";

type CtcRequest = Partial<ApprovalItem> & {
  candidateName?: string; role?: string; department?: string; hiringManager?: string;
  approvedBandMax?: number; requestedCtc?: number; currency?: string; justification?: string;
};
type Props = { isOpen: boolean; onClose: () => void; requestData?: CtcRequest | null; onApprove?: (r: unknown) => void; onReject?: (r: unknown) => void };

export default function CtcExceptionModal({ isOpen, onClose, requestData, onApprove, onReject }: Props) {
  const { t, locale } = useT();
  const { decide, busy, error } = useApprovalDecision(NS);
  const [remarks, setRemarks] = useState("");
  if (!isOpen) return null;
  const data: CtcRequest = requestData ?? {};
  const decidable = isDecidable(data);
  const na = t(`${NS}.text_not_available`, "Not available");
  const money = (value?: number) => (typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat(locale, { style: "currency", currency: data.currency || "INR", maximumFractionDigits: 0 }).format(value) : na);
  const variance = typeof data.requestedCtc === "number" && typeof data.approvedBandMax === "number" && data.approvedBandMax > 0
    ? { amount: data.requestedCtc - data.approvedBandMax, pct: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format((data.requestedCtc - data.approvedBandMax) / data.approvedBandMax) }
    : null;
  const can = (decision: string) => decidable && (data.actions ?? []).includes(decision);

  const act = async (decision: "approve" | "reject") => {
    if (!decidable) return;
    if (await decide(data as ApprovalItem, decision, remarks)) {
      (decision === "approve" ? onApprove : onReject)?.({ ...data, decision, remarks: remarks.trim() });
      onClose();
    }
  };

  const fact = (label: string, value: string | undefined) => <div><span className={styles.factLabel}>{label}</span> <strong>{value || na}</strong></div>;

  return (
    <div className={styles.overlay} onClick={() => !busy && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ctc-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden="true"><TrendingUp sx={{ fontSize: 20 }} /></span>
            <div>
              <h3 id="ctc-title" className={styles.title}>{t(`${NS}.text_talent_ctc_exception_approval`, "Talent CTC exception approval")}</h3>
              <span className={styles.subtitle}>{data.title || t(`${NS}.text_out-of-band_budget_authorization`, "Out-of-band budget authorization")}</span>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><Close sx={{ fontSize: 18 }} /></button>
        </div>
        <div className={styles.body}>
          <div className={styles.facts}>
            {fact(t(`${NS}.text_candidate`, "Candidate:"), data.candidateName)}
            {fact(t(`${NS}.text_role`, "Role:"), data.role)}
            {fact(t(`${NS}.text_department`, "Department:"), data.department)}
            {fact(t(`${NS}.text_hiring_manager`, "Hiring manager:"), data.hiringManager)}
          </div>
          <div className={styles.compComparisonCard}>
            <div className={styles.statItem}><span className={styles.statLabel}>{t(`${NS}.text_approved_band_max`, "Approved band (max)")}</span><span className={styles.statValue}>{money(data.approvedBandMax)}</span></div>
            <div className={styles.statItem}><span className={styles.statLabel}>{t(`${NS}.text_requested_ctc`, "Requested CTC")}</span><span className={styles.statValue}>{money(data.requestedCtc)}</span></div>
            <div className={styles.statItem}><span className={styles.statLabel}>{t(`${NS}.text_budget_variance`, "Budget variance")}</span><span className={`${styles.statValue} ${styles.statVariance}`}>{variance ? `${money(variance.amount)} (${variance.pct})` : na}</span></div>
          </div>
          <div className={styles.justification}>
            <div className={styles.sectionLabel}>{t(`${NS}.text_business_justification_market_compa-rati`, "Business justification")}</div>
            <p>{data.justification || na}</p>
          </div>
          <div className={styles.approvalSteps}>
            <div className={styles.sectionLabel}>{t(`${NS}.text_multi-level_authorization_hierarchy`, "Authorization status")}</div>
            <div className={styles.stepRow}><span>{t(`${NS}.text_current_status`, "Current status")}</span><span className={styles.stepStatusPending}>{data.status || na}</span></div>
          </div>
          {!decidable && <p className={styles.notice} role="note">{t(`${NS}.text_no_workflow`, "This request is not linked to an approval record. CTC exceptions are not yet a workflow resource, so no decision can be recorded here.")}</p>}
          <label className={styles.remarksLabel} htmlFor="ctc-remarks">{t(`${NS}.text_executive_decision_remarks`, "Decision reason (required)")}</label>
          <textarea id="ctc-remarks" className={styles.remarks} rows={2} maxLength={1000} value={remarks} disabled={!decidable || busy} onChange={(e) => setRemarks(e.target.value)} />
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.btnReject} onClick={() => void act("reject")} disabled={busy || !can("reject")}><Cancel sx={{ fontSize: 16 }} />{t(`${NS}.text_reject_exception`, "Reject exception")}</button>
          <button type="button" className={styles.btnApprove} onClick={() => void act("approve")} disabled={busy || !can("approve")}><CheckCircle sx={{ fontSize: 16 }} />{t(`${NS}.text_approve_out-of-band_ctc`, "Approve out-of-band CTC")}</button>
        </div>
      </div>
    </div>
  );
}
