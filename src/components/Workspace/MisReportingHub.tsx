"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { aggregate, csvCell, monthToDate, type MisRecord } from "./mis-hub/data";
import { checkImportFile, ImportCheckError, type ImportCheck } from "./mis-hub/importCheck";
import { label, type LabelKey } from "./mis-hub/labels";
import { CatalogueSection, QualitySection, RiskSection, SourcesSection, type Section } from "./mis-hub/OtherSections";
import ReportSection from "./mis-hub/ReportSection";
import { useTeamHistory } from "./mis-hub/useTeamHistory";
import styles from "./MisReportingHub.module.css";

type Toast = (title: string, message: string, type?: string) => void;
type Props = { showToast?: Toast; onNavigate?: (tab: string, sub?: string) => void; setMisMasterData?: unknown };

const TABS: Array<[Section, LabelKey]> = [
  ["report", "tabReport"], ["catalogue", "tabCatalogue"], ["sources", "tabSources"], ["quality", "tabQuality"], ["risk", "tabRisk"],
];
const COLUMNS: LabelKey[] = ["colEmpId", "colName", "colDept", "colLocation", "colDays", "colAttendance", "colOvertime", "colBasic"];

/** MIS hub over recorded attendance/OT/basic salary (GET /api/v1/reports/team-history); no demo rows. */
export default function MisReportingHub({ showToast }: Props) {
  const { t, locale } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState(() => monthToDate(new Date()));
  const [section, setSection] = useState<Section>("report");
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [events, setEvents] = useState<Array<{ id: number; at: Date; text: string }>>([]);
  const { state, reload } = useTeamHistory(period.from, period.to);
  const records = useMemo(() => (state.status === "ready" ? aggregate(state.data.rows) : []), [state]);
  const masked = state.status === "ready" ? state.data.compensationMasked : true;

  const log = (text: string) => setEvents((list) => [{ id: Date.now() + list.length, at: new Date(), text }, ...list].slice(0, 20));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await checkImportFile(file, period);
      setCheck(result);
      setSection("quality");
      log(label(t, "eventChecked", { file: file.name }));
      showToast?.(label(t, "importChecked"), label(t, "qualityResult", { file: result.file, accepted: result.accepted, rejected: result.rejected.length }), "info");
    } catch (error) {
      const message = error instanceof ImportCheckError ? label(t, error.key) : error instanceof Error ? error.message : "";
      showToast?.(label(t, "importFailed"), message, "error");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onExport = async (format: "csv" | "xlsx", rows: MisRecord[]) => {
    try {
      const header = COLUMNS.map((k) => label(t, k));
      const body = rows.map((r) => [r.empId, r.name, r.dept, r.location, r.recordedDays, r.attendancePct, r.overtimeHrs, masked ? label(t, "restricted") : r.basicSalary]);
      const filename = `Nucleus_MIS_Report_${period.from}_${period.to}`;
      if (format === "xlsx") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...body]), "MIS");
        XLSX.writeFileXLSX(workbook, `${filename}.xlsx`);
      } else {
        const content = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
        link.download = `${filename}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
      log(label(t, "eventExported", { format: format.toUpperCase() }));
      showToast?.(label(t, "exportDone"), label(t, "exportDoneBody", { format: format.toUpperCase(), count: rows.length }), "success");
    } catch {
      showToast?.(label(t, "exportFailed"), label(t, "exportFailedBody"), "error");
    }
  };

  return (
    <section className={styles.page} aria-labelledby="mis-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{label(t, "eyebrow")}</span>
          <h1 id="mis-title">{label(t, "title")}</h1>
          <p>{label(t, "period", { from: period.from, to: period.to })}</p>
          <div className={styles.contextGrid}>
            <label><span>{label(t, "from")}</span><input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))} /></label>
            <label><span>{label(t, "to")}</span><input type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))} /></label>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => fileInput.current?.click()}><UploadCloud size={15} aria-hidden="true" />{label(t, "importFile")}</button>
          <button className={styles.primaryButton} type="button" disabled={!records.length} onClick={() => onExport("xlsx", records)}><FileSpreadsheet size={15} aria-hidden="true" />{label(t, "exportXlsx")}</button>
          <input ref={fileInput} className={styles.hiddenInput} type="file" accept=".csv,.xlsx,.xls" aria-label={label(t, "importFile")} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </header>
      <nav className={styles.tabs} aria-label={label(t, "sections")}>
        {TABS.map(([id, key]) => (
          <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)} className={section === id ? styles.activeTab : ""}>{label(t, key)}</button>
        ))}
      </nav>

      {section === "report" && (state.status === "ready" ? (
        <ReportSection records={records} masked={masked} onExport={onExport} />
      ) : (
        <section className={styles.tableCard} role={state.status === "error" ? "alert" : "status"}>
          <p className={styles.empty}>{state.status === "loading" ? label(t, "loading") : `${label(t, "loadError")} ${state.message}`.trim()}</p>
          {state.status === "error" && <button type="button" className={styles.secondaryButton} onClick={reload}>{label(t, "retry")}</button>}
        </section>
      ))}
      {section === "catalogue" && <CatalogueSection onOpen={setSection} />}
      {section === "sources" && (
        <SourcesSection
          from={period.from}
          to={period.to}
          rows={state.status === "ready" ? state.data.rows.length : 0}
          employees={records.length}
          loadedAt={state.status === "ready" ? state.loadedAt : null}
          onImport={() => fileInput.current?.click()}
        />
      )}
      {section === "quality" && <QualitySection check={check} />}
      {section === "risk" && <RiskSection />}

      <section className={styles.auditStrip}>
        <strong>{label(t, "auditTitle")}</strong>
        {(events.length ? events : [{ id: 0, at: null, text: label(t, "eventOpened", { from: period.from, to: period.to }) }]).slice(0, 3).map((e) => (
          <span key={e.id}>{e.at ? `${e.at.toLocaleTimeString(locale)} · ` : ""}{e.text}</span>
        ))}
      </section>
    </section>
  );
}
