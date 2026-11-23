"use client";

import { useState } from "react";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import { useTranslation } from "@/context/I18nContext";
import { getJson } from "@/lib/client-api";
import { ANALYTICS_PERIODS, type AnalyticsPeriod, type WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { downloadCSV, downloadPrintableDocument, downloadXLSX } from "@/utils/exportUtils";
import { CardHeader, NS, Notice, reasonText, useFormat } from "./AnalyticsParts";
import { REPORT_METRICS, buildReportRows, type ReportMetric } from "./report-rows";
import { insightsPath } from "./useWorkforceInsights";
import styles from "../AnalyticsView.module.css";

type Toast = (title: string, message: string, type?: string) => void;

/** downloadPrintableDocument interpolates raw HTML, so database text is escaped before it reaches it. */
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const METRIC_LABELS: Record<ReportMetric, [string, string]> = {
  headcount: ["text_headcount_attrition", "Headcount & Attrition"],
  compensation: ["text_gross_ctc_wage_distribution", "Gross CTC & Wage Distribution"],
  attendance: ["text_attendance_shift_overtime", "Attendance & Shift Overtime"],
  leaves: ["text_leave_accruals_balance", "Leave Accruals & Balance"],
  mci_capability: ["text_multiplier_capability_index_mci", "Multiplier Capability Index (MCI)"],
};

export const PERIOD_LABELS: Record<AnalyticsPeriod, [string, string]> = {
  current_month: ["text_current_month_mtd", "Current Month (MTD)"],
  current_quarter: ["text_current_quarter_qtd", "Current Quarter (QTD)"],
  ytd: ["text_year_to_date_ytd", "Year to Date (YTD)"],
  last_12_months: ["text_last_12_rolling_months", "Last 12 Rolling Months"],
};

/** Custom report builder: the export is built from GET /api/v1/analytics/workforce-insights for the chosen scope. */
export default function CustomReportTab({ departments, showToast }: { departments: string[]; showToast: Toast }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [department, setDepartment] = useState("");
  const [metric, setMetric] = useState<ReportMetric>("headcount");
  const [period, setPeriod] = useState<AnalyticsPeriod>("current_quarter");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportReport = async (format: "csv" | "xlsx" | "pdf") => {
    setPending(format);
    setError(null);
    try {
      const body = (await getJson(insightsPath(period, department || null))) as { data?: WorkforceInsightsPayload };
      if (!body?.data) throw new Error(t(`${NS}.error_report_load`, "The report data could not be loaded."));
      const { headers, rows } = buildReportRows(body.data, metric, t, { ...f, reason: (reason) => reasonText(t, reason) });
      const scope = (department || "all").replace(/[^A-Za-z0-9_-]+/g, "_");
      const filename = `Nucleus_${scope}_${metric}_${period}`;
      const metricLabel = t(`${NS}.${METRIC_LABELS[metric][0]}`, METRIC_LABELS[metric][1]);
      const departmentLabel = department || t(`${NS}.text_all_departments`, "All Departments");
      let result: { success?: boolean; message?: string } | undefined;
      if (format === "csv") result = downloadCSV(`${filename}.csv`, headers, rows);
      else if (format === "xlsx") result = downloadXLSX(`${filename}.xlsx`, headers, rows, t(`${NS}.text_sheet_name`, "Workforce Analytics"));
      else {
        const meta: Record<string, string> = {
          [t(`${NS}.text_department_scope`, "Department Scope")]: departmentLabel,
          [t(`${NS}.text_primary_metric`, "Primary Metric")]: metricLabel,
          [t(`${NS}.text_date_range`, "Date Range")]: `${body.data.window.from} – ${body.data.window.to}`,
          [t(`${NS}.text_generated`, "Generated")]: f.date(body.data.generatedAt),
        };
        downloadPrintableDocument(
          escapeHtml(t(`${NS}.text_pdf_title`, "Workforce Intelligence Report: {department} - {metric}", { department: departmentLabel, metric: metricLabel })),
          Object.fromEntries(Object.entries(meta).map(([key, value]) => [escapeHtml(key), escapeHtml(value)])),
          headers.map(escapeHtml),
          rows.map((row) => row.map(escapeHtml)),
        );
      }
      if (result && result.success === false) {
        setError(result.message ?? t(`${NS}.error_export_failed`, "The report could not be exported."));
        return;
      }
      showToast(t(`${NS}.toast_report_downloaded`, "Report Downloaded"), `${filename}.${format}`, "success");
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t(`${NS}.error_export_failed`, "The report could not be exported."));
    } finally {
      setPending(null);
    }
  };

  const exportButton = (format: "csv" | "xlsx" | "pdf", key: string, fallback: string, primary = false) => (
    <button type="button" className={primary ? styles.btnPrimary : styles.btnSecondary} disabled={pending !== null} onClick={() => void exportReport(format)}>
      <DownloadOutlined sx={{ fontSize: 16 }} />
      {pending === format ? t(`${NS}.text_exporting`, "Exporting...") : t(`${NS}.${key}`, fallback)}
    </button>
  );

  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <CardHeader icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_dynamic_enterprise_report_generator`, "Dynamic Enterprise Report Generator")} />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="analytics-report-department">{t(`${NS}.text_department_scope`, "Department Scope")}</label>
            <select id="analytics-report-department" className={styles.select} value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">{t(`${NS}.text_all_departments`, "All Departments")}</option>
              {departments.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="analytics-report-metric">{t(`${NS}.text_primary_metric`, "Primary Metric")}</label>
            <select id="analytics-report-metric" className={styles.select} value={metric} onChange={(e) => setMetric(e.target.value as ReportMetric)}>
              {REPORT_METRICS.map((key) => <option key={key} value={key}>{t(`${NS}.${METRIC_LABELS[key][0]}`, METRIC_LABELS[key][1])}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="analytics-report-period">{t(`${NS}.text_date_range`, "Date Range")}</label>
            <select id="analytics-report-period" className={styles.select} value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}>
              {ANALYTICS_PERIODS.map((key) => <option key={key} value={key}>{t(`${NS}.${PERIOD_LABELS[key][0]}`, PERIOD_LABELS[key][1])}</option>)}
            </select>
          </div>
        </div>
        {departments.length === 0 && <Notice>{t(`${NS}.text_no_departments`, "No departments are set up yet, so reports cover the whole organisation.")}</Notice>}
        {error && <Notice error>{error}</Notice>}
        <div className={styles.actionRow} style={{ marginBlockStart: "1rem" }}>
          {exportButton("csv", "text_export_csv", "Export CSV", true)}
          {exportButton("xlsx", "text_export_excel_xlsx", "Export Excel (XLSX)")}
          {exportButton("pdf", "text_export_pdf_summary", "Export PDF Summary")}
        </div>
      </section>
    </div>
  );
}
