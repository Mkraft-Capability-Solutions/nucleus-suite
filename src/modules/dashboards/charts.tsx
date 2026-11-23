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
    // Risk measures (attrition): one warm hue, light to dark.
    warm: ["#fdeee8", "#fbd3c2", "#f7ae92", "#f08462", "#e05a3a", "#bf3d22", "#8c2a14"],
    status: { positive: "#1baf7a", attention: "#eda100", risk: "#e34948" }, neutral: "#98a2b3",
    surface: "#ffffff", grid: "#eaecf0", axis: "#d0d5dd", text: "#101828", text2: "#475467", text3: "#667085",
  },
  dark: {
    series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
    sequential: ["#16324f", "#184f95", "#1c5cab", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
    warm: ["#3a1d17", "#5c2817", "#86341a", "#b2441f", "#dc6237", "#ef8c66", "#f7b89c"],
    status: { positive: "#199e70", attention: "#c98500", risk: "#e66767" }, neutral: "#667085",
    surface: "#111827", grid: "#232c3b", axis: "#344054", text: "#f2f4f7", text2: "#c4cad4", text3: "#98a2b3",
  },
} as const;

export type ChartMode = keyof typeof PALETTE;

export function useChartMode(): ChartMode {
  const { appearance } = useAppearance() as { appearance: { mode?: string } };
  return appearance?.mode === "dark" ? "dark" : "light";
}

export type ChartSeries = { name: string; data: Array<number | null>; stack?: string; kind?: "bar" | "line"; dashed?: boolean; dotted?: boolean; hue?: number; tone?: "positive" | "attention" | "risk" };

/** A series keeps its colour: a status tone, else its fixed palette slot (-1 = neutral grey), else the palette order. */
function colourOf(entry: { hue?: number; tone?: ChartSeries["tone"] }, mode: ChartMode): string | undefined {
  const p = PALETTE[mode];
  if (entry.tone) return p.status[entry.tone];
  if (entry.hue === undefined) return undefined;
  return entry.hue < 0 ? p.neutral : p.series[entry.hue % p.series.length];
}

const lineType = (entry: { dashed?: boolean; dotted?: boolean }) => (entry.dotted ? "dotted" as const : entry.dashed ? "dashed" as const : "solid" as const);

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
  const bars = series.filter((entry) => entry.kind !== "line");
  const stacked = bars.some((entry) => entry.stack);
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
  const last = series.indexOf(bars[bars.length - 1]!);
  return {
    ...base(common),
    color: [...p.series],
    grid: { left: 8, right: horizontal ? 40 : 12, top: series.length > 1 ? 36 : 12, bottom: 8, containLabel: true },
    legend: series.length > 1 ? { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: p.text2 } } : undefined,
    tooltip: { ...base(common).tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)" } }, formatter: tooltipFormatter(format, currency, mode) },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map((entry, index) => entry.kind === "line" ? {
      // A line over the bars: a guideline or reference (dashed) or a second measure.
      name: entry.name, type: "line", data: entry.data, smooth: true, symbol: "circle", symbolSize: 7, z: 3,
      lineStyle: { width: 2, type: lineType(entry), color: colourOf(entry, mode) }, itemStyle: { borderColor: p.surface, borderWidth: 2, color: colourOf(entry, mode) },
    } : entry.tone ? {
      // A status band: each bar sits in one band only, so every segment is a whole bar with its value.
      name: entry.name, type: "bar", data: entry.data, stack: entry.stack, barMaxWidth: 22,
      itemStyle: { color: colourOf(entry, mode), borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
      emphasis: { focus: "none", itemStyle: { opacity: 0.85 } },
      label: { show: true, position: horizontal ? "right" : "top", color: p.text2, fontSize: 11, formatter: (item: { value: number | null }) => (item.value === null || item.value === undefined ? "" : formatCompact(item.value, format, currency)) },
    } : ({
      name: entry.name, type: "bar", data: entry.data, stack: entry.stack, barMaxWidth: 24, barGap: "12%",
      // Rounded data end, square at the baseline; in a stack only the outermost segment is rounded,
      // and a surface-coloured edge gives the 2px gap between touching segments.
      itemStyle: {
        color: colourOf(entry, mode),
        borderRadius: !stacked || index === last ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
        borderColor: stacked ? p.surface : undefined, borderWidth: stacked ? 1 : 0,
      },
      emphasis: { focus: "none", itemStyle: { opacity: 0.85 } },
      // A value at the tip only for a single, unstacked series of a few bars.
      label: bars.length === 1 && series.length === 1 && categories.length <= 12 ? {
        show: true, position: horizontal ? "right" : "top", color: p.text2, fontSize: 11,
        formatter: (item: { value: number }) => (item.value ? formatCompact(item.value, format, currency) : ""),
      } : undefined,
    })),
  };
}

