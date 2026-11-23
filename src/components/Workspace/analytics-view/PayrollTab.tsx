"use client";

import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { Badge, CardHeader, NS, Notice, StatCard, reasonText, sectionReason, useFormat } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

type Props = { data: WorkforceInsightsPayload; onNavigate?: (tab: string, sub?: string) => void };

export default function PayrollTab({ data, onNavigate }: Props) {
  const { t } = useTranslation();
  const f = useFormat();
  const { payroll } = data;
  const reason = sectionReason(t, payroll);
  const p = payroll.available ? payroll.value : null;
  const money = (minor: number) => (p ? f.money(minor, p.currency) : "");

  return (
    <div className={styles.panel}>
      <div className={styles.statsGrid}>
        <StatCard icon={<AccountBalanceWalletOutlined />} tone="signal" label={t(`${NS}.text_monthly_gross_wage_bill`, "Monthly Gross Wage Bill")}
          value={p ? money(p.grossMinor) : null} reason={reason} />
        <StatCard icon={<SecurityOutlined />} tone="ok" label={t(`${NS}.text_50_basic_wage_compliance_2026_code`, "50% Basic Wage Compliance (2026 Code)")}
          value={p && p.basicWageCompliance !== null ? f.pct(p.basicWageCompliance) : null} reason={reason ?? reasonText(t, "no_payroll_lines")} />
        <StatCard icon={<TrendingUpOutlined />} tone="info" label={t(`${NS}.text_statutory_pf_esi_liability`, "Statutory PF / ESI Liability")}
          value={p ? money(p.statutoryMinor) : null} reason={reason} />
        <StatCard icon={<SpeedOutlined />} tone="pending" label={t(`${NS}.text_earned_wage_access_ewa_drawdown`, "Earned Wage Access (EWA) Drawdown")}
          value={p && p.advanceDrawdown !== null ? f.pct(p.advanceDrawdown) : null} reason={reason} />
      </div>

      <section className={styles.card}>
        <CardHeader icon={<AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_monthly_wage_bill_bridge_mom_variance`, "Monthly Wage Bill Bridge (MoM Variance)")}
          badge={
            <span className={styles.actionRow}>
              {p ? <Badge tone="info">{t(`${NS}.text_payroll_period`, "Run period {period} · {count} employees", { period: p.period, count: f.number(p.employees) })}</Badge> : null}
              <button type="button" className={styles.btnSecondary} onClick={() => onNavigate?.("payroll", "payroll_finance")}>
                {t(`${NS}.text_open_payroll_room`, "Open Payroll Room")}
              </button>
            </span>
          } />
        {!p ? (
          <Notice>{reason}</Notice>
        ) : !p.bridge.available ? (
          <Notice>{reasonText(t, p.bridge.reason)}</Notice>
        ) : (
          <div className={styles.list} style={{ gap: "0.75rem" }}>
            <div className={styles.bridgeRow}>
              <span>{t(`${NS}.text_previous_month_base_bill_period`, "Previous Month Base Bill ({period})", { period: p.bridge.value.priorPeriod })}</span>
              <strong>{money(p.bridge.value.priorGrossMinor)}</strong>
            </div>
            <div className={`${styles.bridgeRow} ${styles.bridgeUp}`}>
              <span>{t(`${NS}.text_new_hires_joined`, "+ New Hires Joined")}</span>
              <strong>{money(p.bridge.value.joinersMinor)}</strong>
            </div>
            <div className={`${styles.bridgeRow} ${p.bridge.value.continuingChangeMinor < 0 ? styles.bridgeDown : styles.bridgeUp}`}>
              <span>{t(`${NS}.text_promotion_ctc_increments_continuing`, "± Promotion, CTC & pay changes (continuing employees)")}</span>
              <strong>{money(p.bridge.value.continuingChangeMinor)}</strong>
            </div>
            <div className={`${styles.bridgeRow} ${styles.bridgeDown}`}>
              <span>{t(`${NS}.text_-_offboarding_exits_settled_ff`, "- Offboarding Exits & Settled F&F")}</span>
              <strong>{money(-p.bridge.value.leaversMinor)}</strong>
            </div>
            <div className={`${styles.bridgeRow} ${styles.bridgeTotal}`}>
              <span>{t(`${NS}.text_current_gross_wage_bill`, "Current Gross Wage Bill")}</span>
              <span>{money(p.grossMinor)}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
