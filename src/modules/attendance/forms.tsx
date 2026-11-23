"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Drawer, Field, Input, Select, Textarea } from "@/design/redesign/ui";
import { requestGatePass, requestRegularisation, type RegularisationInput, type SessionStrip } from "./data";
import { addMinutes, hm, isoDay } from "./format";
import { useNotify } from "./shared";
import styles from "./Attendance.module.css";

export type EmployeeOption = { id: string; label: string };

/** Who the request is for: yourself, or (HR and managers) someone in your scope. */
function EmployeePicker({ id, value, onChange, options, selfId }: { id: string; value: string; onChange: (value: string) => void; options: EmployeeOption[]; selfId: string | null }) {
  if (options.length <= 1) return null;
  return (
    <Field id={id} label="Employee" required>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.id} value={option.id}>{option.id === selfId ? `${option.label} (you)` : option.label}</option>)}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Regularisation                                                      */
/* ------------------------------------------------------------------ */

const KINDS: Array<{ value: RegularisationInput["kind"]; label: string; hint: string }> = [
  { value: "missing-punch", label: "Missing punch", hint: "A punch in or out was not recorded." },
  { value: "shift-correct", label: "Wrong shift", hint: "The day was counted against the wrong shift." },
  { value: "break-correct", label: "Break correction", hint: "A break was recorded wrongly." },
];

