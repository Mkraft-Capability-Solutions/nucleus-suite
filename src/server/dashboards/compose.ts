import type { Insight, BarPanel, BoardFilters, BridgePanel, BridgeStep, SankeyNode, SankeyPanel, PartsPanel, HeatmapPanel, LinePanel, ListItem, ListPanel, MatrixCell, MatrixPanel, Panel, RadarPanel, ScatterPanel, ScatterPoint, Series, TableColumn, TablePanel, ValueFormat } from "./types";

/** Database numerics (bigint, numeric, count) arrive as strings or numbers; anything else is 0. */
export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** part / whole as a percentage, or null when there is nothing to divide by. */
export function pct(part: number, whole: number, digits = 1): number | null {
  if (!whole || whole <= 0) return null;
  return round((part / whole) * 100, digits);
}

/**
 * Leavers over a window as an annual rate: leavers ÷ average headcount × (12 ÷ months).
 * Null when the average headcount is zero.
 */
export function annualisedAttrition(leavers: number, averageHeadcount: number, months: number): number | null {
  if (!averageHeadcount || averageHeadcount <= 0 || months <= 0) return null;
  return round((leavers / averageHeadcount) * (12 / months) * 100, 1);
}

export function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03" → "Mar 2026". */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** "2026-03-07" → "7 Mar". */
export function dayLabel(date: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  return `${Number(match[2])} ${MONTHS[Number(match[1]) - 1] ?? match[1]}`;
}

export const ALLOWED_MONTHS = [1, 3, 6, 12] as const;

/** Reads ?location=&department=&months= with safe defaults; blank or "all" means no filter. */
export function parseFilters(params: URLSearchParams): BoardFilters {
  const text = (key: string) => {
    const value = params.get(key)?.trim() ?? "";
    if (!value || value.length > 200 || value.toLowerCase() === "all") return null;
    return value;
  };
  const months = Number(params.get("months"));
  return {
    location: text("location"),
    department: text("department"),
    months: (ALLOWED_MONTHS as readonly number[]).includes(months) ? (months as BoardFilters["months"]) : 12,
  };
}

export function periodLabel(months: number): string {
  return months === 1 ? "last month" : months === 12 ? "last 12 months" : `last ${months} months`;
}

/* ------------------------------------------------------------------ */
/* Panel builders: they decide "empty" so no view has to guess.        */
/* ------------------------------------------------------------------ */

type Common = Omit<Panel, "kind" | "state"> & { emptyMessage: string };

function seriesHasData(series: Series[]) {
  return series.some((entry) => entry.data.some((value) => value !== 0 && value !== null));
}

export function barPanel(common: Common, categories: string[], series: Series[], horizontal = false): BarPanel {
  const ok = categories.length > 0 && seriesHasData(series);
  return { ...common, kind: "bar", horizontal, categories, series, state: ok ? "ok" : "empty" };
}

export function linePanel(common: Common, categories: string[], series: Series[]): LinePanel {
  const ok = categories.length > 0 && seriesHasData(series);
  return { ...common, kind: "line", categories, series, state: ok ? "ok" : "empty" };
}

export function partsPanel(common: Common, items: Array<{ name: string; value: number }>): PartsPanel {
  const kept = items.filter((item) => item.value > 0);
  return { ...common, kind: "parts", items: kept, state: kept.length ? "ok" : "empty" };
}

export function tablePanel(common: Common, columns: TableColumn[], rows: TablePanel["rows"]): TablePanel {
  return { ...common, kind: "table", columns, rows, state: rows.length ? "ok" : "empty" };
}

export function listPanel(common: Common, items: ListItem[]): ListPanel {
  return { ...common, kind: "list", items, state: items.length ? "ok" : "empty" };
}

export function heatmapPanel(common: Common, rows: Array<{ x: string; y: string; value: number }>): HeatmapPanel {
  const x = [...new Set(rows.map((row) => row.x))].sort();
  const y = [...new Set(rows.map((row) => row.y))].sort();
  const cells = rows.map((row) => [x.indexOf(row.x), y.indexOf(row.y), row.value] as [number, number, number]);
  const ok = x.length > 1 && y.length > 1 && rows.some((row) => row.value > 0);
  return { ...common, kind: "heatmap", x, y, cells, state: ok ? "ok" : "empty" };
}

export function matrixPanel(common: Common, shape: { rows: string[]; cols: string[]; rowAxis: string; colAxis: string }, cells: MatrixCell[]): MatrixPanel {
  return { ...common, kind: "matrix", ...shape, cells, state: cells.some((cell) => cell.value > 0) ? "ok" : "empty" };
}

export function radarPanel(common: Common, indicators: Array<{ name: string; max: number }>, series: Series[]): RadarPanel {
  const ok = indicators.length >= 3 && seriesHasData(series);
  return { ...common, kind: "radar", indicators, series, state: ok ? "ok" : "empty" };
}

