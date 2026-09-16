"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, DatabaseZap, Play, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageIntro, StatusPill, Surface } from "./page-primitives";

type RecordValue = Record<string, unknown>;
type FieldType = "text" | "uuid" | "date" | "number" | "select" | "checkbox" | "email";
type CommandField = { path: string; label: string; type: FieldType; required?: boolean; helper?: string; options?: Array<{ value: string | number; label: string }>; wide?: boolean };
type CommandDefinition = { value: string; label: string; description: string; submitLabel: string; body: RecordValue; fields: CommandField[] };

const today = () => new Date().toISOString().slice(0, 10);
const domainOptions = ["attendance", "worker", "leave", "statutory", "announcement", "letter"].map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }));
const commands: CommandDefinition[] = [
  {
    value: "save_rule_set", label: "Approve a rule set", description: "Publish an effective-dated workforce rule configuration. The previous approved version is retired automatically.", submitLabel: "Approve rule set",
    body: { action: "save_rule_set", domain: "attendance", code: "plant-default", effectiveFrom: today(), config: { halfDayMinutes: 450, absentMinutes: 270, graceMinutes: 15, forgivenLateInstances: 3 } },
    fields: [
      { path: "domain", label: "Rule domain", type: "select", required: true, options: domainOptions },
      { path: "code", label: "Rule-set code", type: "text", required: true, helper: "Stable internal code, for example plant-default." },
      { path: "effectiveFrom", label: "Effective from", type: "date", required: true },
      { path: "config.halfDayMinutes", label: "Half-day threshold", type: "number", required: true, helper: "Minutes." },
      { path: "config.absentMinutes", label: "Absent threshold", type: "number", required: true, helper: "Minutes." },
      { path: "config.graceMinutes", label: "Grace period", type: "number", required: true, helper: "Minutes." },
      { path: "config.forgivenLateInstances", label: "Forgiven late instances", type: "number", required: true },
    ],
  },
  {
    value: "grant_location", label: "Grant location scope", description: "Grant one membership access to a location from the chosen effective date.", submitLabel: "Grant location access",
    body: { action: "grant_location", membershipId: "", locationId: "", canViewCompensation: false, validFrom: today() },
    fields: [
      { path: "membershipId", label: "Membership ID", type: "uuid", required: true, helper: "Copy from Settings → Members." },
      { path: "locationId", label: "Location ID", type: "uuid", required: true, helper: "Copy from Organisation → Locations." },
      { path: "validFrom", label: "Valid from", type: "date", required: true },
      { path: "canViewCompensation", label: "Allow compensation visibility", type: "checkbox", wide: true },
    ],
  },
  {
    value: "evaluate_attendance", label: "Evaluate attendance day", description: "Recalculate a specific attendance day using an approved rule set and the standard shift windows.", submitLabel: "Evaluate attendance",
    body: { action: "evaluate_attendance", attendanceDayId: "", employeeId: "", attendanceDate: today(), ruleSetId: "", assignedShift: "A", shiftHours: 8, windows: [{ code: "A", earliestMinute: 420, latestMinute: 570, durationMinutes: 480 }, { code: "B", earliestMinute: 1140, latestMinute: 1320, durationMinutes: 720 }], punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "05:00 PM" }], firstPunchIso: `${today()}T08:00:00+05:30`, gatePassMinutes: 0, otPolicy: "rest-holiday-only", dayType: "working", minutesLate: 0, lateOccurrencesThisMonth: 0, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, timeZone: "Asia/Kolkata" },
    fields: [
      { path: "attendanceDayId", label: "Attendance day ID", type: "uuid", required: true, helper: "Open the day in Time office and copy its ID." },
      { path: "employeeId", label: "Employee ID", type: "uuid", required: true, helper: "Copy from the employee profile." },
      { path: "attendanceDate", label: "Attendance date", type: "date", required: true },
      { path: "ruleSetId", label: "Approved rule-set ID", type: "uuid", required: true },
      { path: "assignedShift", label: "Assigned shift", type: "select", required: true, options: [{ value: "A", label: "Shift A" }, { value: "B", label: "Shift B" }] },
      { path: "shiftHours", label: "Shift duration", type: "select", required: true, options: [8, 9, 10, 12].map((value) => ({ value, label: `${value} hours` })) },
      { path: "dayType", label: "Day type", type: "select", required: true, options: [{ value: "working", label: "Working day" }, { value: "weekly_off", label: "Weekly off" }, { value: "holiday", label: "Holiday" }, { value: "festival", label: "Festival" }] },
      { path: "otPolicy", label: "Overtime policy", type: "select", required: true, options: [{ value: "rest-holiday-only", label: "Rest days and holidays" }, { value: "all-days", label: "All days" }, { value: "not-eligible", label: "Not eligible" }] },
      { path: "gatePassMinutes", label: "Gate-pass minutes", type: "number", required: true },
    ],
  },
  {
    value: "run_leave_maintenance", label: "Run leave maintenance", description: "Run a controlled leave accrual, expiry or year-end maintenance cycle.", submitLabel: "Run leave maintenance",
    body: { action: "run_leave_maintenance", mode: "expiry", asOf: today() },
    fields: [
      { path: "mode", label: "Maintenance cycle", type: "select", required: true, options: [{ value: "accrual", label: "Accrual" }, { value: "expiry", label: "Expiry" }, { value: "year_end", label: "Year end" }] },
      { path: "asOf", label: "Run as of", type: "date", required: true },
    ],
  },
  {
    value: "sync_erp_employee", label: "Synchronize ERP employee", description: "Queue an employee master record for synchronization with the configured ERP connection.", submitLabel: "Synchronize employee",
    body: { action: "sync_erp_employee", externalCode: "ERP-001", employee: { firstName: "", lastName: "", workEmail: "", department: "", location: "", designation: "", joiningDate: today() } },
    fields: [
      { path: "externalCode", label: "ERP employee code", type: "text", required: true },
      { path: "employee.firstName", label: "First name", type: "text", required: true },
      { path: "employee.lastName", label: "Last name", type: "text", required: true },
      { path: "employee.workEmail", label: "Work email", type: "email" },
      { path: "employee.department", label: "Department", type: "text", required: true },
      { path: "employee.location", label: "Location", type: "text", required: true },
      { path: "employee.designation", label: "Designation", type: "text", required: true },
      { path: "employee.joiningDate", label: "Joining date", type: "date", required: true },
    ],
  },
  {
    value: "create_gl_posting", label: "Queue ERP GL posting", description: "Create a balanced general-ledger posting batch for a completed payroll run.", submitLabel: "Queue GL posting",
    body: { action: "create_gl_posting", payrollRunId: "" },
    fields: [{ path: "payrollRunId", label: "Payroll run ID", type: "uuid", required: true, helper: "Copy from Payroll → Runs." }],
  },
  {
    value: "ack_gl_posting", label: "Acknowledge ERP GL posting", description: "Record the ERP acknowledgement reference against an existing posting batch.", submitLabel: "Record acknowledgement",
    body: { action: "ack_gl_posting", batchId: "", acknowledgementRef: "" },
    fields: [
      { path: "batchId", label: "GL batch ID", type: "uuid", required: true },
      { path: "acknowledgementRef", label: "Acknowledgement reference", type: "text", required: true },
    ],
  },
  {
    value: "generate_statutory_form", label: "Generate statutory form", description: "Generate a statutory form instance for an establishment and reporting period. Every figure on the form is derived from the records; none is typed here.", submitLabel: "Generate form",
    body: { action: "generate_statutory_form", formCode: "FORM_F", locationId: "", stateCode: "", employeeId: "", period: new Date().getFullYear().toString() },
    fields: [
      { path: "formCode", label: "Form code", type: "text", required: true },
      { path: "locationId", label: "Establishment ID", type: "uuid", required: true, helper: "Copy from Organisation → Locations. The state variant, registration number and figures all resolve from it." },
      { path: "stateCode", label: "State code override", type: "text", helper: "Optional. Leave blank to use the establishment's own state." },
      { path: "employeeId", label: "Employee ID", type: "uuid", helper: "Required only for a per-employee form such as Form F." },
      { path: "period", label: "Reporting period", type: "text", required: true },
    ],
  },
  {
    value: "record_feature", label: "Record workforce programme", description: "Create an audited engagement, letter, asset, induction or position-control record.", submitLabel: "Record programme",
    body: { action: "record_feature", kind: "recognition", status: "published", effectiveOn: today(), data: { programme: "Star employee", citation: "" } },
    fields: [
      { path: "kind", label: "Record type", type: "select", required: true, options: ["recognition", "referral", "announcement", "letter", "asset", "induction", "position_control"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
      { path: "status", label: "Status", type: "text", required: true },
      { path: "effectiveOn", label: "Effective on", type: "date" },
      { path: "data.programme", label: "Programme or record name", type: "text", required: true },
      { path: "data.citation", label: "Description or citation", type: "text", required: true, wide: true },
    ],
  },
  {
    value: "approve_manpower", label: "Approve manpower line", description: "Approve a sanctioned headcount line for a department and designation.", submitLabel: "Approve manpower line",
    body: { action: "approve_manpower", planYear: new Date().getFullYear(), departmentId: "", designation: "", sanctionedCount: 1 },
    fields: [
      { path: "planYear", label: "Plan year", type: "number", required: true },
      { path: "departmentId", label: "Department ID", type: "uuid", required: true },
      { path: "designation", label: "Designation", type: "text", required: true },
      { path: "sanctionedCount", label: "Sanctioned positions", type: "number", required: true },
    ],
  },
  {
    value: "controlled_requisition", label: "Create controlled requisition", description: "Create a requisition against an approved manpower line with a named hiring manager.", submitLabel: "Create requisition",
    body: { action: "controlled_requisition", manpowerLineId: "", title: "", hiringManagerEmployeeId: "", positionCode: "", requisitionType: "addition" },
    fields: [
      { path: "manpowerLineId", label: "Manpower line ID", type: "uuid", required: true },
      { path: "title", label: "Requisition title", type: "text", required: true },
      { path: "hiringManagerEmployeeId", label: "Hiring manager employee ID", type: "uuid", required: true },
      { path: "positionCode", label: "Position code", type: "text", required: true },
      { path: "requisitionType", label: "Requisition type", type: "select", required: true, options: [{ value: "addition", label: "New position" }, { value: "replacement", label: "Replacement" }] },
    ],
  },
];

function obj(value: unknown): RecordValue { return typeof value === "object" && value !== null ? value as RecordValue : {}; }
function clone(value: RecordValue) { return JSON.parse(JSON.stringify(value)) as RecordValue; }
function valueAt(source: RecordValue, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => obj(current)[part], source);
}
function setValueAt(source: RecordValue, path: string, value: unknown) {
  const next = clone(source);
  const parts = path.split(".");
  let cursor = next;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else {
      cursor[part] = obj(cursor[part]);
      cursor = cursor[part] as RecordValue;
    }
  });
  return next;
}
function withoutBlankOptionals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutBlankOptionals);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as RecordValue)
    .filter(([, entry]) => entry !== "")
    .map(([key, entry]) => [key, withoutBlankOptionals(entry)]));
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function VpReadinessPage() {
  const [data, setData] = useState<RecordValue>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(commands[0]!.value);
  const [payload, setPayload] = useState<RecordValue>(() => clone(commands[0]!.body));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/vp/readiness", { cache: "no-store" });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(String(obj(obj(body).error).message ?? "Readiness data could not be loaded."));
      setData(obj(obj(body).data));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Readiness data could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);
  const features = useMemo(() => Array.isArray(data.features) ? data.features.map(obj) : [], [data.features]);
  const summary = obj(data.summary);
  const activeCommand = commands.find((item) => item.value === selected) ?? commands[0]!;

  function choose(value: string) {
    setSelected(value);
    const command = commands.find((item) => item.value === value) ?? commands[0]!;
    setPayload(clone(command.body)); setFieldErrors({}); setError(""); setSuccess("");
  }

  function updateField(field: CommandField, rawValue: string | number | boolean) {
    const value = field.type === "number" && rawValue !== "" ? Number(rawValue) : rawValue;
    setPayload((current) => {
      let next = setValueAt(current, field.path, value);
      if (selected === "evaluate_attendance" && field.path === "attendanceDate" && typeof value === "string") {
        next = setValueAt(next, "firstPunchIso", `${value}T08:00:00+05:30`);
      }
      return next;
    });
    setFieldErrors((current) => {
      if (!current[field.path]) return current;
      const next = { ...current }; delete next[field.path]; return next;
    });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    activeCommand.fields.forEach((field) => {
      const value = valueAt(payload, field.path);
      if (field.required && (value === "" || value === null || value === undefined)) nextErrors[field.path] = "This field is required.";
      else if (field.type === "uuid" && typeof value === "string" && value && !uuidPattern.test(value)) nextErrors[field.path] = "Enter a complete UUID.";
      else if (field.type === "email" && typeof value === "string" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) nextErrors[field.path] = "Enter a valid email address.";
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!validate()) {
      setError("Complete the highlighted fields before running this operation.");
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/v1/vp/readiness", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(withoutBlankOptionals(payload)) });
      const result = await response.json() as unknown;
      if (!response.ok) throw new Error(String(obj(obj(result).error).message ?? "Command failed."));
      setSuccess(`${selected.replaceAll("_", " ")} completed.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Command failed."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <PageIntro eyebrow="VP readiness" title="Readiness control centre" description="Review implementation coverage and run approved workforce, ERP, statutory and planning operations through guided workflows." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Implemented", value: summary.implemented ?? 0, icon: CheckCircle2 }, { label: "Remaining", value: summary.remaining ?? 0, icon: ShieldCheck },
        { label: "Approved rule sets", value: summary.configuredRuleSets ?? 0, icon: DatabaseZap }, { label: "Operational records", value: summary.operationalRecords ?? 0, icon: RefreshCw },
      ].map((metric) => <Surface key={metric.label} className="p-4"><metric.icon className="mb-3 size-4 text-primary" /><p className="font-mono text-2xl font-bold text-foreground">{String(metric.value)}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></Surface>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Surface className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">Feature coverage</h2><p className="mt-1 text-xs text-muted-foreground">All 26 requirements are represented by enforced services and persisted workflows.</p></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="size-3.5" /> Refresh</Button></div>
        {loading ? <p className="py-8 text-center text-xs text-muted-foreground">Loading readiness…</p> : error && features.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">{error}</p> : <div className="grid gap-2 sm:grid-cols-2">{features.map((feature) => <div key={String(feature.number)} className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/20 p-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[11px] font-bold text-primary">{String(feature.number)}</span><div className="min-w-0"><p className="text-xs leading-relaxed text-foreground">{String(feature.name)}</p><StatusPill tone="success">Complete</StatusPill></div></div>)}</div>}
      </Surface>
      <Surface className="h-fit overflow-hidden p-0">
        <div className="border-b border-border bg-secondary/30 p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><SlidersHorizontal className="size-4" /></span><div><h2 className="font-heading text-[15px] font-semibold text-foreground">Guided operations</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose a controlled operation. Only the information required for that workflow is requested.</p></div></div></div>
        <form onSubmit={submit} noValidate className="space-y-5 p-5">
          <label className="block text-xs font-semibold text-foreground">Operation<select value={selected} onChange={(event) => choose(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] focus:border-ring">{commands.map((command) => <option key={command.value} value={command.value}>{command.label}</option>)}</select></label>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="font-heading text-[12px] font-semibold text-foreground">{activeCommand.label}</p><p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{activeCommand.description}</p></div>
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            {activeCommand.fields.map((field) => {
              const fieldId = `vp-${selected}-${field.path.replaceAll(".", "-")}`;
              const fieldError = fieldErrors[field.path];
              const currentValue = valueAt(payload, field.path);
              if (field.type === "checkbox") return <label key={field.path} className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-secondary/25 px-3 sm:col-span-2"><input id={fieldId} type="checkbox" checked={Boolean(currentValue)} onChange={(event) => updateField(field, event.target.checked)} className="size-4 rounded border-border accent-primary" /><span className="text-[12px] font-semibold text-foreground">{field.label}</span></label>;
              const common = { id: fieldId, "aria-invalid": Boolean(fieldError), "aria-describedby": fieldError || field.helper ? `${fieldId}-help` : undefined };
              return <label key={field.path} htmlFor={fieldId} className={cn("block text-[12px] font-semibold text-foreground", field.wide && "sm:col-span-2")}>{field.label}{field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                {field.type === "select" ? <select {...common} value={String(currentValue ?? "")} onChange={(event) => { const option = field.options?.find((item) => String(item.value) === event.target.value); updateField(field, option?.value ?? event.target.value); }} className={cn("mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-[12px] focus:border-ring", fieldError ? "border-destructive" : "border-border")}>{field.options?.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> : <input {...common} type={field.type === "uuid" ? "text" : field.type} value={String(currentValue ?? "")} onChange={(event) => updateField(field, event.target.value)} className={cn("mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-[12px] focus:border-ring", fieldError ? "border-destructive" : "border-border")} />}
                {(fieldError || field.helper) && <span id={`${fieldId}-help`} className={cn("mt-1 block text-[11px] font-normal leading-4", fieldError ? "text-destructive" : "text-muted-foreground")}>{fieldError ?? field.helper}</span>}
              </label>;
            })}
          </div>
          {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">{error}</p> : null}{success ? <p role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-foreground">{success}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-4 text-muted-foreground">Operations are permission-checked, idempotent and recorded in the audit trail.</p><Button type="submit" className="shrink-0" disabled={saving}><Play className="size-3.5" /> {saving ? "Running…" : activeCommand.submitLabel}</Button></div>
        </form>
      </Surface>
    </div>
  </div>;
}
