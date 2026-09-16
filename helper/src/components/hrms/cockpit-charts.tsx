"use client";

/**
 * Cockpit chart library — the shared visual vocabulary for the ten dashboard
 * cockpits. It extends `./charts.tsx` with the shapes those pages need and
 * follows the same conventions: `ResponsiveContainer` inside a fixed-height,
 * `min-h`-floored box, tick density driven by `useMediaQuery`, axes and grids
 * painted with `--line` / `--text-2`, and opaque `--popover` tooltips.
 *
 * Every component is data-in / chart-out: it renders no `Surface`, no heading
 * and no padding of its own. Compose it inside `Surface` + `SectionHeading`.
 *
 * Nothing here fabricates data. Pass `null`/`undefined` while a query is in
 * flight and `[]` when the answer is genuinely "no records"; both render an
 * honest `StateBlock` rather than a zero (DESIGN_SYSTEM.md §9).
 *
 * ---------------------------------------------------------------------------
 * USAGE — props shape of every export
 * ---------------------------------------------------------------------------
 *
 * chartSeriesColor(2)                         // -> "var(--chart-3)"
 *
 * <SankeyFlow
 *   nodes={[{ name: "Hires" }, { name: "Engineering" }, { name: "Exits" }]}
 *   links={[{ source: 0, target: 1, value: 42 }, { source: 1, target: 2, value: 11 }]}
 *   centreIndex={1}
 * />
 *
 * <ConversionFunnel stages={[{ label: "Applied", value: 1280 }, { label: "Joined", value: 46 }]} />
 *
 * <WaterfallBridge items={[
 *   { label: "Budget", value: 120, kind: "base" },
 *   { label: "Overtime", value: -8, kind: "delta" },
 *   { label: "Actual", value: 112, kind: "total" },
 * ]} valuePrefix="₹" valueSuffix="L" />
 *
 * <MatrixHeatmap
 *   rows={["Engineering", "Sales"]}
 *   columns={["Mon", "Tue"]}
 *   values={[[12, 4], [7, 9]]}
 *   valueLabel="Absences"
 * />
 *
 * <BubbleScatter
 *   series={[{ name: "Engineering", points: [{ x: 3.2, y: 88, z: 46, label: "Platform" }] }]}
 *   xLabel="Tenure (yrs)" yLabel="Capability" sizeLabel="Headcount"
 * />
 *
 * <ComparisonRadar
 *   axes={[{ axis: "Retention", current: 84, comparison: 79 }]}
 *   currentLabel="This quarter" comparisonLabel="Target"
 * />
 *
 * <DualAxisTrend
 *   points={[{ label: "Apr", left: 94.2, right: 3.1 }]}
 *   leftLabel="Attendance %" rightLabel="Absenteeism %"
 * />
 *
 * <StackedCapacityBars bars={[{ label: "Engineering", delivering: 62, onLeave: 8, inTraining: 5 }]} />
 *
 * <ProgressGauge value={318} max={402} label="On shift" sublabel="Shift A · 06:00–14:00" />
 *
 * <ConcentricRings
 *   rings={[{ label: "Earned", value: 12, max: 18 }, { label: "Casual", value: 4, max: 6 }]}
 *   centreLabel="days left"
 * />
 *
 * <BellCurveDistribution
 *   buckets={[{ bucket: "1.0", actual: 4, guided: 6 }]}
 *   actualLabel="Actual" guidedLabel="Guided curve"
 * />
 *
 * <NineBoxGrid
 *   cells={[{ id: "hi-hi", label: "Star", count: 14, performance: 3, potential: 3 }]}
 *   onSelect={(cell) => setFocus(cell.id)}
 * />
 */

import { useEffect, useId, useState } from "react";
import { ChartNoAxesColumn } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Sankey,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from "recharts";
import { StateBlock } from "./page-primitives";
import { cn } from "@/lib/utils";

/**
 * Tracks a media query without pulling in a dependency. It starts `false` so the
 * server render and the first client render agree, then corrects itself on mount
 * and on every subsequent viewport change.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Phone-width breakpoint: below Tailwind's `sm`. */
const NARROW = "(max-width: 639px)";

/** The five categorical chart tokens, in the order cockpits should consume them. */
const SERIES_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/**
 * Colour for the nth series of a multi-series visualisation. Cycles the five
 * theme-aware chart tokens so two cockpits showing the same departments in the
 * same order paint them the same way.
 */
export function chartSeriesColor(index: number): string {
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  return SERIES_TOKENS[((safe % SERIES_TOKENS.length) + SERIES_TOKENS.length) % SERIES_TOKENS.length];
}

/** Recharts draws its own focus outline around the tooltip wrapper; drop it. */
const tooltipWrapper = { outline: "none" } as const;

/**
 * Opaque popover tokens so the tooltip stays readable over any surface in
 * either theme; the Tailwind utilities alone can be composited by recharts.
 */
