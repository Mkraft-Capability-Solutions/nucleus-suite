"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { EvalSuiteSummary, NucleusIntelligencePayload } from "@/lib/cockpits/nucleus-intelligence-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./NucleusIntelligence.module.css";
import ReviewQueue from "./NucleusIntelligenceReviewQueue";
import { NS, humanise, toneBadge, useStamp } from "./nucleus-intelligence-format";

/**
 * Nucleus Intelligence (Workspace Governance / AI governance console). Every row comes from
 * GET /api/v1/cockpits/nucleus-intelligence; a feed that did not resolve shows its reason instead of rows.
 * Chart styles are the console's existing ones (grouped bars, sky/violet, 16px bars).
 */

type Palette = Record<"sky" | "violet", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Payload = NucleusIntelligencePayload & { cockpit?: { label: string } };

function suitesOption(suites: EvalSuiteSummary[], C: TokenColors, P: Palette, labels: { passed: string; failed: string }) {
  const run = suites.filter((suite) => suite.everRun);
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, data: [labels.passed, labels.failed], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    grid: { left: 40, right: 16, top: 20, bottom: 48 },
    xAxis: { type: "category", data: run.map((suite) => suite.suite), axisLabel: { color: C.textMuted, fontSize: 12.5 } },
    yAxis: { type: "value", minInterval: 1, axisLabel: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [
      { name: labels.passed, type: "bar", data: run.map((suite) => suite.passed), itemStyle: { color: P.sky }, barWidth: 16 },
      { name: labels.failed, type: "bar", data: run.map((suite) => suite.total - suite.passed), itemStyle: { color: P.violet }, barWidth: 16 },
    ],
  };
}

