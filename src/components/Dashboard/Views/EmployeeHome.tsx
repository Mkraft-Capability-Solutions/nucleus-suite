"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  Briefcase, Calendar, Clock, DollarSign, HelpCircle, Plus, Send, ShieldCheck, Sparkles, Target, UserCheck, Users,
} from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { AttendanceMatrix, EmployeeHomeData, GoalRow, LearningRow, PodMember } from "@/lib/cockpits/employee-home-types";
import { ChartCard, CockpitError, CockpitLoading, PartialNotice, formatNumber, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import styles from "./EmployeeHome.module.css";

/**
 * Employee Home (S8, self-service). Every figure comes from GET /api/v1/cockpits/employee-home, which is scoped to
 * the signed-in employee. A feed that did not resolve shows its reason instead of a number. Punching lives in the
 * AttendanceFAB; this screen never punches.
 */

type Palette = Record<"teal" | "sky" | "amber" | "coral" | "violet" | "slate", string>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };
type Translate = ReturnType<typeof useT>;
type Props = { onNavigate?: (tab: string) => void };

const NS = "components.Dashboard.Views.EmployeeHome";
/** Existing chart styles of this console: heat ramp, cell border and the unused-leave track. */
const HEAT_RAMP = ["#14263D", "#1A4D4A", "#2E9C84"];
const CELL_BORDER = "#0E1D30";
const RING_TRACK = "rgba(28, 52, 80, 0.4)";
/** 2024-01-01 is a Monday: used only to print localised weekday names in Monday-first order. */
const MONDAY_EPOCH = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

const pct = (value: number): CSSProperties => ({ "--pct": Math.max(0, Math.min(100, value)) } as CSSProperties);

