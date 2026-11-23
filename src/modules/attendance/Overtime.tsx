"use client";

import { useState, type FormEvent } from "react";
import { Check, Search, Tag, Timer } from "lucide-react";
import { Alert, Button, Drawer, EmptyState, ErrorState, Field, Input, Panel, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { approveOvertime, tagPayRun, useOvertime, type OvertimeEntry } from "./data";
import { dayLabel, hm, hoursLabel, humanise } from "./format";
import { FilterPills, PersonCell, StatStrip, Stacked, StatusBadge, useNotify } from "./shared";
import styles from "./Attendance.module.css";

type Filter = "pending_approval" | "approved" | "settled" | "all";

export default function Overtime({ canDecide }: { canDecide: boolean }) {
  const overtime = useOvertime();
  const [filter, setFilter] = useState<Filter>("pending_approval");
  const [query, setQuery] = useState("");
  const [acting, setActing] = useState<{ entry: OvertimeEntry; mode: "approve" | "tag" } | null>(null);
  const rows = overtime.data ?? [];
  const needle = query.trim().toLowerCase();
  const inFilter = (row: OvertimeEntry) => filter === "all" || (filter === "settled" ? row.status === "tagged_to_run" || row.status === "paid" : row.status === filter);
  const shown = rows.filter(inFilter).filter((row) => !needle || `${row.employee_name} ${row.employee_code} ${row.pay_run ?? ""}`.toLowerCase().includes(needle));
  const pending = rows.filter((row) => row.status === "pending_approval");

  return (
    <div className={styles.section}>
      <StatStrip label="Overtime" items={[
        { label: "Awaiting approval", value: pending.length, note: hoursLabel(pending.reduce((total, row) => total + (row.overtime_minutes ?? 0), 0)) },
        { label: "Approved, not yet in a pay run", value: rows.filter((row) => row.status === "approved").length },
        { label: "In a pay run or paid", value: rows.filter((row) => row.status === "tagged_to_run" || row.status === "paid").length },
      ]} />
      <div className={styles.toolbar}>
        <FilterPills label="Overtime status" value={filter} onChange={setFilter} options={[
          { value: "pending_approval", label: "Awaiting approval", count: pending.length }, { value: "approved", label: "Approved" },
          { value: "settled", label: "In a pay run" }, { value: "all", label: "All" },
        ]} />
        <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search overtime" placeholder="Search name, code or pay run" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>
      <Panel flush>
        {overtime.error ? <div className={styles.pad}><ErrorState message={overtime.error.message} onRetry={() => void overtime.mutate()} /></div>
          : !overtime.data ? <SkeletonRows rows={4} columns={6} />
            : shown.length === 0 ? <EmptyState icon={Timer} title={rows.length ? "Nothing matches" : "No overtime recorded"}>Overtime the engine computes beyond the shift shows here for approval and payroll.</EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Employee</th><th>Day</th><th className={ui.numeric}>Overtime</th><th className={styles.hideSm}>Rate</th><th className={styles.hideSm}>Pay run</th><th>Status</th>{canDecide && <th aria-label="Action" />}</tr></thead>
                    <tbody>
                      {shown.map((row) => (
                        <tr key={row.id}>
                          <td><PersonCell name={row.employee_name} code={row.employee_code} /></td>
                          <td className={ui.nowrap}><Stacked main={dayLabel(row.date)} sub={row.day_type ? humanise(row.day_type) : undefined} /></td>
                          <td className={ui.numeric}><Stacked main={row.overtime_label || hm(row.overtime_minutes)} sub={row.overtime_minutes_raw !== null && row.overtime_minutes !== null && row.overtime_minutes_raw !== row.overtime_minutes ? `of ${hm(row.overtime_minutes_raw)}` : undefined} /></td>
                          <td className={styles.hideSm}>{row.multiplier ? `${row.multiplier}×` : "—"}</td>
                          <td className={cx(styles.hideSm, ui.nowrap)}>{row.pay_run ?? <span className={ui.muted}>Not tagged</span>}</td>
                          <td><Stacked main={<StatusBadge status={row.status} />} sub={row.approved_by ? `by ${row.approved_by}` : undefined} /></td>
                          {canDecide && (
                            <td className={styles.rowActions}>
                              {row.status === "pending_approval" && <Button size="sm" icon={Check} onClick={() => setActing({ entry: row, mode: "approve" })}>Approve</Button>}
                              {row.status === "approved" && <Button size="sm" icon={Tag} onClick={() => setActing({ entry: row, mode: "tag" })}>Tag pay run</Button>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>
      {acting && <OvertimeDrawer entry={acting.entry} mode={acting.mode} onClose={() => setActing(null)} onSaved={() => { setActing(null); void overtime.mutate(); }} />}
    </div>
  );
}

function OvertimeDrawer({ entry, mode, onClose, onSaved }: { entry: OvertimeEntry; mode: "approve" | "tag"; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const raw = entry.overtime_minutes ?? entry.overtime_minutes_raw ?? 0;
  const [reason, setReason] = useState("");
  const [payable, setPayable] = useState("");
  const [reductionReason, setReductionReason] = useState("");
  const [payRun, setPayRun] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const payableMinutes = payable.trim() === "" ? undefined : Math.round(Number(payable) * 60);
  const reduced = payableMinutes !== undefined && payableMinutes !== raw;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (reason.trim().length < 3) next.reason = "Give a reason of at least 3 characters.";
    if (mode === "approve" && payableMinutes !== undefined) {
      if (!Number.isFinite(payableMinutes) || payableMinutes < 0) next.payable = "Enter hours as a number, for example 1.5.";
      else if (payableMinutes > raw) next.payable = `Payable time cannot be more than the ${hm(raw)} recorded.`;
      if (reduced && reductionReason.trim().length < 10) next.reductionReason = "Say why the time was cut, in at least 10 characters.";
    }
    if (mode === "tag" && payRun.trim().length < 3) next.payRun = "Enter the pay run, for example PR-2026-11.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure(null);
    try {
      if (mode === "approve") await approveOvertime(entry.id, { reason: reason.trim(), ...(reduced ? { payableMinutes, reductionReason: reductionReason.trim() } : {}) });
      else await tagPayRun(entry.id, payRun.trim(), reason.trim());
      notify.success(mode === "approve" ? "Overtime approved" : "Tagged to pay run", `${entry.employee_name} · ${dayLabel(entry.date)}`);
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={mode === "approve" ? "Approve overtime" : "Tag to a pay run"}
      description={`${entry.employee_name} (${entry.employee_code}) · ${dayLabel(entry.date, true)} · ${entry.overtime_label || hm(raw)}${entry.multiplier ? ` at ${entry.multiplier}×` : ""}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="overtime-form" loading={saving}>{mode === "approve" ? "Approve" : "Tag pay run"}</Button></>}>
      <form id="overtime-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        {entry.weekly_cap_status && <Alert tone="warning">Weekly cap: {entry.weekly_cap_status}</Alert>}
        {mode === "approve" ? (
          <>
            <Field id="ot-payable" label="Payable hours" error={errors.payable} hint={`Leave empty to pay the ${hm(raw)} recorded. You can only reduce it.`}>
              <Input id="ot-payable" inputMode="decimal" placeholder={(raw / 60).toFixed(2)} value={payable} onChange={(event) => setPayable(event.target.value)} aria-invalid={Boolean(errors.payable)} />
            </Field>
            {reduced && (
              <Field id="ot-reduction" label="Why the time was cut" required error={errors.reductionReason}>
                <Textarea id="ot-reduction" rows={2} maxLength={200} value={reductionReason} onChange={(event) => setReductionReason(event.target.value)} />
              </Field>
            )}
          </>
        ) : (
          <Field id="ot-run" label="Pay run" required error={errors.payRun} hint="The payroll run that will pay this overtime.">
            <Input id="ot-run" maxLength={60} value={payRun} onChange={(event) => setPayRun(event.target.value)} aria-invalid={Boolean(errors.payRun)} />
          </Field>
        )}
        <Field id="ot-reason" label="Reason" required error={errors.reason} hint="Kept in the audit trail.">
          <Textarea id="ot-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)} />
        </Field>
      </form>
    </Drawer>
  );
}
