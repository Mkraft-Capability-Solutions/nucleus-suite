import type { CapabilityMovement, LearningFunnel, LearningVolume } from "@/lib/cockpits/capability-intelligence-types";

/**
 * ECharts option builders for the Capability Intelligence console (S9). They keep the console's existing chart
 * styles (radar centre/radius, funnel geometry, horizontal bars with value labels) and take every colour from the
 * chart palette and the page tokens passed in, never from literals.
 */

export type Palette = Record<"cyan" | "sapphire" | "violet" | "amber" | "emerald" | "coral" | "slate", string>;
export type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };

/** Funnel stage colours in order, as on the original console. */
export const stageColors = (P: Palette): string[] => [P.sapphire, P.cyan, P.violet, P.amber, P.emerald];

export function radarOption(movement: CapabilityMovement, C: TokenColors, P: Palette) {
  const compared = movement.baselineRecorded && movement.axes.length > 0;
  const indicator = (compared ? movement.axes.map((a) => a.axis) : movement.current.map((c) => c.axis)).map((name) => ({ name, max: 100 }));
  const data = compared
    ? [
        { value: movement.axes.map((a) => a.comparison), name: movement.comparisonLabel, itemStyle: { color: P.sapphire }, lineStyle: { type: "dashed" } },
        { value: movement.axes.map((a) => a.current), name: movement.currentLabel, itemStyle: { color: P.cyan }, areaStyle: { color: P.cyan, opacity: 0.22 } },
      ]
    : [{ value: movement.current.map((c) => c.value), name: movement.currentLabel, itemStyle: { color: P.cyan }, areaStyle: { color: P.cyan, opacity: 0.22 } }];
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, data: data.map((d) => d.name), textStyle: { color: C.textMuted, fontSize: 11 } },
    radar: { indicator, center: ["50%", "46%"], radius: "65%", axisName: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{ type: "radar", data }],
  };
}

export function funnelOption(funnel: LearningFunnel, C: TokenColors, P: Palette, tooltip: (name: string, value: number, rate: number | null) => string, format: (n: number) => string) {
  const colors = stageColors(P);
  const top = funnel.stages[0]?.value ?? 0;
  return {
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: { dataIndex: number; name: string; value: number }) => {
        const previous = p.dataIndex > 0 ? funnel.stages[p.dataIndex - 1]?.value ?? 0 : null;
        const rate = previous === null ? null : previous > 0 ? (p.value / previous) * 100 : 0;
        return tooltip(p.name, p.value, rate);
      },
    },
    series: [{
      type: "funnel", left: "4%", top: 10, bottom: 10, width: "92%", min: 0, max: Math.max(top, 1), minSize: "36%", maxSize: "100%", sort: "descending", gap: 4,
      label: { show: true, position: "inside", align: "center", verticalAlign: "middle", color: C.textPrimary, fontSize: 12, fontWeight: 800, formatter: (p: { value: number }) => format(p.value) },
      itemStyle: { borderColor: C.lineMuted, borderWidth: 2 },
      emphasis: { label: { fontSize: 13, fontWeight: 900 } },
      data: funnel.stages.map((stage, index) => ({ value: stage.value, name: stage.label, itemStyle: { color: colors[index % colors.length] } })),
    }],
  };
}

export function volumeOption(volume: LearningVolume, C: TokenColors, P: Palette, valueLabel: (value: number) => string) {
  // Largest at the top of a category axis, as on the original console.
  const sorted = [...volume.bars].sort((a, b) => a.value - b.value);
  const ramp = [P.cyan, P.sapphire, P.violet, P.amber];
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "22%", right: "12%", top: "8%", bottom: "14%" },
    xAxis: { type: "value", name: volume.axisLabel, nameLocation: "middle", nameGap: 24, nameTextStyle: { color: C.textMuted, fontSize: 11 }, axisLabel: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    yAxis: { type: "category", data: sorted.map((b) => b.label), axisLabel: { color: C.textMuted, fontSize: 11 } },
    series: [{
      type: "bar", barWidth: 14,
      data: sorted.map((b, index) => ({ value: b.value, itemStyle: { color: index === sorted.length - 1 ? P.emerald : ramp[index % ramp.length] } })),
      label: { show: true, position: "right", color: C.textPrimary, fontSize: 11, formatter: (p: { value: number }) => valueLabel(p.value) },
    }],
  };
}
