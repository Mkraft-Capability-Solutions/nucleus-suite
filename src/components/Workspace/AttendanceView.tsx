"use client";

import { useEffect, useState } from "react";
import { Building2, Calendar as CalIcon, CheckCircle, Clock, FileText, KeyRound, RefreshCw, ShieldCheck, TrendingUp, UploadCloud, UserCheck } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import styles from "./AttendanceView.module.css";
import { csvCell, currentPeriod, shiftPeriod, type Anomaly, type EngineConsole, type GatePass, type LedgerRow, type OwnProfile, type Regularization, type SessionStrip, type TimesheetDay } from "./attendance/attendanceApi";
import { useResource, type Resource } from "./attendance/useResource";
import { useAttendanceText } from "./attendance/useAttendanceText";
import MonthlyLedgerTab from "./attendance/MonthlyLedgerTab";
import GatePassTab from "./attendance/GatePassTab";
import RegularizationTab from "./attendance/RegularizationTab";
import TimeOfficeLedgerTab, { type LedgerAction } from "./attendance/TimeOfficeLedgerTab";
import WorkerCategoriesTab from "./attendance/WorkerCategoriesTab";
import GatePassModal from "./attendance/GatePassModal";
import RegularizationModal, { type RegularizationTarget } from "./attendance/RegularizationModal";
import AnomalyModal, { isOpenAnomaly } from "./attendance/AnomalyModal";
import OvertimeModal from "./attendance/OvertimeModal";
import ShiftOverrideModal from "./attendance/ShiftOverrideModal";
import TimelineModal from "./attendance/TimelineModal";

type Tab = "monthly_ledger" | "gate_pass" | "regularization" | "time_office_ledger" | "worker_categories";
type Tone = "success" | "error" | "info";

const SUB_FEATURE_TAB: Record<string, Tab> = {
  check_in_out: "monthly_ledger", my_attendance: "monthly_ledger", attendance_detail: "monthly_ledger", monthly_ledger: "monthly_ledger",
  gate_passes: "gate_pass", gate_pass: "gate_pass",
  regularizations: "regularization", attendance_regularization: "regularization", regularization: "regularization",
  overtime_register: "time_office_ledger", attendance_exceptions: "time_office_ledger", recompute_monitor: "time_office_ledger", time_office_ledger: "time_office_ledger",
  worker_categories: "worker_categories", team_history: "worker_categories", ops_rosters: "worker_categories",
};

function mapResource<T, U>(state: Resource<T>, map: (data: T) => U): Resource<U> {
  return state.status === "ready" ? { status: "ready", data: map(state.data) } : state;
}

/**
 * Attendance & time-office workspace. Every figure comes from the attendance API: own profile, session strip,
 * monthly timesheet, engine rule pack, anomalies, gate passes, regularizations and the time-office ledger.
 * Punching is delegated to the single punch control (AttendanceFAB) through `nucleus:trigger_punch`.
 */
