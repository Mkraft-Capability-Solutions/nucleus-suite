"use client";

import { useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import { X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "../OnboardingView.module.css";
import { localToday, newIdempotencyKey, sendJson, type Translate } from "./api";
import { picklistOptions } from "./picklistOptions";
import type { AssetRow } from "./AssetsTab";

/**
 * Records an asset return through POST /api/v1/assets/register/{id}/return. Mirrors
 * `returnAssetSchema`: a damaged or lost asset needs a recovery amount (0 allowed) and
 * remarks of at least 10 characters; otherwise a reason of at least 3.
 */

const NS = "components.Workspace.OnboardingView";
const RECOVERABLE = new Set(["damaged", "lost"]);

type Errors = Partial<Record<"returnedOn" | "recovery" | "reason", string>>;

export default function AssetReturnDialog({ asset, onClose, onReturned }: { asset: AssetRow | null; onClose: () => void; onReturned: () => void }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, tone: string) => void };
  const [condition, setCondition] = useState("good");
  const [returnedOn, setReturnedOn] = useState(localToday);
  const [recovery, setRecovery] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);

  const recoverable = RECOVERABLE.has(condition);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(returnedOn)) next.returnedOn = t(`${NS}.err_date`, "Enter a valid date.");
    else if (asset?.issued_on && returnedOn < asset.issued_on) next.returnedOn = t(`${NS}.err_return_before_issue`, "The return date cannot precede the issue date.");
    if (recoverable && (recovery.trim() === "" || Number.isNaN(Number(recovery)) || Number(recovery) < 0)) next.recovery = t(`${NS}.err_recovery`, "Enter the recovery amount; 0 if nothing is recovered.");
    const min = recoverable ? 10 : 3;
    if (reason.trim().length < min) next.reason = t(`${NS}.err_reason_min`, "Enter at least {min} characters.", { min });
    return next;
  };

  const close = () => {
    if (busy) return;
    keyRef.current = null;
    setErrors({}); setServerError(null); setReason(""); setRecovery(""); setCondition("good");
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!asset || busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setServerError(null);
    const body: Record<string, unknown> = { condition, returnedOn, reason: reason.trim() };
    if (recoverable) body.recoveryAmountMinor = Math.round(Number(recovery) * 100);
    const result = await sendJson(`/api/v1/assets/register/${encodeURIComponent(asset.id)}/return`, {
      method: "POST", body, idempotencyKey: keyRef.current, fallback: t(`${NS}.err_return_failed`, "The return could not be recorded."),
    });
    setBusy(false);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    keyRef.current = null;
    showToast?.(t(`${NS}.toast_returned_title`, "Asset returned"), t(`${NS}.toast_returned_body`, "{asset} is back in store.", { asset: asset.asset_code }), "success");
    setReason(""); setRecovery(""); setCondition("good");
    onReturned();
  };

  return (
    <Dialog open={asset !== null} onClose={close} fullWidth maxWidth="sm" aria-labelledby="asset-return-title">
      <form className={styles.dialog} onSubmit={(event) => void submit(event)} noValidate>
        <header className={styles.dialogHeader}>
          <div>
            <h3 id="asset-return-title">{t(`${NS}.return_title`, "Record asset return")}</h3>
            {asset && <p>{asset.asset_code} · {asset.description} · {asset.holder_name ?? ""}</p>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label={t(`${NS}.close`, "Close")}><X size={16} aria-hidden="true" /></button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.formGrid2}>
            <div className={styles.formGroup}>
              <label htmlFor="asset-return-condition">{t(`${NS}.field_return_condition`, "Condition at return")}<span className={styles.req} aria-hidden="true">*</span></label>
              <select id="asset-return-condition" className={styles.formInput} value={condition} onChange={(event) => setCondition(event.target.value)} aria-required="true">
                {picklistOptions("PL_ASSET_RETURN_CONDITION", t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="asset-return-date">{t(`${NS}.field_returned_on`, "Returned on")}<span className={styles.req} aria-hidden="true">*</span></label>
              <input id="asset-return-date" type="date" className={styles.formInput} value={returnedOn} onChange={(event) => setReturnedOn(event.target.value)} aria-required="true" aria-invalid={errors.returnedOn ? true : undefined} aria-describedby={errors.returnedOn ? "asset-return-date-err" : undefined} />
              {errors.returnedOn && <span id="asset-return-date-err" className={styles.fieldError}>{errors.returnedOn}</span>}
            </div>
          </div>
          {recoverable && (
            <div className={styles.formGroup}>
              <label htmlFor="asset-return-recovery">{t(`${NS}.field_recovery`, "Recovery amount")}<span className={styles.req} aria-hidden="true">*</span></label>
              <input id="asset-return-recovery" type="number" min="0" step="0.01" inputMode="decimal" className={styles.formInput} value={recovery} onChange={(event) => setRecovery(event.target.value)} aria-required="true" aria-invalid={errors.recovery ? true : undefined} aria-describedby="asset-return-recovery-hint" />
              <span id="asset-return-recovery-hint" className={errors.recovery ? styles.fieldError : styles.hint}>{errors.recovery ?? t(`${NS}.hint_recovery`, "Raised as a recovery line on full and final settlement.")}</span>
            </div>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="asset-return-reason">{recoverable ? t(`${NS}.field_remarks`, "Remarks") : t(`${NS}.field_reason`, "Reason")}<span className={styles.req} aria-hidden="true">*</span></label>
            <textarea id="asset-return-reason" rows={3} maxLength={500} className={styles.formInput} value={reason} onChange={(event) => setReason(event.target.value)} aria-required="true" aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? "asset-return-reason-err" : undefined} />
            {errors.reason && <span id="asset-return-reason-err" className={styles.fieldError}>{errors.reason}</span>}
          </div>
          {serverError && <p className={styles.formError} role="alert">{serverError}</p>}
        </div>
        <footer className={styles.dialogFooter}>
          <button type="button" className={styles.btnSecondary} onClick={close} disabled={busy}>{t(`${NS}.cancel`, "Cancel")}</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.saving`, "Saving…") : t(`${NS}.return_submit`, "Record return")}</button>
        </footer>
      </form>
    </Dialog>
  );
}
