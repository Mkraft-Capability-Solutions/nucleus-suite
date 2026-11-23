"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Drawer, Field, Input, Select, Textarea } from "@/design/redesign/ui";
import { calculateLeaveSpan, leaveCalendarPolicy } from "@/app/actions/leaveActions";
import { useNotify } from "@/modules/attendance/shared";
import { applyLeave, type BalanceLine, type LeaveCode } from "./data";
import { ENGINE_KEY, MONTHLY_LIMIT, daysLabel, inclusiveDays, leaveName } from "./format";
import styles from "./Leave.module.css";

export type PersonOption = { id: string; label: string };
type Duration = "full" | "first_half" | "second_half";

/** Days the request will charge: the classic span rules (weekends, holidays, sandwich) for whole days, 0.5 for a half day. */
function chargeableDays(type: string, from: string, to: string, duration: Duration): { days: number | null; note: string | null } {
  const span = inclusiveDays(from, to);
  if (span === null) return { days: null, note: null };
  if (span === 1 && duration !== "full") return { days: 0.5, note: duration === "first_half" ? "First half of the day" : "Second half of the day" };
  const engineKey = ENGINE_KEY[type];
  if (!engineKey) return { days: span, note: null };
  try {
    const policy = leaveCalendarPolicy() as { holidays?: string[]; weekendDays?: number[]; sandwichEnabled?: boolean };
    const result = calculateLeaveSpan({ startDateStr: from, endDateStr: to, leaveTypeCode: engineKey, sandwichRuleEnabled: policy.sandwichEnabled, holidays: policy.holidays ?? [], weekendDays: policy.weekendDays ?? [0, 6] }) as {
      chargeable_days: number; weekend_days: number; holiday_days: number; sandwich_rule_applied: boolean;
    };
    const skipped = span - result.chargeable_days;
    const note = result.sandwich_rule_applied ? "Weekends or holidays between leave days are counted (sandwich rule)."
      : skipped > 0 ? `${daysLabel(skipped)} of weekend or holiday not counted.` : null;
    return { days: result.chargeable_days, note };
  } catch {
    return { days: span, note: null };
  }
}

export default function ApplyForm({ onClose, onSaved, selfId, people, balances, types, defaultEmployeeId }: {
  onClose: () => void; onSaved: () => void; selfId: string | null; people: PersonOption[]; balances: BalanceLine[] | undefined;
  /** Leave types offered (codes). */
  types: LeaveCode[]; defaultEmployeeId?: string | null;
}) {
  const notify = useNotify();
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? selfId ?? people[0]?.id ?? "");
  const [type, setType] = useState<LeaveCode>(types[0] ?? "CL");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [duration, setDuration] = useState<Duration>("full");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const single = from !== "" && from === to;
  const charge = useMemo(() => chargeableDays(type, from, to, single ? duration : "full"), [type, from, to, duration, single]);
  const forSelf = employeeId === selfId;
  const balance = forSelf ? balances?.find((line) => line.leaveType === type) : undefined;
  const after = balance?.available !== null && balance?.available !== undefined && charge.days !== null ? balance.available - balance.pending - charge.days : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employeeId) next.employee = "Choose the employee.";
    if (!from) next.from = "Enter the first day.";
    if (!to) next.to = "Enter the last day.";
    else if (from && to < from) next.to = "The last day cannot be before the first day.";
    if (charge.days !== null && charge.days <= 0) next.to = "These dates fall entirely on weekends or holidays.";
    if (charge.days !== null && charge.days > 60) next.to = "A single request can cover at most 60 days.";
    setErrors(next);
    if (Object.keys(next).length || charge.days === null) return;
    setSaving(true);
    setFailure(null);
    try {
      await applyLeave({ employeeId, leaveType: type, startsOn: from, endsOn: to, days: charge.days, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      notify.success("Leave requested", `${leaveName(type)} for ${daysLabel(charge.days)} is waiting for approval.`);
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Apply for leave"
      description="Your manager approves first; some requests then go to the head of department and HR."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="leave-form" loading={saving}>Submit request</Button></>}>
      <form id="leave-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        {people.length > 1 && (
          <Field id="lv-employee" label="Employee" required error={errors.employee}>
            <Select id="lv-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.id === selfId ? `${person.label} (you)` : person.label}</option>)}
            </Select>
          </Field>
        )}
        <Field id="lv-type" label="Leave type" required hint={MONTHLY_LIMIT[type] ? `At most ${MONTHLY_LIMIT[type]} days of ${leaveName(type).toLowerCase()} a month.` : undefined}>
          <Select id="lv-type" value={type} onChange={(event) => setType(event.target.value as LeaveCode)}>
            {types.map((code) => <option key={code} value={code}>{leaveName(code)}</option>)}
          </Select>
        </Field>
        <div className={styles.formRow}>
          <Field id="lv-from" label="From" required error={errors.from}>
            <Input id="lv-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); if (!to || event.target.value > to) setTo(event.target.value); }} aria-invalid={Boolean(errors.from)} />
          </Field>
          <Field id="lv-to" label="To" required error={errors.to}>
            <Input id="lv-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} aria-invalid={Boolean(errors.to)} />
          </Field>
        </div>
        {single && (
          <Field id="lv-duration" label="Duration">
            <Select id="lv-duration" value={duration} onChange={(event) => setDuration(event.target.value as Duration)}>
              <option value="full">Full day</option>
              <option value="first_half">First half</option>
              <option value="second_half">Second half</option>
            </Select>
          </Field>
        )}
        <div className={styles.charge} aria-live="polite">
          <div><span className={styles.chargeLabel}>Days charged</span><strong className={styles.chargeValue}>{daysLabel(charge.days)}</strong></div>
          {balance && balance.available !== null && (
            <div><span className={styles.chargeLabel}>Balance after this request</span><strong className={after !== null && after < 0 ? styles.negative : styles.chargeValue}>{daysLabel(after)}</strong></div>
          )}
        </div>
        {charge.note && <p className={styles.formNote}>{charge.note}</p>}
        {after !== null && after < 0 && <Alert tone="warning">This is more than your available {leaveName(type).toLowerCase()} (including requests still awaiting approval).</Alert>}
        <Field id="lv-reason" label="Reason" hint="Optional. Your approvers see it.">
          <Textarea id="lv-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Drawer>
  );
}
