/**
 * Dashboard payloads. Every number on a dashboard comes from one of these, computed on the server
 * from the active organisation's own records (see ./boards). Nothing is sample or illustrative:
 * a panel with no records says so instead of showing a made-up figure.
 */

export const BOARD_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] as const;
export type BoardId = (typeof BOARD_IDS)[number];

export type ValueFormat = "count" | "percent" | "hours" | "days" | "money" | "decimal" | "years" | "text" | "date";

export type Kpi = {
  id: string;
  label: string;
  /** null = not measurable yet (no underlying records); the tile shows "—" with the hint. */
  value: number | string | null;
  format: ValueFormat;
  /** Shown as "value / of" (e.g. team present 12 / 14). */
  of?: number | null;
  /** Short qualifier under the label: period, source or why the value is missing. */
  hint?: string;
  tone?: "positive" | "risk" | "attention" | "neutral";
  target?: string;
  /** Change against a comparison point; `better` says which direction is good (colour), "neutral" when neither is. */
  delta?: { value: number; format: ValueFormat; label: string; better: "up" | "down" | "neutral"; unit?: string };
};

export type PanelState = "ok" | "empty" | "unavailable" | "forbidden";

type PanelBase = {
  id: string;
  title: string;
  subtitle?: string;
  /** Width on the 12-column grid. */
  span: 4 | 5 | 6 | 7 | 8 | 12;
  state: PanelState;
  /** Shown when state is not "ok": what record would fill this panel. */
  emptyMessage?: string;
  /** Workspace tab that holds the underlying records. */
  target?: string;
  format?: ValueFormat;
  /** How the figures are defined or computed, shown under the chart. */
  note?: string;
};

/** A series; `kind: "line"` on a bar panel draws a line over the bars (`dashed` for a reference or guideline). */
export type Series = {
  name: string; data: Array<number | null>; stack?: string; kind?: "bar" | "line"; dashed?: boolean; dotted?: boolean;
  /** Fixed palette slot (0–7) so a series keeps its colour wherever it appears. */
  hue?: number;
  /** A status band (e.g. attrition level): drawn in the reserved status colours, always with a label. */
  tone?: "positive" | "attention" | "risk";
};

export type BarPanel = PanelBase & { kind: "bar"; horizontal?: boolean; categories: string[]; series: Series[] };
/** `band`: a shaded range (e.g. a forecast's 80% interval), drawn in the colour of the series it belongs to. */
export type LinePanel = PanelBase & { kind: "line"; categories: string[]; series: Series[]; band?: { name: string; of: string; lower: Array<number | null>; upper: Array<number | null> } };
export type PartsPanel = PanelBase & { kind: "parts"; items: Array<{ name: string; value: number }> };
/** `scale: "warm"` for risk measures (attrition); `notes` add a line per cell to the tooltip (same order as cells). */
export type HeatmapPanel = PanelBase & { kind: "heatmap"; x: string[]; y: string[]; cells: Array<[number, number, number]>; scale?: "cool" | "warm"; showZero?: boolean; notes?: string[] };
export type TableColumn = { key: string; label: string; format?: ValueFormat };
export type TablePanel = PanelBase & { kind: "table"; columns: TableColumn[]; rows: Array<Record<string, string | number | null>> };
export type ListItem = { label: string; detail?: string; value?: number | string | null; format?: ValueFormat; status?: string; tone?: Kpi["tone"]; target?: string };
export type ListPanel = PanelBase & { kind: "list"; items: ListItem[] };

/** A labelled grid of counts, e.g. the nine-box (rows top to bottom, columns left to right). */
export type MatrixCell = { row: number; col: number; label: string; value: number; hint?: string; tone?: Kpi["tone"]; people?: string[] };
export type MatrixPanel = PanelBase & { kind: "matrix"; rows: string[]; cols: string[]; rowAxis: string; colAxis: string; cells: MatrixCell[] };
/** Several measures on one scale per series, e.g. competency ratings against a benchmark. */
export type RadarPanel = PanelBase & { kind: "radar"; indicators: Array<{ name: string; max: number }>; series: Series[] };
/** One point per record against two measures. */
export type ScatterPoint = { x: number; y: number; label: string; group: string; size?: number };
/** With `size`, a bubble chart (bubbles labelled); `xRef`/`yRef` draw reference lines that split it into quadrants. */
export type ScatterPanel = PanelBase & { kind: "scatter"; xLabel: string; yLabel: string; xFormat: ValueFormat; yFormat: ValueFormat; points: ScatterPoint[]; sizeLabel?: string; xRef?: number; yRef?: number; groupHues?: Record<string, number> };
/** A walk from a starting total through increases and decreases to an end total. */
export type BridgeStep = { name: string; value: number; total?: boolean };
export type BridgePanel = PanelBase & { kind: "bridge"; steps: BridgeStep[] };
/** Flows from sources, through a core, to destinations (e.g. hires and moves into the workforce, exits out of it). */
export type SankeyNode = { name: string; value: number; side: "in" | "core" | "out"; hue: number };
export type SankeyPanel = PanelBase & { kind: "sankey"; nodes: SankeyNode[]; links: Array<{ source: string; target: string; value: number }> };

export type Panel = BarPanel | LinePanel | PartsPanel | HeatmapPanel | TablePanel | ListPanel | MatrixPanel | RadarPanel | ScatterPanel | BridgePanel | SankeyPanel;

export type BoardFilters = {
  location: string | null;
  department: string | null;
  /** Trend window in months (1, 3, 6 or 12). */
  months: 1 | 3 | 6 | 12;
};

export type Board = {
  board: BoardId;
  generatedAt: string;
  scope: {
    organisation: string;
    timezone: string;
    currency: string;
    today: string;
    filters: BoardFilters;
    /** Employees the board covers after filters (null for boards that are not about the workforce). */
    employeesInScope: number | null;
    /** Plain-language description of whose data this is ("Your direct reports", "Your own records"). */
    audience: string;
  };
  kpis: Kpi[];
  panels: Panel[];
  /** Findings derived from the figures above, most urgent first; empty when there is nothing to say. */
  insights: Array<string | Insight>;
  /** How the summary was computed: records read, the date range and what was left out. */
  evidence?: string[];
  /** Board-level message, e.g. the account is not linked to an employee record. */
  notice?: string;
};

/**
 * A finding the board leads with. `tone` ranks it (risk first); `figure` is its headline number;
 * `panel` is the chart that shows the evidence. A plain string is context with no rank.
 */
export type Insight = {
  text: string;
  title?: string;
  figure?: string;
  tone?: "risk" | "attention" | "positive" | "info";
  panel?: string;
};

export type FilterOptions = { locations: string[]; departments: string[] };