function isoToUtc(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function formatDay(iso: string, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  return new Intl.DateTimeFormat(locale || undefined, { ...options, timeZone: "UTC" }).format(isoToUtc(iso));
}

function formatClock(instant: string | null, locale: string | undefined): string | null {
  if (!instant) return null;
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(locale || undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatMoney(minor: number, currency: string, locale: string | undefined): string {
  const formatter = new Intl.NumberFormat(locale || undefined, { style: "currency", currency });
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minor / 10 ** exponent);
}

function makeDuration(t: Translate, locale: string | undefined) {
  return (minutes: number | null): string | null => {
    if (minutes === null || !Number.isFinite(minutes)) return null;
    const whole = Math.max(0, Math.round(minutes));
    return t(`${NS}.text_duration`, "{hours}h {minutes}m", { hours: formatNumber(Math.floor(whole / 60), locale), minutes: formatNumber(whole % 60, locale) });
  };
}

function leaveRingsOption(rings: EmployeeHomeData["leave"]["value"], C: TokenColors, P: Palette, labels: { tooltip: (name: string, days: string) => string; centre: string; ring: (label: string, value: string) => string; used: string }, locale: string | undefined) {
  const colours = [P.teal, P.sky, P.amber, P.violet, P.coral, P.slate];
  const shown = rings.rings.slice(0, 6);
  const step = shown.length > 3 ? 54 / shown.length : 18;
  const names = shown.map((ring) => labels.ring(ring.label, formatNumber(ring.value, locale, 1)));
  return {
    tooltip: { trigger: "item", formatter: (p: { name: string; value: number }) => labels.tooltip(p.name, formatNumber(p.value, locale, 1)) },
    legend: { bottom: 0, data: names, textStyle: { color: C.textMuted, fontSize: 12.5 } },
    series: shown.map((ring, index) => {
      const outer = 82 - index * step;
      const inner = outer - Math.max(6, step - 4);
      const used = ring.max !== undefined ? Math.max(0, ring.max - ring.value) : 0;
      return {
        name: ring.label, type: "pie", radius: [`${inner}%`, `${outer}%`], center: ["50%", "45%"], avoidLabelOverlap: false,
        label: index === shown.length - 1
          ? { show: true, position: "center", formatter: labels.centre, fontSize: 12, fontWeight: 700, color: C.textPrimary }
          : { show: false },
        data: [
          { value: ring.value, name: names[index], itemStyle: { color: colours[index % colours.length] } },
          ...(used > 0 ? [{ value: used, name: labels.used, itemStyle: { color: RING_TRACK } }] : []),
        ],
      };
    }),
  };
}

function attendanceOption(matrix: AttendanceMatrix, weekStart: string, C: TokenColors, locale: string | undefined, labels: { week: (date: string) => string; cell: (week: string, day: string, hours: string) => string }) {
  const weekday = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", timeZone: "UTC" });
  const days = matrix.columns.map((_, index) => weekday.format(MONDAY_EPOCH + index * DAY_MS));
  const lastMonday = isoToUtc(weekStart);
  const weeks = matrix.rows.map((_, index) => {
    const monday = new Date(lastMonday - (matrix.rows.length - 1 - index) * 7 * DAY_MS).toISOString().slice(0, 10);
    return labels.week(formatDay(monday, locale, { day: "numeric", month: "short" }));
  });
  const cells = matrix.values.flatMap((row, r) => row.map((value, c) => (value === null ? null : [r, c, value]))).filter((cell): cell is number[] => cell !== null);
  const values = cells.map((cell) => cell[2]);
  return {
    tooltip: { position: "top", formatter: (p: { value: number[] }) => labels.cell(weeks[p.value[0]] ?? "", days[p.value[1]] ?? "", formatNumber(p.value[2], locale, 1)) },
    grid: { top: 10, bottom: 25, left: 35, right: 15 },
    xAxis: { type: "category", data: weeks, axisLabel: { color: C.textMuted, fontSize: 12.5 } },
    yAxis: { type: "category", data: days, axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    visualMap: { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 1, show: false, inRange: { color: HEAT_RAMP } },
    series: [{ type: "heatmap", data: cells, itemStyle: { borderRadius: 2, borderColor: CELL_BORDER, borderWidth: 2 } }],
  };
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export default function EmployeeHome({ onNavigate }: Props) {
  const t = useT();
  const { locale } = useTranslation();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<EmployeeHomeData>("employee-home");
  const duration = makeDuration(t, locale);
  const go = (tab: string) => onNavigate?.(tab);

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    return {
      leave: leaveRingsOption(d.leave.value, C, P, {
        tooltip: (name, days) => t(`${NS}.text_leave_tooltip`, "{name}: {days} days", { name, days }),
        centre: t(`${NS}.text_leave_centre`, "{days}\nDays left", { days: formatNumber(d.leave.value.totalAvailable, locale, 1) }),
        ring: (label, value) => t(`${NS}.text_leave_ring`, "{label} ({value}d)", { label, value }),
        used: t(`${NS}.text_leave_used`, "Used"),
      }, locale),
      attendance: attendanceOption(d.attendance.value, d.week.value.weekStart, C, locale, {
        week: (date) => t(`${NS}.text_week_of`, "w/c {date}", { date }),
        cell: (week, day, hours) => t(`${NS}.text_heat_cell`, "{week} {day}: {hours}h logged", { week, day, hours }),
      }),
    };
  }, [state, C, P, t, locale]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading your workspace…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;
  const shift = d.shift.value;
  const week = d.week.value;
  const manager = d.reportingLine.value.manager;
  const profile = d.profile.value;

  const openLeaveApply = () => {
    try { window.sessionStorage.setItem("nucleus:auto_open_leave_apply", "true"); } catch { /* storage blocked: the Leave screen still opens, without the form */ }
    go("leaves");
  };
  const openAssistant = () => window.dispatchEvent(new CustomEvent("nucleus:open_copilot"));

  const worked = duration(shift.workedMinutes);
  const shareOfTarget = shift.workedMinutes !== null && shift.targetMinutes ? Math.round((shift.workedMinutes / shift.targetMinutes) * 100) : null;
  const punchedIn = formatClock(shift.punchedInAt, locale);
  const shiftWindow = shift.startsAt && shift.endsAt ? t(`${NS}.text_shift_window`, "{name} · {start}–{end}", { name: shift.shiftName ?? shift.shiftCode ?? "", start: shift.startsAt, end: shift.endsAt }) : t(`${NS}.text_no_shift`, "No shift assigned");
  const weekRemaining = week.targetMinutes !== null ? Math.max(0, week.targetMinutes - week.totalMinutes) : null;
  const projectTotal = week.projects.reduce((sum, p) => sum + p.minutes, 0);
  const unwiredTimeEntry = t(`${NS}.text_log_unwired`, "Time entry from this console is not connected to the timesheet store yet. Log time in Projects & Tasks.");
  const unwiredSubmit = t(`${NS}.text_submit_unwired`, "Weekly submission is not connected yet: this feed does not record billable hours or submission status.");

  return (
    <div className={shared.dashboardCanvas}>
      <nav className={styles.hub} aria-label={t(`${NS}.text_hub`, "My workspace")}>
        <span className={styles.hubLabel}><ShieldCheck size={14} aria-hidden="true" />{t(`${NS}.text_hub`, "My workspace")}</span>
        <button type="button" className={`${styles.chip} ${styles.chipOk}`} onClick={() => go("leaves")}><Calendar size={13} aria-hidden="true" />{t(`${NS}.text_nav_leaves`, "Apply / view leaves")}</button>
        <button type="button" className={`${styles.chip} ${styles.chipInfo}`} onClick={() => go("projects")}><Briefcase size={13} aria-hidden="true" />{t(`${NS}.text_nav_projects`, "Assigned tasks & sprints")}</button>
        <button type="button" className={`${styles.chip} ${styles.chipAgent}`} onClick={() => go("team")}><Users size={13} aria-hidden="true" />{t(`${NS}.text_nav_team`, "Reporting line & team pod")}</button>
        <button type="button" className={`${styles.chip} ${styles.chipPending}`} onClick={() => go("payroll")}><DollarSign size={13} aria-hidden="true" />{t(`${NS}.text_nav_payroll`, "Payslip & tax")}</button>
        <button type="button" className={styles.chip} onClick={() => go("attendance")}><Clock size={13} aria-hidden="true" />{t(`${NS}.text_nav_attendance`, "Monthly attendance log")}</button>
        <button type="button" className={styles.chip} onClick={() => go("performance")}><Target size={13} aria-hidden="true" />{t(`${NS}.text_nav_goals`, "My OKRs & goals")}</button>
        <button type="button" className={styles.chip} onClick={() => go("helpdesk")}><HelpCircle size={13} aria-hidden="true" />{t(`${NS}.text_nav_helpdesk`, "Policy helpdesk")}</button>
      </nav>

      {!d.linked && d.message && <p className={styles.unlinked} role="note">{d.message}</p>}
      {d.linked && <PartialNotice sources={d.unavailableSources} />}

      <div className={shared.grid12}>
        <ChartCard span={4} title={t(`${NS}.text_card_shift`, "Today's shift status")} subtitle={shiftWindow} source={d.shift}
          tools={<span className={`${shared.pillBadge} ${shift.sessionOpen ? shared.pillTeal : shared.pillSlate}`}>{shift.sessionOpen ? t(`${NS}.text_clocked_in`, "Clocked in") : t(`${NS}.text_not_clocked_in`, "Not clocked in")}</span>}>
          <div className={styles.centre}>
            <div className={styles.gauge} style={pct(shareOfTarget ?? 0)} role="img" aria-label={worked ? t(`${NS}.text_worked_aria`, "{worked} worked today", { worked }) : t(`${NS}.text_no_reading`, "No reading yet")}>
              <div className={styles.gaugeInner}>
                <span className={styles.gaugeValue}>{worked ?? "—"}</span>
                <span className={styles.gaugeSub}>{shareOfTarget !== null ? t(`${NS}.text_of_target`, "{pct}% of target", { pct: formatNumber(shareOfTarget, locale) }) : t(`${NS}.text_no_target`, "No target")}</span>
              </div>
            </div>
            <div className={styles.meta}>
              {t(`${NS}.text_shift_meta`, "In: {in} · Break: {break} · Target: {target}", { in: punchedIn ?? "—", break: duration(shift.breakMinutes) ?? "—", target: duration(shift.targetMinutes) ?? "—" })}
            </div>
            {d.week.available && (
              <div className={styles.metaMuted}>
                {week.targetMinutes !== null
                  ? t(`${NS}.text_this_week_of`, "This week: {total} of {target}", { total: duration(week.totalMinutes) ?? "—", target: duration(week.targetMinutes) ?? "—" })
                  : t(`${NS}.text_this_week`, "This week: {total}", { total: duration(week.totalMinutes) ?? "—" })}
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.text_card_leave`, "Leave balance")} subtitle={t(`${NS}.text_card_leave_sub`, "As on {date}", { date: formatDay(d.today, locale, { day: "numeric", month: "short", year: "numeric" }) })} source={d.leave}
          tools={<button type="button" className={`${styles.chip} ${styles.chipOk}`} onClick={openLeaveApply} title={t(`${NS}.text_apply_leave_title`, "Open the leave module and its apply form")}>{t(`${NS}.text_apply_leave`, "Apply leave →")}</button>}>
          {d.leave.value.rings.length > 0 && options
            ? <NucleusChart option={options.leave} style={{ height: 210, width: "100%" }} />
            : <Empty>{t(`${NS}.text_leave_empty`, "No leave balance has been credited to you yet.")}</Empty>}
        </ChartCard>

        <PayCard d={d} t={t} locale={locale} onOpen={() => go("payroll")} />
      </div>

      <section className={shared.aiNarrativeCard} aria-label={t(`${NS}.text_assistant`, "Ask Nucleus policy assistant")}>
        <div className={shared.narrativeHeader}>
          <span className={shared.narrativeBadge}><Sparkles size={14} aria-hidden="true" />{t(`${NS}.text_assistant`, "Ask Nucleus policy assistant")}</span>
        </div>
        <p className={shared.narrativeBody}>{t(`${NS}.text_assistant_body`, "Questions about leave carry-forward, pay or attendance rules go to the Nucleus assistant, which answers from your organisation's policy documents.")}</p>
        <div className={shared.narrativeFooter}>
          <button type="button" className={shared.narrativeBtn} onClick={openAssistant}>{t(`${NS}.text_assistant_open`, "Ask the assistant →")}</button>
          <button type="button" className={shared.narrativeBtn} onClick={() => go("helpdesk")}>{t(`${NS}.text_assistant_helpdesk`, "Open policy in Helpdesk →")}</button>
        </div>
      </section>

      <div className={shared.grid12}>
        <ChartCard span={8} title={t(`${NS}.text_card_week`, "Weekly timesheet & project logging")} subtitle={t(`${NS}.text_card_week_sub`, "Week of {date}", { date: formatDay(week.weekStart, locale, { day: "numeric", month: "short", year: "numeric" }) })} source={d.week}
          tools={<>
            <button type="button" className={`${styles.chip} ${styles.chipInfo}`} onClick={() => go("projects")}>{t(`${NS}.text_projects`, "Projects & tasks →")}</button>
            {weekRemaining !== null && <span className={`${shared.pillBadge} ${weekRemaining > 0 ? shared.pillAmber : shared.pillTeal}`}>{t(`${NS}.text_remaining`, "{left} remaining", { left: duration(weekRemaining) ?? "—" })}</span>}
          </>}>
          <div className={styles.rows}>
            <div className={styles.days}>
              {week.days.map((day) => {
                const isToday = day.date === d.today;
                return (
                  <div key={day.date} className={`${styles.day} ${isToday ? styles.dayToday : ""}`}>
                    <span className={styles.dayName}>{formatDay(day.date, locale, { weekday: "short" })}</span>
                    <span className={styles.dayHours}>{day.minutes === null ? "—" : t(`${NS}.text_hours`, "{hours}h", { hours: formatNumber(day.minutes / 60, locale, 1) })}</span>
                    <span className={styles.dayState}>{isToday ? t(`${NS}.text_today`, "Today") : formatDay(day.date, locale, { day: "numeric", month: "short" })}</span>
                  </div>
                );
              })}
            </div>
            <p className={styles.subtle}>{t(`${NS}.text_entries_note`, "Individual entries and their approval status are listed in Projects & Tasks.")}</p>
            <div className={styles.footer}>
              <div className={styles.totals}>
                <span>{t(`${NS}.text_total_logged`, "Total logged:")} <strong className={styles.totalValue}>{duration(week.totalMinutes)}</strong>{week.targetMinutes !== null && <span title={week.targetBasis ?? undefined}> {t(`${NS}.text_of_value`, "of {target}", { target: duration(week.targetMinutes) ?? "—" })}</span>}</span>
                <span>{t(`${NS}.text_billable`, "Billable hours: not recorded in this feed")}</span>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.action} disabled title={unwiredTimeEntry}><Plus size={13} aria-hidden="true" />{t(`${NS}.text_log_time`, "Log project time")}</button>
                <button type="button" className={styles.primary} disabled title={unwiredSubmit}><Send size={13} aria-hidden="true" />{t(`${NS}.text_submit`, "Submit for approval")}</button>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard span={4} title={t(`${NS}.text_card_alloc`, "Project & client allocation")} subtitle={t(`${NS}.text_card_alloc_sub`, "This week's time split by approved allocation")} source={d.week}>
          <div className={styles.rows}>
            {week.projects.length === 0
              ? <Empty>{t(`${NS}.text_alloc_empty`, "No time this week is booked to a project you hold an approved allocation on.")}</Empty>
              : week.projects.map((project, index) => {
                const share = projectTotal > 0 ? (project.minutes / projectTotal) * 100 : 0;
                const fill = [styles.fill, `${styles.fill} ${styles.fillInfo}`, `${styles.fill} ${styles.fillAgent}`, `${styles.fill} ${styles.fillPending}`][index % 4];
                return (
                  <div key={project.label} className={styles.bar}>
                    <div className={styles.barHead}><span>{project.label}</span><strong>{t(`${NS}.text_alloc_value`, "{hours}h ({pct}%)", { hours: formatNumber(project.minutes / 60, locale, 1), pct: formatNumber(share, locale) })}</strong></div>
                    <div className={styles.track}><div className={fill} style={pct(share)} /></div>
                  </div>
                );
              })}
            <div className={styles.noteBox}>
              <div className={styles.noteTitle}><UserCheck size={14} aria-hidden="true" />{t(`${NS}.text_signoff`, "Timesheet sign-off")}</div>
              {manager
                ? t(`${NS}.text_signoff_manager`, "Your reporting manager is {name}. Submission deadlines and sign-off SLAs are not part of this feed.", { name: manager.name })
                : t(`${NS}.text_signoff_none`, "No reporting manager is recorded on your profile, and sign-off SLAs are not part of this feed.")}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className={shared.grid12}>
        <ChartCard span={4} title={t(`${NS}.text_card_goals`, "My goals")} subtitle={t(`${NS}.text_card_goals_sub`, "Objectives you own")} source={d.goals}>
          <GoalList goals={d.goals.value} t={t} locale={locale} />
        </ChartCard>
        <ChartCard span={4} title={t(`${NS}.text_card_attendance`, "My attendance")} subtitle={t(`${NS}.text_card_attendance_sub`, "Last 8 weeks, hours logged")} source={d.attendance}>
          {d.attendance.value.rows.length > 0 && options
            ? <NucleusChart option={options.attendance} style={{ height: 210, width: "100%" }} />
            : <Empty>{t(`${NS}.text_attendance_empty`, "Attendance has recorded no hours for you in the last 8 weeks.")}</Empty>}
        </ChartCard>
        <ChartCard span={4} title={t(`${NS}.text_card_learning`, "Learning")} subtitle={t(`${NS}.text_card_learning_sub`, "Your enrolments")} source={d.learning}>
          <LearningTable rows={d.learning.value} t={t} locale={locale} />
        </ChartCard>
      </div>

      <ChartCard span={12} title={t(`${NS}.text_card_reporting`, "My reporting line & pod")} subtitle={t(`${NS}.text_card_reporting_sub`, "Your manager and the colleagues who report to the same manager")} source={d.reportingLine} minHeight={180}
        tools={<>
          <button type="button" className={`${styles.chip} ${styles.chipAgent}`} onClick={() => go("team")}><Users size={13} aria-hidden="true" />{t(`${NS}.text_org_chart`, "View full org chart & team →")}</button>
          <button type="button" className={styles.chip} onClick={() => go("people_core")}>{t(`${NS}.text_profile`, "My employee profile →")}</button>
        </>}>
        <div className={styles.panes}>
          <div className={styles.pane}>
            <span className={styles.paneTitle}>{t(`${NS}.text_reporting_structure`, "Reporting structure")}</span>
            {manager ? (
              <div className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">{manager.name.trim().charAt(0).toUpperCase()}</span>
                <div className={styles.personText}>
                  <span className={styles.personName}>{manager.name}<span className={styles.tag}>{t(`${NS}.text_reporting_manager`, "Reporting manager")}</span></span>
                </div>
              </div>
            ) : <Empty>{t(`${NS}.text_no_manager`, "No reporting manager is recorded on your employee profile.")}</Empty>}
            <div className={styles.divider} />
            {profile ? (
              <div className={styles.facts}>
                <span>{t(`${NS}.text_your_role`, "Your role:")} <strong>{profile.designation || "—"}</strong></span>
                <span>{t(`${NS}.text_location`, "Location:")} <strong>{profile.location || "—"}</strong></span>
              </div>
            ) : <p className={styles.subtle}>{d.profile.message ?? t(`${NS}.text_profile_unavailable`, "Your profile could not be read.")}</p>}
          </div>
          <PodPane pod={d.reportingLine.value.pod} t={t} />
        </div>
      </ChartCard>
    </div>
  );
}

function PayCard({ d, t, locale, onOpen }: { d: EmployeeHomeData; t: Translate; locale: string | undefined; onOpen: () => void }) {
  const pay = d.pay.value;
  const money = (minor: number) => (pay ? formatMoney(minor, pay.currency, locale) : "");
  return (
    <ChartCard span={4} title={pay ? t(`${NS}.text_card_pay`, "{period} payslip", { period: pay.periodLabel }) : t(`${NS}.text_card_pay_none`, "Payslip")}
      subtitle={pay ? (pay.isCurrentPeriod ? t(`${NS}.text_pay_current`, "Current period · {code}", { code: pay.displayCode }) : t(`${NS}.text_pay_latest`, "Latest released period · {code}", { code: pay.displayCode })) : undefined}
      source={d.pay}
      tools={<button type="button" className={`${styles.chip} ${styles.chipInfo}`} onClick={onOpen} title={t(`${NS}.text_view_payslip_title`, "Open the payroll module and past payslips")}>{t(`${NS}.text_view_payslip`, "View payslip →")}</button>}>
      {pay ? (
        <div className={styles.rows}>
          <div className={styles.row}><span className={styles.rowLabel}>{t(`${NS}.text_gross`, "Gross salary:")}</span><strong>{money(pay.grossMinor)}</strong></div>
          <div className={styles.row}><span className={styles.rowLabel}>{t(`${NS}.text_deductions`, "Deductions:")}</span><strong className={styles.deduction}>{t(`${NS}.text_minus`, "- {amount}", { amount: money(pay.deductionsMinor) })}</strong></div>
          <div className={styles.divider} />
          <div className={styles.net}><span>{t(`${NS}.text_net`, "Net pay:")}</span><strong className={styles.netValue}>{money(pay.netMinor)}</strong></div>
          <div className={styles.row}><span className={styles.rowLabel}>{t(`${NS}.text_pay_state`, "Status:")}</span><span className={`${shared.pillBadge} ${shared.pillSky}`}>{pay.state}</span></div>
          <div className={styles.noteBox}>{t(`${NS}.text_investments_unavailable`, "Investment declarations and proof deadlines are not part of this feed yet.")}</div>
        </div>
      ) : <Empty>{t(`${NS}.text_pay_empty`, "No payslip has been released to you yet.")}</Empty>}
    </ChartCard>
  );
}

function GoalList({ goals, t, locale }: { goals: GoalRow[]; t: Translate; locale: string | undefined }) {
  if (goals.length === 0) return <Empty>{t(`${NS}.text_goals_empty`, "You do not own any objectives yet.")}</Empty>;
  const fillFor = (health: string) => ({ green: styles.fill, amber: `${styles.fill} ${styles.fillPending}`, red: `${styles.fill} ${styles.fillFlag}` } as Record<string, string | undefined>)[health] ?? `${styles.fill} ${styles.fillInfo}`;
  const healthLabel = (health: string) => ({
    green: t(`${NS}.text_health_green`, "On track"),
    amber: t(`${NS}.text_health_amber`, "At risk"),
    red: t(`${NS}.text_health_red`, "Off track"),
  } as Record<string, string | undefined>)[health] ?? t(`${NS}.text_health_undetermined`, "Health not determined");
  return (
    <div className={styles.rows}>
      {goals.map((goal) => (
        <div key={goal.id} className={styles.bar}>
          <div className={styles.barHead}>
            <span>{goal.title}</span>
            <strong>{goal.progressPct === null ? "—" : t(`${NS}.text_pct`, "{pct}%", { pct: formatNumber(goal.progressPct, locale) })}</strong>
          </div>
          <div className={styles.track}><div className={fillFor(goal.health)} style={pct(goal.progressPct ?? 0)} /></div>
          <span className={styles.barMeta}>{goal.keyResultCount === 1
            ? t(`${NS}.text_goal_meta_one`, "1 key result · {health}", { health: healthLabel(goal.health) })
            : t(`${NS}.text_goal_meta_other`, "{count} key results · {health}", { count: formatNumber(goal.keyResultCount, locale), health: healthLabel(goal.health) })}</span>
        </div>
      ))}
    </div>
  );
}

function LearningTable({ rows, t, locale }: { rows: LearningRow[]; t: Translate; locale: string | undefined }) {
  if (rows.length === 0) return <Empty>{t(`${NS}.text_learning_empty`, "You have no learning enrolments.")}</Empty>;
  return (
    <table className={shared.dataTable}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <strong>{row.courseTitle}</strong>
              <div className={styles.subtle}>{row.dueDate
                ? t(`${NS}.text_path_due`, "{path} · Due {date}", { path: row.pathLabel, date: formatDay(row.dueDate, locale, { day: "numeric", month: "short" }) })
                : row.pathLabel}</div>
            </td>
            <td className={styles.right}>
              {row.overdue
                ? <span className={`${shared.pillBadge} ${shared.pillCoral}`}>{row.daysOverdue !== null ? t(`${NS}.text_overdue_days`, "Overdue {days}d", { days: formatNumber(row.daysOverdue, locale) }) : t(`${NS}.text_overdue`, "Overdue")}</span>
                : <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{row.stateLabel}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PodPane({ pod, t }: { pod: PodMember[]; t: Translate }) {
  const present = pod.filter((member) => member.presentToday === true).length;
  const read = pod.filter((member) => member.presentToday !== null).length;
  return (
    <div className={styles.pane}>
      <span className={styles.paneTitle}>
        {read > 0
          ? t(`${NS}.text_pod_title_present`, "Pod colleagues ({count}, {present} present today)", { count: pod.length, present })
          : t(`${NS}.text_pod_title`, "Pod colleagues ({count})", { count: pod.length })}
      </span>
      {pod.length === 0 ? <Empty>{t(`${NS}.text_pod_empty`, "No other active colleague reports to your manager.")}</Empty> : (
        <ul className={styles.pod}>
          {pod.map((member) => (
            <li key={member.employeeId} className={styles.podRow}>
              <span className={styles.podWho}>
                <span className={`${styles.dot} ${member.presentToday === true ? styles.dotOn : member.presentToday === false ? styles.dotOff : ""}`} aria-hidden="true" />
                <span className={styles.podName}>{member.name}</span>
                {member.designation && <span className={styles.podRole}>{member.designation}</span>}
              </span>
              <span className={`${styles.presence} ${member.presentToday === true ? styles.presenceOn : ""}`}>
                {member.presentToday === true ? t(`${NS}.text_present`, "Present") : member.presentToday === false ? t(`${NS}.text_absent`, "Not present") : t(`${NS}.text_no_presence`, "No reading")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