export function RegularisationForm({ open, onClose, onSaved, defaultDate, defaultEmployeeId, selfId, employees }: {
  open: boolean; onClose: () => void; onSaved: () => void; defaultDate?: string | null; defaultEmployeeId?: string | null; selfId: string | null; employees: EmployeeOption[];
}) {
  const notify = useNotify();
  const today = isoDay(new Date());
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? selfId ?? employees[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate ?? today);
  const [kind, setKind] = useState<RegularisationInput["kind"]>("missing-punch");
  const [claimedIn, setClaimedIn] = useState("");
  const [claimedOut, setClaimedOut] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employeeId) next.employee = "Choose the employee.";
    if (!date) next.date = "Enter the date to correct.";
    else if (date > today) next.date = "A correction can only be requested for today or an earlier day.";
    if (kind === "missing-punch" && !claimedIn && !claimedOut) next.times = "Enter the time in, the time out, or both.";
    if (claimedIn && claimedOut && claimedOut <= claimedIn) next.times = "The time out must be after the time in.";
    if (reason.trim().length < 5) next.reason = "Explain the correction in at least 5 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure(null);
    try {
      await requestRegularisation({ employeeId, date, kind, reason: reason.trim(), ...(claimedIn ? { claimedIn } : {}), ...(claimedOut ? { claimedOut } : {}) });
      notify.success("Correction requested", `The request for ${date} is waiting for approval.`);
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Request an attendance correction"
      description="For a missed punch, a wrong shift or a break recorded wrongly. Your approver reviews it before the day changes."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="regularisation-form" loading={saving}>Submit request</Button></>}>
      <form id="regularisation-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <EmployeePicker id="reg-employee" value={employeeId} onChange={setEmployeeId} options={employees} selfId={selfId} />
        <Field id="reg-date" label="Date" required error={errors.date}>
          <Input id="reg-date" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(errors.date)} />
        </Field>
        <Field id="reg-kind" label="What needs correcting" required hint={KINDS.find((entry) => entry.value === kind)?.hint}>
          <Select id="reg-kind" value={kind} onChange={(event) => setKind(event.target.value as RegularisationInput["kind"])}>
            {KINDS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </Select>
        </Field>
        <div className={styles.formRow}>
          <Field id="reg-in" label="Actual time in" error={errors.times}>
            <Input id="reg-in" type="time" value={claimedIn} onChange={(event) => setClaimedIn(event.target.value)} />
          </Field>
          <Field id="reg-out" label="Actual time out">
            <Input id="reg-out" type="time" value={claimedOut} onChange={(event) => setClaimedOut(event.target.value)} />
          </Field>
        </div>
        <Field id="reg-reason" label="Reason" required error={errors.reason} hint="Approvers see this. For example: biometric reader at Gate 2 was down.">
          <Textarea id="reg-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)} />
        </Field>
      </form>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Gate pass                                                           */
/* ------------------------------------------------------------------ */

export function GatePassForm({ open, onClose, onSaved, selfId, employees, quota }: {
  open: boolean; onClose: () => void; onSaved: () => void; selfId: string | null; employees: EmployeeOption[]; quota: SessionStrip["gatePassQuota"] | undefined;
}) {
  const notify = useNotify();
  const today = isoDay(new Date());
  const [employeeId, setEmployeeId] = useState(selfId ?? employees[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [passType, setPassType] = useState<"personal" | "official">("personal");
  const [fromTime, setFromTime] = useState("");
  const [minutes, setMinutes] = useState<120 | 240>(120);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toTime = fromTime ? addMinutes(fromTime, minutes) : null;
  const forSelf = employeeId === selfId;

  // The personal allowance (src/lib/hr-rules.ts): 2 passes and 4 hours a month; a 4-hour pass only as the month's single pass.
  const used = forSelf && quota ? quota.usedMinutes : null;
  const ceiling = forSelf && quota && quota.ceilingMinutes > 0 ? quota.ceilingMinutes : 240;
  const warning = passType !== "personal" || used === null ? null
    : quota?.requestsRemaining === 0 ? "You have used both personal gate passes for this month; this request will be refused."
      : used + minutes > ceiling ? `This would take you past the ${hm(ceiling)} monthly allowance (${hm(used)} used); it will be refused.`
        : minutes === 240 && used > 0 ? "A 4-hour pass is only allowed as the month's single pass; choose 2 hours." : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employeeId) next.employee = "Choose the employee.";
    if (!date) next.date = "Enter the date.";
    if (!fromTime) next.fromTime = "Enter when you leave.";
    else if (!toTime) next.fromTime = "The pass must end before midnight.";
    if (reason.trim().length < 4) next.reason = "Give a reason of at least 4 characters.";
    setErrors(next);
    if (Object.keys(next).length || !toTime) return;
    setSaving(true);
    setFailure(null);
    try {
      await requestGatePass({ employeeId, date, fromTime, toTime, passType, reason: reason.trim() });
      notify.success("Gate pass requested", `${passType === "personal" ? "Personal" : "Official"} pass for ${date}, ${fromTime}–${toTime}, is waiting for approval.`);
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Request a gate pass"
      description="Leave the premises during your shift. Personal passes count against a monthly allowance; official duty does not."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="gate-pass-form" loading={saving}>Submit request</Button></>}>
      <form id="gate-pass-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <EmployeePicker id="gp-employee" value={employeeId} onChange={setEmployeeId} options={employees} selfId={selfId} />
        <Field id="gp-type" label="Type" required>
          <Select id="gp-type" value={passType} onChange={(event) => setPassType(event.target.value as "personal" | "official")}>
            <option value="personal">Personal</option>
            <option value="official">Official duty</option>
          </Select>
        </Field>
        <Field id="gp-date" label="Date" required error={errors.date}>
          <Input id="gp-date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <div className={styles.formRow}>
          <Field id="gp-from" label="Leaving at" required error={errors.fromTime}>
            <Input id="gp-from" type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} aria-invalid={Boolean(errors.fromTime)} />
          </Field>
          <Field id="gp-duration" label="Duration" required hint={toTime ? `Back by ${toTime}` : undefined}>
            <Select id="gp-duration" value={minutes} onChange={(event) => setMinutes(Number(event.target.value) as 120 | 240)}>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
            </Select>
          </Field>
        </div>
        {passType === "personal" && used !== null && (
          <p className={styles.formNote}>This month: {hm(used)} of {hm(ceiling)} used{quota?.requestsRemaining !== null && quota?.requestsRemaining !== undefined ? ` · ${quota.requestsRemaining} ${quota.requestsRemaining === 1 ? "pass" : "passes"} left` : ""}.</p>
        )}
        {warning && <Alert tone="warning">{warning}</Alert>}
        <Field id="gp-reason" label="Reason" required error={errors.reason}>
          <Textarea id="gp-reason" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)} />
        </Field>
      </form>
    </Drawer>
  );
}
