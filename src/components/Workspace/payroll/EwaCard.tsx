"use client";

import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";
import { currentPeriod, formatDate, formatMoney, sendJson, toMinorUnits, useSubmitKey } from "./payroll-client";
import { NS, usePayrollT } from "./PayrollParts";
import { advanceBlockedReason, advanceStatusLabel } from "./payroll-labels";
import type { PayrollOverview } from "./payroll-types";
import styles from "../PayrollView.module.css";

/**
 * Earned wage access: a salary advance request for the signed-in employee through
 * POST /api/v1/salary-advances. Client rules mirror `requestAdvanceSchema` and
 * `requestAdvance` (positive amount, at most one month of basic, a 1–300 character
 * reason, no open advance or loan); the server re-checks every one of them.
 */
export default function EwaCard({ overview, onSaved, notify }: {
  overview: PayrollOverview;
  onSaved: () => void;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t, locale } = usePayrollT();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitKey = useSubmitKey();
  const employee = overview.employee;
  const allowance = overview.advanceAllowance;
  const currency = employee?.currency ?? "INR";
  const title = t(`${NS}.text_ewa_title`, "Earned wage access");

  const validate = (): { amountMinor: number; reason: string } | string => {
    if (!employee) return overview.employeeUnavailableReason ?? t(`${NS}.text_no_employee`, "This account is not linked to an employee record.");
    if (!allowance?.available) return advanceBlockedReason(t, allowance?.reason);
    const minor = toMinorUnits(amount, currency);
    if (minor === null || minor <= 0) return t(`${NS}.text_amount_positive`, "Enter a positive amount.");
    if (minor > (allowance.limitMinor ?? 0)) return t(`${NS}.text_amount_over_limit`, "The amount exceeds the available limit of {limit}.", { limit: formatMoney(allowance.limitMinor ?? 0, currency, locale) });
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 300) return t(`${NS}.text_reason_required`, "Give a reason of up to 300 characters.");
    return { amountMinor: minor, reason: trimmed };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const checked = validate();
    if (typeof checked === "string") {
      setError(checked);
      return;
    }
    setError(null);
    setPending(true);
    const body = { employeeId: employee?.id, amountMinor: checked.amountMinor, period: currentPeriod(), reason: checked.reason };
    const result = await sendJson("/api/v1/salary-advances", body, { key: submitKey.key(JSON.stringify(body)), fallbackError: t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.") });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    setAmount("");
    setReason("");
    notify(title, t(`${NS}.text_ewa_requested`, "Your advance request of {amount} was recorded.", { amount: formatMoney(checked.amountMinor, currency, locale) }), "success");
    onSaved();
  };

  return (
    <section className={styles.ewaCard} aria-labelledby="payroll-ewa">
      <div className={styles.rowBetween}>
        <div>
          <span className={styles.micro}>{t(`${NS}.text_ewa_vault`, "Autonomous EWA vault")}</span>
          <h3 id="payroll-ewa">{t(`${NS}.text_liquidity`, "Liquidity on demand")}</h3>
        </div>
        <Zap size={24} aria-hidden="true" />
      </div>
      <p className={styles.onHero}>{t(`${NS}.text_ewa_intro`, "Request an advance against this month's salary. It is recovered through payroll after approval.")}</p>
      <form className={styles.stackTight} onSubmit={(event) => void submit(event)} noValidate>
        <div className={styles.ewaInputGroup}>
          <label className={styles.srOnly} htmlFor="ewa-amount">{t(`${NS}.text_amount_in`, "Amount in {currency}", { currency })}</label>
          <input id="ewa-amount" type="number" inputMode="decimal" min="0" step="0.01" required aria-required="true" aria-invalid={error ? true : undefined} aria-describedby={error ? "ewa-error" : undefined}
            value={amount} onChange={(event) => setAmount(event.target.value)} className={styles.ewaInput}
            placeholder={t(`${NS}.text_amount_in`, "Amount in {currency}", { currency })} disabled={pending} />
          <button className={styles.btnPrimary} type="submit" disabled={pending || !employee}>{pending ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_request_advance`, "Request advance")}</button>
        </div>
        <label className={styles.srOnly} htmlFor="ewa-reason">{t(`${NS}.text_reason`, "Reason")}</label>
        <input id="ewa-reason" type="text" maxLength={300} required aria-required="true" value={reason} onChange={(event) => setReason(event.target.value)} className={styles.ewaInput}
          placeholder={t(`${NS}.text_reason_placeholder`, "Reason (required)")} disabled={pending} />
        {error && <p id="ewa-error" className={styles.fieldError} role="alert">{error}</p>}
      </form>
      {overview.advances.length > 0 && (
        <div className={styles.ewaHistory}>
          <span className={styles.micro}>{t(`${NS}.text_recent_ewa`, "Recent advance activity")}</span>
          {overview.advances.slice(0, 5).map((advance) => (
            <div key={advance.id}>
              <span>{formatDate(advance.requestedAt, locale) ?? "—"}</span>
              <strong>{t(`${NS}.text_advance_line`, "{amount} ({status})", { amount: formatMoney(advance.amountMinor, currency, locale), status: advanceStatusLabel(t, advance.status) })}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
