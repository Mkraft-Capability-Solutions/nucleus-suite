"use client";

import { useState } from "react";
import { Check, Inbox, Search, Undo2, X } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Input, Panel, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { FilterPills, PersonCell, StatStrip, Stacked, useNotify } from "@/modules/attendance/shared";
import { decideLeave, useRegister, type RegisterRow } from "./data";
import { EarlyReturnDrawer } from "./MyLeave";
import { canReturnEarly, daysLabel, isPending, leaveName, rangeLabel, requestState } from "./format";
import styles from "./Leave.module.css";

type Mode = "approvals" | "all";
type StageFilter = "all" | "pending_supervisor" | "pending_hod" | "pending_hr";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

/**
 * Leave requests for approvers and HR. "approvals" lists what awaits a decision (never one's own:
 * the API refuses self-approval); "all" is the organisation's register with search and filters.
 * `scope` limits a manager to their reporting line.
 */
export default function Register({ mode, canApprove, canRecordReturn, selfId, scope }: {
  mode: Mode; canApprove: boolean; canRecordReturn: boolean; selfId: string | null; scope: Set<string> | null;
}) {
  const notify = useNotify();
  const register = useRegister();
  const [stage, setStage] = useState<StageFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegisterRow | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [returning, setReturning] = useState<RegisterRow | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const inScope = (register.data ?? []).filter((row) => !scope || scope.has(row.employee_id));
  const awaiting = inScope.filter((row) => isPending(row.raw_status) && row.employee_id !== selfId);
  const needle = query.trim().toLowerCase();
  const base = mode === "approvals" ? awaiting : inScope;
  const rows = base
    .filter((row) => mode !== "approvals" || stage === "all" || row.raw_status === stage)
    .filter((row) => mode !== "all" || status === "all" || (status === "pending" ? isPending(row.raw_status) : row.raw_status === status))
    .filter((row) => !needle || `${row.employee_name} ${row.employee_code} ${row.department} ${leaveName(row.leave_type, row.leave_type_name)}`.toLowerCase().includes(needle));
  const countStage = (value: StageFilter) => awaiting.filter((row) => value === "all" || row.raw_status === value).length;

  async function decide(row: RegisterRow, approve: boolean, note?: string) {
    setBusy(row.id);
    try {
      await decideLeave(row.id, approve, note);
      notify.success(approve ? "Leave approved" : "Leave rejected", `${row.employee_name ?? "Employee"} · ${rangeLabel(row.starts_on, row.ends_on)}`);
      void register.mutate();
    } catch (cause) {
      notify.error("Not saved", (cause as Error).message);
    } finally {
      setBusy(null);
      setRejecting(null);
      setComment("");
      setCommentError(false);
    }
  }

  return (
    <div className={styles.section}>
      {mode === "approvals" && (
        <StatStrip label="Awaiting decision" items={[
          { label: "Awaiting decision", value: awaiting.length },
          { label: "With managers", value: countStage("pending_supervisor") },
          { label: "With heads of department", value: countStage("pending_hod") },
          { label: "With HR", value: countStage("pending_hr") },
        ]} />
      )}
      <div className={styles.toolbar}>
        {mode === "approvals" ? (
          <FilterPills label="Approval step" value={stage} onChange={setStage} options={[
            { value: "all", label: "All steps" }, { value: "pending_supervisor", label: "Manager" }, { value: "pending_hod", label: "Head of department" }, { value: "pending_hr", label: "HR" },
          ]} />
        ) : (
          <FilterPills label="Status" value={status} onChange={setStatus} options={[
            { value: "all", label: "All" }, { value: "pending", label: "Awaiting approval" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
          ]} />
        )}
        <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search leave requests" placeholder="Search name, code or department" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>
      <Panel flush fill>
        {register.error ? <div className={styles.pad}><ErrorState message={register.error.message} onRetry={() => void register.mutate()} /></div>
          : !register.data ? <SkeletonRows rows={5} columns={6} />
            : rows.length === 0 ? (
              <EmptyState icon={Inbox} title={mode === "approvals" ? (awaiting.length ? "Nothing matches" : "Nothing waiting for a decision") : "No leave requests match"}>
                {mode === "approvals" && !awaiting.length ? "New leave requests from your team appear here." : undefined}
              </EmptyState>
            ) : (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th className={ui.numeric}>Days</th><th className={styles.hideSm}>Reason</th><th>Status</th><th aria-label="Action" /></tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const state = requestState(row.raw_status, row.ends_on);
                      const pending = isPending(row.raw_status);
                      const own = row.employee_id === selfId;
                      return (
                        <tr key={row.id}>
                          <td><Stacked main={<PersonCell name={row.employee_name} code={row.employee_code} />} sub={row.department ?? undefined} /></td>
                          <td>{leaveName(row.leave_type, row.leave_type_name)}</td>
                          <td className={ui.nowrap}><Stacked main={rangeLabel(row.starts_on, row.ends_on)} sub={row.actual_return_date ? `Back ${rangeLabel(row.actual_return_date, row.actual_return_date)}` : undefined} /></td>
                          <td className={ui.numeric}>{row.requested_days}</td>
                          <td className={cx(styles.hideSm, styles.reason)}><Stacked main={row.reason ?? "—"} sub={row.handover_person_name ? `Handover: ${row.handover_person_name}` : undefined} /></td>
                          <td><Badge tone={state.tone}>{state.label}</Badge></td>
                          <td className={styles.rowActions}>
                            {canApprove && pending && !own && (
                              <span className={styles.decision}>
                                <Button size="sm" icon={Check} loading={busy === row.id} onClick={() => void decide(row, true)}>Approve</Button>
                                <Button size="sm" variant="ghost" icon={X} disabled={busy === row.id} onClick={() => setRejecting(row)}>Reject</Button>
                              </span>
                            )}
                            {canRecordReturn && canReturnEarly(row.raw_status, row.starts_on, row.ends_on, today) && <Button size="sm" icon={Undo2} onClick={() => setReturning(row)}>Back early</Button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
      </Panel>
      {mode === "all" && (register.data?.length ?? 0) >= 100 && <p className={styles.footNote}>Showing the newest 100 requests. Search to find older ones.</p>}

      <ConfirmDialog open={rejecting !== null} title="Reject this leave request?" confirmLabel="Reject" tone="danger"
        onCancel={() => { setRejecting(null); setComment(""); setCommentError(false); }}
        onConfirm={() => { if (!comment.trim()) { setCommentError(true); return; } if (rejecting) void decide(rejecting, false, comment.trim()); }}>
        <span className={styles.confirmText}>{rejecting ? `${rejecting.employee_name ?? "The employee"} · ${leaveName(rejecting.leave_type)} · ${rangeLabel(rejecting.starts_on, rejecting.ends_on)} (${daysLabel(rejecting.requested_days)}). The reserved days go back to their balance.` : ""}</span>
        <label className={styles.confirmLabel} htmlFor="leave-reject-comment">Reason for the employee (required)</label>
        <Textarea id="leave-reject-comment" rows={2} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} aria-invalid={commentError} />
        {commentError && <span className={styles.fieldError}>Enter a reason the employee will see.</span>}
      </ConfirmDialog>
      {returning && <EarlyReturnDrawer request={returning} who={returning.employee_name ?? undefined} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); void register.mutate(); }} />}
    </div>
  );
}
