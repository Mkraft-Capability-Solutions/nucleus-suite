"use client";

import { useRef, useState, type FormEvent } from "react";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import { useTranslation } from "@/context/I18nContext";
import { MCI_PREVIEW_WEIGHTS, type MciDimension, type WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { Badge, CardHeader, NS, Notice, reasonText, useFormat } from "./AnalyticsParts";
import EmployeeSearch, { type EmployeeOption } from "./EmployeeSearch";
import styles from "../AnalyticsView.module.css";

type Toast = (title: string, message: string, type?: string) => void;
const DIMENSIONS: Array<[MciDimension, string, string]> = [
  ["performance", "label_mci_performance", "Performance & 9-Box Weight ({weight}%)"],
  ["skills", "label_mci_skills", "Skills & Competency Rating ({weight}%)"],
  ["learning", "label_mci_learning", "L&D / Course Completion ({weight}%)"],
  ["engagement", "label_mci_engagement", "Engagement & Pulse Score ({weight}%)"],
  ["tenure", "label_mci_tenure", "Tenure & Organizational Loyalty ({weight}%)"],
];
type Inputs = Record<MciDimension, number | null>;
const EMPTY: Inputs = { performance: null, skills: null, learning: null, engagement: null, tenure: null };

/**
 * MCI engine: the formula preview is UX only; Compute posts to POST /api/v1/analytics/capability-index, which
 * stores the authoritative run (employee.write, Idempotency-Key). The privacy card lists published metric
 * definitions with their latest snapshot from the server.
 */
export default function CapabilityTab({ data, showToast, onComputed }: { data: WorkforceInsightsPayload; showToast: Toast; onComputed: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [inputs, setInputs] = useState<Inputs>(EMPTY);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const complete = DIMENSIONS.every(([key]) => inputs[key] !== null);
  const preview = complete
    ? Math.round(DIMENSIONS.reduce((sum, [key]) => sum + ((inputs[key] ?? 0) * MCI_PREVIEW_WEIGHTS[key]) / 100, 0) * 100) / 100
    : null;

  const setInput = (key: MciDimension, raw: string) => {
    keyRef.current = null;
    const value = raw === "" ? null : Math.max(0, Math.min(100, Number(raw)));
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : null }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!employee || !complete || pending) {
      document.getElementById(employee ? "analytics-mci-performance" : "analytics-mci-employee")?.focus();
      return;
    }
    setPending(true);
    setError(null);
    keyRef.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/analytics/capability-index", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": keyRef.current },
        body: JSON.stringify({ employeeId: employee.id, inputs }),
      });
      const body = (await response.json().catch(() => null)) as { data?: { attributes?: { index?: number } }; error?: { message?: string } } | null;
      if (!response.ok) {
        setError(body?.error?.message || t(`${NS}.error_mci_failed`, "The capability index could not be computed."));
        return;
      }
      keyRef.current = null;
      const index = body?.data?.attributes?.index;
      showToast(t(`${NS}.toast_mci_saved`, "Capability index saved"),
        typeof index === "number" ? t(`${NS}.toast_mci_saved_detail`, "{employee}: {index} / 100", { employee: employee.label, index: f.number(index, 2) }) : employee.label, "success");
      setInputs(EMPTY);
      setEmployee(null);
      setSubmitted(false);
      onComputed();
    } catch {
      setError(t(`${NS}.error_network`, "Could not reach the server. Please try again."));
    } finally {
      setPending(false);
    }
  };

  const { metrics } = data;
  return (
    <div className={styles.panel}>
      <div className={styles.grid2}>
        <section className={styles.card}>
          <CardHeader icon={<SpeedOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_mci_v2_interactive_capability_index_form`, "MCI v2 Interactive Capability Index Formula")}
            badge={<Badge tone="signal">{preview === null ? t(`${NS}.text_live_score_pending`, "Live Score: enter all five inputs") : t(`${NS}.text_live_score_value`, "Live Score: {score} / 100", { score: f.number(preview, 1) })}</Badge>} />
          <form className={styles.list} onSubmit={submit} noValidate>
            <div className={styles.field}>
              <label htmlFor="analytics-mci-employee">{t(`${NS}.label_mci_employee`, "Employee")} *</label>
              <EmployeeSearch id="analytics-mci-employee" value={employee} onChange={(option) => { keyRef.current = null; setEmployee(option); }}
                invalid={submitted && !employee} describedBy={submitted && !employee ? "analytics-mci-employee-error" : undefined} />
              {submitted && !employee && <span id="analytics-mci-employee-error" className={styles.fieldError}>{t(`${NS}.error_mci_employee`, "Choose the employee this index is for.")}</span>}
            </div>
            {DIMENSIONS.map(([key, labelKey, fallback]) => (
              <div key={key} className={styles.field}>
                <label htmlFor={`analytics-mci-${key}`}>{t(`${NS}.${labelKey}`, fallback, { weight: MCI_PREVIEW_WEIGHTS[key] })} *</label>
                <div className={styles.actionRow}>
                  <input type="range" min={0} max={100} className={styles.range} aria-hidden="true" tabIndex={-1}
                    value={inputs[key] ?? 0} onChange={(e) => setInput(key, e.target.value)} style={{ flex: 1 }} />
                  <input id={`analytics-mci-${key}`} type="number" min={0} max={100} step={1} inputMode="numeric" className={styles.input} style={{ inlineSize: "6rem" }}
                    aria-required="true" aria-invalid={submitted && inputs[key] === null}
                    value={inputs[key] ?? ""} onChange={(e) => setInput(key, e.target.value)} />
                </div>
              </div>
            ))}
            {submitted && !complete && <span className={styles.fieldError}>{t(`${NS}.error_mci_inputs`, "Enter a value from 0 to 100 for all five dimensions.")}</span>}
            {error && <Notice error>{error}</Notice>}
            <div className={styles.actionRow}>
              <button type="submit" className={styles.btnPrimary} disabled={pending}>
                {pending ? t(`${NS}.text_saving`, "Saving...") : t(`${NS}.text_compute_mci`, "Compute & save index")}
              </button>
              <span className={styles.rowSub}>{t(`${NS}.text_mci_permitted_use`, "Used for development planning only; no automated decision is taken.")}</span>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <CardHeader icon={<SecurityOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_metric_snapshot_privacy_suppression`, "Metric Snapshot Privacy & Suppression")}
            badge={<Badge tone="ok">{t(`${NS}.text_threshold_per_metric`, "Threshold per metric")}</Badge>} />
          <p className={styles.muted} style={{ marginBlockEnd: "1rem" }}>
            {t(`${NS}.text_to_preserve_employee_confidentiality_met`, "To preserve employee confidentiality, metrics with cohort size smaller than 5 are automatically suppressed in exports and public radar charts.")}
          </p>
          {!metrics.available ? (
            <Notice>{reasonText(t, metrics.reason)}</Notice>
          ) : (
            <div className={styles.list}>
              {metrics.value.map((m) => (
                <div key={m.code} className={styles.rowTile}>
                  <div>
                    <div className={styles.rowTitle}>{m.name}</div>
                    <div className={styles.rowSub}>
                      <code>{m.code}</code>{" "}
                      {m.cohortSize === null
                        ? t(`${NS}.text_no_snapshot`, "• No snapshot yet")
                        : t(`${NS}.text_cohort_threshold`, "• Cohort: {cohort} · Threshold: N ≥ {threshold}", { cohort: f.number(m.cohortSize), threshold: m.privacyThreshold })}
                    </div>
                  </div>
                  {m.suppressed !== null && (
                    <Badge tone={m.suppressed ? "flag" : "ok"}>
                      {m.suppressed ? t(`${NS}.text_suppressed`, "Suppressed (< {threshold})", { threshold: m.privacyThreshold }) : t(`${NS}.text_published`, "Published")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
