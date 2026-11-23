"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, List, Plus } from "lucide-react";
import { csvRows } from "@/utils/csv";
import LeaveBalancePanel from "./LeaveBalancePanel";
import LeaveCalendar from "./LeaveCalendar";
import LeaveApplicationDialog from "./LeaveApplicationDialog";
import LeaveDecisionDialog, { type LeaveAction } from "./LeaveDecisionDialog";
import LeaveRequestCard from "./LeaveRequestCard";
import { ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatLeaveDate, useLeaveChanged, useLeaveResource, useLeaveT, type LeaveActivity, type LeaveContext, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.LeaveWorkflowPanel";

const STATUS_FILTERS: Array<[string, string, string]> = [
  ["", "filter_all", "All"],
  ["pending_supervisor", "filter_pending_supervisor", "Pending supervisor"],
  ["pending_hod", "filter_pending_hod", "Pending HOD"],
  ["pending_hr", "filter_pending_hr", "Pending HR"],
  ["approved", "filter_approved", "Approved"],
  ["rejected", "filter_rejected", "Rejected"],
  ["cancelled", "filter_cancelled", "Cancelled"],
];

/**
 * The 3-level approval pipeline (SCR-030): the tenant leave register from
 * GET /api/v1/leave-requests/register with server-side search and status
 * filter, decisions through the decide/cancel routes, and the recent leave
 * activity from GET /api/v1/leave/activity.
 */
export default function LeaveWorkflowPanel() {
  const { t, locale } = useLeaveT();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [applying, setApplying] = useState(false);
  const [decision, setDecision] = useState<{ request: LeaveRequestRow; action: LeaveAction } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  const context = useLeaveResource<LeaveContext>("/api/v1/leave/context", t(`${NS}.text_context_failed`, "Your leave profile could not be loaded."));
  const ctx = context.state.status === "ready" ? context.state.data : null;
  const params = new URLSearchParams({ search, ...(status ? { status } : {}) });
  const register = useLeaveResource<LeaveRequestRow[]>(`/api/v1/leave-requests/register?${params}`, t(`${NS}.text_failed`, "Leave requests could not be loaded."));
  const activity = useLeaveResource<LeaveActivity[]>("/api/v1/leave/activity", t(`${NS}.text_activity_failed`, "Leave activity could not be loaded."));
  useLeaveChanged(register.reload);
  useLeaveChanged(activity.reload);
  const rows = register.state.status === "ready" ? register.state.data : [];

  const exportReport = () => {
    const content = csvRows([
      [t(`${NS}.col_employee`, "Employee"), t(`${NS}.col_code`, "Code"), t(`${NS}.col_type`, "Leave type"), t(`${NS}.col_from`, "From"), t(`${NS}.col_to`, "To"), t(`${NS}.col_days`, "Days"), t(`${NS}.col_status`, "Status")],
      ...rows.map((row) => [row.employee_name ?? "", row.employee_code ?? "", row.leave_type_name ?? row.leave_type, row.starts_on ?? "", row.ends_on ?? "", row.requested_days, row.raw_status]),
    ]);
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={styles.stack}>
      <LeaveBalancePanel />
      <div className={styles.card}>
        <div className={styles.spread}>
          <div className={styles.row} role="group" aria-label={t(`${NS}.aria_view`, "View")}>
            <button type="button" className={`${view === "list" ? styles.primary : styles.secondary} ${styles.small}`} aria-pressed={view === "list"} onClick={() => setView("list")}>
              <List size={14} aria-hidden="true" /> {t(`${NS}.button_list`, "List")}
            </button>
            <button type="button" className={`${view === "calendar" ? styles.primary : styles.secondary} ${styles.small}`} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>
              <CalendarDays size={14} aria-hidden="true" /> {t(`${NS}.button_calendar`, "Calendar")}
            </button>
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.secondary} disabled={rows.length === 0} onClick={exportReport}>
              <Download size={14} aria-hidden="true" /> {t(`${NS}.button_export`, "Export CSV")}
            </button>
            <button type="button" className={styles.primary} onClick={() => setApplying(true)}>
              <Plus size={14} aria-hidden="true" /> {t(`${NS}.button_apply`, "Apply leave")}
            </button>
          </div>
        </div>
        <div className={`${styles.row} ${styles.mt}`}>
          <div className={`${styles.f} ${styles.grow}`}>
            <label htmlFor="leave-workflow-search">{t(`${NS}.label_search`, "Search employee, code or leave type")}</label>
            <input id="leave-workflow-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} />
          </div>
          <div className={styles.f}>
            <label htmlFor="leave-workflow-status">{t(`${NS}.label_status`, "Status")}</label>
            <select id="leave-workflow-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_FILTERS.map(([value, key, fallback]) => <option key={key} value={value}>{t(`${NS}.${key}`, fallback)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <ResourceView resource={register.state} onRetry={register.reload} isEmpty={(data) => data.length === 0 && view === "list"} empty={t(`${NS}.text_empty`, "No leave requests match these filters.")}>
        {(data) => (view === "calendar" ? <LeaveCalendar requests={data} /> : (
          <div className={styles.list}>
            {data.map((row) => <LeaveRequestCard key={row.id} request={row} ctx={ctx} onAction={(action) => setDecision({ request: row, action })} />)}
          </div>
        ))}
      </ResourceView>
      <details className={`${styles.card} ${styles.details}`}>
        <summary>{t(`${NS}.text_activity`, "Recent leave activity")}</summary>
        <ResourceView resource={activity.state} onRetry={activity.reload} isEmpty={(data) => data.length === 0} empty={t(`${NS}.text_no_activity`, "No leave activity yet.")}>
          {(data) => (
            <ul className={styles.list}>
              {data.map((entry) => (
                <li key={entry.id} className={styles.itemMeta}>
                  {formatLeaveDate(entry.createdAt, locale)} · {entry.employeeName ?? "—"} · <span className={styles.mono}>{entry.action}</span>{entry.reason ? ` · ${entry.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </details>
      <LeaveApplicationDialog open={applying} onClose={() => setApplying(false)} />
      {decision && <LeaveDecisionDialog request={decision.request} action={decision.action} onClose={() => setDecision(null)} />}
    </div>
  );
}
