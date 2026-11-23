"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Search } from "lucide-react";
import { Alert, Badge, Button, Drawer, EmptyState, ErrorState, Field, Input, Panel, Select, SkeletonRows, Textarea, cx, ui, type Tone } from "@/design/redesign/ui";
import { acceptProposal, resolveException, useExceptions, type AttendanceException, type ResolveInput } from "./data";
import { dayLabel, humanise } from "./format";
import { FilterPills, PersonCell, Stacked, StatusBadge, useNotify } from "./shared";
import styles from "./Attendance.module.css";

type Filter = "open" | "proposed" | "closed" | "all";

const SEVERITY_TONE: Record<string, Tone> = { critical: "danger", high: "danger", major: "warning", medium: "warning", low: "neutral", minor: "neutral" };

const ACTIONS: Array<{ value: ResolveInput["action"]; label: string; hint: string }> = [
  { value: "amend", label: "Amend the value", hint: "Record the corrected value (for example the actual time in)." },
  { value: "accept_proposal", label: "Accept the proposed correction", hint: "Apply the correction the employee proposed." },
  { value: "reject", label: "Reject", hint: "The day stays as recorded." },
  { value: "escalate", label: "Escalate", hint: "Keep it open and pass it up for a decision." },
];

export default function Exceptions({ canDecide }: { canDecide: boolean }) {
  const exceptions = useExceptions();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState<AttendanceException | null>(null);
  const rows = exceptions.data ?? [];
  const needle = query.trim().toLowerCase();
  const count = (state: Filter) => rows.filter((row) => state === "all" || (state === "closed" ? row.status === "resolved" || row.status === "rejected" : row.status === state)).length;
  const shown = rows
    .filter((row) => filter === "all" || (filter === "closed" ? row.status === "resolved" || row.status === "rejected" : row.status === filter))
    .filter((row) => !needle || `${row.employee_name} ${row.employee_code} ${row.kind} ${row.detail} ${row.exception_reference}`.toLowerCase().includes(needle));

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <FilterPills label="Exception status" value={filter} onChange={setFilter} options={[
          { value: "open", label: "Open", count: count("open") }, { value: "proposed", label: "Correction proposed", count: count("proposed") },
          { value: "closed", label: "Closed" }, { value: "all", label: "All" },
        ]} />
        <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search exceptions" placeholder="Search name, code or type" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </div>
      <Panel flush>
        {exceptions.error ? <div className={styles.pad}><ErrorState message={exceptions.error.message} onRetry={() => void exceptions.mutate()} /></div>
          : !exceptions.data ? <SkeletonRows rows={4} columns={6} />
            : shown.length === 0 ? <EmptyState icon={AlertTriangle} title={rows.length ? "Nothing matches" : "No attendance exceptions"}>Missed punches, mispunches and other anomalies the engine flags show here for the time office to settle.</EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Employee</th><th>Day</th><th>Exception</th><th className={styles.hideSm}>Proposed correction</th><th className={ui.numeric}>Age</th><th>Status</th>{canDecide && <th aria-label="Action" />}</tr></thead>
                    <tbody>
                      {shown.map((row) => (
                        <tr key={row.id}>
                          <td><PersonCell name={row.employee_name} code={row.employee_code} /></td>
                          <td className={ui.nowrap}>{dayLabel(row.date)}</td>
                          <td>
                            <span className={styles.inlineBadges}>{humanise(row.kind)}{row.severity && <Badge tone={SEVERITY_TONE[row.severity.toLowerCase()] ?? "neutral"}>{humanise(row.severity)}</Badge>}</span>
                            {row.detail && <span className={styles.sub}>{row.detail}</span>}
                          </td>
                          <td className={cx(styles.hideSm, styles.reason)}>{row.proposal ?? <span className={ui.muted}>None</span>}</td>
                          <td className={cx(ui.numeric, row.age_days !== null && row.age_days > 3 && styles["text-danger"])}>{row.age_days === null ? "—" : row.age_days < 0 ? "Upcoming" : `${row.age_days} d`}</td>
                          <td><Stacked main={<StatusBadge status={row.status} />} sub={row.resolution_action ? humanise(row.resolution_action) : undefined} /></td>
                          {canDecide && <td className={styles.rowActions}>{(row.status === "open" || row.status === "proposed") && <Button size="sm" onClick={() => setResolving(row)}>Resolve</Button>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>
      {resolving && <ResolveDrawer exception={resolving} onClose={() => setResolving(null)} onSaved={() => { setResolving(null); void exceptions.mutate(); }} />}
    </div>
  );
}

function ResolveDrawer({ exception, onClose, onSaved }: { exception: AttendanceException; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [action, setAction] = useState<ResolveInput["action"]>(exception.proposal ? "accept_proposal" : "amend");
  const [amendedValue, setAmendedValue] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = ACTIONS.filter((entry) => entry.value !== "accept_proposal" || exception.proposal);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (action === "amend" && !amendedValue.trim()) next.amendedValue = "Enter the corrected value.";
    // Accepting the proposal needs 3 characters; every other resolution 10 (the API's rules).
    const min = action === "accept_proposal" ? 3 : 10;
    if (reason.trim().length < min) next.reason = `Give a reason of at least ${min} characters.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure(null);
    try {
      if (action === "accept_proposal") await acceptProposal(exception.id, reason.trim());
      else await resolveException(exception.id, { action, reason: reason.trim(), ...(action === "amend" ? { amendedValue: amendedValue.trim() } : {}) });
      notify.success(action === "escalate" ? "Exception escalated" : "Exception settled", `${exception.employee_name ?? "Employee"} · ${dayLabel(exception.date)}`);
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Resolve exception"
      description={`${exception.employee_name ?? exception.employee_code ?? "Employee"} · ${dayLabel(exception.date, true)} · ${humanise(exception.kind)}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Check} type="submit" form="resolve-form" loading={saving}>Save decision</Button></>}>
      <form id="resolve-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        {exception.detail && <p className={styles.formNote}>{exception.detail}</p>}
        {exception.proposal && <Alert tone="info">Proposed correction: {exception.proposal}</Alert>}
        <Field id="ex-action" label="Decision" required hint={options.find((entry) => entry.value === action)?.hint}>
          <Select id="ex-action" value={action} onChange={(event) => setAction(event.target.value as ResolveInput["action"])}>
            {options.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </Select>
        </Field>
        {action === "amend" && (
          <Field id="ex-value" label="Corrected value" required error={errors.amendedValue} hint="For example 09:05 or GENERAL.">
            <Input id="ex-value" maxLength={100} value={amendedValue} onChange={(event) => setAmendedValue(event.target.value)} aria-invalid={Boolean(errors.amendedValue)} />
          </Field>
        )}
        <Field id="ex-reason" label="Reason" required error={errors.reason} hint="Kept in the audit trail.">
          <Textarea id="ex-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)} />
        </Field>
      </form>
    </Drawer>
  );
}
