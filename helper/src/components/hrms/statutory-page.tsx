"use client";

import { picklistLabel, picklistValues } from "@/lib/picklists";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileText, Info, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function nullableInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.trunc(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value.length > 10 ? value : `${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

/** The filing's workflow state, exactly as the `filings` resource records it. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "filed" || status === "approved") return "info";
  if (status === "submitted") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  return "neutral";
}

/** The due-date band, computed on the server from real dates. */
function bandTone(band: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (band === "overdue") return "danger";
  if (band === "due_soon") return "warning";
  if (band === "filed") return "success";
  if (band === "scheduled") return "info";
  return "neutral";
}

const BAND_LABELS: Record<string, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  scheduled: "Scheduled",
  filed: "Filed",
  closed: "Closed unfiled",
  unknown: "No due date",
};

type ActionRow = { action: string; label: string; to: string; approval: boolean; allowed: boolean; reason: string | null };

type GeneratedForm = {
  id: string;
  formCode: string;
  stateCode: string;
  period: string;
  status: string;
  templateVersion: number;
  documentId: string | null;
  filedAt: string | null;
  acknowledgementRef: string | null;
};

type Outcome = {
  filedOn: string | null;
  lateByDays: number | null;
  late: boolean;
  acknowledgementNumber: string | null;
  amountRemittedMinor: number | null;
  currency: string;
  challanReference: string | null;
  authority: string | null;
  evidenceDocumentId: string | null;
  lateFilingReason: string | null;
  recordedAt: string | null;
};

type FilingRow = {
  id: string;
  version: number;
  status: string;
  formCode: string;
  stateCode: string;
  period: string;
  dueDate: string | null;
  owner: string;
  notes: string | null;
  generatedFormId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  form: GeneratedForm | null;
  outcome: Outcome | null;
  band: string;
  daysUntilDue: number | null;
  lateByDays: number | null;
  actions: ActionRow[];
  generate: { allowed: boolean; reason: string | null };
};

type Register = {
  asOf: string;
  scopeNote: string | null;
  items: FilingRow[];
  bandCounts: Record<string, number>;
  remittance: { totalMinor: number | null; currency: string | null; recordedCount: number; missingCount: number; reason: string | null };
  unlinkedForms: GeneratedForm[];
  formCatalogue: { seeded: boolean; codes: string[]; note: string };
  disclaimer: string;
};

type HistoryRow = { id: string; action: string; reason: string | null; status: string | null; createdAt: string | null };

/** What the outcome form holds, as typed. Minor units are derived on submit. */
type OutcomeForm = {
  filedOn: string;
  acknowledgementNumber: string;
  amountRemitted: string;
  currency: string;
  challanReference: string;
  authority: string;
  evidenceDocumentId: string;
  lateFilingReason: string;
};

/**
 * Per-filing form state. Held with the filing id it belongs to so that
 * selecting another filing falls back to that filing's own defaults without an
 * effect resetting anything.
 */
type Draft = { id: string; ack: string; reason: string; outcome: OutcomeForm };

function defaultDraft(row: FilingRow | null): Draft {
  const amount = row?.outcome?.amountRemittedMinor;
  return {
    id: row?.id ?? "",
    ack: row?.outcome?.acknowledgementNumber ?? row?.form?.acknowledgementRef ?? "",
    reason: "",
    outcome: {
      filedOn: row?.outcome?.filedOn ?? "",
      acknowledgementNumber: row?.outcome?.acknowledgementNumber ?? row?.form?.acknowledgementRef ?? "",
      amountRemitted: amount === null || amount === undefined ? "" : money(amount),
      currency: row?.outcome?.currency ?? "INR",
      challanReference: row?.outcome?.challanReference ?? "",
      authority: row?.outcome?.authority ?? "",
      evidenceDocumentId: row?.outcome?.evidenceDocumentId ?? "",
      lateFilingReason: row?.outcome?.lateFilingReason ?? "",
    },
  };
}

function readForm(value: unknown): GeneratedForm | null {
  const form = asRecord(value);
  const id = str(form.id);
  if (!id) return null;
  return {
    id,
    formCode: str(form.formCode, "—"),
    stateCode: str(form.stateCode, "—"),
    period: str(form.period, "—"),
    status: str(form.status, "generated"),
    templateVersion: int(form.templateVersion),
    documentId: nullableStr(form.documentId),
    filedAt: nullableStr(form.filedAt),
    acknowledgementRef: nullableStr(form.acknowledgementRef),
  };
}

function readOutcome(value: unknown): Outcome | null {
  if (value === null || value === undefined) return null;
  const outcome = asRecord(value);
  return {
    filedOn: nullableStr(outcome.filedOn),
    lateByDays: nullableInt(outcome.lateByDays),
    late: outcome.late === true,
    acknowledgementNumber: nullableStr(outcome.acknowledgementNumber),
    amountRemittedMinor: nullableInt(outcome.amountRemittedMinor),
    currency: str(outcome.currency, "INR"),
    challanReference: nullableStr(outcome.challanReference),
    authority: nullableStr(outcome.authority),
    evidenceDocumentId: nullableStr(outcome.evidenceDocumentId),
    lateFilingReason: nullableStr(outcome.lateFilingReason),
    recordedAt: nullableStr(outcome.recordedAt),
  };
}

function readRegister(payload: unknown): Register {
  const data = asRecord(asRecord(payload).data);
  const items = (Array.isArray(data.items) ? (data.items as UnknownRecord[]) : []).map((item) => ({
    id: str(item.id),
    version: int(item.version) || 1,
    status: str(item.status, "draft"),
    formCode: str(item.formCode, "—"),
    stateCode: str(item.stateCode, "—"),
    period: str(item.period, "—"),
    dueDate: nullableStr(item.dueDate),
    owner: str(item.owner, "—"),
    notes: nullableStr(item.notes),
    generatedFormId: nullableStr(item.generatedFormId),
    createdAt: nullableStr(item.createdAt),
    updatedAt: nullableStr(item.updatedAt),
    form: readForm(item.form),
    outcome: readOutcome(item.outcome),
    band: str(item.band, "unknown"),
    daysUntilDue: nullableInt(item.daysUntilDue),
    lateByDays: nullableInt(item.lateByDays),
    actions: (Array.isArray(item.actions) ? (item.actions as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      label: str(entry.label, str(entry.action)),
      to: str(entry.to),
      approval: entry.approval === true,
      allowed: entry.allowed === true,
      reason: nullableStr(entry.reason),
    })),
    generate: { allowed: asRecord(item.generate).allowed === true, reason: nullableStr(asRecord(item.generate).reason) },
  }));
  const remittance = asRecord(data.remittance);
  const catalogue = asRecord(data.formCatalogue);
  return {
    asOf: str(data.asOf),
    scopeNote: nullableStr(data.scopeNote),
    items,
    bandCounts: Object.fromEntries(Object.entries(asRecord(data.bandCounts)).map(([band, count]) => [band, int(count)])),
    remittance: {
      totalMinor: nullableInt(remittance.totalMinor),
      currency: nullableStr(remittance.currency),
      recordedCount: int(remittance.recordedCount),
      missingCount: int(remittance.missingCount),
      reason: nullableStr(remittance.reason),
    },
    unlinkedForms: (Array.isArray(data.unlinkedForms) ? (data.unlinkedForms as unknown[]) : [])
      .map(readForm)
      .filter((form): form is GeneratedForm => form !== null),
    formCatalogue: {
      seeded: catalogue.seeded === true,
      codes: Array.isArray(catalogue.codes) ? (catalogue.codes as unknown[]).map((code) => String(code)) : [],
      note: str(catalogue.note),
    },
    disclaimer: str(data.disclaimer),
  };
}

function errorMessage(payload: unknown, status: number): string {
  const error = asRecord(asRecord(payload).error);
  const message = str(error.message);
  const details = (Array.isArray(error.details) ? (error.details as UnknownRecord[]) : [])
    .map((detail) => `${str(detail.field)}: ${str(detail.issue)}`)
    .filter((line) => line.trim() !== ":");
  if (!message) return `Request failed (${status}).`;
  return details.length > 0 ? `${message} ${details.join(" ")}` : message;
}

async function send(path: string, body: unknown, headers: Record<string, string> = {}): Promise<UnknownRecord> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload, response.status));
  return asRecord(asRecord(payload).data);
}

/**
 * R-27 / R-18: the forms whose merge values this screen derives from live records.
 * The codes match `STATUTORY_FORM_CODES` in src/server/compliance/statutory-forms.ts.
 */
const DERIVABLE_FORM_CODES: Array<[string, string]> = [
  ["FORM_F", "Form F — joining form (per employee)"],
  ["FORM_28", "Form 28 (establishment)"],
  ["FORM_18", "Form 18 (establishment)"],
  ["FORM_36", "Form 36 (establishment)"],
];

/** Forms issued against one employee rather than the establishment as a whole. */
const EMPLOYEE_FORM_CODES: readonly string[] = ["FORM_F"];

type Establishment = { id: string; code: string; name: string; state: string | null };
type PersonOption = { id: string; code: string; name: string };
type DerivedField = { field: string; source: string };
type MissingField = { field: string; source: string; issue: string };
type Derivation = {
  formCode: string;
  stateCode: string;
  period: string;
  establishmentKey: string;
  employeeId: string | null;
  values: Record<string, string | number>;
  sources: DerivedField[];
  missing: MissingField[];
  serialised: boolean;
};

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const labelClass = "flex w-full min-w-0 flex-col gap-1.5 sm:w-auto";
const legendClass = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

/** Approval transitions refuse the requester, so the screen says so up front. */
const MAKER_CHECKER_NOTE =
  "Approval, filing and acceptance are refused for the person who raised the filing. A second reviewer has to complete them.";

export function StatutoryPage() {
  // Deep-link preselect (?record=<filingId>); lazy initializer keeps SSR stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [register, setRegister] = useState<Register | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [bandFilter, setBandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [historyState, setHistoryState] = useState<{ id: string; rows: HistoryRow[]; error: string }>({ id: "", rows: [], error: "" });

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const [generateOpen, setGenerateOpen] = useState(false);
  // The state code is NOT captured here: it comes from the establishment, exactly
  // as the configuration register says ("State variant - from the establishment
  // state"), and no merge value on the form is typed at all.
  const [gForm, setGForm] = useState({ formCode: DERIVABLE_FORM_CODES[0]?.[0] ?? "FORM_F", locationId: "", employeeId: "", period: "" });
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [derivation, setDerivation] = useState<Derivation | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [rForm, setRForm] = useState({ generatedFormId: "", formCode: "", act: "", authority: "", stateCode: "", period: "", frequency: "monthly", dueDate: "", owner: "", notes: "" });
  const [draftState, setDraftState] = useState<Draft | null>(null);

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getJson("/api/v1/statutory-register");
        if (live) setRegister(readRegister(payload));
      } catch (caught) {
        if (live) {
          setRegister(null);
          setError(caught instanceof Error ? caught.message : "The statutory register could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  // The generate panel needs the establishment master and, for a per-employee
  // form, the people it can be raised for. Both are loaded only when the panel is
  // opened: the register itself does not need them.
  useEffect(() => {
    if (!generateOpen) return;
    let live = true;
    void (async () => {
      try {
        const tree = asRecord(asRecord(await getJson("/api/v1/organization/tree")).data);
        const rows = Array.isArray(tree.locations) ? (tree.locations as UnknownRecord[]) : [];
        if (live) {
          setEstablishments(
            rows.map((row) => {
              const attributes = asRecord(row.attributes);
              return {
                id: str(row.id),
                code: str(attributes.code, str(row.id).slice(0, 8)),
                name: str(attributes.name, "Unnamed establishment"),
                state: nullableStr(attributes.state),
              };
            }),
          );
        }
      } catch {
        if (live) setEstablishments([]);
      }
      try {
        const payload = asRecord(await getJson("/api/v1/people?page=1&pageSize=200"));
        const rows = Array.isArray(payload.data) ? (payload.data as UnknownRecord[]) : [];
        if (live) {
          setPeople(
            rows.map((row) => {
              const attributes = asRecord(row.attributes);
              const source = Object.keys(attributes).length > 0 ? attributes : row;
              const name = [str(source.firstName, str(source.first_name)), str(source.lastName, str(source.last_name))].filter(Boolean).join(" ").trim();
              return {
                id: str(row.id, str(source.id)),
                code: str(source.employeeCode, str(source.employee_code)),
                name: name.length > 0 ? name : str(source.employeeCode, str(source.employee_code)),
              };
            }).filter((person) => person.id.length > 0),
          );
        }
      } catch {
        if (live) setPeople([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [generateOpen]);

  const items = useMemo(() => register?.items ?? [], [register]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((row) => {
      if (bandFilter !== "all" && row.band !== bandFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (needle && !`${row.formCode} ${row.stateCode} ${row.period} ${row.owner}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, bandFilter, statusFilter, search]);

  const active = useMemo(
    () => items.find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [items, selectedId, filtered],
  );
  const activeId = active?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson(`/api/v1/operations/filings/${encodeURIComponent(activeId)}/history?pageSize=50`);
        const rows = (Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : []).map((row) => ({
          id: str(row.id),
          action: str(row.action, "—"),
          reason: nullableStr(row.reason),
          status: nullableStr(row.status),
          createdAt: nullableStr(row.created_at) ?? nullableStr(row.createdAt),
        }));
        if (live) setHistoryState({ id: activeId, rows, error: "" });
      } catch (caught) {
        if (live) {
          setHistoryState({ id: activeId, rows: [], error: caught instanceof Error ? caught.message : "The audit trail could not be loaded." });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  // Held per filing, so a different selection shows that filing's own values
  // without an effect reaching in to reset anything.
  const history = historyState.id === activeId ? historyState.rows : [];
  const historyError = historyState.id === activeId ? historyState.error : "";
  const draft = draftState !== null && draftState.id === activeId ? draftState : defaultDraft(active);
  const outcome = draft.outcome;
  const ackReference = draft.ack;
  const transitionReason = draft.reason;

  function updateDraft(patch: Partial<Omit<Draft, "id">>): void {
    setDraftState({ ...draft, ...patch, id: activeId });
  }

  function updateOutcome(patch: Partial<OutcomeForm>): void {
    updateDraft({ outcome: { ...draft.outcome, ...patch } });
  }

  function selectFiling(id: string): void {
    setSelectedId(id);
    setNotice("");
    setActionError("");
  }

  /**
   * Client-side hint only. ISO dates compare correctly as strings, so this is
   * the same comparison the server makes — but the server is the enforcement
   * point and will refuse a late filing with no reason regardless.
   */
  const lateHint = useMemo(() => {
    if (!active?.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(outcome.filedOn)) return false;
    return outcome.filedOn > active.dueDate;
  }, [active, outcome.filedOn]);

  async function run(label: string, work: () => Promise<string>): Promise<void> {
    setBusy(label);
    setActionError("");
    setNotice("");
    try {
      setNotice(await work());
      refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  /**
   * Query string for the derivation endpoint. It never allocates a serial: the
   * command takes and binds the register number itself, and asking for one here
   * too would burn two numbers on one form.
   */
  function derivationQuery(): string {
    const params = new URLSearchParams({
      view: "derivation",
      formCode: gForm.formCode,
      locationId: gForm.locationId,
      period: gForm.period.trim(),
    });
    if (gForm.employeeId) params.set("employeeId", gForm.employeeId);
    return `/api/v1/compliance/statutory-forms?${params.toString()}`;
  }

  function readDerivation(payload: unknown): Derivation {
    const data = asRecord(asRecord(payload).data);
    const attributes = asRecord(data.attributes);
    return {
      formCode: str(attributes.formCode),
      stateCode: str(attributes.stateCode),
      period: str(attributes.period),
      establishmentKey: str(attributes.establishmentKey),
      employeeId: nullableStr(attributes.employeeId),
      values: asRecord(attributes.values) as Record<string, string | number>,
      sources: (Array.isArray(attributes.sources) ? (attributes.sources as UnknownRecord[]) : []).map((row) => ({
        field: str(row.field),
        source: str(row.source),
      })),
      missing: (Array.isArray(attributes.missing) ? (attributes.missing as UnknownRecord[]) : []).map((row) => ({
        field: str(row.field),
        source: str(row.source),
        issue: str(row.issue),
      })),
      serialised: attributes.serialised === true,
    };
  }

  function requireGenerationInputs(): void {
    if (!gForm.formCode || !gForm.locationId || !gForm.period.trim()) {
      throw new Error("Choose the form, the establishment and the period it covers.");
    }
    if (EMPLOYEE_FORM_CODES.includes(gForm.formCode) && !gForm.employeeId) {
      throw new Error("This form is issued per employee; choose the employee it is being generated for.");
    }
  }

  /** Show what the records supply before a register serial is consumed. */
  function previewValues(): void {
    void run("preview", async () => {
      requireGenerationInputs();
      const preview = readDerivation(await getJson(derivationQuery()));
      setDerivation(preview);
      return preview.missing.length === 0
        ? `${preview.values ? Object.keys(preview.values).length : 0} value(s) derived from live records for ${preview.stateCode} ${preview.formCode}. Nothing is typed in.`
        : `${preview.missing.length} value(s) have no source record yet. Complete those records before generating; nothing is substituted.`;
    });
  }

  function generateForm(): void {
    void run("generate", async () => {
      requireGenerationInputs();
      // The command derives every merge value, takes the register serial and binds
      // or voids it in the same call, so the screen no longer pre-allocates one:
      // two allocations for one form is exactly the gap RP-13 must not have. The
      // derivation is read here only so the screen can show what was used.
      const derived = readDerivation(await getJson(derivationQuery()));
      setDerivation(derived);
      const data = await send("/api/v1/commands/generate_statutory_form", {
        formCode: derived.formCode,
        period: derived.period,
        locationId: gForm.locationId,
        ...(derived.employeeId ? { employeeId: derived.employeeId } : {}),
      });
      setGenerateOpen(false);
      setRForm((form) => ({
        ...form,
        generatedFormId: str(data.id),
        formCode: derived.formCode,
        stateCode: derived.stateCode,
        period: derived.period,
      }));
      setRaiseOpen(true);
      const serialNumber = int(data.serialNumber);
      const serialNote = serialNumber > 0 ? ` Register serial ${serialNumber} issued for ${derived.establishmentKey}.` : "";
      return `Form instance generated from template version ${int(data.templateVersion)}; every value came from the employee, establishment and payroll records.${serialNote} Nothing has been sent to an authority.`;
    });
  }

  function raiseFiling(): void {
    void run("raise", async () => {
      const body: UnknownRecord = {
        formCode: rForm.formCode.trim(),
        act: rForm.act.trim(),
        authority: rForm.authority.trim(),
        stateCode: rForm.stateCode.trim().toUpperCase(),
        period: rForm.period.trim(),
        frequency: rForm.frequency,
        generatedFormId: rForm.generatedFormId,
        dueDate: rForm.dueDate,
        owner: rForm.owner.trim(),
      };
      if (rForm.notes.trim()) body.notes = rForm.notes.trim();
      const data = await send("/api/v1/operations/filings", body);
      setRaiseOpen(false);
      selectFiling(str(data.id));
      setRForm({ generatedFormId: "", formCode: "", act: "", authority: "", stateCode: "", period: "", frequency: "monthly", dueDate: "", owner: "", notes: "" });
      return "Filing raised as a draft.";
    });
  }

  function transition(row: FilingRow, action: string): void {
    void run(action, async () => {
      const body: UnknownRecord = { reason: transitionReason.trim() || `Filing ${action}` };
      if (action === "file" || action === "accept") body.acknowledgementReference = ackReference.trim();
      await send(`/api/v1/operations/filings/${encodeURIComponent(row.id)}/${action}`, body, { "If-Match": String(row.version) });
      updateDraft({ reason: "" });
      if (action === "file") return "Recorded that this filing was completed with the authority outside this system.";
      if (action === "accept") return "Recorded the acknowledgement the authority issued outside this system.";
      return `Filing ${action}${action.endsWith("e") ? "d" : "ed"}.`;
    });
  }

  function recordOutcome(row: FilingRow): void {
    void run("outcome", async () => {
      const body: UnknownRecord = { filingId: row.id, filedOn: outcome.filedOn, currency: outcome.currency.trim().toUpperCase() };
      if (outcome.acknowledgementNumber.trim()) body.acknowledgementNumber = outcome.acknowledgementNumber.trim();
      if (outcome.challanReference.trim()) body.challanReference = outcome.challanReference.trim();
      if (outcome.authority.trim()) body.authority = outcome.authority.trim();
      if (outcome.evidenceDocumentId.trim()) body.evidenceDocumentId = outcome.evidenceDocumentId.trim();
      if (outcome.lateFilingReason.trim()) body.lateFilingReason = outcome.lateFilingReason.trim();
      const amount = outcome.amountRemitted.trim();
      if (amount !== "") {
        if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error("Enter the amount remitted as a plain number, for example 12500.00.");
        const [whole, fraction = ""] = amount.split(".");
        body.amountRemittedMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      }
      await send("/api/v1/statutory-register", body);
      return amount === ""
        ? "Filing outcome recorded. No remitted amount was stated, so none is held."
        : "Filing outcome recorded, including the amount remitted to the authority.";
    });
  }

  const counts = register?.bandCounts ?? {};
  const outcomeAllowed = active !== null && (active.status === "filed" || active.status === "accepted");

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="COMPLIANCE · SCR-072"
        title="Tax & statutory"
        description="Track every statutory obligation against its due date, generate the form instance, and record what was filed, acknowledged and remitted."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4 text-xs font-bold"
              onClick={() => {
                setGenerateOpen((open) => !open);
                setRaiseOpen(false);
              }}
            >
              <FileText className="mr-1.5 size-4" /> Generate form
            </Button>
            <Button
              className="h-10 rounded-xl px-4 text-xs font-bold"
              onClick={() => {
                setRaiseOpen((open) => !open);
                setGenerateOpen(false);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Raise a filing
            </Button>
          </div>
        }
      />

      <Surface className="mb-6 border-warning/30">
        <SectionHeading
          title="What this register does, and what it does not do"
          description={register?.disclaimer ?? "Filing happens outside this system. Recording a filing stores what a person already completed with the authority, and recording an acknowledgement stores a reference the authority issued elsewhere. No return is transmitted from here."}
          action={<StatusPill tone="warning">Records only</StatusPill>}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Generate the form instance → raise the filing → submit → approve → record as filed → record the authority&rsquo;s acknowledgement. {MAKER_CHECKER_NOTE}{" "}
          {register && !register.formCatalogue.seeded ? register.formCatalogue.note : null}
        </p>
      </Surface>

      {register?.scopeNote ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" /> {register.scopeNote}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { band: "overdue", label: "Overdue", hint: "Past the recorded due date and not yet filed" },
          { band: "due_soon", label: "Due within 7 days", hint: "Due date is today or inside the next week" },
          { band: "filed", label: "Filed", hint: "Recorded as filed with the authority" },
          { band: "unknown", label: "No due date recorded", hint: "Banding is not possible without a due date" },
        ].map((tile) => (
          <Surface key={tile.band} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">{tile.label}</p>
              <StatusPill tone={bandTone(tile.band)}>{BAND_LABELS[tile.band]}</StatusPill>
            </div>
            <p className="mt-3 truncate font-mono text-[26px] font-bold leading-8 text-foreground tabular-nums">
              {loading ? "—" : counts[tile.band] ?? 0}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{tile.hint}</p>
          </Surface>
        ))}
      </div>

      <Surface className="mb-6">
        <SectionHeading
          title="Amount remitted to authorities"
          description="Recorded on each filing when it is marked as filed. This is the only place in this system that holds what was actually paid to an authority; the payroll reconciliation control that compares statutory heads against remittances has no other source."
          action={
            <StatusPill tone={register?.remittance.totalMinor === null ? "neutral" : "success"}>
              {register?.remittance.totalMinor === null ? "Not recorded" : `${register?.remittance.currency ?? "INR"} ${money(register?.remittance.totalMinor ?? 0)}`}
            </StatusPill>
          }
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {loading
            ? "Loading…"
            : register?.remittance.reason ??
              `${register?.remittance.recordedCount ?? 0} filing${(register?.remittance.recordedCount ?? 0) === 1 ? "" : "s"} carr${(register?.remittance.recordedCount ?? 0) === 1 ? "ies" : "y"} a remitted amount.`}
        </p>
      </Surface>

      {generateOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Generate a statutory form instance"
            description="Every value on the form is derived from the employee, establishment and payroll records. Nothing is typed in. The layout comes from the approved state template; one that is not approved and effective is refused."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <label className={labelClass}>
              <span className={legendClass}>Form</span>
              <select
                aria-label="Form"
                className={`${selectClass} w-full sm:w-auto`}
                value={gForm.formCode}
                onChange={(e) => {
                  setDerivation(null);
                  setGForm({ ...gForm, formCode: e.target.value, employeeId: "" });
                }}
              >
                {DERIVABLE_FORM_CODES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              <span className={legendClass}>Establishment</span>
              <select
                aria-label="Establishment"
                className={`${selectClass} w-full sm:w-auto`}
                value={gForm.locationId}
                onChange={(e) => {
                  setDerivation(null);
                  setGForm({ ...gForm, locationId: e.target.value });
                }}
              >
                <option value="">Choose an establishment</option>
                {establishments.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {`${entry.code} · ${entry.name}${entry.state ? ` · ${entry.state}` : " · no state on record"}`}
                  </option>
                ))}
              </select>
            </label>
            {EMPLOYEE_FORM_CODES.includes(gForm.formCode) ? (
              <label className={labelClass}>
                <span className={legendClass}>Employee</span>
                <select
                  aria-label="Employee"
                  className={`${selectClass} w-full sm:w-auto`}
                  value={gForm.employeeId}
                  onChange={(e) => {
                    setDerivation(null);
                    setGForm({ ...gForm, employeeId: e.target.value });
                  }}
                >
                  <option value="">Choose an employee</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {`${person.code} · ${person.name}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={labelClass}>
              <span className={legendClass}>Reporting period</span>
              <input aria-label="Reporting period" className={`${inputClass} w-full sm:w-auto`} value={gForm.period} onChange={(e) => setGForm({ ...gForm, period: e.target.value })} placeholder="2026-08 or 2026" />
            </label>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy !== ""} onClick={previewValues}>
              {busy === "preview" ? "Deriving…" : "Preview derived values"}
            </Button>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={busy !== ""} onClick={generateForm}>
              {busy === "generate" ? "Generating…" : "Generate form"}
            </Button>
          </div>
          {derivation ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/80 p-3">
                <p className="text-xs font-bold text-foreground">
                  {`Derived from live records · ${derivation.stateCode} ${derivation.formCode}`}
                </p>
                <table className="mt-2 w-full text-left text-xs">
                  <tbody>
                    {derivation.sources.map((entry) => (
                      <tr key={entry.field} className="border-t border-border/60">
                        <td className="py-1.5 pr-3 font-semibold text-foreground">{entry.field}</td>
                        <td className="py-1.5 pr-3 tabular-nums text-foreground">{String(derivation.values[entry.field] ?? "")}</td>
                        <td className="py-1.5 text-muted-foreground">{entry.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-border/80 p-3">
                <p className="text-xs font-bold text-foreground">Not on record</p>
                {derivation.missing.length === 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Every value this form can draw on is present.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {derivation.missing.map((entry) => (
                      <li key={entry.field} className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.field}</span> &mdash; {entry.issue} <span className="italic">({entry.source})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The state variant follows the establishment&rsquo;s own state, and the layout is client configuration saved as the statutory rule set
            {" "}<code className="font-mono">&lt;STATE&gt;:&lt;FORM_CODE&gt;</code>. Nucleus supplies the figures; it does not author the form. A value with no source record
            is listed above rather than left blank, because a blank on a statutory return is a compliance failure.
          </p>
        </Surface>
      ) : null}

      {raiseOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Raise a filing"
            description="A filing must point at a generated form instance; the workflow refuses one that does not exist. Generate the form first, then raise the filing against it."
          />
          {register && register.unlinkedForms.length === 0 ? (
            <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              Every generated form instance is already attached to a filing. Generate a form for the obligation you want to raise, then come back.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <label className={labelClass}>
                  <span className={legendClass}>Generated form instance</span>
                  <select
                    aria-label="Generated form instance"
                    className={`${selectClass} w-full sm:w-auto`}
                    value={rForm.generatedFormId}
                    onChange={(e) => {
                      const form = register?.unlinkedForms.find((entry) => entry.id === e.target.value);
                      setRForm({
                        ...rForm,
                        generatedFormId: e.target.value,
                        formCode: form?.formCode ?? rForm.formCode,
                        stateCode: form?.stateCode ?? rForm.stateCode,
                        period: form?.period ?? rForm.period,
                      });
                    }}
                  >
                    <option value="">Choose a generated form</option>
                    {(register?.unlinkedForms ?? []).map((form) => (
                      <option key={form.id} value={form.id}>{`${form.formCode} · ${form.stateCode} · ${form.period}`}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Form code</span>
                  <input aria-label="Filing form code" className={`${inputClass} w-full sm:w-auto`} value={rForm.formCode} onChange={(e) => setRForm({ ...rForm, formCode: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Act</span>
                  <input aria-label="Filing act" className={inputClass} value={rForm.act} onChange={(e) => setRForm({ ...rForm, act: e.target.value })} placeholder="The statute the return is made under" />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Authority</span>
                  <input aria-label="Filing authority" className={inputClass} value={rForm.authority} onChange={(e) => setRForm({ ...rForm, authority: e.target.value })} placeholder="Who receives it" />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>State code</span>
                  <input aria-label="Filing state code" className={`${inputClass} w-full sm:w-auto`} value={rForm.stateCode} onChange={(e) => setRForm({ ...rForm, stateCode: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Frequency</span>
                  <select aria-label="Filing frequency" className={inputClass} value={rForm.frequency} onChange={(e) => setRForm({ ...rForm, frequency: e.target.value })}>
                    {picklistValues("PL_FREQUENCY").map((value) => <option key={value} value={value}>{picklistLabel("PL_FREQUENCY", value)}</option>)}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Period</span>
                  <input aria-label="Filing period" className={`${inputClass} w-full sm:w-auto`} value={rForm.period} onChange={(e) => setRForm({ ...rForm, period: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Due date</span>
                  <input aria-label="Filing due date" type="date" className={`${inputClass} w-full sm:w-auto`} value={rForm.dueDate} onChange={(e) => setRForm({ ...rForm, dueDate: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Owner</span>
                  <input aria-label="Filing owner" className={`${inputClass} w-full sm:w-auto`} value={rForm.owner} onChange={(e) => setRForm({ ...rForm, owner: e.target.value })} placeholder="Who is accountable" />
                </label>
              </div>
              <label className={labelClass}>
                <span className={legendClass}>Notes (optional)</span>
                <input aria-label="Filing notes" className={`${inputClass} w-full sm:w-auto`} value={rForm.notes} onChange={(e) => setRForm({ ...rForm, notes: e.target.value })} placeholder="Act or authority, establishment, anything a reviewer needs" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-10 rounded-xl px-4 text-xs font-bold"
                  disabled={busy !== "" || !rForm.generatedFormId || !rForm.dueDate || !rForm.owner.trim() || !rForm.formCode.trim() || !rForm.act.trim() || !rForm.authority.trim() || !rForm.stateCode.trim() || !rForm.period.trim()}
                  onClick={raiseFiling}
                >
                  {busy === "raise" ? "Raising…" : "Raise filing"}
                </Button>
                {!rForm.generatedFormId ? <span className="text-xs text-muted-foreground">Choose the generated form this filing covers.</span> : null}
                {rForm.generatedFormId && (!rForm.dueDate || !rForm.owner.trim()) ? <span className="text-xs text-muted-foreground">A due date and an owner are required.</span> : null}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The filing record carries the form code, state, period, due date and owner. It does not carry a legal entity or an authority name; record the authority when the filing outcome is recorded.
              </p>
            </div>
          )}
        </Surface>
      ) : null}

      {notice ? <p role="status" className="mb-4 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-foreground">{notice}</p> : null}
      {actionError ? <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">{actionError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Surface>
          <SectionHeading
            title="Filing register"
            description={loading ? "Loading…" : `${filtered.length} filing${filtered.length === 1 ? "" : "s"} in view${register?.asOf ? ` · banded against ${register.asOf}` : ""}`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <input aria-label="Search filings" className={`${inputClass} w-full sm:w-auto`} placeholder="Form, state, period or owner" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Due-date band filter" className={`${selectClass} w-full sm:w-auto`} value={bandFilter} onChange={(e) => setBandFilter(e.target.value)}>
                  <option value="all">All due dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due soon</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="filed">Filed</option>
                  <option value="closed">Closed unfiled</option>
                  <option value="unknown">No due date</option>
                </select>
                <select aria-label="Filing status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="returned">Returned</option>
                  <option value="approved">Approved</option>
                  <option value="filed">Filed</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            }
          />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {items.length === 0
                ? "No filings have been raised yet. Generate a statutory form instance, then raise the filing that covers it."
                : "No filings match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Obligation</th>
                    <th className="px-3 py-2 font-bold">Authority</th>
                    <th className="px-3 py-2 font-bold">State</th>
                    <th className="px-3 py-2 font-bold">Period</th>
                    <th className="px-3 py-2 font-bold">Due</th>
                    <th className="px-3 py-2 font-bold">Owner</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === activeId;
                    return (
                      <tr key={row.id} className={`border-t border-border/60 ${selected ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2">
                          <button type="button" className="text-left text-xs font-semibold text-foreground hover:text-primary" onClick={() => selectFiling(row.id)} aria-current={selected ? "true" : undefined}>
                            {row.formCode}
                          </button>
                          <span className="block font-mono text-[10px] text-muted-foreground">{row.id.slice(0, 8)}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.outcome?.authority ?? <span className="italic">Not recorded</span>}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.stateCode}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.period}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className="block text-foreground">{dateLabel(row.dueDate)}</span>
                          <StatusPill tone={bandTone(row.band)}>
                            {row.band === "overdue" && row.daysUntilDue !== null
                              ? `Overdue by ${Math.abs(row.daysUntilDue)} day${Math.abs(row.daysUntilDue) === 1 ? "" : "s"}`
                              : row.band === "due_soon" && row.daysUntilDue !== null
                                ? row.daysUntilDue === 0 ? "Due today" : `Due in ${row.daysUntilDue} day${row.daysUntilDue === 1 ? "" : "s"}`
                                : row.band === "filed" && row.lateByDays !== null && row.lateByDays > 0
                                  ? `Filed ${row.lateByDays} day${row.lateByDays === 1 ? "" : "s"} late`
                                  : BAND_LABELS[row.band] ?? row.band}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.owner}</td>
                        <td className="px-3 py-2"><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td>
                        <td className="px-3 py-2">
                          <button type="button" aria-label={`Open filing ${row.formCode}`} onClick={() => selectFiling(row.id)}>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Filing detail"
            description={active ? `${active.formCode} · ${active.stateCode} · ${active.period}` : "Select a filing to inspect it"}
            action={active ? <StatusPill tone={statusTone(active.status)}>{active.status}</StatusPill> : undefined}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No filing selected.</p>
          ) : (
            <div className="space-y-5">
              <dl className="space-y-2 text-xs">
                {[
                  ["Form code", active.formCode],
                  ["State", active.stateCode],
                  ["Period", active.period],
                  ["Due date", dateLabel(active.dueDate)],
                  ["Owner", active.owner],
                  ["Notes", active.notes ?? "None"],
                  ["Raised", dateLabel(active.createdAt)],
                  ["Record version", String(active.version)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className={legendClass}>Generated form instance</h3>
                {active.form ? (
                  <dl className="mt-2 space-y-2 text-xs">
                    {[
                      ["Instance", active.form.id],
                      ["Template version", String(active.form.templateVersion)],
                      ["Instance status", active.form.status],
                      ["Filed at", dateLabel(active.form.filedAt)],
                      ["Acknowledgement", active.form.acknowledgementRef ?? "Not recorded"],
                      ["Evidence document", active.form.documentId ?? "Not attached"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 max-w-[60%] truncate text-right font-mono text-[11px] text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {active.generatedFormId
                      ? "This filing references a form instance that is no longer readable."
                      : "No generated form instance is attached."}
                  </p>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Recorded outcome</h3>
                {active.outcome ? (
                  <dl className="mt-2 space-y-2 text-xs">
                    {[
                      ["Filed on", dateLabel(active.outcome.filedOn)],
                      ["Late by", active.outcome.lateByDays === null ? "Not computable" : active.outcome.lateByDays > 0 ? `${active.outcome.lateByDays} day${active.outcome.lateByDays === 1 ? "" : "s"}` : "Not late"],
                      ["Late filing reason", active.outcome.lateFilingReason ?? (active.outcome.late ? "Missing" : "Not required")],
                      ["Acknowledgement number", active.outcome.acknowledgementNumber ?? "Not recorded"],
                      ["Amount remitted", active.outcome.amountRemittedMinor === null ? "Not recorded" : `${active.outcome.currency} ${money(active.outcome.amountRemittedMinor)}`],
                      ["Challan reference", active.outcome.challanReference ?? "Not recorded"],
                      ["Authority", active.outcome.authority ?? "Not recorded"],
                      ["Evidence document", active.outcome.evidenceDocumentId ?? "Not attached"],
                      ["Recorded", dateLabel(active.outcome.recordedAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 max-w-[60%] break-words text-right font-semibold text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    No outcome recorded. Once the filing is recorded as filed, capture the date it was filed, the acknowledgement, the evidence and the amount remitted to the authority.
                  </p>
                )}
              </div>

              <div>
                <h3 className={legendClass}>Audit trail</h3>
                {historyError ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{historyError}</p>
                ) : history.length === 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No workflow events recorded yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {history.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-xs">
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 break-words font-semibold text-foreground">{entry.action}</span>
                          <span className="shrink-0 text-muted-foreground">{dateLabel(entry.createdAt)}</span>
                        </span>
                        {entry.reason ? <span className="mt-0.5 block text-muted-foreground">{entry.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link href="/statutory-compliance" className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Open the obligation calendar <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          )}
        </Surface>
      </div>

      {active ? (
        <Surface className="mt-6">
          <SectionHeading
            title="Actions"
            description={`Every action below is checked against this filing's current state (${active.status}). A refused action says why instead of disappearing.`}
          />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className={labelClass}>
              <span className={legendClass}>Reason (recorded on the workflow event)</span>
              <input aria-label="Action reason" className={`${inputClass} w-full sm:w-72`} value={transitionReason} onChange={(e) => updateDraft({ reason: e.target.value })} placeholder="At least three characters" />
            </label>
            <label className={labelClass}>
              <span className={legendClass}>Acknowledgement reference (filing and acceptance)</span>
              <input aria-label="Acknowledgement reference" className={`${inputClass} w-full sm:w-72`} value={ackReference} onChange={(e) => updateDraft({ ack: e.target.value })} placeholder="The reference the authority issued" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {active.actions.map((entry) => {
              const needsAck = entry.action === "file" || entry.action === "accept";
              const missingAck = needsAck && ackReference.trim().length < 3;
              const disabled = !entry.allowed || missingAck || busy !== "";
              const why = !entry.allowed
                ? entry.reason
                : missingAck
                  ? "Enter the acknowledgement reference the authority issued before recording this."
                  : null;
              return (
                <div key={entry.action} className="flex max-w-xs flex-col gap-1">
                  <Button
                    variant={entry.approval ? "default" : "outline"}
                    size="sm"
                    className="h-9 rounded-lg text-xs font-bold"
                    disabled={disabled}
                    aria-describedby={why ? `why-${entry.action}` : undefined}
                    onClick={() => transition(active, entry.action)}
                  >
                    {busy === entry.action ? "Working…" : entry.label}
                  </Button>
                  {why ? <span id={`why-${entry.action}`} className="text-[11px] leading-relaxed text-muted-foreground">{why}</span> : null}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {active.generate.allowed
              ? "Regenerating the form instance replaces its rendered content for this state, form code and period."
              : active.generate.reason}
            {" "}{MAKER_CHECKER_NOTE}
          </p>
        </Surface>
      ) : null}

      {active ? (
        <Surface className="mt-6">
          <SectionHeading
            title="Record the filing outcome"
            description="What was filed, when, under which acknowledgement, against what evidence, and how much was remitted. This records a completed act; it does not file anything."
            action={outcomeAllowed ? undefined : <StatusPill tone="neutral">Available once filed</StatusPill>}
          />
          {!outcomeAllowed ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              An outcome states what was already done with the authority, so it can only be recorded once this filing is recorded as filed or accepted. This filing is {active.status}.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <label className={labelClass}>
                  <span className={legendClass}>Filed on</span>
                  <input aria-label="Filed on" type="date" className={`${inputClass} w-full sm:w-auto`} value={outcome.filedOn} onChange={(e) => updateOutcome({ filedOn: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Acknowledgement number</span>
                  <input aria-label="Acknowledgement number" className={`${inputClass} w-full sm:w-auto`} value={outcome.acknowledgementNumber} onChange={(e) => updateOutcome({ acknowledgementNumber: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Amount remitted</span>
                  <input aria-label="Amount remitted" inputMode="decimal" className={`${inputClass} w-full sm:w-auto`} value={outcome.amountRemitted} onChange={(e) => updateOutcome({ amountRemitted: e.target.value })} placeholder="Leave blank if not stated" />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Currency</span>
                  <input aria-label="Remittance currency" className={`${inputClass} w-full sm:w-24`} value={outcome.currency} onChange={(e) => updateOutcome({ currency: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Challan reference</span>
                  <input aria-label="Challan reference" className={`${inputClass} w-full sm:w-auto`} value={outcome.challanReference} onChange={(e) => updateOutcome({ challanReference: e.target.value })} />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Act or authority</span>
                  <input aria-label="Act or authority" className={`${inputClass} w-full sm:w-auto`} value={outcome.authority} onChange={(e) => updateOutcome({ authority: e.target.value })} placeholder="As written on the acknowledgement" />
                </label>
                <label className={labelClass}>
                  <span className={legendClass}>Evidence document</span>
                  <ReferencePicker endpoint="/api/v1/documents" ariaLabel="Evidence document" className={`${inputClass} w-full sm:w-auto`} value={outcome.evidenceDocumentId} onChange={(value) => updateOutcome({ evidenceDocumentId: value })} placeholder="Search the document vault…" />
                </label>
              </div>
              <label className={labelClass}>
                <span className={legendClass}>Late filing reason{lateHint ? " · required" : ""}</span>
                <input
                  aria-label="Late filing reason"
                  className={`${inputClass} w-full ${lateHint && outcome.lateFilingReason.trim().length < 10 ? "border-destructive/60" : ""}`}
                  value={outcome.lateFilingReason}
                  onChange={(e) => updateOutcome({ lateFilingReason: e.target.value })}
                  placeholder={lateHint ? "At least ten characters explaining the delay" : "Only required when filed after the due date"}
                />
              </label>
              {lateHint ? (
                <p className="flex items-start gap-2 text-xs leading-relaxed text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  This filing date is after the recorded due date of {dateLabel(active.dueDate)}. A reason of at least ten characters is required and is enforced before anything is stored.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-10 rounded-xl px-4 text-xs font-bold"
                  disabled={busy !== "" || !/^\d{4}-\d{2}-\d{2}$/.test(outcome.filedOn) || (lateHint && outcome.lateFilingReason.trim().length < 10)}
                  onClick={() => recordOutcome(active)}
                >
                  {busy === "outcome" ? "Recording…" : "Record outcome"}
                </Button>
                {!/^\d{4}-\d{2}-\d{2}$/.test(outcome.filedOn) ? <span className="text-xs text-muted-foreground">Enter the date this filing was completed.</span> : null}
                {lateHint && outcome.lateFilingReason.trim().length < 10 ? <span className="text-xs text-muted-foreground">A late filing needs a reason of at least ten characters.</span> : null}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Leaving the amount blank stores no amount at all rather than zero: a zero would assert that nothing was owed. Recording it once here is what lets the payroll reconciliation compare statutory heads against what was actually paid.
              </p>
            </div>
          )}
        </Surface>
      ) : null}
    </div>
  );
}
