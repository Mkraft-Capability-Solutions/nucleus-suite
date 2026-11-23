"use client";

import { useState, type CSSProperties } from "react";
import { AlertCircle, Download, HeartHandshake, Loader2, RefreshCcw, Scale, TrendingUp } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import { launchAction } from "@/lib/action-launcher";
import { downloadPrintableDocument } from "@/utils/exportUtils";
import { formatMoney, formatNumber, sendJson, useResource, useSubmitKey, type Translate } from "./payroll/payroll-client";
import styles from "./CompensationView.module.css";

/**
 * Compensation and benefits for the signed-in employee, from
 * GET /api/v1/compensation/summary: monthly basic, CTC when the salary assignment
 * records one, the band of the employee's grade, compa-ratio and in-band position,
 * and the flex-benefit catalogue with the employee's active enrollments.
 * "Lock selections" posts the newly chosen options to POST /api/v1/benefits/selections.
 * No figure is estimated; a missing source is shown as not available with the reason.
 */

const NS = "components.Workspace.CompensationView";

type Band = { gradeCode: string | null; minMinor: number; maxMinor: number; midMinor: number; currency: string };
type Benefit = { optionId: string; optionCode: string; optionName: string; planCode: string; planName: string; coverageMinor: number | null; employeeShareMinor: number | null; enrolled: boolean };
type Summary = {
  employee: { id: string; code: string; name: string; currency: string };
  basicMonthlyMinor: number | null;
  annualCtcMinor: number | null;
  band: Band | null;
  compaRatio: number | null;
  bandPositionPct: number | null;
  marketBenchmark: null;
  benefits: Benefit[];
};
type Toast = (title: string, message: string, tone: "success" | "error" | "info") => void;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export default function CompensationView(_props: { onNavigate?: unknown; onSelectConsole?: unknown; activeSubFeature?: string | null }) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = (useHRMS() ?? {}) as { showToast?: Toast };
  const notify: Toast = (title, message, tone) => showToast?.(title, message, tone);
  const summary = useResource<Summary>("/api/v1/compensation/summary");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const submitKey = useSubmitKey();
  const notAvailable = t(`${NS}.text_not_available`, "Not available");

  if (summary.state.status === "loading") {
    return <div className={styles.container}><div className={styles.stateBox} role="status" aria-live="polite"><Loader2 size={16} aria-hidden="true" />{t(`${NS}.text_loading`, "Loading…")}</div></div>;
  }
  if (summary.state.status === "error") {
    return (
      <div className={styles.container}>
        <div className={`${styles.stateBox} ${styles.stateError}`} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{summary.state.message}</span>
          <button type="button" className={styles.btnSecondary} onClick={summary.reload}><RefreshCcw size={13} aria-hidden="true" />{t(`${NS}.text_retry`, "Retry")}</button>
        </div>
      </div>
    );
  }

  const data = summary.state.data;
  const currency = data.employee.currency;
  const money = (minor: number | null, cur = currency) => (minor === null ? notAvailable : formatMoney(minor, cur, locale));
  const band = data.band;
  const bandText = band ? (band.gradeCode ?? "—") : notAvailable;
  const position = data.bandPositionPct;
  const inBand = position !== null && position >= 0 && position <= 100;
  const newlyChosen = data.benefits.filter((benefit) => !benefit.enrolled && chosen.has(benefit.optionId));
  const allLocked = data.benefits.length > 0 && data.benefits.every((benefit) => benefit.enrolled);

  const exportStatement = () => {
    const meta: Record<string, string> = {
      [t(`${NS}.text_employee`, "Employee")]: `${data.employee.name} (${data.employee.code})`,
      [t(`${NS}.text_current_ctc`, "Current total CTC")]: money(data.annualCtcMinor),
      [t(`${NS}.text_monthly_basic`, "Monthly basic")]: money(data.basicMonthlyMinor),
      [t(`${NS}.text_band`, "Band")]: bandText,
      [t(`${NS}.text_compa_ratio`, "Compa-ratio")]: data.compaRatio === null ? notAvailable : formatNumber(data.compaRatio, locale, 2),
      [t(`${NS}.text_market_benchmark`, "Market benchmark")]: notAvailable,
      [t(`${NS}.text_salary_range`, "Salary band range")]: band ? `${money(band.minMinor, band.currency)} – ${money(band.maxMinor, band.currency)}` : notAvailable,
    };
    downloadPrintableDocument(
      "Total_Rewards_Statement",
      Object.fromEntries(Object.entries(meta).map(([key, value]) => [escapeHtml(key), escapeHtml(value)])),
      [t(`${NS}.text_benefit`, "Benefit"), t(`${NS}.text_coverage`, "Annual coverage"), t(`${NS}.text_employee_share`, "Employee share"), t(`${NS}.text_enrolled`, "Enrolled")].map(escapeHtml),
      data.benefits.map((benefit) => [
        escapeHtml(`${benefit.planName} — ${benefit.optionName}`),
        escapeHtml(money(benefit.coverageMinor)),
        escapeHtml(money(benefit.employeeShareMinor)),
        escapeHtml(benefit.enrolled ? t(`${NS}.text_yes`, "Yes") : t(`${NS}.text_no`, "No")),
      ]),
    );
    notify(t(`${NS}.text_statement`, "Total rewards statement"), t(`${NS}.text_statement_ready`, "The statement opened for printing or saving as PDF."), "success");
  };

  const lockSelections = async () => {
    if (pending) return;
    const title = t(`${NS}.text_lock_selections`, "Lock selections");
    if (newlyChosen.length === 0) {
      setLockError(t(`${NS}.text_err_select_one`, "Select at least one benefit that is not already enrolled."));
      return;
    }
    setLockError(null);
    const body = { optionIds: newlyChosen.map((benefit) => benefit.optionId) };
    setPending(true);
    const result = await sendJson("/api/v1/benefits/selections", body, { key: submitKey.key(JSON.stringify(body)), fallbackError: t(`${NS}.text_save_failed`, "This could not be saved. Check the details and try again.") });
    setPending(false);
    if (!result.ok) {
      setLockError(result.message);
      notify(title, result.message, "error");
      return;
    }
    submitKey.reset();
    setChosen(new Set());
    notify(title, t(`${NS}.text_locked_done`, "{count} benefit selections were locked.", { count: body.optionIds.length }), "success");
    summary.reload();
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_title`, "Compensation and benefits")}</h2>
          <p>{t(`${NS}.text_intro`, "Your pay band, compa-ratio, the annual review cycle and your flexible benefits.")}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={exportStatement}><Download size={16} aria-hidden="true" />{t(`${NS}.text_statement`, "Total rewards statement")}</button>
          <button type="button" className={styles.btnPrimary} onClick={() => launchAction("compCycle")}><TrendingUp size={16} aria-hidden="true" />{t(`${NS}.text_review_cycle`, "Annual review cycle")}</button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t(`${NS}.text_current_ctc`, "Current total CTC")}</span>
          <span className={styles.statValue} title={data.annualCtcMinor === null ? t(`${NS}.text_no_ctc`, "No CTC is recorded on your salary assignment.") : undefined}>{money(data.annualCtcMinor)}</span>
          <span className={styles.statSub}>{t(`${NS}.text_band_basic`, "Band {band} · monthly basic {basic}", { band: bandText, basic: money(data.basicMonthlyMinor) })}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t(`${NS}.text_compa_ratio`, "Compa-ratio")}</span>
          <span className={styles.statValue} title={data.compaRatio === null ? t(`${NS}.text_no_band`, "No pay band is configured for your grade.") : undefined}>{data.compaRatio === null ? notAvailable : formatNumber(data.compaRatio, locale, 2)}</span>
          <span className={styles.statSub} title={t(`${NS}.text_no_benchmark`, "No market survey data is loaded for this tenant.")}>{t(`${NS}.text_benchmark_unavailable`, "Market benchmark: not available")}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t(`${NS}.text_salary_range`, "Salary band range")}</span>
          <span className={`${styles.statValue} ${styles.statValueSmall}`}>{band ? `${money(band.minMinor, band.currency)} – ${money(band.maxMinor, band.currency)}` : notAvailable}</span>
          <span className={styles.statSub}>{t(`${NS}.text_band_unit`, "Monthly basic, minimum to maximum")}</span>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="comp-band">
        <div className={styles.cardHeader}>
          <h3 id="comp-band"><Scale size={20} aria-hidden="true" />{t(`${NS}.text_band_visualizer`, "Band visualiser and compa-ratio position")}</h3>
          {position !== null && <span className={inBand ? styles.zoneOk : styles.zoneFlag}>{inBand ? t(`${NS}.text_within_band`, "Within band") : position < 0 ? t(`${NS}.text_below_band`, "Below band minimum") : t(`${NS}.text_above_band`, "Above band maximum")}</span>}
        </div>
        {!band ? (
          <div className={styles.stateBox} role="note">{t(`${NS}.text_no_band`, "No pay band is configured for your grade.")}</div>
        ) : (
          <div>
            <div className={styles.bandLabels}>
              <span>{t(`${NS}.text_band_min`, "Band minimum: {value}", { value: money(band.minMinor, band.currency) })}</span>
              <span>{t(`${NS}.text_band_mid`, "Midpoint: {value}", { value: money(band.midMinor, band.currency) })}</span>
              <span>{t(`${NS}.text_band_max`, "Band maximum: {value}", { value: money(band.maxMinor, band.currency) })}</span>
            </div>
            <div className={styles.bandTrack} role="img" aria-label={t(`${NS}.text_band_position_aria`, "Your basic sits at {pct} % of the band", { pct: position === null ? "—" : formatNumber(position, locale, 1) })}>
              {position !== null && <span className={styles.bandMarker} style={{ insetInlineStart: `${Math.min(100, Math.max(0, position))}%` } as CSSProperties} />}
            </div>
            <div className={styles.placement}>
              <span className={styles.chip}>
                {t(`${NS}.text_placement`, "Your placement: {basic} (compa-ratio {ratio})", { basic: money(data.basicMonthlyMinor), ratio: data.compaRatio === null ? notAvailable : formatNumber(data.compaRatio, locale, 2) })}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="comp-benefits">
        <div className={styles.cardHeader}>
          <h3 id="comp-benefits"><HeartHandshake size={20} aria-hidden="true" />{t(`${NS}.text_flex_benefits`, "Flexible benefits and wellness plan")}</h3>
          <button type="button" className={styles.btnSecondary} disabled={pending || allLocked || data.benefits.length === 0} onClick={() => void lockSelections()}>
            {pending ? t(`${NS}.text_submitting`, "Submitting…") : allLocked ? t(`${NS}.text_selections_locked`, "Selections locked") : t(`${NS}.text_lock_selections`, "Lock selections")}
          </button>
        </div>
        <p className={styles.muted}>{t(`${NS}.text_benefits_intro`, "Choose the flex benefits for your basket. Locked selections become active enrollments and cannot be changed here.")}</p>
        {lockError && <div className={`${styles.stateBox} ${styles.stateError}`} role="alert">{lockError}</div>}
        {data.benefits.length === 0 ? (
          <div className={styles.stateBox} role="note">{t(`${NS}.text_no_benefits`, "No benefit plan is offered by your employer yet.")}</div>
        ) : data.benefits.map((benefit) => (
          <div key={benefit.optionId} className={styles.flexItem}>
            <label className={styles.flexLabel}>
              <input type="checkbox" checked={benefit.enrolled || chosen.has(benefit.optionId)} disabled={benefit.enrolled || pending}
                onChange={(event) => setChosen((current) => { const next = new Set(current); if (event.target.checked) next.add(benefit.optionId); else next.delete(benefit.optionId); return next; })} />
              <span>
                <span className={styles.flexName}>{`${benefit.planName} — ${benefit.optionName}`}</span>
                <span className={styles.micro}>{benefit.enrolled ? ` · ${t(`${NS}.text_enrolled_badge`, "Enrolled")}` : ""}</span>
                <span className={styles.micro}>{` · ${t(`${NS}.text_employee_share_value`, "Your share: {value}", { value: money(benefit.employeeShareMinor) })}`}</span>
              </span>
            </label>
            <span className={styles.flexValue}>
              <span className={styles.srOnly}>{t(`${NS}.text_coverage`, "Annual coverage")}</span>
              {money(benefit.coverageMinor)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
