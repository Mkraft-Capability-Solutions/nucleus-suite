"use client";

import { useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import { X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "../OnboardingView.module.css";
import { localToday, newIdempotencyKey, sendJson, type Translate } from "./api";
import EmployeePicker, { type EmployeeOption } from "./EmployeePicker";
import { picklistOptions } from "./picklistOptions";
import type { RecognitionRegister } from "./RecognitionTab";

/**
 * Nominates an employee through POST /api/v1/recognition-register (action "nominate").
 * Client checks mirror `nominateRecognitionSchema` and the register's own rules: a
 * programme, a category, a citation of at least the configured minimum, a period whose end
 * is not before its start, and an award within the programme ceiling. The server stays
 * authoritative (self-nomination, active assignment, nomination window).
 */

const NS = "components.Workspace.OnboardingView";

type Errors = Partial<Record<"nominee" | "programmeId" | "citation" | "amount" | "period", string>>;

function monthBounds(today: string): [string, string] {
  const [year, month] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, "0")}`];
}

export default function AwardDialog({ open, register, onClose, onSaved, formatMoney }: {
  open: boolean;
  register: RecognitionRegister | null;
  onClose: () => void;
  onSaved: () => void;
  formatMoney: (minor: number, currency: string) => string;
}) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, tone: string) => void };
  const [nominee, setNominee] = useState<EmployeeOption | null>(null);
  const [programmeId, setProgrammeId] = useState("");
  const [category, setCategory] = useState("star_performer");
  const [amount, setAmount] = useState("");
  const [citation, setCitation] = useState("");
  const [period, setPeriod] = useState<[string, string]>(() => monthBounds(localToday()));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);

  const programmes = register?.programmes ?? [];
  const programme = programmes.find((item) => item.id === programmeId) ?? null;
  const minimum = register?.citationMinimum ?? 1;

  const touch = () => { keyRef.current = null; setServerError(null); };

  const validate = (): Errors => {
    const next: Errors = {};
    const required = t(`${NS}.err_required`, "This field is required.");
    if (!nominee) next.nominee = required;
    if (!programmeId) next.programmeId = required;
    const length = citation.trim().length;
    if (length < minimum) next.citation = t(`${NS}.err_citation_min`, "The citation must be at least {min} characters; it prints on the certificate.", { min: minimum });
    if (length > 4000) next.citation = t(`${NS}.err_max`, "Keep this under {max} characters.", { max: 4000 });
    if (amount.trim() !== "") {
      const value = Number(amount);
      if (Number.isNaN(value) || value < 0) next.amount = t(`${NS}.err_amount`, "Enter an amount of zero or more.");
      else if (programme?.awardCeilingMinor !== null && programme?.awardCeilingMinor !== undefined && Math.round(value * 100) > programme.awardCeilingMinor) {
        next.amount = t(`${NS}.err_ceiling`, "The programme allows at most {max}.", { max: formatMoney(programme.awardCeilingMinor, programme.currency) });
      }
    }
    if (!period[0] || !period[1]) next.period = t(`${NS}.err_period`, "Enter the period the award covers.");
    else if (period[1] < period[0]) next.period = t(`${NS}.err_period_order`, "The period ends before it starts.");
    return next;
  };

  const close = () => {
    if (busy) return;
    keyRef.current = null;
    setErrors({}); setServerError(null); setCitation(""); setAmount(""); setNominee(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !register) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setServerError(null);
    const body: Record<string, unknown> = {
      action: "nominate", recipientEmployeeId: nominee?.id, programmeId, awardCategory: category,
      citation: citation.trim(), periodStart: period[0], periodEnd: period[1],
    };
    if (amount.trim() !== "") { body.awardMinor = Math.round(Number(amount) * 100); if (programme) body.currency = programme.currency; }
    const result = await sendJson("/api/v1/recognition-register", { method: "POST", body, idempotencyKey: keyRef.current, fallback: t(`${NS}.err_nominate_failed`, "The nomination could not be saved.") });
    setBusy(false);
    if (!result.ok) {
      const details = result.error.details.map((detail) => detail.issue).join(" ");
      setServerError(details ? `${result.error.message} ${details}` : result.error.message);
      return;
    }
    keyRef.current = null;
    showToast?.(t(`${NS}.toast_nominated_title`, "Nomination raised"), t(`${NS}.toast_nominated_body`, "{name} is nominated and awaits the committee.", { name: nominee?.name ?? "" }), "success");
    setCitation(""); setAmount(""); setNominee(null); setErrors({});
    onSaved();
    onClose();
  };

  const noProgrammes = register !== null && programmes.length === 0;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="award-dialog-title">
      <form className={styles.dialog} onSubmit={(event) => void submit(event)} noValidate>
        <header className={styles.dialogHeader}>
          <div>
            <h3 id="award-dialog-title">{t(`${NS}.award_title`, "Nominate for an award")}</h3>
            <p>{t(`${NS}.award_subtitle`, "The committee approves the nomination before it is published or paid.")}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label={t(`${NS}.close`, "Close")}><X size={16} aria-hidden="true" /></button>
        </header>
        <div className={styles.dialogBody}>
          {register === null && <p className={styles.unavailable}>{t(`${NS}.award_register_unavailable`, "The recognition register is not loaded, so a nomination cannot be raised yet.")}</p>}
          {noProgrammes && <p className={styles.unavailable}>{t(`${NS}.award_no_programmes`, "No recognition programme is configured for this organisation. Configure one before nominating.")}</p>}
          <EmployeePicker id="award-nominee" label={t(`${NS}.field_nominee`, "Nominee")} required value={nominee} onChange={(value) => { setNominee(value); touch(); }} error={errors.nominee} describedBy={errors.nominee ? "award-nominee-err" : undefined} />
          {errors.nominee && <span id="award-nominee-err" className={styles.fieldError}>{errors.nominee}</span>}
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}>
              <label htmlFor="award-programme">{t(`${NS}.field_programme`, "Programme")}<span className={styles.req} aria-hidden="true">*</span></label>
              <select id="award-programme" className={styles.formInput} value={programmeId} onChange={(event) => { setProgrammeId(event.target.value); touch(); }} aria-required="true" aria-invalid={errors.programmeId ? true : undefined} disabled={noProgrammes}>
                <option value="">{t(`${NS}.choose`, "Choose…")}</option>
                {programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {errors.programmeId && <span className={styles.fieldError}>{errors.programmeId}</span>}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="award-category">{t(`${NS}.field_category`, "Award category")}<span className={styles.req} aria-hidden="true">*</span></label>
              <select id="award-category" className={styles.formInput} value={category} onChange={(event) => { setCategory(event.target.value); touch(); }} aria-required="true">
                {picklistOptions("PL_AWARD_CATEGORY", t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="award-period-start">{t(`${NS}.field_period_start`, "Period from")}<span className={styles.req} aria-hidden="true">*</span></label>
              <input id="award-period-start" type="date" className={styles.formInput} value={period[0]} onChange={(event) => { setPeriod([event.target.value, period[1]]); touch(); }} aria-required="true" aria-invalid={errors.period ? true : undefined} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="award-period-end">{t(`${NS}.field_period_end`, "Period to")}<span className={styles.req} aria-hidden="true">*</span></label>
              <input id="award-period-end" type="date" className={styles.formInput} value={period[1]} onChange={(event) => { setPeriod([period[0], event.target.value]); touch(); }} aria-required="true" aria-invalid={errors.period ? true : undefined} />
              {errors.period && <span className={styles.fieldError}>{errors.period}</span>}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="award-amount">{t(`${NS}.field_award_amount`, "Award amount")} <span className={styles.muted}>{t(`${NS}.hint_optional`, "Optional")}</span></label>
            <input id="award-amount" type="number" min="0" step="0.01" inputMode="decimal" className={styles.formInput} value={amount} onChange={(event) => { setAmount(event.target.value); touch(); }} aria-invalid={errors.amount ? true : undefined} aria-describedby="award-amount-msg" />
            <span id="award-amount-msg" className={errors.amount ? styles.fieldError : styles.hint}>
              {errors.amount ?? (programme?.awardCeilingMinor != null ? t(`${NS}.hint_ceiling`, "Up to {max} for this programme.", { max: formatMoney(programme.awardCeilingMinor, programme.currency) }) : t(`${NS}.hint_no_ceiling`, "Leave empty for a non-monetary award."))}
            </span>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="award-citation">{t(`${NS}.field_citation`, "Citation")}<span className={styles.req} aria-hidden="true">*</span></label>
            <textarea id="award-citation" rows={4} maxLength={4000} className={styles.formInput} value={citation} onChange={(event) => { setCitation(event.target.value); touch(); }} aria-required="true" aria-invalid={errors.citation ? true : undefined} aria-describedby="award-citation-msg" />
            <span id="award-citation-msg" className={errors.citation ? styles.fieldError : styles.hint}>
              {errors.citation ?? t(`${NS}.hint_citation`, "{count} of at least {min} characters.", { count: citation.trim().length, min: minimum })}
            </span>
          </div>
          {serverError && <p className={styles.formError} role="alert">{serverError}</p>}
        </div>
        <footer className={styles.dialogFooter}>
          <button type="button" className={styles.btnSecondary} onClick={close} disabled={busy}>{t(`${NS}.cancel`, "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy || register === null || noProgrammes}>{busy ? t(`${NS}.saving`, "Saving…") : t(`${NS}.award_submit`, "Submit nomination")}</button>
        </footer>
      </form>
    </Dialog>
  );
}
