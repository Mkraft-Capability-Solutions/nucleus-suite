"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Clock, Hourglass, Sparkles, Timer, UserCheck, UserX, Users } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { AttendanceIntelligenceData, CoverageRow, OvertimeBand } from "@/lib/cockpits/attendance-intelligence-types";
import type { Source } from "@/lib/cockpits/source-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./AttendanceIntelligence.module.css";

/**
 * Attendance Intelligence (S3). Every figure comes from GET /api/v1/cockpits/attendance-intelligence; a feed that did
 * not resolve, or a figure the platform does not record, shows its reason instead of a number. Chart styles are the
 * console's existing ones (dual-axis trend, site radar, horizontal overtime bars, shift coverage strip).
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Payload = AttendanceIntelligenceData;
type Translate = ReturnType<typeof useT>;

const NS = "components.Dashboard.Views.AttendanceIntelligence";
const ALL_SITES = "__all__";

const bandColor = (band: OvertimeBand, P: Palette) => ({ within: P.teal, watch: P.amber, breach: P.coral })[band];

/** Wraps one payload section in the availability envelope ChartCard / KpiTile expect. */
function feed<T>(value: T, section: { available: boolean; message?: string; origin?: string }): Source<T> {
  return { value, available: section.available, message: section.message, origin: section.origin };
}

function unavailable(message: string): Source<null> {
  return { value: null, available: false, message };
}

function trendOption(points: Payload["trend"]["points"], C: TokenColors, P: Palette, labels: { left: string; right: string }) {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { bottom: 0, data: [labels.left, labels.right], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    grid: { left: 48, right: 48, top: 30, bottom: 40 },
    xAxis: { type: "category", data: points.map((p) => p.label) },
    yAxis: [
      { type: "value", name: labels.left, min: 0, max: 100, interval: 25, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: C.lineMuted } } },
      { type: "value", name: labels.right, min: 0, axisLabel: { formatter: "{value}%" }, splitLine: { show: false } },
    ],
    series: [
      { name: labels.left, type: "line", smooth: true, data: points.map((p) => p.left), itemStyle: { color: P.teal }, lineStyle: { width: 3 }, areaStyle: { color: P.teal, opacity: 0.15 } },
      { name: labels.right, type: "line", smooth: true, yAxisIndex: 1, data: points.map((p) => p.right), itemStyle: { color: P.coral }, lineStyle: { width: 2, type: "dashed" } },
    ],
  };
}

function radarOption(data: Payload["punctuality"], C: TokenColors, P: Palette) {
  return {
    legend: { bottom: 0, data: [data.currentLabel, data.comparisonLabel], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    radar: { indicator: data.axes.map((a) => ({ name: a.axis, max: 100 })), center: ["50%", "50%"], radius: "65%", axisName: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{
      type: "radar",
      data: [
        { value: data.axes.map((a) => a.current), name: data.currentLabel, itemStyle: { color: P.sky }, areaStyle: { color: P.sky, opacity: 0.25 } },
        { value: data.axes.map((a) => a.comparison), name: data.comparisonLabel, itemStyle: { color: P.teal }, lineStyle: { type: "dashed" }, areaStyle: { color: P.teal, opacity: 0.1 } },
      ],
    }],
  };
}

function overtimeOption(rows: Payload["overtime"]["rows"], C: TokenColors, P: Palette, hours: (value: number) => string, axisName: string) {
  const sorted = [...rows].sort((a, b) => a.hours - b.hours);
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "22%", right: "8%", top: "8%", bottom: "12%" },
    xAxis: { type: "value", name: axisName, splitLine: { lineStyle: { color: C.lineMuted } } },
    yAxis: { type: "category", data: sorted.map((r) => r.label), axisLabel: { color: C.textMuted, fontSize: 12.5 } },
    series: [{
      type: "bar", barWidth: 14,
      data: sorted.map((r) => ({ value: r.hours, itemStyle: { color: bandColor(r.band, P) } })),
      label: { show: true, position: "right", formatter: (p: { value: number }) => hours(p.value), color: C.textPrimary, fontSize: 12.5 },
    }],
  };
}