export default function NucleusIntelligence({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const t = useT();
  const stamp = useStamp();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<Payload>("nucleus-intelligence");

  const chart = useMemo(() => {
    if (state.status !== "ready") return null;
    return suitesOption(state.data.evaluationSuites.value, C, P, {
      passed: t(`${NS}.text_cases_passed`, "Cases passed"),
      failed: t(`${NS}.text_cases_failed`, "Cases failed"),
    });
  }, [state, C, P, t]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading Nucleus Intelligence…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const suitesRun = d.evaluationSuites.value.some((suite) => suite.everRun);
  const yesNo = (value: boolean) => (value ? t(`${NS}.text_yes`, "Yes") : t(`${NS}.text_no`, "No"));

  return (
    <div className={shared.dashboardCanvas}>
      <header className={shared.pageHeader}>
        <div>
          <div className={shared.badgeRow}>
            <span className={`${shared.badge} ${shared.badgeViolet}`}>{t(`${NS}.content_text_15`, "Console")}</span>
            <span className={`${shared.badge} ${shared.badgeTeal}`}>{t(`${NS}.content_text_16`, "System & AI Admin")}</span>
          </div>
          <h1 className={shared.screenTitle}>{t(`${NS}.content_text_18`, "Nucleus Intelligence & Model Governance")}</h1>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={shared.secondaryBtn} onClick={() => onNavigate?.("settings")}>{t(`${NS}.content_text_19`, "Audit Log")}</button>
          <button type="button" className={shared.primaryBtn} onClick={() => launchAction("widget")}>{t(`${NS}.content_text_20`, "+ New Analysis")}</button>
        </div>
      </header>

      <div className={shared.kpiRow}>
        <KpiTile icon={<AlertTriangle size={18} />} label={t(`${NS}.text_kpi_open_detections`, "Open detections")} source={d.kpis.openDetections} />
        <KpiTile icon={<ShieldCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_governed_actions`, "Governed agent actions")} source={d.kpis.governedActions} />
        <KpiTile icon={<ClipboardCheck size={18} />} label={t(`${NS}.text_kpi_pending_reviews`, "Pending human reviews")} source={d.kpis.pendingReviews} />
        <KpiTile icon={<CheckCircle2 size={18} />} tone="sky" label={t(`${NS}.text_kpi_pass_rate`, "Evaluation pass rate")} source={d.kpis.evaluationPassRatePct} unit="%" digits={1} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={5} title={t(`${NS}.text_card_query`, "Natural-language query")} subtitle={t(`${NS}.text_card_query_sub`, "Ask a question across modules")} source={d.naturalLanguageQueryConsole} minHeight={200}>
          {null}
        </ChartCard>
        <ChartCard span={7} title={t(`${NS}.text_card_generated`, "Generated analysis")} subtitle={t(`${NS}.text_card_generated_sub`, "Charts produced from a natural-language query")} source={d.naturalLanguageQueryConsole} minHeight={200}>
          {null}
        </ChartCard>

        <ChartCard span={7} title={t(`${NS}.text_card_suites`, "Evaluation suites")} subtitle={t(`${NS}.text_card_suites_sub`, "Recorded safety-evaluation cases per suite")} source={d.evaluationSuites} minHeight={280}>
          {suitesRun && chart && <NucleusChart option={chart} style={{ height: 240, width: "100%" }} />}
          {d.evaluationSuites.value.length === 0 ? (
            <p className={styles.empty}>{t(`${NS}.text_suites_empty`, "No evaluation suite is defined.")}</p>
          ) : (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <caption className={styles.srOnly}>{t(`${NS}.text_card_suites`, "Evaluation suites")}</caption>
                <thead><tr>
                  <th scope="col">{t(`${NS}.text_col_suite`, "Suite")}</th>
                  <th scope="col">{t(`${NS}.text_col_passed`, "Passed / total")}</th>
                  <th scope="col">{t(`${NS}.text_col_pass_rate`, "Pass rate")}</th>
                  <th scope="col">{t(`${NS}.text_col_last_run`, "Last run")}</th>
                </tr></thead>
                <tbody>
                  {d.evaluationSuites.value.map((suite) => (
                    <tr key={suite.suite}>
                      <td><strong>{suite.suite}</strong>{suite.description && <span className={styles.cellSub}>{suite.description}</span>}</td>
                      <td>{suite.everRun ? t(`${NS}.text_passed_of_total`, "{passed} / {total}", { passed: formatNumber(suite.passed, locale), total: formatNumber(suite.total, locale) }) : t(`${NS}.text_never_run`, "Never run")}</td>
                      <td>{suite.passRatePct === null ? t(`${NS}.text_no_score`, "No score") : t(`${NS}.text_percent`, "{value}%", { value: formatNumber(suite.passRatePct, locale, 1) })}</td>
                      <td>{suite.everRun ? stamp(suite.lastRunAt) : t(`${NS}.text_never_run`, "Never run")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard span={5} title={t(`${NS}.text_card_detections`, "Model detections")} subtitle={t(`${NS}.text_card_detections_sub`, "Failed evaluations and payroll anomalies, open first")} source={d.detections} minHeight={280}>
          {d.detections.value.length === 0 ? (
            <p className={styles.empty}>{t(`${NS}.text_detections_empty`, "No evaluation result or payroll anomaly is recorded.")}</p>
          ) : (
            <ul className={styles.list}>
              {d.detections.value.slice(0, 12).map((item) => (
                <li key={item.id} className={styles.findingRow}>
                  <span className={`${shared.badge} ${toneBadge(item.tone)}`}>{item.severity}</span>
                  <span className={styles.findingText}>
                    <strong>{item.subject}</strong>
                    <span className={styles.cellSub}>{item.detail}</span>
                  </span>
                  <span className={styles.findingDomain}>{item.feed}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.note} role="note">{d.detectionSeverityNote}</p>
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.content_text_46`, "Autonomous Agents & Allowed Actions")} subtitle={t(`${NS}.text_card_guardrails_sub`, "Recorded governed actions with their dry-run, outcome and reversal records")} source={d.guardrails} minHeight={260}>
          {d.guardrails.value.length === 0 ? (
            <p className={styles.empty}>{t(`${NS}.text_guardrails_empty`, "No governed agent action is recorded for this tenant.")}</p>
          ) : (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead><tr>
                  <th scope="col">{t(`${NS}.content_text_49`, "Agent Name")}</th>
                  <th scope="col">{t(`${NS}.text_col_tool`, "Tool")}</th>
                  <th scope="col">{t(`${NS}.text_col_ceiling`, "Autonomy ceiling")}</th>
                  <th scope="col">{t(`${NS}.text_col_dry_run`, "Dry run")}</th>
                  <th scope="col">{t(`${NS}.text_col_status`, "Status")}</th>
                </tr></thead>
                <tbody>
                  {d.guardrails.value.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.agent}</strong><span className={styles.cellSub}>{stamp(row.proposedAt)}</span></td>
                      <td className={styles.mono}>{row.tool}</td>
                      <td>{row.autonomyCeiling}</td>
                      <td>{yesNo(row.dryRunRecorded)}</td>
                      <td>
                        <span className={`${shared.badge} ${toneBadge(row.tone)}`}>{row.reversed ? t(`${NS}.text_reversed`, "Reversed") : humanise(row.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.note} role="note">{d.guardrailNotes.blockedNotRecorded}</p>
          <div className={styles.chips} aria-label={t(`${NS}.text_allowlist`, "Tool allowlist")}>
            {d.guardrailNotes.allowlistedTools.map((tool) => <span key={tool} className={`${shared.badge} ${styles.badgeNeutral}`}>{tool}</span>)}
          </div>
          <p className={styles.note}>{d.guardrailNotes.allowlistNote}</p>
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.content_text_77`, "Model Register & Audit History")} subtitle={t(`${NS}.text_card_register_sub`, "Registered model configurations and their recorded runs")} source={d.modelRegister} minHeight={260}>
          {d.modelRegister.value.length === 0 ? (
            <p className={styles.empty}>{t(`${NS}.text_register_empty`, "No model configuration is registered for this tenant.")}</p>
          ) : (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead><tr>
                  <th scope="col">{t(`${NS}.content_text_80`, "Model Key")}</th>
                  <th scope="col">{t(`${NS}.text_col_runs`, "Runs")}</th>
                  <th scope="col">{t(`${NS}.text_col_registered`, "Registered")}</th>
                  <th scope="col">{t(`${NS}.text_col_last_run`, "Last run")}</th>
                </tr></thead>
                <tbody>
                  {d.modelRegister.value.map((model) => (
                    <tr key={model.id}>
                      <td><strong className={styles.mono}>{model.model}</strong></td>
                      <td>{formatNumber(model.runs, locale)}</td>
                      <td>{stamp(model.registeredAt)}</td>
                      <td>{model.runs > 0 ? stamp(model.lastRunAt) : t(`${NS}.text_never_run`, "Never run")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <section className={`${shared.widgetCard} ${shared.col12}`} aria-labelledby="ni-not-recorded">
          <div className={shared.cardTitleRow}>
            <div className={shared.cardTitleLeft}>
              <h3 id="ni-not-recorded" className={shared.cardTitle}>{t(`${NS}.text_card_not_recorded`, "Governance fields not recorded")}</h3>
              <span className={shared.cardSublabel}>{t(`${NS}.text_card_not_recorded_sub`, "Controls this platform does not store, so their absence reads as absent")}</span>
            </div>
          </div>
          <dl className={styles.fieldGrid}>
            {d.governanceFieldsNotRecorded.map((entry) => (
              <div key={entry.field} className={styles.fieldEntry}>
                <dt>{entry.field}</dt>
                <dd>{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ChartCard span={12} title={t(`${NS}.text_card_reviews`, "Human-review queue")} subtitle={t(`${NS}.text_card_reviews_sub`, "Review requests raised against AI runs, with the decision recorded against each")} source={d.reviewQueue} minHeight={200}>
          <ReviewQueue items={d.reviewQueue.value} decisions={d.reviewDecisions} canDecide={d.canDecideReviews} canDecideNote={d.canDecideNote} />
        </ChartCard>
      </div>
    </div>
  );
}
