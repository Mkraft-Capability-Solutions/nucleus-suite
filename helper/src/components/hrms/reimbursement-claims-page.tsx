"use client";

import { picklistValues } from "@/lib/picklists";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";
import { useWorkspace } from "./workspace-provider";

/**
 * SCR-058 / FRM-PAY-06 — Reimbursement claims.
 *
 * The register reads `/api/v1/reimbursement-claims`, which returns standalone
 * expense claims (travel-linked ones belong to the travel screen) together with
 * the entitlement position, claimed-to-date, the claimed-versus-passed split and
 * the payroll tag state. Every write goes to the generic operational endpoints
 * for the `expenses` resource, which own the state machine, `Idempotency-Key`,
 * `If-Match` and the audit trail.
 *
 * Three things this screen refuses to fake:
 *  - it never shows an annual entitlement or a balance when none is configured;
 *  - it never shows the amount claimed where the amount passed belongs;
 *  - it never implies a reimbursement will be paid. Tagging a payroll run records
 *    the tag; it raises no payroll input.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function int(value: unknown): number {
  return intOrNull(value) ?? 0;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

/** Rupees typed by a human to exact integer minor units; no float arithmetic. */
function toMinor(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function fromMinor(amountMinor: number | null): string {
  if (amountMinor === null) return "";
  return `${Math.trunc(amountMinor / 100)}.${String(Math.abs(amountMinor) % 100).padStart(2, "0")}`;
}

function humanize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function timeLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** The claim's real workflow state, as the `expenses` resource records it. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "reimbursed") return "success";
  if (status === "approved") return "info";
  if (status === "submitted") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  return "neutral";
}

// The maxima the `expenses` resource itself enforces, restated here only so the
// form can refuse a value before the server does and explain why.
const MAX_AMOUNT_MINOR = 100_000_000;

// PL_CLAIM_TYPE plus the two categories the travel module raises, which the reimbursement
// taxonomy does not carry. Both lists live in the `expenses` resource, so they match it exactly.
const CATEGORIES = [...picklistValues("PL_CLAIM_TYPE"), "transport", "accommodation"] as const;

const STATUSES = ["draft", "submitted", "returned", "approved", "rejected", "cancelled", "reimbursed"] as const;

const ACTIONS = ["submit", "approve", "return", "reject", "cancel", "reimburse"] as const;
type ClaimAction = (typeof ACTIONS)[number];

const ACTION_LABELS: Record<ClaimAction, string> = {
  submit: "Submit",
  approve: "Approve",
  return: "Return",
  reject: "Reject",
  cancel: "Cancel",
  reimburse: "Mark reimbursed",
};

const ACTION_FROM: Record<ClaimAction, string[]> = {
  submit: ["draft", "returned"],
  approve: ["submitted"],
  return: ["submitted"],
  reject: ["submitted"],
  cancel: ["draft", "returned", "submitted"],
  reimburse: ["approved"],
};

const APPROVAL_ACTIONS: ClaimAction[] = ["approve", "return", "reject", "reimburse"];

const EDITABLE_STATUSES = ["draft", "returned"];

function permissionGroups(action: ClaimAction): string[][] {
  const approval = APPROVAL_ACTIONS.includes(action);
  const base = approval ? "workforce.travel.approve" : "workforce.travel.write";
  const scoped = approval ? "workforce.travel.team.approve" : "workforce.travel.self.write";
  const extra = action === "reimburse" ? ["payroll.accounting.write"] : [];
  return [
    [base, ...extra],
    [scoped, ...extra],
  ];
}

/**
 * Why an action is unavailable, in the user's terms. The permission arm is
 * advisory — self and team scopes also depend on who owns the record, which only
 * the server settles — but it lets a button carry a reason instead of a 403.
 */
function actionState(action: ClaimAction, status: string, permissions: string[]): { allowed: boolean; reason: string } {
  const from = ACTION_FROM[action];
  if (!from.includes(status)) {
    return { allowed: false, reason: `${ACTION_LABELS[action]} needs a claim that is ${from.join(" or ")}. This claim is ${status}.` };
  }
  const groups = permissionGroups(action);
  if (!groups.some((group) => group.every((permission) => permissions.includes(permission)))) {
    return { allowed: false, reason: `Your role does not carry ${groups[0].join(" and ")}.` };
  }
  return { allowed: true, reason: "" };
}

type Timeline = { action: string; status: string | null; reason: string | null; at: string | null };

type Entitlement = {
  configured: boolean;
  schemeCode: string | null;
  annualEntitlementMinor: number | null;
  claimedToDateMinor: number;
  balanceMinor: number | null;
  exceeded: boolean;
  missing: string[];
  note: string;
  claimedToDate: { claimedMinor: number; travelLinkedMinor: number; passedMinor: number; claimCount: number; financialYear: string };
};