function CoverageStrip({ rows, t }: { rows: CoverageRow[]; t: Translate }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>{t(`${NS}.text_coverage_empty`, "No approved or published roster covers today, so there is no coverage to report.")}</p>;
  }
  return (
    <ul className={styles.coverageStrip} aria-label={t(`${NS}.text_card_coverage`, "Shift coverage today: rostered headcount")}>
      {rows.map((row) => (
        <li key={row.key} className={styles.slot}>
          <span className={styles.slotBand}>{row.band}</span>
          <span className={styles.slotValue}>{row.rostered}</span>
          <span className={styles.slotMeta}>{row.shiftCode} · {row.site}</span>
          <span className={styles.slotRequired}>
            {row.required === null ? t(`${NS}.text_required_no_source`, "Required: no source") : t(`${NS}.text_required_value`, "Required: {value}", { value: row.required })}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AttendanceIntelligence({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const t = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<Payload>("attendance-intelligence");
  const [site, setSite] = useState(ALL_SITES);

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    const hours = (value: number) => t(`${NS}.text_hours_value`, "{value}h", { value: formatNumber(value, locale, 1) });
    return {
      trend: trendOption(d.trend.points, C, P, { left: t(`${NS}.text_attendance_pct`, "Attendance %"), right: t(`${NS}.text_absenteeism_pct`, "Absenteeism %") }),
      radar: radarOption(d.punctuality, C, P),
      overtime: overtimeOption(d.overtime.rows, C, P, hours, t(`${NS}.text_hours_axis`, "Hours")),
    };
  }, [state, C, P, t, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading Attendance Intelligence…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const k = d.kpis;

  // The only site-bearing rows in the payload are roster coverage rows, so the site filter narrows that card alone.
  const sites = [...new Set(d.coverage.rows.map((row) => row.site))].sort((a, b) => a.localeCompare(b));
  const coverageRows = site === ALL_SITES ? d.coverage.rows : d.coverage.rows.filter((row) => row.site === site);

  const lastPoint = d.trend.points[d.trend.points.length - 1];
  const monthRate = lastPoint && lastPoint.label === d.period.label ? lastPoint.left : null;
  const kpiFeed = (value: number | null, origin: string, missing?: string): Source<number | null> =>
    ({ value, available: k.available && value !== null, message: k.available ? missing ?? k.message : k.message, origin });

  return (
    <div className={shared.dashboardCanvas}>
      <div className={styles.toolbar}>
        <p className={styles.period}>
          {t(`${NS}.text_period`, "Period {label}: {from} to {to} · as at {today}", { label: d.period.label, from: d.period.from, to: d.period.to, today: d.period.today })}
        </p>
        <div className={styles.toolbarActions}>
          {sites.length > 1 && (
            <select value={site} onChange={(e) => setSite(e.target.value)} className={shared.periodSelect} aria-label={t(`${NS}.text_site_filter`, "Filter shift coverage by site")}>
              <option value={ALL_SITES}>{t(`${NS}.text_all_sites`, "All sites ({count})", { count: sites.length })}</option>
              {sites.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          <button type="button" className={shared.primaryBtn} onClick={() => onNavigate?.("attendance")}>
            {t(`${NS}.text_shift_planner`, "Shift planner")}
          </button>
        </div>
      </div>

      <div className={shared.kpiRow}>
        <KpiTile icon={<CalendarCheck size={18} />} label={t(`${NS}.text_kpi_rate`, "Attendance rate ({label})", { label: d.period.label })}
          source={{ value: monthRate, available: d.trend.available && monthRate !== null, message: d.trend.message ?? t(`${NS}.text_rate_missing`, "No classified attendance days are recorded this month."), origin: d.trend.origin }} unit="%" digits={1} />
        <KpiTile icon={<UserCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_present`, "Present today")}
          source={kpiFeed(k.presentToday, t(`${NS}.text_present_origin`, "Present plus half day, of {total} active", { total: k.headcount === null ? "—" : formatNumber(k.headcount, locale) }))} />
        <KpiTile icon={<UserX size={18} />} label={t(`${NS}.text_kpi_absent`, "Absent today")}
          source={kpiFeed(k.absentToday, t(`${NS}.text_absent_origin`, "{count} not recorded, counted separately", { count: k.notRecordedToday === null ? "—" : formatNumber(k.notRecordedToday, locale) }))} />
        <KpiTile icon={<Clock size={18} />} tone="sky" label={t(`${NS}.text_kpi_late`, "Late clock-ins today")} source={kpiFeed(k.lateToday, k.lateNote, k.lateNote)} />
        <KpiTile icon={<Timer size={18} />} label={t(`${NS}.text_kpi_overtime`, "Overtime hours this period")} unit="h" digits={1}
          source={{ value: k.overtimeHours, available: d.overtime.available && k.overtimeHours !== null, message: d.overtime.message, origin: t(`${NS}.text_overtime_origin`, "Recorded overtime entries: {count}", { count: formatNumber(k.overtimeEntries, locale) }) }} />
        <KpiTile icon={<Hourglass size={18} />} tone="sky" label={t(`${NS}.text_kpi_avg_hours`, "Average daily hours")} source={unavailable(t(`${NS}.text_avg_hours_missing`, "Net worked hours per day are not part of this feed yet."))} />
        <KpiTile icon={<Users size={18} />} label={t(`${NS}.text_kpi_unapproved`, "Unapproved leaves")} source={unavailable(t(`${NS}.text_unapproved_missing`, "Unapproved absences are not part of this feed yet."))} />
        <KpiTile icon={<CalendarCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_roster_fill`, "Roster fill")} source={unavailable(d.coverage.requirementNote)} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={12} title={t(`${NS}.text_card_coverage`, "Shift coverage today: rostered headcount")} subtitle={t(`${NS}.text_card_coverage_sub`, "Rostered employees per time band on {today}", { today: d.period.today })}
          source={feed(coverageRows, d.coverage)} minHeight={140}
          tools={<button type="button" className={styles.disabledAction} disabled title={t(`${NS}.text_autofill_unavailable`, "Roster auto-fill is not available yet: there is no roster auto-fill service.")}><Sparkles size={13} aria-hidden="true" />{t(`${NS}.text_autofill`, "Auto-fill roster")}</button>}>
          <CoverageStrip rows={coverageRows} t={t} />
          <p className={styles.note}>{d.coverage.note} {d.coverage.requirementNote}</p>
        </ChartCard>

        <ChartCard span={8} title={t(`${NS}.text_card_trend`, "Attendance vs absenteeism (last 6 months)")} subtitle={t(`${NS}.text_card_trend_sub`, "Dual axis, scaled from zero")} source={feed(d.trend.points, d.trend)} minHeight={280}>
          {d.trend.points.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_trend_empty`, "No month in the window carries a classified attendance day, so there is nothing to plot.")}</p>
            : options && <NucleusChart option={options.trend} style={{ height: 280, width: "100%" }} />}
          <p className={styles.note}>{d.trend.note}</p>
        </ChartCard>
        <ChartCard span={4} minHeight={280} source={feed(d.punctuality.axes, d.punctuality)}
          title={d.punctuality.groupedBy === "location" ? t(`${NS}.text_card_punctuality_site`, "Punctuality profile by site") : t(`${NS}.text_card_punctuality_dept`, "Punctuality profile by department")}
          subtitle={t(`${NS}.text_card_punctuality_sub`, "On-time clock-in %, {current} against {comparison}", { current: d.punctuality.currentLabel, comparison: d.punctuality.comparisonLabel })}>
          {d.punctuality.axes.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_punctuality_empty`, "A group is plotted only when both periods carry punch rows with a readable first-in time and a known shift start.")}</p>
            : options && <NucleusChart option={options.radar} style={{ height: 280, width: "100%" }} />}
          <p className={styles.note}>{d.punctuality.note}</p>
        </ChartCard>

        <ChartCard span={6} minHeight={260} title={t(`${NS}.text_card_anomalies`, "Pattern detection and anomaly signals")} subtitle={t(`${NS}.text_card_anomalies_sub`, "Behavioural anomalies from the intelligence layer")}
          source={unavailable(t(`${NS}.text_anomalies_missing`, "Anomaly findings are not part of this feed yet. Open the attendance workspace to review recorded anomalies."))}>
          {null}
        </ChartCard>
        <ChartCard span={6} minHeight={260} title={t(`${NS}.text_card_overtime`, "Overtime hours by department")} subtitle={t(`${NS}.text_card_overtime_sub`, "Current cycle, {from} to {to}", { from: d.period.from, to: d.period.to })} source={feed(d.overtime.rows, d.overtime)}>
          {d.overtime.rows.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_overtime_empty`, "No overtime entry is dated in this period.")}</p>
            : options && <NucleusChart option={options.overtime} style={{ height: 260, width: "100%" }} />}
          <p className={styles.note}>{d.overtime.note}</p>
        </ChartCard>

        <ChartCard span={12} minHeight={160} title={t(`${NS}.text_card_regularisation`, "Regularisation requests pending approval")} subtitle={t(`${NS}.text_card_regularisation_sub`, "Punches needing manager sign-off before attendance lock")}
          tools={<button type="button" className={styles.linkAction} onClick={() => onNavigate?.("attendance")}>{t(`${NS}.text_view_all`, "View all")}</button>}
          source={unavailable(t(`${NS}.text_regularisation_missing`, "Pending regularisation requests are not part of this feed yet. Open the attendance workspace to see them."))}>
          {null}
        </ChartCard>
        <ChartCard span={12} minHeight={160} title={t(`${NS}.text_card_time_office`, "Time-office engine exceptions and calculated spans")} subtitle={t(`${NS}.text_card_time_office_sub`, "Cross-midnight pairing, break extraction, late forgiveness and category-based overtime")}
          tools={<button type="button" className={styles.linkAction} onClick={() => onNavigate?.("attendance")}>{t(`${NS}.text_open_ledger`, "Open the full time-office ledger")}</button>}
          source={unavailable(t(`${NS}.text_time_office_missing`, "Calculated time-office spans are not part of this feed yet. Open the attendance workspace for the recorded ledger."))}>
          {null}
        </ChartCard>
      </div>
    </div>
  );
}
