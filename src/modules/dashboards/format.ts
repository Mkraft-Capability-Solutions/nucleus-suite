/** Number formatting for dashboard values (stat tiles, axes, tooltips, tables). */

export type ValueFormat = "count" | "percent" | "hours" | "days" | "money" | "decimal" | "years" | "text" | "date";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value;
}

/** Full value: tables, tooltips. */
export function formatValue(value: number | string | null | undefined, format: ValueFormat = "count", currency = "INR"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return format === "date" ? formatDate(value) : value;
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "percent": return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
    case "hours": return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} h`;
    case "days": return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${value === 1 ? "day" : "days"}`;
    case "years": return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${value === 1 ? "yr" : "yrs"}`;
    case "money": return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    case "decimal": return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    default: return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
}

/** Compact value for stat tiles and axes: 1,284 · 12.9K · ₹4.2M. Small values stay in full. */
export function formatCompact(value: number | string | null | undefined, format: ValueFormat = "count", currency = "INR"): string {
  if (typeof value !== "number" || Math.abs(value) < 10_000) return formatValue(value, format, currency);
  if (format === "money") return new Intl.NumberFormat("en-IN", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (format === "count" || format === "decimal") return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return formatValue(value, format, currency);
}
