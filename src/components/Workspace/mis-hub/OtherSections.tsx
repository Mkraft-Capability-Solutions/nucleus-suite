"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Database, UploadCloud } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import type { ImportCheck } from "./importCheck";
import { label, type LabelKey } from "./labels";
import styles from "../MisReportingHub.module.css";

type Section = "report" | "catalogue" | "sources" | "quality" | "risk";

const CATALOGUE: Array<{ title: LabelKey; body: LabelKey; target: Section; reason?: LabelKey }> = [
  { title: "catExecutive", body: "catExecutiveBody", target: "report" },
  { title: "catAttendance", body: "catAttendanceBody", target: "report" },
  { title: "catPayroll", body: "catPayrollBody", target: "report", reason: "catPayrollReason" },
  { title: "catPerformance", body: "catPerformanceBody", target: "risk", reason: "riskUnavailable" },
];

export function CatalogueSection({ onOpen }: { onOpen: (s: Section) => void }) {
  const { t } = useTranslation();
  return (
    <section className={styles.cardsGrid}>
      {CATALOGUE.map((c) => (
        <article key={c.title} className={styles.catalogueCard}>
          <Database size={18} aria-hidden="true" />
          <div>
            <h2>{label(t, c.title)}</h2>
            <p>{label(t, c.body)}</p>
            <span className={styles.status} title={c.reason ? label(t, c.reason) : undefined}>
              {label(t, c.reason ? "unavailable" : "catAvailable")}
            </span>
          </div>
          <button type="button" onClick={() => onOpen(c.target)}>{label(t, "open")}<ChevronRight size={15} aria-hidden="true" /></button>
        </article>
      ))}
    </section>
  );
}

type SourcesProps = { from: string; to: string; rows: number; employees: number; loadedAt: Date | null; onImport: () => void };

export function SourcesSection({ from, to, rows, employees, loadedAt, onImport }: SourcesProps) {
  const { t, locale } = useTranslation();
  return (
    <section className={styles.tableCard}>
      <div className={styles.cardTitle}>
        <div><h2>{label(t, "sourcesTitle")}</h2><p>{label(t, "sourcesHint")}</p></div>
        <button className={styles.secondaryButton} type="button" onClick={onImport}><UploadCloud size={15} aria-hidden="true" />{label(t, "importFile")}</button>
      </div>
      <div className={styles.runList}>
        <article className={styles.runItem}>
          <div><strong>{label(t, "sourceTeamHistory")}</strong><span>{label(t, "period", { from, to })}</span></div>
          <div><span>{label(t, "sourceRows", { rows, employees })}</span></div>
          {loadedAt && <time dateTime={loadedAt.toISOString()}>{label(t, "loadedAt", { time: loadedAt.toLocaleString(locale) })}</time>}
        </article>
      </div>
    </section>
  );
}

export function QualitySection({ check }: { check: ImportCheck | null }) {
  const { t } = useTranslation();
  return (
    <section className={styles.qualityLayout}>
      <article className={styles.qualitySummary}>
        <CheckCircle2 size={20} aria-hidden="true" />
        <div>
          <h2>{label(t, "qualityTitle")}</h2>
          <p>{check ? label(t, "qualityResult", { file: check.file, accepted: check.accepted, rejected: check.rejected.length }) : label(t, "qualityEmpty")}</p>
          {check && <p role="note">{label(t, "qualityPublishBlocked")}</p>}
        </div>
      </article>
      {check && check.rejected.length > 0 && (
        <ul className={styles.issueList}>
          {check.rejected.slice(0, 200).map((r) => (
            <li key={r.row}><AlertTriangle size={14} aria-hidden="true" /><strong>{label(t, "qualityRow", { row: r.row })}</strong> {r.issues.join(" ")}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RiskSection() {
  const { t } = useTranslation();
  return (
    <section className={styles.tableCard}>
      <div className={styles.cardTitle}><div><h2>{label(t, "tabRisk")}</h2><p role="note">{label(t, "riskUnavailable")}</p></div></div>
    </section>
  );
}

export type { Section };