type Band = { name: string; of: string; lower: Array<number | null>; upper: Array<number | null> };

export function lineOption(common: Common & { categories: string[]; series: ChartSeries[]; band?: Band }) {
  const { mode, format, currency, categories, series, band } = common;
  const p = PALETTE[mode];
  const bandOwner = band ? series.find((entry) => entry.name === band.of) : undefined;
  const bandColour = bandOwner ? colourOf(bandOwner, mode) ?? p.series[series.indexOf(bandOwner) % p.series.length] : p.series[0];
  // The band is two stacked series: an invisible floor at the lower bound and a filled step up to the upper one.
  const bandSeries = band ? [
    { name: "__band_floor", type: "line", data: band.lower, stack: "__band", symbol: "none", lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, legendHoverLink: false },
    { name: band.name, type: "line", data: band.upper.map((value, index) => (value === null || band.lower[index] === null ? null : value - band.lower[index]!)), stack: "__band", symbol: "none",
      lineStyle: { opacity: 0 }, itemStyle: { color: bandColour }, areaStyle: { color: bandColour, opacity: 0.16 }, silent: true },
  ] : [];
  const lineTooltip = tooltipFormatter(format, currency, mode);
  return {
    ...base(common),
    color: [...p.series],
    grid: { left: 8, right: 40, top: series.length > 1 || band ? 36 : 12, bottom: 8, containLabel: true },
    legend: series.length > 1 || band ? { top: 0, left: 0, icon: "rect", itemWidth: 14, itemHeight: 3, textStyle: { color: p.text2 }, data: [...series.map((entry) => entry.name), ...(band ? [{ name: band.name, icon: "roundRect", itemHeight: 10 }] : [])] } : undefined,
    tooltip: {
      ...base(common).tooltip, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: p.axis, width: 1 } },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ seriesName: string; value: number | null; dataIndex: number }>;
        const shown = list.filter((item) => !item.seriesName.startsWith("__") && item.seriesName !== band?.name && item.value !== null && item.value !== undefined);
        const index = list[0]?.dataIndex ?? 0;
        const low = band?.lower[index], high = band?.upper[index];
        const range = band && low !== null && low !== undefined && high !== null && high !== undefined && low !== high
          ? `<div style="margin-top:4px;color:${p.text3}">${escapeHtml(band.name)}: <strong style="color:${p.text}">${escapeHtml(formatValue(low, format, currency))}–${escapeHtml(formatValue(high, format, currency))}</strong></div>` : "";
        return lineTooltip(shown.length ? shown : list.slice(0, 1)) + range;
      },
    },
    xAxis: { type: "category", data: categories, boundaryGap: false, axisLabel: { color: p.text3, hideOverlap: true }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", scale: Boolean(band), minInterval: format === "count" ? 1 : undefined, axisLabel: { color: p.text3, formatter: (value: number) => formatCompact(value, format, currency) }, splitLine: { lineStyle: { color: p.grid, width: 1 } } },
    series: [...bandSeries, ...series.map((entry) => ({
      name: entry.name, type: "line", data: entry.data, smooth: false, showSymbol: categories.length <= 18, connectNulls: false,
      symbol: "circle", symbolSize: 7, lineStyle: { width: 2, cap: "round", join: "round", type: lineType(entry), color: colourOf(entry, mode) },
      itemStyle: { borderColor: p.surface, borderWidth: 2, color: colourOf(entry, mode) },
      areaStyle: series.length === 1 && !band ? { opacity: 0.1 } : undefined,
      // End labels only on unbroken lines: ECharts animates the label along the line and loses it in a gap.
      endLabel: series.length <= 4 && entry.data.every((value) => value !== null) ? { show: true, color: p.text2, fontSize: 11, formatter: (item: { value: number | null }) => (item.value === null || item.value === undefined ? "" : formatCompact(item.value, format, currency)) } : undefined,
    }))],
  };
}

