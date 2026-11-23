"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Drawer, Field, Input, Select, Textarea } from "@/design/redesign/ui";
import { useNotify } from "@/modules/attendance/shared";
import { startExit, startOnboarding, type Template } from "./data";
import styles from "./Lifecycle.module.css";

export type PersonOption = { id: string; label: string; joiningDate?: string | null };

export function StartOnboardingForm({ people, templates, onClose, onSaved }: { people: PersonOption[]; templates: Template[]; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const active = templates.filter((template) => template.attributes.status !== "archived" && template.attributes.code);
  const [employeeId, setEmployeeId] = useState("");
  const [templateCode, setTemplateCode] = useState(active[0]?.attributes.code ?? "DAY1-STD");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chosen = active.find((template) => template.attributes.code === templateCode);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!employeeId) { setError("Choose the joiner."); return; }
    setError(null);
    setSaving(true);
    setFailure(null);
    try {
      await startOnboarding(employeeId, templateCode);
      notify.success("Onboarding started", people.find((person) => person.id === employeeId)?.label ?? "");
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Start onboarding" description="Creates the joiner's checklist from the chosen template. Add the employee in Core HR first."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="start-onboarding" loading={saving}>Start</Button></>}>
      <form id="start-onboarding" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field id="ob-employee" label="Joiner" required error={error} hint="Newest joiners first.">
          <Select id="ob-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} aria-invalid={Boolean(error)}>
            <option value="">Choose an employee</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </Select>
        </Field>
        <Field id="ob-template" label="Checklist" required>
          <Select id="ob-template" value={templateCode} onChange={(event) => setTemplateCode(event.target.value)}>
            {active.length === 0 && <option value="DAY1-STD">Standard Day-1 onboarding</option>}
            {active.map((template) => <option key={template.id} value={template.attributes.code}>{template.attributes.name ?? template.attributes.code}</option>)}
          </Select>
        </Field>
        {chosen?.attributes.tasks?.length ? (
          <div>
            <p className={styles.drawerHeading}>{chosen.attributes.tasks.length} steps</p>
            <ol className={styles.stepList}>{chosen.attributes.tasks.map((task, index) => <li key={index}><span>{task.title}</span></li>)}</ol>
          </div>
        ) : null}
      </form>
    </Drawer>
  );
}

export function StartExitForm({ people, onClose, onSaved }: { people: PersonOption[]; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!employeeId) next.employee = "Choose the employee.";
    if (!lastWorkingDate) next.date = "Enter the last working day.";
    if (!reason.trim()) next.reason = "Enter the reason for leaving.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure(null);
    try {
      await startExit({ employeeId, reason: reason.trim(), lastWorkingDate });
      notify.success("Exit started", "Clearance requests went to IT, payroll and facilities.");
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Start an exit" description="Records the resignation or separation and opens no-dues clearance with IT, payroll and facilities."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="start-exit" loading={saving}>Start exit</Button></>}>
      <form id="start-exit" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field id="ex-employee" label="Employee" required error={errors.employee}>
          <Select id="ex-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Choose an employee</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </Select>
        </Field>
        <Field id="ex-date" label="Last working day" required error={errors.date}>
          <Input id="ex-date" type="date" value={lastWorkingDate} onChange={(event) => setLastWorkingDate(event.target.value)} />
        </Field>
        <Field id="ex-reason" label="Reason" required error={errors.reason} hint="For example: resigned, higher studies.">
          <Textarea id="ex-reason" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Drawer>
  );
}
