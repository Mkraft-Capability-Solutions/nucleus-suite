"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { operationalResources } from "@/lib/operational-catalog";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function nullableInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

function minorToRupeeInput(amountMinor: number): string {
  return amountMinor === 0 ? "" : String(amountMinor / 100);
}

function rupeeInputToMinor(value: string): number {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

function timeLabel(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function humanizeAction(action: string): string {
  return action.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  proof_pending: "Proof pending",
  verified: "Verified",
  partially_verified: "Partially verified",
  returned: "Returned",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function stateLabel(status: string): string {
  return STATE_LABELS[status] ?? (status || "—");
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "verified") return "success";
  if (status === "partially_verified") return "info";
  if (status === "submitted" || status === "proof_pending") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  return "neutral";
}

/**
 * The transitions come from the operational catalog itself, so the buttons on
 * this screen can never drift from the states the server actually accepts.
 * `src/server/payroll/tax.ts` is server-only and cannot be imported here.
 */
const TRANSITIONS = operationalResources.taxDeclarations.transitions;

const ACTIONS: Array<{ action: string; label: string }> = [
  { action: "submit", label: "Submit" },
  { action: "requestProof", label: "Request proof" },
  { action: "verify", label: "Verify" },
  { action: "partiallyVerify", label: "Partially verify" },
  { action: "return", label: "Return" },
  { action: "reject", label: "Reject" },
];

const EDITABLE_STATES = operationalResources.taxDeclarations.editable;

/** Mirrors `verifierRemarksIssue` in src/server/payroll/tax.ts. */
const REMARKS_REQUIRED_ACTIONS = ["reject", "partiallyVerify", "return"];
const VERIFIER_REMARKS_MIN_LENGTH = 10;

function remarksIssue(action: string, remarks: string): string | null {
  const trimmed = remarks.trim();
  if (!REMARKS_REQUIRED_ACTIONS.includes(action)) {
    return trimmed.length >= 3 ? null : "Enter a reason; every declaration action is audited with it.";
  }
  if (trimmed.length < VERIFIER_REMARKS_MIN_LENGTH) {
    return `Verifier remarks are mandatory on this action and must be at least ${VERIFIER_REMARKS_MIN_LENGTH} characters.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Declaration form
// ---------------------------------------------------------------------------

type FormField = { code: string; label: string; kind: "money" | "text" | "date" };
type FormGroup = { key: string; title: string; description: string; fields: FormField[] };

const FORM_GROUPS: FormGroup[] = [
  {
    key: "regime",
    title: "Regime and period",
    description: "The regime elected for the financial year. It may be switched once, until the freeze date.",
    fields: [{ code: "financialYear", label: "Financial year (YYYY-YY)", kind: "text" }],
  },
  {
    key: "80c",
    title: "Section 80C",
    description: "Investments and payments that roll into the single 80C ceiling.",
    fields: [
      { code: "employeePfMinor", label: "Employee provident fund", kind: "money" },
      { code: "publicProvidentFundMinor", label: "Public provident fund", kind: "money" },
      { code: "lifeInsuranceMinor", label: "Life insurance premium", kind: "money" },
      { code: "elssMinor", label: "ELSS / tax saving funds", kind: "money" },
      { code: "tuitionFeesMinor", label: "Children tuition fees", kind: "money" },
      { code: "housingPrincipalMinor", label: "Housing loan principal", kind: "money" },
      { code: "otherSection80cMinor", label: "Other 80C investments", kind: "money" },
    ],
  },
  {
    key: "other-deductions",
    title: "Other deductions",
    description: "Chapter VI-A heads outside 80C, each governed by its own ceiling.",
    fields: [
      { code: "nps80ccd1bMinor", label: "NPS - section 80CCD(1B)", kind: "money" },
      { code: "healthInsuranceSelfMinor", label: "Health insurance - self and family", kind: "money" },
      { code: "healthInsuranceParentsMinor", label: "Health insurance - parents", kind: "money" },
      { code: "disability80ddMinor", label: "Disability maintenance - 80DD", kind: "money" },
      { code: "educationLoanInterestMinor", label: "Education loan interest - 80E", kind: "money" },
      { code: "donations80gMinor", label: "Donations - 80G", kind: "money" },
      { code: "savingsInterest80ttaMinor", label: "Savings bank interest - 80TTA", kind: "money" },
    ],
  },
  {
    key: "house-property",
    title: "House property and rent",
    description: "Rent paid feeds the HRA exemption test; loan interest feeds section 24(b).",
    fields: [
      { code: "rentPaidMonthlyMinor", label: "Rent paid per month", kind: "money" },
      { code: "landlordName", label: "Landlord name", kind: "text" },
      { code: "landlordPan", label: "Landlord PAN", kind: "text" },
      { code: "rentedAddress", label: "Rented address", kind: "text" },
      { code: "rentPeriodFrom", label: "Rent period from", kind: "date" },
      { code: "rentPeriodTo", label: "Rent period to", kind: "date" },
      { code: "housingInterestSelfMinor", label: "Housing loan interest - self occupied", kind: "money" },
      { code: "housingInterestLetOutMinor", label: "Housing loan interest - let out", kind: "money" },
      { code: "lenderName", label: "Lender name", kind: "text" },
      { code: "lenderPan", label: "Lender PAN", kind: "text" },
    ],
  },
  {
    key: "other-income",
    title: "Other income and previous employer",
    description: "Declared income the employer must consider when projecting tax.",
    fields: [
      { code: "otherSourcesIncomeMinor", label: "Income from other sources", kind: "money" },
      { code: "previousEmployerIncomeMinor", label: "Previous employer salary", kind: "money" },
      { code: "previousEmployerTdsMinor", label: "Previous employer TDS", kind: "money" },
    ],
  },
  {
    key: "proofs",
    title: "Proofs and verification",
    description: "Proof reference and the verifier remarks recorded against this declaration.",
    fields: [
      { code: "proofDocumentId", label: "Proof document reference", kind: "text" },
      { code: "verifierRemarks", label: "Verifier remarks", kind: "text" },
    ],
  },
];

const FORM_FIELDS: FormField[] = FORM_GROUPS.flatMap((group) => group.fields);

function emptyForm(): Record<string, string> {
  return Object.fromEntries(FORM_FIELDS.map((field) => [field.code, ""]));
}

function formFromRecord(record: UnknownRecord): Record<string, string> {
  const form = emptyForm();
  for (const field of FORM_FIELDS) {
    const raw = record[field.code];
    if (raw === null || raw === undefined) continue;
    form[field.code] = field.kind === "money" ? minorToRupeeInput(int(raw)) : String(raw);
  }
  return form;
}

/**
 * The operational validator is strict: it accepts exactly the catalog fields.
 * Blank optionals are dropped rather than sent as empty strings or zeros.
 */
function declarationBody(employeeId: string, regime: string, form: Record<string, string>): UnknownRecord {
  const body: UnknownRecord = { employeeId, taxRegime: regime, financialYear: form.financialYear.trim() };
  for (const field of FORM_FIELDS) {
    if (field.code === "financialYear") continue;
    const value = (form[field.code] ?? "").trim();
    if (value === "") continue;
    if (field.kind === "money") {
      const minor = rupeeInputToMinor(value);
      if (minor > 0) body[field.code] = minor;
      continue;
    }
    body[field.code] = value;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Projection shapes, as the tax-projections endpoint returns them
// ---------------------------------------------------------------------------

type BlockedAmount = { amountMinor: number | null; blockedBy: string[] };

type HeadView = { code: string; label: string; declaredMinor: number; capRule: string; capped: boolean; missingRule: string | null };

type SectionView = {
  code: string;
  label: string;
  heads: HeadView[];
  declaredMinor: number;
  capRule: string;
  capped: boolean;
  allowableMinor: number | null;
  blockedBy: string[];
};

type RegimeView = {
  regime: string;
  label: string;
  selected: boolean;
  grossMinor: number | null;
  declaredDeductionsMinor: number;
  admissibilityRule: string;
  admissibilityState: string;
  taxableState: string;
  annualTax: BlockedAmount;
  blockedBy: string[];
};

type ProjectionView = {
  declarationId: string | null;
  status: string;
  version: number | null;
  employeeName: string;
  employeeCode: string;
  location: string;
  financialYearLabel: string;
  rulePackCode: string;
  regime: string | null;
  grossState: string;
  grossReason: string | null;
  monthlyGrossMinor: number | null;
  annualSalaryGrossMinor: number | null;
  previousEmployerIncomeMinor: number;
  otherSourcesIncomeMinor: number;
  projectedAnnualGrossMinor: number | null;
  monthlyComponents: Array<{ code: string; amountMinor: number }>;
  sections: SectionView[];
  declaredDeductionsMinor: number;
  hra: {
    monthlyRentPaidMinor: number;
    annualRentPaidMinor: number;
    annualBasicDaMinor: number | null;
    annualHraReceivedMinor: number | null;
    workLocation: string | null;
    metro: boolean | null;
    landlordPan: string | null;
    landlordPanRequired: boolean | null;
    exemptionMinor: number | null;
    blockedBy: string[];
  };
  taxableIncome: { state: string; amountMinor: number | null; allowableDeductionsMinor: number; blockedBy: string[] };
  annualTax: BlockedAmount;
  monthlyTds: BlockedAmount & { remainingMonths: number; asOfPeriod: string };
  taxDeducted: { postedMinor: number; provisionalMinor: number; previousEmployerTdsMinor: number; periods: Array<{ period: string; runStatus: string; amountMinor: number }> };
  regimes: RegimeView[];
  rejectedHeadsUnidentified: boolean;
  regimeSwitch: { allowed: boolean | null; reason: string; blockedBy: string[] };
  blockedBy: string[];
};

function readProjection(payload: unknown): ProjectionView | null {
  const data = asRecord(asRecord(payload).data);
  if (Object.keys(data).length === 0) return null;
  const employee = asRecord(data.employee);
  const gross = asRecord(data.gross);
  const hra = asRecord(data.hra);
  const hraInputs = asRecord(hra.inputs);
  const taxableIncome = asRecord(data.taxableIncome);
  const annualTax = asRecord(data.annualTax);
  const monthlyTds = asRecord(data.monthlyTds);
  const deducted = asRecord(data.taxDeductedSoFar);
  const components = asRecord(gross.monthlyComponentsMinor);
  return {
    declarationId: typeof data.declarationId === "string" ? data.declarationId : null,
    status: str(data.status, "draft"),
    version: nullableInt(data.version),
    employeeName: str(employee.name, str(employee.code, "—")),
    employeeCode: str(employee.code, "—"),
    location: str(employee.location, "—"),
    financialYearLabel: str(asRecord(data.financialYear).label, "—"),
    rulePackCode: str(data.rulePackCode, "—"),
    regime: typeof data.regime === "string" ? data.regime : null,
    grossState: str(gross.state, "unavailable"),
    grossReason: typeof gross.reason === "string" ? gross.reason : null,
    monthlyGrossMinor: nullableInt(gross.monthlyGrossMinor),
    annualSalaryGrossMinor: nullableInt(gross.annualSalaryGrossMinor),
    previousEmployerIncomeMinor: int(gross.previousEmployerIncomeMinor),
    otherSourcesIncomeMinor: int(gross.otherSourcesIncomeMinor),
    projectedAnnualGrossMinor: nullableInt(gross.projectedAnnualGrossMinor),
    monthlyComponents: Object.entries(components).map(([code, amount]) => ({ code, amountMinor: int(amount) })),
    sections: (Array.isArray(data.sections) ? (data.sections as UnknownRecord[]) : []).map((section) => ({
      code: str(section.code, "—"),
      label: str(section.label, str(section.code, "—")),
      heads: (Array.isArray(section.heads) ? (section.heads as UnknownRecord[]) : []).map((head) => ({
        code: str(head.code),
        label: str(head.label, str(head.code)),
        declaredMinor: int(head.declaredMinor),
        capRule: str(head.capRule),
        capped: head.capped === true,
        missingRule: typeof head.missingRule === "string" ? head.missingRule : null,
      })),
      declaredMinor: int(section.declaredMinor),
      capRule: str(section.capRule),
      capped: section.capped === true,
      allowableMinor: nullableInt(section.allowableMinor),
      blockedBy: stringList(section.blockedBy),
    })),
    declaredDeductionsMinor: int(data.declaredDeductionsMinor),
    hra: {
      monthlyRentPaidMinor: int(hraInputs.monthlyRentPaidMinor),
      annualRentPaidMinor: int(hraInputs.annualRentPaidMinor),
      annualBasicDaMinor: nullableInt(hraInputs.annualBasicDaMinor),
      annualHraReceivedMinor: nullableInt(hraInputs.annualHraReceivedMinor),
      workLocation: typeof hraInputs.workLocation === "string" ? hraInputs.workLocation : null,
      metro: typeof hraInputs.metro === "boolean" ? hraInputs.metro : null,
      landlordPan: typeof hraInputs.landlordPan === "string" ? hraInputs.landlordPan : null,
      landlordPanRequired: typeof hraInputs.landlordPanRequired === "boolean" ? hraInputs.landlordPanRequired : null,
      exemptionMinor: nullableInt(hra.exemptionMinor),
      blockedBy: stringList(hra.blockedBy),
    },
    taxableIncome: {
      state: str(taxableIncome.state, "indeterminate"),
      amountMinor: nullableInt(taxableIncome.amountMinor),
      allowableDeductionsMinor: int(taxableIncome.allowableDeductionsMinor),
      blockedBy: stringList(taxableIncome.blockedBy),
    },
    annualTax: { amountMinor: nullableInt(annualTax.amountMinor), blockedBy: stringList(annualTax.blockedBy) },
    monthlyTds: {
      amountMinor: nullableInt(monthlyTds.amountMinor),
      blockedBy: stringList(monthlyTds.blockedBy),
      remainingMonths: int(monthlyTds.remainingMonths),
      asOfPeriod: str(monthlyTds.asOfPeriod, "—"),
    },
    taxDeducted: {
      postedMinor: int(deducted.postedMinor),
      provisionalMinor: int(deducted.provisionalMinor),
      previousEmployerTdsMinor: int(deducted.previousEmployerTdsMinor),
      periods: (Array.isArray(deducted.periods) ? (deducted.periods as UnknownRecord[]) : []).map((row) => ({
        period: str(row.period, "—"),
        runStatus: str(row.runStatus, "—"),
        amountMinor: int(row.amountMinor),
      })),
    },
    regimes: (Array.isArray(data.regimes) ? (data.regimes as UnknownRecord[]) : []).map((regime) => ({
      regime: str(regime.regime),
      label: str(regime.label, str(regime.regime)),
      selected: regime.selected === true,
      grossMinor: nullableInt(regime.grossMinor),
      declaredDeductionsMinor: int(regime.declaredDeductionsMinor),
      admissibilityRule: str(asRecord(regime.admissibility).rule, "—"),
      admissibilityState: str(asRecord(regime.admissibility).state, "not_declared"),
      taxableState: str(asRecord(regime.taxableIncome).state, "indeterminate"),
      annualTax: {
        amountMinor: nullableInt(asRecord(regime.annualTax).amountMinor),
        blockedBy: stringList(asRecord(regime.annualTax).blockedBy),
      },
      blockedBy: stringList(regime.blockedBy),
    })),
    rejectedHeadsUnidentified: asRecord(data.headDecisions).rejectedHeadsUnidentified === true,
    regimeSwitch: {
      allowed: typeof asRecord(data.regimeSwitch).allowed === "boolean" ? (asRecord(data.regimeSwitch).allowed as boolean) : null,
      reason: str(asRecord(data.regimeSwitch).reason),
      blockedBy: stringList(asRecord(data.regimeSwitch).blockedBy),
    },
    blockedBy: stringList(data.blockedBy),
  };
}

type QueueRow = {
  id: string;
  version: number;
  status: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  financialYear: string;
  regimeLabel: string;
  taxRegime: string;
  declaredDeductionsMinor: number;
  projectedTdsMinor: number | null;
  projectedTdsBlockedBy: string[];
};

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

/** A figure the statutory rule pack cannot support. Never a dash, never a zero. */
function BlockedFigure({ label, blockedBy, note }: { label: string; blockedBy: string[]; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-warning">Not computable</p>
      {note ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{note}</p> : null}
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Awaiting approved statutory rules:{" "}
        <span className="break-all font-mono text-[10px] text-foreground">{blockedBy.join(", ") || "unspecified"}</span>
      </p>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const TIMELINE_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "proof_pending", label: "Proof pending" },
  { key: "verified", label: "Verified" },
  { key: "partially_verified", label: "Partially verified" },
  { key: "rejected", label: "Rejected" },
];

const STATE_RANK: Record<string, number> = {
  draft: 0,
  returned: 0,
  cancelled: 0,
  submitted: 1,
  proof_pending: 2,
  verified: 3,
  partially_verified: 3,
  rejected: 3,
};

function timelineState(stepKey: string, status: string): "done" | "current" | "todo" {
  const rank = STATE_RANK[status] ?? 0;
  const outcomes = ["verified", "partially_verified", "rejected"];
  if (outcomes.includes(stepKey)) return status === stepKey ? "current" : "todo";
  const stepRank = STATE_RANK[stepKey] ?? 0;
  if (status === stepKey) return "current";
  return stepRank < rank ? "done" : "todo";
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

// ---------------------------------------------------------------------------

export function TaxDeclarationPage() {
  // Deep-link preselect (?record=<declarationId>); lazy initializer keeps SSR stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [regimeFilter, setRegimeFilter] = useState("all");

  const [projection, setProjection] = useState<ProjectionView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [history, setHistory] = useState<UnknownRecord[]>([]);

  const [people, setPeople] = useState<UnknownRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formRegime, setFormRegime] = useState("old_regime");
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm());
  const [formBusy, setFormBusy] = useState(false);

  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/tax-projections?page=1&pageSize=100");
        const items = listFromEnvelope(raw).map((item) => ({
          id: str(item.id),
          version: int(item.version),
          status: str(item.status, "draft"),
          employeeId: str(item.employeeId),
          employeeCode: str(item.employeeCode, "—"),
          employeeName: str(item.employeeName, str(item.employeeCode, "Unassigned")),
          department: str(item.department, "—"),
          financialYear: str(item.financialYear, "—"),
          regimeLabel: str(item.regimeLabel, "Not elected"),
          taxRegime: str(item.taxRegime),
          declaredDeductionsMinor: int(item.declaredDeductionsMinor),
          projectedTdsMinor: nullableInt(asRecord(item.projectedTds).amountMinor),
          projectedTdsBlockedBy: stringList(asRecord(item.projectedTds).blockedBy),
        }));
        if (live) setRows(items.filter((item) => item.id !== ""));
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Declarations could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const raw = await getJson("/api/v1/people?search=&page=1&pageSize=100");
        if (live) setPeople(listFromEnvelope(raw));
      } catch {
        if (live) setPeople([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (regimeFilter !== "all" && row.taxRegime !== regimeFilter) return false;
        return true;
      }),
    [rows, statusFilter, regimeFilter],
  );

  const activeRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [rows, selectedId, filtered],
  );
  const activeId = activeRow?.id ?? "";

  useEffect(() => {
    // No selection: the detail panel renders its empty state from `activeRow`,
    // so there is nothing to fetch and nothing to clear here.
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const [projectionPayload, historyPayload] = await Promise.all([
          getJson(`/api/v1/tax-projections?declarationId=${encodeURIComponent(activeId)}`),
          getJson(`/api/v1/operations/taxDeclarations/${encodeURIComponent(activeId)}/history?pageSize=100`).catch(() => null),
        ]);
        if (!live) return;
        setProjection(readProjection(projectionPayload));
        setHistory(listFromEnvelope(historyPayload));
      } catch (err) {
        if (live) {
          setProjection(null);
          setDetailError(err instanceof Error ? err.message : "The projection could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  function selectRow(id: string): void {
    setSelectedId(id);
    setProjection(null);
    setHistory([]);
    setDetailError("");
    setNotice("");
    setFormOpen(false);
  }

  function openCreate(): void {
    setFormMode("create");
    setFormEmployeeId("");
    setFormRegime("old_regime");
    setForm(emptyForm());
    setFormOpen(true);
    setNotice("");
  }

  async function openEdit(): Promise<void> {
    if (!activeId) return;
    setNotice("");
    try {
      const raw = await getJson(`/api/v1/operations/taxDeclarations?pageSize=100`);
      const record = listFromEnvelope(raw).find((item) => str(item.id) === activeId);
      if (!record) {
        setNoticeTone("error");
        setNotice("The declaration could not be read for editing.");
        return;
      }
      setFormMode("edit");
      setFormEmployeeId(str(record.employeeId));
      setFormRegime(str(record.taxRegime, "old_regime"));
      setForm(formFromRecord(record));
      setFormOpen(true);
    } catch (err) {
      setNoticeTone("error");
      setNotice(err instanceof Error ? err.message : "The declaration could not be read for editing.");
    }
  }

  async function saveDeclaration(): Promise<void> {
    if (!formEmployeeId) {
      setNoticeTone("error");
      setNotice("Choose the employee this declaration belongs to.");
      return;
    }
    if (!form.financialYear.trim()) {
      setNoticeTone("error");
      setNotice("Enter the financial year, for example 2026-27.");
      return;
    }
    setFormBusy(true);
    try {
      const editing = formMode === "edit" && activeId !== "";
      const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() };
      if (editing && activeRow) headers["If-Match"] = `"${activeRow.version}"`;
      const response = await fetch(
        editing ? `/api/v1/operations/taxDeclarations/${encodeURIComponent(activeId)}` : "/api/v1/operations/taxDeclarations",
        {
          method: editing ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(declarationBody(formEmployeeId, formRegime, form)),
          cache: "no-store",
        },
      );
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        const details = Array.isArray(asRecord(payload.error).details) ? (asRecord(payload.error).details as UnknownRecord[]) : [];
        const detailText = details.map((detail) => `${str(detail.field)}: ${str(detail.issue)}`).join("; ");
        throw new Error([str(asRecord(payload.error).message, `Request failed (${response.status}).`), detailText].filter(Boolean).join(" — "));
      }
      const id = str(asRecord(payload.data).id, activeId);
      setNoticeTone("ok");
      setNotice(editing ? "Declaration updated. The projection has been recomputed." : "Declaration drafted.");
      setFormOpen(false);
      if (id) setSelectedId(id);
      refresh();
    } catch (err) {
      setNoticeTone("error");
      setNotice(err instanceof Error ? err.message : "The declaration could not be saved.");
    } finally {
      setFormBusy(false);
    }
  }

  async function runAction(action: string): Promise<void> {
    if (!activeRow) return;
    const issue = remarksIssue(action, reason);
    if (issue) {
      setNoticeTone("error");
      setNotice(issue);
      return;
    }
    setBusyAction(action);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/operations/taxDeclarations/${encodeURIComponent(activeRow.id)}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "If-Match": `"${activeRow.version}"`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
        cache: "no-store",
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        throw new Error(str(asRecord(payload.error).message, `Request failed (${response.status}).`));
      }
      setNoticeTone("ok");
      setNotice(`${humanizeAction(action)} recorded.`);
      setReason("");
      refresh();
    } catch (err) {
      setNoticeTone("error");
      setNotice(err instanceof Error ? err.message : "The action could not be recorded.");
    } finally {
      setBusyAction("");
    }
  }

  const activeStatus = activeRow?.status ?? "";
  const canEdit = Boolean(activeRow) && EDITABLE_STATES.includes(activeStatus);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-054"
        title="Tax declaration and projection"
        description="Collect investment declarations, verify proofs and project the year-end tax position. Every figure the statutory rule pack cannot support is reported as blocked, with the missing rule named."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90" onClick={openCreate}>
              <Plus className="mr-1.5 size-4" /> Add declaration
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-054"
          description="Declare → submit → request proof → verify, partially verify, return or reject. The employee sees only their own declaration; payroll sees the scope its role permits. A rejected head reverts to zero and the projection recomputes. Verifier remarks are mandatory on a return, a rejection or a partial verification. Projected tax stays blocked until the statutory rule pack supplies the slabs, the standard deduction, the section ceilings and the HRA constants."
        />
      </Surface>

      {formOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title={formMode === "edit" ? "Edit declaration" : "New declaration"}
            description="Amounts are entered in rupees and stored in integer minor units. Blank heads are left undeclared rather than recorded as zero."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee</span>
              <select
                aria-label="Employee"
                className={`${selectClass} w-full`}
                value={formEmployeeId}
                disabled={formMode === "edit"}
                onChange={(e) => setFormEmployeeId(e.target.value)}
              >
                <option value="">Select an employee</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {`${str(person.employeeCode, "—")} · ${[str(person.firstName), str(person.lastName)].filter(Boolean).join(" ")}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tax regime</span>
              <select aria-label="Tax regime" className={`${selectClass} w-full`} value={formRegime} onChange={(e) => setFormRegime(e.target.value)}>
                <option value="old_regime">Old regime</option>
                <option value="new_regime">New regime</option>
              </select>
            </label>
          </div>
          {FORM_GROUPS.map((group) => (
            <div key={group.key} className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{group.description}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((field) => (
                  <label key={field.code} className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {field.label}
                      {field.kind === "money" ? " (INR)" : ""}
                    </span>
                    {field.code === "proofDocumentId" ? (
                      <ReferencePicker
                        endpoint="/api/v1/documents"
                        ariaLabel={field.label}
                        className={inputClass}
                        value={form[field.code] ?? ""}
                        onChange={(value) => setForm((current) => ({ ...current, [field.code]: value }))}
                      />
                    ) : (
                      <input
                        aria-label={field.label}
                        className={inputClass}
                        type={field.kind === "date" ? "date" : field.kind === "money" ? "number" : "text"}
                        inputMode={field.kind === "money" ? "decimal" : undefined}
                        min={field.kind === "money" ? 0 : undefined}
                        value={form[field.code] ?? ""}
                        onChange={(e) => setForm((current) => ({ ...current, [field.code]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={formBusy} onClick={() => void saveDeclaration()}>
              {formBusy ? "Saving…" : formMode === "edit" ? "Save declaration" : "Create declaration"}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </Surface>
      ) : null}

      {notice ? (
        <p className={`mb-4 rounded-lg border px-4 py-3 text-xs leading-relaxed ${noticeTone === "error" ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-success/25 bg-success/5 text-success"}`} role="status">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} declaration${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select aria-label="Regime filter" className={`${selectClass} w-full sm:w-auto`} value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)}>
                  <option value="all">All regimes</option>
                  <option value="old_regime">Old regime</option>
                  <option value="new_regime">New regime</option>
                </select>
                <select aria-label="Status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {Object.keys(STATE_LABELS).map((state) => (
                    <option key={state} value={state}>{STATE_LABELS[state]}</option>
                  ))}
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
              {rows.length === 0 ? "No declarations exist yet. Add the first declaration to begin the cycle." : "No declarations match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 font-bold">Regime</th>
                    <th className="px-3 py-2 font-bold">Projected TDS</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === activeId;
                    return (
                      <tr key={row.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectRow(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto_1.5rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.employeeName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.employeeCode} · FY {row.financialYear}</span>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{row.regimeLabel}</span>
                            <span className="min-w-0">
                              {row.projectedTdsMinor === null ? (
                                <>
                                  <span className="block text-xs font-semibold text-warning">Not computable</span>
                                  <span className="block truncate text-[10px] text-muted-foreground">
                                    Missing {row.projectedTdsBlockedBy[0] ?? "statutory rules"}
                                    {row.projectedTdsBlockedBy.length > 1 ? ` +${row.projectedTdsBlockedBy.length - 1}` : ""}
                                  </span>
                                </>
                              ) : (
                                <span className="block text-xs font-semibold tabular-nums text-foreground">{money(row.projectedTdsMinor)}</span>
                              )}
                            </span>
                            <span><StatusPill tone={statusTone(row.status)}>{stateLabel(row.status)}</StatusPill></span>
                            <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
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
            title="Declaration and projection"
            description={activeRow ? `${activeRow.employeeName} · FY ${activeRow.financialYear} · ${activeRow.regimeLabel}` : "Select a declaration to inspect its projection"}
            action={activeRow ? <StatusPill tone={statusTone(activeStatus)}>{stateLabel(activeStatus)}</StatusPill> : undefined}
          />
          {!activeRow ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No declaration selected.</p>
          ) : detailLoading && !projection ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !projection ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : projection ? (
            <div>
              <p className="text-xs text-muted-foreground">
                Rule pack {projection.rulePackCode} · Financial year {projection.financialYearLabel} · Work location {projection.location}
              </p>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Projected income (computed)</h3>
              {projection.grossState === "computed" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Figure label="Monthly gross" value={money(projection.monthlyGrossMinor ?? 0)} hint="Resolved from the salary structure" />
                  <Figure label="Annual salary gross" value={money(projection.annualSalaryGrossMinor ?? 0)} />
                  <Figure label="Previous employer salary" value={money(projection.previousEmployerIncomeMinor)} hint="As declared" />
                  <Figure label="Income from other sources" value={money(projection.otherSourcesIncomeMinor)} hint="As declared" />
                  <Figure label="Projected annual gross" value={money(projection.projectedAnnualGrossMinor ?? 0)} hint="Salary + previous employer + other sources" />
                  <Figure label="Total declared deductions" value={money(projection.declaredDeductionsMinor)} hint="Declared, before any ceiling is applied" />
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                  Projected gross is unavailable. {projection.grossReason ?? "The salary structure could not be resolved."}
                </p>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Declared deductions by section</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-bold">Section</th>
                      <th className="px-3 py-2 text-right font-bold">Declared</th>
                      <th className="px-3 py-2 font-bold">Ceiling</th>
                      <th className="px-3 py-2 text-right font-bold">Allowable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.sections.map((section) => (
                      <tr key={section.code} className="border-t border-border/60 align-top">
                        <td className="px-3 py-2">
                          <span className="block text-xs font-semibold text-foreground">{section.label}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {section.heads.filter((head) => head.declaredMinor > 0).map((head) => head.label).join(", ") || "Nothing declared"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(section.declaredMinor)}</td>
                        <td className="px-3 py-2">
                          {section.capped ? (
                            <span className="text-[11px] text-muted-foreground">Applied</span>
                          ) : (
                            <span className="text-[11px] leading-relaxed text-warning">
                              Indeterminate — <span className="font-mono text-[10px]">{section.capRule}</span> is not supplied
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          {section.allowableMinor === null ? <span className="text-warning">Blocked</span> : money(section.allowableMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {projection.rejectedHeadsUnidentified ? (
                <p className="mt-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  This declaration is partially verified, but the record carries no per-head verification outcome, so the rejected heads cannot be identified. Declared amounts are shown unchanged rather than zeroed at random.
                </p>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">HRA exemption</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Figure label="Annual rent paid" value={money(projection.hra.annualRentPaidMinor)} hint={`${money(projection.hra.monthlyRentPaidMinor)} per month, as declared`} />
                <Figure label="Annual basic + DA" value={projection.hra.annualBasicDaMinor === null ? "Unavailable" : money(projection.hra.annualBasicDaMinor)} />
                <Figure label="Annual HRA received" value={projection.hra.annualHraReceivedMinor === null ? "Unavailable" : money(projection.hra.annualHraReceivedMinor)} />
                <Figure
                  label="Metro status"
                  value={projection.hra.metro === null ? "Undetermined" : projection.hra.metro ? "Metro" : "Non-metro"}
                  hint={projection.hra.metro === null ? "hraExemption.metroCities is not supplied" : projection.hra.workLocation ?? undefined}
                />
              </div>
              <div className="mt-2">
                {projection.hra.exemptionMinor === null ? (
                  <BlockedFigure
                    label="HRA exemption"
                    blockedBy={projection.hra.blockedBy}
                    note="The inputs above are complete; the least-of-three constants are not."
                  />
                ) : (
                  <Figure label="HRA exemption" value={money(projection.hra.exemptionMinor)} />
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Landlord PAN {projection.hra.landlordPan ?? "not declared"} ·{" "}
                {projection.hra.landlordPanRequired === null
                  ? "Whether the PAN is mandatory cannot be decided while hraExemption.landlordPanThresholdMinor is unsupplied."
                  : projection.hra.landlordPanRequired
                    ? "PAN is mandatory at this rent."
                    : "PAN is not mandatory at this rent."}
              </p>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Projected tax position</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {projection.taxableIncome.amountMinor === null ? (
                  <BlockedFigure
                    label="Projected taxable income"
                    blockedBy={projection.taxableIncome.blockedBy}
                    note="Gross and declared totals are computed; the ceilings that would make them deductible are not."
                  />
                ) : (
                  <Figure label="Projected taxable income" value={money(projection.taxableIncome.amountMinor)} />
                )}
                {projection.annualTax.amountMinor === null ? (
                  <BlockedFigure label="Projected annual tax" blockedBy={projection.annualTax.blockedBy} />
                ) : (
                  <Figure label="Projected annual tax" value={money(projection.annualTax.amountMinor)} />
                )}
                <Figure
                  label="Tax deducted so far"
                  value={money(projection.taxDeducted.postedMinor)}
                  hint={`Posted payroll lines this financial year${projection.taxDeducted.provisionalMinor > 0 ? ` · ${money(projection.taxDeducted.provisionalMinor)} calculated but not finalised` : ""}`}
                />
                {projection.monthlyTds.amountMinor === null ? (
                  <BlockedFigure
                    label="Monthly TDS going forward"
                    blockedBy={projection.monthlyTds.blockedBy}
                    note={`${projection.monthlyTds.remainingMonths} month(s) remain after ${projection.monthlyTds.asOfPeriod}; the annual tax to spread across them is not computable.`}
                  />
                ) : (
                  <Figure label="Monthly TDS going forward" value={money(projection.monthlyTds.amountMinor)} />
                )}
              </div>
              {projection.taxDeducted.periods.length > 0 ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {projection.taxDeducted.periods.map((row) => `${row.period} (${row.runStatus}) ${money(row.amountMinor)}`).join(" · ")}
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">No TDS has been deducted in this financial year yet.</p>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Regime comparison</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {projection.regimes.map((regime) => (
                  <div key={regime.regime} className={`min-w-0 rounded-xl border p-3 ${regime.selected ? "border-primary/50 bg-primary/5" : "border-border/70 bg-secondary/30"}`}>
                    <p className="text-xs font-bold text-foreground">
                      {regime.label}
                      {regime.selected ? <span className="ml-2 text-[10px] font-semibold text-primary">elected</span> : null}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Gross {regime.grossMinor === null ? "unavailable" : money(regime.grossMinor)} · Declared deductions {money(regime.declaredDeductionsMinor)}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-warning">Annual tax not computable</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      Blocked by <span className="break-all font-mono">{regime.blockedBy.join(", ") || "unspecified"}</span>
                    </p>
                    {regime.admissibilityState !== "supplied" ? (
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        Which heads this regime admits is itself undefined: <span className="break-all font-mono">{regime.admissibilityRule}</span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Regime switching: {projection.regimeSwitch.reason}
                {projection.regimeSwitch.blockedBy.length > 0 ? (
                  <> Missing configuration: <span className="break-all font-mono text-[10px]">{projection.regimeSwitch.blockedBy.join(", ")}</span></>
                ) : null}
              </p>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {TIMELINE_STEPS.map((step, index) => {
                  const state = timelineState(step.key, activeStatus);
                  return (
                    <li key={step.key} className="flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${state === "done" ? "border-primary bg-primary text-primary-foreground" : state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                          {state === "done" ? "✓" : index + 1}
                        </span>
                        {index < TIMELINE_STEPS.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                      </span>
                      <span className={`pb-3 text-xs ${state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {index + 1}. {step.label}
                        {state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {activeStatus === "returned" ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">Returned to the employee for correction; it re-enters the timeline at Draft.</p>
              ) : null}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>
              <label className="mt-2 flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Verifier remarks (mandatory, at least {VERIFIER_REMARKS_MIN_LENGTH} characters, on return, rejection and partial verification)
                </span>
                <input aria-label="Verifier remarks" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {ACTIONS.map((entry) => {
                  const transition = TRANSITIONS[entry.action];
                  const allowed = Boolean(transition && transition.from.includes(activeStatus));
                  return (
                    <Button
                      key={entry.action}
                      variant="outline"
                      className="h-9 rounded-lg px-3 text-xs font-bold"
                      disabled={!allowed || busyAction !== ""}
                      title={allowed ? undefined : `Not available from ${stateLabel(activeStatus)}`}
                      onClick={() => void runAction(entry.action)}
                    >
                      {busyAction === entry.action ? "Working…" : entry.label}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!canEdit}
                  title={canEdit ? undefined : `Not editable from ${stateLabel(activeStatus)}`}
                  onClick={() => void openEdit()}
                >
                  Edit declaration
                </Button>
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {history.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this declaration.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {history.map((entry, index) => (
                    <li key={`${str(entry.id)}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">
                        {humanizeAction(str(entry.action, "Action"))}
                        {str(entry.status) ? <span className="ml-2 font-normal text-muted-foreground">→ {stateLabel(str(entry.status))}</span> : null}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.created_at ?? entry.createdAt), str(entry.reason)].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <Link href={`/payroll?record=${encodeURIComponent(activeId)}`} className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Open payroll <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
