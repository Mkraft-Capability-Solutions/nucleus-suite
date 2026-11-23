"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { AlertTriangle, BarChart3, CalendarDays, ClipboardCheck, DoorOpen, ScrollText, Timer, Upload, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, PageHeader, Panel, Scope, SkeletonRows, cx, ui, type MenuAction, MenuButton } from "@/design/redesign/ui";
import { useExceptions, useGatePasses, useOvertime, useRegularisations, useSession, useTeam, useViewer, viewerAccess } from "./data";
import Exceptions from "./Exceptions";
import { GatePassForm, RegularisationForm, type EmployeeOption } from "./forms";
import { monthKey, monthOf, monthRange } from "./format";
import MyAttendance from "./MyAttendance";
import Overtime from "./Overtime";
import Requests, { type Kind } from "./Requests";
import Rules from "./Rules";
import Team from "./Team";
import styles from "./Attendance.module.css";

/**
 * Time & attendance (redesigned): the person's own days, their team, requests and the time
 * office's queues, on the existing attendance APIs. What a person sees follows their permissions
 * (from /api/v1/identity/context) and the organisation's plan; the APIs enforce both again.
 */

type SectionId = "mine" | "team" | "requests" | "exceptions" | "overtime" | "rules";

/** Menu items and older screen ids that open a particular section. */
const SUB_FEATURE_SECTION: Record<string, { section: SectionId; kind?: Kind }> = {
  check_in_out: { section: "mine" }, my_attendance: { section: "mine" }, attendance_detail: { section: "mine" }, monthly_ledger: { section: "mine" },
  team_history: { section: "team" },
  regularization: { section: "requests", kind: "regularisations" }, regularizations: { section: "requests", kind: "regularisations" }, attendance_regularization: { section: "requests", kind: "regularisations" },
  gate_passes: { section: "requests", kind: "gate_passes" }, gate_pass: { section: "requests", kind: "gate_passes" },
  attendance_exceptions: { section: "exceptions" }, recompute_monitor: { section: "exceptions" }, time_office_ledger: { section: "exceptions" },
  overtime_register: { section: "overtime" },
  worker_categories: { section: "rules" }, shift_master: { section: "rules" }, roster_schedule: { section: "rules" }, ops_rosters: { section: "rules" },
};

type AuthShape = { isEntitled: (key: string) => boolean; tenantAccess?: { tenant?: { name?: string } } | null };

