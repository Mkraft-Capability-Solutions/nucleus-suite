"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Filter, Search, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { filterRecords, summarize, type MisRecord } from "./data";
import { label } from "./labels";
import styles from "../MisReportingHub.module.css";

type Props = {
  records: MisRecord[];
  masked: boolean;
  onExport: (format: "csv" | "xlsx", rows: MisRecord[]) => void;
};

export default function ReportSection({ records, masked, onExport }: Props) {
  const { t, locale } = useTranslation();
  const [dept, setDept] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MisRecord | null>(null);
  const departments = useMemo(() => [...new Set(records.map((r) => r.dept ?? ""))].sort(), [records]);
  const rows = useMemo(() => filterRecords(records, dept, query), [records, dept, query]);
  const summary = summarize(rows);
  const money = (v: number | null) => (masked ? label(t, "restricted") : v === null ? label(t, "notRecorded") : v.toLocaleString(locale));
  const pct = (v: number | null) => (v === null ? label(t, "notRecorded") : label(t, "percent", { value: v }));
  const deptName = (d: string | null) => d || label(t, "noDepartment");

  return (
    <>
      <section className={styles.scopeBar}>
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          <strong>{label(t, "scopeTitle")}</strong>
          <span>{label(t, "scopeBody")} {masked ? label(t, "compensationMasked") : label(t, "ctcUnavailable")}</span>
        </div>
      </section>
      <div className={styles.kpis}>
        <article><span>{label(t, "kpiEmployees")}</span><strong>{summary.total}</strong><small>{label(t, "kpiEmployeesHint")}</small></article>
        <article><span>{label(t, "kpiAttendance")}</span><strong>{pct(summary.averageAttendance)}</strong><small>{label(t, "kpiAttendanceHint", { count: summary.withAttendance })}</small></article>
        <article><span>{label(t, "kpiOvertime")}</span><strong>{label(t, "hours", { value: summary.totalOvertime })}</strong><small>{label(t, "kpiOvertimeHint")}</small></article>
        <article><span>{label(t, "kpiRisk")}</span><strong>{label(t, "unavailable")}</strong><small>{label(t, "riskUnavailable")}</small></article>
      </div>
      <section className={styles.filters}>
        <label>
          <Filter size={15} aria-hidden="true" />{label(t, "department")}
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">{label(t, "allDepartments")}</option>
            {departments.map((d) => <option key={d} value={d}>{deptName(d)}</option>)}
          </select>
        </label>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={label(t, "search")} aria-label={label(t, "search")} />
        </label>
        <button className={styles.secondaryButton} type="button" onClick={() => onExport("csv", rows)} disabled={!rows.length}>
          <Download size={15} aria-hidden="true" />{label(t, "exportCsv")}
        </button>
      </section>
      <section className={styles.tableCard}>
        <div className={styles.cardTitle}>
          <div><h2>{label(t, "tableTitle")}</h2><p>{label(t, "tableHint", { count: rows.length })}</p></div>
          <button className={styles.primaryButton} type="button" onClick={() => onExport("xlsx", rows)} disabled={!rows.length}>{label(t, "exportXlsx")}</button>
        </div>
        {rows.length === 0 ? (
          <p className={styles.empty}>{label(t, records.length ? "noMatches" : "empty")}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {(["colEmpId", "colName", "colDept", "colAttendance", "colOvertime", "colBasic", "colRating", "colRisk"] as const).map((k) => <th key={k} scope="col">{label(t, k)}</th>)}
                  <th scope="col"><span className={styles.hiddenInput}>{label(t, "view")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.empId}</td>
                    <td>{r.name}</td>
                    <td>{deptName(r.dept)}</td>
                    <td>{pct(r.attendancePct)}</td>
                    <td>{r.overtimeHrs}</td>
                    <td>{money(r.basicSalary)}</td>
                    <td title={label(t, "ratingUnavailable")}>{label(t, "unavailable")}</td>
                    <td title={label(t, "riskUnavailable")}>{label(t, "unavailable")}</td>
                    <td>
                      <button type="button" className={styles.iconBtn} onClick={() => setSelected(r)} aria-label={`${label(t, "view")} ${r.name}`}>
                        <Eye size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <div className={styles.drawerOverlay} onMouseDown={() => setSelected(null)}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={selected.name} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.cardTitle}>
              <div><h2>{selected.name}</h2><p>{selected.empId}</p></div>
              <button type="button" className={styles.iconBtn} onClick={() => setSelected(null)} aria-label={label(t, "close")}><X size={16} aria-hidden="true" /></button>
            </div>
            <dl className={styles.detailGrid}>
              <dt>{label(t, "colDept")}</dt><dd>{deptName(selected.dept)}</dd>
              <dt>{label(t, "colLocation")}</dt><dd>{selected.location ?? label(t, "notRecorded")}</dd>
              <dt>{label(t, "colDays")}</dt><dd>{selected.recordedDays}</dd>
              <dt>{label(t, "colAttendance")}</dt><dd>{pct(selected.attendancePct)}</dd>
              <dt>{label(t, "colOvertime")}</dt><dd>{selected.overtimeHrs}</dd>
              <dt>{label(t, "colBasic")}</dt><dd>{money(selected.basicSalary)}</dd>
              <dt>{label(t, "colRating")}</dt><dd>{label(t, "ratingUnavailable")}</dd>
              <dt>{label(t, "colRisk")}</dt><dd>{label(t, "riskUnavailable")}</dd>
            </dl>
          </aside>
        </div>
      )}
    </>
  );
}
