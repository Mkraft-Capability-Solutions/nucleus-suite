"use client";

import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { CardHeader, NS, Notice, StatCard, sectionReason, useFormat } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

type Props = { data: WorkforceInsightsPayload; onNavigate?: (tab: string, sub?: string) => void };

export default function WorkforceTab({ data, onNavigate }: Props) {
  const { t } = useTranslation();
  const f = useFormat();
  const { workforce, capability } = data;
  const reason = sectionReason(t, workforce);
  const w = workforce.available ? workforce.value : null;
  const metricOr = (value: number | null | undefined, render: (v: number) => string) => (value === null || value === undefined ? null : render(value));

  return (
    <div className={styles.panel}>
      <div className={styles.statsGrid}>
        <StatCard icon={<AccessTimeOutlined />} tone="signal" label={t(`${NS}.text_shift_capacity_utilization`, "Shift Capacity Utilization")}
          value={metricOr(w?.utilization, f.pct)} reason={reason} />
        <StatCard icon={<TrendingUpOutlined />} tone="pending" label={t(`${NS}.text_avg_overtime_per_employee_period`, "Avg Overtime per Employee (period)")}
          value={metricOr(w?.avgOvertimeHoursPerEmployee, (v) => t(`${NS}.value_hours`, "{value} hrs", { value: f.number(v, 1) }))} reason={reason} />
        <StatCard icon={<CheckCircleOutline />} tone="ok" label={t(`${NS}.text_unplanned_absenteeism_rate`, "Unplanned Absenteeism Rate")}
          value={metricOr(w?.absenteeism, f.pct)} reason={reason} />
        <StatCard icon={<SpeedOutlined />} tone="info" label={t(`${NS}.text_average_capability_index`, "Average Capability Index (MCI)")}
          value={capability.available ? t(`${NS}.value_points`, "{value} pts", { value: f.number(capability.value.averageIndex, 1) }) : null}
          reason={sectionReason(t, capability)} />
      </div>

      <section className={styles.card}>
        <CardHeader icon={<AccessTimeOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_shift_site_overtime_heatmap`, "Shift & Site Overtime Heatmap")}
          badge={
            <button type="button" className={styles.btnSecondary} onClick={() => onNavigate?.("attendance", "workforce_ops")}>
              {t(`${NS}.text_view_live_rosters`, "View Live Rosters")}
            </button>
          } />
        {!w ? (
          <Notice>{reason}</Notice>
        ) : (
          <div className={styles.siteGrid}>
            {w.sites.map((site) => (
              <div key={site.location || "unassigned"} className={styles.siteTile}>
                <div className={styles.rowTitle}>{site.location || t(`${NS}.text_location_unassigned`, "Location not recorded")}</div>
                <div className={styles.rowSub}>{site.shift ?? t(`${NS}.text_shift_unassigned`, "Shift not recorded")}</div>
                <div className={styles.barHead} style={{ marginBlockStart: "0.6rem" }}>
                  <span>{t(`${NS}.text_capacity`, "Capacity:")} <strong>{site.utilization === null ? t(`${NS}.text_not_scheduled`, "Not scheduled") : f.pct(site.utilization)}</strong></span>
                  <span>{t(`${NS}.text_ot`, "OT:")} <strong>{t(`${NS}.value_hours`, "{value} hrs", { value: f.number(site.overtimeHours, 1) })}</strong></span>
                </div>
                <div className={styles.rowSub}>{t(`${NS}.text_site_employees`, "{count} employees · {days} scheduled days", { count: f.number(site.employees), days: f.number(site.scheduledDays) })}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