const AttendanceView = ({ onNavigate, onSelectConsole, activeSubFeature }: {
  onNavigate?: (tab: string, sub?: string, console?: string) => void;
  onSelectConsole?: (id: string) => void;
  activeSubFeature?: string;
}) => {
  const { tr, locale } = useAttendanceText();
  const { showToast } = (useHRMS() ?? {}) as { showToast?: (title: string, message: string, tone: Tone) => void };
  const notify = (title: string, message: string, tone: Tone) => showToast?.(title, message, tone);
  const [activeTab, setActiveTab] = useState<Tab>("monthly_ledger");
  const [period, setPeriod] = useState(currentPeriod());
  const [gatePassOpen, setGatePassOpen] = useState(false);
  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [regTarget, setRegTarget] = useState<RegularizationTarget | null>(null);
  const [otRow, setOtRow] = useState<LedgerRow | null>(null);
  const [shiftRow, setShiftRow] = useState<LedgerRow | null>(null);
  const [timelineRow, setTimelineRow] = useState<LedgerRow | null>(null);
  const [showRules, setShowRules] = useState(false);

  const [lastSub, setLastSub] = useState<string | undefined>(undefined);
  if (activeSubFeature !== lastSub) {
    setLastSub(activeSubFeature);
    const mapped = activeSubFeature ? SUB_FEATURE_TAB[activeSubFeature] : undefined;
    if (mapped) setActiveTab(mapped);
  }

  const profile = useResource<OwnProfile>("/api/v1/operations/profile", tr("text_profile_failed", "Your profile could not be loaded."));
  const me = profile.state.status === "ready" ? profile.state.data : null;
  const employeeId = me?.employeeId ?? null;
  const linked = profile.state.status !== "ready" || employeeId !== null;
  const ownPath = (base: string) => (employeeId ? `${base}?employeeId=${encodeURIComponent(employeeId)}&period=${period}` : null);
  const session = useResource<SessionStrip>(ownPath("/api/v1/attendance/session"), tr("text_session_failed", "The attendance session could not be loaded."));
  const timesheet = useResource<TimesheetDay[]>(ownPath("/api/v1/attendance/timesheet"), tr("text_timesheet_failed", "The monthly timesheet could not be loaded."));
  const year = Number(period.slice(0, 4));
  const engine = useResource<EngineConsole>(`/api/v1/attendance/engine?year=${year}`, tr("text_engine_failed", "The time-office engine status could not be loaded."));
  const anomalies = useResource<Anomaly[]>("/api/v1/attendance/anomalies?limit=100", tr("text_anomalies_failed", "Anomalies could not be loaded."));
  const passes = useResource<GatePass[]>("/api/v1/gate-passes", tr("text_gp_list_failed", "Gate passes could not be loaded."));
  const regs = useResource<Regularization[]>("/api/v1/regularizations", tr("text_reg_list_failed", "Regularizations could not be loaded."));
  const ledger = useResource<LedgerRow[]>("/api/v1/attendance/ledger?limit=100", tr("text_ledger_failed", "The time-office ledger could not be loaded."));

  const reloadSession = session.reload;
  const reloadTimesheet = timesheet.reload;
  useEffect(() => {
    const refresh = () => { reloadSession(); reloadTimesheet(); };
    window.addEventListener("nucleus:attendance_changed", refresh);
    return () => window.removeEventListener("nucleus:attendance_changed", refresh);
  }, [reloadSession, reloadTimesheet]);

  const strip = session.state.status === "ready" ? session.state.data : null;
  const openAnomalies = mapResource(anomalies.state, (rows) => rows.filter(isOpenAnomaly).length);
  const pendingRegs = regs.state.status === "ready" ? regs.state.data.filter((row) => row.status === "submitted" || row.status === "supervisor_approved").length : null;
  const ownName = me?.name ?? me?.employeeCode ?? "—";
  const ruleVersion = engine.state.status === "ready" ? engine.state.data.engine.rulePackVersion : null;

  const exportTimesheet = () => {
    if (timesheet.state.status !== "ready" || timesheet.state.data.length === 0) {
      notify(tr("text_export_unavailable_title", "Nothing to export"), tr("text_export_unavailable", "The monthly timesheet has not loaded."), "error");
      return;
    }
    const header = [tr("AttendanceView_text_50", "Date"), tr("AttendanceView_text_55", "Status"), tr("text_shift", "Shift"), tr("text_gross_minutes", "Gross minutes")];
    const lines = [header, ...timesheet.state.data.map((day) => [day.date, day.status, day.shiftCode, day.grossMinutes])].map((cells) => cells.map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${me?.employeeCode ?? "employee"}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onLedgerAction = (action: LedgerAction, row: LedgerRow) => {
    switch (action) {
      case "regularize": setRegTarget({ employeeId: row.employee_id, employeeName: row.employee_name ?? row.employee_code ?? "—", date: row.date }); break;
      case "overtime": setOtRow(row); break;
      case "timeline": setTimelineRow(row); break;
      case "shift": setShiftRow(row); break;
      default: { const unreachable: never = action; return unreachable; }
    }
  };

  const tabs: Array<{ id: Tab; icon: React.ReactNode; label: string; badge?: string; badgeClass?: string }> = [
    { id: "monthly_ledger", icon: <CalIcon size={15} aria-hidden="true" />, label: tr("text_tab_timesheet", "Timesheet & Calendar") },
    { id: "gate_pass", icon: <KeyRound size={15} aria-hidden="true" />, label: tr("text_tab_gate_passes", "Gate Passes"),
      badge: strip?.gatePassAllowance ? (strip.gatePassAllowance.requestLimit !== null ? `${strip.gatePassAllowance.usedRequests}/${strip.gatePassAllowance.requestLimit}` : String(strip.gatePassAllowance.usedRequests)) : undefined,
      badgeClass: strip?.gatePassAllowance.remainingRequests === 0 ? styles.badgeCoral : styles.badgeBlue },
    { id: "regularization", icon: <UserCheck size={15} aria-hidden="true" />, label: tr("text_regularizations", "Regularizations"),
      badge: pendingRegs !== null ? tr("text_active_count", "{count} active", { count: pendingRegs }) : undefined, badgeClass: styles.badgePurple },
    { id: "time_office_ledger", icon: <RefreshCw size={15} aria-hidden="true" />, label: tr("text_tab_ledger", "Recompute Ledger"),
      badge: ledger.state.status === "ready" ? tr("text_cases_count", "{count} days", { count: ledger.state.data.length }) : undefined, badgeClass: styles.badgeTeal },
    { id: "worker_categories", icon: <Building2 size={15} aria-hidden="true" />, label: tr("text_tab_categories", "Worker Categories") },
  ];

  return (
    <div className={styles.attendanceContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{tr("AttendanceView_text_4", "Leave & Time-Office Engine")}</h2>
          <p>{tr("AttendanceView_text_5", "Cross-midnight punch pairing, break reports, gate-pass quota validation, and multi-plant category rules.")}</p>
        </div>
        <div className={styles.headerActions}>
          {(onNavigate || onSelectConsole) && (
            <button type="button" className={`${styles.btnSecondary} ${styles.signalBtn}`} title={tr("AttendanceView_title_6", "Open Attendance & Shift Intelligence Dashboard")}
              onClick={() => { onSelectConsole?.("S3"); onNavigate?.("dashboard", "dashboard", "s3"); }}>
              <TrendingUp size={15} aria-hidden="true" />{tr("text_attendance_intelligence", "Attendance Intelligence")}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} title={tr("title_upload_biometric_swipe_machine_punches_i", "Upload Biometric / Swipe Machine Punches in Bulk")}
            onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_bulk_upload"))}>
            <UploadCloud size={15} aria-hidden="true" />{tr("text_bulk_punches_upload", "Bulk Punches Upload")}
          </button>
          <button type="button" className={`${styles.btnPrimary} ${strip?.session.open ? styles.punchOut : styles.punchIn}`} disabled={!strip}
            onClick={() => window.dispatchEvent(new CustomEvent("nucleus:trigger_punch", { detail: { type: strip?.session.open ? "OUT" : "IN" } }))}>
            <Clock size={16} aria-hidden="true" />{strip?.session.open ? tr("text_punch_out", "Punch Out") : tr("text_punch_in", "Punch In")}
          </button>
          <button type="button" className={`${styles.btnSecondary} ${styles.outlineSignal}`} disabled={!employeeId}
            title={tr("title_submit_attendance_regularization_request", "Submit Attendance Regularization Request")}
            onClick={() => employeeId && setRegTarget({ employeeId, employeeName: ownName, date: null })}>
            <UserCheck size={15} aria-hidden="true" />{tr("text_request_regularization", "Request Regularization")}
          </button>
          <button type="button" className={`${styles.btnSecondary} ${styles.outlineSignal}`} disabled={!employeeId} onClick={() => setGatePassOpen(true)}>
            <KeyRound size={15} aria-hidden="true" />{tr("AttendanceView_text_113", "Request Gate Pass")}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={exportTimesheet} disabled={timesheet.state.status !== "ready"}>
            <FileText size={16} aria-hidden="true" />{tr("text_export_timesheet", "Export Timesheet")}
          </button>
        </div>
      </div>

      <div className={styles.engineBanner}>
        <div className={styles.inline}>
          <ShieldCheck size={24} color="var(--signal)" aria-hidden="true" />
          <div>
            <div className={styles.inline}>
              <strong className={styles.bannerTitle}>{tr("AttendanceView_text_12", "Time-Office Rule Engine Active")}</strong>
              {engine.state.status === "ready" && (
                <span className={`${styles.badge} ${styles.badgeBlue}`}>{ruleVersion ? tr("text_engine_version", "Rule pack {version}", { version: ruleVersion }) : tr("text_no_rule_pack", "No rule pack assigned")}</span>
              )}
            </div>
            <div className={styles.muted}>
              {engine.state.status === "ready" ? tr("text_rules_count", "{count} rules in force", { count: engine.state.data.engine.rules.length })
                : engine.state.status === "error" ? engine.state.message : tr("text_loading", "Loading…")}
            </div>
            {showRules && engine.state.status === "ready" && (
              engine.state.data.engine.rules.length === 0 ? <p className={styles.muted}>{tr("text_no_rules", "No rule statements are stored.")}</p>
                : <ul className={styles.rulesList}>{engine.state.data.engine.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            )}
          </div>
        </div>
        <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} aria-expanded={showRules} disabled={engine.state.status !== "ready"} onClick={() => setShowRules((value) => !value)}>
          <CheckCircle size={14} color="var(--status-ok)" aria-hidden="true" />{showRules ? tr("text_hide_rules", "Hide engine policy") : tr("text_show_rules", "Show engine policy")}
        </button>
      </div>

      <div className={styles.subnavTabs} role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}{tab.label}{tab.badge && <span className={`${styles.badge} ${tab.badgeClass ?? ""}`}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      {profile.state.status === "error" && <div className={styles.errorNote} role="alert"><span>{profile.state.message}</span><button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={profile.reload}>{tr("text_retry", "Retry")}</button></div>}

      {activeTab === "monthly_ledger" && (
        <MonthlyLedgerTab tr={tr} locale={locale} linked={linked} session={session.state} timesheet={timesheet.state} anomalies={openAnomalies}
          period={period} onPeriod={(delta) => setPeriod((value) => shiftPeriod(value, delta))} onReloadTimesheet={timesheet.reload} onOpenAnomalies={() => setAnomalyOpen(true)} />
      )}
      {activeTab === "gate_pass" && (
        <GatePassTab tr={tr} locale={locale} linked={linked} ownEmployeeId={employeeId} session={session.state} passes={passes.state}
          onReload={() => { passes.reload(); session.reload(); }} onApply={() => setGatePassOpen(true)} notify={notify} />
      )}
      {activeTab === "regularization" && (
        <RegularizationTab tr={tr} locale={locale} ownEmployeeId={employeeId} list={regs.state} onReload={regs.reload} notify={notify}
          onNew={employeeId ? () => setRegTarget({ employeeId, employeeName: ownName, date: null }) : null} />
      )}
      {activeTab === "time_office_ledger" && <TimeOfficeLedgerTab tr={tr} locale={locale} ledger={ledger.state} onReload={ledger.reload} onAction={onLedgerAction} notify={notify} />}
      {activeTab === "worker_categories" && <WorkerCategoriesTab tr={tr} locale={locale} year={year} engine={engine.state} onReload={engine.reload} />}

      {employeeId && gatePassOpen && (
        <GatePassModal tr={tr} open employeeId={employeeId} employeeName={ownName} allowance={strip?.gatePassAllowance ?? null}
          onClose={() => setGatePassOpen(false)} onSaved={() => { passes.reload(); session.reload(); }} notify={notify} />
      )}
      {regTarget && <RegularizationModal tr={tr} target={regTarget} onClose={() => setRegTarget(null)} onSaved={regs.reload} notify={notify} />}
      <AnomalyModal tr={tr} locale={locale} open={anomalyOpen} anomalies={anomalies.state} onClose={() => setAnomalyOpen(false)} onChanged={anomalies.reload} notify={notify} />
      {otRow && <OvertimeModal tr={tr} locale={locale} row={otRow} onClose={() => setOtRow(null)} onSaved={ledger.reload} notify={notify} />}
      {shiftRow && <ShiftOverrideModal tr={tr} locale={locale} row={shiftRow} onClose={() => setShiftRow(null)} onSaved={ledger.reload} notify={notify} />}
      {timelineRow && <TimelineModal tr={tr} locale={locale} row={timelineRow} onClose={() => setTimelineRow(null)} />}
    </div>
  );
};

export default AttendanceView;
