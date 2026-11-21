"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useAppearance } from "@/context/AppearanceContext";
import { formatCompact, formatValue, type ValueFormat } from "./format";

/**
 * Charts for redesigned dashboards. Colours are the validated categorical palette (8 hues, fixed
 * order, separate light and dark steps; checked with the dataviz validator against this module's
 * surfaces #ffffff and #111827). Marks follow one spec: bars at most 24px with 4px rounded data
 * ends, 2px lines, 8px markers with a surface ring, hairline solid grid, one y-axis, legend only
 * for two or more series, text in text colours (never the series colour).
 */

export const PALETTE = {
  light: {
    series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    sequential: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
    surface: "#ffffff", grid: "#eaecf0", axis: "#d0d5dd", text: "#101828", text2: "#475467", text3: "#667085",
  },
  dark: {
    series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
    sequential: ["#16324f", "#184f95", "#1c5cab", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
    surface: "#111827", grid: "#232c3b", axis: "#344054", text: "#f2f4f7", text2: "#c4cad4", text3: "#98a2b3",
  },
} as const;

export type ChartMode = keyof typeof PALETTE;

export function useChartMode(): ChartMode {
  const { appearance } = useAppearance() as { appearance: { mode?: string } };
  return appearance?.mode === "dark" ? "dark" : "light";
}

export type ChartSeries = { name: string; data: number[]; stack?: string };

type Common = { mode: ChartMode; format: ValueFormat; currency: string; label: string };

function base({ mode }: Common) {
  const p = PALETTE[mode];
  return {
    animationDuration: 250,
    textStyle: { fontFamily: "Inter Variable, Inter, system-ui, sans-serif", color: p.text2, fontSize: 12 },
    tooltip: {
      backgroundColor: p.surface, borderColor: p.axis, borderWidth: 1, padding: [8, 10],
      textStyle: { color: p.text, fontSize: 12 }, extraCssText: "box-shadow: 0 8px 24px rgb(0 0 0 / 0.12); border-radius: 6px;",
    },
  };
}

/** Tooltip rows: value first (strong), series name after, keyed by a short line in the series colour. */
function tooltipFormatter(format: ValueFormat, currency: string, mode: ChartMode) {
  const p = PALETTE[mode];
  const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return (params: unknown) => {
    const list = (Array.isArray(params) ? params : [params]) as Array<{ axisValueLabel?: string; name: string; seriesName: string; value: number; color: string }>;
    const title = esc(String(list[0]?.axisValueLabel ?? list[0]?.name ?? ""));
    const rows = list.map((item) => `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <span style="width:12px;height:2px;background:${item.color};display:inline-block"></span>
      <strong style="color:${p.text}">${esc(formatValue(Number(item.value), format, currency))}</strong>
      <span style="color:${p.text3}">${esc(item.seriesName)}</span></div>`).join("");
    return `<div style="color:${p.text2};font-size:12px">${title}</div>${rows}`;
  };
}

export function barOption(common: Common & { categories: string[]; series: ChartSeries[]; horizontal?: boolean }) {
  const { mode, format, currency, categories, series, horizontal } = common;
  const p = PALETTE[mode];
  const stacked = series.some((entry) => entry.stack);
  const valueAxis = {
    type: "value" as const,
    minInterval: format === "count" ? 1 : undefined,
    axisLabel: { color: p.text3, formatter: (value: number) => formatCompact(value, format, currency) },
    splitLine: { lineStyle: { color: p.grid, width: 1, type: "solid" as const } },
    axisLine: { show: false }, axisTick: { show: false },
  };
  const categoryAxis = {
    type: "category" as const, data: categories,
    axisLabel: { color: p.text2, width: horizontal ? 140 : undefined, overflow: "truncate" as const, hideOverlap: true, interval: categories.length <= 8 ? 0 : "auto" as const, fontSize: categories.length > 5 && !horizontal ? 11 : 12 },
    axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
  };
  const last = series.length - 1;
  return {
    ...base(common),
    color: [...p.series],
    grid: { left: 8, right: horizontal ? 40 : 12, top: series.length > 1 ? 36 : 12, bottom: 8, containLabel: true },
    legend: series.length > 1 ? { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: p.text2 } } : undefined,
    tooltip: { ...base(common).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)" } }, formatter: tooltipFormatter(format, currency, mode) },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map((entry, index) => ({
      name: entry.name, type: "bar", data: entry.data, stack: entry.stack, barMaxWidth: 24, barGap: "12%",
      // Rounded data end, square at the baseline; in a stack only the outermost segment is rounded,
      // and a surface-coloured edge gives the 2px gap between touching segments.
      itemStyle: {
        borderRadius: !stacked || index === last ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
        borderColor: stacked ? p.surface : undefined, borderWidth: stacked ? 1 : 0,
      },
      emphasis: { focus: "none", itemStyle: { opacity: 0.85 } },
      // A value at the tip only for a single, unstacked series of a few bars.
      label: series.length === 1 && categories.length <= 12 ? {
        show: true, position: horizontal ? "right" : "top", color: p.text2, fontSize: 11,
        formatter: (item: { value: number }) => (item.value ? formatCompact(item.value, format, currency) : ""),
      } : undefined,
    })),
  };
}