type Claim = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  travelId: string | null;
  expenseDate: string | null;
  financialYear: string | null;
  category: string;
  amountMinor: number;
  currency: string;
  approvedAmountMinor: number | null;
  entitlementMinor: number | null;
  payrollRunId: string | null;
  billNumber: string | null;
  vendor: string | null;
  vendorGstin: string | null;
  receiptDocumentId: string | null;
  description: string | null;
  paymentReference: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  passed: { recordedMinor: number | null; passedMinor: number | null; decided: boolean; defaulted: boolean; exceedsClaim: boolean; note: string };
  passedAmountEdit: { editable: boolean; reason: string };
  entitlement: Entitlement;
  payrollTag: { tagged: boolean; payrollRunId: string | null; runPeriod: string | null; runStatus: string | null; payrollInputRaised: boolean; note: string };
  gstin: { state: string; message: string };
  timeline: Array<{ status: string; label: string; state: "done" | "current" | "todo" }>;
  history: Timeline[];
  audit: Timeline[];
};

function readTimeline(value: unknown): Timeline[] {
  return (Array.isArray(value) ? (value as UnknownRecord[]) : []).map((entry) => ({
    action: str(entry.action, "—"),
    status: typeof entry.status === "string" ? entry.status : null,
    reason: typeof entry.reason === "string" ? entry.reason : null,
    at: typeof entry.at === "string" ? entry.at : null,
  }));
}

function readClaim(raw: UnknownRecord): Claim {
  const entitlement = asRecord(raw.entitlement);
  const claimed = asRecord(entitlement.claimedToDate);
  const passed = asRecord(raw.passed);
  const tag = asRecord(raw.payrollTag);
  const gstin = asRecord(raw.gstin);
  return {
    id: str(raw.id),
    version: int(raw.version),
    status: str(raw.status, "draft"),
    employeeId: typeof raw.employeeId === "string" ? raw.employeeId : null,
    employeeCode: typeof raw.employeeCode === "string" ? raw.employeeCode : null,
    employeeName: typeof raw.employeeName === "string" ? raw.employeeName : null,
    travelId: typeof raw.travelId === "string" ? raw.travelId : null,
    expenseDate: typeof raw.expenseDate === "string" ? raw.expenseDate : null,
    financialYear: typeof raw.financialYear === "string" ? raw.financialYear : null,
    category: str(raw.category, "other"),
    amountMinor: int(raw.amountMinor),
    currency: str(raw.currency, "INR"),
    approvedAmountMinor: intOrNull(raw.approvedAmountMinor),
    entitlementMinor: intOrNull(raw.entitlementMinor),
    payrollRunId: typeof raw.payrollRunId === "string" ? raw.payrollRunId : null,
    billNumber: typeof raw.billNumber === "string" ? raw.billNumber : null,
    vendor: typeof raw.vendor === "string" ? raw.vendor : null,
    vendorGstin: typeof raw.vendorGstin === "string" ? raw.vendorGstin : null,
    receiptDocumentId: typeof raw.receiptDocumentId === "string" ? raw.receiptDocumentId : null,
    description: typeof raw.description === "string" ? raw.description : null,
    paymentReference: typeof raw.paymentReference === "string" ? raw.paymentReference : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    passed: {
      recordedMinor: intOrNull(passed.recordedMinor),
      passedMinor: intOrNull(passed.passedMinor),
      decided: passed.decided === true,
      defaulted: passed.defaulted === true,
      exceedsClaim: passed.exceedsClaim === true,
      note: str(passed.note),
    },
    passedAmountEdit: {
      editable: asRecord(raw.passedAmountEdit).editable === true,
      reason: str(asRecord(raw.passedAmountEdit).reason),
    },
    entitlement: {
      configured: entitlement.configured === true,
      schemeCode: typeof entitlement.schemeCode === "string" ? entitlement.schemeCode : null,
      annualEntitlementMinor: intOrNull(entitlement.annualEntitlementMinor),
      claimedToDateMinor: int(entitlement.claimedToDateMinor),
      balanceMinor: intOrNull(entitlement.balanceMinor),
      exceeded: entitlement.exceeded === true,
      missing: Array.isArray(entitlement.missing) ? (entitlement.missing as unknown[]).map((item) => String(item)) : [],
      note: str(entitlement.note),
      claimedToDate: {
        claimedMinor: int(claimed.claimedMinor),
        travelLinkedMinor: int(claimed.travelLinkedMinor),
        passedMinor: int(claimed.passedMinor),
        claimCount: int(claimed.claimCount),
        financialYear: str(claimed.financialYear, "—"),
      },
    },
    payrollTag: {
      tagged: tag.tagged === true,
      payrollRunId: typeof tag.payrollRunId === "string" ? tag.payrollRunId : null,
      runPeriod: typeof tag.runPeriod === "string" ? tag.runPeriod : null,
      runStatus: typeof tag.runStatus === "string" ? tag.runStatus : null,
      payrollInputRaised: tag.payrollInputRaised === true,
      note: str(tag.note),
    },
    gstin: { state: str(gstin.state, "absent"), message: str(gstin.message) },
    timeline: Array.isArray(raw.timeline)
      ? (raw.timeline as UnknownRecord[]).map((step) => ({
          status: str(step.status),
          label: str(step.label, str(step.status)),
          state: (str(step.state, "todo") as "done" | "current" | "todo") || "todo",
        }))
      : [],
    history: readTimeline(raw.history),
    audit: readTimeline(raw.audit),
  };
}

