"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { operationalResources } from "@/lib/operational-catalog";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

/**
 * Full and final PROPOSAL DESK (module `settlements`, SCR-056 proposals).
 *
 * This is where a settlement proposal is RAISED and EDITED. The SCR-056 screen
 * (`full-final-page.tsx`, module `full-final-settlement`) reads a proposal,
 * recomputes its working and finalises it against the payroll-run, no-dues,
 * asset and loan gates - it has no create form. This screen is the other half:
 * pick an open exit case and a finalised payroll run, key every head, and take
 * the proposal through submit, approve, return, reject or cancel. Finalize is
 * NOT rebuilt here; it links across to the screen that owns the gates.
 *
 * Writes go to `/api/v1/operations/settlements`, never to a bespoke endpoint.
 */

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

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number, currency = "INR"): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")} ${currency}`;
}

function moneyOrDash(amountMinor: number | null, currency = "INR"): string {
  return amountMinor === null ? "—" : money(amountMinor, currency);
}

function minorToRupeeInput(amountMinor: number | null): string {
  return amountMinor === null ? "" : String(amountMinor / 100);
}

function rupeeInputToMinor(value: string): number {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function timeLabel(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function humanize(value: string): string {
  return value.replace(/^operations\.settlements\./, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "finalized") return "success";
  if (status === "approved") return "info";
  if (status === "submitted") return "warning";
  if (status === "rejected" || status === "returned" || status === "cancelled") return "danger";
  return "neutral";
}

let fallbackKeyCounter = 0;
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

// ---------------------------------------------------------------------------
// The resource contract, read off the catalog so this screen cannot drift from
// what the server accepts. `src/server/payroll/settlement-proposals.ts` is
// server-only and cannot be imported here, so the two arithmetic mirrors below
// (`formTotals`, `projectPrefill`) restate what `proposalTotals` and
// `prefillFromWorking` define and test there.
// ---------------------------------------------------------------------------

const RESOURCE = operationalResources.settlements;
/** FRM-PAY-08 "Exit type" is PL_EXIT_TYPE; the registry owns the vocabulary, not this file. */
const EXIT_TYPES = picklists.PL_EXIT_TYPE.values;

const REQUIRED_FIELDS = new Set(
  RESOURCE.fields.filter((field) => !field.optional && typeof field.name === "string").map((field) => field.name as string),
);

/**
 * Every field the `settlements` resource declares. The API parses a proposal strictly, so the
 * desk only ever offers what the catalog actually accepts: a head listed below but not yet
 * declared (FRM-PAY-08's `noticePayableMinor` and `otherRecoveryReason`, requested in
 * `tmp/_audit/requests/payroll.md`) is simply not rendered, and appears the day it is declared.
 */
const DECLARED_FIELDS = new Set(RESOURCE.fields.map((field) => field.name).filter((name): name is string => typeof name === "string"));

const declared = (heads: readonly string[]): string[] => heads.filter((head) => DECLARED_FIELDS.has(head));

const EARNING_HEADS = declared(["salaryPayableMinor", "leaveEncashmentMinor", "gratuityMinor", "bonusPayableMinor", "noticePayableMinor", "otherEarningsMinor"]);
const RECOVERY_HEADS = declared(["loanRecoveryMinor", "noticeRecoveryMinor", "advanceRecoveryMinor", "assetRecoveryMinor", "otherRecoveryMinor", "taxDeductionMinor"]);
const WAIVER_HEAD = "recoveryWaiverMinor";

/** FRM-PAY-08 minimums, enforced again on the server. */
const WAIVER_REASON_MIN_LENGTH = 20;
const REMARKS_MIN_LENGTH = 10;

const HEAD_LABELS: Record<string, string> = {
  salaryPayableMinor: "Salary for the final period",
  leaveEncashmentMinor: "Leave encashment",
  gratuityMinor: "Gratuity",
  bonusPayableMinor: "Bonus payable",
  noticePayableMinor: "Notice pay payable",
  otherEarningsMinor: "Other earnings",
  loanRecoveryMinor: "Loan foreclosure",
  noticeRecoveryMinor: "Notice shortfall recovery",
  advanceRecoveryMinor: "Salary advance recovery",
  assetRecoveryMinor: "Asset recovery",
  otherRecoveryMinor: "Other recovery",
  taxDeductionMinor: "Tax deducted at source",
  recoveryWaiverMinor: "Recovery waived",
};

type MoneyGroup = { key: string; title: string; description: string; heads: string[] };

const MONEY_GROUPS: MoneyGroup[] = [
  {
    key: "earnings",
    title: "Earnings",
    description: "What the leaver is owed. Every head is recorded at the figure keyed here, not at a figure this screen invents.",
    heads: EARNING_HEADS,
  },
  {
    key: "recoveries",
    title: "Recoveries",
    description: "What is being recovered from the settlement. Recoveries are recorded in full; forgiveness belongs in the waiver below.",
    heads: RECOVERY_HEADS.filter((head) => head !== "taxDeductionMinor"),
  },
  {
    key: "waiver",
    title: "Recovery waiver",
    description: "A waiver offsets recoveries on the earning side rather than editing the recovery it forgives, so the original claim stays visible. Any waived amount needs a reason.",
    heads: [WAIVER_HEAD],
  },
  {
    key: "tax",
    title: "Tax",
    description: "Tax deducted at source on the settlement. The rule pack supplies no settlement slabs, so this is a reviewed figure, not a computed one.",
    heads: ["taxDeductionMinor"],
  },
];

const MONEY_FIELDS = MONEY_GROUPS.flatMap((group) => group.heads);
const TEXT_FIELDS = declared(["lastWorkingDate", "exitType", "recoveryWaiverReason", "otherRecoveryReason", "calculationPolicyReference", "notes"]);
const FORM_FIELDS = ["offboardingCaseId", "payrollRunId", ...TEXT_FIELDS, ...MONEY_FIELDS];

function emptyForm(): Record<string, string> {
  return Object.fromEntries(FORM_FIELDS.map((field) => [field, ""]));
}

type Totals = {
  earningsMinor: number;
  recoveriesMinor: number;
  waiverMinor: number;
  netPayableMinor: number;
  settlementOutcome: "payable" | "recovery_pending";
  recoverableMinor: number;
};

/** Mirrors `proposalTotals`: waiver is an earning-side offset, a negative net is a recovery. */
function formTotals(values: Record<string, number>): Totals {
  const waiverMinor = values[WAIVER_HEAD] ?? 0;
  const earningsMinor = EARNING_HEADS.reduce((total, head) => total + (values[head] ?? 0), 0) + waiverMinor;
  const recoveriesMinor = RECOVERY_HEADS.reduce((total, head) => total + (values[head] ?? 0), 0);
  const netPayableMinor = earningsMinor - recoveriesMinor;
  return {
    earningsMinor,
    recoveriesMinor,
    waiverMinor,
    netPayableMinor,
    settlementOutcome: netPayableMinor < 0 ? "recovery_pending" : "payable",
    recoverableMinor: netPayableMinor < 0 ? -netPayableMinor : 0,
  };
}

// ---------------------------------------------------------------------------
// Shapes returned by /api/v1/settlement-proposals and /api/v1/settlement-workings
// ---------------------------------------------------------------------------

type RegisterRow = {
  id: string;
  version: number;
  status: string;
  employeeName: string | null;
  employeeCode: string | null;
  lastWorkingDate: string | null;
  exitType: string | null;
  netPayableMinor: number | null;
  settlementOutcome: string | null;
  recoverableMinor: number;
};

function toRegisterRow(raw: UnknownRecord): RegisterRow {
  return {
    id: str(raw.id),
    version: int(raw.version ?? 1),
    status: str(raw.status, "draft"),
    employeeName: str(raw.employeeName) || null,
    employeeCode: str(raw.employeeCode) || null,
    lastWorkingDate: str(raw.lastWorkingDate) || null,
    exitType: str(raw.exitType) || null,
    netPayableMinor: nullableInt(raw.netPayableMinor),
    settlementOutcome: str(raw.settlementOutcome) || null,
    recoverableMinor: int(raw.recoverableMinor),
  };
}

type ExitOption = {
  offboardingCaseId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  currency: string;
  lastWorkingDate: string | null;
  exitReason: string | null;
  openClearanceItems: number;
  clearanceItems: number;
  /** FRM-PAY-08 "Clearance status" (PL_CLEARANCE_STATUS), derived on the server from the items. */
  clearanceStatus: string;
  liveProposalId: string | null;
  blocking: string | null;
};

type RunOption = { id: string; period: string; status: string };

type Availability = { action: string; allowed: boolean; reason: string; ownedElsewhere: boolean };

type Detail = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  currency: string;
  offboardingCaseId: string | null;
  offboardingCaseStatus: string | null;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  payrollRunPeriod: string | null;
  lastWorkingDate: string | null;
  exitType: string | null;
  calculationPolicyReference: string | null;
  notes: string | null;
  recoveryWaiverReason: string | null;
  values: Record<string, number>;
  totals: Totals & { lines: Array<{ code: string; amount_minor: number; direction: string }> };
  recordedNetPayableMinor: number | null;
  recordedOutcome: string | null;
  recordedMatchesHeads: boolean;
  editable: boolean;
  editIssue: string | null;
  actions: Availability[];
  auditTrail: Array<{ action: string; reason: string | null; status: string | null; createdAt: string | null }>;
};

function toDetail(raw: UnknownRecord): Detail {
  const totals = asRecord(raw.totals);
  return {
    id: str(raw.id),
    version: int(raw.version ?? 1),
    status: str(raw.status, "draft"),
    employeeId: str(raw.employeeId) || null,
    employeeName: str(raw.employeeName) || null,
    employeeCode: str(raw.employeeCode) || null,
    currency: str(raw.currency, "INR"),
    offboardingCaseId: str(raw.offboardingCaseId) || null,
    offboardingCaseStatus: str(raw.offboardingCaseStatus) || null,
    payrollRunId: str(raw.payrollRunId) || null,
    payrollRunStatus: str(raw.payrollRunStatus) || null,
    payrollRunPeriod: str(raw.payrollRunPeriod) || null,
    lastWorkingDate: str(raw.lastWorkingDate) || null,
    exitType: str(raw.exitType) || null,
    calculationPolicyReference: str(raw.calculationPolicyReference) || null,
    notes: str(raw.notes) || null,
    recoveryWaiverReason: str(raw.recoveryWaiverReason) || null,
    values: Object.fromEntries(Object.entries(asRecord(raw.values)).map(([code, value]) => [code, int(value)])),
    totals: {
      earningsMinor: int(totals.earningsMinor),
      recoveriesMinor: int(totals.recoveriesMinor),
      waiverMinor: int(totals.waiverMinor),
      netPayableMinor: int(totals.netPayableMinor),
      settlementOutcome: str(totals.settlementOutcome, "payable") === "recovery_pending" ? "recovery_pending" : "payable",
      recoverableMinor: int(totals.recoverableMinor),
      lines: (Array.isArray(totals.lines) ? (totals.lines as UnknownRecord[]) : []).map((line) => ({
        code: str(line.code),
        amount_minor: int(line.amount_minor),
        direction: str(line.direction, "earning"),
      })),
    },
    recordedNetPayableMinor: nullableInt(raw.recordedNetPayableMinor),
    recordedOutcome: str(raw.recordedOutcome) || null,
    recordedMatchesHeads: raw.recordedMatchesHeads !== false,
    editable: raw.editable === true,
    editIssue: str(raw.editIssue) || null,
    actions: (Array.isArray(raw.actions) ? (raw.actions as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      allowed: entry.allowed === true,
      reason: str(entry.reason),
      ownedElsewhere: entry.ownedElsewhere === true,
    })),
    auditTrail: (Array.isArray(raw.auditTrail) ? (raw.auditTrail as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      reason: str(entry.reason) || null,
      status: str(entry.status) || null,
      createdAt: str(entry.createdAt) || null,
    })),
  };
}

