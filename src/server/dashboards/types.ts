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
};

export type Series = { name: string; data: number[]; stack?: string; kind?: "bar" | "line" };

export type BarPanel = PanelBase & { kind: "bar"; horizontal?: boolean; categories: string[]; series: Series[] };
export type LinePanel = PanelBase & { kind: "line"; categories: string[]; series: Series[] };
export type PartsPanel = PanelBase & { kind: "parts"; items: Array<{ name: string; value: number }> };
export type HeatmapPanel = PanelBase & { kind: "heatmap"; x: string[]; y: string[]; cells: Array<[number, number, number]> };
export type TableColumn = { key: string; label: string; format?: ValueFormat };
export type TablePanel = PanelBase & { kind: "table"; columns: TableColumn[]; rows: Array<Record<string, string | number | null>> };
export type ListItem = { label: string; detail?: string; value?: number | string | null; format?: ValueFormat; status?: string; tone?: Kpi["tone"]; target?: string };
export type ListPanel = PanelBase & { kind: "list"; items: ListItem[] };

export type Panel = BarPanel | LinePanel | PartsPanel | HeatmapPanel | TablePanel | ListPanel;

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
  /** Plain statements derived from the figures above; empty when there is nothing to say. */
  insights: string[];
  /** Board-level message, e.g. the account is not linked to an employee record. */
  notice?: string;
};

export type FilterOptions = { locations: string[]; departments: string[] };