const tooltipShell = { background: "var(--popover)", color: "var(--popover-foreground)" } as const;

interface SeriesTooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
}

interface SeriesTooltipProps {
  active?: boolean;
  payload?: SeriesTooltipEntry[];
  label?: string | number;
  /** Rendered after every value, e.g. `%`. */
  suffix?: string;
}

/** Multi-series tooltip: one row per visible series, dot plus the series name. */
const SeriesTooltip = ({ active, payload, label, suffix }: SeriesTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="max-w-[240px] rounded-lg border border-border p-3 shadow-[var(--shadow-overlay)]"
      style={tooltipShell}
    >
      {label !== undefined && label !== "" && (
        <p className="truncate font-mono text-xs font-semibold text-muted-foreground">{label}</p>
      )}
      <ul className="mt-1 space-y-1">
        {payload.map((entry, index) => (
          <li key={`${entry.name ?? index}`} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color ?? chartSeriesColor(index) }}
            />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {entry.name ?? ""}
            </span>
            <span className="font-mono text-xs font-bold text-foreground tabular-nums">
              {entry.value}
              {suffix ?? ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Honest empty state for a chart slot. Keeps the same vertical floor the chart
 * would have occupied so a cockpit grid does not jump when data arrives.
 */
function ChartEmpty({
  title,
  note,
  minHeight = 200,
}: {
  title: string;
  note?: string;
  minHeight?: number;
}) {
  return (
    <div className="grid w-full place-items-center" style={{ minHeight }}>
      <StateBlock tone="empty" icon={ChartNoAxesColumn} title={title} description={note} />
    </div>
  );
}

/** `null`/`undefined` means "not loaded"; `[]` means "no records". */
function isBlank(rows: readonly unknown[] | null | undefined): boolean {
  return !rows || rows.length === 0;
}

function shorten(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/* -------------------------------------------------------------------------- */
/* 1. SankeyFlow                                                              */
/* -------------------------------------------------------------------------- */

export type SankeyFlowNode = { name: string };
export type SankeyFlowLink = { source: number; target: number; value: number };

export type SankeyFlowProps = {
  nodes?: SankeyFlowNode[] | null;
  links?: SankeyFlowLink[] | null;
  /**
   * Index (into `nodes`) of the node everything flows through. Links *into* it
   * read as inflow and take the info tone; links *out* of it read as outflow
   * and take the destructive tone.
   */
  centreIndex?: number;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Talent flow: inflow nodes -> a central node -> outflow nodes. */
export function SankeyFlow({
  nodes,
  links,
  centreIndex = 0,
  ariaLabel = "Talent flow between sources, the organisation and exits",
  emptyTitle = "No talent flow recorded",
  emptyNote = "Joiners, transfers and exits appear here once movement is posted for the period.",
}: SankeyFlowProps) {
  const narrow = useMediaQuery(NARROW);

  // Recharts' Sankey needs a dense, self-consistent graph: every node must take
  // part in at least one positive link and every link must point at a real node.
  // Anything short of that throws inside the layout solver, so prune first.
  const sourceNodes = nodes ?? [];
  const sourceLinks = links ?? [];
  const usableLinks = sourceLinks.filter(
    (link) =>
      Number.isFinite(link.value) &&
      link.value > 0 &&
      link.source !== link.target &&
      sourceNodes[link.source] !== undefined &&
      sourceNodes[link.target] !== undefined
  );
  const used = new Set<number>();
  for (const link of usableLinks) {
    used.add(link.source);
    used.add(link.target);
  }
  const kept = sourceNodes.map((_, index) => index).filter((index) => used.has(index));
  const remap = new Map(kept.map((original, next) => [original, next]));
  const graph = {
    nodes: kept.map((index) => ({ name: sourceNodes[index].name })),
    links: usableLinks.map((link) => ({
      source: remap.get(link.source) ?? 0,
      target: remap.get(link.target) ?? 0,
      value: link.value,
    })),
  };
  const centre = remap.get(centreIndex) ?? 0;

  // Left = pure source, right = pure sink, centre = both. Drives label side.
  const isTarget = new Set(graph.links.map((link) => link.target));
  const isSource = new Set(graph.links.map((link) => link.source));

  if (graph.nodes.length < 2 || graph.links.length === 0) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={280} />;
  }

  const renderLink = (linkProps: SankeyLinkProps) => {
    const {
      sourceX,
      targetX,
      sourceY,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      index,
    } = linkProps;
    const half = linkWidth / 2;
    const inflow = graph.links[index]?.target === centre;
    const tone = inflow ? "var(--chart-1)" : "var(--destructive)";
    return (
      <path
        d={
          `M${sourceX},${sourceY + half}` +
          `C${sourceControlX},${sourceY + half} ${targetControlX},${targetY + half} ${targetX},${targetY + half}` +
          `L${targetX},${targetY - half}` +
          `C${targetControlX},${targetY - half} ${sourceControlX},${sourceY - half} ${sourceX},${sourceY - half}` +
          "Z"
        }
        fill={tone}
        fillOpacity={0.26}
        stroke="none"
      />
    );
  };

  const renderNode = (nodeProps: SankeyNodeProps) => {
    const { x, y, width, height, index } = nodeProps;
    const name = graph.nodes[index]?.name ?? "";
    const isCentre = index === centre;
    const leftSide = !isCentre && isSource.has(index) && !isTarget.has(index);
    const tone = isCentre
      ? "var(--chart-1)"
      : leftSide
        ? "var(--chart-5)"
        : "var(--destructive)";
    const fontSize = narrow ? 9 : 11;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={tone} fillOpacity={0.9} rx={2} />
        <text
          x={leftSide ? x + width + 6 : isCentre ? x + width / 2 : x - 6}
          y={isCentre ? y - 6 : y + height / 2}
          textAnchor={leftSide ? "start" : isCentre ? "middle" : "end"}
          dominantBaseline={isCentre ? "auto" : "middle"}
          fill="var(--text-2)"
          fontSize={fontSize}
          fontWeight={isCentre ? 600 : 500}
        >
          {shorten(name, narrow ? 10 : 18)}
        </text>
      </g>
    );
  };

  return (
    <div
      className="h-[280px] min-h-[280px] w-full sm:h-[340px]"
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <Sankey
          data={graph}
          nodeWidth={narrow ? 8 : 12}
          nodePadding={narrow ? 14 : 22}
          margin={{
            top: 18,
            right: narrow ? 56 : 92,
            bottom: 12,
            left: narrow ? 56 : 92,
          }}
          link={renderLink}
          node={renderNode}
        >
          <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. ConversionFunnel                                                        */
/* -------------------------------------------------------------------------- */

export type FunnelStage = { label: string; value: number };

export type ConversionFunnelProps = {
  stages?: FunnelStage[] | null;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Staged hiring funnel with stage-over-stage conversion printed as text. */
export function ConversionFunnel({
  stages,
  ariaLabel = "Hiring funnel by stage with stage-over-stage conversion",
  emptyTitle = "No candidates in the funnel",
  emptyNote = "Stages populate once applications are received for the selected requisitions.",
}: ConversionFunnelProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(stages)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={220} />;
  }
  const rows = (stages as FunnelStage[]).map((stage, index, all) => {
    const previous = index === 0 ? null : all[index - 1].value;
    const conversion =
      previous === null ? null : previous > 0 ? (stage.value / previous) * 100 : null;
    const ratio = all.length > 1 ? index / (all.length - 1) : 0;
    return {
      ...stage,
      conversion,
      // Graded blend so the funnel reads as one ramp rather than five categories.
      fill: `color-mix(in srgb, var(--chart-2) ${Math.round(ratio * 100)}%, var(--chart-1))`,
    };
  });

  return (
    <div>
      <div
        className="h-[200px] min-h-[200px] w-full sm:h-[240px]"
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <FunnelChart margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} />
            <Funnel
              data={rows}
              dataKey="value"
              nameKey="label"
              stroke="var(--popover)"
              strokeWidth={2}
              isAnimationActive
            />
          </FunnelChart>
        </ResponsiveContainer>
      </div>
      {/* The numbers live in text, never in the trapezoid width alone. */}
      <ul className="mt-3 grid gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: row.fill }} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
              {row.label}
            </span>
            <span className="font-mono text-[12px] font-bold text-foreground tabular-nums">
              {row.value.toLocaleString()}
            </span>
            <span
              className={cn(
                "w-[52px] shrink-0 text-right font-mono text-[11px] tabular-nums",
                row.conversion === null ? "text-muted-foreground" : "text-primary"
              )}
            >
              {row.conversion === null ? "—" : `${row.conversion.toFixed(narrow ? 0 : 1)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. WaterfallBridge                                                         */
/* -------------------------------------------------------------------------- */

export type WaterfallItem = {
  label: string;
  value: number;
  kind: "base" | "delta" | "total";
};

export type WaterfallBridgeProps = {
  items?: WaterfallItem[] | null;
  /** Printed before every value in the tooltip, e.g. `₹`. */
  valuePrefix?: string;
  /** Printed after every value in the tooltip, e.g. `L` or `%`. */
  valueSuffix?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

type BridgeRow = WaterfallItem & { offset: number; span: number; tone: string };

interface BridgeTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: BridgeRow }>;
  prefix?: string;
  suffix?: string;
}

const BridgeTooltip = ({ active, payload, prefix, suffix }: BridgeTooltipProps) => {
  const row = active && payload && payload.length ? payload[payload.length - 1].payload : undefined;
  if (!row) return null;
  const signed = row.kind === "delta" && row.value > 0 ? `+${row.value}` : String(row.value);
  return (
    <div
      className="max-w-[220px] rounded-lg border border-border p-3 shadow-[var(--shadow-overlay)]"
      style={tooltipShell}
    >
      <p className="truncate font-mono text-xs font-semibold text-muted-foreground">{row.label}</p>
      <p className="break-words font-mono text-sm font-bold tabular-nums" style={{ color: row.tone }}>
        {prefix ?? ""}
        {signed}
        {suffix ?? ""}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {row.kind === "delta" ? "movement" : row.kind}
      </p>
    </div>
  );
};

/**
 * Turns the caller's list into floating bars: each row carries the invisible
 * pedestal (`offset`) it sits on plus the height it draws (`span`). Kept out of
 * the component body so the running total is plain local arithmetic.
 */
function buildBridgeRows(items: readonly WaterfallItem[]): BridgeRow[] {
  const rows: BridgeRow[] = [];
  let running = 0;
  for (const item of items) {
    if (item.kind === "delta") {
      const start = running;
      running = start + item.value;
      rows.push({
        ...item,
        offset: Math.min(start, running),
        span: Math.abs(item.value),
        tone: item.value >= 0 ? "var(--success)" : "var(--destructive)",
      });
    } else {
      running = item.value;
      rows.push({ ...item, offset: 0, span: Math.abs(item.value), tone: "var(--chart-1)" });
    }
  }
  return rows;
}

/**
 * Floating-bar bridge for cost variance. Built as a stacked `BarChart` whose
 * first series is an invisible offset — the standard recharts waterfall.
 */
export function WaterfallBridge({
  items,
  valuePrefix,
  valueSuffix,
  ariaLabel = "Cost bridge from opening position to closing position",
  emptyTitle = "No variance to bridge",
  emptyNote = "The bridge is drawn once a baseline and at least one posted movement exist.",
}: WaterfallBridgeProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(items)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={240} />;
  }

  const rows = buildBridgeRows(items as WaterfallItem[]);

  return (
    <div
      className="h-[240px] min-h-[240px] w-full sm:h-[280px]"
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={rows}
          margin={{ top: 12, right: narrow ? 6 : 10, left: narrow ? -22 : -14, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={narrow ? Math.max(0, Math.ceil(rows.length / 4) - 1) : 0}
            minTickGap={narrow ? 12 : 4}
            tickFormatter={(value: string) => shorten(String(value), narrow ? 5 : 10)}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 9 : 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <Tooltip
            content={<BridgeTooltip prefix={valuePrefix} suffix={valueSuffix} />}
            wrapperStyle={tooltipWrapper}
            cursor={{ fill: "var(--row-hover)" }}
          />
          {/* Invisible pedestal that lifts each floating bar to its start value. */}
          <Bar dataKey="offset" stackId="bridge" fill="transparent" stroke="none" isAnimationActive={false} />
          <Bar dataKey="span" stackId="bridge" radius={[4, 4, 0, 0]} maxBarSize={narrow ? 22 : 38} isAnimationActive>
            {rows.map((row) => (
              <Cell key={row.label} fill={row.tone} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. MatrixHeatmap                                                           */
/* -------------------------------------------------------------------------- */

export type MatrixHeatmapProps = {
  rows?: string[] | null;
  columns?: string[] | null;
  /** `values[rowIndex][columnIndex]`; `null` marks a cell with no reading. */
  values?: Array<Array<number | null>> | null;
  /** What the numbers are, printed in the legend, e.g. "Absences". */
  valueLabel?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/**
 * Row x column matrix with a continuous ramp. Deliberately not recharts: a CSS
 * grid keeps every cell's number selectable text, which the colour-alone rule
 * in DESIGN_SYSTEM.md §9 requires.
 */
export function MatrixHeatmap({
  rows,
  columns,
  values,
  valueLabel = "Value",
  ariaLabel,
  emptyTitle = "No matrix readings",
  emptyNote = "Cells fill in once readings exist for the selected rows and period.",
}: MatrixHeatmapProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(rows) || isBlank(columns) || isBlank(values)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={200} />;
  }
  const rowLabels = rows as string[];
  const columnLabels = columns as string[];
  const grid = values as Array<Array<number | null>>;

  const readings = grid.flat().filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (readings.length === 0) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={200} />;
  }
  const min = Math.min(...readings);
  const max = Math.max(...readings);
  const span = max - min || 1;
  // 6% .. 72% keeps `--text` legible on the wash in both themes.
  const wash = (value: number) =>
    `color-mix(in srgb, var(--destructive) ${Math.round(6 + ((value - min) / span) * 66)}%, transparent)`;

  const labelWidth = narrow ? 84 : 128;
  const cellWidth = narrow ? 54 : 68;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label={ariaLabel ?? `${valueLabel} by row and column`}
          className="min-w-max"
        >
          <div role="row" className="flex">
            <div role="columnheader" style={{ width: labelWidth }} className="shrink-0" />
            {columnLabels.map((column) => (
              <div
                key={column}
                role="columnheader"
                title={column}
                style={{ width: cellWidth }}
                className="shrink-0 truncate px-1 pb-1.5 text-center text-[10px] font-semibold text-muted-foreground"
              >
                {shorten(column, narrow ? 6 : 9)}
              </div>
            ))}
          </div>
          {rowLabels.map((row, rowIndex) => (
            <div role="row" key={row} className="flex items-stretch">
              <div
                role="rowheader"
                title={row}
                style={{ width: labelWidth }}
                className="flex shrink-0 items-center truncate pr-2 text-[11px] font-medium text-foreground"
              >
                {shorten(row, narrow ? 12 : 18)}
              </div>
              {columnLabels.map((column, columnIndex) => {
                const value = grid[rowIndex]?.[columnIndex];
                const known = typeof value === "number" && Number.isFinite(value);
                return (
                  <div
                    role="cell"
                    key={`${row}-${column}`}
                    title={`${row} · ${column}: ${known ? value : "no reading"}`}
                    style={{
                      width: cellWidth,
                      background: known ? wash(value) : "transparent",
                    }}
                    className="m-[2px] grid h-8 shrink-0 place-items-center rounded-md border border-border font-mono text-[11px] font-bold text-foreground tabular-nums sm:h-9"
                  >
                    {known ? value : <span className="text-muted-foreground">—</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-muted-foreground">{valueLabel}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{min}</span>
        <span
          className="h-2 min-w-0 flex-1 rounded-full border border-border"
          style={{
            background:
              "linear-gradient(to right, color-mix(in srgb, var(--destructive) 6%, transparent), color-mix(in srgb, var(--destructive) 72%, transparent))",
          }}
        />
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{max}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. BubbleScatter                                                           */
/* -------------------------------------------------------------------------- */

export type BubblePoint = { x: number; y: number; z: number; label?: string };
export type BubbleSeries = { name: string; points: BubblePoint[] };

export type BubbleScatterProps = {
  series?: BubbleSeries[] | null;
  xLabel?: string;
  yLabel?: string;
  sizeLabel?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Three-variable scatter: position plus bubble area via `ZAxis`. */
export function BubbleScatter({
  series,
  xLabel = "X",
  yLabel = "Y",
  sizeLabel = "Size",
  ariaLabel,
  emptyTitle = "No points to plot",
  emptyNote = "Each bubble needs an x, a y and a size; none are available for this selection yet.",
}: BubbleScatterProps) {
  const narrow = useMediaQuery(NARROW);
  const populated = (series ?? []).filter((entry) => entry.points.length > 0);
  if (isBlank(series) || populated.length === 0) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={240} />;
  }

  return (
    <div
      className="h-[240px] min-h-[240px] w-full sm:h-[300px]"
      role="img"
      aria-label={ariaLabel ?? `${yLabel} against ${xLabel}, bubble area shows ${sizeLabel}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 12, right: narrow ? 8 : 14, left: narrow ? -22 : -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            axisLine={false}
            tickLine={false}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
            dy={6}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <ZAxis type="number" dataKey="z" name={sizeLabel} range={narrow ? [50, 300] : [70, 520]} />
          <Tooltip
            content={<SeriesTooltip />}
            wrapperStyle={tooltipWrapper}
            cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.35, strokeDasharray: "3 3" }}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: narrow ? 10 : 11, paddingTop: 4 }}
            formatter={(value) => <span style={{ color: "var(--text-2)" }}>{String(value)}</span>}
          />
          {populated.map((entry, index) => (
            <Scatter
              key={entry.name}
              name={entry.name}
              data={entry.points}
              fill={chartSeriesColor(index)}
              fillOpacity={0.55}
              stroke={chartSeriesColor(index)}
              strokeWidth={1.5}
              isAnimationActive
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. ComparisonRadar                                                         */
/* -------------------------------------------------------------------------- */

export type RadarAxisPoint = { axis: string; current: number; comparison: number };

export type ComparisonRadarProps = {
  axes?: RadarAxisPoint[] | null;
  currentLabel?: string;
  comparisonLabel?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Six-axis radar carrying a current series (solid) and a target (dashed). */
export function ComparisonRadar({
  axes,
  currentLabel = "Current",
  comparisonLabel = "Target",
  ariaLabel,
  emptyTitle = "No scores to compare",
  emptyNote = "Both the current reading and its comparison are needed before the radar is drawn.",
}: ComparisonRadarProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(axes)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={220} />;
  }
  const data = axes as RadarAxisPoint[];

  return (
    <div
      className="h-[220px] min-h-[220px] w-full sm:h-[270px]"
      role="img"
      aria-label={ariaLabel ?? `${currentLabel} against ${comparisonLabel} across ${data.length} dimensions`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {/* A smaller web at phone width leaves room for the axis labels. */}
        <RadarChart data={data} outerRadius={narrow ? "56%" : "68%"}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 9 : 11 }}
            tickFormatter={(value: string) => shorten(String(value), narrow ? 7 : 14)}
          />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar
            name={comparisonLabel}
            dataKey="comparison"
            stroke="var(--text-2)"
            strokeDasharray="5 4"
            strokeWidth={1.75}
            fill="none"
            isAnimationActive
          />
          <Radar
            name={currentLabel}
            dataKey="current"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive
          />
          <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: narrow ? 10 : 11 }}
            formatter={(value) => <span style={{ color: "var(--text-2)" }}>{String(value)}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. DualAxisTrend                                                           */
/* -------------------------------------------------------------------------- */

export type DualAxisPoint = { label: string; left: number; right: number };

export type DualAxisTrendProps = {
  points?: DualAxisPoint[] | null;
  leftLabel?: string;
  rightLabel?: string;
  /** Printed after both values in the tooltip, e.g. `%`. */
  valueSuffix?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Two measures on independent Y axes; the left one carries a gradient fill. */
export function DualAxisTrend({
  points,
  leftLabel = "Primary",
  rightLabel = "Secondary",
  valueSuffix,
  ariaLabel,
  emptyTitle = "No trend recorded",
  emptyNote = "The trend line builds as daily readings are posted for the period.",
}: DualAxisTrendProps) {
  const narrow = useMediaQuery(NARROW);
  // A stable, CSS-safe gradient id so two instances on one cockpit do not
  // overwrite each other's <defs>.
  const gradientId = `dual-axis-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (isBlank(points)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={220} />;
  }
  const data = points as DualAxisPoint[];
  // On a phone only ~4 labels fit along the axis without colliding.
  const tickInterval = narrow ? Math.max(0, Math.ceil(data.length / 4) - 1) : "preserveStartEnd";

  return (
    <div
      className="h-[220px] min-h-[220px] w-full sm:h-[270px]"
      role="img"
      aria-label={ariaLabel ?? `${leftLabel} and ${rightLabel} over ${data.length} periods`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: narrow ? -14 : -8, left: narrow ? -22 : -14, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.26} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            minTickGap={narrow ? 14 : 6}
            tickFormatter={(value: string) => (narrow ? String(value).slice(0, 3) : String(value))}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            width={narrow ? 34 : 44}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <Tooltip
            content={<SeriesTooltip suffix={valueSuffix} />}
            wrapperStyle={tooltipWrapper}
            cursor={{ stroke: "var(--chart-1)", strokeOpacity: 0.35, strokeWidth: 1.5 }}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: narrow ? 10 : 11 }}
            formatter={(value) => <span style={{ color: "var(--text-2)" }}>{String(value)}</span>}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="left"
            name={leftLabel}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 3 }}
            isAnimationActive
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="right"
            name={rightLabel}
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-4)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. StackedCapacityBars                                                     */
/* -------------------------------------------------------------------------- */

export type CapacityBar = {
  label: string;
  delivering: number;
  onLeave: number;
  inTraining: number;
};

export type StackedCapacityBarsProps = {
  bars?: CapacityBar[] | null;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

const CAPACITY_BANDS = [
  { key: "delivering", label: "Delivering", tone: "var(--chart-1)" },
  { key: "onLeave", label: "On leave", tone: "var(--warning)" },
  { key: "inTraining", label: "In training", tone: "var(--chart-4)" },
] as const;

/** Where each team's capacity actually sits, stacked and legended. */
export function StackedCapacityBars({
  bars,
  ariaLabel = "Capacity split into delivering, on leave and in training",
  emptyTitle = "No capacity recorded",
  emptyNote = "Capacity appears once teams have assigned members for the selected period.",
}: StackedCapacityBarsProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(bars)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={240} />;
  }
  const data = bars as CapacityBar[];

  return (
    <div
      className="h-[240px] min-h-[240px] w-full sm:h-[290px]"
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 12, right: narrow ? 6 : 10, left: narrow ? -22 : -14, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={narrow ? Math.max(0, Math.ceil(data.length / 4) - 1) : 0}
            minTickGap={narrow ? 12 : 4}
            tickFormatter={(value: string) => shorten(String(value), narrow ? 6 : 12)}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 9 : 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            allowDecimals={false}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} cursor={{ fill: "var(--row-hover)" }} />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: narrow ? 10 : 11 }}
            formatter={(value) => <span style={{ color: "var(--text-2)" }}>{String(value)}</span>}
          />
          {CAPACITY_BANDS.map((band, index) => (
            <Bar
              key={band.key}
              dataKey={band.key}
              name={band.label}
              stackId="capacity"
              fill={band.tone}
              maxBarSize={narrow ? 24 : 40}
              radius={index === CAPACITY_BANDS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. ProgressGauge                                                           */
/* -------------------------------------------------------------------------- */

export type ProgressGaugeProps = {
  value?: number | null;
  max?: number | null;
  label: string;
  sublabel?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  emptyTitle?: string;
  emptyNote?: string;
};

const GAUGE_TONES = {
  primary: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  info: "var(--info)",
} as const;

/**
 * Circular progress ring drawn as plain SVG — recharts' radial bar cannot hold
 * a crisp centre readout at this size. Scales with its container via `viewBox`.
 */
export function ProgressGauge({
  value,
  max,
  label,
  sublabel,
  tone = "primary",
  emptyTitle = "No reading available",
  emptyNote = "The gauge fills once a count is reported for this window.",
}: ProgressGaugeProps) {
  const known =
    typeof value === "number" &&
    Number.isFinite(value) &&
    typeof max === "number" &&
    Number.isFinite(max) &&
    max > 0;
  if (!known) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={180} />;
  }
  const safeValue = Math.max(0, Math.min(value, max));
  const percent = (safeValue / max) * 100;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <div
      className="h-[180px] min-h-[180px] w-full"
      role="img"
      aria-label={`${label}: ${safeValue} of ${max}, ${Math.round(percent)} percent${sublabel ? `. ${sublabel}` : ""}`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" focusable="false">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={GAUGE_TONES[tone]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fill="var(--text)"
          fontSize="22"
          fontWeight="700"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(percent)}%
        </text>
        <text x="60" y="72" textAnchor="middle" fill="var(--text-2)" fontSize="9" fontWeight="600">
          {shorten(label, 18)}
        </text>
        <text x="60" y="85" textAnchor="middle" fill="var(--text-2)" fontSize="8">
          {`${safeValue} / ${max}`}
        </text>
        {sublabel && (
          <text x="60" y="98" textAnchor="middle" fill="var(--text-2)" fontSize="7.5">
            {shorten(sublabel, 26)}
          </text>
        )}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. ConcentricRings                                                        */
/* -------------------------------------------------------------------------- */

export type RingDatum = { label: string; value: number; max?: number };

export type ConcentricRingsProps = {
  rings?: RingDatum[] | null;
  /** Printed under the centre total, e.g. "days left". */
  centreLabel?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Nested rings for leave balances, with the total spelled out in the centre. */
export function ConcentricRings({
  rings,
  centreLabel = "total",
  ariaLabel,
  emptyTitle = "No balances to show",
  emptyNote = "Ring balances appear once leave entitlements are assigned to this employee.",
}: ConcentricRingsProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(rings)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={200} />;
  }
  const source = rings as RingDatum[];
  const domainMax = Math.max(...source.map((ring) => ring.max ?? ring.value), 1);
  const total = source.reduce((sum, ring) => sum + ring.value, 0);
  // Outermost ring first so the array order matches what the eye reads outward-in.
  const data = source.map((ring, index) => ({
    ...ring,
    fill: chartSeriesColor(index),
  }));

  return (
    <div>
      <div
        className="relative h-[200px] min-h-[200px] w-full sm:h-[230px]"
        role="img"
        aria-label={
          ariaLabel ??
          `Leave balances: ${source.map((ring) => `${ring.label} ${ring.value}`).join(", ")}`
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <RadialBarChart
            data={data}
            innerRadius="42%"
            outerRadius="94%"
            startAngle={90}
            endAngle={-270}
            barSize={narrow ? 9 : 13}
          >
            <PolarAngleAxis type="number" domain={[0, domainMax]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: "var(--line)" }}
              cornerRadius={6}
              isAnimationActive
            />
            <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <div className="min-w-0">
            <p className="truncate font-mono text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
              {total}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {centreLabel}
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {data.map((ring) => (
          <li key={ring.label} className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: ring.fill }} />
            <span className="truncate text-[11px] text-muted-foreground">{ring.label}</span>
            <span className="font-mono text-[11px] font-bold text-foreground tabular-nums">
              {ring.value}
              {ring.max !== undefined ? `/${ring.max}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 11. BellCurveDistribution                                                  */
/* -------------------------------------------------------------------------- */

export type DistributionBucket = { bucket: string; actual: number; guided: number };

export type BellCurveDistributionProps = {
  buckets?: DistributionBucket[] | null;
  actualLabel?: string;
  guidedLabel?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

/** Actual rating distribution as bars, with the guided curve dashed over it. */
export function BellCurveDistribution({
  buckets,
  actualLabel = "Actual",
  guidedLabel = "Guided curve",
  ariaLabel,
  emptyTitle = "No ratings distributed yet",
  emptyNote = "The distribution is drawn once appraisal ratings are submitted for this cycle.",
}: BellCurveDistributionProps) {
  const narrow = useMediaQuery(NARROW);
  if (isBlank(buckets)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={230} />;
  }
  const data = buckets as DistributionBucket[];

  return (
    <div
      className="h-[230px] min-h-[230px] w-full sm:h-[280px]"
      role="img"
      aria-label={ariaLabel ?? `${actualLabel} rating distribution against the ${guidedLabel}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: narrow ? 6 : 10, left: narrow ? -22 : -14, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            axisLine={false}
            tickLine={false}
            interval={narrow ? Math.max(0, Math.ceil(data.length / 5) - 1) : 0}
            minTickGap={narrow ? 10 : 4}
            tickFormatter={(value: string) => shorten(String(value), narrow ? 5 : 10)}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 9 : 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            allowDecimals={false}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
          />
          <Tooltip content={<SeriesTooltip />} wrapperStyle={tooltipWrapper} cursor={{ fill: "var(--row-hover)" }} />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: narrow ? 10 : 11 }}
            formatter={(value) => <span style={{ color: "var(--text-2)" }}>{String(value)}</span>}
          />
          <Bar
            dataKey="actual"
            name={actualLabel}
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={narrow ? 24 : 44}
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="guided"
            name={guidedLabel}
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-3)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 12. NineBoxGrid                                                            */
/* -------------------------------------------------------------------------- */

export type NineBoxCell = {
  id: string;
  label: string;
  count: number;
  /** 1 = low, 2 = moderate, 3 = high. */
  performance: 1 | 2 | 3;
  /** 1 = low, 2 = moderate, 3 = high. */
  potential: 1 | 2 | 3;
};

export type NineBoxGridProps = {
  cells?: NineBoxCell[] | null;
  onSelect?: (cell: NineBoxCell) => void;
  selectedId?: string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyNote?: string;
};

const AXIS_BANDS = ["Low", "Moderate", "High"] as const;

/** Talent nine-box: performance across, potential up. Counts are always text. */
export function NineBoxGrid({
  cells,
  onSelect,
  selectedId,
  ariaLabel = "Nine box grid of performance against potential",
  emptyTitle = "Nine box not calibrated",
  emptyNote = "Boxes populate after performance and potential ratings are calibrated for this cycle.",
}: NineBoxGridProps) {
  if (isBlank(cells)) {
    return <ChartEmpty title={emptyTitle} note={emptyNote} minHeight={260} />;
  }
  const source = cells as NineBoxCell[];
  const byPosition = new Map(source.map((cell) => [`${cell.performance}-${cell.potential}`, cell]));
  const counts = source.map((cell) => cell.count);
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]" role="group" aria-label={ariaLabel}>
        <div className="flex">
          {/* Potential axis, high at the top so the grid reads like a matrix. */}
          <div className="flex w-[104px] shrink-0 flex-col justify-between py-1 pr-2 text-right">
            {[3, 2, 1].map((potential) => (
              <div
                key={potential}
                className="flex h-[88px] items-center justify-end text-[11px] font-semibold text-muted-foreground"
              >
                {AXIS_BANDS[potential - 1]} potential
              </div>
            ))}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            {[3, 2, 1].flatMap((potential) =>
              [1, 2, 3].map((performance) => {
                const cell = byPosition.get(`${performance}-${potential}`);
                const intensity = cell ? Math.round(8 + (cell.count / maxCount) * 44) : 0;
                const wash = cell
                  ? `color-mix(in srgb, ${chartSeriesColor(potential - 1)} ${intensity}%, transparent)`
                  : "transparent";
                const selected = cell !== undefined && cell.id === selectedId;
                const interactive = cell !== undefined && onSelect !== undefined;
                const body = (
                  <>
                    <p className="truncate text-[11px] font-semibold text-foreground" title={cell?.label}>
                      {cell ? cell.label : "Not calibrated"}
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold text-foreground tabular-nums">
                      {cell ? cell.count : "—"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {cell ? (cell.count === 1 ? "employee" : "employees") : "no rating"}
                    </p>
                  </>
                );
                const shell = cn(
                  "h-[88px] min-w-0 rounded-lg border p-2.5 text-left transition-colors duration-150",
                  selected ? "border-primary" : "border-border",
                  interactive && "cursor-pointer hover:border-primary/60"
                );
                return interactive ? (
                  <button
                    key={`${performance}-${potential}`}
                    type="button"
                    onClick={() => onSelect(cell)}
                    aria-pressed={selected}
                    aria-label={`${cell.label}: ${cell.count} employees, ${AXIS_BANDS[performance - 1]} performance and ${AXIS_BANDS[potential - 1]} potential`}
                    className={shell}
                    style={{ background: wash }}
                  >
                    {body}
                  </button>
                ) : (
                  <div
                    key={`${performance}-${potential}`}
                    className={shell}
                    style={{ background: wash }}
                  >
                    {body}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="mt-2 flex">
          <div className="w-[104px] shrink-0" />
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            {[1, 2, 3].map((performance) => (
              <div
                key={performance}
                className="truncate text-center text-[11px] font-semibold text-muted-foreground"
              >
                {AXIS_BANDS[performance - 1]} performance
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