export function heatmapOption(common: Common & { x: string[]; y: string[]; cells: Array<[number, number, number]>; scale?: "cool" | "warm"; showZero?: boolean; notes?: string[] }) {
  const { mode, format, currency, x, y, cells, scale, showZero, notes } = common;
  const p = PALETTE[mode];
  const max = Math.max(1, ...cells.map((cell) => cell[2]));
  const ramp = scale === "warm" ? p.warm : p.sequential;
  return {
    ...base(common),
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    tooltip: {
      ...base(common).tooltip, trigger: "item",
      formatter: (item: { value: [number, number, number]; dataIndex: number }) => `${escapeHtml(y[item.value[1]] ?? "")} · ${escapeHtml(x[item.value[0]] ?? "")}<br/><strong>${formatValue(item.value[2], format, currency)}</strong>${notes?.[item.dataIndex] ? `<div style="color:${p.text3};max-width:260px;white-space:normal">${escapeHtml(notes[item.dataIndex]!)}</div>` : ""}`,
    },
    xAxis: { type: "category", data: x, axisLabel: { color: p.text3, interval: 0, rotate: x.length > 6 ? 30 : 0 }, axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false } },
    // First row at the top, as a table reads.
    yAxis: { type: "category", data: y, inverse: true, axisLabel: { color: p.text2 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120, inRange: { color: [...ramp] }, textStyle: { color: p.text3 } },
    series: [{
      type: "heatmap", itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 2 },
      // Text contrasts with its own cell: on the strong end of the ramp it flips (white in light mode, ink in dark mode).
      data: cells.map((cell) => {
        const strong = cell[2] >= max * 0.45;
        return { value: cell, label: { color: strong ? (mode === "light" ? "#ffffff" : "#101828") : p.text } };
      }),
      label: { show: cells.length <= (showZero ? 120 : 48), fontSize: 11, fontWeight: 600, formatter: (item: { value: [number, number, number] }) => (item.value[2] || showZero ? formatCompact(item.value[2], format, currency) : "") },
    }],
  };
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function radarOption(common: Common & { indicators: Array<{ name: string; max: number }>; series: ChartSeries[] }) {
  const { mode, format, currency, indicators, series } = common;
  const p = PALETTE[mode];
  return {
    ...base(common),
    color: [...p.series],
    legend: series.length > 1 ? { bottom: 0, left: "center", icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: p.text2 } } : undefined,
    tooltip: { ...base(common).tooltip, trigger: "item" },
    radar: {
      indicator: indicators, radius: "62%", center: ["50%", series.length > 1 ? "46%" : "50%"], splitNumber: 4,
      axisName: { color: p.text2, fontSize: 12 }, splitLine: { lineStyle: { color: p.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: p.grid } },
    },
    series: [{
      type: "radar", symbol: "circle", symbolSize: 7,
      data: series.map((entry, index) => ({
        name: entry.name, value: entry.data,
        lineStyle: { width: 2, type: lineType(entry), color: colourOf(entry, mode) }, itemStyle: { borderColor: p.surface, borderWidth: 2, color: colourOf(entry, mode) },
        areaStyle: { opacity: index === 0 ? 0.22 : 0.08, color: colourOf(entry, mode) },
      })),
      tooltip: { valueFormatter: (value: number) => formatValue(value, format, currency) },
    }],
  };
}

