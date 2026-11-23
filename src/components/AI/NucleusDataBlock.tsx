"use client";

import { useTranslation } from "@/context/I18nContext";
import styles from "./NucleusDataBlock.module.css";

/**
 * Renders what an assistant tool returned, in the assistant panel: each availability envelope becomes a figure
 * with its origin, lists become compact tables, and an unavailable figure says so instead of showing a number.
 */

type Envelope = { available: boolean; value?: unknown; origin?: string; message?: string };
type Row = Record<string, unknown>;

const isEnvelope = (v: unknown): v is Envelope => typeof v === "object" && v !== null && "available" in v;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function formatScalar(value: unknown, locale: string): string {
  if (typeof value === "number") return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (value === null || value === undefined) return "—";
  if (isRecord(value)) {
    const parts = Object.values(value).filter((v) => v !== null && v !== undefined && typeof v !== "boolean" && !isRecord(v));
    return parts.length > 0 ? parts.map(String).join(" · ") : "—";
  }
  return String(value);
}

function RowsTable({ rows, locale }: { rows: Row[]; locale: string }) {
  const columns = Object.keys(rows[0] ?? {}).slice(0, 5);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((c) => <th key={c} scope="col">{humanize(c)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, i) => (
            <tr key={i}>{columns.map((c) => <td key={c}>{formatScalar(row[c], locale)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ label, envelope, locale, unavailableText }: { label: string; envelope: Envelope; locale: string; unavailableText: string }) {
  const { value } = envelope;
  if (!envelope.available || value === null || value === undefined) {
    return (
      <div className={`${styles.figure} ${styles.unavailable}`}>
        <span className={styles.label}>{label}</span>
        <span className={styles.note}>{envelope.message || unavailableText}</span>
      </div>
    );
  }
  if (Array.isArray(value) && value.every(isRecord)) {
    return (
      <div className={styles.figureWide}>
        <span className={styles.label}>{label}</span>
        <RowsTable rows={value as Row[]} locale={locale} />
        {envelope.origin && <span className={styles.origin}>{envelope.origin}</span>}
      </div>
    );
  }
  if (isRecord(value)) {
    return (
      <div className={styles.figureWide}>
        <span className={styles.label}>{label}</span>
        <dl className={styles.pairs}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k}><dt>{humanize(k)}</dt><dd>{formatScalar(v, locale)}</dd></div>
          ))}
        </dl>
        {envelope.origin && <span className={styles.origin}>{envelope.origin}</span>}
      </div>
    );
  }
  return (
    <div className={styles.figure}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{formatScalar(value, locale)}</span>
      {envelope.origin && <span className={styles.origin}>{envelope.origin}</span>}
    </div>
  );
}

export type NucleusDeepLink = { label: string; tab: string; domain?: string; sub: string };

const isDeepLink = (v: unknown): v is NucleusDeepLink =>
  isRecord(v) && typeof v.label === "string" && typeof v.tab === "string" && typeof v.sub === "string";

export function NucleusDataBlock({
  block,
  onNavigate,
}: {
  block: { tool: string; result: unknown };
  onNavigate?: (tab: string, domain?: string, sub?: string) => void;
}) {
  const { t, locale } = useTranslation() as { t: (key: string, fallback: string) => string; locale?: string };
  const lang = locale || "en";
  const unavailableText = t("components.AI.NucleusDataBlock.text_not_held", "The platform does not hold this figure yet.");
  const result = block.result;
  const allEntries = isRecord(result) ? Object.entries(result) : [];
  const actions = isRecord(result) && Array.isArray(result.actions) ? result.actions.filter(isDeepLink) : [];
  const entries = allEntries.filter(([key]) => key !== "actions");
  const figures = entries.filter(([, v]) => isEnvelope(v)) as Array<[string, Envelope]>;
  const lists = entries.filter(([, v]) => Array.isArray(v) && v.length > 0 && v.every(isRecord)) as Array<[string, Row[]]>;
  const directRows = Array.isArray(result) && result.every(isRecord) ? (result as Row[]) : null;

  return (
    <section className={styles.block} aria-label={humanize(block.tool)}>
      <header className={styles.head}>{humanize(block.tool)}</header>
      <div className={styles.grid}>
        {figures.map(([key, envelope]) => (
          <Figure key={key} label={humanize(key)} envelope={envelope} locale={lang} unavailableText={unavailableText} />
        ))}
      </div>
      {lists.map(([key, rows]) => (
        <div key={key} className={styles.figureWide}>
          <span className={styles.label}>{humanize(key)}</span>
          <RowsTable rows={rows} locale={lang} />
        </div>
      ))}
      {directRows && directRows.length > 0 && <RowsTable rows={directRows} locale={lang} />}
      {actions.length > 0 && onNavigate && (
        <div className={styles.actions}>
          {actions.map((action) => (
            <button
              key={`${action.tab}-${action.sub}`}
              type="button"
              className={styles.actionButton}
              onClick={() => onNavigate(action.tab, action.domain, action.sub)}
            >
              {t("components.AI.NucleusDataBlock.button_open", "Open {label}").replace("{label}", action.label)}
            </button>
          ))}
        </div>
      )}
      {figures.length === 0 && lists.length === 0 && !directRows && <p className={styles.note}>{t("components.AI.NucleusDataBlock.text_no_rows", "No records matched.")}</p>}
    </section>
  );
}

export default NucleusDataBlock;