type EmployeeOption = { id: string; label: string };
type RunOption = { id: string; label: string };

type ClaimForm = {
  employeeId: string;
  expenseDate: string;
  category: string;
  amount: string;
  currency: string;
  receiptDocumentId: string;
  description: string;
  billNumber: string;
  vendor: string;
  vendorGstin: string;
  entitlement: string;
  approvedAmount: string;
  payrollRunId: string;
};

const emptyForm: ClaimForm = {
  employeeId: "",
  expenseDate: "",
  category: "fuel_conveyance",
  amount: "",
  currency: "INR",
  receiptDocumentId: "",
  description: "",
  billNumber: "",
  vendor: "",
  vendorGstin: "",
  entitlement: "",
  approvedAmount: "",
  payrollRunId: "",
};

function formFor(claim: Claim): ClaimForm {
  return {
    employeeId: claim.employeeId ?? "",
    expenseDate: claim.expenseDate ?? "",
    category: claim.category,
    amount: fromMinor(claim.amountMinor),
    currency: claim.currency,
    receiptDocumentId: claim.receiptDocumentId ?? "",
    description: claim.description ?? "",
    billNumber: claim.billNumber ?? "",
    vendor: claim.vendor ?? "",
    vendorGstin: claim.vendorGstin ?? "",
    entitlement: fromMinor(claim.entitlementMinor),
    approvedAmount: fromMinor(claim.approvedAmountMinor),
    payrollRunId: claim.payrollRunId ?? "",
  };
}

