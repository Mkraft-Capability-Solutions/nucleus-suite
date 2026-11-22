"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Lock, Table2 } from "lucide-react";
import type { MatrixPanel, Panel } from "@/server/dashboards/types";
import { Badge, EmptyState, IconButton, cx, ui } from "@/design/redesign/ui";
import { EChart, PALETTE, barOption, bridgeOption, heatmapOption, lineOption, radarOption, sankeyOption, scatterOption, useChartMode } from "./charts";
import { formatValue, type ValueFormat } from "./format";
import styles from "./Dashboards.module.css";

const SPAN_CLASS: Record<number, string> = { 4: styles.span4, 5: styles.span5, 6: styles.span6, 7: styles.span7, 8: styles.span8, 12: styles.span12 };

type TableShape = { columns: Array<{ key: string; label: string; format?: ValueFormat }>; rows: Array<Record<string, string | number | null>> };

/** Every chart has a table view: the same numbers, readable without colour or hover. */
function asTable(panel: Panel): TableShape | null {
  switch (panel.kind) {
    case "bar":
    case "line": {
      const categories = panel.kind === "bar" && panel.horizontal ? [...panel.categories].reverse() : panel.categories;
      const series = panel.kind === "bar" && panel.horizontal ? panel.series.map((entry) => ({ ...entry, data: [...entry.data].reverse() })) : panel.series;
      return {
        columns: [{ key: "category", label: "" }, ...series.map((entry, index) => ({ key: `s${index}`, label: entry.name, format: panel.format }))],
        rows: categories.map((category, row) => Object.fromEntries([["category", category], ...series.map((entry, index) => [`s${index}`, entry.data[row] ?? null])])),
      };
    }
    case "parts": {
      const total = panel.items.reduce((sum, item) => sum + item.value, 0);
      return {
        columns: [{ key: "name", label: "" }, { key: "value", label: "Count", format: panel.format }, { key: "share", label: "Share", format: "percent" }],
        rows: panel.items.map((item) => ({ name: item.name, value: item.value, share: total ? Math.round((item.value / total) * 1000) / 10 : null })),
      };
    }
    case "heatmap":
      return {
        columns: [{ key: "y", label: "" }, ...panel.x.map((name, index) => ({ key: `x${index}`, label: name, format: panel.format }))],
        rows: panel.y.map((name, yi) => Object.fromEntries([["y", name], ...panel.x.map((_, xi) => [`x${xi}`, panel.cells.find((cell) => cell[0] === xi && cell[1] === yi)?.[2] ?? 0])])),
      };
    case "radar":
      return {
        columns: [{ key: "name", label: "" }, ...panel.series.map((entry, index) => ({ key: `s${index}`, label: entry.name, format: panel.format }))],
        rows: panel.indicators.map((indicator, row) => Object.fromEntries([["name", indicator.name], ...panel.series.map((entry, index) => [`s${index}`, entry.data[row] ?? null])])),
      };
    case "scatter":
      return {
        columns: [{ key: "label", label: "" }, { key: "group", label: "Group" }, { key: "x", label: panel.xLabel, format: panel.xFormat }, { key: "y", label: panel.yLabel, format: panel.yFormat }],
        rows: panel.points.map((point) => ({ label: point.label, group: point.group, x: point.x, y: point.y })),
      };
    case "bridge":
      return {
        columns: [{ key: "name", label: "" }, { key: "value", label: "Amount", format: panel.format }],
        rows: panel.steps.map((step) => ({ name: step.total ? step.name : `${step.value >= 0 ? "+ " : "− "}${step.name}`, value: step.total ? step.value : Math.abs(step.value) })),
      };
    case "sankey":
      return {
        columns: [{ key: "from", label: "From" }, { key: "to", label: "To" }, { key: "value", label: "People", format: "count" }],
        rows: panel.links.map((link) => ({ from: link.source, to: link.target, value: link.value })),
      };
    case "matrix":
      return {
        columns: [{ key: "row", label: panel.rowAxis }, ...panel.cols.map((name, index) => ({ key: `c${index}`, label: name, format: "count" as const }))],
        rows: panel.rows.map((name, row) => Object.fromEntries([["row", name], ...panel.cols.map((_, col) => [`c${col}`, panel.cells.find((cell) => cell.row === row && cell.col === col)?.value ?? 0])])),
      };
    default:
      return null;
  }
}

