"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Lock, Table2 } from "lucide-react";
import type { Panel } from "@/server/dashboards/types";
import { Badge, EmptyState, IconButton, cx, ui } from "@/design/redesign/ui";
import { EChart, PALETTE, barOption, heatmapOption, lineOption, useChartMode } from "./charts";
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
    default:
      return null;
  }
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
  const chartable = panel.kind === "bar" || panel.kind === "line" || panel.kind === "heatmap";
  const ok = panel.state === "ok";

  const option = useMemo(() => {
    const common = { mode, format, currency, label: panel.title };
    if (panel.kind === "bar") return barOption({ ...common, categories: panel.categories, series: panel.series, horizontal: panel.horizontal });
    if (panel.kind === "line") return lineOption({ ...common, categories: panel.categories, series: panel.series });
    if (panel.kind === "heatmap") return heatmapOption({ ...common, x: panel.x, y: panel.y, cells: panel.cells });
    return null;
  }, [panel, mode, format, currency]);

  const height = panel.kind === "bar" && panel.horizontal ? Math.max(180, Math.min(420, panel.categories.length * 32 + 48)) : panel.kind === "heatmap" ? Math.max(220, panel.kind === "heatmap" ? panel.y.length * 36 + 80 : 0) : 260;

  let body;
  if (panel.state === "forbidden") body = <EmptyState icon={Lock} title="Not available for your role">{panel.emptyMessage}</EmptyState>;
  else if (panel.state === "unavailable") body = <EmptyState title="Could not be loaded">This source could not be read. The rest of the dashboard is unaffected; try again later.</EmptyState>;
  else if (!ok) body = <EmptyState title="Nothing to show yet">{panel.emptyMessage}</EmptyState>;
  else if (chartable && view === "table" && table) body = <DataTable table={table} currency={currency} />;
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
    </section>
  );
}
