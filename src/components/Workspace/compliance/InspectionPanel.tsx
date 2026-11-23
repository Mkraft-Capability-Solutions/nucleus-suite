"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { FileCheck, FileText, X } from "lucide-react";
import { launchAction } from "@/lib/action-launcher";
import styles from "../ComplianceView.module.css";
import { NS, fieldErrors, formatDate, todayIso, useSubmit, useT, type Problem } from "./api";
import type { InspectionEntry } from "./types";

/**
 * Form 36 inspection book. New visits use the workspace "Record inspector entry" action, which posts to
 * POST /api/v1/compliance (action "inspector"); closing a visit certifies its directions as complied
 * (action "close_inspection").
 */

function CloseDialog({ entry, onClose, onSaved }: { entry: InspectionEntry; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [manager, setManager] = useState("");
  const [closureDate, setClosureDate] = useState(todayIso());
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const errors = fieldErrors(problem);
  const beforeVisit = entry.visitDate !== null && closureDate < entry.visitDate;
  const future = closureDate > todayIso();
  const valid = manager.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(closureDate) && !beforeVisit && !future;

  const save = async () => {
    if (!valid || pending) return;
    setProblem(null);
    const result = await submit("/api/v1/compliance", { action: "close_inspection", inspectionId: entry.id, certifyingManager: manager.trim(), closureDate },
      t(`${NS}.insp_close_failed`, "The inspection entry could not be closed."));
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onSaved();
  };

  const dateError = errors.closureDate ?? (beforeVisit ? t(`${NS}.err_before_visit`, "The closure date cannot precede the visit date.") : future ? t(`${NS}.err_future`, "The date cannot be in the future.") : undefined);
  return (
    <Dialog open onClose={() => !pending && onClose()} fullWidth maxWidth="sm" aria-labelledby="insp-close-title">
      <div className={styles.dialogBody}>
        <div className={styles.modalTitle}>
          <h3 id="insp-close-title">{t(`${NS}.insp_close_title`, "Certify inspector directions as complied")}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={pending} aria-label={t(`${NS}.close`, "Close")}><X size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.insp_manager`, "Certifying manager")}</span>
              <input className={styles.input} maxLength={160} value={manager} onChange={(e) => setManager(e.target.value)} aria-required="true" autoFocus
                aria-invalid={errors.certifyingManager ? "true" : undefined} />
              {errors.certifyingManager && <span className={styles.fieldError}>{errors.certifyingManager}</span>}
            </label>
            <label className={styles.field}>
              <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.insp_closure_date`, "Closure date")}</span>
              <input type="date" className={styles.input} value={closureDate} max={todayIso()} min={entry.visitDate ?? undefined} onChange={(e) => setClosureDate(e.target.value)} aria-required="true" aria-invalid={dateError ? "true" : undefined} />
              {dateError && <span className={styles.fieldError}>{dateError}</span>}
            </label>
          </div>
          {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={pending}>{t(`${NS}.cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={!valid || pending}>{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.insp_close_submit`, "Close entry")}</button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export default function InspectionPanel({ inspections, onChanged }: { inspections: InspectionEntry[]; onChanged: (message: string) => void }) {
  const { t, locale } = useT();
  const [closing, setClosing] = useState<InspectionEntry | null>(null);
  const nr = t(`${NS}.not_recorded`, "Not recorded");
  return (
    <div className={styles.cardPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3><FileText size={18} aria-hidden="true" /> {t(`${NS}.insp_title`, "Form 36: Factory inspection book")}</h3>
          <p>{t(`${NS}.insp_subtitle`, "Section 112, Factories Act 1948 · record of Inspector of Factories visits")}</p>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={() => launchAction("inspector")}><FileCheck size={14} aria-hidden="true" />{t(`${NS}.insp_new`, "Record inspector entry")}</button>
      </div>
      {inspections.length === 0 && <p className={styles.stateNote}>{t(`${NS}.insp_empty`, "No inspection visits are recorded.")}</p>}
      {inspections.map((insp) => (
        <div key={insp.id} className={styles.inspectionCard}>
          <div className={styles.rowBetween}>
            <strong>{formatDate(insp.visitDate, locale) ?? nr} · {insp.authority}</strong>
            <span className={insp.status === "closed" ? styles.tagGreen : styles.tagBlue}>{insp.status === "closed" ? t(`${NS}.insp_closed`, "Closed") : t(`${NS}.insp_open`, "Open")}</span>
          </div>
          <div className={styles.metaLine}><strong>{t(`${NS}.insp_inspector`, "Visiting inspector")}:</strong> {insp.inspector}</div>
          <div className={styles.inspectionBody}>
            <div><strong>{t(`${NS}.insp_purpose`, "Purpose")}:</strong> {insp.purpose}</div>
            <div><strong>{t(`${NS}.insp_observations`, "Statutory observations")}:</strong> {insp.observations ?? nr}</div>
            <div><strong>{t(`${NS}.insp_directions`, "Remedial directions")}:</strong> {insp.remedialDirections ?? nr}</div>
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.metaLine}>{t(`${NS}.insp_certifying`, "Certifying manager")}: {insp.certifyingManager ?? nr} · {t(`${NS}.insp_closure`, "Closure date")}: {formatDate(insp.closureDate, locale) ?? nr}</span>
            {insp.status === "open" && <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => setClosing(insp)}>{t(`${NS}.insp_close`, "Certify & close")}</button>}
          </div>
        </div>
      ))}
      {closing && <CloseDialog entry={closing} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); onChanged(t(`${NS}.insp_closed_done`, "Inspection entry closed.")); }} />}
    </div>
  );
}
