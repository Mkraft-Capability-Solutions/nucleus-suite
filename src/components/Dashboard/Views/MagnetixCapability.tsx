"use client";

import { useMemo } from "react";
import { Award, BookOpen, Clock, Gauge, Layers, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { Source } from "@/lib/cockpits/source-types";
import type { CapabilityIntelligencePayload, LearningFunnel } from "@/lib/cockpits/capability-intelligence-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import { funnelOption, radarOption, stageColors, volumeOption, type Palette, type TokenColors } from "./magnetix-capability-charts";
import shared from "../DashboardShared.module.css";
import styles from "./MagnetixCapability.module.css";

/**
 * Magnetix Capability & L&D Intelligence (S9). Every figure comes from GET /api/v1/cockpits/capability-intelligence.
 * Cards the platform has no source for stay on screen and say why instead of showing a number.
 */

const NS = "components.Dashboard.Views.MagnetixCapability";

type Props = { onNavigate?: (tab: string) => void };

const missing = (message: string): Source<null> => ({ value: null, available: false, message });

/** A resolved feed with nothing in it renders its own note rather than an empty chart. */
function orEmpty<T>(source: Source<T>, empty: boolean, message: string): Source<T> {
  return source.available && empty ? { ...source, available: false, message } : source;
}

function FunnelBody({ funnel, option, locale }: { funnel: LearningFunnel; option: object; locale: string | undefined }) {
  const t = useT();
  const P = NUCLEUS_COLORS as Palette;
  const colors = stageColors(P);
  const first = funnel.stages[0];
  const last = funnel.stages[funnel.stages.length - 1];
  const yieldPct = first && last && first.value > 0 ? (last.value / first.value) * 100 : null;
  return (
    <div className={styles.funnelBody}>
      <div className={styles.funnelGrid}>
        <NucleusChart option={option} style={{ height: 200, width: "100%" }} />
        <ul className={styles.stageList}>
          {funnel.stages.map((stage, index) => {
            const previous = index > 0 ? funnel.stages[index - 1]?.value ?? 0 : null;
            const rate = previous === null ? 100 : previous > 0 ? (stage.value / previous) * 100 : 0;
            return (
              <li key={stage.label} className={styles.stageRow} title={stage.basis}>
                <span className={styles.stageName}>
                  <span className={styles.stageDot} style={{ backgroundColor: colors[index % colors.length] }} aria-hidden="true" />
                  <span className={styles.ellipsis}>{stage.label}</span>
                </span>
                <span className={styles.stageFigures}>
                  <strong>{formatNumber(stage.value, locale)}</strong>
                  <span>{t(`${NS}.text_stage_rate`, "({rate}%)", { rate: formatNumber(rate, locale, 1) })}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {first && last && yieldPct !== null && (
        <div className={styles.yieldRow}>
          <span>{t(`${NS}.text_yield_label`, "{from} to {to}", { from: first.label, to: last.label })}</span>
          <strong>{t(`${NS}.text_yield_value`, "{done} / {total} learners ({pct}%)", { done: formatNumber(last.value, locale), total: formatNumber(first.value, locale), pct: formatNumber(yieldPct, locale, 1) })}</strong>
        </div>
      )}
      {funnel.omitted.length > 0 && (
        <ul className={styles.omitted} aria-label={t(`${NS}.text_omitted_stages`, "Stages with no recorded source")}>
          {funnel.omitted.map((stage) => (
            <li key={stage.label}><strong>{stage.label}</strong> {stage.reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MagnetixCapability({ onNavigate }: Props) {
  const t = useT();
  const { locale } = useTranslation() as { locale: string | undefined };
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<CapabilityIntelligencePayload>("capability-intelligence");

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    return {
      radar: radarOption(d.capabilityMovement.value, C, P),
      funnel: funnelOption(
        d.learningFunnel.value, C, P,
        (name, value, rate) => rate === null
          ? t(`${NS}.text_funnel_tip_first`, "{name}: {value} learners", { name, value: formatNumber(value, locale) })
          : t(`${NS}.text_funnel_tip`, "{name}: {value} learners · {rate}% of the previous stage", { name, value: formatNumber(value, locale), rate: formatNumber(rate, locale, 1) }),
        (n) => formatNumber(n, locale),
      ),
      volume: volumeOption(d.learningVolume.value, C, P, (value) => d.learningVolume.value.measure === "hours"
        ? t(`${NS}.text_hours_value`, "{value}h", { value: formatNumber(value, locale, 1) })
        : formatNumber(value, locale)),
    };
  }, [state, C, P, t, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading Capability Intelligence…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const movement = d.capabilityMovement.value;
  const funnel = d.learningFunnel.value;
  const volume = d.learningVolume.value;

  const radarSource = orEmpty(d.capabilityMovement, movement.current.length === 0, movement.note);
  const funnelSource = orEmpty(d.learningFunnel, (funnel.stages[0]?.value ?? 0) === 0, t(`${NS}.text_no_enrolments`, "No enrolments are recorded yet, so there is no programme funnel to draw."));
  const volumeSource = orEmpty(d.learningVolume, volume.bars.length === 0, volume.note);

  const hoursKpi: Source<number | null> = d.learningVolume.available && volume.measure === "hours"
    ? { value: volume.bars.reduce((sum, bar) => sum + bar.value, 0), available: true, origin: d.learningVolume.origin }
    : { value: null, available: false, message: d.learningVolume.available ? volume.note : d.learningVolume.message };
  const certified = funnel.stages.find((stage) => stage.label === "Certified");
  const certifiedKpi: Source<number | null> = d.learningFunnel.available && certified
    ? { value: certified.value, available: true, origin: certified.basis }
    : { value: null, available: false, message: d.learningFunnel.message };
  const applied = funnel.omitted.find((stage) => stage.label === "Applied at work");

  const pathDisabledTitle = t(`${NS}.text_path_disabled`, "Not available: the platform does not record skill-gap inference, so there is no generated path to review.");
  const reqDisabledTitle = t(`${NS}.text_req_disabled`, "Not available: no source links stalled requisitions to a skill gap.");

  return (
    <div className={shared.dashboardCanvas}>
      <header className={shared.pageHeader}>
        <div>
          <div className={shared.badgeRow}>
            <span className={`${shared.badge} ${shared.badgeTeal}`}>{t(`${NS}.content_text_48`, "Console")}</span>
            <span className={`${shared.badge} ${shared.badgeSky}`}>{t(`${NS}.content_text_49`, "Magnetix Capability")}</span>
            {d.kpis.enrolments.available && d.kpis.courses.available && (
              <span className={styles.headerMeta}>{t(`${NS}.text_header_meta`, "{enrolments} enrolments • {courses} courses", { enrolments: formatNumber(d.kpis.enrolments.value, locale), courses: formatNumber(d.kpis.courses.value, locale) })}</span>
            )}
          </div>
          <h1 className={shared.screenTitle}>{t(`${NS}.content_text_51`, "Magnetix Capability & L&D Intelligence")}</h1>
        </div>
        <button type="button" onClick={() => onNavigate?.("learning")} className={shared.primaryBtn} disabled={!onNavigate}>
          {t(`${NS}.content_text_52`, "Build a Path")}
        </button>
      </header>

      <div className={shared.kpiRow}>
        <KpiTile icon={<Gauge size={18} />} label={t(`${NS}.text_kpi_index`, "Capability index (average)")} source={d.kpis.averageCapabilityIndex} unit="/100" digits={1} />
        <KpiTile icon={<BookOpen size={18} />} tone="sky" label={t(`${NS}.text_kpi_courses`, "Courses in catalogue")} source={d.kpis.courses} />
        <KpiTile icon={<Users size={18} />} label={t(`${NS}.text_kpi_enrolments`, "Enrolments recorded")} source={d.kpis.enrolments} />
        <KpiTile icon={<Layers size={18} />} tone="sky" label={t(`${NS}.text_kpi_completion`, "Completion rate")} source={d.kpis.completionPct} unit="%" digits={1} />
      </div>
      <div className={shared.kpiRow}>
        <KpiTile icon={<Clock size={18} />} label={t(`${NS}.content_text_59`, "Total Learning Hours")} source={hoursKpi} unit="h" digits={1} />
        <KpiTile icon={<Award size={18} />} tone="sky" label={t(`${NS}.text_kpi_certified`, "Certified learners")} source={certifiedKpi} />
        <KpiTile icon={<ShieldCheck size={18} />} label={t(`${NS}.content_text_56`, "Mandatory Compliance")} source={missing(t(`${NS}.text_compliance_unavailable`, "Not recorded: courses carry no mandatory flag or due date, so compliance cannot be computed."))} />
        <KpiTile icon={<Target size={18} />} tone="sky" label={t(`${NS}.content_text_62`, "Skill Gaps Closed")} source={missing(t(`${NS}.text_gaps_unavailable`, "Not recorded: no required proficiency per role is stored, so a gap cannot be identified or closed."))} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={12} title={t(`${NS}.content_text_65`, "Skill Coverage Matrix (Function × Critical Skill)")} subtitle={t(`${NS}.content_text_66`, "Share of role holders at or above required proficiency level")} source={missing(t(`${NS}.text_matrix_unavailable`, "Not available from this console's feed: required proficiency per role and critical-skill families are not recorded, so coverage against a target cannot be computed."))} minHeight={180}>
          {null}
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.content_text_104`, "Capability Movement")} subtitle={movement.baselineRecorded ? t(`${NS}.text_movement_sub`, "Earliest against latest capability index run") : t(`${NS}.text_movement_sub_current`, "Latest capability index run per dimension")} source={radarSource} minHeight={280}>
          {options && <NucleusChart option={options.radar} style={{ height: 280, width: "100%" }} />}
          <p className={styles.note}>{movement.note}</p>
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.content_text_106`, "Programme Funnel")} subtitle={t(`${NS}.text_funnel_sub`, "Assigned to certified, as recorded")} source={funnelSource} minHeight={280}>
          {options && <FunnelBody funnel={funnel} option={options.funnel} locale={locale} />}
        </ChartCard>

        <ChartCard span={4} title={volume.measure === "hours" ? t(`${NS}.content_text_113`, "Learning Hours by Function") : t(`${NS}.text_volume_title`, "Learning Volume by Function")} subtitle={volume.axisLabel} source={volumeSource} minHeight={280}>
          {options && <NucleusChart option={options.volume} style={{ height: 280, width: "100%" }} />}
          <p className={styles.note}>{volume.note}</p>
        </ChartCard>

        <ChartCard
          span={5}
          title={t(`${NS}.content_text_115`, "Gap-to-Path Intelligence")}
          subtitle={t(`${NS}.content_text_116`, "Autonomous skill gap inference")}
          tools={<Sparkles size={16} aria-hidden="true" className={styles.aiIcon} />}
          source={missing(t(`${NS}.text_gap_unavailable`, "Not available: no skill-gap inference is recorded for this tenant, so no path can be proposed."))}
          minHeight={200}
        >
          {null}
        </ChartCard>

        <ChartCard span={7} title={t(`${NS}.content_text_124`, "Does Learning Show Up in the Work?")} subtitle={t(`${NS}.content_text_125`, "Manager-rated application 90 days after completion")} source={missing(applied?.reason ?? t(`${NS}.text_applied_unavailable`, "Not recorded: nothing links a completion to an on-the-job outcome."))} minHeight={200}>
          {null}
        </ChartCard>
      </div>

      <div className={styles.actions}>
        <button type="button" className={shared.primaryBtn} disabled title={pathDisabledTitle} aria-describedby="mc-path-disabled">
          {t(`${NS}.content_text_122`, "Review 6-Week Path →")}
        </button>
        <span id="mc-path-disabled" className={styles.srOnly}>{pathDisabledTitle}</span>
        <button type="button" className={shared.secondaryBtn} disabled title={reqDisabledTitle} aria-describedby="mc-req-disabled">
          {t(`${NS}.content_text_123`, "View Stalled Requisitions")}
        </button>
        <span id="mc-req-disabled" className={styles.srOnly}>{reqDisabledTitle}</span>
      </div>
    </div>
  );
}