export function scatterOption(common: Common & { points: Array<{ x: number; y: number; label: string; group: string; size?: number }>; xLabel: string; yLabel: string; xFormat: ValueFormat; yFormat: ValueFormat; sizeLabel?: string; xRef?: number; yRef?: number; groupHues?: Record<string, number> }) {
  const { mode, currency, points, xLabel, yLabel, xFormat, yFormat, sizeLabel, xRef, yRef, groupHues } = common;
  const p = PALETTE[mode];
  const groups = [...new Set(points.map((point) => point.group))].sort((a, b) => (groupHues?.[a] ?? 99) - (groupHues?.[b] ?? 99) || a.localeCompare(b));
  const bubbles = points.some((point) => point.size !== undefined);
  const biggest = Math.max(1, ...points.map((point) => point.size ?? 1));
  const reference = { symbol: "none", silent: true, label: { show: false }, lineStyle: { color: p.text3, type: "dashed" as const, width: 1, opacity: 0.7 },
    data: [...(xRef !== undefined ? [{ xAxis: xRef }] : []), ...(yRef !== undefined ? [{ yAxis: yRef }] : [])] };
  const axis = (name: string, format: ValueFormat) => ({
    type: "value" as const, name, nameLocation: "middle" as const, nameGap: 32, nameTextStyle: { color: p.text3 }, scale: true,
    axisLabel: { color: p.text3, formatter: (value: number) => formatCompact(value, format, currency) },
    splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
  });
  return {
    ...base(common),
    color: [...p.series],
    grid: { left: 16, right: 16, top: groups.length > 1 ? 56 : 36, bottom: 36, containLabel: true },
    legend: groups.length > 1 ? { top: 0, right: 0, icon: "circle", itemWidth: 10, itemHeight: 10, textStyle: { color: p.text2 } } : undefined,
    tooltip: {
      ...base(common).tooltip, trigger: "item",
      formatter: (item: { data: [number, number, string, number | undefined]; seriesName: string }) => `<strong>${escapeHtml(item.data[2])}</strong><div style="color:${p.text3}">${escapeHtml(item.seriesName)}</div>${escapeHtml(xLabel)}: ${escapeHtml(formatValue(item.data[0], xFormat, currency))}<br/>${escapeHtml(yLabel)}: ${escapeHtml(formatValue(item.data[1], yFormat, currency))}${bubbles && item.data[3] !== undefined ? `<br/>${escapeHtml(sizeLabel ?? "Size")}: ${escapeHtml(formatValue(item.data[3], "count", currency))}` : ""}`,
    },
    xAxis: axis(xLabel, xFormat),
    // The y-axis title sits above the axis: a rotated mid-axis title mis-measures on the first layout.
    yAxis: { ...axis(yLabel, yFormat), nameLocation: "end" as const, nameGap: 12, nameTextStyle: { color: p.text3, align: "left" as const } },
    series: groups.map((group, index) => ({
      name: group, type: "scatter",
      symbolSize: bubbles ? (value: [number, number, string, number]) => 14 + Math.sqrt((value[3] ?? 1) / biggest) * 34 : 12,
      data: points.filter((point) => point.group === group).map((point) => [point.x, point.y, point.label, point.size]),
      itemStyle: { color: groupHues?.[group] !== undefined ? colourOf({ hue: groupHues[group] }, mode) : undefined, borderColor: p.surface, borderWidth: 2, opacity: bubbles ? 0.82 : 0.9 },
      label: bubbles ? { show: true, position: "top", color: p.text2, fontSize: 11, formatter: (item: { data: [number, number, string] }) => item.data[2] } : undefined,
      labelLayout: bubbles ? { hideOverlap: true } : undefined,
      emphasis: { scale: 1.15, focus: "self" },
      markLine: index === 0 && reference.data.length ? reference : undefined,
    })),
  };
}

/** Flows into a core and out of it; nodes keep their colours, links take a gradient between them. */
export function sankeyOption(common: Common & { nodes: Array<{ name: string; value: number; side: "in" | "core" | "out"; hue: number }>; links: Array<{ source: string; target: string; value: number }> }) {
  const { mode, format, currency, nodes, links } = common;
  const p = PALETTE[mode];
  return {
    ...base(common),
    tooltip: {
      ...base(common).tooltip, trigger: "item",
      formatter: (item: { dataType: string; name: string; data: { source?: string; target?: string; value: number } }) => item.dataType === "edge"
        ? `${escapeHtml(item.data.source ?? "")} → ${escapeHtml(item.data.target ?? "")}<br/><strong>${escapeHtml(formatValue(item.data.value, format, currency))}</strong>`
        : `<strong>${escapeHtml(item.name)}</strong>`,
    },
    series: [{
      type: "sankey", left: 8, right: 150, top: 12, bottom: 12, nodeWidth: 14, nodeGap: 16, nodeAlign: "justify", draggable: false, layoutIterations: 0,
      emphasis: { focus: "adjacency" },
      data: nodes.map((node) => ({ name: node.name, depth: node.side === "in" ? 0 : node.side === "core" ? 1 : 2, itemStyle: { color: colourOf({ hue: node.hue }, mode), borderWidth: 0 } })),
      links,
      lineStyle: { color: "gradient", curveness: 0.5, opacity: mode === "dark" ? 0.4 : 0.32 },
      label: { color: p.text, fontSize: 12, position: "right" },
    }],
  };
}

