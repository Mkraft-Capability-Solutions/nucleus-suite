"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CalendarOff, ClipboardCheck, FileText, MessageSquare, Target, UserCheck, Users } from "lucide-react";
import NucleusChart from "@/components/Charts/NucleusChart";
import { NUCLEUS_COLORS, chartTokenColors } from "@/components/Charts/theme";
import { useHRMS } from "@/context/HRMSContext";
import { launchAction } from "@/lib/action-launcher";
import { useCockpit } from "@/lib/cockpits/use-cockpit";
import type { ManagerCockpitData, TeamMember } from "@/lib/cockpits/manager-cockpit-types";
import type { Source } from "@/lib/cockpits/source-types";
import { ChartCard, CockpitError, CockpitLoading, KpiTile, PartialNotice, useT } from "../cockpit/CockpitParts";
import shared from "../DashboardShared.module.css";
import TriageList from "./ManagerCockpitTriage";
import styles from "./ManagerCockpit.module.css";

/**
 * Manager Cockpit (S7). Every figure comes from GET /api/v1/cockpits/manager-cockpit and is scoped server-side to
 * the signed-in manager's direct reports. A feed that did not resolve shows its reason instead of a number.
 */

type Palette = Partial<Record<"teal" | "sky" | "amber" | "emerald" | "cyan" | "slate", string>>;
type TokenColors = { textPrimary: string; textMuted: string; lineMuted: string };

const NS = "components.Dashboard.Views.ManagerCockpit";

function capacityOption(bars: ManagerCockpitData["capacity"]["value"], C: TokenColors, P: Palette, labels: { delivering: string; onLeave: string; inTraining: string }) {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, data: [labels.delivering, labels.onLeave, labels.inTraining], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    grid: { left: 35, right: 15, top: 15, bottom: 25 },
    xAxis: { type: "category", data: bars.map((bar) => bar.label), axisLabel: { color: C.textPrimary, fontSize: 12.5 } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [
      { name: labels.delivering, type: "bar", stack: "total", data: bars.map((bar) => bar.delivering), itemStyle: { color: P.teal ?? P.emerald } },
      { name: labels.onLeave, type: "bar", stack: "total", data: bars.map((bar) => bar.onLeave), itemStyle: { color: P.amber } },
      { name: labels.inTraining, type: "bar", stack: "total", data: bars.map((bar) => bar.inTraining), itemStyle: { color: P.sky ?? P.cyan } },
    ],
  };
}

function skillRadarOption(axes: ManagerCockpitData["skills"]["value"]["axes"], C: TokenColors, P: Palette, labels: { verified: string; recorded: string }) {
  const teal = P.teal ?? P.emerald;
  const sky = P.sky ?? P.cyan;
  return {
    legend: { bottom: 0, data: [labels.verified, labels.recorded], textStyle: { color: C.textMuted, fontSize: 12.5 } },
    radar: { indicator: axes.map((axis) => ({ name: axis.axis, max: 100 })), center: ["50%", "45%"], radius: "60%", axisName: { color: C.textMuted }, splitLine: { lineStyle: { color: C.lineMuted } } },
    series: [{
      type: "radar",
      data: [
        { value: axes.map((axis) => axis.current), name: labels.verified, itemStyle: { color: teal }, areaStyle: { color: teal, opacity: 0.22 } },
        { value: axes.map((axis) => axis.comparison), name: labels.recorded, itemStyle: { color: sky }, lineStyle: { type: "dashed" }, areaStyle: { color: sky, opacity: 0.08 } },
      ],
    }],
  };
}

function AttendancePill({ member }: { member: TeamMember }) {
  const t = useT();
  if (!member.attendanceRecordedToday) return <span className={`${shared.pillBadge} ${shared.pillSlate}`}>{t(`${NS}.text_att_not_recorded`, "Not recorded")}</span>;
  return member.presentToday
    ? <span className={`${shared.pillBadge} ${shared.pillTeal}`}>{t(`${NS}.text_att_present`, "Present")}</span>
    : <span className={`${shared.pillBadge} ${shared.pillCoral}`}>{t(`${NS}.text_att_absent`, "Absent")}</span>;
}

