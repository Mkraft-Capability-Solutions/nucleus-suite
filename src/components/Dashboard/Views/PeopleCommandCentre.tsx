"use client";

import { useMemo } from "react";
import { Award, Gauge, UserMinus, Users } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { AttritionTone, PeopleCommandCentrePayload } from "@/lib/cockpits/people-command-centre-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";

/**
 * People Command Centre (CHRO console). Every figure comes from GET /api/v1/cockpits/people-command-centre;
 * a feed that did not resolve shows its reason instead of a number. Chart styles are the console's existing ones.
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral" | "violet" | "slate", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Payload = PeopleCommandCentrePayload & { cockpit?: { label: string } };

const NS = "components.Dashboard.Views.PeopleCommandCentre";
/** Existing heat ramp of this console (cool → hot), kept as the default chart style. */
const HEAT_RAMP = ["#122B36", "#1A4D4A", "#2E9C84", "#F2A93B", "#F2647E"];

// The palette names its greens/blues emerald and cyan; this console's series were specified as teal and sky.
const BASE = NUCLEUS_COLORS as Record<string, string>;
const P: Palette = { teal: BASE.emerald, sky: BASE.cyan, amber: BASE.amber, coral: BASE.coral, violet: BASE.violet, slate: BASE.slate };

const toneColor = (tone: AttritionTone, P: Palette) => ({ success: P.teal, warning: P.amber, danger: P.coral, neutral: P.slate })[tone];

function trendOption(data: Payload["headcountTrend"]["value"], C: TokenColors, P: Palette, labels: { left: string; right: string }) {
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, data: [labels.left, labels.right], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    grid: { left: 48, right: 48, top: 20, bottom: 40 },
    xAxis: { type: "category", data: data.points.map((p) => p.label) },
    yAxis: [
      { type: "value", scale: true, splitLine: { lineStyle: { color: C.lineMuted, type: "dashed" } } },
      { type: "value", splitLine: { show: false } },
    ],
    series: [
      { name: labels.left, type: "line", data: data.points.map((p) => p.left), itemStyle: { color: P.teal }, lineStyle: { width: 3 } },
      { name: labels.right, type: "line", yAxisIndex: 1, data: data.points.map((p) => p.right), itemStyle: { color: P.sky }, lineStyle: { type: "dotted", width: 2 } },
    ],
  };
}

