"use client";

import { useState, type FormEvent } from "react";
import { Gift, Plus } from "lucide-react";
import { Alert, Badge, Button, Drawer, EmptyState, ErrorState, Field, Input, Panel, Select, SkeletonRows, Textarea, ui, type Tone } from "@/design/redesign/ui";
import { FilterPills, PersonCell, StatStrip, useNotify } from "@/modules/attendance/shared";
import { grantCompOff, useCompOffs } from "./data";
import { rangeLabel } from "./format";
import type { PersonOption } from "./ApplyForm";
import styles from "./Leave.module.css";

type Filter = "open" | "lapsed" | "consumed" | "all";
const TONE: Record<string, Tone> = { open: "success", consumed: "neutral", lapsed: "danger" };
const LABEL: Record<string, string> = { open: "Available", consumed: "Used", lapsed: "Lapsed" };

/** Compensatory off earned for extra working days, with the 60-day expiry clock. */
export default function CompOff({ selfCode, canGrant, people }: { selfCode: string | null; canGrant: boolean; people: PersonOption[] }) {
  const compOffs = useCompOffs();
  const [filter, setFilter] = useState<Filter>("open");
  const [granting, setGranting] = useState(false);
  // The clock is organisation-wide; people who cannot grant see only their own.
  const all = (compOffs.data ?? []).filter((row) => canGrant || (selfCode !== null && row.employeeCode === selfCode));
  const rows = all.filter((row) => filter === "all" || row.status === filter);
  const soon = all.filter((row) => row.status === "open" && row.daysToExpiry !== null && row.daysToExpiry <= 14);

  return (
    <div className={styles.section}>
      <StatStrip label="Compensatory off" items={[
        { label: "Available", value: all.filter((row) => row.status === "open").length, note: "credits" },
        { label: "Expiring within 14 days", value: soon.length, tone: soon.length ? "warning" : undefined },
        { label: "Lapsed", value: all.filter((row) => row.status === "lapsed").length },
      ]} />
      <div className={styles.toolbar}>
        <FilterPills label="Status" value={filter} onChange={setFilter} options={[
          { value: "open", label: "Available" }, { value: "lapsed", label: "Lapsed" }, { value: "consumed", label: "Used" }, { value: "all", label: "All" },
        ]} />
        {canGrant && <Button variant="primary" icon={Plus} onClick={() => setGranting(true)}>Grant comp-off</Button>}
      </div>
      <Panel flush>
        {compOffs.error ? <div className={styles.pad}><ErrorState message={compOffs.error.message} onRetry={() => void compOffs.mutate()} /></div>
          : !compOffs.data ? <SkeletonRows rows={4} columns={5} />
            : rows.length === 0 ? <EmptyState icon={Gift} title="No comp-off credits here">Working on a weekly off or a holiday earns a comp-off, valid for 60 days.</EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Employee</th><th>Earned on</th><th>Expires</th><th className={ui.numeric}>Days left</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td><PersonCell name={row.employeeName} code={row.employeeCode} /></td>
                          <td className={ui.nowrap}>{rangeLabel(row.earnedOn, row.earnedOn)}</td>
                          <td className={ui.nowrap}>{rangeLabel(row.expiresOn, row.expiresOn)}{row.status === "open" && row.daysToExpiry !== null && <span className={row.daysToExpiry <= 14 ? styles.warnText : styles.sub}>{row.daysToExpiry === 0 ? "Expires today" : `in ${row.daysToExpiry} days`}</span>}</td>
                          <td className={ui.numeric}>{row.daysRemaining}</td>
                          <td><Badge tone={TONE[row.status] ?? "neutral"}>{LABEL[row.status] ?? row.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>
      {granting && <GrantDrawer people={people} onClose={() => setGranting(false)} onSaved={() => { setGranting(false); void compOffs.mutate(); }} />}
    </div>
  );
}

function GrantDrawer({ people, onClose, onSaved }: { people: PersonOption[]; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(people[0]?.id ?? "");
  const [earnedOn, setEarnedOn] = useState(today);
  const [days, setDays] = useState("1");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(days);
    const next: Record<string, string> = {};
    if (!employeeId) next.employee = "Choose the employee.";
    if (!earnedOn) next.earnedOn = "Enter the day worked.";
    else if (earnedOn > today) next.earnedOn = "A comp-off is granted for a day already worked.";
    if (!(value > 0 && value <= 10)) next.days = "Enter between 0.5 and 10 days.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure(null);
    try {
      await grantCompOff({ employeeId, earnedOn, days: value, ...(note.trim() ? { note: note.trim() } : {}) });
      notify.success("Comp-off granted", "It can be used within 60 days.");
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Grant compensatory off" description="For a weekly off or holiday the employee worked. It lapses 60 days after the day worked."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="coff-form" loading={saving}>Grant</Button></>}>
      <form id="coff-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field id="coff-employee" label="Employee" required error={errors.employee}>
          <Select id="coff-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </Select>
        </Field>
        <div className={styles.formRow}>
          <Field id="coff-date" label="Day worked" required error={errors.earnedOn}>
            <Input id="coff-date" type="date" max={today} value={earnedOn} onChange={(event) => setEarnedOn(event.target.value)} />
          </Field>
          <Field id="coff-days" label="Days" required error={errors.days}>
            <Input id="coff-days" inputMode="decimal" value={days} onChange={(event) => setDays(event.target.value)} />
          </Field>
        </div>
        <Field id="coff-note" label="Note" hint="Optional, for example the shift or work done.">
          <Textarea id="coff-note" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </form>
    </Drawer>
  );
}