const MATRIX_TONE = { positive: styles.cellPositive, attention: styles.cellAttention, risk: styles.cellRisk, neutral: styles.cellNeutral } as const;

/** A labelled grid (e.g. the nine-box): each cell names its band, so colour is never the only cue. */
function MatrixGrid({ panel }: { panel: MatrixPanel }) {
  const total = panel.cells.reduce((sum, cell) => sum + cell.value, 0);
  return (
    <div className={styles.matrix}>
      <div className={styles.matrixRowAxis}><span>{panel.rowAxis} →</span></div>
      <div className={styles.matrixBody}>
        <div className={styles.matrixGrid} style={{ gridTemplateColumns: `auto repeat(${panel.cols.length}, minmax(0, 1fr))` }}>
          {panel.rows.map((rowName, row) => [
            <span key={`r${row}`} className={styles.matrixRowLabel}>{rowName}</span>,
            ...panel.cols.map((_, col) => {
              const cell = panel.cells.find((entry) => entry.row === row && entry.col === col);
              const share = total && cell ? Math.round((cell.value / total) * 100) : 0;
              return (
                <div key={`${row}-${col}`} className={cx(styles.matrixCell, MATRIX_TONE[cell?.tone ?? "neutral"])} title={cell?.people?.length ? cell.people.join(", ") : undefined}>
                  <span className={styles.matrixValue}>{cell?.value ?? 0}</span>
                  <span className={styles.matrixLabel}>{cell?.label ?? ""}</span>
                  <span className={styles.matrixHint}>{cell?.hint ?? ""}{cell?.value ? ` · ${share}%` : ""}</span>
                </div>
              );
            }),
          ])}
          <span />
          {panel.cols.map((name) => <span key={name} className={styles.matrixColLabel}>{name}</span>)}
        </div>
        <div className={styles.matrixColAxis}>{panel.colAxis} →</div>
      </div>
    </div>
  );
}

