"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { INTEREST_METHODS, LOAN_PURPOSES } from "@/lib/loan-constants";
import { formatMoney, sendJson, toMinorUnits, useResource, useSubmitKey } from "./payroll-client";
import { NS, Notice, usePayrollT } from "./PayrollParts";
import { interestMethodLabel, loanPurposeLabel } from "./payroll-labels";
import type { GuarantorLock, LoanEligibility, PersonOption } from "./payroll-types";
import styles from "../PayrollView.module.css";

/**
 * Company loan application (FRM-CMB-01) posted to POST /api/v1/loans.
 * Client rules mirror `applyLoanSchema`: principal > 0, tenure 1–84 months, annual
 * rate 0–36 %, a configured purpose, 2–3 distinct guarantors other than the
 * borrower. Eligibility and the ceiling come from GET /api/v1/loans/eligibility;
 * the POST re-checks everything, and its message is shown when it refuses.
 */

type Field = "employeeId" | "principal" | "tenure" | "rate" | "purpose" | "guarantors";
type Errors = Partial<Record<Field, string>>;

function personLabel(person: PersonOption): string {
  return `${person.firstName} ${person.lastName} (${person.employeeCode})`.trim();
}

export default function LoanApplicationModal({ locks, onClose, onSaved, notify }: {
  locks: GuarantorLock[];
  onClose: () => void;
  onSaved: () => void;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
}) {
  const { t, locale } = usePayrollT();
  const people = useResource<PersonOption[]>("/api/v1/people?pageSize=100");
  const [employeeId, setEmployeeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [tenure, setTenure] = useState("12");
  const [rate, setRate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [interestMethod, setInterestMethod] = useState("");
  const [guarantors, setGuarantors] = useState<[string, string, string]>(["", "", ""]);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitKey = useSubmitKey();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const eligibility = useResource<LoanEligibility>(employeeId ? `/api/v1/loans/eligibility?employeeId=${encodeURIComponent(employeeId)}` : null);
  const lockedIds = new Set(locks.map((lock) => lock.guarantorEmployeeId));
  const title = t(`${NS}.text_loan_modal_title`, "Apply for company welfare loan");

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const ready = eligibility.state.status === "ready" && employeeId ? eligibility.state.data : null;
  const currency = ready?.currency ?? "INR";
  const principalMinor = toMinorUnits(principal, currency);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!employeeId) next.employeeId = t(`${NS}.text_err_applicant`, "Choose the applicant.");
    if (principalMinor === null || principalMinor <= 0) next.principal = t(`${NS}.text_err_principal`, "Enter a positive principal.");
    else if (ready?.ceilingMinor !== null && ready?.ceilingMinor !== undefined && principalMinor > ready.ceilingMinor) {
      next.principal = t(`${NS}.text_err_ceiling`, "The principal exceeds the eligible ceiling of {ceiling}.", { ceiling: formatMoney(ready.ceilingMinor, currency, locale) });
    }
    const months = Number(tenure);
    if (!Number.isInteger(months) || months < 1 || months > 84) next.tenure = t(`${NS}.text_err_tenure`, "Tenure must be 1 to 84 months.");
    const pct = Number(rate);
    if (rate.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 36) next.rate = t(`${NS}.text_err_rate`, "The annual rate must be between 0 and 36 %.");
    if (!purpose) next.purpose = t(`${NS}.text_err_purpose`, "Choose a purpose.");
    const chosen = guarantors.filter(Boolean);
    if (chosen.length < 2) next.guarantors = t(`${NS}.text_err_two_guarantors`, "Two guarantors are mandatory.");
    else if (new Set(chosen).size !== chosen.length) next.guarantors = t(`${NS}.text_err_distinct`, "Guarantors must be different employees.");
    else if (chosen.includes(employeeId)) next.guarantors = t(`${NS}.text_err_self_guarantee`, "The borrower cannot guarantee their own loan.");
    else if (chosen.some((id) => lockedIds.has(id))) next.guarantors = t(`${NS}.text_err_locked`, "A locked guarantor cannot guarantee another loan.");
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = validate();
    setErrors(found);
    setServerError(null);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`loan-${first}`)?.focus();
      return;
    }
    const body = {
      employeeId,
      principalMinor,
      tenureMonths: Number(tenure),
      annualRatePct: Number(rate),
      purpose,
      guarantorEmployeeIds: guarantors.filter(Boolean),
      ...(interestMethod ? { interestMethod } : {}),
    };
    setPending(true);
    const result = await sendJson<{ id: string; indicativeInstalmentMinor: number | null }>("/api/v1/loans", body, { key: submitKey.key(JSON.stringify(body)), fallbackError: t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.") });
    setPending(false);
    if (!result.ok) {
      setServerError(result.message);
      const mapped: Errors = {};
      for (const detail of result.details) {
        const key = detail.field.split(".")[0];
        if (key === "principalMinor") mapped.principal = detail.issue;
        else if (key === "tenureMonths") mapped.tenure = detail.issue;
        else if (key === "annualRatePct") mapped.rate = detail.issue;
        else if (key === "purpose") mapped.purpose = detail.issue;
        else if (key === "guarantorEmployeeIds") mapped.guarantors = detail.issue;
        else if (key === "employeeId") mapped.employeeId = detail.issue;
      }
      setErrors(mapped);
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    const emi = result.data?.indicativeInstalmentMinor ?? null;
    notify(title, emi !== null ? t(`${NS}.text_loan_submitted_emi`, "Application submitted. Indicative instalment: {emi}.", { emi: formatMoney(emi, currency, locale) }) : t(`${NS}.text_loan_submitted`, "Application submitted for guarantor consent and approval."), "success");
    onSaved();
    onClose();
  };

  const fieldError = (field: Field) => errors[field] ? <p id={`loan-${field}-error`} className={styles.fieldError} role="alert">{errors[field]}</p> : null;
  const describedBy = (field: Field) => (errors[field] ? `loan-${field}-error` : undefined);
  const personList = people.state.status === "ready" ? people.state.data.filter((person) => person.status !== "separated") : [];

  return (
    <div className={styles.modalOverlay} onClick={() => !pending && onClose()} role="presentation">
      <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="loan-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 id="loan-modal-title" className={styles.sectionTitle}>{title}</h3>
            <span className={styles.micro}>{t(`${NS}.text_loan_modal_sub`, "Ceiling, guarantor lock and one-active-loan rules are enforced by the server.")}</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} aria-hidden="true" /></button>
        </div>
        <form onSubmit={(event) => void submit(event)} className={styles.modalBody} noValidate>
          {people.state.status === "error" && <Notice tone="error">{people.state.message}</Notice>}
          {serverError && <Notice tone="error">{serverError}</Notice>}
          <div className={styles.formGroup}>
            <label htmlFor="loan-employeeId">{t(`${NS}.text_applicant`, "Applicant employee")} *</label>
            <select ref={firstFieldRef} id="loan-employeeId" className={styles.formInput} value={employeeId} aria-required="true" aria-invalid={errors.employeeId ? true : undefined} aria-describedby={describedBy("employeeId")}
              onChange={(event) => setEmployeeId(event.target.value)} disabled={pending || people.state.status !== "ready"}>
              <option value="">{people.state.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : t(`${NS}.text_choose`, "Choose…")}</option>
              {personList.map((person) => <option key={person.id} value={person.id}>{personLabel(person)}</option>)}
            </select>
            {fieldError("employeeId")}
            {employeeId && eligibility.state.status === "loading" && <span className={styles.micro}>{t(`${NS}.text_checking_eligibility`, "Checking eligibility…")}</span>}
            {employeeId && eligibility.state.status === "error" && <Notice tone="error">{eligibility.state.message}</Notice>}
            {ready && (
              <Notice tone={ready.eligible ? "ok" : "error"}>
                {ready.ceilingMinor !== null ? t(`${NS}.text_ceiling`, "Eligible ceiling: {ceiling} ({years} years of service).", { ceiling: formatMoney(ready.ceilingMinor, currency, locale), years: ready.serviceYears }) : ""}
                {ready.reasons.length > 0 && ` ${ready.reasons.join(" ")}`}
              </Notice>
            )}
          </div>

          <div className={styles.grid2}>
            <div className={styles.formGroup}>
              <label htmlFor="loan-principal">{t(`${NS}.text_principal_in`, "Requested principal ({currency})", { currency })} *</label>
              <input id="loan-principal" type="number" inputMode="decimal" min="0" step="0.01" className={styles.formInput} value={principal} onChange={(event) => setPrincipal(event.target.value)}
                aria-required="true" aria-invalid={errors.principal ? true : undefined} aria-describedby={describedBy("principal")} disabled={pending} />
              {fieldError("principal")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="loan-tenure">{t(`${NS}.text_tenure_months`, "Tenure (months)")} *</label>
              <input id="loan-tenure" type="number" min="1" max="84" step="1" className={styles.formInput} value={tenure} onChange={(event) => setTenure(event.target.value)}
                aria-required="true" aria-invalid={errors.tenure ? true : undefined} aria-describedby={describedBy("tenure")} disabled={pending} />
              {fieldError("tenure")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="loan-rate">{t(`${NS}.text_annual_rate`, "Annual interest rate (%)")} *</label>
              <input id="loan-rate" type="number" min="0" max="36" step="0.01" className={styles.formInput} value={rate} onChange={(event) => setRate(event.target.value)}
                aria-required="true" aria-invalid={errors.rate ? true : undefined} aria-describedby={describedBy("rate")} disabled={pending} />
              {fieldError("rate")}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="loan-method">{t(`${NS}.text_interest_method`, "Interest method (optional)")}</label>
              <select id="loan-method" className={styles.formInput} value={interestMethod} onChange={(event) => setInterestMethod(event.target.value)} disabled={pending}>
                <option value="">{t(`${NS}.text_decide_at_approval`, "Decide at approval")}</option>
                {INTEREST_METHODS.map((method) => <option key={method} value={method}>{interestMethodLabel(t, method)}</option>)}
              </select>
              <span className={styles.micro}>{t(`${NS}.text_emi_server`, "The monthly instalment is calculated by the server once the method is recorded.")}</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="loan-purpose">{t(`${NS}.text_loan_purpose`, "Loan purpose")} *</label>
            <select id="loan-purpose" className={styles.formInput} value={purpose} onChange={(event) => setPurpose(event.target.value)} aria-required="true" aria-invalid={errors.purpose ? true : undefined} aria-describedby={describedBy("purpose")} disabled={pending}>
              <option value="">{t(`${NS}.text_choose`, "Choose…")}</option>
              {LOAN_PURPOSES.map((value) => <option key={value} value={value}>{loanPurposeLabel(t, value)}</option>)}
            </select>
            {fieldError("purpose")}
          </div>

          <fieldset className={styles.panel} aria-describedby={describedBy("guarantors")}>
            <legend className={styles.strongText}>{t(`${NS}.text_guarantors_legend`, "Two active employee guarantors (third optional)")}</legend>
            <div className={styles.grid3}>
              {([0, 1, 2] as const).map((index) => (
                <div key={index} className={styles.formGroup}>
                  <label htmlFor={index === 0 ? "loan-guarantors" : `loan-guarantor-${index}`}>
                    {index === 2 ? t(`${NS}.text_guarantor_optional`, "Guarantor 3 (optional)") : t(`${NS}.text_guarantor_n`, "Guarantor {n}", { n: index + 1 })}{index < 2 ? " *" : ""}
                  </label>
                  <select id={index === 0 ? "loan-guarantors" : `loan-guarantor-${index}`} className={styles.formInput} value={guarantors[index]} disabled={pending || people.state.status !== "ready"}
                    onChange={(event) => setGuarantors((current) => { const next = [...current] as [string, string, string]; next[index] = event.target.value; return next; })}>
                    <option value="">{t(`${NS}.text_choose`, "Choose…")}</option>
                    {personList.filter((person) => person.id !== employeeId).map((person) => (
                      <option key={person.id} value={person.id} disabled={lockedIds.has(person.id)}>
                        {lockedIds.has(person.id) ? t(`${NS}.text_locked_option`, "{name} — locked", { name: personLabel(person) }) : personLabel(person)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {fieldError("guarantors")}
            <p className={styles.micro}>{t(`${NS}.text_guarantor_note`, "Each guarantor is asked for consent. Once they consent they are locked from borrowing or guaranteeing until this loan is repaid.")}</p>
          </fieldset>

          <div className={styles.panel}>
            <label className={styles.checkLabel}>
              <input type="checkbox" disabled checked={false} readOnly />
              {t(`${NS}.text_override_label`, "Management exception override")}
            </label>
            <p className={styles.micro}>{t(`${NS}.text_override_note`, "Exceptions to the ceiling or guarantor rules are granted at sanction, with a recorded waiver reason, by the approver — not on the application.")}</p>
          </div>

          <div className={styles.row}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.text_cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={pending}>{pending ? t(`${NS}.text_submitting`, "Submitting…") : t(`${NS}.text_submit_application`, "Submit application")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