export default function AttendanceWorkspace({ activeSubFeature, onOpenDashboard }: { activeSubFeature?: string | null; onOpenDashboard?: () => void }) {
  const { isEntitled, tenantAccess } = useAuth() as unknown as AuthShape;
  const viewer = useViewer();
  const access = viewerAccess(viewer.data);
  const selfId = viewer.data?.employeeId ?? null;
  const organisation = tenantAccess?.tenant?.name ?? "";

  const show = {
    mine: Boolean(selfId),
    team: access.seesTeam && isEntitled("attendance.team_history"),
    corrections: isEntitled("attendance.exceptions.regularization"),
    gatePasses: isEntitled("attendance.gate_passes"),
    exceptions: access.canDecide && isEntitled("attendance.exceptions"),
    overtime: (access.canDecide || access.seesTeam) && isEntitled("attendance.overtime"),
  };
  const showRequests = show.corrections || show.gatePasses;

  const requested = activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] : undefined;
  const [chosen, setSection] = useState<SectionId | null>(requested?.section ?? null);
  const [lastSubFeature, setLastSubFeature] = useState(activeSubFeature);
  const [requestKind, setRequestKind] = useState<Kind | undefined>(requested?.kind);
  const [form, setForm] = useState<{ type: "regularisation"; date?: string; employeeId?: string } | { type: "gate_pass" } | null>(null);
  if (activeSubFeature !== lastSubFeature) {
    setLastSubFeature(activeSubFeature);
    const next = activeSubFeature ? SUB_FEATURE_SECTION[activeSubFeature] : undefined;
    if (next) { setSection(next.section); setRequestKind(next.kind); }
  }

  const visible: Record<SectionId, boolean> = { mine: show.mine, team: show.team, requests: showRequests, exceptions: show.exceptions, overtime: show.overtime, rules: true };
  const firstVisible = (["mine", "team", "requests", "exceptions", "overtime", "rules"] as SectionId[]).find((id) => visible[id]) ?? "rules";
  const section: SectionId = chosen && visible[chosen] ? chosen : firstVisible;

  // Counts on the tabs (the same requests the sections make, so nothing is fetched twice).
  const ready = Boolean(viewer.data);
  const regularisations = useRegularisations(ready && show.corrections);
  const gatePasses = useGatePasses(ready && show.gatePasses);
  const exceptions = useExceptions(ready && show.exceptions);
  const overtime = useOvertime(ready && show.overtime);
  const awaiting = (regularisations.data ?? []).filter((row) => row.status === "submitted" && (access.canDecide || row.attributes?.employee_id === selfId)).length
    + (gatePasses.data ?? []).filter((row) => row.status === "pending_approval").length;
  const counts: Partial<Record<SectionId, number>> = {
    requests: awaiting || undefined,
    exceptions: (exceptions.data ?? []).filter((row) => row.status === "open" || row.status === "proposed").length || undefined,
    overtime: (overtime.data ?? []).filter((row) => row.status === "pending_approval").length || undefined,
  };

  // People a request can be raised for: yourself, plus (HR, managers) everyone in your scope.
  const month = monthRange(monthOf(new Date()));
  const team = useTeam(month.from, month.to, ready && access.canRequest && access.seesTeam);
  const session = useSession(access.canRequest ? selfId : null, monthKey(monthOf(new Date())));
  const employees = useMemo<EmployeeOption[]>(() => {
    const options = (team.data?.employees ?? []).map((member) => ({ id: member.id, label: `${`${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()} (${member.employeeCode})` }));
    if (selfId && !options.some((option) => option.id === selfId)) options.unshift({ id: selfId, label: "Myself" });
    return options.sort((a, b) => (a.id === selfId ? -1 : b.id === selfId ? 1 : a.label.localeCompare(b.label)));
  }, [team.data, selfId]);

  const sections: Array<{ id: SectionId; label: string; icon: typeof Users }> = [
    { id: "mine", label: "My attendance", icon: CalendarDays },
    { id: "team", label: "Team", icon: Users },
    { id: "requests", label: "Requests", icon: ClipboardCheck },
    { id: "exceptions", label: "Exceptions", icon: AlertTriangle },
    { id: "overtime", label: "Overtime", icon: Timer },
    { id: "rules", label: "Rules & calendars", icon: ScrollText },
  ];

  const newRequest: MenuAction[] = [
    ...(show.corrections ? [{ label: "Attendance correction", icon: UserCheck, onSelect: () => setForm({ type: "regularisation" }) }] : []),
    ...(show.gatePasses ? [{ label: "Gate pass", icon: DoorOpen, onSelect: () => setForm({ type: "gate_pass" }) }] : []),
  ];
  const refreshRequests = () => { void regularisations.mutate(); void gatePasses.mutate(); void session.mutate(); };

  return (
    <Scope module="attendance" className={ui.fit}>
      <div className={cx(ui.page, ui.fit)}>
        <PageHeader
          eyebrow={organisation ? `${organisation} · Time & attendance` : "Time & attendance"}
          title="Attendance"
          description="Days worked, requests and the time office's queues."
          actions={
            <>
              {onOpenDashboard && <Button variant="ghost" icon={BarChart3} onClick={onOpenDashboard}>Attendance dashboard</Button>}
              {access.canDecide && isEntitled("attendance.punches") && (
                <Button icon={Upload} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_bulk_upload"))}>Upload punches</Button>
              )}
              {access.canRequest && newRequest.length > 0 && <MenuButton label="New request" variant="primary" actions={newRequest} />}
            </>
          }
        />

        {viewer.error ? <Alert tone="danger">{viewer.error.message}</Alert> : !viewer.data ? <Panel><SkeletonRows rows={6} columns={5} /></Panel> : (
          <Tabs.Root className={ui.fit} value={section} onValueChange={(value) => setSection(value as SectionId)}>
            <Tabs.List className={ui.tabsList} aria-label="Attendance sections">
              {sections.filter(({ id }) => visible[id]).map(({ id, label, icon: Icon }) => (
                <Tabs.Tab key={id} value={id} className={ui.tab}>
                  <Icon aria-hidden="true" />{label}{counts[id] !== undefined && <span className={styles.tabBadge} aria-label={`${counts[id]} need attention`}>{counts[id]}</span>}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator className={ui.tabIndicator} />
            </Tabs.List>
            <div className={ui.fit} style={{ marginTop: 16 }}>
              {visible.mine && selfId && (
                <Tabs.Panel className={ui.fitPane} value="mine">
                  <MyAttendance employeeId={selfId} canDecide={access.canDecide} canRequest={access.canRequest && show.corrections}
                    onRequestRegularisation={(date) => setForm({ type: "regularisation", date })} onRequestGatePass={() => setForm({ type: "gate_pass" })} />
                </Tabs.Panel>
              )}
              {visible.team && (
                <Tabs.Panel className={ui.fitPane} value="team">
                  <Team canDecide={access.canDecide} canRequest={access.canRequest && show.corrections}
                    onRequestRegularisation={(date, employeeId) => setForm({ type: "regularisation", date, employeeId })} />
                </Tabs.Panel>
              )}
              {visible.requests && (
                <Tabs.Panel className={ui.fitPane} value="requests">
                  <Requests key={requestKind ?? "default"} canDecide={access.canDecide} canRequest={access.canRequest} selfOnlyRequests={access.selfOnlyRequests} selfId={selfId}
                    showCorrections={show.corrections} showGatePasses={show.gatePasses} initialKind={requestKind}
                    onNewRegularisation={() => setForm({ type: "regularisation" })} onNewGatePass={() => setForm({ type: "gate_pass" })} />
                </Tabs.Panel>
              )}
              {visible.exceptions && <Tabs.Panel className={ui.fitPane} value="exceptions"><Exceptions canDecide={access.canDecide} /></Tabs.Panel>}
              {visible.overtime && <Tabs.Panel className={ui.fitPane} value="overtime"><Overtime canDecide={access.canDecide} /></Tabs.Panel>}
              <Tabs.Panel className={ui.fitPane} value="rules"><Rules /></Tabs.Panel>
            </div>
          </Tabs.Root>
        )}
      </div>

      {form?.type === "regularisation" && (
        <RegularisationForm open onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshRequests(); }}
          defaultDate={form.date} defaultEmployeeId={form.employeeId} selfId={selfId} employees={employees} />
      )}
      {form?.type === "gate_pass" && (
        <GatePassForm open onClose={() => setForm(null)} onSaved={() => { setForm(null); refreshRequests(); }}
          selfId={selfId} employees={employees} quota={session.data?.gatePassQuota} />
      )}
    </Scope>
  );
}
