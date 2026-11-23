"use client";

import { useMemo } from "react";
import { Briefcase, Clock, DollarSign, FileText, Gauge, Percent, UserPlus, Users } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { Source } from "@/lib/cockpits/source-types";
import { FUNNEL_MILESTONES, type BridgeItem, type FunnelStage, type TalentAcquisitionData } from "@/lib/cockpits/talent-acquisition-command-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./TalentAcquisition.module.css";

/**
 * Talent Acquisition Command (S4). Every figure comes from GET /api/v1/cockpits/talent-acquisition-command; a feed
 * that did not resolve shows its reason instead of a number. Chart styles are the console's existing ones.
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral" | "violet" | "slate", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Translate = ReturnType<typeof useT>;

const NS = "components.Dashboard.Views.TalentAcquisition";
const BRIDGE_KEYS: Record<string, string> = {
  "Reached offer": "bridge_reached_offer",
  Declined: "bridge_declined",
  "Awaiting decision": "bridge_awaiting",
  "Accepted, not joined": "bridge_accepted_not_joined",
  Joined: "bridge_joined",
};

const stageColors = (P: Palette) => [P.teal, P.sky, P.violet, P.amber, P.coral];
const funnelLabel = (stage: FunnelStage, index: number, t: Translate) => {
  const key = FUNNEL_MILESTONES[index]?.key;
  return key ? t(`${NS}.funnel_${key}`, stage.label) : stage.label;
};
const bridgeLabel = (item: BridgeItem, t: Translate) => {
  const key = BRIDGE_KEYS[item.label];
  return key ? t(`${NS}.${key}`, item.label) : item.label;
};

/** Card surface colour, read from the theme token so funnel slice borders match the card in every theme. */
function cardSurface(theme: string): string | undefined {
  if (typeof window === "undefined" || !theme) return undefined;
  return getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || undefined;
}

function funnelOption(stages: FunnelStage[], rates: Array<number | null>, C: TokenColors, P: Palette, surface: string | undefined, t: Translate, locale: string) {
  const colors = stageColors(P);
  return {
    tooltip: {
      trigger: "item", confine: true,
      formatter: (p: { dataIndex: number; name: string; value: number }) => {
        const rate = rates[p.dataIndex];
        const rateText = rate === null || rate === undefined ? t(`${NS}.text_rate_none`, "n/a") : `${formatNumber(rate, locale, 1)}%`;
        return t(`${NS}.text_funnel_tooltip`, "{stage}: {count} applications · stage conversion {rate}", { stage: p.name, count: formatNumber(p.value, locale), rate: rateText });
      },
    },
    series: [{
      type: "funnel", left: "4%", top: 10, bottom: 10, width: "92%", min: 0, max: Math.max(stages[0]?.value ?? 0, 1), minSize: "36%", maxSize: "100%", sort: "none", gap: 4,
      label: { show: true, position: "inside", align: "center", verticalAlign: "middle", color: C.textPrimary, fontSize: 12, fontWeight: 800, formatter: (p: { value: number }) => formatNumber(p.value, locale) },
      itemStyle: { borderColor: surface ?? C.lineMuted, borderWidth: 2 },
      emphasis: { label: { fontSize: 13, fontWeight: 900 } },
      data: stages.map((s, i) => ({ value: s.value, name: funnelLabel(s, i, t), itemStyle: { color: colors[i % colors.length] } })),
    }],
  };
}

/** Waterfall: an invisible base series lifts each subtraction to the running total; the bridge closes on "Joined". */
function bridgeOption(items: BridgeItem[], C: TokenColors, P: Palette, t: Translate, locale: string) {
  let running = 0;
  const bars = items.map((item) => {
    if (item.kind === "delta") {
      running += item.value;
      return { base: running, height: Math.abs(item.value), color: item.label === "Declined" ? P.coral : P.amber };
    }
    running = item.value;
    return { base: 0, height: item.value, color: item.kind === "base" ? P.sky : P.teal };
  });
  const candidates = t(`${NS}.text_series_candidates`, "Applications");
  return {
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: Array<{ seriesName: string; dataIndex: number; name: string }>) => {
        const bar = params.find((p) => p.seriesName === candidates);
        const item = bar ? items[bar.dataIndex] : undefined;
        return item ? t(`${NS}.text_bridge_tooltip`, "{stage}: {count} applications", { stage: bar?.name ?? "", count: formatNumber(item.value, locale) }) : "";
      },
    },
    grid: { left: 40, right: 16, top: 24, bottom: 32 },
    xAxis: { type: "category", data: items.map((item) => bridgeLabel(item, t)), axisLabel: { color: C.textMuted, fontSize: 12.5, interval: 0 } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: C.lineMuted } }, axisLabel: { color: C.textMuted } },
    series: [
      { name: "base", type: "bar", stack: "total", silent: true, itemStyle: { opacity: 0 }, data: bars.map((b) => b.base) },
      {
        name: candidates, type: "bar", stack: "total",
        data: bars.map((b) => ({ value: b.height, itemStyle: { color: b.color } })),
        label: { show: true, position: "top", color: C.textPrimary, fontSize: 12.5, formatter: (p: { dataIndex: number }) => formatNumber(items[p.dataIndex]?.value ?? 0, locale) },
      },
    ],
  };
}

