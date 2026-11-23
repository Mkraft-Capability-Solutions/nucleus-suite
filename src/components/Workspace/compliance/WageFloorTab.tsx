"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatMoney, formatNumber, useResource, useT } from "./api";

/**
 * Code on Wages 50 % wage-floor simulator. The sliders are inputs only; every result line (floor, add-back,
 * contribution deltas) comes from POST /api/v1/compliance/wage-floor, which computes against the tenant's
 * stored rule pack. Without a stored floor the tab says so instead of computing with an assumed figure.
 */

/** The Labour Codes are Indian law, so the simulator works in rupees. */
const SIMULATOR_CURRENCY = "INR";
/** Slider bounds and starting structure: simulator UX, not business data. */
const GROSS = { min: 20000, max: 300000, step: 5000, start: 100000 };
const SLIDERS = {
  basic: { min: 20, max: 60, start: 35 },
  da: { min: 0, max: 20, start: 5 },
  hra: { min: 10, max: 50, start: 30 },
  special: { min: 0, max: 50, start: 30 },
} as const;
type SliderKey = keyof typeof SLIDERS;

type Config = { configured: boolean; packCode: string | null; packVersion: string | null; effectiveFrom: string | null; floorPercent: number | null };
type Line = { component: string; preCodeMinor: number; postCodeMinor: number; deltaMinor: number };
type Result = { basicDaPercent: number; floorTriggered: boolean; declaredBaseMinor: number; statutoryBaseMinor: number; addBackMinor: number; lines: Line[]; rateSource: string | null };
type Simulation = { status: "idle" | "loading" } | { status: "ready"; result: Result | null } | { status: "error"; message: string };