function DataTable({ table, currency }: { table: TableShape; currency: string }) {
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <thead><tr>{table.columns.map((column) => <th key={column.key} className={column.format && column.format !== "text" && column.format !== "date" ? ui.numeric : undefined}>{column.label}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {table.columns.map((column) => {
                const value = row[column.key];
                const numeric = typeof value === "number";
                return <td key={column.key} className={numeric ? ui.numeric : undefined}>{numeric || column.format ? formatValue(value, column.format ?? "text", currency) : value ?? "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Part-to-whole as a sorted bar list (name, bar, value, share): easier to compare than a donut. */
function PartsList({ items, format, currency }: { items: Array<{ name: string; value: number }>; format: ValueFormat; currency: string }) {
  const mode = useChartMode();
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...sorted.map((item) => item.value));
  return (
    <ul className={styles.parts}>
      {sorted.map((item, index) => (
        <li key={item.name} className={styles.partRow}>
          <span className={styles.partName}>{item.name}</span>
          <span className={styles.partTrack} aria-hidden="true"><span className={styles.partFill} style={{ width: `${(item.value / max) * 100}%`, background: PALETTE[mode].series[Math.min(index, 7)] }} /></span>
          <span className={styles.partValue}>{formatValue(item.value, format, currency)}</span>
          <span className={styles.partShare}>{total ? `${Math.round((item.value / total) * 100)}%` : ""}</span>
        </li>
      ))}
    </ul>
  );
}

const TONE_BADGE = { positive: "success", attention: "warning", risk: "danger", neutral: "neutral" } as const;

export default function PanelView({ panel, currency, onNavigate }: { panel: Panel; currency: string; onNavigate?: (tab: string) => void }) {
  const mode = useChartMode();
  const [view, setView] = useState<"chart" | "table">("chart");
  const format = panel.format ?? "count";
  const table = useMemo(() => asTable(panel), [panel]);
  const chartable = ["bar", "line", "heatmap", "radar", "scatter", "bridge", "matrix", "sankey"].includes(panel.kind);
  const ok = panel.state === "ok";

  const option = useMemo(() => {
    const common = { mode, format, currency, label: panel.title };
    if (panel.kind === "bar") return barOption({ ...common, categories: panel.categories, series: panel.series, horizontal: panel.horizontal });
    if (panel.kind === "line") return lineOption({ ...common, categories: panel.categories, series: panel.series, band: panel.band });
    if (panel.kind === "heatmap") return heatmapOption({ ...common, x: panel.x, y: panel.y, cells: panel.cells, scale: panel.scale, showZero: panel.showZero, notes: panel.notes });
    if (panel.kind === "radar") return radarOption({ ...common, indicators: panel.indicators, series: panel.series });
    if (panel.kind === "scatter") return scatterOption({ ...common, points: panel.points, xLabel: panel.xLabel, yLabel: panel.yLabel, xFormat: panel.xFormat, yFormat: panel.yFormat, sizeLabel: panel.sizeLabel, xRef: panel.xRef, yRef: panel.yRef, groupHues: panel.groupHues });
    if (panel.kind === "sankey") return sankeyOption({ ...common, nodes: panel.nodes, links: panel.links });
    if (panel.kind === "bridge") return bridgeOption({ ...common, steps: panel.steps });
    return null;
  }, [panel, mode, format, currency]);

  const height = panel.kind === "scatter" && panel.points.some((point) => point.size !== undefined) ? 420
    : panel.kind === "radar" || panel.kind === "scatter" || panel.kind === "sankey" ? 300
    : panel.kind === "bar" && panel.horizontal ? Math.max(180, Math.min(420, panel.categories.length * 32 + 48))
    : panel.kind === "heatmap" ? Math.max(220, panel.y.length * (panel.y.length > 12 ? 26 : 36) + 80) : 260;

  let body;
  if (panel.state === "forbidden") body = <EmptyState icon={Lock} title="Not available for your role">{panel.emptyMessage}</EmptyState>;
  else if (panel.state === "unavailable") body = <EmptyState title="Could not be loaded">This source could not be read. The rest of the dashboard is unaffected; try again later.</EmptyState>;
  else if (!ok) body = <EmptyState title="Nothing to show yet">{panel.emptyMessage}</EmptyState>;
  else if (chartable && view === "table" && table) body = <DataTable table={table} currency={currency} />;
  else if (panel.kind === "matrix") body = <MatrixGrid panel={panel} />;
  else if (chartable && option) body = <div className={styles.chartBody}><EChart option={option} height={height} label={`${panel.title}. Switch to the table view for the values.`} /></div>;
  else if (panel.kind === "parts") body = view === "table" && table ? <DataTable table={table} currency={currency} /> : <PartsList items={panel.items} format={format} currency={currency} />;
  else if (panel.kind === "table") body = <DataTable table={{ columns: panel.columns, rows: panel.rows }} currency={currency} />;
  else if (panel.kind === "list") {
    body = (
      <ul className={styles.list}>
        {panel.items.map((item, index) => {
          const content = (
            <>
              <span className={styles.listText}><span className={styles.listLabel}>{item.label}</span>{item.detail && <span className={styles.listDetail}>{item.detail}</span>}</span>
              {item.value !== undefined && item.value !== null && <span className={styles.listValue}>{formatValue(item.value, item.format ?? "count", currency)}</span>}
              {item.status && <Badge tone={item.tone ? TONE_BADGE[item.tone] : "neutral"}>{item.status}</Badge>}
            </>
          );
          return (
            <li key={`${item.label}-${index}`}>
              {item.target && onNavigate
                ? <button type="button" className={cx(styles.listRow, styles.listButton)} onClick={() => onNavigate(item.target!)}>{content}</button>
                : <div className={styles.listRow}>{content}</div>}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className={cx(ui.panel, styles.panel, SPAN_CLASS[panel.span] ?? styles.span6)} aria-labelledby={`panel-${panel.id}`}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <h2 id={`panel-${panel.id}`} className={ui.panelTitle}>{panel.title}</h2>
          {panel.subtitle && <p className={ui.panelSubtitle}>{panel.subtitle}</p>}
        </div>
        <div className={styles.panelTools}>
          {ok && (chartable || panel.kind === "parts") && (
            <IconButton size="sm" label={view === "chart" ? "Show as a table" : "Show as a chart"} icon={view === "chart" ? Table2 : BarChart3} onClick={() => setView(view === "chart" ? "table" : "chart")} aria-pressed={view === "table"} />
          )}
          {panel.target && onNavigate && <IconButton size="sm" label="Open the records" icon={ArrowUpRight} onClick={() => onNavigate(panel.target!)} />}
        </div>
      </div>
      <div className={panel.kind === "list" || panel.kind === "table" || (view === "table" && ok) ? styles.panelBodyFlush : styles.panelBody}>{body}</div>
      {ok && panel.note && <p className={styles.panelNote}>{panel.note}</p>}
    </section>
  );
}