export default function ManagerCockpit(_props: { onNavigate?: (tab: string) => void }) {
  const t = useT();
  const { theme } = useHRMS() as { theme: string };
  const C = useMemo(() => chartTokenColors(theme) as TokenColors, [theme]);
  const P = NUCLEUS_COLORS as Palette;
  const { state, reload } = useCockpit<ManagerCockpitData>("manager-cockpit");
  const [decided, setDecided] = useState(0);

  const options = useMemo(() => {
    if (state.status !== "ready") return null;
    const d = state.data;
    return {
      capacity: capacityOption(d.capacity.value, C, P, { delivering: t(`${NS}.text_delivering`, "Delivering"), onLeave: t(`${NS}.text_on_leave`, "On leave"), inTraining: t(`${NS}.text_in_training`, "In training") }),
      skills: skillRadarOption(d.skills.value.axes, C, P, { verified: t(`${NS}.text_skill_verified`, "Verified evidence"), recorded: t(`${NS}.text_skill_recorded`, "Recorded at all") }),
    };
  }, [state, C, P, t]);

  if (state.status === "loading") return <CockpitLoading label={t(`${NS}.text_loading`, "Loading the Manager Cockpit…")} />;
  if (state.status === "error") return <CockpitError message={state.message} forbidden={state.forbidden} onRetry={reload} />;
  const d = state.data;

  const notConnected = (message: string): Source<number | null> => ({ value: null, available: false, message });
  const pending: Source<number> = d.kpis.pendingApprovals.available ? { ...d.kpis.pendingApprovals, value: Math.max(0, d.kpis.pendingApprovals.value - decided) } : d.kpis.pendingApprovals;
  const narrative: Source<null> = { value: null, available: false, message: t(`${NS}.text_brief_unavailable`, "A weekly brief is not generated for this console yet, so nothing is suggested here.") };
  const members = d.team.value;

  return (
    <div className={shared.dashboardCanvas}>
      <div className={shared.scopeBar}>
        <div className={shared.scopeLeft}>
          <h2 className={shared.screenTitle}>{t(`${NS}.text_title`, "Manager Cockpit")}</h2>
          <span className={shared.scopeMetadata}>
            {d.team.available ? t(`${NS}.text_scope_direct`, "{count, plural, one {# direct report} other {# direct reports}}", { count: members.length }) : d.team.message}
          </span>
          <span className={shared.scopePill}>{t(`${NS}.text_scope_view`, "View: direct reports")}</span>
        </div>
        <div className={shared.scopeRight}>
          <button type="button" className={shared.scopeBtn} disabled title={t(`${NS}.text_report_unavailable`, "Team reports are not available yet.")}>
            <FileText size={14} aria-hidden="true" />{t(`${NS}.text_team_report`, "Team report")}
          </button>
          <button type="button" className={`${shared.scopeBtn} ${shared.scopeBtnPrimary}`} onClick={() => launchAction("oneOnOne")}>
            <MessageSquare size={14} aria-hidden="true" />{t(`${NS}.text_start_one_on_one`, "Start a 1:1")}
          </button>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <KpiTile icon={<ClipboardCheck size={18} />} label={t(`${NS}.text_kpi_pending`, "Awaiting your approval")} source={pending} />
        <KpiTile icon={<UserCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_present`, "Team present today")} source={d.kpis.presentToday} />
        <KpiTile icon={<CalendarOff size={18} />} label={t(`${NS}.text_kpi_on_leave`, "On approved leave today")} source={d.kpis.onLeaveToday} />
        <KpiTile icon={<Users size={18} />} tone="sky" label={t(`${NS}.text_kpi_team_size`, "Direct reports")} source={d.kpis.teamSize} />
        <KpiTile icon={<Target size={18} />} label={t(`${NS}.text_kpi_goals`, "Goals on track")} source={notConnected(t(`${NS}.text_goals_unavailable`, "Goal progress is not part of this console's data yet."))} />
        <KpiTile icon={<CalendarCheck size={18} />} tone="sky" label={t(`${NS}.text_kpi_one_on_ones`, "1:1s this month")} source={notConnected(t(`${NS}.text_one_on_ones_unavailable`, "1:1 meetings are not recorded for this console yet."))} />
      </div>
      <PartialNotice sources={d.unavailableSources} />

      <div className={shared.grid12}>
        <ChartCard span={12} title={t(`${NS}.text_card_brief`, "Three things for this week")} source={narrative} minHeight={110}>{null}</ChartCard>

        <ChartCard
          span={7}
          title={t(`${NS}.text_card_approvals`, "Approvals waiting on you")}
          subtitle={t(`${NS}.text_card_approvals_sub`, "Decide without leaving the row; a reason is required")}
          source={d.triage}
          tools={d.triageByKind.length > 0 ? d.triageByKind.map((kind) => <span key={kind.label} className={`${shared.pillBadge} ${shared.pillSlate}`}>{kind.label} · {kind.value}</span>) : undefined}
        >
          <TriageList source={d.triage} onDecided={setDecided} />
        </ChartCard>

        <ChartCard span={5} title={t(`${NS}.text_card_capacity`, "Team capacity")} subtitle={t(`${NS}.text_card_capacity_sub`, "People per week, next 4 weeks")} source={d.capacity}>
          {d.capacity.value.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_no_reports`, "No direct reports are linked to you yet.")}</p>
            : options && <NucleusChart option={options.capacity} style={{ height: 230, width: "100%" }} />}
        </ChartCard>

        <ChartCard span={5} title={t(`${NS}.text_card_skills`, "Team skill coverage")} subtitle={t(`${NS}.text_card_skills_sub`, "% of the team with each skill, verified against recorded")} source={d.skills}>
          {d.skills.value.axes.length === 0
            ? <p className={styles.empty}>{t(`${NS}.text_no_skills`, "No skills are recorded for your team yet.")}</p>
            : options && <NucleusChart option={options.skills} style={{ height: 230, width: "100%" }} />}
        </ChartCard>

        <ChartCard span={7} title={t(`${NS}.text_card_team`, "My team")} subtitle={t(`${NS}.text_card_team_sub`, "Direct reports and today's attendance")} source={d.team}>
          {members.length === 0 ? (
            <p className={styles.empty}>{t(`${NS}.text_no_reports`, "No direct reports are linked to you yet.")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={shared.dataTable}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.text_col_name`, "Name")}</th>
                    <th scope="col">{t(`${NS}.text_col_role`, "Role")}</th>
                    <th scope="col">{t(`${NS}.text_col_attendance`, "Attendance today")}</th>
                    <th scope="col">{t(`${NS}.text_col_goals`, "Goals")}</th>
                    <th scope="col">{t(`${NS}.text_col_last_one_on_one`, "Last 1:1")}</th>
                    <th scope="col">{t(`${NS}.text_col_learning`, "Learning")}</th>
                    <th scope="col">{t(`${NS}.text_col_signals`, "Signals")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.employeeId}>
                      <td><strong>{member.name}</strong><span className={styles.code}>{member.employeeCode}</span></td>
                      <td>{[member.designation, member.department].filter(Boolean).join(" · ")}</td>
                      <td><AttendancePill member={member} /></td>
                      {[0, 1, 2, 3].map((cell) => <td key={cell} className={styles.muted} title={t(`${NS}.text_cell_unavailable`, "Not available")}>—</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.note}>{t(`${NS}.text_team_columns_note`, "Goals, 1:1s, learning and signals are not connected to this console yet, so those columns stay empty.")}</p>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