/** The strict body the `expenses` resource accepts. Blank optionals are omitted. */
function buildBody(form: ClaimForm): { body: UnknownRecord } | { error: string } {
  const amountMinor = toMinor(form.amount);
  if (amountMinor === null) return { error: "Enter the amount claimed as a number with at most two decimals." };
  if (amountMinor < 1) return { error: "The amount claimed must be more than zero." };
  if (amountMinor > MAX_AMOUNT_MINOR) return { error: `The amount claimed cannot exceed ${money(MAX_AMOUNT_MINOR)}.` };
  if (!/^[0-9a-f-]{36}$/i.test(form.employeeId.trim())) return { error: "Choose the employee the claim belongs to." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expenseDate)) return { error: "Enter the expense date." };
  if (form.receiptDocumentId.trim() === "") return { error: "Record the receipt document reference. A claim without a receipt cannot be raised here." };
  if (form.description.trim() === "") return { error: "Describe what is being claimed." };
  if (!/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) return { error: "Enter the currency as a three-letter code." };

  const body: UnknownRecord = {
    employeeId: form.employeeId.trim(),
    expenseDate: form.expenseDate,
    category: form.category,
    amountMinor,
    currency: form.currency.trim().toUpperCase(),
    receiptDocumentId: form.receiptDocumentId.trim(),
    description: form.description.trim(),
  };
  for (const [key, value] of [
    ["billNumber", form.billNumber],
    ["vendor", form.vendor],
    ["vendorGstin", form.vendorGstin],
    ["payrollRunId", form.payrollRunId],
  ] as const) {
    if (value.trim() !== "") body[key] = value.trim();
  }
  if (form.entitlement.trim() !== "") {
    const entitlementMinor = toMinor(form.entitlement);
    if (entitlementMinor === null || entitlementMinor > MAX_AMOUNT_MINOR) return { error: "Enter the entitlement captured on the claim as a number with at most two decimals." };
    body.entitlementMinor = entitlementMinor;
  }
  if (form.approvedAmount.trim() !== "") {
    const approvedMinor = toMinor(form.approvedAmount);
    if (approvedMinor === null) return { error: "Enter the amount passed as a number with at most two decimals." };
    if (approvedMinor > amountMinor) return { error: "The amount passed cannot exceed the amount claimed." };
    body.approvedAmountMinor = approvedMinor;
  }
  return { body };
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const fieldLabelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className={fieldLabelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function ReimbursementClaimsPage() {
  const { workspace } = useWorkspace();
  const permissions = useMemo(() => workspace?.context?.permissions ?? [], [workspace?.context?.permissions]);

  // Deep-link preselect (?record=<claimId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [lookupNote, setLookupNote] = useState("");

  const [formOpen, setFormOpen] = useState<"none" | "create" | "amend">("none");
  const [form, setForm] = useState<ClaimForm>(emptyForm);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  const [pendingAction, setPendingAction] = useState<ClaimAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

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
        const payload = await getJson("/api/v1/reimbursement-claims");
        const rows = Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : [];
        if (live) setClaims(rows.map(readClaim));
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "Reimbursement claims could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  // The pickers are conveniences. When a role cannot read them the form still
  // works from typed references, and says so rather than blocking the claim.
  useEffect(() => {
    let live = true;
    void (async () => {
      const notes: string[] = [];
      try {
        const payload = await getJson("/api/v1/people?page=1&pageSize=100");
        const rows = Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : [];
        if (live) {
          setEmployees(
            rows.map((row) => ({
              id: str(row.id),
              label: `${str(row.firstName)} ${str(row.lastName)}`.trim() + (row.employeeCode ? ` (${str(row.employeeCode)})` : ""),
            })),
          );
        }
      } catch {
        notes.push("the employee directory");
      }
      try {
        const payload = await getJson("/api/v1/payroll-runs?page=1&pageSize=100");
        const rows = Array.isArray(asRecord(payload).data) ? (asRecord(payload).data as UnknownRecord[]) : [];
        if (live) setRuns(rows.map((row) => ({ id: str(row.id), label: `${str(row.period, "—")} · ${str(row.scope, "—")} · ${str(row.status, "—")}` })));
      } catch {
        notes.push("the payroll run list");
      }
      if (live) {
        setLookupNote(
          notes.length === 0
            ? ""
            : `Your role cannot read ${notes.join(" or ")}, so ${notes.length === 1 ? "that reference" : "those references"} must be typed in.`,
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return claims.filter((claim) => {
      if (statusFilter !== "all" && claim.status !== statusFilter) return false;
      if (categoryFilter !== "all" && claim.category !== categoryFilter) return false;
      if (needle === "") return true;
      return [claim.employeeName, claim.employeeCode, claim.description, claim.vendor, claim.billNumber, claim.category]
        .some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
    });
  }, [claims, search, statusFilter, categoryFilter]);

  const activeClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedId) ?? filtered[0] ?? null,
    [claims, selectedId, filtered],
  );

  const unconfigured = useMemo(() => {
    const gaps = new Set<string>();
    for (const claim of claims) for (const gap of claim.entitlement.missing) gaps.add(gap);
    return [...gaps];
  }, [claims]);

  const canRaise = useMemo(
    () => permissionGroups("submit").some((group) => group.every((permission) => permissions.includes(permission))),
    [permissions],
  );

  function closeForms(): void {
    setFormOpen("none");
    setFormError("");
    setFormOk("");
    setPendingAction(null);
    setActionError("");
    setActionReason("");
    setPaymentReference("");
  }

  async function saveClaim(mode: "create" | "amend", claim: Claim | null): Promise<void> {
    const built = buildBody(form);
    if ("error" in built) {
      setFormError(built.error);
      return;
    }
    setFormBusy(true);
    setFormError("");
    setFormOk("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() };
      let path = "/api/v1/operations/expenses";
      let method = "POST";
      if (mode === "amend") {
        if (!claim) throw new Error("No claim is selected.");
        path = `/api/v1/operations/expenses/${encodeURIComponent(claim.id)}`;
        method = "PATCH";
        headers["If-Match"] = `"${claim.version}"`;
      }
      const response = await fetch(path, { method, headers, cache: "no-store", body: JSON.stringify(built.body) });
      const payload = (await response.json().catch(() => null)) as { data?: { id?: string }; error?: { message?: string; details?: Array<{ field: string; issue: string }> } } | null;
      if (!response.ok) {
        const details = (payload?.error?.details ?? []).map((detail) => `${detail.field}: ${detail.issue}`).join("; ");
        throw new Error([payload?.error?.message ?? `The claim could not be saved (${response.status}).`, details].filter(Boolean).join(" "));
      }
      const id = payload?.data?.id;
      if (typeof id === "string") setSelectedId(id);
      setFormOk(mode === "create" ? "Claim raised as a draft. Submit it when the receipt is attached." : "Claim updated.");
      setFormOpen("none");
      refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The claim could not be saved.");
    } finally {
      setFormBusy(false);
    }
  }

  async function runAction(claim: Claim, action: ClaimAction): Promise<void> {
    if (actionReason.trim().length < 3) {
      setActionError("Record a reason of at least 3 characters. It is written to the audit trail.");
      return;
    }
    if (action === "reimburse" && paymentReference.trim().length < 3) {
      setActionError("Enter the completed payment reference.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      const body: UnknownRecord = { reason: actionReason.trim() };
      if (action === "reimburse") body.paymentReference = paymentReference.trim();
      const response = await fetch(`/api/v1/operations/expenses/${encodeURIComponent(claim.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID(), "If-Match": `"${claim.version}"` },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string; details?: Array<{ field: string; issue: string }> } } | null;
        const details = (payload?.error?.details ?? []).map((detail) => `${detail.field}: ${detail.issue}`).join("; ");
        throw new Error([payload?.error?.message ?? `The action failed (${response.status}).`, details].filter(Boolean).join(" "));
      }
      closeForms();
      refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-058"
        title="Reimbursement claims"
        description="Raise, verify and pass employee reimbursement claims against their bills, then tag the passed amount to a payroll run. Claims raised against a travel request are handled on the travel screen."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl px-4 text-xs font-bold"
              disabled={!canRaise}
              title={canRaise ? undefined : "Your role does not carry workforce.travel.write."}
              onClick={() => {
                closeForms();
                setForm(emptyForm);
                setFormOpen("create");
              }}
            >
              <Plus className="mr-1.5 size-4" /> Raise a claim
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-058"
          description="Raise the claim with its bill and receipt → submit → an independent approver passes an amount (which may be lower than claimed) → tag the passed amount to a payroll run → mark reimbursed with the payment reference. A returned claim goes back to the claimant; a rejected or cancelled claim consumes no entitlement."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          The amount passed is held on the claim itself, so it can only be recorded while the claim is a draft or has been returned — the approve action carries a reason only. To pass less than was claimed, return the claim, record the amount passed on it, and approve the resubmission. FRM-PAY-06 requires a reimbursement to reach payroll by being tagged to a run and never as a manual edit; tagging is recorded here, and the gap below says exactly how far that tag currently travels.
        </p>
      </Surface>

      <Surface className="mb-6 border-warning/40">
        <SectionHeading
          title="What this screen cannot tell you"
          description="Stated plainly so no figure here is read as more than it is."
          action={<StatusPill tone="warning">Known gaps</StatusPill>}
        />
        <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-bold text-foreground">No payroll input is raised.</span> Marking a claim reimbursed records the claim, its event and its audit row. It does not create a payroll input, so a tagged claim does not yet feed payroll calculation and no money moves from this screen. The payment reference you record is the evidence of a payment made elsewhere.
          </li>
          <li>
            <span className="font-bold text-foreground">Annual entitlement is configuration, not data.</span>{" "}
            {unconfigured.length === 0
              ? "An entitlement scheme is configured for every claim type in view, so annual entitlement and balance are real figures below."
              : `No entitlement master, scheme or per-category limit exists in this product. Until ${unconfigured.length === 1 ? "it" : "they"} ${unconfigured.length === 1 ? "is" : "are"} configured, entitlement and balance are reported as not configured — never as zero and never as unlimited — and no claim is blocked against a limit. Missing: ${unconfigured.join(" ")}`}
          </li>
          <li>
            <span className="font-bold text-foreground">Vendor GSTIN is free text in the API.</span> The 15-character format is checked on this screen only; the stored field accepts anything, and no check confirms the GSTIN exists or is active.
          </li>
        </ul>
      </Surface>

      {formOpen !== "none" ? (
        <Surface className="mb-6">
          <SectionHeading
            title={formOpen === "create" ? "Raise a reimbursement claim" : "Amend claim"}
            description={
              formOpen === "create"
                ? "The claim is created as a draft against the employee, the claim type and the bill. Submit it separately."
                : "A claim can only be amended while it is a draft or has been returned. This is where the amount passed is recorded."
            }
            action={
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={closeForms}>
                Close
              </Button>
            }
          />
          {lookupNote ? <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{lookupNote}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Employee">
              {employees.length > 0 ? (
                <select aria-label="Employee" className={`${selectClass} w-full`} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
                  <option value="">Choose an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.label}</option>
                  ))}
                </select>
              ) : (
                <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" ariaLabel="Employee" className={`${inputClass} w-full`} value={form.employeeId} onChange={(value) => setForm({ ...form, employeeId: value })} />
              )}
            </Field>
            <Field label="Claim type">
              <select aria-label="Claim type" className={`${selectClass} w-full`} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{humanize(category)}</option>
                ))}
              </select>
            </Field>
            <Field label="Expense date">
              <input type="date" aria-label="Expense date" className={`${inputClass} w-full`} value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
            </Field>
            <Field label="Amount claimed" hint={`Major units, up to two decimals. Stored as integer minor units; the resource caps a claim at ${money(MAX_AMOUNT_MINOR)}.`}>
              <input inputMode="decimal" aria-label="Amount claimed" className={`${inputClass} w-full`} placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Currency">
              <input aria-label="Currency" className={`${inputClass} w-full uppercase`} maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
            </Field>
            <Field label="Receipt document" hint="The stored receipt this claim is evidenced by.">
              <ReferencePicker endpoint="/api/v1/documents" ariaLabel="Receipt document" className={`${inputClass} w-full`} value={form.receiptDocumentId} onChange={(value) => setForm({ ...form, receiptDocumentId: value })} />
            </Field>
            <Field label="Bill number">
              <input aria-label="Bill number" className={`${inputClass} w-full`} value={form.billNumber} onChange={(event) => setForm({ ...form, billNumber: event.target.value })} />
            </Field>
            <Field label="Vendor">
              <input aria-label="Vendor" className={`${inputClass} w-full`} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
            </Field>
            <Field label="Vendor GSTIN" hint="Format checked on this screen only; the API stores it as free text.">
              <input aria-label="Vendor GSTIN" className={`${inputClass} w-full uppercase`} maxLength={15} value={form.vendorGstin} onChange={(event) => setForm({ ...form, vendorGstin: event.target.value })} />
            </Field>
            <Field label="Entitlement on this claim" hint="Optional. A figure captured on the claim; it is not an annual entitlement and nothing validates it.">
              <input inputMode="decimal" aria-label="Entitlement on this claim" className={`${inputClass} w-full`} placeholder="0.00" value={form.entitlement} onChange={(event) => setForm({ ...form, entitlement: event.target.value })} />
            </Field>
            <Field label="Amount passed" hint="Optional, and never above the amount claimed. Leave blank to pass the full claim on approval.">
              <input inputMode="decimal" aria-label="Amount passed" className={`${inputClass} w-full`} placeholder="0.00" value={form.approvedAmount} onChange={(event) => setForm({ ...form, approvedAmount: event.target.value })} />
            </Field>
            <Field label="Payroll run tag" hint="Optional. Recording a run tags the claim. It does not raise a payroll input.">
              {runs.length > 0 ? (
                <select aria-label="Payroll run tag" className={`${selectClass} w-full`} value={form.payrollRunId} onChange={(event) => setForm({ ...form, payrollRunId: event.target.value })}>
                  <option value="">No run tagged</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>{run.label}</option>
                  ))}
                </select>
              ) : (
                <ReferencePicker endpoint="/api/v1/payroll-runs" ariaLabel="Payroll run tag" className={`${inputClass} w-full`} value={form.payrollRunId} onChange={(value) => setForm({ ...form, payrollRunId: value })} />
              )}
            </Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <Field label="Description">
                <input aria-label="Description" className={`${inputClass} w-full`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
            </div>
          </div>
          {formError ? <p role="alert" className="mt-3 text-xs text-destructive">{formError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="h-9 rounded-lg text-xs" disabled={formBusy} onClick={() => void saveClaim(formOpen === "create" ? "create" : "amend", activeClaim)}>
              {formBusy ? "Saving…" : formOpen === "create" ? "Raise claim" : "Save amendment"}
            </Button>
          </div>
        </Surface>
      ) : null}

      {formOk ? <p className="mb-4 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">{formOk}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} reimbursement claim${filtered.length === 1 ? "" : "s"} in scope. Travel-linked claims are not shown here.`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <input aria-label="Search claims" className={`${inputClass} w-full sm:w-auto`} placeholder="Employee, vendor or bill" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select aria-label="Claim type filter" className={`${selectClass} w-full sm:w-auto`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All claim types</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{humanize(category)}</option>
                  ))}
                </select>
                <select aria-label="Claim status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{humanize(status)}</option>
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
              {claims.length === 0
                ? "No reimbursement claims have been raised yet. Raise the first one, attach its receipt, then submit it."
                : "No claims match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 font-bold">Claim type</th>
                    <th className="px-3 py-2 font-bold">Expense date</th>
                    <th className="px-3 py-2 text-right font-bold">Amount claimed</th>
                    <th className="px-3 py-2 text-right font-bold">Amount passed</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((claim) => {
                    const selected = claim.id === activeClaim?.id;
                    return (
                      <tr key={claim.id}>
                        <td colSpan={7} className="p-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(claim.id);
                              closeForms();
                            }}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="truncate text-xs font-semibold text-foreground">
                              {claim.employeeName ?? claim.employeeId ?? "Unlinked"}
                              {claim.employeeCode ? <span className="ml-1 font-normal text-muted-foreground">({claim.employeeCode})</span> : null}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{humanize(claim.category)}</span>
                            <span className="truncate text-xs text-muted-foreground">{claim.expenseDate ?? "—"}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{money(claim.amountMinor)}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">
                              {claim.passed.passedMinor === null ? <span className="text-muted-foreground">Not decided</span> : money(claim.passed.passedMinor)}
                            </span>
                            <span><StatusPill tone={statusTone(claim.status)}>{humanize(claim.status)}</StatusPill></span>
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
            title="Claim detail"
            description={activeClaim ? `${humanize(activeClaim.category)} · ${activeClaim.expenseDate ?? "date pending"}` : "Select a claim to inspect it"}
            action={activeClaim ? <StatusPill tone={statusTone(activeClaim.status)}>{humanize(activeClaim.status)}</StatusPill> : undefined}
          />
          {!activeClaim ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No claim selected.</p>
          ) : (
            <div className="space-y-5">
              <dl className="space-y-2 text-xs">
                {[
                  ["Employee", activeClaim.employeeName ?? activeClaim.employeeId ?? "Not linked"],
                  ["Claim type", humanize(activeClaim.category)],
                  ["Expense date", activeClaim.expenseDate ?? "—"],
                  ["Financial year", activeClaim.financialYear ?? "Not determined from the expense date"],
                  ["Amount claimed", `${activeClaim.currency} ${money(activeClaim.amountMinor)}`],
                  [
                    "Amount passed",
                    activeClaim.passed.passedMinor === null
                      ? "Not decided"
                      : `${activeClaim.currency} ${money(activeClaim.passed.passedMinor)}`,
                  ],
                  ["Description", activeClaim.description ?? "—"],
                  ["Receipt", activeClaim.receiptDocumentId ?? "No receipt reference recorded"],
                  ["Payment reference", activeClaim.paymentReference ?? "Not reimbursed"],
                  ["Raised", timeLabel(activeClaim.createdAt)],
                  ["Last change", timeLabel(activeClaim.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{activeClaim.passed.note}</p>
              {activeClaim.passed.exceedsClaim ? (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] leading-relaxed text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {activeClaim.currency} {money(activeClaim.passed.recordedMinor ?? 0)} is recorded as passed against a claim of {money(activeClaim.amountMinor)}. The figure above is capped at the claim.
                </p>
              ) : null}
              {!activeClaim.passedAmountEdit.editable ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">{activeClaim.passedAmountEdit.reason}</p>
              ) : null}

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Bill and vendor</h3>
                <dl className="space-y-2 text-xs">
                  {[
                    ["Bill number", activeClaim.billNumber ?? "Not captured"],
                    ["Vendor", activeClaim.vendor ?? "Not captured"],
                    ["Vendor GSTIN", activeClaim.vendorGstin ?? "Not captured"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <StatusPill tone={activeClaim.gstin.state === "valid" ? "success" : activeClaim.gstin.state === "malformed" ? "danger" : "neutral"}>
                    GSTIN {activeClaim.gstin.state}
                  </StatusPill>
                  <span>{activeClaim.gstin.message}</span>
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Entitlement position</h3>
                <dl className="space-y-2 text-xs">
                  {[
                    ["Financial year", activeClaim.entitlement.claimedToDate.financialYear || "—"],
                    [
                      "Annual entitlement",
                      activeClaim.entitlement.annualEntitlementMinor === null
                        ? "Not configured"
                        : `${activeClaim.currency} ${money(activeClaim.entitlement.annualEntitlementMinor)}`,
                    ],
                    [
                      "Claimed to date",
                      `${activeClaim.currency} ${money(activeClaim.entitlement.claimedToDate.claimedMinor)} over ${activeClaim.entitlement.claimedToDate.claimCount} claim${activeClaim.entitlement.claimedToDate.claimCount === 1 ? "" : "s"}`,
                    ],
                    [
                      "Of which travel-linked",
                      `${activeClaim.currency} ${money(activeClaim.entitlement.claimedToDate.travelLinkedMinor)}`,
                    ],
                    [
                      "Passed to date",
                      `${activeClaim.currency} ${money(activeClaim.entitlement.claimedToDate.passedMinor)}`,
                    ],
                    [
                      "Balance",
                      activeClaim.entitlement.balanceMinor === null
                        ? "Not configured"
                        : `${activeClaim.currency} ${money(activeClaim.entitlement.balanceMinor)}`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{activeClaim.entitlement.note}</p>
                {activeClaim.entitlement.missing.map((gap) => (
                  <p key={gap} className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Missing: {gap}</p>
                ))}
                {activeClaim.entitlement.exceeded ? (
                  <StatusPill tone="warning">Over the configured entitlement — reported, not blocked</StatusPill>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payroll tag</h3>
                <dl className="space-y-2 text-xs">
                  {[
                    ["Tagged run", activeClaim.payrollTag.payrollRunId ?? "No run tagged"],
                    ["Run period", activeClaim.payrollTag.runPeriod ?? "—"],
                    ["Run status", activeClaim.payrollTag.runStatus ?? "—"],
                    ["Payroll input raised", activeClaim.payrollTag.payrollInputRaised ? "Yes" : "No"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{activeClaim.payrollTag.note}</p>
                {activeClaim.payrollTag.payrollRunId ? (
                  <Link href={`/payroll-run-cockpit?record=${encodeURIComponent(activeClaim.payrollTag.payrollRunId)}`} className="mt-2 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                    Open the tagged run <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">State</h3>
                <ol className="space-y-1.5">
                  {activeClaim.timeline.map((step) => (
                    <li key={step.status} className="flex items-center justify-between gap-3 text-xs">
                      <span className={`min-w-0 ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{step.label}</span>
                      <StatusPill tone={step.state === "done" ? "success" : step.state === "current" ? "info" : "neutral"}>{step.state}</StatusPill>
                    </li>
                  ))}
                </ol>
                {!["draft", "submitted", "approved", "reimbursed"].includes(activeClaim.status) ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    This claim is {humanize(activeClaim.status).toLowerCase()}, which is off the main path. Only the steps its own history records are marked done.
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((action) => {
                    const state = actionState(action, activeClaim.status, permissions);
                    return (
                      <Button
                        key={action}
                        size="sm"
                        variant={action === "reject" || action === "cancel" ? "outline" : "default"}
                        className="h-9 rounded-lg text-xs"
                        disabled={!state.allowed}
                        title={state.allowed ? undefined : state.reason}
                        onClick={() => {
                          setPendingAction(action);
                          setActionError("");
                          setActionReason("");
                          setPaymentReference("");
                        }}
                      >
                        {ACTION_LABELS[action]}
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                    disabled={!EDITABLE_STATUSES.includes(activeClaim.status) || !canRaise}
                    title={
                      !EDITABLE_STATUSES.includes(activeClaim.status)
                        ? activeClaim.passedAmountEdit.reason
                        : canRaise
                          ? undefined
                          : "Your role does not carry workforce.travel.write."
                    }
                    onClick={() => {
                      closeForms();
                      setForm(formFor(activeClaim));
                      setFormOpen("amend");
                    }}
                  >
                    Amend
                  </Button>
                </div>
                <ul className="mt-2 space-y-1">
                  {ACTIONS.map((action) => {
                    const state = actionState(action, activeClaim.status, permissions);
                    if (state.allowed) return null;
                    return (
                      <li key={action} className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">{ACTION_LABELS[action]}:</span> {state.reason}
                      </li>
                    );
                  })}
                </ul>
                {pendingAction ? (
                  <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    <p className="mb-2 text-xs font-bold text-foreground">{ACTION_LABELS[pendingAction]}</p>
                    <Field label="Reason" hint="At least 3 characters. Written to the claim history and the audit trail.">
                      <input aria-label="Reason" className={`${inputClass} w-full`} value={actionReason} onChange={(event) => setActionReason(event.target.value)} />
                    </Field>
                    {pendingAction === "reimburse" ? (
                      <div className="mt-3">
                        <Field label="Payment reference" hint="The reference of the payment already made. This screen records it; it does not make the payment.">
                          <input aria-label="Payment reference" className={`${inputClass} w-full`} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                        </Field>
                      </div>
                    ) : null}
                    {actionError ? <p role="alert" className="mt-2 text-xs text-destructive">{actionError}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="h-8 rounded-lg text-xs" disabled={actionBusy} onClick={() => void runAction(activeClaim, pendingAction)}>
                        {actionBusy ? "Working…" : `Confirm ${ACTION_LABELS[pendingAction].toLowerCase()}`}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setPendingAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Claim history</h3>
                {activeClaim.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No transitions have been recorded on this claim yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {activeClaim.history.map((entry, index) => (
                      <li key={`${entry.action}-${entry.at}-${index}`} className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-[11px]">
                        <div className="flex justify-between gap-3">
                          <span className="min-w-0 break-words font-semibold text-foreground">{humanize(entry.action)}</span>
                          <span className="shrink-0 text-muted-foreground">{timeLabel(entry.at)}</span>
                        </div>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">
                          {entry.status ? `${humanize(entry.status)} · ` : ""}
                          {entry.reason ?? "No reason recorded"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
                {activeClaim.audit.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No audit events are visible for this claim.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {activeClaim.audit.map((entry, index) => (
                      <li key={`${entry.action}-${entry.at}-${index}`} className="flex justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-[11px]">
                        <span className="min-w-0 break-words text-foreground">{entry.action}</span>
                        <span className="shrink-0 text-muted-foreground">{timeLabel(entry.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