type PrefillHead = {
  head: string;
  label: string;
  direction: "earning" | "recovery";
  amountMinor: number | null;
  basis: string;
  indeterminate: boolean;
  missingRules: string[];
  required: boolean;
};

type Prefill = {
  period: string;
  rulePackCode: string;
  currency: string;
  heads: PrefillHead[];
  values: Record<string, number>;
  indeterminate: PrefillHead[];
  missingRules: string[];
};

/**
 * Mirrors `prefillFromWorking`: a head the working could not determine is left
 * OUT of `values` so its box stays empty and the missing rule is named. Filling
 * it with zero would read like a computed answer and short-pay the leaver.
 */
function projectPrefill(working: UnknownRecord): Prefill {
  const figures = Array.isArray(working.figures) ? (working.figures as UnknownRecord[]) : [];
  const heads: PrefillHead[] = figures.map((figure) => {
    const amountMinor = nullableInt(figure.amountMinor);
    const indeterminate = figure.indeterminate === true || amountMinor === null;
    const head = str(figure.head);
    return {
      head,
      label: str(figure.label, HEAD_LABELS[head] ?? head),
      direction: str(figure.direction) === "recovery" ? "recovery" : "earning",
      amountMinor: indeterminate ? null : amountMinor,
      basis: str(figure.basis),
      indeterminate,
      missingRules: stringList(figure.blockedBy),
      required: REQUIRED_FIELDS.has(head),
    };
  });
  const values: Record<string, number> = {};
  for (const head of heads) {
    if (!head.indeterminate && head.amountMinor !== null) values[head.head] = head.amountMinor;
  }
  const indeterminate = heads.filter((head) => head.indeterminate);
  return {
    period: str(working.period, "—"),
    rulePackCode: str(working.rulePackCode, "—"),
    currency: str(asRecord(working.employee).currency, "INR"),
    heads,
    values,
    indeterminate,
    missingRules: [...new Set(indeterminate.flatMap((head) => head.missingRules))],
  };
}