export function lineOption(common: Common & { categories: string[]; series: ChartSeries[] }) {
  const { mode, format, currency, categories, series } = common;
  const p = PALETTE[mode];
  return {
    ...base(common),
    color: [...p.series],
    grid: { left: 8, right: 40, top: series.length > 1 ? 36 : 12, bottom: 8, containLabel: true },
    legend: series.length > 1 ? { top: 0, left: 0, icon: "path://M0,4 L14,4 L14,6 L0,6 Z", itemWidth: 14, itemHeight: 10, textStyle: { color: p.text2 } } : undefined,
    tooltip: { ...base(common).tooltip, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: p.axis, width: 1 } }, formatter: tooltipFormatter(format, currency, mode) },
    xAxis: { type: "category", data: categories, boundaryGap: false, axisLabel: { color: p.text3, hideOverlap: true }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", minInterval: format === "count" ? 1 : undefined, axisLabel: { color: p.text3, formatter: (value: number) => formatCompact(value, format, currency) }, splitLine: { lineStyle: { color: p.grid, width: 1 } } },
    series: series.map((entry) => ({
      name: entry.name, type: "line", data: entry.data, smooth: false, showSymbol: categories.length <= 14,
      symbol: "circle", symbolSize: 8, lineStyle: { width: 2, cap: "round", join: "round" },
      itemStyle: { borderColor: p.surface, borderWidth: 2 },
      areaStyle: series.length === 1 ? { opacity: 0.1 } : undefined,
      endLabel: series.length <= 4 ? { show: true, color: p.text2, fontSize: 11, formatter: (item: { value: number }) => formatCompact(item.value, format, currency) } : undefined,
    })),
  };
}

export function heatmapOption(common: Common & { x: string[]; y: string[]; cells: Array<[number, number, number]> }) {
  const { mode, format, currency, x, y, cells } = common;
  const p = PALETTE[mode];
  const max = Math.max(1, ...cells.map((cell) => cell[2]));
  return {
    ...base(common),
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    tooltip: {
      ...base(common).tooltip, trigger: "item",
      formatter: (item: { value: [number, number, number] }) => `${y[item.value[1]] ?? ""} · ${x[item.value[0]] ?? ""}<br/><strong>${formatValue(item.value[2], format, currency)}</strong>`,
    },
    xAxis: { type: "category", data: x, axisLabel: { color: p.text3, interval: 0, rotate: x.length > 6 ? 30 : 0 }, axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false } },
    yAxis: { type: "category", data: y, axisLabel: { color: p.text2 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120, inRange: { color: [...p.sequential] }, textStyle: { color: p.text3 } },
    series: [{
      type: "heatmap", data: cells, itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 2 },
      // White text with a thin dark halo stays legible on both the lightest and darkest cells.
      label: { show: cells.length <= 48, color: "#ffffff", textBorderColor: "rgba(16,24,40,0.55)", textBorderWidth: 2, fontSize: 11, formatter: (item: { value: [number, number, number] }) => (item.value[2] ? formatCompact(item.value[2], format, currency) : "") },
    }],
  };
}

/** An ECharts instance bound to a div; follows its container's size and the appearance mode. */
export function EChart({ option, height, label }: { option: Record<string, unknown>; height: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} role="img" aria-label={label} style={{ width: "100%", height }} />;
}