function radarOption(data: Payload["orgHealth"]["value"], C: TokenColors, P: Palette, labels: { current: string; comparison: string }) {
  return {
    legend: { bottom: 0, data: [labels.current, labels.comparison], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    radar: { indicator: data.axes.map((a) => ({ name: a.axis, max: 100 })), axisName: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{
      type: "radar",
      data: [
        { value: data.axes.map((a) => a.current), name: labels.current, itemStyle: { color: P.teal }, areaStyle: { color: P.teal, opacity: 0.22 } },
        { value: data.axes.map((a) => a.comparison), name: labels.comparison, itemStyle: { color: P.sky }, lineStyle: { type: "dashed" }, areaStyle: { color: P.sky, opacity: 0.12 } },
      ],
    }],
  };
}

function flowOption(data: Payload["talentFlow"]["value"], C: TokenColors, P: Palette) {
  const nodeColor = (index: number) => (index < data.centreIndex ? [P.teal, P.sky, P.amber][index % 3] : index === data.centreIndex ? P.teal : [P.coral, P.amber, P.slate][(index - data.centreIndex - 1) % 3]);
  return {
    tooltip: { trigger: "item" },
    series: [{
      type: "sankey", layout: "none", top: 20, bottom: 20, left: 10, right: 10, nodeWidth: 16, nodeGap: 14, emphasis: { focus: "adjacency" },
      data: data.nodes.map((node, index) => ({ name: node.name, itemStyle: { color: nodeColor(index) } })),
      links: data.links.map((link) => ({ source: data.nodes[link.source]?.name, target: data.nodes[link.target]?.name, value: link.value })),
      lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
      label: { color: C.textPrimary, fontSize: 12.5 },
    }],
  };
}

function attritionBarOption(data: Payload["attritionByDepartment"]["value"], C: TokenColors, P: Palette) {
  const sorted = [...data].sort((a, b) => a.value - b.value);
  return {
    tooltip: { trigger: "axis", formatter: "{b}: <strong>{c}%</strong>" },
    grid: { left: "22%", right: "12%", top: 15, bottom: 20 },
    xAxis: { type: "value", axisLabel: { formatter: "{value}%", color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    yAxis: { type: "category", data: sorted.map((b) => b.label), axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    series: [{
      type: "bar", barWidth: 14,
      data: sorted.map((b) => ({ value: b.value, itemStyle: { color: toneColor(b.tone, P) } })),
      label: { show: true, position: "right", formatter: "{c}%", color: C.textPrimary, fontSize: 12.5, fontWeight: 600 },
    }],
  };
}

function heatmapOption(data: Payload["attritionMatrix"]["value"], C: TokenColors, cellLabel: (row: string, column: string, value: number) => string) {
  const cells = data.values.flatMap((row, r) => row.map((value, c) => (value === null ? null : [c, r, value]))).filter((cell): cell is number[] => cell !== null);
  const values = cells.map((cell) => cell[2]);
  return {
    tooltip: { position: "top", formatter: (p: { value: number[] }) => cellLabel(data.rows[p.value[1]] ?? "", data.columns[p.value[0]] ?? "", p.value[2]) },
    grid: { top: 20, bottom: 40, left: "20%", right: "6%" },
    xAxis: { type: "category", data: data.columns, splitArea: { show: true }, axisLabel: { color: C.textMuted, fontSize: 12.5, rotate: 15 } },
    yAxis: { type: "category", data: data.rows, splitArea: { show: true }, axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    visualMap: { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 80, inRange: { color: HEAT_RAMP }, textStyle: { color: C.textMuted, fontSize: 12.5 } },
    series: [{ type: "heatmap", data: cells, label: { show: true, formatter: (p: { value: number[] }) => `${p.value[2]}%`, color: C.textPrimary, fontSize: 12.5, fontWeight: 600 } }],
  };
}

export default function PeopleCommandCentre() {
  const t = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const { state, reload } = useCockpit<Payload>("people-command-centre");

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    return {
      trend: trendOption(d.headcountTrend.value, C, P, { left: t(`${NS}.text_closing_headcount`, "Closing headcount"), right: t(`${NS}.text_net_movement`, "Net movement") }),
      radar: radarOption(d.orgHealth.value, C, P, { current: t(`${NS}.text_last_12`, "Last 12 months"), comparison: t(`${NS}.text_prior_12`, "Prior 12 months") }),
      flow: flowOption(d.talentFlow.value, C, P),
      bars: attritionBarOption(d.attritionByDepartment.value, C, P),
      heat: heatmapOption(d.attritionMatrix.value, C, (row, column, value) => t(`${NS}.text_heat_cell`, "{row} at {column}: {value}% attrition", { row, column, value: formatNumber(value, locale, 1) })),
    };
  }, [state, C, t, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading the People Command Centre…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;

  return (
    <div className={shared.dashboardCanvas}>
      <div className={shared.kpiRow}>
        <KpiTile icon={<Users size={18} />} label={t(`${NS}.text_kpi_headcount`, "Active headcount")} source={d.kpis.activeHeadcount} />
        <KpiTile icon={<UserMinus size={18} />} tone="sky" label={t(`${NS}.text_kpi_attrition`, "Annualised attrition")} source={d.kpis.attritionAnnualisedPercent} unit="%" digits={1} />
        <KpiTile icon={<Award size={18} />} label={t(`${NS}.text_kpi_compa`, "Average compa-ratio")} source={d.kpis.averageCompaRatio} unit="%" digits={1} />
        <KpiTile icon={<Gauge size={18} />} tone="sky" label={t(`${NS}.text_kpi_org_health`, "Org health index")} source={d.kpis.orgHealthIndex} digits={0} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={7} title={t(`${NS}.text_card_momentum`, "Workforce momentum")} subtitle={t(`${NS}.text_card_momentum_sub`, "Closing headcount and net movement by month")} source={d.headcountTrend}>
          {options && <NucleusChart option={options.trend} style={{ height: 260, width: '100%' }} />}
        </ChartCard>
        <ChartCard span={5} title={t(`${NS}.text_card_org_health`, "Org health")} subtitle={t(`${NS}.text_card_org_health_sub`, "Last 12 months against the prior 12")} source={d.orgHealth}>
          {options && <NucleusChart option={options.radar} style={{ height: 260, width: '100%' }} />}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_flow`, "Talent flow")} subtitle={t(`${NS}.text_card_flow_sub`, "Inflow, active core and exits in the period")} source={d.talentFlow} minHeight={280}>
          {options && <NucleusChart option={options.flow} style={{ height: 280, width: '100%' }} />}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_attrition`, "Attrition by department")} subtitle={t(`${NS}.text_card_attrition_sub`, "Annualised %, highest first")} source={d.attritionByDepartment} minHeight={280}>
          {options && <NucleusChart option={options.bars} style={{ height: 280, width: '100%' }} />}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_pay`, "Pay position vs performance")} subtitle={t(`${NS}.text_card_pay_sub`, "Compa-ratio against rating")} source={d.compaPerformance} minHeight={270}>
          {null}
        </ChartCard>
        <ChartCard span={6} title={t(`${NS}.text_card_heat`, "Attrition heat · department × location")} subtitle={t(`${NS}.text_card_heat_sub`, "Annualised % per cell")} source={d.attritionMatrix} minHeight={270}>
          {options && <NucleusChart option={options.heat} style={{ height: 270, width: '100%' }} />}
        </ChartCard>
      </div>
    </div>
  );
}
