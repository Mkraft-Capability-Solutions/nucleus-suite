"use client";

import { useState } from "react";
import { CalendarPlus, CalendarX2, Undo2 } from "lucide-react";
import { Alert, Badge, Button, Drawer, EmptyState, ErrorState, Field, Input, Panel, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { useNotify } from "@/modules/attendance/shared";
import { returnEarly, useBalanceSummary, useMyRequests, type MyRequest } from "./data";
import { canReturnEarly, daysLabel, isPending, leaveName, rangeLabel, requestState } from "./format";
import styles from "./Leave.module.css";

export default function MyLeave({ employeeId, onApply }: { employeeId: string; onApply: () => void }) {
  const balances = useBalanceSummary(employeeId);
  const requests = useMyRequests(employeeId);
  const [returning, setReturning] = useState<MyRequest | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const rows = requests.data ?? [];
  const upcoming = rows.filter((row) => (row.ends_on ?? "") >= today && !["rejected", "cancelled"].includes(row.status.toLowerCase()))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const past = rows.filter((row) => !upcoming.includes(row));

  return (
    <div className={styles.section}>
      <Panel title="Balances" subtitle="What you can still take, with requests awaiting approval shown separately"
        actions={<Button variant="primary" icon={CalendarPlus} onClick={onApply}>Apply for leave</Button>}>
        {balances.error ? <ErrorState message={balances.error.message} onRetry={() => void balances.mutate()} />
          : !balances.data ? <SkeletonRows rows={2} columns={4} />
            : balances.data.length === 0 ? <EmptyState icon={CalendarX2} title="No leave balances recorded">Balances appear once HR loads or credits them.</EmptyState>
              : (
                <ul className={styles.balances}>
                  {balances.data.map((line) => (
                    <li key={line.leaveType} className={styles.balance}>
                      <span className={styles.balanceName}>{leaveName(line.leaveType, line.leaveTypeName)}</span>
                      <span className={cx(styles.balanceValue, line.available !== null && line.available < 0 && styles.negative)}>
                        {line.available === null ? "—" : Math.round(line.available * 100) / 100}<span className={styles.balanceUnit}> {line.available === 1 ? "day" : "days"}</span>
                      </span>
                      <span className={styles.balanceMeta}>
                        {line.pending > 0 && <span>{daysLabel(line.pending)} awaiting approval</span>}
                        <span>{daysLabel(line.takenThisYear)} taken this year</span>
                        {line.expiresOn && <span>Expires {rangeLabel(line.expiresOn, line.expiresOn)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
        {balances.data?.[0]?.asOf && <p className={styles.footNote}>Balances as of {rangeLabel(balances.data[0].asOf, balances.data[0].asOf)}, less leave approved since.</p>}
      </Panel>

      <Panel title="Upcoming and current leave" flush>
        <RequestTable rows={upcoming} loading={!requests.data && !requests.error} error={requests.error?.message ?? null} onRetry={() => void requests.mutate()}
          empty="No leave coming up." onReturn={setReturning} today={today} />
      </Panel>
      {past.length > 0 && (
        <Panel title="History" flush>
          <RequestTable rows={past} loading={false} error={null} onRetry={() => undefined} empty="" onReturn={setReturning} today={today} />
        </Panel>
      )}

      {returning && <EarlyReturnDrawer request={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); void requests.mutate(); void balances.mutate(); }} />}
    </div>
  );
}

function RequestTable({ rows, loading, error, onRetry, empty, onReturn, today }: {
  rows: MyRequest[]; loading: boolean; error: string | null; onRetry: () => void; empty: string; onReturn: (row: MyRequest) => void; today: string;
}) {
  if (error) return <div className={styles.pad}><ErrorState message={error} onRetry={onRetry} /></div>;
  if (loading) return <SkeletonRows rows={3} columns={5} />;
  if (rows.length === 0) return <EmptyState icon={CalendarX2} title={empty} />;
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <thead><tr><th>Leave</th><th>Dates</th><th className={ui.numeric}>Days</th><th className={styles.hideSm}>Reason</th><th>Status</th><th aria-label="Action" /></tr></thead>
        <tbody>
          {rows.map((row) => {
            const state = requestState(row.status, row.ends_on);
            return (
              <tr key={row.id}>
                <td>{leaveName(row.leave_type)}</td>
                <td className={ui.nowrap}>{rangeLabel(row.starts_on, row.ends_on)}</td>
                <td className={ui.numeric}>{row.requested_days}</td>
                <td className={cx(styles.hideSm, styles.reason)}>{row.reason ?? "—"}</td>
                <td><Badge tone={state.tone}>{state.label}</Badge>{isPending(row.status) && <span className={styles.sub}>Waiting for a decision</span>}</td>
                <td className={styles.rowActions}>{canReturnEarly(row.status, row.starts_on, row.ends_on, today) && <Button size="sm" icon={Undo2} onClick={() => onReturn(row)}>Back early</Button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EarlyReturnDrawer({ request, onClose, onSaved, who }: { request: { id: string; starts_on: string | null; ends_on: string | null; leave_type: string; requested_days: number }; onClose: () => void; onSaved: () => void; who?: string }) {
  const notify = useNotify();
  const today = new Date().toISOString().slice(0, 10);
  const start = (request.starts_on ?? today).slice(0, 10);
  const end = (request.ends_on ?? today).slice(0, 10);
  const [date, setDate] = useState(today < start ? start : today > end ? end : today);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const invalid = date < start || date > end;

  async function save() {
    if (invalid) return;
    setSaving(true);
    setFailure(null);
    try {
      const result = await returnEarly(request.id, date);
      const back = result?.data?.attributes?.leaveDaysCreditedBack;
      notify.success("Early return recorded", back !== undefined ? `${daysLabel(back)} returned to the balance.` : "The unused days go back to the balance.");
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Back from leave early"
      description={`${who ? `${who} · ` : ""}${leaveName(request.leave_type)}, ${rangeLabel(request.starts_on, request.ends_on)} (${daysLabel(request.requested_days)})`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={invalid} onClick={() => void save()}>Record return</Button></>}>
      <div className={styles.form}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field id="er-date" label="Back at work on" required hint="Days from this date to the end of the leave are returned to the balance and marked present." error={invalid ? `Choose a day between ${rangeLabel(start, start)} and ${rangeLabel(end, end)}.` : null}>
          <Input id="er-date" type="date" min={start} max={end} value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