export default function WageFloorTab() {
  const { t, locale } = useT();
  const config = useResource<Config>("/api/v1/compliance/wage-floor", t(`${NS}.wf_config_failed`, "The wage-floor rule pack could not be loaded."));
  const [gross, setGross] = useState(GROSS.start);
  const [pct, setPct] = useState<Record<SliderKey, number>>({ basic: SLIDERS.basic.start, da: SLIDERS.da.start, hra: SLIDERS.hra.start, special: SLIDERS.special.start });
  const [simulation, setSimulation] = useState<Simulation>({ status: "idle" });
  const money = (minor: number) => formatMoney(minor, SIMULATOR_CURRENCY, locale) ?? "";
  const part = (key: SliderKey) => Math.round(gross * pct[key]);
  const totalPct = pct.basic + pct.da + pct.hra + pct.special;
  const configured = config.state.status === "ready" && config.state.data.configured;

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSimulation({ status: "loading" });
      try {
        const response = await fetch("/api/v1/compliance/wage-floor", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grossMinor: gross * 100, basicMinor: Math.round(gross * pct.basic), dearnessMinor: Math.round(gross * pct.da), hraMinor: Math.round(gross * pct.hra), specialMinor: Math.round(gross * pct.special) }),
        });
        const payload = (await response.json().catch(() => null)) as { data?: { result: Result | null }; error?: { message?: string } } | null;
        if (!response.ok || !payload?.data) throw new Error(payload?.error?.message || t(`${NS}.wf_sim_failed`, "The simulation could not be run."));
        setSimulation({ status: "ready", result: payload.data.result });
      } catch (error) {
        if (!controller.signal.aborted) setSimulation({ status: "error", message: error instanceof Error ? error.message : t(`${NS}.wf_sim_failed`, "The simulation could not be run.") });
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [gross, pct, configured, t]);

  const floorPercent = config.state.status === "ready" ? config.state.data.floorPercent : null;
  const result = simulation.status === "ready" ? simulation.result : null;

  const slider = (key: SliderKey, label: string) => (
    <div className={styles.inputGroup}>
      <div className={styles.inputLabelRow}>
        <label htmlFor={`wf-${key}`}>{t(`${NS}.wf_component_pct`, "{label} ({pct}%)", { label, pct: pct[key] })}</label>
        <strong>{money(part(key))}</strong>
      </div>
      <input id={`wf-${key}`} type="range" min={SLIDERS[key].min} max={SLIDERS[key].max} step={1} value={pct[key]} className={styles.rangeInput}
        onChange={(e) => setPct((current) => ({ ...current, [key]: Number(e.target.value) }))} />
    </div>
  );

  return (
    <div className={styles.simulatorSection}>
      <div className={styles.simNotice}>
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.wf_notice_title`, "Code on Wages (Clause 2(y)):")}</strong>{" "}
          {floorPercent === null
            ? t(`${NS}.wf_notice_body_unset`, "Basic + Dearness Allowance + Retaining Allowance must reach the statutory share of total remuneration; excess exclusions are added back to the wage base for PF, ESI and gratuity.")
            : t(`${NS}.wf_notice_body`, "Basic + Dearness Allowance + Retaining Allowance must reach {floor}% of total remuneration; excess exclusions are added back to the wage base for PF, ESI and gratuity.", { floor: formatNumber(floorPercent, locale, 2) })}
        </div>
      </div>

      {config.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.wf_loading`, "Loading the stored rule pack…")}</p>}
      {config.state.status === "error" && (
        <div className={styles.errorNote} role="alert">
          <span>{config.state.message}</span>
          <button type="button" className={styles.btnSecondary} onClick={() => void config.reload()}>{t(`${NS}.retry`, "Retry")}</button>
        </div>
      )}
      {config.state.status === "ready" && !config.state.data.configured && (
        <p className={styles.stateNote}>{t(`${NS}.wf_unconfigured`, "No wage-floor percentage is stored in this tenant's rule pack, so no simulation is run. Assign a rule pack with a wage floor to enable it.")}</p>
      )}

      {configured && (
        <div className={styles.simGrid}>
          <div className={styles.inputCard}>
            <h3>{t(`${NS}.wf_inputs_title`, "1. Salary structure inputs (monthly)")}</h3>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabelRow}>
                <label htmlFor="wf-gross">{t(`${NS}.wf_gross`, "Total monthly gross")}</label>
                <strong>{money(gross * 100)}</strong>
              </div>
              <input id="wf-gross" type="range" min={GROSS.min} max={GROSS.max} step={GROSS.step} value={gross} className={styles.rangeInput} onChange={(e) => setGross(Number(e.target.value))} />
            </div>
            {slider("basic", t(`${NS}.wf_basic`, "Basic salary"))}
            {slider("da", t(`${NS}.wf_da`, "Dearness allowance"))}
            {slider("hra", t(`${NS}.wf_hra`, "HRA allowance"))}
            {slider("special", t(`${NS}.wf_special`, "Special allowance"))}
            <div className={styles.splitBreakdown}>
              <div className={styles.splitPill}>{t(`${NS}.wf_basic_da_share`, "Basic + DA: {pct}%", { pct: pct.basic + pct.da })}</div>
              <div className={styles.splitPill}>{t(`${NS}.wf_excluded_share`, "Excluded: {pct}%", { pct: pct.hra + pct.special })}</div>
              {totalPct !== 100 && <div className={styles.splitPill} role="status">{t(`${NS}.wf_total_off`, "Components add up to {pct}% of gross", { pct: totalPct })}</div>}
            </div>
          </div>

          <div className={styles.resultCard} aria-live="polite">
            <h3>{t(`${NS}.wf_result_title`, "2. Statutory floor add-back")}</h3>
            {simulation.status === "loading" && !result && <p className={styles.stateNote}>{t(`${NS}.wf_simulating`, "Simulating against the stored rule pack…")}</p>}
            {simulation.status === "error" && <p className={styles.errorNote} role="alert">{simulation.message}</p>}
            {result && (
              <>
                <div className={styles.metricComparison}>
                  <div className={styles.compBlock}>
                    <span className={styles.compLabel}>{t(`${NS}.wf_declared_base`, "Current declared wage base")}</span>
                    <div className={styles.compVal}>{money(result.declaredBaseMinor)}</div>
                    <span className={styles.compSub}>{t(`${NS}.wf_declared_sub`, "Basic + DA ({pct}% of gross)", { pct: formatNumber(result.basicDaPercent, locale, 2) })}</span>
                  </div>
                  <div className={styles.arrowIcon} aria-hidden="true">→</div>
                  <div className={`${styles.compBlock} ${result.floorTriggered ? styles.compBlockAlert : styles.compBlockSuccess}`}>
                    <span className={styles.compLabel}>{t(`${NS}.wf_statutory_base`, "Labour Codes statutory base")}</span>
                    <div className={styles.compVal}>{money(result.statutoryBaseMinor)}</div>
                    <span className={styles.compSub}>
                      {result.floorTriggered
                        ? t(`${NS}.wf_addback`, "Add-back of {amount} applied", { amount: money(result.addBackMinor) })
                        : t(`${NS}.wf_no_addback`, "No add-back required")}
                    </span>
                  </div>
                </div>

                <div className={styles.cascadeTableWrapper}>
                  <table className={styles.cascadeTable}>
                    <thead>
                      <tr>
                        <th scope="col">{t(`${NS}.wf_col_component`, "Statutory component")}</th>
                        <th scope="col">{t(`${NS}.wf_col_pre`, "Pre-Labour Codes")}</th>
                        <th scope="col">{t(`${NS}.wf_col_post`, "Under Labour Codes")}</th>
                        <th scope="col">{t(`${NS}.wf_col_delta`, "Variance")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lines.length === 0 && (
                        <tr><td colSpan={4} className={styles.unavailable}>{t(`${NS}.wf_no_rates`, "The rule pack stores no contribution rates, so no PF, ESI or gratuity lines can be computed.")}</td></tr>
                      )}
                      {result.lines.map((line) => (
                        <tr key={line.component}>
                          <td><strong>{line.component}</strong></td>
                          <td>{money(line.preCodeMinor)}</td>
                          <td className={styles.boldCell}>{money(line.postCodeMinor)}</td>
                          <td className={line.deltaMinor > 0 ? styles.textRed : styles.textGreen}>{line.deltaMinor > 0 ? `+${money(line.deltaMinor)}` : money(line.deltaMinor)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <strong>{t(`${NS}.wf_take_home`, "Net in-hand take-home")}</strong>
                          <div className={styles.tableHint}>{t(`${NS}.wf_take_home_hint`, "Approx monthly disposable cash")}</div>
                        </td>
                        <td colSpan={3} className={styles.unavailable}>{t(`${NS}.wf_take_home_unavailable`, "Not simulated: take-home depends on tax and other deductions, which only the payroll run computes.")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {result.rateSource && <p className={styles.metaLine}>{t(`${NS}.wf_rate_source`, "Rates from stored rule-pack entries: {codes}", { codes: result.rateSource })}</p>}

                {result.floorTriggered && (
                  <div className={styles.advisorBox}>
                    <strong>{t(`${NS}.wf_advice_title`, "Recommendation")}</strong>
                    <p>{t(`${NS}.wf_advice_body`, "Raise Basic + DA to {amount} to meet the floor directly and avoid the add-back of {addback}.", { amount: money(result.statutoryBaseMinor), addback: money(result.addBackMinor) })}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
