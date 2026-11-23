"use client";

import { Download, FileText, PieChart, ShieldCheck, Sparkles } from "lucide-react";
import { downloadPrintableDocument } from "@/utils/exportUtils";
import { formatDate, formatMoney, formatPeriod, type Resource } from "./payroll-client";
import { getPayslipDetail } from "./payroll-api";
import { advanceBlockedReason, obligationStatusLabel, payslipStateLabel } from "./payroll-labels";
import { DataState, NS, Unavailable, usePayrollT } from "./PayrollParts";
import EwaCard from "./EwaCard";
import type { ComplianceObligation, PayrollOverview, PayslipDetail, PayslipSummary } from "./payroll-types";
import styles from "../PayrollView.module.css";

type Props = {
  overview: Resource<PayrollOverview>;
  obligations: Resource<ComplianceObligation[]>;
  packLabel: string | null;
  onReload: () => void;
  onOpenControlRoom: (() => void) | null;
  notify: (title: string, message: string, tone: "success" | "error" | "info") => void;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export default function PayrollOverviewTab({ overview, obligations, packLabel, onReload, onOpenControlRoom, notify }: Props) {
  const { t, locale } = usePayrollT();
  const money = (minor: number, currency: string) => formatMoney(minor, currency, locale);

  const printPayslip = async (summary: PayslipSummary) => {
    const result = await getPayslipDetail(summary.id);
    if (!result.ok || !result.data) {
      notify(t(`${NS}.text_payslip_title`, "Payslip"), result.message, "error");
      return;
    }
    const detail: PayslipDetail = result.data;
    const row = (label: string, kind: string, minor: number) => [escapeHtml(label), escapeHtml(kind), escapeHtml(money(minor, detail.currency))];
    downloadPrintableDocument(
      `Payslip_${detail.period}_${detail.employeeCode}`,
      {
        [escapeHtml(t(`${NS}.text_period`, "Period"))]: escapeHtml(formatPeriod(detail.period, locale) ?? detail.period),
        [escapeHtml(t(`${NS}.text_employee_name`, "Employee name"))]: escapeHtml(detail.employeeName),
        [escapeHtml(t(`${NS}.text_employee_code`, "Employee code"))]: escapeHtml(detail.employeeCode),
        [escapeHtml(t(`${NS}.text_payslip_code`, "Payslip"))]: escapeHtml(detail.displayCode),
        [escapeHtml(t(`${NS}.text_gross_pay`, "Gross pay"))]: escapeHtml(money(detail.lines.earningsMinor, detail.currency)),
        [escapeHtml(t(`${NS}.text_net_pay`, "Net pay"))]: escapeHtml(money(detail.lines.netMinor, detail.currency)),
      },
      [t(`${NS}.text_component`, "Component"), t(`${NS}.text_type`, "Type"), t(`${NS}.text_amount`, "Amount")].map(escapeHtml),
      [
        ...detail.lines.earnings.map((line) => row(line.label, t(`${NS}.text_earning`, "Earning"), line.amountMinor)),
        ...detail.lines.deductions.map((line) => row(line.label, t(`${NS}.text_deduction`, "Deduction"), line.amountMinor)),
        ...detail.lines.informational.map((line) => row(line.label, t(`${NS}.text_information`, "Information"), line.amountMinor)),
        row(t(`${NS}.text_net_take_home`, "Net take-home pay"), t(`${NS}.text_net_pay`, "Net pay"), detail.lines.netMinor),
      ],
    );
  };

  return (
    <DataState resource={overview} onRetry={onReload}>
      {(data) => {
        const slip = data.latestPayslip;
        const audit = data.runAudit;
        const auditText = audit
          ? audit.openAnomalies > 0
            ? t(`${NS}.text_audit_open`, "{count} open findings on the {period} run need review before it can be finalised.", { count: audit.openAnomalies, period: formatPeriod(audit.period, locale) ?? audit.period })
            : t(`${NS}.text_audit_clear`, "No open findings on the {period} run ({total} reviewed).", { total: audit.totalAnomalies, period: formatPeriod(audit.period, locale) ?? audit.period })
          : t(`${NS}.text_audit_unavailable`, "The pre-payroll audit is shown to payroll administrators once a run exists.");
        return (
          <>
            <div className={styles.aiAuditBanner}>
              <div className={styles.row}>
                <Sparkles size={22} aria-hidden="true" />
                <div>
                  <strong>{t(`${NS}.text_audit_title`, "Pre-payroll audit")}</strong>
                  <div className={styles.muted}>{auditText}</div>
                </div>
              </div>
              {onOpenControlRoom && (
                <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={onOpenControlRoom}>
                  {t(`${NS}.text_view_audit`, "View audit report")}
                </button>
              )}
            </div>

            {!data.employee && data.employeeUnavailableReason && <div className={styles.stateBox} role="note">{data.employeeUnavailableReason}</div>}

            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>{t(`${NS}.text_latest_net`, "Latest net disbursal")}</span>
                <span className={styles.statValue}>{slip ? money(slip.netMinor, slip.currency) : <Unavailable reason={t(`${NS}.text_no_payslip`, "No payslip has been generated for you yet.")} />}</span>
                {slip && <span className={styles.statSub}>{t(`${NS}.text_payslip_of`, "Payslip for {period}", { period: formatPeriod(slip.period, locale) ?? slip.period })}</span>}
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>{t(`${NS}.text_next_payday`, "Next scheduled payday")}</span>
                <span className={styles.statValue}>{formatDate(data.nextPayDate, locale) ?? <Unavailable reason={t(`${NS}.text_no_open_run`, "No open payroll run has a pay date yet.")} />}</span>
                <span className={styles.statSub}>{t(`${NS}.text_next_payday_sub`, "Pay date of the next open run")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>{t(`${NS}.text_available_ewa`, "Available EWA balance")}</span>
                <span className={styles.statValue}>
                  {data.advanceAllowance?.available
                    ? money(data.advanceAllowance.limitMinor ?? 0, data.advanceAllowance.currency ?? "INR")
                    : <Unavailable reason={data.advanceAllowance ? advanceBlockedReason(t, data.advanceAllowance.reason) : (data.employeeUnavailableReason ?? "")} />}
                </span>
                <span className={styles.statSub}>{t(`${NS}.text_ewa_rule`, "Capped at one month of basic salary")}</span>
              </div>
            </div>

            <div className={styles.mainGrid}>
              <div className={styles.leftCol}>
                <section className={styles.card} aria-labelledby="payroll-g2n">
                  <div className={styles.cardHeader}>
                    <h3 id="payroll-g2n"><PieChart size={18} aria-hidden="true" />{t(`${NS}.text_gross_to_net`, "Gross-to-net breakdown")}</h3>
                    {packLabel && <span className={styles.micro}>{t(`${NS}.text_active_pack`, "Entity: {name}", { name: packLabel })}</span>}
                  </div>
                  {!slip ? (
                    <div className={styles.stateBox} role="note">{t(`${NS}.text_no_payslip`, "No payslip has been generated for you yet.")}</div>
                  ) : (
                    <>
                      {slip.lines.earnings.map((line) => (
                        <div key={`e-${line.code}`} className={styles.earningRow}>
                          <span className={styles.earnLabel}>{line.label}</span>
                          <span className={styles.earnVal}>{money(line.amountMinor, slip.currency)}</span>
                        </div>
                      ))}
                      {slip.lines.deductions.map((line) => (
                        <div key={`d-${line.code}`} className={styles.earningRow}>
                          <span className={`${styles.earnLabel} ${styles.deduction}`}>{t(`${NS}.text_minus_label`, "(−) {label}", { label: line.label })}</span>
                          <span className={`${styles.earnVal} ${styles.deduction}`}>{money(-line.amountMinor, slip.currency)}</span>
                        </div>
                      ))}
                      <div className={`${styles.earningRow} ${styles.totalRow}`}>
                        <strong>{t(`${NS}.text_net_take_home`, "Net take-home pay")}</strong>
                        <strong className={styles.positive}>{money(slip.lines.netMinor, slip.currency)}</strong>
                      </div>
                    </>
                  )}
                </section>
                <EwaCard overview={data} onSaved={onReload} notify={notify} />
              </div>

              <div className={styles.rightCol}>
                <section className={styles.card} aria-labelledby="payroll-vault">
                  <div className={styles.cardHeader}>
                    <h3 id="payroll-vault"><FileText size={18} aria-hidden="true" />{t(`${NS}.text_payslip_vault`, "Payslip vault")}</h3>
                  </div>
                  {data.payslips.length === 0 ? (
                    <div className={styles.stateBox} role="note">{t(`${NS}.text_no_payslip`, "No payslip has been generated for you yet.")}</div>
                  ) : data.payslips.map((item) => (
                    <div key={item.id} className={styles.payslipItem}>
                      <div>
                        <strong className={styles.strongText}>{formatPeriod(item.period, locale) ?? item.period}</strong>
                        <div className={styles.micro}>{t(`${NS}.text_payslip_meta`, "{code} · net {net} · {state}", { code: item.displayCode, net: money(item.netMinor, item.currency), state: payslipStateLabel(t, item.state) })}</div>
                      </div>
                      <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => void printPayslip(item)} aria-label={t(`${NS}.text_download_payslip_for`, "Download payslip for {period}", { period: formatPeriod(item.period, locale) ?? item.period })}>
                        <Download size={14} aria-hidden="true" />{t(`${NS}.text_pdf`, "PDF")}
                      </button>
                    </div>
                  ))}
                </section>

                <section className={styles.card} aria-labelledby="payroll-statutory">
                  <div className={styles.cardHeader}>
                    <h3 id="payroll-statutory"><ShieldCheck size={18} aria-hidden="true" />{t(`${NS}.text_statutory_packs`, "Statutory compliance packs")}</h3>
                  </div>
                  <p className={styles.muted}>{t(`${NS}.text_statutory_intro`, "Statutory filings scheduled on the compliance calendar.")}</p>
                  <DataState resource={obligations} isEmpty={(rows) => rows.length === 0} emptyText={t(`${NS}.text_no_obligations`, "No statutory filing is scheduled on the compliance calendar.")}>
                    {(rows) => (
                      <div className={styles.stackTight}>
                        {rows.slice(0, 6).map((row) => (
                          <div key={row.id} className={styles.complianceItem}>
                            <span>{row.attributes.title ?? row.attributes.form_code ?? "—"}</span>
                            <span className={styles.numeric}>
                              {obligationStatusLabel(t, row.attributes.status ?? "scheduled")}
                              {row.attributes.due_date ? ` · ${formatDate(row.attributes.due_date, locale) ?? ""}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </DataState>
                </section>
              </div>
            </div>
          </>
        );
      }}
    </DataState>
  );
}