/** A waterfall: invisible base bars carry each step up or down from the running total. */
export function bridgeOption(common: Common & { steps: Array<{ name: string; value: number; total?: boolean }> }) {
  const { mode, format, currency, steps } = common;
  const p = PALETTE[mode];
  let running = 0;
  const baseData: number[] = []; const up: Array<number | string> = []; const down: Array<number | string> = []; const totals: Array<number | string> = [];
  for (const step of steps) {
    if (step.total) { running = step.value; baseData.push(0); totals.push(step.value); up.push("-"); down.push("-"); continue; }
    const start = running; running += step.value;
    baseData.push(Math.min(start, running)); totals.push("-");
    if (step.value >= 0) { up.push(step.value); down.push("-"); } else { down.push(-step.value); up.push("-"); }
  }
  // Small movements on large totals: start the axis just below the lowest level so the steps can be seen.
  const levels: number[] = [];
  let level = 0;
  for (const step of steps) { if (step.total) level = step.value; else { levels.push(level); level += step.value; } levels.push(level); }
  const lowest = Math.min(...levels), highest = Math.max(...levels);
  const floor = lowest > 0 && highest > lowest ? Math.max(0, lowest - (highest - lowest) * 1.5) : 0;
  const magnitude = floor > 0 ? 10 ** Math.floor(Math.log10(floor)) : 1;
  const axisMin = floor > 0 ? Math.floor(floor / magnitude) * magnitude : 0;
  const label = { show: steps.length <= 10, position: "top" as const, color: p.text2, fontSize: 11, formatter: (item: { value: number | string }) => (typeof item.value === "number" && item.value ? formatCompact(item.value, format, currency) : "") };
  const signed = (index: number) => { const step = steps[index]; if (!step) return ""; return step.total ? formatValue(step.value, format, currency) : `${step.value >= 0 ? "+" : "−"}${formatValue(Math.abs(step.value), format, currency)}`; };
  return {
    ...base(common),
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, data: ["Total", "Increase", "Decrease"], icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: p.text2 } },
    tooltip: { ...base(common).tooltip, trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params: Array<{ dataIndex: number; name: string }>) => `${escapeHtml(params[0]?.name ?? "")}<br/><strong>${escapeHtml(signed(params[0]?.dataIndex ?? 0))}</strong>` },
    xAxis: { type: "category", data: steps.map((step) => step.name), axisLabel: { color: p.text2, interval: 0, width: 96, overflow: "break" }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", min: axisMin || undefined, axisLabel: { color: p.text3, formatter: (value: number) => formatCompact(value, format, currency) }, splitLine: { lineStyle: { color: p.grid } } },
    series: [
      { name: "base", type: "bar", stack: "bridge", data: baseData, itemStyle: { color: "transparent" }, emphasis: { disabled: true }, tooltip: { show: false } },
      { name: "Total", type: "bar", stack: "bridge", data: totals, barMaxWidth: 28, itemStyle: { color: p.series[0], borderRadius: [4, 4, 0, 0] }, label },
      { name: "Increase", type: "bar", stack: "bridge", data: up, barMaxWidth: 28, itemStyle: { color: p.series[2], borderRadius: [4, 4, 0, 0] }, label },
      { name: "Decrease", type: "bar", stack: "bridge", data: down, barMaxWidth: 28, itemStyle: { color: p.series[1], borderRadius: [4, 4, 0, 0] }, label },
    ],
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