const kpi = (value: number | null, note: string): Source<number | null> => ({ value, available: value !== null, message: note, origin: note });
const missing = (message: string): Source<number | null> => ({ value: null, available: false, message });
const unavailable = (message: string): Source<null> => ({ value: null, available: false, message });

export default function TalentAcquisition({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const t = useT();
  const { locale } = useTranslation() as { locale: string };
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const surface = useMemo(() => cardSurface(theme), [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<TalentAcquisitionData>("talent-acquisition-command");

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    return {
      funnel: funnelOption(d.funnel.stages, d.funnel.conversions.map((c) => c.percent), C, P, surface, t, locale),
      bridge: bridgeOption(d.bridge.items, C, P, t, locale),
    };
  }, [state, C, P, surface, t, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading Talent Acquisition Command…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const { kpis, funnel, bridge, stageBreakdown } = d;
  const colors = stageColors(P);
  const funnelSource: Source<unknown> = { value: null, available: funnel.available, message: funnel.message, origin: funnel.origin };
  const bridgeSource: Source<unknown> = { value: null, available: bridge.available, message: bridge.message, origin: bridge.origin };
  const breakdownSource: Source<unknown> = { value: null, available: stageBreakdown.available, message: stageBreakdown.message, origin: stageBreakdown.origin };
  const noFilter = t(`${NS}.text_filter_unavailable`, "The cockpit feed is not broken down by function yet, so it cannot be filtered.");

  return (
    <div className={shared.dashboardCanvas}>
      <header className={styles.header}>
        <div>
          <div className={shared.badgeRow}>
            <span className={`${shared.badge} ${shared.badgeTeal}`}>{t(`${NS}.text_badge_console`, "Console")}</span>
            <span className={`${shared.badge} ${shared.badgeSky}`}>{t(`${NS}.text_badge_domain`, "Talent Acquisition")}</span>
            {kpis.openRequisitions !== null && kpis.activeCandidates !== null && (
              <span className={styles.headerMeta}>{t(`${NS}.text_header_meta`, "{open} open requisitions • {active} active candidates", { open: formatNumber(kpis.openRequisitions, locale), active: formatNumber(kpis.activeCandidates, locale) })}</span>
            )}
          </div>
          <h1 className={shared.screenTitle}>{t(`${NS}.text_title`, "Talent Acquisition Command")}</h1>
        </div>
        <div className={styles.headerTools}>
          <select className={shared.periodSelect} disabled title={noFilter} aria-label={t(`${NS}.text_filter_label`, "Function")} defaultValue="all">
            <option value="all">{t(`${NS}.text_filter_all`, "All functions")}</option>
          </select>
          <button type="button" className={shared.primaryBtn} disabled={!onNavigate} title={onNavigate ? undefined : t(`${NS}.text_new_req_unavailable`, "Recruitment is not reachable from this view.")} onClick={() => onNavigate?.("recruitment")}>
            {t(`${NS}.text_new_requisition`, "+ New requisition")}
          </button>
        </div>
      </header>

      <div className={shared.kpiRow}>
        <KpiTile icon={<Briefcase size={18} />} label={t(`${NS}.text_kpi_open_reqs`, "Open requisitions")} source={kpi(kpis.openRequisitions, kpis.openRequisitionsNote)} />
        <KpiTile icon={<Users size={18} />} tone="sky" label={t(`${NS}.text_kpi_active_candidates`, "Active candidates")} source={kpi(kpis.activeCandidates, kpis.activeCandidatesNote)} />
        <KpiTile icon={<FileText size={18} />} label={t(`${NS}.text_kpi_offers_outstanding`, "Offers outstanding")} source={kpi(kpis.offersOutstanding, kpis.offersOutstandingNote)} />
        <KpiTile icon={<UserPlus size={18} />} tone="sky" label={t(`${NS}.text_kpi_postings`, "Active job postings")} source={kpi(kpis.activePostings, t(`${NS}.text_kpi_postings_note`, "Job postings on record"))} />
        <KpiTile icon={<Clock size={18} />} label={t(`${NS}.text_kpi_time_to_hire`, "Time to hire")} source={kpi(kpis.timeToHireDays, kpis.timeToHireNote)} unit={t(`${NS}.text_unit_days`, " d")} />
        <KpiTile icon={<DollarSign size={18} />} tone="sky" label={t(`${NS}.text_kpi_cost_per_hire`, "Cost per hire")} source={missing(t(`${NS}.text_cost_unavailable`, "No recruitment spend is recorded, so cost per hire cannot be computed."))} />
        <KpiTile icon={<Percent size={18} />} label={t(`${NS}.text_kpi_acceptance`, "Offer acceptance rate")} source={missing(t(`${NS}.text_acceptance_unavailable`, "The cockpit feed does not compute an acceptance rate; see the offer bridge for recorded outcomes."))} />
        <KpiTile icon={<Gauge size={18} />} tone="sky" label={t(`${NS}.text_kpi_panel_load`, "Panel load average")} source={missing(t(`${NS}.text_panel_unavailable`, "Interviewer load is not part of the cockpit feed yet."))} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={6} title={t(`${NS}.text_card_funnel`, "Hiring funnel")} subtitle={t(`${NS}.text_card_funnel_sub`, "Stage conversions and applicant yield")} source={funnelSource}>
          {funnel.total === 0 ? <p className={styles.empty}>{t(`${NS}.text_no_applications`, "No applications are recorded yet.")}</p> : (
            <>
              <div className={styles.funnelLayout}>
                {options && <NucleusChart option={options.funnel} style={{ height: 220, width: "100%" }} />}
                <ul className={styles.stageList}>
                  {funnel.stages.map((stage, i) => {
                    const rate = funnel.conversions[i]?.percent;
                    return (
                      <li key={stage.label} className={styles.stageRow}>
                        <span className={styles.stageName}><span className={styles.stageDot} style={{ backgroundColor: colors[i % colors.length] }} aria-hidden="true" />{funnelLabel(stage, i, t)}</span>
                        <span className={styles.stageFigures}>
                          <strong className={styles.stageValue}>{formatNumber(stage.value, locale)}</strong>
                          {rate !== null && rate !== undefined && <span className={styles.stageRate}>{t(`${NS}.text_stage_rate`, "{rate}% from prior", { rate: formatNumber(rate, locale, 1) })}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className={styles.note}>{funnel.note}</p>
            </>
          )}
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.text_card_stages`, "Applications by recorded stage")} subtitle={t(`${NS}.text_card_stages_sub`, "Live and ended stages, largest first")} source={breakdownSource}>
          {stageBreakdown.rows.length === 0 ? <p className={styles.empty}>{t(`${NS}.text_no_applications`, "No applications are recorded yet.")}</p> : (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead><tr>
                  <th scope="col">{t(`${NS}.text_col_stage`, "Stage")}</th>
                  <th scope="col" className={styles.numeric}>{t(`${NS}.text_col_count`, "Applications")}</th>
                  <th scope="col">{t(`${NS}.text_col_state`, "State")}</th>
                </tr></thead>
                <tbody>
                  {stageBreakdown.rows.map((row) => (
                    <tr key={row.stage}>
                      <td>{t(`${NS}.stage_${row.stage}`, row.label)}</td>
                      <td className={styles.numeric}>{formatNumber(row.count, locale)}</td>
                      <td><span className={`${shared.badge} ${row.terminal ? shared.badgeCoral : shared.badgeTeal}`}>{row.terminal ? t(`${NS}.text_state_ended`, "Ended") : t(`${NS}.text_state_live`, "Live")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard span={7} title={t(`${NS}.text_card_bridge`, "Offer-to-joining bridge")} subtitle={t(`${NS}.text_card_bridge_sub`, "Where applications stand between offer and Day 1")} source={bridgeSource}>
          {bridge.items.length === 0 ? <p className={styles.empty}>{t(`${NS}.text_no_offers`, "No application has reached an offer yet.")}</p> : (
            <>
              {options && <NucleusChart option={options.bridge} style={{ height: 260, width: "100%" }} />}
              <p className={styles.note}>{bridge.note}</p>
            </>
          )}
        </ChartCard>

        <ChartCard span={5} title={t(`${NS}.text_card_cx`, "Candidate experience survey")} subtitle={d.candidateExperience.message} source={unavailable(d.candidateExperience.detail)}>
          {null}
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.text_card_sources`, "Source channel yield")} subtitle={t(`${NS}.text_card_sources_sub`, "Hires and median cost per hire")} source={unavailable(t(`${NS}.text_sources_unavailable`, "The cockpit feed does not break hires down by sourcing channel, and no recruitment spend is recorded."))}>
          {null}
        </ChartCard>

        <ChartCard span={6} title={t(`${NS}.text_card_shortlist`, "AI shortlist match ready")} subtitle={t(`${NS}.text_card_shortlist_sub`, "Unbiased candidate scoring")} source={unavailable(t(`${NS}.text_shortlist_unavailable`, "Per-candidate match scores are not part of the cockpit feed. Open the recruitment pipeline to review scored candidates."))}>
          {null}
        </ChartCard>

        <ChartCard span={12} title={t(`${NS}.text_card_aged`, "Open requisitions and bottlenecks")} subtitle={t(`${NS}.text_card_aged_sub`, "Sorted by days open with a controlled blocker taxonomy")} source={unavailable(t(`${NS}.text_aged_unavailable`, "The cockpit feed reports only the count of open requisitions. Requisition age and blocker reasons are not recorded."))} minHeight={160}>
          {null}
        </ChartCard>
      </div>
    </div>
  );
}
