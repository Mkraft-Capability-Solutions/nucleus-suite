"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { DataTable, PageIntro, SectionHeading, StateBlock, StatusPill, Surface, type Column } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.trunc(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
}

/** "1234.50" -> 123450 without a float in between; null for blank; NaN when the text is not money. */
function minorFromText(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return Number.NaN;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function textFromMinor(amountMinor: number | null): string {
  if (amountMinor === null) return "";
  return `${Math.trunc(amountMinor / 100)}.${String(Math.abs(amountMinor) % 100).padStart(2, "0")}`;
}

let fallbackKeyCounter = 0;
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

/**
 * Every write goes to `/api/v1/payroll/components…`, which owns the rules (unique
 * code, live references, no cycles, GL accounts active, versioning once a finalized
 * run used the component). A refusal is shown in the server's own words.
 */
async function mutate(path: string, method: "POST" | "PATCH", body: UnknownRecord | null, version?: number): Promise<{ ok: boolean; message: string; details: string[] }> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (method === "POST") headers["Idempotency-Key"] = idempotencyKey();
    if (version !== undefined) headers["If-Match"] = `"${version}"`;
    const response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved.", details: [] };
    const error = asRecord(payload.error);
    return {
      ok: false,
      message: str(error.message, `Request failed (${response.status}).`),
      details: list(error.details).map((detail) => `${str(detail.field)}: ${str(detail.issue)}`),
    };
  } catch {
    return { ok: false, message: "Could not reach the server.", details: [] };
  }
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

type VersionRow = { definitionVersion: number; effectiveFrom: string; effectiveTo: string; supersededAt: string; calculationMethod: string; taxable: boolean };

type ComponentRow = {
  id: string;
  version: number;
  code: string;
  kind: string;
  name: string;
  payslipLabel: string;
  calculationMethod: string;
  percentageOf: string;
  percentValue: number | null;
  formulaExpression: string;
  slabTableRef: string;
  rounding: string;
  proratedOnAttendance: boolean;
  prorationBasis: string;
  partOfPfWage: boolean;
  partOfEsiWage: boolean;
  partOfGratuityWage: boolean;
  partOfBonusWage: boolean;
  countsTowardWageFloor: boolean;
  taxable: boolean;
  exemptionSection: string;
  exemptionLimitMinor: number | null;
  isPerquisite: boolean;
  glDebitAccountId: string;
  glCreditAccountId: string;
  glDimensions: string[];
  printOnPayslipWhenZero: boolean;
  payslipSequence: number | null;
  effectiveFrom: string;
  definitionVersion: number;
  status: string;
  governedByRule: string;
  lineCount: number;
  lastFinalizedPeriod: string;
  dependents: string[];
  history: VersionRow[];
};

function componentFrom(item: UnknownRecord): ComponentRow {
  const usage = asRecord(item.usage);
  return {
    id: str(item.id),
    version: num(item.version) ?? 1,
    code: str(item.code),
    kind: str(item.kind, "earning"),
    name: str(item.name),
    payslipLabel: str(item.payslipLabel),
    calculationMethod: str(item.calculationMethod, "fixed_amount"),
    percentageOf: str(item.percentageOf),
    percentValue: num(item.percentValue),
    formulaExpression: str(item.formulaExpression),
    slabTableRef: str(item.slabTableRef),
    rounding: str(item.rounding, "nearest_rupee"),
    proratedOnAttendance: bool(item.proratedOnAttendance),
    prorationBasis: str(item.prorationBasis),
    partOfPfWage: bool(item.partOfPfWage),
    partOfEsiWage: bool(item.partOfEsiWage),
    partOfGratuityWage: bool(item.partOfGratuityWage),
    partOfBonusWage: bool(item.partOfBonusWage),
    countsTowardWageFloor: bool(item.countsTowardWageFloor),
    taxable: bool(item.taxable),
    exemptionSection: str(item.exemptionSection, "not_exempt"),
    exemptionLimitMinor: num(item.exemptionLimitMinor),
    isPerquisite: bool(item.isPerquisite),
    glDebitAccountId: str(item.glDebitAccountId),
    glCreditAccountId: str(item.glCreditAccountId),
    glDimensions: strings(item.glDimensions),
    printOnPayslipWhenZero: bool(item.printOnPayslipWhenZero),
    payslipSequence: num(item.payslipSequence),
    effectiveFrom: str(item.effectiveFrom),
    definitionVersion: num(item.definitionVersion) ?? 1,
    status: str(item.status, "active"),
    governedByRule: str(item.governedByRule),
    lineCount: num(usage.lineCount) ?? 0,
    lastFinalizedPeriod: str(usage.lastFinalizedPeriod),
    dependents: strings(item.dependents),
    history: list(item.history).map((entry) => ({
      definitionVersion: num(entry.definitionVersion) ?? 0,
      effectiveFrom: str(entry.effectiveFrom),
      effectiveTo: str(entry.effectiveTo),
      supersededAt: str(entry.supersededAt),
      calculationMethod: str(entry.calculationMethod),
      taxable: bool(entry.taxable),
    })),
  };
}

