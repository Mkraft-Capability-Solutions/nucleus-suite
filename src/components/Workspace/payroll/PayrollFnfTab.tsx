"use client";

import { useState } from "react";
import { Award, CheckSquare, Lock, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import { formatDate, formatMoney, sendJson, useSubmitKey, type ResourceHandle } from "./payroll-client";
import { DataState, NS, Unavailable, usePayrollT } from "./PayrollParts";
import { departmentLabel, fnfStatusLabel } from "./payroll-labels";
import { FNF_DEPARTMENTS, type FnfDepartment, type FnfSettlement } from "./payroll-types";
import styles from "../PayrollView.module.css";

/**
 * Same-day F&F: settlements from GET /api/v1/fnf-settlements, the four department
 * clearances through PATCH /api/v1/fnf-settlements/:id/clear-department and the
 * payment through POST /api/v1/fnf-settlements/:id/disburse. Amounts are the ones
 * `initiateFnfSettlement` stored; components it does not compute are shown as
 * not available rather than estimated.
 */

function numberAttr(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PayrollFnfTab({ settlements, notify }: {
  settlements: ResourceHandle<FnfSettlement[]>;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t, locale } = usePayrollT();
  const [selectedId, setSelectedId] = useState<string>("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [paymentRef, setPaymentRef] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const submitKey = useSubmitKey();
  const fallbackError = t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.");

  const clear = async (settlement: FnfSettlement, department: FnfDepartment) => {
    const title = t(`${NS}.text_clearance`, "Department clearance");
    const remark = (remarks[department] ?? "").trim();
    if (remark.length > 500) {
      notify(title, t(`${NS}.text_err_remarks`, "Remarks can be at most 500 characters."), "error");
      return;
    }
    const body = { department, ...(remark ? { remarks: remark } : {}) };
    setPending(department);
    const result = await sendJson(`/api/v1/fnf-settlements/${encodeURIComponent(settlement.id)}/clear-department`, body, { method: "PATCH", key: submitKey.key(`${settlement.id}:${JSON.stringify(body)}`), fallbackError });
    setPending(null);
    if (!result.ok) {
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    notify(title, t(`${NS}.text_clearance_done`, "{department} clearance recorded.", { department: departmentLabel(t, department) }), "success");
    settlements.reload();
  };

  const disburse = async (settlement: FnfSettlement) => {
    const title = t(`${NS}.text_disburse_fnf`, "Disburse F&F");
    const reference = paymentRef.trim();
    if (reference.length < 1 || reference.length > 100) {
      notify(title, t(`${NS}.text_err_payment_ref`, "Enter the bank payment reference (up to 100 characters)."), "error");
      return;
    }
    const body = { paymentRef: reference };
    setPending("disburse");
    const result = await sendJson(`/api/v1/fnf-settlements/${encodeURIComponent(settlement.id)}/disburse`, body, { key: submitKey.key(`${settlement.id}:${reference}`), fallbackError });
    setPending(null);
    if (!result.ok) {
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    setPaymentRef("");
    notify(title, t(`${NS}.text_fnf_disbursed_done`, "Settlement disbursed against reference {ref}.", { ref: reference }), "success");
    settlements.reload();
  };

  return (
    <DataState resource={settlements.state} onRetry={settlements.reload} isEmpty={(rows) => rows.length === 0} emptyText={t(`${NS}.text_no_fnf`, "No full and final settlement has been initiated.")}>
      {(rows) => {
        const current = rows.find((row) => row.id === selectedId) ?? rows[0];
        if (!current) return null;
        const attributes = current.attributes ?? {};
        const name = [current.first_name, current.last_name].filter(Boolean).join(" ") || current.employee_code || "—";
        const currency = current.currency ?? "INR";
        const amount = (key: string) => {
          const value = numberAttr(attributes, key);
          return value === null ? <Unavailable reason={t(`${NS}.text_fnf_not_computed`, "Not computed by the settlement service.")} /> : formatMoney(value, currency, locale);
        };
        const earnings = (numberAttr(attributes, "gratuity_minor") ?? 0) + (numberAttr(attributes, "el_encashment_minor") ?? 0);
        const deductions = (numberAttr(attributes, "notice_deduction_minor") ?? 0) + (numberAttr(attributes, "travel_advance_deduction_minor") ?? 0);
        const net = numberAttr(attributes, "net_payable_minor");
        const clearances = current.department_clearances ?? {};
        const clearedCount = FNF_DEPARTMENTS.filter((dept) => clearances[dept]?.status === "cleared").length;
        const allCleared = clearedCount === FNF_DEPARTMENTS.length;
        const canDisburse = current.status === "cleared_for_disbursement";
        return (
          <div className={styles.stack}>
            <section className={`${styles.card} ${styles.accentCard}`} aria-labelledby="fnf-title">
              <div className={styles.rowBetween}>
                <div>
                  <h3 id="fnf-title" className={styles.sectionTitle}><Award size={20} aria-hidden="true" />{t(`${NS}.text_fnf_title`, "Same-day F&F settlement and no-dues checklist")}</h3>
                  <p className={styles.intro}>{t(`${NS}.text_fnf_intro`, "Leave encashment and statutory gratuity minus notice shortfall and advances. Disbursement stays locked until HR, IT, finance and administration clear the exit.")}</p>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="fnf-select">{t(`${NS}.text_select_exit`, "Exiting employee")}</label>
                  <select id="fnf-select" className={styles.select} value={current.id} onChange={(event) => setSelectedId(event.target.value)}>
                    {rows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {t(`${NS}.text_fnf_option`, "{name} · exit {date}", { name: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.employee_code || "—", date: formatDate(row.exit_date, locale) ?? row.exit_date })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className={styles.card} aria-labelledby="fnf-clearances">
              <div className={styles.cardHeader}>
                <h3 id="fnf-clearances"><CheckSquare size={18} aria-hidden="true" />{t(`${NS}.text_no_dues`, "Department no-dues clearance")}</h3>
                <span className={`${styles.badge} ${allCleared ? styles.badgeSuccess : styles.badgeDanger}`}>{t(`${NS}.text_cleared_progress`, "{cleared} of {total} cleared", { cleared: clearedCount, total: FNF_DEPARTMENTS.length })}</span>
              </div>
              <div className={styles.noDuesGrid}>
                {FNF_DEPARTMENTS.map((dept) => {
                  const clearance = clearances[dept];
                  const isCleared = clearance?.status === "cleared";
                  const locked = current.status === "disbursed" || current.status === "cancelled";
                  return (
                    <div key={dept} className={`${styles.noDuesCard} ${isCleared ? styles.clearedTop : styles.pendingTop}`}>
                      <div className={styles.rowBetween}>
                        <strong className={styles.strongText}>{departmentLabel(t, dept)}</strong>
                        <span className={`${styles.badge} ${isCleared ? styles.badgeSuccess : styles.badgeWarning}`}>{isCleared ? t(`${NS}.text_cleared`, "Cleared") : t(`${NS}.text_pending`, "Pending")}</span>
                      </div>
                      <div className={styles.micro}>
                        {isCleared && clearance?.verified_at ? t(`${NS}.text_verified_on`, "Verified on {date}", { date: formatDate(clearance.verified_at, locale) ?? "" }) : t(`${NS}.text_awaiting_signoff`, "Awaiting departmental sign-off")}
                      </div>
                      {isCleared ? (
                        <div className={styles.clearanceRemarks}>{clearance?.remarks || t(`${NS}.text_no_remarks`, "No remarks recorded.")}</div>
                      ) : (
                        <>
                          <label className={styles.srOnly} htmlFor={`fnf-remarks-${dept}`}>{t(`${NS}.text_remarks_for`, "Remarks for {department}", { department: departmentLabel(t, dept) })}</label>
                          <textarea id={`fnf-remarks-${dept}`} className={styles.formInput} maxLength={500} rows={2} value={remarks[dept] ?? ""} disabled={locked || pending !== null}
                            placeholder={t(`${NS}.text_remarks_placeholder`, "Remarks (optional)")} onChange={(event) => setRemarks((value) => ({ ...value, [dept]: event.target.value }))} />
                        </>
                      )}
                      <div className={styles.row}>
                        <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled={isCleared || locked || pending !== null} onClick={() => void clear(current, dept)}>
                          {pending === dept ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_mark_cleared`, "Mark cleared")}
                        </button>
                        <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled title={t(`${NS}.text_hold_unavailable`, "The settlement service has no hold action; a department stays pending until it clears.")}>
                          {t(`${NS}.text_hold_pending`, "Hold / pending")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className={styles.twoColGrid}>
              <section className={styles.card} aria-labelledby="fnf-earnings">
                <div className={styles.cardHeader}>
                  <h3 id="fnf-earnings" className={styles.positive}><TrendingUp size={18} aria-hidden="true" />{t(`${NS}.text_fnf_earnings`, "Final settlement earnings")}</h3>
                  <span className={styles.micro}>{numberAttr(attributes, "tenure_years") !== null ? t(`${NS}.text_tenure_years`, "Tenure: {years} years", { years: numberAttr(attributes, "tenure_years") }) : ""}</span>
                </div>
                <div className={styles.earningRow}><span className={styles.earnLabel}>{t(`${NS}.text_unpaid_days`, "Unpaid days salary")}</span><span className={styles.earnVal}><Unavailable reason={t(`${NS}.text_fnf_not_computed`, "Not computed by the settlement service.")} /></span></div>
                <div className={styles.earningRow}><span className={styles.earnLabel}>{t(`${NS}.text_leave_encashment`, "Leave encashment ({days} EL days)", { days: numberAttr(attributes, "el_balance") ?? 0 })}</span><span className={styles.earnVal}>{amount("el_encashment_minor")}</span></div>
                <div className={styles.earningRow}><span className={styles.earnLabel}>{t(`${NS}.text_gratuity`, "Statutory gratuity (15/26 × basic × years, from 5 years)")}</span><span className={styles.earnVal}>{amount("gratuity_minor")}</span></div>
                <div className={`${styles.earningRow} ${styles.totalRow}`}><strong>{t(`${NS}.text_total_earnings`, "Total final earnings (A)")}</strong><strong className={styles.positive}>{formatMoney(earnings, currency, locale)}</strong></div>
              </section>
              <section className={styles.card} aria-labelledby="fnf-deductions">
                <div className={styles.cardHeader}>
                  <h3 id="fnf-deductions" className={styles.deduction}><ShieldAlert size={18} aria-hidden="true" />{t(`${NS}.text_fnf_deductions`, "Final deductions and recoveries")}</h3>
                </div>
                <div className={styles.earningRow}><span className={`${styles.earnLabel} ${styles.deduction}`}>{t(`${NS}.text_loan_balance`, "(−) Company loan balance")}</span><span className={styles.earnVal}><Unavailable reason={t(`${NS}.text_loan_offset_note`, "Loan balances are recovered through the loan ledger, not this settlement.")} /></span></div>
                <div className={styles.earningRow}><span className={`${styles.earnLabel} ${styles.deduction}`}>{t(`${NS}.text_notice_shortfall`, "(−) Notice shortfall")}</span><span className={`${styles.earnVal} ${styles.deduction}`}>{amount("notice_deduction_minor")}</span></div>
                <div className={styles.earningRow}><span className={`${styles.earnLabel} ${styles.deduction}`}>{t(`${NS}.text_advance_settlement`, "(−) Travel / card advance settlement")}</span><span className={`${styles.earnVal} ${styles.deduction}`}>{amount("travel_advance_deduction_minor")}</span></div>
                <div className={`${styles.earningRow} ${styles.totalRow}`}><strong>{t(`${NS}.text_total_deductions`, "Total deductions (B)")}</strong><strong className={styles.deduction}>{formatMoney(deductions, currency, locale)}</strong></div>
              </section>
            </div>

            <section className={`${styles.card} ${canDisburse ? styles.netReady : styles.netCard}`} aria-labelledby="fnf-net">
              <div className={styles.rowBetween}>
                <div>
                  <span id="fnf-net" className={styles.muted}>{t(`${NS}.text_net_fnf`, "Net full and final payable (A − B) for {name}", { name })}</span>
                  <div className={styles.bigNumber}>{net !== null ? formatMoney(net, currency, locale) : <Unavailable reason={t(`${NS}.text_fnf_not_computed`, "Not computed by the settlement service.")} />}</div>
                  <div className={styles.micro}>{fnfStatusLabel(t, current.status)}{current.payment_ref ? ` · ${current.payment_ref}` : ""}</div>
                </div>
                {current.status === "disbursed" ? (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>{t(`${NS}.text_fnf_paid_on`, "Paid {date}", { date: formatDate(current.disbursed_at, locale) ?? "" })}</span>
                ) : canDisburse ? (
                  <div className={styles.row}>
                    <label className={styles.srOnly} htmlFor="fnf-payment-ref">{t(`${NS}.text_payment_ref`, "Bank payment reference")}</label>
                    <input id="fnf-payment-ref" className={styles.formInput} maxLength={100} required aria-required="true" value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} placeholder={t(`${NS}.text_payment_ref`, "Bank payment reference")} disabled={pending !== null} />
                    <button type="button" className={styles.btnPrimary} disabled={pending !== null} onClick={() => void disburse(current)}>
                      <Zap size={16} aria-hidden="true" />{pending === "disburse" ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_disburse_fnf`, "Disburse F&F")}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.btnSecondary} disabled title={t(`${NS}.text_disburse_blocked_title`, "Disbursement is blocked until all four clearances are signed off")}>
                    <Lock size={16} aria-hidden="true" />{t(`${NS}.text_disburse_blocked`, "Disbursement blocked")}
                  </button>
                )}
              </div>
            </section>
          </div>
        );
      }}
    </DataState>
  );
}
