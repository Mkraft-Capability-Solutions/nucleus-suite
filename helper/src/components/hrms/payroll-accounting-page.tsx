"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

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

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

/** The mapping's real workflow state, as the `ledger` resource records it. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved") return "success";
  if (status === "submitted") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  if (status === "retired") return "info";
  return "neutral";
}

function coverageTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "mapped") return "success";
  if (state === "unmapped" || state === "misconfigured" || state === "refused") return "danger";
  if (state === "in_workflow" || state === "not_yet_effective" || state === "expired") return "warning";
  if (state === "retired") return "info";
  return "neutral";
}

const COVERAGE_LABELS: Record<string, string> = {
  mapped: "Mapped",
  unmapped: "No mapping",
  in_workflow: "In workflow",
  not_yet_effective: "Not yet effective",
  expired: "Window expired",
  retired: "Retired",
  refused: "Rejected or cancelled",
  misconfigured: "Misconfigured",
  not_applicable: "Never posts",
};

function batchTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "reconciled") return "success";
  if (status === "queued") return "warning";
  if (status === "failed") return "danger";
  if (status === "posted") return "info";
  return "neutral";
}

function journalStateTone(state: string): "success" | "warning" | "info" | "neutral" | "danger" {
  if (state === "posted") return "success";
  if (state === "validated") return "info";
  if (state === "failed") return "danger";
  if (state === "superseded") return "warning";
  return "neutral";
}

let fallbackKeyCounter = 0;
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

/**
 * Every write on this screen goes to an endpoint that already owns the rule it
 * enforces: `/api/v1/operations/ledger…` for the mapping workflow and
 * `/api/v1/vp/readiness` for the two GL posting commands. Nothing is written
 * here directly, so a refusal is reported with the server's own words rather
 * than a guess.
 */
async function mutate(path: string, body: UnknownRecord, version?: number): Promise<{ ok: boolean; message: string }> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": idempotencyKey() };
    if (version !== undefined) headers["If-Match"] = `"${version}"`;
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    const error = asRecord(payload.error);
    const details = list(error.details)
      .map((detail) => `${str(detail.field)}: ${str(detail.issue)}`)
      .join("; ");
    return {
      ok: false,
      message: `${str(error.message, `Request failed (${response.status}).`)}${details ? ` — ${details}` : ""}`,
    };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

type MappingRecord = {
  id: string;
  version: number;
  status: string;
  componentCode: string;
  accountCode: string;
  postingSide: string;
  costCenterSource: string;
  startDate: string;
  endDate: string;
  createdByMembershipId: string;
};

type Availability = { allowed: boolean; reason: string };

type WorkflowView = {
  states: string[];
  editable: string[];
  actions: string[];
  matrix: Record<string, Record<string, Availability>>;
  makerCheckerReason: string;
  approvalActions: string[];
};

type CoverageRow = {
  componentCode: string;
  componentName: string;
  kind: string;
  state: string;
  blocksRun: boolean;
  reason: string | null;
  accountCode: string | null;
  postingSide: string | null;
  startDate: string | null;
  endDate: string | null;
  mappingStatus: string | null;
};

type BlockingRow = { componentCode: string; componentName: string; reason: string };

type ErpBatch = {
  id: string;
  payrollRunId: string;
  period: string | null;
  runScope: string | null;
  status: string;
  debitMinor: number;
  creditMinor: number;
  acknowledgementRef: string | null;
  postedAt: string | null;
  connectionId: string | null;
  lineCount: number;
};