type GlAccount = { id: string; code: string; name: string; status: string };

/** Cost dimensions a journal line can be split by: `JOURNAL_DIMENSIONS` in src/server/payroll/gl.ts. */
const GL_DIMENSIONS: Array<{ value: string; label: string }> = [
  { value: "cost_center", label: "Cost centre" },
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "project", label: "Project" },
  { value: "run_type", label: "Run type" },
];

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

type FormState = {
  code: string;
  name: string;
  payslipLabel: string;
  kind: string;
  calculationMethod: string;
  percentageOf: string;
  percentValue: string;
  formulaExpression: string;
  slabTableRef: string;
  rounding: string;
  proratedOnAttendance: boolean;
  prorationBasis: string;
  partOfPfWage: boolean;
  partOfEsiWage: boolean;
  partOfGratuityWage: boolean;
  partOfBonusWage: boolean;
  countsTowardWageFloor: boolean;
  taxable: boolean;
  exemptionSection: string;
  exemptionLimit: string;
  isPerquisite: boolean;
  glDebitAccountId: string;
  glCreditAccountId: string;
  glDimensions: string[];
  printOnPayslipWhenZero: boolean;
  payslipSequence: string;
  effectiveFrom: string;
  status: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Workbook defaults for a new component; the fields with none stay blank. */
function emptyForm(): FormState {
  return {
    code: "", name: "", payslipLabel: "", kind: "earning", calculationMethod: "fixed_amount",
    percentageOf: "", percentValue: "", formulaExpression: "", slabTableRef: "",
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "calendar_days",
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: true,
    taxable: true, exemptionSection: "not_exempt", exemptionLimit: "", isPerquisite: false,
    glDebitAccountId: "", glCreditAccountId: "", glDimensions: ["cost_center"],
    printOnPayslipWhenZero: false, payslipSequence: "", effectiveFrom: todayIso(), status: "active",
  };
}

function formFrom(component: ComponentRow): FormState {
  return {
    code: component.code,
    name: component.name,
    payslipLabel: component.payslipLabel,
    kind: component.kind,
    calculationMethod: component.calculationMethod,
    percentageOf: component.percentageOf,
    percentValue: component.percentValue === null ? "" : String(component.percentValue),
    formulaExpression: component.formulaExpression,
    slabTableRef: component.slabTableRef,
    rounding: component.rounding,
    proratedOnAttendance: component.proratedOnAttendance,
    prorationBasis: component.prorationBasis || "calendar_days",
    partOfPfWage: component.partOfPfWage,
    partOfEsiWage: component.partOfEsiWage,
    partOfGratuityWage: component.partOfGratuityWage,
    partOfBonusWage: component.partOfBonusWage,
    countsTowardWageFloor: component.countsTowardWageFloor,
    taxable: component.taxable,
    exemptionSection: component.exemptionSection,
    exemptionLimit: textFromMinor(component.exemptionLimitMinor),
    isPerquisite: component.isPerquisite,
    glDebitAccountId: component.glDebitAccountId,
    glCreditAccountId: component.glCreditAccountId,
    glDimensions: component.glDimensions.length > 0 ? component.glDimensions : ["cost_center"],
    printOnPayslipWhenZero: component.printOnPayslipWhenZero,
    payslipSequence: component.payslipSequence === null ? "" : String(component.payslipSequence),
    effectiveFrom: component.effectiveFrom,
    status: component.status,
  };
}

/** Builds the request body, or names the first thing the form cannot send. */
function bodyFrom(form: FormState): { body: UnknownRecord } | { problem: string } {
  const sequence = Number(form.payslipSequence);
  if (form.payslipSequence.trim() === "" || !Number.isInteger(sequence)) return { problem: "Sequence on payslip must be a whole number." };
  const exemptionLimitMinor = minorFromText(form.exemptionLimit);
  if (Number.isNaN(exemptionLimitMinor)) return { problem: "Exemption limit must be an amount such as 1600.00." };
  const percentValue = form.percentValue.trim() === "" ? null : Number(form.percentValue);
  if (percentValue !== null && !Number.isFinite(percentValue)) return { problem: "Percentage value must be a number between 0 and 100." };
  if (form.effectiveFrom.trim() === "") return { problem: "Effective from is required." };
  return {
    body: {
      code: form.code.trim(),
      name: form.name.trim(),
      payslipLabel: form.payslipLabel.trim() === "" ? null : form.payslipLabel.trim(),
      kind: form.kind,
      calculationMethod: form.calculationMethod,
      percentageOf: form.percentageOf === "" ? null : form.percentageOf,
      percentValue,
      formulaExpression: form.formulaExpression.trim() === "" ? null : form.formulaExpression.trim(),
      slabTableRef: form.slabTableRef.trim() === "" ? null : form.slabTableRef.trim(),
      rounding: form.rounding,
      proratedOnAttendance: form.proratedOnAttendance,
      prorationBasis: form.proratedOnAttendance ? form.prorationBasis : null,
      partOfPfWage: form.partOfPfWage,
      partOfEsiWage: form.partOfEsiWage,
      partOfGratuityWage: form.partOfGratuityWage,
      partOfBonusWage: form.partOfBonusWage,
      countsTowardWageFloor: form.countsTowardWageFloor,
      taxable: form.taxable,
      exemptionSection: form.exemptionSection,
      exemptionLimitMinor,
      isPerquisite: form.isPerquisite,
      glDebitAccountId: form.glDebitAccountId,
      glCreditAccountId: form.glCreditAccountId,
      glDimensions: form.glDimensions,
      printOnPayslipWhenZero: form.printOnPayslipWhenZero,
      payslipSequence: sequence,
      effectiveFrom: form.effectiveFrom,
      status: form.status,
    },
  };
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground disabled:opacity-60";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground disabled:opacity-60";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground";
const toggleClass = "flex items-center gap-2 text-xs font-semibold text-foreground";

function methodTone(method: string): "info" | "violet" | "neutral" {
  if (method === "percentage_of_component" || method === "formula") return "info";
  if (method === "slab_table") return "violet";
  return "neutral";
}

function kindTone(kind: string): "success" | "danger" | "info" | "neutral" {
  if (kind === "earning" || kind === "reimbursement") return "success";
  if (kind === "deduction") return "danger";
  if (kind === "employer_contribution") return "info";
  return "neutral";
}

/** What the component's amount derives from, in one phrase, for the register. */
function basisText(component: ComponentRow): string {
  if (component.governedByRule) return `Rule pack ${component.governedByRule}`;
  if (component.calculationMethod === "percentage_of_component") {
    return `${component.percentValue === null ? "—" : `${component.percentValue}%`} of ${component.percentageOf || "—"}`;
  }
  if (component.calculationMethod === "formula") return component.formulaExpression || "No formula";
  if (component.calculationMethod === "slab_table") return component.slabTableRef ? `Slab ${component.slabTableRef}` : "No slab table";
  return picklistLabel("PL_CALC_METHOD", component.calculationMethod);
}

export function PayComponentMasterPage() {
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [accountsError, setAccountsError] = useState("");
  // Which list request has settled, and how. Keeping the outcome next to the path it came
  // from lets `loading` and `error` be derived during render: a new path is by definition
  // still loading and carries no error yet, so the effect does not have to say so
  // synchronously on every run (which is what made it cascade renders).
  const [loaded, setLoaded] = useState<{ path: string; error: string }>({ path: "", error: "" });
  const [revision, setRevision] = useState(0);
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [asOf, setAsOf] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string; details: string[] } | null>(null);

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  const listPath = useMemo(() => (asOf ? `/api/v1/payroll/components?asOf=${encodeURIComponent(asOf)}` : "/api/v1/payroll/components"), [asOf]);

  const loading = loaded.path !== listPath;
  const error = loaded.path === listPath ? loaded.error : "";

  useEffect(() => {
    let live = true;
    getJson(listPath)
      .then((payload) => {
        if (!live) return;
        setComponents(list(asRecord(payload).data).map(componentFrom));
        setLoaded({ path: listPath, error: "" });
      })
      .catch((cause: unknown) => {
        if (live) setLoaded({ path: listPath, error: cause instanceof Error ? cause.message : "The component master could not be loaded." });
      });
    // The chart of accounts backs the two GL lookups. A caller without
    // payroll.accounting.read still sees the master; the lookups then say why they are empty.
    getJson("/api/v1/gl-accounts")
      .then((payload) => {
        if (!live) return;
        setAccounts(list(asRecord(payload).data).map((item) => ({ id: str(item.id), code: str(item.code), name: str(item.name), status: str(item.status, "active") })));
        setAccountsError("");
      })
      .catch((cause: unknown) => {
        if (live) setAccountsError(cause instanceof Error ? cause.message : "The chart of accounts could not be loaded.");
      });
    return () => {
      live = false;
    };
  }, [listPath, revision]);

  const selected = useMemo(() => components.find((component) => component.id === selectedId) ?? null, [components, selectedId]);

  // Adjusting state because the selection changed, done during render with the previous
  // value rather than in an effect: React re-runs this component before touching the DOM,
  // so the form never paints one row's values under another row's heading.
  const selectionKey = creating ? "__creating__" : (selected?.id ?? "");
  const [appliedSelection, setAppliedSelection] = useState(selectionKey);
  if (appliedSelection !== selectionKey) {
    setAppliedSelection(selectionKey);
    if (!creating) {
      setForm(selected ? formFrom(selected) : emptyForm());
      setNotice(null);
    }
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return components.filter((component) => {
      if (kindFilter !== "all" && component.kind !== kindFilter) return false;
      if (statusFilter !== "all" && component.status !== statusFilter) return false;
      if (needle && !`${component.code} ${component.name} ${component.payslipLabel}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [components, kindFilter, statusFilter, search]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const accountLabel = (id: string): string => {
    if (!id) return "Not supplied";
    const account = accountById.get(id);
    return account ? `${account.code} ${account.name}` : id;
  };

  const editingLocked = selected !== null && selected.lineCount > 0;
  const governedRule = !creating && selected ? selected.governedByRule : "";
  const referenceOptions = components.filter((component) => component.status === "active" && component.code !== form.code);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const startCreate = () => {
    setSelectedId("");
    setCreating(true);
    setForm(emptyForm());
    setNotice(null);
  };

  const save = async () => {
    const built = bodyFrom(form);
    if ("problem" in built) {
      setNotice({ tone: "danger", message: built.problem, details: [] });
      return;
    }
    setBusy("save");
    const result = creating || !selected
      ? await mutate("/api/v1/payroll/components", "POST", built.body)
      : await mutate(`/api/v1/payroll/components/${selected.id}`, "PATCH", built.body, selected.version);
    setBusy("");
    setNotice({ tone: result.ok ? "success" : "danger", message: result.ok ? (creating ? "Component created." : "Component saved.") : result.message, details: result.details });
    if (result.ok) {
      setCreating(false);
      refresh();
    }
  };

  const transition = async (action: "activate" | "retire") => {
    if (!selected) return;
    setBusy(action);
    const result = await mutate(`/api/v1/payroll/components/${selected.id}/${action}`, "POST", null, selected.version);
    setBusy("");
    setNotice({ tone: result.ok ? "success" : "danger", message: result.ok ? (action === "retire" ? "Component retired." : "Component activated.") : result.message, details: result.details });
    if (result.ok) refresh();
  };

  const columns: Column<ComponentRow>[] = [
    { key: "sequence", header: "Seq", width: "56px", align: "right", render: (row) => <span className="tabular-nums">{row.payslipSequence ?? "—"}</span> },
    { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: "name", header: "Component", render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{row.name}</p>
        {row.payslipLabel !== row.name && <p className="truncate text-xs text-muted-foreground">Payslip: {row.payslipLabel}</p>}
      </div>
    ) },
    { key: "kind", header: "Type", render: (row) => <StatusPill tone={kindTone(row.kind)}>{picklistLabel("PL_COMPONENT_TYPE", row.kind)}</StatusPill> },
    { key: "method", header: "Basis", render: (row) => (
      <div className="min-w-0">
        <StatusPill tone={methodTone(row.calculationMethod)}>{picklistLabel("PL_CALC_METHOD", row.calculationMethod)}</StatusPill>
        <p className="mt-1 truncate text-xs text-muted-foreground">{basisText(row)}</p>
      </div>
    ) },
    { key: "tax", header: "Tax", render: (row) => (
      <span className="text-xs">{row.taxable ? "Taxable" : "Not taxable"}{row.exemptionSection !== "not_exempt" ? ` · ${picklistLabel("PL_EXEMPTION_SECTION", row.exemptionSection)}` : ""}</span>
    ) },
    { key: "gl", header: "GL", render: (row) => (
      row.glDebitAccountId && row.glCreditAccountId
        ? <span className="text-xs">Dr {accountLabel(row.glDebitAccountId)} / Cr {accountLabel(row.glCreditAccountId)}</span>
        : <StatusPill tone="warning">GL accounts not supplied</StatusPill>
    ) },
    { key: "effective", header: "Effective", render: (row) => (
      <span className="text-xs tabular-nums">{row.effectiveFrom || "Since inception"} · v{row.definitionVersion}</span>
    ) },
    { key: "status", header: "Status", render: (row) => (
      <StatusPill tone={row.status === "active" ? "success" : "neutral"} dot>{picklistLabel("PL_ACTIVE_STATUS", row.status)}</StatusPill>
    ) },
  ];

  return (
    <div className="min-w-0">
      <PageIntro
        eyebrow="Payroll · FRM-PAY-01"
        title="Pay component master"
        description="Every earning, deduction, contribution, reimbursement and information line the payroll engine can produce: how it is calculated, which statutory wage bases it enters, how it is taxed, where it posts, and when each version took effect."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCcw /> Refresh</Button>
            <Button size="sm" onClick={startCreate}><Plus /> New component</Button>
          </div>
        }
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Surface className="min-w-0">
          <SectionHeading
            title="Register"
            description={asOf ? `Definitions in force on ${asOf}; a component that did not yet exist is omitted.` : "Current definition of each component."}
          />
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className={labelClass}>Type
              <select className={selectClass} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
                <option value="all">All types</option>
                {picklists.PL_COMPONENT_TYPE.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>Status
              <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {picklists.PL_ACTIVE_STATUS.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>As of
              <input type="date" className={inputClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <label className={`${labelClass} flex-1`}>Search
              <input className={`${inputClass} w-full`} placeholder="Code, name or payslip label" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
          {error ? (
            <StateBlock tone="error" icon={AlertTriangle} title="The component master could not be loaded" description={error} action={<Button variant="outline" size="sm" onClick={refresh}>Retry</Button>} />
          ) : loading && components.length === 0 ? (
            <StateBlock tone="loading" title="Loading components" />
          ) : (
            <DataTable
              columns={columns}
              rows={visible}
              rowKey={(row) => row.id}
              minWidth={960}
              selectedKey={creating ? "" : selectedId}
              onRowClick={(row) => { setCreating(false); setSelectedId(row.id); }}
              caption="Pay components"
              empty={<StateBlock title="No components match" description="Clear the filters, or create the first component." />}
            />
          )}
        </Surface>

        <Surface className="min-w-0">
          {!creating && !selected ? (
            <StateBlock title="Select a component" description="Pick a row to review or edit its definition, or create a new component." action={<Button size="sm" onClick={startCreate}><Plus /> New component</Button>} />
          ) : (
            <form
              className="flex min-w-0 flex-col gap-5"
              onSubmit={(event) => { event.preventDefault(); void save(); }}
            >
              <SectionHeading
                title={creating ? "New component" : `${selected?.name ?? ""}`}
                description={creating ? "Fields marked * are required." : `v${selected?.definitionVersion ?? 1} · row version ${selected?.version ?? 1}`}
                action={!creating && selected ? (
                  selected.status === "active"
                    ? <Button type="button" variant="outline" size="sm" disabled={busy !== ""} onClick={() => void transition("retire")}>Retire</Button>
                    : <Button type="button" variant="outline" size="sm" disabled={busy !== ""} onClick={() => void transition("activate")}>Activate</Button>
                ) : undefined}
              />

              {!creating && selected && (selected.lineCount > 0 || selected.dependents.length > 0 || governedRule) && (
                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  {selected.lineCount > 0 && (
                    <p>
                      {selected.lineCount} payslip line(s) reference this component, so its code and type are frozen.
                      {selected.lastFinalizedPeriod
                        ? ` A finalized run for ${selected.lastFinalizedPeriod} used it: a calculation change must take effect after that period and creates version ${selected.definitionVersion + 1}.`
                        : " No finalized run has used it yet."}
                    </p>
                  )}
                  {selected.dependents.length > 0 && <p className="mt-1">Derived from by: {selected.dependents.join(", ")}. Retirement is refused while they are active.</p>}
                  {governedRule && <p className="mt-1">The rate or slab for this component comes from rule pack <span className="font-mono">{governedRule}</span>; it is not entered here and stays unavailable until that rule is supplied.</p>}
                </div>
              )}

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-bold text-foreground">Component</legend>
                <label className={labelClass}>Component code *
                  <input className={inputClass} value={form.code} maxLength={15} disabled={editingLocked} onChange={(e) => update("code", e.target.value)} />
                </label>
                <label className={labelClass}>Component name *
                  <input className={inputClass} value={form.name} maxLength={60} onChange={(e) => update("name", e.target.value)} />
                </label>
                <label className={labelClass}>Payslip label
                  <input className={inputClass} value={form.payslipLabel} maxLength={40} placeholder="Same as name" onChange={(e) => update("payslipLabel", e.target.value)} />
                </label>
                <label className={labelClass}>Type *
                  <select className={selectClass} value={form.kind} disabled={editingLocked} onChange={(e) => update("kind", e.target.value)}>
                    {picklists.PL_COMPONENT_TYPE.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Calculation method *
                  <select className={selectClass} value={form.calculationMethod} onChange={(e) => update("calculationMethod", e.target.value)}>
                    {picklists.PL_CALC_METHOD.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                </label>
                {form.calculationMethod === "percentage_of_component" && (
                  <>
                    <label className={labelClass}>Percentage of {governedRule ? "" : "*"}
                      <select className={selectClass} value={form.percentageOf} onChange={(e) => update("percentageOf", e.target.value)}>
                        <option value="">{governedRule ? "Base set by the rule pack" : "Select a component"}</option>
                        {referenceOptions.map((component) => <option key={component.id} value={component.code}>{component.code} — {component.name}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Percentage value (0-100) {governedRule ? "" : "*"}
                      <input className={inputClass} inputMode="decimal" value={form.percentValue} disabled={Boolean(governedRule)} placeholder={governedRule ? `Rule pack ${governedRule}` : "e.g. 40"} onChange={(e) => update("percentValue", e.target.value)} />
                    </label>
                  </>
                )}
                {form.calculationMethod === "formula" && (
                  <label className={`${labelClass} sm:col-span-2`}>Formula *
                    <textarea className="min-h-20 rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-foreground" value={form.formulaExpression} maxLength={500} placeholder="e.g. min(basic * 0.5, 1500000)" onChange={(e) => update("formulaExpression", e.target.value)} />
                    <span className="font-normal">Reference components by code; allowed functions: min, max, round, floor, ceil, abs.</span>
                  </label>
                )}
                {form.calculationMethod === "slab_table" && (
                  <label className={`${labelClass} sm:col-span-2`}>Slab table {governedRule ? "" : "*"}
                    <input className={inputClass} value={form.slabTableRef} maxLength={120} placeholder={governedRule ? `Rule pack ${governedRule}` : "Slab table reference"} onChange={(e) => update("slabTableRef", e.target.value)} />
                    <span className="font-normal">There is no slab-table master yet; this is the reference the run will resolve against.</span>
                  </label>
                )}
                <label className={labelClass}>Rounding *
                  <select className={selectClass} value={form.rounding} onChange={(e) => update("rounding", e.target.value)}>
                    {picklists.PL_ROUNDING.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                </label>
                <div className="flex flex-col justify-end gap-2">
                  <label className={toggleClass}>
                    <input type="checkbox" className="size-4" checked={form.proratedOnAttendance} onChange={(e) => update("proratedOnAttendance", e.target.checked)} /> Prorated on attendance
                  </label>
                </div>
                {form.proratedOnAttendance && (
                  <label className={labelClass}>Proration basis *
                    <select className={selectClass} value={form.prorationBasis} onChange={(e) => update("prorationBasis", e.target.value)}>
                      {picklists.PL_PRORATION_BASIS.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                    </select>
                  </label>
                )}
              </fieldset>

              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-bold text-foreground">Statutory wage bases</legend>
                <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.partOfPfWage} onChange={(e) => update("partOfPfWage", e.target.checked)} /> Part of PF wage</label>
                <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.partOfEsiWage} onChange={(e) => update("partOfEsiWage", e.target.checked)} /> Part of ESI wage</label>
                <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.partOfGratuityWage} onChange={(e) => update("partOfGratuityWage", e.target.checked)} /> Part of gratuity wage</label>
                <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.partOfBonusWage} onChange={(e) => update("partOfBonusWage", e.target.checked)} /> Part of bonus wage</label>
                <label className={`${toggleClass} sm:col-span-2`}><input type="checkbox" className="size-4" checked={form.countsTowardWageFloor} onChange={(e) => update("countsTowardWageFloor", e.target.checked)} /> Counts toward the 50% wage floor (Code on Wages basic-share test)</label>
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-bold text-foreground">Tax</legend>
                <div className="flex flex-col justify-end gap-2">
                  <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.taxable} onChange={(e) => update("taxable", e.target.checked)} /> Taxable</label>
                  <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.isPerquisite} onChange={(e) => update("isPerquisite", e.target.checked)} /> Perquisite</label>
                </div>
                <label className={labelClass}>Exemption section
                  <select className={selectClass} value={form.exemptionSection} onChange={(e) => update("exemptionSection", e.target.value)}>
                    {picklists.PL_EXEMPTION_SECTION.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Exemption limit (INR)
                  <input className={inputClass} inputMode="decimal" value={form.exemptionLimit} placeholder="Not set" onChange={(e) => update("exemptionLimit", e.target.value)} />
                </label>
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-bold text-foreground">General ledger</legend>
                {accountsError && <p className="text-xs text-warning sm:col-span-2">Chart of accounts unavailable: {accountsError}</p>}
                <label className={labelClass}>Debit account *
                  <select className={selectClass} value={form.glDebitAccountId} onChange={(e) => update("glDebitAccountId", e.target.value)}>
                    <option value="">{accounts.length === 0 ? "No active accounts to choose from" : "Select an account"}</option>
                    {accounts.filter((account) => account.status === "active" || account.id === form.glDebitAccountId).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Credit account *
                  <select className={selectClass} value={form.glCreditAccountId} onChange={(e) => update("glCreditAccountId", e.target.value)}>
                    <option value="">{accounts.length === 0 ? "No active accounts to choose from" : "Select an account"}</option>
                    {accounts.filter((account) => account.status === "active" || account.id === form.glCreditAccountId).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Cost dimensions * (at least one)</p>
                  <div className="flex flex-wrap gap-3">
                    {GL_DIMENSIONS.map((dimension) => (
                      <label key={dimension.value} className={toggleClass}>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={form.glDimensions.includes(dimension.value)}
                          onChange={(e) => update("glDimensions", e.target.checked ? [...form.glDimensions, dimension.value] : form.glDimensions.filter((entry) => entry !== dimension.value))}
                        />
                        {dimension.label}
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-bold text-foreground">Control</legend>
                <label className={labelClass}>Sequence on payslip *
                  <input className={inputClass} inputMode="numeric" value={form.payslipSequence} onChange={(e) => update("payslipSequence", e.target.value)} />
                </label>
                <label className={labelClass}>Effective from *
                  <input type="date" className={inputClass} value={form.effectiveFrom} onChange={(e) => update("effectiveFrom", e.target.value)} />
                  {!creating && selected && !selected.effectiveFrom && <span className="font-normal">Seeded definition with no declared start; a dated calculation change starts version {selected.definitionVersion + 1}.</span>}
                </label>
                <label className={toggleClass}><input type="checkbox" className="size-4" checked={form.printOnPayslipWhenZero} onChange={(e) => update("printOnPayslipWhenZero", e.target.checked)} /> Print on payslip when zero</label>
                <label className={labelClass}>Status
                  <select className={selectClass} value={form.status} disabled={!creating} onChange={(e) => update("status", e.target.value)}>
                    {picklists.PL_ACTIVE_STATUS.values.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                  </select>
                  {!creating && <span className="font-normal">Use Retire / Activate to change the status of a saved component.</span>}
                </label>
              </fieldset>

              {notice && (
                <div className={`rounded-xl border p-3 text-xs ${notice.tone === "success" ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive"}`} role={notice.tone === "danger" ? "alert" : "status"}>
                  <p className="font-semibold">{notice.message}</p>
                  {notice.details.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {notice.details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={busy !== ""}>{busy === "save" ? "Saving…" : creating ? "Create component" : "Save changes"}</Button>
                {creating && <Button type="button" variant="ghost" size="sm" onClick={() => { setCreating(false); setForm(emptyForm()); }}>Cancel</Button>}
              </div>

              {!creating && selected && (
                <div>
                  <SectionHeading title="Versions" description="Earlier definitions stay frozen; a run resolves the one in force on its period." />
                  {selected.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground"><History className="mr-1 inline size-3.5" />Only the current definition (v{selected.definitionVersion}, from {selected.effectiveFrom || "inception"}).</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      <li className="flex flex-wrap justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                        <span className="font-semibold">v{selected.definitionVersion} (current)</span>
                        <span className="tabular-nums">{selected.effectiveFrom || "inception"} → open</span>
                      </li>
                      {selected.history.map((entry) => (
                        <li key={entry.definitionVersion} className="flex flex-wrap justify-between gap-2 rounded-lg px-3 py-2">
                          <span>v{entry.definitionVersion} · {picklistLabel("PL_CALC_METHOD", entry.calculationMethod)} · {entry.taxable ? "taxable" : "not taxable"}</span>
                          <span className="tabular-nums text-muted-foreground">{entry.effectiveFrom || "inception"} → {entry.effectiveTo || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.exemptionLimitMinor !== null && <p className="mt-2 text-xs text-muted-foreground">Exemption limit on the current definition: {money(selected.exemptionLimitMinor)}</p>}
                </div>
              )}
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
}