export function scatterPanel(common: Common, axes: { xLabel: string; yLabel: string; xFormat: ValueFormat; yFormat: ValueFormat }, points: ScatterPoint[]): ScatterPanel {
  return { ...common, kind: "scatter", ...axes, points, state: points.length >= 2 ? "ok" : "empty" };
}

export function sankeyPanel(common: Common, nodes: SankeyNode[], links: SankeyPanel["links"]): SankeyPanel {
  const kept = links.filter((link) => link.value > 0);
  const used = new Set(kept.flatMap((link) => [link.source, link.target]));
  return { ...common, kind: "sankey", nodes: nodes.filter((node) => used.has(node.name)), links: kept, state: kept.length ? "ok" : "empty" };
}

export function bridgePanel(common: Common, steps: BridgeStep[]): BridgePanel {
  const ok = steps.some((step) => step.value !== 0);
  return { ...common, kind: "bridge", steps, state: ok ? "ok" : "empty" };
}

/** Replaces a panel whose source could not be read with an honest "unavailable" state. */
export function unavailable<T extends Panel>(panel: T): T {
  return { ...panel, state: "unavailable" };
}

/** A panel the caller's role may not see: kept in place, with no figures. */
export function forbidden(common: Common & { kind: Panel["kind"] }): Panel {
  const base = { ...common, state: "forbidden" as const };
  switch (common.kind) {
    case "bar": return { ...base, kind: "bar", categories: [], series: [] };
    case "line": return { ...base, kind: "line", categories: [], series: [] };
    case "parts": return { ...base, kind: "parts", items: [] };
    case "heatmap": return { ...base, kind: "heatmap", x: [], y: [], cells: [] };
    case "table": return { ...base, kind: "table", columns: [], rows: [] };
    case "matrix": return { ...base, kind: "matrix", rows: [], cols: [], rowAxis: "", colAxis: "", cells: [] };
    case "radar": return { ...base, kind: "radar", indicators: [], series: [] };
    case "scatter": return { ...base, kind: "scatter", xLabel: "", yLabel: "", xFormat: "count", yFormat: "count", points: [] };
    case "bridge": return { ...base, kind: "bridge", steps: [] };
    case "sankey": return { ...base, kind: "sankey", nodes: [], links: [] };
    default: return { ...base, kind: "list", items: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Insight sentences: derived only from figures already on the board.  */
/* ------------------------------------------------------------------ */

export function largest<T extends { value: number }>(items: T[]): T | null {
  return items.reduce<T | null>((best, item) => (item.value > (best?.value ?? -Infinity) ? item : best), null);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-IN")} ${count === 1 ? one : many}`;
}

/** "Headcount is 42, up 3 since Dec 2025." from a monthly series (oldest first). */
export function headcountInsight(months: string[], headcount: number[]): string | null {
  if (!headcount.length) return null;
  const current = headcount[headcount.length - 1]!;
  const first = headcount[0]!;
  if (current === 0 && first === 0) return null;
  const change = current - first;
  const since = monthLabel(months[0] ?? "");
  if (change === 0) return `Headcount is ${current.toLocaleString("en-IN")}, unchanged since ${since}.`;
  return `Headcount is ${current.toLocaleString("en-IN")}, ${change > 0 ? "up" : "down"} ${Math.abs(change).toLocaleString("en-IN")} since ${since}.`;
}

/** Tenure band for a number of years of service. */
export function tenureBand(years: number): string {
  if (years < 1) return "Under 1 year";
  if (years < 3) return "1–3 years";
  if (years < 5) return "3–5 years";
  if (years < 10) return "5–10 years";
  return "10+ years";
}

export const TENURE_BANDS = ["Under 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"];

/** Turns a stored code ("pending_supervisor", "OPEN") into a readable label ("Pending supervisor", "Open"). */
export function humanise(code: string | null | undefined): string {
  const text = String(code ?? "").trim();
  if (!text) return "Not recorded";
  // Short codes stay as written (EL, CL, PF, HR).
  if (/^[A-Z0-9]{1,4}$/.test(text)) return text;
  const spaced = text.replace(/[._-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const SEVERITY = { risk: 0, attention: 1, positive: 2, info: 3 } as const;
/** Findings in order of urgency (risk, attention, positive, then context); equal ones keep their order. */
export function rankInsights(insights: Array<string | Insight>): Array<string | Insight> {
  const weight = (item: string | Insight) => (typeof item === "string" ? SEVERITY.info : SEVERITY[item.tone ?? "info"]);
  return insights.map((item, index) => ({ item, index })).sort((a, b) => weight(a.item) - weight(b.item) || a.index - b.index).map(({ item }) => item);
}

/** A panel whose source failed to load is shown as unavailable rather than empty. */
export function withSource<T extends Panel>(rows: unknown[] | null, panel: T): T {
  return rows === null ? unavailable(panel) : panel;
}
