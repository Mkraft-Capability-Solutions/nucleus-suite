"use client";

import { useState } from "react";
import { AlertTriangle, DollarSign, Lock, ShieldAlert } from "lucide-react";
import { formatMoney, sendJson, useSubmitKey, type ResourceHandle } from "./payroll-client";
import { DataState, NS, usePayrollT } from "./PayrollParts";
import { guarantorStatusLabel, loanPurposeLabel, loanStatusLabel } from "./payroll-labels";
import LoanApplicationModal from "./LoanApplicationModal";
import type { LoanRegister, LoanRegisterRow } from "./payroll-types";
import styles from "../PayrollView.module.css";

function loanCode(id: string): string {
  return `LN-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export default function PayrollLoansTab({ register, notify }: {
  register: ResourceHandle<LoanRegister>;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t, locale } = usePayrollT();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const submitKey = useSubmitKey();
  const locks = register.state.status === "ready" ? register.state.data.locks : [];

  const deductEmi = async (loan: LoanRegisterRow) => {
    if (pendingId || loan.instalmentMinor === null) return;
    const amountMinor = Math.min(loan.instalmentMinor, loan.outstandingMinor);
    const body = { amountMinor };
    const title = t(`${NS}.text_deduct_emi`, "Deduct EMI");
    setPendingId(loan.id);
    const result = await sendJson<{ outstandingMinor: number }>(`/api/v1/loans/${encodeURIComponent(loan.id)}/repay`, body, { key: submitKey.key(`${loan.id}:${amountMinor}`), fallbackError: t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.") });
    setPendingId(null);
    if (!result.ok) {
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    notify(title, t(`${NS}.text_emi_recorded`, "Instalment of {amount} recorded against {code}.", { amount: formatMoney(amountMinor, loan.currency, locale), code: loanCode(loan.id) }), "success");
    register.reload();
  };

  const rules: Array<[string, string]> = [
    [t(`${NS}.text_rule_ceiling`, "Ceiling"), t(`${NS}.text_rule_ceiling_value`, "4× monthly basic (6× after 5 years of service)")],
    [t(`${NS}.text_rule_guarantors`, "Guarantors"), t(`${NS}.text_rule_guarantors_value`, "Two active employees, a third optional")],
    [t(`${NS}.text_rule_lock`, "Guarantor lock"), t(`${NS}.text_rule_lock_value`, "Consenting guarantors cannot borrow while the loan is open")],
    [t(`${NS}.text_rule_concurrency`, "Concurrency"), t(`${NS}.text_rule_concurrency_value`, "One open loan or advance per employee")],
  ];

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.accentFlag}`} aria-labelledby="loan-policy">
        <div className={styles.rowBetween}>
          <div>
            <h3 id="loan-policy" className={styles.sectionTitle}><Lock size={20} aria-hidden="true" />{t(`${NS}.text_loan_policy`, "Company loan policy and guarantor lock")}</h3>
            <ul className={styles.row}>
              {rules.map(([label, value]) => <li key={label} className={styles.muted}><strong>{label}:</strong> {value}</li>)}
            </ul>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={() => setModalOpen(true)}><DollarSign size={15} aria-hidden="true" />{t(`${NS}.text_apply_loan`, "Apply for company loan")}</button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="loan-locks">
        <div className={styles.cardHeader}>
          <h3 id="loan-locks"><ShieldAlert size={18} aria-hidden="true" />{t(`${NS}.text_lock_radar`, "Guarantor lock radar")}</h3>
          {register.state.status === "ready" && <span className={styles.micro}>{t(`${NS}.text_locked_count`, "{count} guarantors locked", { count: locks.length })}</span>}
        </div>
        <DataState resource={register.state} onRetry={register.reload} isEmpty={(data) => data.locks.length === 0} emptyText={t(`${NS}.text_no_locks`, "No guarantor is locked. Every eligible employee can apply.")}>
          {(data) => (
            <div className={styles.grid2}>
              {data.locks.map((lock) => (
                <div key={`${lock.loanId}-${lock.guarantorEmployeeId}`} className={styles.guarantorLockBox}>
                  <AlertTriangle size={22} aria-hidden="true" />
                  <div>
                    <strong>{t(`${NS}.text_lock_title`, "{name} ({code}) — guarantor locked", { name: lock.guarantorName, code: lock.guarantorCode })}</strong>
                    <div className={styles.micro}>{t(`${NS}.text_lock_detail`, "Guarantees {loan} for {borrower}. Outstanding: {amount}.", { loan: loanCode(lock.loanId), borrower: lock.borrowerName, amount: formatMoney(lock.outstandingMinor, lock.currency, locale) })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataState>
      </section>

      <section className={styles.tableContainer} aria-labelledby="loan-register">
        <div className={styles.tableHeader}>
          <strong id="loan-register" className={styles.strongText}>{t(`${NS}.text_loan_register`, "Company welfare loans and repayment ledger")}</strong>
          {register.state.status === "ready" && <span className={styles.micro}>{t(`${NS}.text_total_loans`, "Total loans: {count}", { count: register.state.data.total })}</span>}
        </div>
        <DataState resource={register.state} onRetry={register.reload} isEmpty={(data) => data.items.length === 0} emptyText={t(`${NS}.text_no_loans`, "No company loan has been applied for yet.")}>
          {(data) => (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.text_loan_id`, "Loan ID")}</th>
                    <th scope="col">{t(`${NS}.text_borrower`, "Borrower")}</th>
                    <th scope="col">{t(`${NS}.text_principal`, "Principal")}</th>
                    <th scope="col">{t(`${NS}.text_outstanding`, "Outstanding")}</th>
                    <th scope="col">{t(`${NS}.text_monthly_emi`, "Monthly EMI")}</th>
                    <th scope="col">{t(`${NS}.text_tenure`, "Tenure")}</th>
                    <th scope="col">{t(`${NS}.text_guarantors`, "Guarantors")}</th>
                    <th scope="col">{t(`${NS}.text_status`, "Status")}</th>
                    <th scope="col">{t(`${NS}.text_actions`, "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((loan) => {
                    const canDeduct = loan.status === "disbursed" && loan.outstandingMinor > 0 && loan.instalmentMinor !== null;
                    return (
                      <tr key={loan.id}>
                        <td className={styles.numeric}>{loanCode(loan.id)}</td>
                        <td>
                          <div className={styles.strongText}>{loan.borrowerName}</div>
                          <div className={styles.micro}>{[loan.department, loan.designation, loan.purpose ? loanPurposeLabel(t, loan.purpose) : null].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className={styles.numeric}>{formatMoney(loan.principalMinor, loan.currency, locale)}</td>
                        <td className={`${styles.numeric} ${loan.outstandingMinor > 0 ? styles.deduction : styles.positive}`}>{formatMoney(loan.outstandingMinor, loan.currency, locale)}</td>
                        <td className={styles.numeric}>{loan.instalmentMinor !== null ? formatMoney(loan.instalmentMinor, loan.currency, locale) : <span className={styles.micro}>{t(`${NS}.text_emi_pending`, "Set at approval")}</span>}</td>
                        <td>{loan.tenureMonths !== null ? t(`${NS}.text_tenure_progress`, "{paid} / {total} months", { paid: loan.recoveredInstalments, total: loan.tenureMonths }) : "—"}</td>
                        <td>
                          <div className={styles.stackTight}>
                            {loan.guarantors.length === 0 ? <span className={styles.micro}>—</span> : loan.guarantors.map((guarantor) => (
                              <span key={guarantor.employeeId} className={`${styles.badge} ${guarantor.status === "approved" && loan.outstandingMinor > 0 ? styles.badgeDanger : styles.badgeInfo}`}>
                                {t(`${NS}.text_guarantor_badge`, "{name} · {status}", { name: guarantor.name, status: guarantorStatusLabel(t, guarantor.status) })}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td><span className={`${styles.badge} ${loan.status === "repaid" || loan.status === "closed" ? styles.badgeSuccess : styles.badgeWarning}`}>{loanStatusLabel(t, loan.status)}</span></td>
                        <td>
                          {loan.outstandingMinor > 0 ? (
                            <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled={!canDeduct || pendingId !== null} onClick={() => void deductEmi(loan)}
                              title={canDeduct ? t(`${NS}.text_deduct_title`, "Record one monthly instalment") : t(`${NS}.text_deduct_blocked`, "Repayments apply only to disbursed loans with a scheduled instalment")}>
                              {pendingId === loan.id ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_deduct_emi`, "Deduct EMI")}
                            </button>
                          ) : <span className={`${styles.micro} ${styles.positive}`}>{t(`${NS}.text_settled`, "Settled")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </section>

      {modalOpen && <LoanApplicationModal locks={locks} onClose={() => setModalOpen(false)} onSaved={register.reload} notify={notify} />}
    </div>
  );
}