type LedgerExport = {
  id: string;
  payrollRunId: string;
  period: string | null;
  legalEntityId: string | null;
  state: string;
  totalDebitMinor: number | null;
  lineCount: number | null;
  postedAt: string | null;
  balanced: boolean | null;
  /** RP-15: a failed posting is visible, not silent. */
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

type Overview = {
  asOf: string;
  viewerMembershipId: string;
  legalEntities: Array<{ id: string; code: string; legalName: string }>;
  legalEntityId: string;
  coverage: { rows: CoverageRow[]; summary: Record<string, number> } | null;
  coverageUnavailableReason: string;
  blocking: BlockingRow[] | null;
  erp: { items: ErpBatch[]; queued: number; acknowledged: number };
  journal: { items: LedgerExport[]; posted: number; superseded: number; failed: number };
  presence: { both: string[]; erpOnly: string[]; journalOnly: string[] };
  batchLines: Array<{ accountCode: string; componentCode: string; debitMinor: number; creditMinor: number; narration: string }> | null;
  workflow: WorkflowView | null;
  overlaps: Record<string, Array<{ id: string; startDate: string | null; endDate: string | null }>>;
};

function readOverview(payload: unknown): Overview {
  const data = asRecord(asRecord(payload).data);
  const coverageRaw = data.coverage === null || data.coverage === undefined ? null : asRecord(data.coverage);
  const posting = asRecord(data.posting);
  const erp = asRecord(posting.erp);
  const journal = asRecord(posting.ledgerJournal);
  const presence = asRecord(posting.presence);
  const overlapsRaw = asRecord(data.overlapPreview);

  return {
    asOf: str(data.asOf),
    viewerMembershipId: str(data.viewerMembershipId),
    legalEntities: list(data.legalEntities).map((entity) => ({
      id: str(entity.id),
      code: str(entity.code, "—"),
      legalName: str(entity.legalName, str(entity.code, "—")),
    })),
    legalEntityId: str(data.legalEntityId),
    coverage: coverageRaw === null
      ? null
      : {
          rows: list(coverageRaw.rows).map((row) => ({
            componentCode: str(row.componentCode, "—"),
            componentName: str(row.componentName, str(row.componentCode, "—")),
            kind: str(row.kind, "—"),
            state: str(row.state, "unmapped"),
            blocksRun: row.blocksRun === true,
            reason: typeof row.reason === "string" ? row.reason : null,
            accountCode: typeof row.accountCode === "string" ? row.accountCode : null,
            postingSide: typeof row.postingSide === "string" ? row.postingSide : null,
            startDate: typeof row.startDate === "string" ? row.startDate : null,
            endDate: typeof row.endDate === "string" ? row.endDate : null,
            mappingStatus: typeof row.mappingStatus === "string" ? row.mappingStatus : null,
          })),
          summary: Object.fromEntries(
            Object.entries(asRecord(coverageRaw.summary)).map(([key, value]) => [key, int(value)]),
          ),
        },
    coverageUnavailableReason: str(data.coverageUnavailableReason),
    blocking: data.blocking === null || data.blocking === undefined
      ? null
      : list(data.blocking).map((row) => ({
          componentCode: str(row.componentCode, "—"),
          componentName: str(row.componentName, str(row.componentCode, "—")),
          reason: str(row.reason, "This component cannot post."),
        })),
    erp: {
      items: list(erp.items).map((item) => ({
        id: str(item.id),
        payrollRunId: str(item.payrollRunId),
        period: typeof item.period === "string" ? item.period : null,
        runScope: typeof item.runScope === "string" ? item.runScope : null,
        status: str(item.status, "draft"),
        debitMinor: int(item.debitMinor),
        creditMinor: int(item.creditMinor),
        acknowledgementRef: typeof item.acknowledgementRef === "string" ? item.acknowledgementRef : null,
        postedAt: typeof item.postedAt === "string" ? item.postedAt : null,
        connectionId: typeof item.connectionId === "string" ? item.connectionId : null,
        lineCount: int(item.lineCount),
      })),
      queued: int(erp.queued),
      acknowledged: int(erp.acknowledged),
    },
    journal: {
      items: list(journal.items).map((item) => ({
        id: str(item.id),
        payrollRunId: str(item.payrollRunId),
        period: typeof item.period === "string" ? item.period : null,
        legalEntityId: typeof item.legalEntityId === "string" ? item.legalEntityId : null,
        state: str(item.state, "draft"),
        totalDebitMinor: typeof item.totalDebitMinor === "number" ? item.totalDebitMinor : null,
        lineCount: typeof item.lineCount === "number" ? item.lineCount : null,
        postedAt: typeof item.postedAt === "string" ? item.postedAt : null,
        balanced: typeof item.balanced === "boolean" ? item.balanced : null,
        failedAt: typeof item.failedAt === "string" ? item.failedAt : null,
        failureCode: typeof item.failureCode === "string" ? item.failureCode : null,
        failureMessage: typeof item.failureMessage === "string" ? item.failureMessage : null,
      })),
      posted: int(journal.posted),
      superseded: int(journal.superseded),
      failed: int(journal.failed),
    },
    presence: {
      both: list(presence.runsOnBothPaths).map((value) => String(value)),
      erpOnly: list(presence.runsOnlyInErpBatches).map((value) => String(value)),
      journalOnly: list(presence.runsOnlyInLedgerJournal).map((value) => String(value)),
    },
    batchLines: data.batchLines === null || data.batchLines === undefined
      ? null
      : list(data.batchLines).map((line) => ({
          accountCode: str(line.accountCode, "—"),
          componentCode: str(line.componentCode, "—"),
          debitMinor: int(line.debitMinor),
          creditMinor: int(line.creditMinor),
          narration: str(line.narration, ""),
        })),
    workflow: data.mappingWorkflow === undefined
      ? null
      : (() => {
          const view = asRecord(data.mappingWorkflow);
          const matrix: Record<string, Record<string, Availability>> = {};
          for (const [state, actions] of Object.entries(asRecord(view.matrix))) {
            matrix[state] = Object.fromEntries(
              Object.entries(asRecord(actions)).map(([action, value]) => {
                const entry = asRecord(value);
                return [action, { allowed: entry.allowed === true, reason: str(entry.reason) }];
              }),
            );
          }
          return {
            states: list(view.states).map((value) => String(value)),
            editable: (Array.isArray(view.editable) ? view.editable : []).map((value) => String(value)),
            actions: (Array.isArray(view.actions) ? view.actions : []).map((value) => String(value)),
            matrix,
            makerCheckerReason: str(view.makerCheckerReason),
            approvalActions: (Array.isArray(view.approvalActions) ? view.approvalActions : []).map((value) => String(value)),
          };
        })(),
    overlaps: Object.fromEntries(
      Object.entries(overlapsRaw).map(([recordId, conflicts]) => [
        recordId,
        list(conflicts).map((conflict) => ({
          id: str(conflict.id),
          startDate: typeof conflict.startDate === "string" ? conflict.startDate : null,
          endDate: typeof conflict.endDate === "string" ? conflict.endDate : null,
        })),
      ]),
    ),
  };
}

function readMappings(payload: unknown): MappingRecord[] {
  return list(asRecord(payload).data).map((item) => ({
    id: str(item.id),
    version: int(item.version),
    status: str(item.status, "draft"),
    componentCode: str(item.componentCode, "—"),
    accountCode: str(item.accountCode, "—"),
    postingSide: str(item.postingSide, "debit"),
    costCenterSource: str(item.costCenterSource, ""),
    startDate: str(item.startDate, ""),
    endDate: str(item.endDate, ""),
    createdByMembershipId: str(item.createdByMembershipId),
  }));
}

const ACTION_LABELS: Record<string, string> = {
  submit: "Submit",
  approve: "Approve",
  return: "Return",
  reject: "Reject",
  cancel: "Cancel",
  retire: "Retire",
};

/** The cost-centre sources `resolveCostCenter` in src/server/payroll/gl.ts understands. */
const COST_CENTER_SOURCES = ["employee", "position", "mapping", "none"];

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

// FRM-FIN-01 names both sides of the posting and the entity the mapping belongs to. The
// single-sided `accountCode` + `postingSide` pair is still accepted by the resource so that
// mappings written before this shape keep resolving, but a new one is captured two-sided.
const EMPTY_FORM = { entityCode: "", componentCode: "", debitAccountCode: "", creditAccountCode: "", postingSide: "debit", costCenterSource: "employee", startDate: "", endDate: "" };

export function PayrollAccountingPage() {
  // Deep-link preselect (?record=<ledger record id>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [legalEntityId, setLegalEntityId] = useState("");
  const [asOf, setAsOf] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [openBatchId, setOpenBatchId] = useState("");
  const [ackRef, setAckRef] = useState("");
  const [runs, setRuns] = useState<Array<{ id: string; period: string; scope: string; status: string }>>([]);
  const [selectedRunId, setSelectedRunId] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  const overviewPath = useMemo(() => {
    const params = new URLSearchParams();
    if (legalEntityId) params.set("legalEntityId", legalEntityId);
    if (asOf) params.set("asOf", asOf);
    if (openBatchId) params.set("batchId", openBatchId);
    const query = params.toString();
    return `/api/v1/payroll-accounting${query ? `?${query}` : ""}`;
  }, [legalEntityId, asOf, openBatchId]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewPayload, mappingPayload, runPayload] = await Promise.all([
          getJson(overviewPath),
          getJson("/api/v1/operations/ledger?pageSize=100"),
          getJson("/api/v1/payroll-runs?page=1&pageSize=100"),
        ]);
        if (!live) return;
        setOverview(readOverview(overviewPayload));
        setMappings(readMappings(mappingPayload));
        setRuns(
          list(asRecord(runPayload).data).map((run) => ({
            id: str(run.id),
            period: str(run.period, "—"),
            scope: str(run.scope, "—"),
            status: str(run.status, "—"),
          })),
        );
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Payroll accounting could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [overviewPath, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return mappings.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (needle && !`${row.componentCode} ${row.accountCode}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [mappings, search, statusFilter]);

  const selected = useMemo(
    () => mappings.find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [mappings, selectedId, filtered],
  );

  const activeRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null, [runs, selectedRunId]);

  /**
   * One implementation of the state machine: the server sends the
   * status × action matrix from the `ledger` catalog definition, and the only
   * thing decided here is whether the viewer is the record's own author.
   */
  function availability(action: string): Availability {
    if (!selected) return { allowed: false, reason: "Select a mapping first." };
    const workflow = overview?.workflow;
    if (!workflow) return { allowed: false, reason: "The workflow definition has not loaded yet." };
    const entry = workflow.matrix[selected.status]?.[action];
    if (!entry) return { allowed: false, reason: `${action} is not an action on this workflow.` };
    if (!entry.allowed) return entry;
    if (
      workflow.approvalActions.includes(action) &&
      overview.viewerMembershipId !== "" &&
      selected.createdByMembershipId === overview.viewerMembershipId
    ) {
      return { allowed: false, reason: workflow.makerCheckerReason };
    }
    return entry;
  }

  async function runAction(action: string) {
    if (!selected) return;
    if (reason.trim().length < 3) {
      setNotice("Enter a reason of at least three characters — every mapping action is audited with it.");
      return;
    }
    setBusyAction(action);
    setNotice("");
    const outcome = await mutate(
      `/api/v1/operations/ledger/${encodeURIComponent(selected.id)}/${action}`,
      { reason: reason.trim() },
      selected.version,
    );
    setNotice(outcome.ok ? `Mapping ${action} recorded.` : outcome.message);
    if (outcome.ok) {
      setReason("");
      refresh();
    }
    setBusyAction("");
  }

  async function createMapping() {
    if (Object.values(form).some((value) => value.trim() === "")) {
      setNotice("Every field on a GL component mapping is required, including the effective window.");
      return;
    }
    setBusyAction("create");
    setNotice("");
    const outcome = await mutate("/api/v1/operations/ledger", {
      entityCode: form.entityCode.trim(),
      componentCode: form.componentCode.trim(),
      debitAccountCode: form.debitAccountCode.trim(),
      creditAccountCode: form.creditAccountCode.trim(),
      dimensionSource: [form.costCenterSource],
      postingSide: form.postingSide,
      costCenterSource: form.costCenterSource,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    setNotice(outcome.ok ? "Mapping created as draft. Submit it for approval next." : outcome.message);
    if (outcome.ok) {
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    }
    setBusyAction("");
  }

  async function queueErpBatch() {
    if (!activeRun) return;
    setBusyAction("create_gl_posting");
    setNotice("");
    const outcome = await mutate("/api/v1/vp/readiness", { action: "create_gl_posting", payrollRunId: activeRun.id });
    setNotice(outcome.ok ? "GL batch queued in vp_gl_batches." : outcome.message);
    if (outcome.ok) refresh();
    setBusyAction("");
  }

  async function acknowledgeBatch(batchId: string) {
    if (ackRef.trim().length < 1) {
      setNotice("Enter the external document number recorded by whoever completed the posting.");
      return;
    }
    setBusyAction(`ack:${batchId}`);
    setNotice("");
    const outcome = await mutate("/api/v1/vp/readiness", {
      action: "ack_gl_posting",
      batchId,
      acknowledgementRef: ackRef.trim(),
    });
    setNotice(outcome.ok ? "Acknowledgement recorded against the batch." : outcome.message);
    if (outcome.ok) {
      setAckRef("");
      refresh();
    }
    setBusyAction("");
  }

  const overlapForSelected = selected ? overview?.overlaps[selected.id] ?? [] : [];
  const runFinalized = activeRun?.status === "finalized";

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · ACCOUNTING"
        title="Payroll accounting"
        description="Take a GL component mapping from draft to approved, see which pay components are still uncovered for a legal entity on a date, and hand a finalised run over to the ERP."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setCreateOpen((open) => !open)}>
              {createOpen ? "Close form" : "New mapping"}
            </Button>
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="What this screen is, and what it is not"
          description="The mapping lifecycle, coverage and the ERP handoff. The journal itself — accounts, dimensioned lines, balance, drill-back and posting — belongs to the GL mapping and journal screen and is not rebuilt here."
          action={
            <Link
              href="/gl-mapping-journal"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary"
            >
              Open the journal (SCR-102) <ChevronRight className="ml-1 size-3.5" />
            </Link>
          }
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Mappings are records of the <code className="font-mono">ledger</code> operational resource. Creating one and moving it
          through draft → submitted → approved (or returned, rejected, cancelled) and retire happens on
          <code className="ml-1 font-mono">/api/v1/operations/ledger</code>, which owns the state machine, the approver-is-not-author
          rule and the effective-date overlap guard. Nothing on this page writes a mapping or a journal line directly.
        </p>
      </Surface>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs font-bold text-muted-foreground">Legal entity</span>
          <select
            aria-label="Legal entity"
            className={`${selectClass} w-full max-w-full sm:w-auto`}
            value={overview?.legalEntityId ?? legalEntityId}
            onChange={(e) => setLegalEntityId(e.target.value)}
          >
            {(overview?.legalEntities.length ?? 0) === 0 ? <option value="">No legal entity exists</option> : null}
            {(overview?.legalEntities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>{`${entity.code} · ${entity.legalName}`}</option>
            ))}
          </select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs font-bold text-muted-foreground">Effective on</span>
          <input
            type="date"
            aria-label="Coverage date"
            className={`${inputClass} w-full sm:w-auto`}
            value={asOf || overview?.asOf || ""}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Coverage and the mapping windows below are resolved at this date, the same way a run resolves them at its period end.
        </p>
      </div>

      {notice ? (
        <p role="status" className="mb-4 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground">
          {notice}
        </p>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* 1. Mapping register                                                 */}
      {/* ------------------------------------------------------------------ */}

      {createOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="New GL component mapping"
            description="Created as a draft. Every field is required by the ledger workflow, including both ends of the effective window."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Legal entity code</span>
              <input className={`${inputClass} w-full`} value={form.entityCode} onChange={(e) => setForm({ ...form, entityCode: e.target.value })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Component code</span>
              <input className={`${inputClass} w-full`} value={form.componentCode} onChange={(e) => setForm({ ...form, componentCode: e.target.value })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Debit account code</span>
              <input className={`${inputClass} w-full`} value={form.debitAccountCode} onChange={(e) => setForm({ ...form, debitAccountCode: e.target.value })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Credit account code</span>
              <input className={`${inputClass} w-full`} value={form.creditAccountCode} onChange={(e) => setForm({ ...form, creditAccountCode: e.target.value })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Posting side</span>
              <select className={`${selectClass} w-full`} value={form.postingSide} onChange={(e) => setForm({ ...form, postingSide: e.target.value })}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cost centre source</span>
              <select className={`${selectClass} w-full`} value={form.costCenterSource} onChange={(e) => setForm({ ...form, costCenterSource: e.target.value })}>
                {COST_CENTER_SOURCES.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Effective from</span>
              <input type="date" className={`${inputClass} w-full`} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Effective to</span>
              <input type="date" className={`${inputClass} w-full`} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="h-9 rounded-lg text-xs" disabled={busyAction === "create"} onClick={() => void createMapping()}>
              {busyAction === "create" ? "Creating…" : "Create draft mapping"}
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </Surface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Mapping register"
            description={loading ? "Loading…" : `${filtered.length} mapping${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <input aria-label="Search mappings" className={`${inputClass} w-full sm:w-auto`} placeholder="Component or account" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Mapping status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {(overview?.workflow?.states ?? []).map((state) => (
                    <option key={state} value={state}>{state}</option>
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
              {mappings.length === 0
                ? "No GL component mapping exists yet. Create the first one, then submit it for approval."
                : "No mappings match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Component</th>
                    <th className="px-3 py-2 font-bold">Account</th>
                    <th className="px-3 py-2 font-bold">Dr/Cr</th>
                    <th className="px-3 py-2 font-bold">Effective</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const active = row.id === selected?.id;
                    const clash = (overview?.overlaps[row.id] ?? []).length > 0;
                    return (
                      <tr key={row.id}>
                        <td colSpan={6} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            aria-current={active ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="truncate text-xs font-semibold text-foreground">
                              {row.componentCode}
                              {clash ? <AlertTriangle className="ml-1 inline size-3.5 text-warning" aria-label="Overlapping window" /> : null}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{row.accountCode}</span>
                            <span className="whitespace-nowrap text-xs font-bold uppercase text-foreground">{row.postingSide === "credit" ? "Cr" : "Dr"}</span>
                            <span className="truncate text-xs text-muted-foreground">{`${row.startDate || "—"} → ${row.endDate || "—"}`}</span>
                            <span><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></span>
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
            title="Mapping detail"
            description={selected ? `${selected.componentCode} → ${selected.accountCode}` : "Select a mapping to act on it"}
            action={selected ? <StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill> : undefined}
          />
          {!selected ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No mapping selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Component", selected.componentCode],
                  ["GL account", selected.accountCode],
                  ["Posting side", selected.postingSide === "credit" ? "Credit" : "Debit"],
                  ["Cost centre source", selected.costCenterSource || "Not set"],
                  ["Effective", `${selected.startDate || "—"} → ${selected.endDate || "—"}`],
                  ["Record version", String(selected.version)],
                  ["Fields editable", (overview?.workflow?.editable ?? []).includes(selected.status) ? "Yes, in this state" : "No, not in this state"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {overlapForSelected.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span>
                      The effective window overlaps {overlapForSelected.length} approved mapping
                      {overlapForSelected.length === 1 ? "" : "s"} for the same component
                      {overlapForSelected.map((conflict) => ` (${conflict.startDate ?? "—"} → ${conflict.endDate ?? "—"})`).join(", ")}.
                      The workflow refuses to approve a second overlapping mapping. It answers with one combined
                      conflict message covering several checks at once, so this warning is shown here to name which one
                      it is. The server remains the authority.
                    </span>
                  </p>
                </div>
              ) : null}

              <label className="mt-4 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reason (audited)</span>
                <textarea
                  className="min-h-16 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why this action is being taken"
                />
              </label>

              <div className="mt-3 space-y-2">
                {(overview?.workflow?.actions ?? []).map((action) => {
                  const state = availability(action);
                  return (
                    <div key={action}>
                      <Button
                        size="sm"
                        variant={action === "approve" ? "default" : "outline"}
                        className="h-8 w-full justify-center rounded-lg text-xs"
                        disabled={!state.allowed || busyAction === action}
                        onClick={() => void runAction(action)}
                      >
                        {busyAction === action ? "Working…" : ACTION_LABELS[action] ?? action}
                      </Button>
                      {!state.allowed ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{state.reason}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Surface>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Coverage                                                         */}
      {/* ------------------------------------------------------------------ */}

      <Surface className="mt-6">
        <SectionHeading
          title="Coverage"
          description={
            overview?.coverage
              ? `Every pay component against its mapping for this legal entity on ${overview.asOf}. A component with no approved, effective mapping stops the payroll run reaching approved (RL-521).`
              : "Which pay components carry an approved, effective mapping."
          }
          action={
            overview?.coverage ? (
              <StatusPill tone={overview.coverage.summary.blocking > 0 ? "danger" : "success"}>
                {overview.coverage.summary.blocking > 0
                  ? `${overview.coverage.summary.blocking} blocking`
                  : "Nothing blocking"}
              </StatusPill>
            ) : undefined
          }
        />
        {loading && !overview ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : !overview?.coverage ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {overview?.coverageUnavailableReason || "Coverage has no source to read from and is not shown."}
          </p>
        ) : overview.coverage.rows.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            This workspace has no pay components, so there is nothing to map yet.
          </p>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(COVERAGE_LABELS).map(([state, label]) => {
                const count = overview.coverage?.summary[state] ?? 0;
                if (count === 0) return null;
                return (
                  <StatusPill key={state} tone={coverageTone(state)}>{`${label}: ${count}`}</StatusPill>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Component</th>
                    <th className="px-3 py-2 font-bold">Account</th>
                    <th className="px-3 py-2 font-bold">Effective window</th>
                    <th className="px-3 py-2 font-bold">Coverage</th>
                    <th className="px-3 py-2 font-bold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.coverage.rows.map((row) => (
                    <tr key={row.componentCode} className="border-t border-border/60 align-top">
                      <td className="px-3 py-2 text-xs font-semibold text-foreground">
                        {row.componentName}
                        <span className="block font-normal text-muted-foreground">{row.componentCode} · {row.kind.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.accountCode
                          ? `${row.accountCode} · ${row.postingSide === "credit" ? "Cr" : "Dr"}`
                          : "No account resolved"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.mappingStatus === null ? "No mapping record" : `${row.startDate ?? "open"} → ${row.endDate ?? "open"}`}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <StatusPill tone={coverageTone(row.state)}>{COVERAGE_LABELS[row.state] ?? row.state}</StatusPill>
                        {row.blocksRun ? <span className="mt-1 block text-[11px] font-bold text-destructive">Blocks the run</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{row.reason ?? "Posts as mapped."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {overview.blocking && overview.blocking.length > 0 ? (
              <div className="mt-4 rounded-xl border border-destructive/40 px-3 py-3">
                <p className="mb-2 text-xs font-bold text-foreground">
                  RL-521 — what the run itself would refuse, read from the same check that blocks it
                </p>
                <ul className="space-y-1">
                  {overview.blocking.map((row) => (
                    <li key={row.componentCode} className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">{row.componentName} ({row.componentCode})</span> — {row.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  These are the components with no effective mapping for this legal entity on {overview.asOf}, with no amounts
                  attached: this list is not tied to a payroll run, so exposure per component has no source here. The run-specific
                  exposure, with amounts and employee counts, is on the journal screen.
                </p>
              </div>
            ) : null}
            <Link
              href="/gl-mapping-journal"
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary"
            >
              See the run journal these mappings produce <ChevronRight className="ml-1 size-3.5" />
            </Link>
          </div>
        )}
      </Surface>

      {/* ------------------------------------------------------------------ */}
      {/* 3. ERP posting handoff                                              */}
      {/* ------------------------------------------------------------------ */}

      <Surface className="mt-6">
        <SectionHeading
          title="ERP posting handoff"
          description="The create_gl_posting and ack_gl_posting commands, which queue a batch into vp_gl_batches and record an external document number against it."
          action={
            overview ? (
              <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <StatusPill tone="warning">{`${overview.erp.queued} queued`}</StatusPill>
                <StatusPill tone="success">{`${overview.erp.acknowledged} acknowledged`}</StatusPill>
              </div>
            ) : undefined
          }
        />
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>
            Nothing here transmits anything to an ERP. Queueing writes a batch row and an outbox event; acknowledging stores an
            external document number someone obtained elsewhere. <code className="font-mono">docs/HRMS_WORKFLOW_DELIVERY.md</code>
            {" "}is explicit that the real ERP provider must be configured and validated before external delivery is claimed, and
            that a stored acknowledgement records an independently completed action rather than initiating one.
          </span>
        </p>
        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
          Queueing resolves its accounts against approved <code className="font-mono">ledger</code> mappings whose window covers the
          first day of the run&apos;s period, and it asks for mappings named <code className="font-mono">gross</code> and
          {" "}<code className="font-mono">net</code> rather than for the pay components in the coverage table above. A queue attempt
          that has no such mapping is refused with the component it wanted; that refusal is shown here verbatim.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <span className="shrink-0 text-xs font-bold text-muted-foreground">Payroll run</span>
            <select aria-label="Payroll run to queue" className={`${selectClass} w-full max-w-full sm:w-auto`} value={activeRun?.id ?? ""} onChange={(e) => setSelectedRunId(e.target.value)}>
              {runs.length === 0 ? <option value="">No payroll runs</option> : null}
              {runs.map((run) => (
                <option key={run.id} value={run.id}>{`${formatPeriod(run.period)} · ${run.scope} · ${run.status}`}</option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            className="h-8 rounded-lg text-xs"
            disabled={!activeRun || !runFinalized || busyAction === "create_gl_posting"}
            onClick={() => void queueErpBatch()}
          >
            {busyAction === "create_gl_posting" ? "Queueing…" : "Queue GL batch"}
          </Button>
          {!activeRun ? (
            <p className="text-xs text-muted-foreground">No payroll run exists to queue.</p>
          ) : !runFinalized ? (
            <p className="text-xs text-muted-foreground">
              This run is {activeRun.status}. Only a finalized run can be posted to the ERP.
            </p>
          ) : null}
        </div>

        {loading && !overview ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : (overview?.erp.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            No ERP batch has ever been queued in this workspace.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Run</th>
                  <th className="px-3 py-2 font-bold">Batch state</th>
                  <th className="px-3 py-2 text-right font-bold">Queued debit</th>
                  <th className="px-3 py-2 text-right font-bold">Lines</th>
                  <th className="px-3 py-2 font-bold">External document</th>
                  <th className="px-3 py-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.erp.items ?? []).map((batch) => (
                  <tr key={batch.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 text-xs font-semibold text-foreground">
                      {batch.period ? formatPeriod(batch.period) : "Run not found"}
                      <span className="block font-normal text-muted-foreground">{batch.runScope ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <StatusPill tone={batchTone(batch.status)}>{batch.status}</StatusPill>
                      {batch.connectionId === null ? (
                        <span className="mt-1 block text-[11px] text-muted-foreground">No integration connection attached</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(batch.debitMinor)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      <button
                        type="button"
                        className="font-bold text-primary hover:underline"
                        aria-expanded={openBatchId === batch.id}
                        onClick={() => setOpenBatchId((current) => (current === batch.id ? "" : batch.id))}
                      >
                        {batch.lineCount}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {batch.acknowledgementRef ?? "Not acknowledged"}
                      {batch.postedAt ? <span className="block">{batch.postedAt.slice(0, 10)}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {batch.status === "reconciled" ? (
                        <span className="text-muted-foreground">Already acknowledged.</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            aria-label={`External document number for batch ${batch.id}`}
                            className={`${inputClass} w-44`}
                            placeholder="External document no."
                            value={ackRef}
                            onChange={(e) => setAckRef(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg text-xs"
                            disabled={busyAction === `ack:${batch.id}`}
                            onClick={() => void acknowledgeBatch(batch.id)}
                          >
                            {busyAction === `ack:${batch.id}` ? "Recording…" : "Record acknowledgement"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {openBatchId ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-foreground">What was queued on this batch (vp_gl_lines)</p>
            {overview?.batchLines === null || overview?.batchLines === undefined ? (
              <p className="text-xs text-muted-foreground">Loading the batch lines…</p>
            ) : overview.batchLines.length === 0 ? (
              <p className="text-xs text-muted-foreground">This batch has no lines.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-bold">Account</th>
                      <th className="px-3 py-2 font-bold">Component</th>
                      <th className="px-3 py-2 text-right font-bold">Debit</th>
                      <th className="px-3 py-2 text-right font-bold">Credit</th>
                      <th className="px-3 py-2 font-bold">Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.batchLines.map((line, index) => (
                      <tr key={`${line.accountCode}-${line.componentCode}-${index}`} className="border-t border-border/60">
                        <td className="px-3 py-2 text-xs font-semibold text-foreground">{line.accountCode}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{line.componentCode}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{line.debitMinor === 0 ? "—" : money(line.debitMinor)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{line.creditMinor === 0 ? "—" : money(line.creditMinor)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{line.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Surface>

      {/* ------------------------------------------------------------------ */}
      {/* 4. The two posting paths                                            */}
      {/* ------------------------------------------------------------------ */}

      <Surface className="mt-6">
        <SectionHeading
          title="Two posting paths, side by side"
          description="Payroll writes accounting output twice, through two unrelated code paths. They are shown separately because nothing in this system reconciles them against each other."
          action={<StatusPill tone="warning">Not reconciled</StatusPill>}
        />
        {loading && !overview ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : !overview ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">Nothing loaded.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/80 p-4">
              <p className="text-xs font-bold text-foreground">Ledger journal — <code className="font-mono">payroll_exports</code></p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Written by <code className="font-mono">postJournal</code> in <code className="font-mono">src/server/payroll/gl.ts</code>.
                One balanced, dimensioned export per run per legal entity, built from every approved mapping. This is what the
                journal screen posts and supersedes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="success">{`${overview.journal.posted} posted`}</StatusPill>
                <StatusPill tone="warning">{`${overview.journal.superseded} superseded`}</StatusPill>
                <StatusPill tone={overview.journal.failed > 0 ? "danger" : "neutral"}>{`${overview.journal.failed} failed`}</StatusPill>
              </div>
              {overview.journal.items.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No journal has been posted yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Period</th>
                        <th className="px-3 py-2 font-bold">State</th>
                        <th className="px-3 py-2 text-right font-bold">Debit</th>
                        <th className="px-3 py-2 text-right font-bold">Lines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.journal.items.map((row) => (
                        <tr key={row.id} className="border-t border-border/60">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">
                            {row.period ? formatPeriod(row.period) : "—"}
                            {row.failureMessage ? (
                              <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">
                                {row.failureCode ? `${row.failureCode}: ` : ""}
                                {row.failureMessage}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs"><StatusPill tone={journalStateTone(row.state)}>{row.state}</StatusPill></td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                            {row.totalDebitMinor === null ? <span className="text-muted-foreground">{row.state === "failed" ? "Nothing posted" : "No total recorded"}</span> : money(row.totalDebitMinor)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                            {row.lineCount === null ? <span className="text-muted-foreground">unknown</span> : row.lineCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/80 p-4">
              <p className="text-xs font-bold text-foreground">ERP batches — <code className="font-mono">vp_gl_batches</code></p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Written by the <code className="font-mono">create_gl_posting</code> and <code className="font-mono">ack_gl_posting</code>
                {" "}commands in <code className="font-mono">src/server/vp/service.ts</code>. One batch per run, built from a
                separate, coarser calculation (a gross debit, one credit per deduction, one net credit) and not dimensioned.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="warning">{`${overview.erp.queued} queued`}</StatusPill>
                <StatusPill tone="success">{`${overview.erp.acknowledged} acknowledged`}</StatusPill>
              </div>
              {overview.erp.items.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No batch has been queued yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Period</th>
                        <th className="px-3 py-2 font-bold">State</th>
                        <th className="px-3 py-2 text-right font-bold">Debit</th>
                        <th className="px-3 py-2 text-right font-bold">Lines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.erp.items.map((row) => (
                        <tr key={row.id} className="border-t border-border/60">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">{row.period ? formatPeriod(row.period) : "—"}</td>
                          <td className="px-3 py-2 text-xs"><StatusPill tone={batchTone(row.status)}>{row.status}</StatusPill></td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(row.debitMinor)}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{row.lineCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {overview ? (
          <div className="mt-4 rounded-xl border border-border/80 px-3 py-3">
            <p className="text-xs font-bold text-foreground">Which runs reached which path</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Presence only. This compares whether a row exists on each path for a run; it does not compare the amounts, because
              the two are computed differently and no reconciliation between them exists in this system.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li><span className="font-semibold text-foreground">{overview.presence.both.length}</span> run(s) on both paths</li>
              <li><span className="font-semibold text-foreground">{overview.presence.erpOnly.length}</span> run(s) queued to the ERP with no posted journal</li>
              <li><span className="font-semibold text-foreground">{overview.presence.journalOnly.length}</span> run(s) with a posted journal and no ERP batch</li>
            </ul>
            <Link
              href="/readiness"
              className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary"
            >
              Open the command workspace <ExternalLink className="ml-1 size-3.5" />
            </Link>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