const STAGES = [
  { key: "drafted", label: "Drafted", states: ["draft", "returned"] },
  { key: "submitted", label: "Submitted for review", states: ["submitted"] },
  { key: "approved", label: "Approved", states: ["approved"] },
  { key: "finalized", label: "Finalized on SCR-056", states: ["finalized"] },
] as const;

function stageState(status: string, index: number): "done" | "current" | "todo" {
  const position = STAGES.findIndex((stage) => (stage.states as readonly string[]).includes(status));
  if (position === -1) return "todo";
  if (index < position) return "done";
  if (index === position) return status === "finalized" ? "done" : "current";
  return "todo";
}

const selectClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function SettlementProposalsPage() {
  // Deep-link preselect (?record=<proposalId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");

  const [exits, setExits] = useState<ExitOption[]>([]);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [eligibility, setEligibility] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [formBusy, setFormBusy] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [prefillBusy, setPrefillBusy] = useState(false);

  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "error">("ok");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  function say(tone: "ok" | "error", message: string): void {
    setNoticeTone(tone);
    setNotice(message);
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/settlement-proposals?page=1&pageSize=100");
        const parsed = listFromEnvelope(raw).map(toRegisterRow).filter((row) => row.id);
        if (live) setRows(parsed);
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "The proposal register could not be loaded.");
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
      setOptionsError("");
      try {
        const raw = await getJson("/api/v1/settlement-proposals?options=exits");
        const data = asRecord(asRecord(raw).data);
        if (!live) return;
        setExits(
          (Array.isArray(data.exits) ? (data.exits as UnknownRecord[]) : []).map((entry) => ({
            offboardingCaseId: str(entry.offboardingCaseId),
            employeeId: str(entry.employeeId),
            employeeCode: str(entry.employeeCode) || null,
            employeeName: str(entry.employeeName, "Unnamed leaver"),
            currency: str(entry.currency, "INR"),
            lastWorkingDate: str(entry.lastWorkingDate) || null,
            exitReason: str(entry.exitReason) || null,
            openClearanceItems: int(entry.openClearanceItems),
            clearanceItems: int(entry.clearanceItems),
            clearanceStatus: str(entry.clearanceStatus, "not_started"),
            liveProposalId: str(entry.liveProposalId) || null,
            blocking: str(entry.blocking) || null,
          })),
        );
        setRuns(
          (Array.isArray(data.payrollRuns) ? (data.payrollRuns as UnknownRecord[]) : []).map((entry) => ({
            id: str(entry.id),
            period: str(entry.period, "—"),
            status: str(entry.status, "—"),
          })),
        );
        setEligibility(str(data.eligibility));
      } catch (caught) {
        if (live) setOptionsError(caught instanceof Error ? caught.message : "The eligible exits could not be loaded.");
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(() => rows.filter((row) => statusFilter === "all" || row.status === statusFilter), [rows, statusFilter]);
  const activeRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? filtered[0] ?? null, [rows, selectedId, filtered]);
  const activeId = activeRow?.id ?? "";

  useEffect(() => {
    // No selection means the register is empty; the detail panel is not rendered
    // at all in that case, so there is nothing to clear here.
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/settlement-proposals?proposalId=${encodeURIComponent(activeId)}`);
        if (live) setDetail(toDetail(asRecord(raw).data as UnknownRecord));
      } catch (caught) {
        if (live) {
          setDetail(null);
          setDetailError(caught instanceof Error ? caught.message : "This proposal could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  const selectedExit = useMemo(
    () => exits.find((exit) => exit.offboardingCaseId === form.offboardingCaseId) ?? null,
    [exits, form.offboardingCaseId],
  );

  const formValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const head of MONEY_FIELDS) {
      const raw = (form[head] ?? "").trim();
      if (raw !== "") values[head] = rupeeInputToMinor(raw);
    }
    return values;
  }, [form]);

  const liveTotals = useMemo(() => formTotals(formValues), [formValues]);
  const unkeyedRequiredHeads = useMemo(
    () => MONEY_FIELDS.filter((head) => REQUIRED_FIELDS.has(head) && (form[head] ?? "").trim() === ""),
    [form],
  );

  const formCurrency = selectedExit?.currency ?? detail?.currency ?? "INR";

  function openCreate(): void {
    setFormMode("create");
    setForm(emptyForm());
    setPrefill(null);
    setFormOpen(true);
    setNotice("");
  }

  function openEdit(): void {
    if (!detail) return;
    if (!detail.editable) {
      say("error", detail.editIssue ?? "This proposal cannot be edited in its current state.");
      return;
    }
    const next = emptyForm();
    next.offboardingCaseId = detail.offboardingCaseId ?? "";
    next.payrollRunId = detail.payrollRunId ?? "";
    next.lastWorkingDate = detail.lastWorkingDate ?? "";
    next.exitType = detail.exitType ?? "";
    next.calculationPolicyReference = detail.calculationPolicyReference ?? "";
    next.notes = detail.notes ?? "";
    next.recoveryWaiverReason = detail.recoveryWaiverReason ?? "";
    for (const head of MONEY_FIELDS) {
      const stored = detail.values[head];
      next[head] = stored === undefined ? "" : minorToRupeeInput(stored);
    }
    setFormMode("edit");
    setForm(next);
    setPrefill(null);
    setFormOpen(true);
    setNotice("");
  }

  /**
   * Prefill from the server-computed working, through the existing SCR-056
   * endpoint. Determined heads land in their boxes; heads the rule pack cannot
   * support are listed with the rules that block them and their boxes are left
   * empty for a reviewed figure.
   */
  async function loadPrefill(): Promise<void> {
    const employeeId = selectedExit?.employeeId ?? detail?.employeeId ?? "";
    const lastWorkingDate = (form.lastWorkingDate ?? "").trim();
    if (!employeeId || !lastWorkingDate) {
      say("error", "Choose the exit case and the last working day first - the working is computed against them.");
      return;
    }
    setPrefillBusy(true);
    try {
      const runId = (form.payrollRunId ?? "").trim();
      const path =
        `/api/v1/settlement-workings?employeeId=${encodeURIComponent(employeeId)}&lastWorkingDate=${encodeURIComponent(lastWorkingDate)}` +
        (runId ? `&payrollRunId=${encodeURIComponent(runId)}` : "");
      const projected = projectPrefill(asRecord(await getJson(path)).data as UnknownRecord);
      setPrefill(projected);
      setForm((current) => {
        const next = { ...current };
        for (const [head, amountMinor] of Object.entries(projected.values)) next[head] = minorToRupeeInput(amountMinor);
        for (const head of projected.indeterminate) next[head.head] = "";
        return next;
      });
      say(
        "ok",
        projected.indeterminate.length === 0
          ? "Every head was computed. Review each figure before saving - nothing is recorded until you do."
          : `${projected.indeterminate.length} head${projected.indeterminate.length === 1 ? "" : "s"} could not be computed and ${projected.indeterminate.length === 1 ? "was" : "were"} left empty. Key a reviewed figure for each; the missing rules are named below.`,
      );
    } catch (caught) {
      say("error", caught instanceof Error ? caught.message : "The working could not be computed.");
    } finally {
      setPrefillBusy(false);
    }
  }

  /** The operational validator is strict: exactly the catalog fields, nothing else. */
  function proposalBody(): UnknownRecord | null {
    const exit = selectedExit;
    const employeeId = formMode === "edit" ? detail?.employeeId ?? exit?.employeeId ?? "" : exit?.employeeId ?? "";
    if (!form.offboardingCaseId || !employeeId) {
      say("error", "Choose the exit case this settlement belongs to.");
      return null;
    }
    if (!form.payrollRunId) {
      say("error", "Choose the finalised payroll run this settlement is paid from. A run in any other state would be refused.");
      return null;
    }
    if (!form.lastWorkingDate) {
      say("error", "Enter the last working day; the settlement period is derived from it.");
      return null;
    }
    if (unkeyedRequiredHeads.length > 0) {
      const head = unkeyedRequiredHeads[0];
      const blocked = prefill?.indeterminate.find((entry) => entry.head === head);
      say(
        "error",
        blocked
          ? `${HEAD_LABELS[head] ?? head} must be keyed. The working could not determine it because ${blocked.missingRules.join(", ") || "the rule is not configured"}. Enter a reviewed figure, or 0 if none is payable.`
          : `${HEAD_LABELS[head] ?? head} is required. Enter a reviewed figure, or 0 if none is payable.`,
      );
      return null;
    }
    // Mirrors the server rules so the desk names the gap before the round trip, not after it.
    const waiverReason = (form.recoveryWaiverReason ?? "").trim();
    if ((formValues[WAIVER_HEAD] ?? 0) > 0 && waiverReason.length < WAIVER_REASON_MIN_LENGTH) {
      say("error", `A recovery waiver requires a reason of at least ${WAIVER_REASON_MIN_LENGTH} characters. Say what is being forgiven and on whose authority.`);
      return null;
    }
    if (DECLARED_FIELDS.has("otherRecoveryReason") && (formValues.otherRecoveryMinor ?? 0) > 0 && !(form.otherRecoveryReason ?? "").trim()) {
      say("error", "An other recovery requires a reason. Say what is being recovered and why.");
      return null;
    }
    for (const head of MONEY_FIELDS) {
      if ((formValues[head] ?? 0) < 0) {
        say("error", `${HEAD_LABELS[head] ?? head} cannot be negative. Recoveries are entered as positive amounts on the recovery side.`);
        return null;
      }
    }
    if (!(form.calculationPolicyReference ?? "").trim()) {
      say("error", "Record the calculation policy this settlement was worked out under.");
      return null;
    }
    if ((form.notes ?? "").trim().length < REMARKS_MIN_LENGTH) {
      say("error", `Add a note of at least ${REMARKS_MIN_LENGTH} characters explaining how these figures were arrived at.`);
      return null;
    }

    const body: UnknownRecord = {
      employeeId,
      offboardingCaseId: form.offboardingCaseId,
      payrollRunId: form.payrollRunId,
      lastWorkingDate: form.lastWorkingDate,
      calculationPolicyReference: form.calculationPolicyReference.trim(),
      notes: form.notes.trim(),
    };
    for (const head of MONEY_FIELDS) {
      const amountMinor = formValues[head];
      if (REQUIRED_FIELDS.has(head)) body[head] = amountMinor ?? 0;
      else if (amountMinor !== undefined && amountMinor > 0) body[head] = amountMinor;
    }
    if ((form.exitType ?? "").trim()) body.exitType = form.exitType;
    if (waiverReason) body.recoveryWaiverReason = waiverReason;
    if (DECLARED_FIELDS.has("otherRecoveryReason") && (form.otherRecoveryReason ?? "").trim()) {
      body.otherRecoveryReason = form.otherRecoveryReason.trim();
    }
    return body;
  }

  async function saveProposal(): Promise<void> {
    const body = proposalBody();
    if (!body) return;
    setFormBusy(true);
    try {
      const editing = formMode === "edit" && detail !== null;
      const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": idempotencyKey() };
      if (editing && detail) headers["If-Match"] = `"${detail.version}"`;
      const response = await fetch(
        editing && detail ? `/api/v1/operations/settlements/${encodeURIComponent(detail.id)}` : "/api/v1/operations/settlements",
        { method: editing ? "PATCH" : "POST", headers, body: JSON.stringify(body), cache: "no-store" },
      );
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        const details = Array.isArray(asRecord(payload.error).details) ? (asRecord(payload.error).details as UnknownRecord[]) : [];
        const detailText = details.map((entry) => `${str(entry.field)}: ${str(entry.issue)}`).join("; ");
        say("error", [str(asRecord(payload.error).message, `Request failed (${response.status}).`), detailText].filter(Boolean).join(" — "));
        return;
      }
      const id = str(asRecord(payload.data).id, detail?.id ?? "");
      setFormOpen(false);
      setPrefill(null);
      if (id) setSelectedId(id);
      say("ok", editing ? "Proposal updated. The net and its outcome have been recomputed and recorded." : "Proposal raised as a draft. Submit it when the figures have been reviewed.");
      refresh();
    } catch {
      say("error", "Could not reach the server.");
    } finally {
      setFormBusy(false);
    }
  }

  async function runAction(action: string): Promise<void> {
    if (!detail) return;
    if (reason.trim().length < 3) {
      say("error", "Enter a reason of at least three characters — every settlement action is audited with it.");
      return;
    }
    setBusyAction(action);
    try {
      const response = await fetch(`/api/v1/operations/settlements/${encodeURIComponent(detail.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey(), "If-Match": `"${detail.version}"` },
        body: JSON.stringify({ reason: reason.trim() }),
        cache: "no-store",
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        say("error", str(asRecord(payload.error).message, `Request failed (${response.status}).`));
        return;
      }
      setReason("");
      say("ok", `${humanize(action)} recorded.`);
      refresh();
    } catch {
      say("error", "Could not reach the server.");
    } finally {
      setBusyAction("");
    }
  }

  const deskActions = (detail?.actions ?? []).filter((entry) => entry.action !== "finalize");
  const finalizeState = detail?.actions.find((entry) => entry.action === "finalize") ?? null;
  const raisableExits = exits.filter((exit) => exit.blocking === null);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-056 PROPOSALS"
        title="Full & final proposals"
        description="Raise a settlement proposal against an open exit case and a finalised payroll run, key every earning and recovery head, and take it through submit, approve, return, reject or cancel. Finalising an approved proposal happens on the full and final settlement screen, which owns the no-dues, asset and loan gates."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              disabled={raisableExits.length === 0}
              title={raisableExits.length === 0 ? "No exit case is available to propose against: every open case either records no last working date or already carries a live proposal." : undefined}
              onClick={openCreate}
            >
              <Plus className="mr-1.5 size-4" /> Raise proposal
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide"
          description="Raise → submit → approve (a different person) → finalize. A proposal may only cite an exit case that is not settled and a payroll run that is already finalized, and may only be edited while it is draft or returned. A negative net is a valid outcome: the leaver owes more than is due, and the settlement is routed as a recovery to collect rather than blocked."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {eligibility || "Scoped to your permitted entity, location and reporting line."}
          </p>
          <Link href="/full-final-settlement" className="text-xs font-bold text-primary hover:underline">
            Open the full &amp; final settlement screen
          </Link>
        </div>
        {optionsError ? <p className="mt-2 text-xs leading-relaxed text-destructive">{optionsError}</p> : null}
      </Surface>

      {formOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title={formMode === "edit" ? "Edit proposal" : "New proposal"}
            description="Amounts are entered in rupees and stored in integer minor units. A head the computed working could not determine is left empty with the missing rule named — key a reviewed figure rather than accepting a zero."
            action={
              <Button variant="outline" className="h-9 rounded-lg px-3 text-xs font-bold" disabled={prefillBusy} onClick={() => void loadPrefill()}>
                {prefillBusy ? "Computing…" : "Prefill from computed working"}
              </Button>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Exit case</span>
              <select
                aria-label="Exit case"
                className={selectClass}
                value={form.offboardingCaseId}
                disabled={formMode === "edit"}
                onChange={(event) => {
                  const exit = exits.find((entry) => entry.offboardingCaseId === event.target.value) ?? null;
                  setForm((current) => ({
                    ...current,
                    offboardingCaseId: event.target.value,
                    lastWorkingDate: exit?.lastWorkingDate ?? current.lastWorkingDate,
                  }));
                  setPrefill(null);
                }}
              >
                <option value="">Select an open exit case</option>
                {exits.map((exit) => (
                  <option key={exit.offboardingCaseId} value={exit.offboardingCaseId} disabled={exit.blocking !== null}>
                    {[exit.employeeCode, exit.employeeName, exit.lastWorkingDate ? `LWD ${exit.lastWorkingDate}` : "no LWD recorded"].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payroll run (finalized only)</span>
              <select aria-label="Payroll run" className={selectClass} value={form.payrollRunId} onChange={(event) => setForm((current) => ({ ...current, payrollRunId: event.target.value }))}>
                <option value="">Select a finalized run</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.period} · {run.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Last working day</span>
              <input
                aria-label="Last working day"
                type="date"
                className={inputClass}
                value={form.lastWorkingDate}
                onChange={(event) => setForm((current) => ({ ...current, lastWorkingDate: event.target.value }))}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Exit type (optional)</span>
              <select aria-label="Exit type" className={selectClass} value={form.exitType} onChange={(event) => setForm((current) => ({ ...current, exitType: event.target.value }))}>
                <option value="">Not recorded</option>
                {EXIT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {runs.length === 0 ? (
            <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-2 text-[11px] leading-relaxed text-warning">
              No payroll run is finalized in your scope, so no proposal can be saved yet. A settlement is refused against a run that is still draft, calculated or approved.
            </p>
          ) : null}
          {selectedExit ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Clearance status: <span className="font-bold text-foreground">{picklistLabel("PL_CLEARANCE_STATUS", selectedExit.clearanceStatus)}</span>
              {" "}({selectedExit.clearanceItems - selectedExit.openClearanceItems} of {selectedExit.clearanceItems} items closed).
            </p>
          ) : null}
          {selectedExit?.openClearanceItems ? (
            <p className="mt-3 rounded-lg border border-border bg-secondary/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
              {selectedExit.openClearanceItems} of {selectedExit.clearanceItems} no-dues items are still open on this exit. That does not stop a proposal being raised or approved — it stops it being finalized.
            </p>
          ) : null}

          {prefill ? (
            <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-semibold text-foreground">
                Working for {prefill.period} against rule pack {prefill.rulePackCode}
              </p>
              {prefill.indeterminate.length === 0 ? (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Every head was computed. The figures below are proposals, not approved amounts — review each one.</p>
              ) : (
                <>
                  <p className="mt-1 text-[11px] leading-relaxed text-warning">
                    These heads could not be computed and have been left empty rather than set to zero:
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {prefill.indeterminate.map((head) => (
                      <li key={head.head} className="text-[11px] leading-relaxed">
                        <span className="font-semibold text-foreground">{head.label}</span>
                        {head.required ? <span className="ml-1 text-warning">(must be keyed)</span> : null}
                        <span className="block text-muted-foreground">{head.basis}</span>
                        {head.missingRules.length > 0 ? (
                          <span className="block font-semibold text-warning">Missing: {head.missingRules.join(", ")}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}

          {MONEY_GROUPS.map((group) => (
            <div key={group.key} className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{group.description}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.heads.map((head) => {
                  const blocked = prefill?.indeterminate.find((entry) => entry.head === head) ?? null;
                  const computed = prefill?.heads.find((entry) => entry.head === head && !entry.indeterminate) ?? null;
                  return (
                    <label key={head} className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {HEAD_LABELS[head] ?? head} (INR)
                        {REQUIRED_FIELDS.has(head) ? <span className="ml-1 text-foreground">*</span> : null}
                      </span>
                      <input
                        aria-label={HEAD_LABELS[head] ?? head}
                        className={inputClass}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={form[head] ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, [head]: event.target.value }))}
                      />
                      {blocked ? (
                        <span className="text-[10px] leading-relaxed text-warning">
                          Indeterminate: {blocked.missingRules.length > 0 ? `no ${blocked.missingRules.join(", ")} is configured` : blocked.basis}. Key a reviewed figure.
                        </span>
                      ) : computed ? (
                        <span className="text-[10px] leading-relaxed text-muted-foreground">Computed: {computed.basis}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              {group.key === "waiver" ? (
                <label className="mt-3 flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Waiver reason{(formValues[WAIVER_HEAD] ?? 0) > 0 ? <span className="ml-1 text-foreground">*</span> : " (required once anything is waived)"}
                  </span>
                  <input
                    aria-label="Waiver reason"
                    className={inputClass}
                    value={form.recoveryWaiverReason}
                    onChange={(event) => setForm((current) => ({ ...current, recoveryWaiverReason: event.target.value }))}
                    placeholder="What is being forgiven, and on whose authority"
                  />
                </label>
              ) : null}
            </div>
          ))}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Calculation policy reference *</span>
              <input
                aria-label="Calculation policy reference"
                className={inputClass}
                value={form.calculationPolicyReference}
                onChange={(event) => setForm((current) => ({ ...current, calculationPolicyReference: event.target.value }))}
                placeholder="The policy or circular these figures follow"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Notes *</span>
              <input
                aria-label="Notes"
                className={inputClass}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="How each keyed figure was arrived at"
              />
            </label>
          </div>

          <div className={`mt-4 rounded-xl border p-3 ${liveTotals.settlementOutcome === "recovery_pending" ? "border-warning/25 bg-warning/10" : "border-border/70 bg-secondary/30"}`}>
            <p className="text-xs text-muted-foreground">
              Earnings {money(liveTotals.earningsMinor, formCurrency)} (including {money(liveTotals.waiverMinor, formCurrency)} waived) less recoveries {money(liveTotals.recoveriesMinor, formCurrency)}
            </p>
            {liveTotals.settlementOutcome === "recovery_pending" ? (
              <>
                <p className="mt-1 text-base font-bold tabular-nums text-warning">Recovery to collect {money(liveTotals.recoverableMinor, formCurrency)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  The leaver owes more than is due. This saves normally and is routed for collection as recovery pending; it is not an error.
                </p>
              </>
            ) : (
              <p className="mt-1 text-base font-bold tabular-nums text-foreground">Net payable {money(liveTotals.netPayableMinor, formCurrency)}</p>
            )}
            {unkeyedRequiredHeads.length > 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-warning">
                Not yet a complete settlement: {unkeyedRequiredHeads.map((head) => HEAD_LABELS[head] ?? head).join(", ")} {unkeyedRequiredHeads.length === 1 ? "has" : "have"} no figure and {unkeyedRequiredHeads.length === 1 ? "is" : "are"} excluded from this total.
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={formBusy} onClick={() => void saveProposal()}>
              {formBusy ? "Saving…" : formMode === "edit" ? "Save proposal" : "Raise proposal"}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </Surface>
      ) : null}

      {notice ? (
        <p
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 text-xs leading-relaxed ${noticeTone === "error" ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-border bg-secondary/40 text-foreground"}`}
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Surface>
          <SectionHeading
            title="Proposal register"
            description={loading ? "Loading…" : `${filtered.length} proposal${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <select aria-label="Status filter" className="h-10 w-full max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground sm:w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="finalized">Finalized</option>
              </select>
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
              {rows.length === 0
                ? "No settlement proposal has been raised yet. Raise one against an open exit case and a finalised payroll run."
                : "No proposal matches this filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Leaver</th>
                    <th className="px-3 py-2 font-bold">Exit type</th>
                    <th className="px-3 py-2 text-right font-bold">Net</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === activeId;
                    const recovery = row.settlementOutcome === "recovery_pending" || (row.netPayableMinor !== null && row.netPayableMinor < 0);
                    return (
                      <tr key={row.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(row.id);
                              setNotice("");
                            }}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.employeeName ?? "Unnamed leaver"}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {[row.employeeCode, row.lastWorkingDate ? `LWD ${row.lastWorkingDate}` : "no last working day"].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">{row.exitType ? humanize(row.exitType) : "Not recorded"}</span>
                            <span className={`whitespace-nowrap text-right text-xs font-semibold tabular-nums ${recovery ? "text-warning" : "text-foreground"}`}>
                              {row.netPayableMinor === null
                                ? "—"
                                : recovery
                                  ? `Recover ${money(row.recoverableMinor || -row.netPayableMinor)}`
                                  : money(row.netPayableMinor)}
                            </span>
                            <span>
                              <StatusPill tone={statusTone(row.status)}>{row.status.replace(/_/g, " ")}</StatusPill>
                            </span>
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
            title="Proposal detail"
            description={
              activeRow
                ? `${activeRow.employeeName ?? "Leaver"} · ${activeRow.lastWorkingDate ? `last working day ${activeRow.lastWorkingDate}` : "no last working day recorded"}`
                : "Select a proposal to inspect its heads"
            }
            action={detail ? <StatusPill tone={statusTone(detail.status)}>{detail.status.replace(/_/g, " ")}</StatusPill> : undefined}
          />
          {!activeRow ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No proposal selected.</p>
          ) : detailLoading && !detail ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !detail ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : detail ? (
            <div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {[
                  detail.payrollRunPeriod ? `Payroll run ${detail.payrollRunPeriod} (${detail.payrollRunStatus ?? "status unknown"})` : "No payroll run resolved",
                  detail.offboardingCaseStatus ? `exit case ${detail.offboardingCaseStatus.replace(/_/g, " ")}` : "exit case not resolved",
                  detail.exitType ? humanize(detail.exitType) : "exit type not recorded",
                ].join(" · ")}
              </p>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Line breakdown</h3>
              {detail.totals.lines.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Every head on this proposal is zero, so it carries no settlement lines.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Head</th>
                        <th className="px-3 py-2 font-bold">Side</th>
                        <th className="px-3 py-2 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.totals.lines.map((line) => (
                        <tr key={line.code} className="border-t border-border/60">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{HEAD_LABELS[line.code] ?? line.code}</td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">
                            {line.direction === "deduction" ? "Recovery" : line.code === WAIVER_HEAD ? "Earning (waiver offset)" : "Earning"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(line.amount_minor, detail.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={`mt-4 rounded-xl border p-3 ${detail.totals.settlementOutcome === "recovery_pending" ? "border-warning/25 bg-warning/10" : "border-border/70 bg-secondary/30"}`}>
                <p className="text-xs text-muted-foreground">
                  Earnings {money(detail.totals.earningsMinor, detail.currency)} less recoveries {money(detail.totals.recoveriesMinor, detail.currency)}
                </p>
                {detail.totals.settlementOutcome === "recovery_pending" ? (
                  <>
                    <p className="mt-1 text-base font-bold tabular-nums text-warning">Recovery to collect {money(detail.totals.recoverableMinor, detail.currency)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      A valid settlement outcome: the leaver owes more than is due, so this is routed for collection as recovery pending rather than paid.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-base font-bold tabular-nums text-foreground">Net payable {money(detail.totals.netPayableMinor, detail.currency)}</p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Recorded on the proposal at its last save: {moneyOrDash(detail.recordedNetPayableMinor, detail.currency)}
                  {detail.recordedOutcome ? ` (${detail.recordedOutcome.replace(/_/g, " ")})` : ""}.
                </p>
                {!detail.recordedMatchesHeads ? (
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-warning">
                    The recorded net does not match the heads now stored on this proposal. Re-save it so the recorded figure is derived from the heads again.
                  </p>
                ) : null}
                {detail.recoveryWaiverReason ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Waiver reason: {detail.recoveryWaiverReason}</p>
                ) : null}
              </div>

              {detail.calculationPolicyReference || detail.notes ? (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {[detail.calculationPolicyReference ? `Policy: ${detail.calculationPolicyReference}` : "", detail.notes ? `Note: ${detail.notes}` : ""].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {STAGES.map((stage, index) => {
                  const state = stageState(detail.status, index);
                  return (
                    <li key={stage.key} className="flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${state === "done" ? "border-primary bg-primary text-primary-foreground" : state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                          {state === "done" ? "✓" : index + 1}
                        </span>
                        {index < STAGES.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                      </span>
                      <span className={`pb-3 text-xs ${state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {index + 1}. {stage.label}
                        {state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {["rejected", "cancelled"].includes(detail.status) ? (
                <p className="text-xs leading-relaxed text-destructive">This proposal was {detail.status}. Raise a fresh proposal to settle this exit.</p>
              ) : null}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason (audited)</span>
                  <input aria-label="Action reason" className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this action is being taken" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded-lg px-3 text-xs font-bold"
                    disabled={!detail.editable}
                    title={detail.editIssue ?? undefined}
                    onClick={openEdit}
                  >
                    Edit figures
                  </Button>
                  {deskActions.map((entry) => (
                    <Button
                      key={entry.action}
                      variant="outline"
                      className="h-9 rounded-lg px-3 text-xs font-bold"
                      disabled={!entry.allowed || busyAction !== ""}
                      title={entry.reason || undefined}
                      onClick={() => void runAction(entry.action)}
                    >
                      {busyAction === entry.action ? "Working…" : humanize(entry.action)}
                    </Button>
                  ))}
                </div>
                {!detail.editable && detail.editIssue ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold">Edit unavailable:</span> {detail.editIssue}
                  </p>
                ) : null}
                {deskActions
                  .filter((entry) => !entry.allowed)
                  .map((entry) => (
                    <p key={entry.action} className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold">{humanize(entry.action)} unavailable:</span> {entry.reason}
                    </p>
                  ))}
                {deskActions.some((entry) => entry.action === "approve" && entry.allowed) ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">Approval is maker/checker: the person who raised this proposal cannot approve it.</p>
                ) : null}
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Finalize:</span> {finalizeState?.reason ?? "Finalize runs from the full and final settlement screen."}
                  </p>
                  <Link href={`/full-final-settlement?record=${encodeURIComponent(detail.id)}`} className="mt-1 inline-block text-[11px] font-bold text-primary hover:underline">
                    Open this settlement on SCR-056 to check the gates and finalize
                  </Link>
                </div>
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this proposal.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{humanize(entry.action)}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.createdAt), entry.status, entry.reason].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
