"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { OperationCreateDialog } from "./operation-create-dialog";
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

function scopeLabel(scope: string): string {
  if (scope === "regular") return "Regular";
  if (scope === "ot") return "Off-cycle overtime";
  if (scope === "full_final") return "Full and final";
  if (scope === "correction") return "Correction";
  return scope || "—";
}

/** The mapping's real workflow state, as the `ledger` resource records it. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "approved") return "success";
  if (status === "submitted") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  if (status === "retired") return "info";
  return "neutral";
}

function journalStateTone(state: string): "success" | "warning" | "info" | "neutral" {
  if (state === "posted") return "success";
  if (state === "validated") return "info";
  if (state === "superseded") return "warning";
  return "neutral";
}

type RunRow = { id: string; period: string; scope: string; status: string };

type MappingRow = {
  key: string;
  componentCode: string;
  componentName: string;
  kind: string;
  accountCode: string;
  accountName: string;
  /** FRM-FIN-01 gives a mapping both sides; either can be unresolved in this entity's chart. */
  debitAccount: string;
  creditAccount: string;
  postingSide: string;
  costCenterSource: string;
  costCenterCode: string | null;
  /** FRM-FIN-01 "Dimension source": what the line is split by before aggregation. */
  dimensionSource: string[];
  /** FRM-FIN-01 "Override by location": location, debit, credit. */
  locationOverrides: Array<{ location: string; debitAccountCode: string | null; creditAccountCode: string | null }>;
  dimensions: string[];
  startDate: string | null;
  endDate: string | null;
  status: string;
  legalEntityId: string;
};

type Contribution = { payrollLineId: string; employeeId: string; employeeCode: string | null; employeeName: string | null; amountMinor: number };

type JournalLineRow = {
  key: string;
  accountCode: string;
  accountName: string;
  componentCode: string | null;
  debitMinor: number;
  creditMinor: number;
  costCenter: string | null;
  department: string | null;
  location: string | null;
  project: string | null;
  runType: string;
  contributions: Contribution[];
};

type JournalBlock = {
  legalEntityId: string;
  state: string;
  postedAt: string | null;
  lines: JournalLineRow[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  residualMinor: number;
  balanced: boolean;
};

type UnmappedRow = { componentCode: string; componentName: string; reason: string; amountMinor: number; employeeCount: number };

type JournalView = {
  state: string;
  blocked: boolean;
  legacy: boolean;
  asOf: string;
  unmapped: UnmappedRow[];
  blocks: JournalBlock[];
};

function readContributions(value: unknown): Contribution[] {
  return (Array.isArray(value) ? (value as UnknownRecord[]) : []).map((entry) => ({
    payrollLineId: str(entry.payrollLineId),
    employeeId: str(entry.employeeId),
    employeeCode: typeof entry.employeeCode === "string" ? entry.employeeCode : null,
    employeeName: typeof entry.employeeName === "string" ? entry.employeeName : null,
    amountMinor: int(entry.amountMinor),
  }));
}

/**
 * Reads the journal endpoint. The dimensioned read model is preferred; the
 * older flat `journal[]` shape is still rendered (without dimensions or
 * drill-back) so the screen degrades rather than blanks.
 */
function readJournal(payload: unknown): JournalView {
  const data = asRecord(asRecord(payload).data);
  const journals = Array.isArray(data.journals) ? (data.journals as UnknownRecord[]) : null;
  const unmapped = (Array.isArray(data.unmapped) ? (data.unmapped as UnknownRecord[]) : []).map((entry) => ({
    componentCode: str(entry.componentCode, "—"),
    componentName: str(entry.componentName, str(entry.componentCode, "—")),
    reason: str(entry.reason, "This component has no effective GL mapping."),
    amountMinor: int(entry.amountMinor),
    employeeCount: int(entry.employeeCount),
  }));

  if (journals) {
    const blocks = journals.map((journal, blockIndex) => {
      const lines = (Array.isArray(journal.lines) ? (journal.lines as UnknownRecord[]) : []).map((entry, index) => {
        const dimensions = asRecord(entry.dimensions);
        return {
          key: `${blockIndex}-${index}`,
          accountCode: str(entry.accountCode, "—"),
          accountName: str(entry.accountName, ""),
          componentCode: typeof entry.componentCode === "string" ? entry.componentCode : null,
          debitMinor: int(entry.debitMinor),
          creditMinor: int(entry.creditMinor),
          costCenter: typeof dimensions.costCenterCode === "string" ? dimensions.costCenterCode : null,
          department: typeof dimensions.department === "string" ? dimensions.department : null,
          location: typeof dimensions.location === "string" ? dimensions.location : null,
          project: typeof dimensions.projectId === "string" ? dimensions.projectId : null,
          runType: str(dimensions.runType, "—"),
          contributions: readContributions(entry.contributions),
        };
      });
      return {
        legalEntityId: str(journal.legalEntityId, "—"),
        state: str(journal.state, "validated"),
        postedAt: typeof journal.postedAt === "string" ? journal.postedAt : null,
        lines,
        totalDebitMinor: int(journal.totalDebitMinor),
        totalCreditMinor: int(journal.totalCreditMinor),
        residualMinor: int(journal.residualMinor),
        balanced: journal.balanced === true,
      };
    });
    return { state: str(data.state, "draft"), blocked: data.blocked === true, legacy: false, asOf: str(data.asOf), unmapped, blocks };
  }

  const flat = (Array.isArray(data.journal) ? (data.journal as UnknownRecord[]) : []).map((entry, index) => ({
    key: `legacy-${index}`,
    accountCode: str(entry.account, "—"),
    accountName: "",
    componentCode: null,
    debitMinor: int(entry.debitMinor),
    creditMinor: int(entry.creditMinor),
    costCenter: null,
    department: null,
    location: null,
    project: null,
    runType: "—",
    contributions: [],
  }));
  const totalDebitMinor = flat.reduce((total, entry) => total + entry.debitMinor, 0);
  const totalCreditMinor = flat.reduce((total, entry) => total + entry.creditMinor, 0);
  return {
    state: "draft",
    blocked: false,
    legacy: true,
    asOf: "",
    unmapped,
    blocks: flat.length === 0 ? [] : [{
      legalEntityId: "—",
      state: "draft",
      postedAt: null,
      lines: flat,
      totalDebitMinor,
      totalCreditMinor,
      residualMinor: totalDebitMinor - totalCreditMinor,
      balanced: totalDebitMinor === totalCreditMinor,
    }],
  };
}

function journalCsv(runId: string, period: string, blocks: JournalBlock[]): string {
  const header = ["run_id", "period", "legal_entity_id", "journal_state", "account_code", "account_name", "component_code", "debit_minor", "credit_minor", "cost_center", "department", "location", "project", "run_type", "contributing_payroll_lines", "contributing_employees"];
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = blocks.flatMap((block) =>
    block.lines.map((entry) => [
      runId, period, block.legalEntityId, block.state, entry.accountCode, entry.accountName, entry.componentCode ?? "net_pay",
      String(entry.debitMinor), String(entry.creditMinor),
      entry.costCenter ?? "", entry.department ?? "", entry.location ?? "", entry.project ?? "", entry.runType,
      String(entry.contributions.length),
      entry.contributions.map((item) => item.employeeCode ?? item.employeeId).join(" "),
    ].map((cell) => escape(String(cell))).join(",")),
  );
  return [header.join(","), ...rows].join("\n");
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function GlMappingPage() {
  // Deep-link preselect (?record=<runId>); lazy initializer keeps SSR output stable.
  const [selectedRunId, setSelectedRunId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedMappingKey, setSelectedMappingKey] = useState("");
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState("");
  const [openLineKey, setOpenLineKey] = useState("");
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  // FIN-03.4: posting delivers the journal and is guarded by payroll.accounting.approve.
  // postJournal is idempotent per run and legal entity, so a repeat post is a no-op
  // rather than a duplicate batch.
  const postJournal = useCallback(async (runId: string) => {
    setPostBusy(true);
    setPostError("");
    try {
      const response = await fetch(`/api/v1/payroll-runs/${runId}/journal`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Posting failed (${response.status}).`);
      }
      invalidateGetRequests();
      setRevision((n) => n + 1);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Could not post the journal.");
    } finally {
      setPostBusy(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [runPayload, mappingPayload] = await Promise.all([
          getJson("/api/v1/payroll-runs?page=1&pageSize=100"),
          getJson("/api/v1/gl-mappings"),
        ]);
        const runRows = (Array.isArray(asRecord(runPayload).data) ? (asRecord(runPayload).data as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
          status: str(item.status, "—"),
        }));
        const mappingRows = (Array.isArray(asRecord(mappingPayload).data) ? (asRecord(mappingPayload).data as UnknownRecord[]) : []).map((item) => {
          const side = str(item.postingSide, "debit");
          const debit = asRecord(item.debitAccount);
          const credit = asRecord(item.creditAccount);
          const account = side === "credit" ? credit : debit;
          const accountLabel = (entry: UnknownRecord): string => {
            const code = str(entry.code, "");
            const name = str(entry.name, "");
            return code ? (name ? `${code} · ${name}` : code) : "";
          };
          return {
            key: str(item.id),
            componentCode: str(item.componentCode, "—"),
            componentName: str(item.componentName, str(item.componentCode, "—")),
            kind: str(item.kind, "—"),
            accountCode: str(account.code, ""),
            accountName: str(account.name, ""),
            debitAccount: accountLabel(debit),
            creditAccount: accountLabel(credit),
            postingSide: side,
            costCenterSource: str(item.costCenterSource, ""),
            dimensionSource: Array.isArray(item.dimensionSource) ? (item.dimensionSource as unknown[]).map((value) => String(value)) : [],
            locationOverrides: Array.isArray(item.locationOverrides)
              ? (item.locationOverrides as UnknownRecord[]).map((entry) => ({
                  location: str(entry.location, ""),
                  debitAccountCode: typeof entry.debitAccountCode === "string" ? entry.debitAccountCode : null,
                  creditAccountCode: typeof entry.creditAccountCode === "string" ? entry.creditAccountCode : null,
                }))
              : [],
            costCenterCode: typeof item.costCenterCode === "string" ? item.costCenterCode : null,
            dimensions: Array.isArray(item.dimensions) ? (item.dimensions as unknown[]).map((value) => String(value)) : [],
            startDate: typeof item.startDate === "string" ? item.startDate : null,
            endDate: typeof item.endDate === "string" ? item.endDate : null,
            status: str(item.status, "draft"),
            legalEntityId: str(item.legalEntityId, "—"),
          };
        });
        if (live) {
          setRuns(runRows);
          setMappings(mappingRows);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "GL mappings could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return mappings.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (needle && !`${row.componentCode} ${row.componentName} ${row.debitAccount} ${row.creditAccount}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [mappings, search, statusFilter]);

  const activeMapping = useMemo(
    () => mappings.find((row) => row.key === selectedMappingKey) ?? filtered[0] ?? null,
    [mappings, selectedMappingKey, filtered],
  );

  const activeRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null, [runs, selectedRunId]);
  const activeRunId = activeRun?.id ?? "";

  useEffect(() => {
    if (!activeRunId) return;
    let live = true;
    void (async () => {
      setJournalLoading(true);
      setJournalError("");
      try {
        const payload = await getJson(`/api/v1/payroll-runs/${encodeURIComponent(activeRunId)}/journal`);
        if (live) setJournal(readJournal(payload));
      } catch (err) {
        if (live) {
          setJournal(null);
          setJournalError(err instanceof Error ? err.message : "The journal could not be loaded.");
        }
      } finally {
        if (live) setJournalLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeRunId, revision]);

  function downloadCsv(): void {
    if (!journal || !activeRun) return;
    const csv = journalCsv(activeRun.id, activeRun.period, journal.blocks);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gl-journal-${activeRun.period || activeRun.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    const blocks = journal?.blocks ?? [];
    const debit = blocks.reduce((total, block) => total + block.totalDebitMinor, 0);
    const credit = blocks.reduce((total, block) => total + block.totalCreditMinor, 0);
    return { debit, credit, residual: debit - credit, balanced: blocks.length > 0 && debit === credit };
  }, [journal]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-102"
        title="GL mapping and journal"
        description="Map every pay component to a ledger account, validate the run's journal, and post one balanced, dimensioned journal per legal entity."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Validate
            </Button>
            <OperationCreateDialog resource="ledger" label="Map a component" onCreated={refresh} />
          </div>
        }
      />

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-102"
          description="Map component → submit → approve (mapping workflow) → validate the run journal → post → download. A component with no approved, effective mapping blocks the run: RL-521 is checked before a journal is built, and RL-522 requires one balanced journal per run per legal entity."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Mappings are created and approved on the GL component mapping workflow, which holds draft → submitted → approved and retire, and refuses two approved mappings whose effective dates overlap for the same component. Posting writes the journal under the payroll accounting approve permission and supersedes — never deletes — an earlier export.
        </p>
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-xs font-bold text-muted-foreground">Payroll run</span>
          <select
            aria-label="Payroll run"
            className={`${selectClass} w-full max-w-full sm:w-auto`}
            value={activeRunId}
            onChange={(e) => {
              setSelectedRunId(e.target.value);
              setOpenLineKey("");
            }}
          >
            {runs.length === 0 ? <option value="">No runs available</option> : null}
            {runs.map((run) => (
              <option key={run.id} value={run.id}>{`${formatPeriod(run.period)} · ${scopeLabel(run.scope)} · ${run.status}`}</option>
            ))}
          </select>
        </label>
        <Link href={activeRunId ? `/payroll?record=${encodeURIComponent(activeRunId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll run
        </Link>
      </div>

      {journal && journal.unmapped.length > 0 ? (
        <Surface className="mb-6 border-destructive/40">
          <SectionHeading
            title="Unmapped components"
            description="These components appear in the selected run but carry no approved, effective GL mapping. The run cannot be approved and no journal can be posted until every one of them is mapped."
            action={<StatusPill tone="danger">Blocking</StatusPill>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Component</th>
                  <th className="px-3 py-2 text-right font-bold">Exposure</th>
                  <th className="px-3 py-2 text-right font-bold">Employees</th>
                  <th className="px-3 py-2 font-bold">Why it blocks</th>
                </tr>
              </thead>
              <tbody>
                {journal.unmapped.map((row) => (
                  <tr key={row.componentCode} className="border-t border-border/60">
                    <td className="px-3 py-2 text-xs font-semibold text-foreground">{row.componentName} <span className="text-muted-foreground">({row.componentCode})</span></td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{money(row.amountMinor)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{row.employeeCount}</td>
                    <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OperationCreateDialog
            resource="ledger"
            label="Map these components"
            variant="secondary"
            className="mt-4"
            onCreated={refresh}
          />
        </Surface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} mapping${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <input aria-label="Search mappings" className={`${inputClass} w-full sm:w-auto`} placeholder="Component or account" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Mapping status filter" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="returned">Returned</option>
                  <option value="approved">Approved</option>
                  <option value="retired">Retired</option>
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
                ? "No GL mappings exist yet. Create the first component mapping, then submit it for approval."
                : "No mappings match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Component</th>
                    <th className="px-3 py-2 font-bold">GL account</th>
                    <th className="px-3 py-2 font-bold">Dr/Cr</th>
                    <th className="px-3 py-2 font-bold">Dimension</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.key === activeMapping?.key;
                    return (
                      <tr key={row.key}>
                        <td colSpan={6} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedMappingKey(row.key)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto_minmax(0,1fr)_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="truncate text-xs font-semibold text-foreground">{row.componentName}<span className="ml-1 font-normal text-muted-foreground">({row.componentCode})</span></span>
                            <span className="truncate text-xs text-muted-foreground">
                              {row.debitAccount || row.creditAccount
                                ? `Dr ${row.debitAccount || "—"} / Cr ${row.creditAccount || "—"}`
                                : "Account not in this entity's chart"}
                            </span>
                            <span className="whitespace-nowrap text-xs font-bold uppercase text-foreground">{row.postingSide === "credit" ? "Cr" : "Dr"}</span>
                            <span className="truncate text-xs text-muted-foreground">{row.costCenterCode ?? (row.costCenterSource || "No cost centre")}</span>
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
            description={activeMapping ? `${activeMapping.componentName} · ${activeMapping.kind}` : "Select a mapping to inspect it"}
            action={activeMapping ? <StatusPill tone={statusTone(activeMapping.status)}>{activeMapping.status}</StatusPill> : undefined}
          />
          {!activeMapping ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No mapping selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Component", `${activeMapping.componentName} (${activeMapping.componentCode})`],
                  ["Debit account", activeMapping.debitAccount || "Not mapped in this legal entity"],
                  ["Credit account", activeMapping.creditAccount || "Not mapped in this legal entity"],
                  ["Posting side", activeMapping.postingSide === "credit" ? "Credit" : "Debit"],
                  ["Dimension source", activeMapping.dimensionSource.length > 0 ? activeMapping.dimensionSource.map((entry) => entry.replace(/_/g, " ")).join(", ") : activeMapping.costCenterSource || "None"],
                  [
                    "Location overrides",
                    activeMapping.locationOverrides.length === 0
                      ? "None"
                      : activeMapping.locationOverrides
                          .map((entry) => `${entry.location}: ${entry.debitAccountCode ?? "—"} / ${entry.creditAccountCode ?? "—"}`)
                          .join("; "),
                  ],
                  ["Cost centre", activeMapping.costCenterCode ?? "Resolved per employee"],
                  ["Effective", `${activeMapping.startDate ?? "—"} → ${activeMapping.endDate ?? "open"}`],
                  ["Legal entity", activeMapping.legalEntityId],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dimensions carried</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeMapping.dimensions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No dimensions declared.</p>
                ) : (
                  activeMapping.dimensions.map((dimension) => (
                    <span key={dimension} className="rounded-lg border border-border/70 bg-secondary/40 px-2 py-1 text-[11px] text-foreground">{dimension.replace(/_/g, " ")}</span>
                  ))
                )}
              </div>
              <Link href="/accounting?section=operations/ledger" className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Open mapping workflow <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          )}
        </Surface>
      </div>

      <Surface className="mt-6">
        <SectionHeading
          title="Journal"
          description={activeRun ? `${formatPeriod(activeRun.period)} · ${scopeLabel(activeRun.scope)}${journal?.asOf ? ` · resolved at ${journal.asOf}` : ""}` : "Select a payroll run"}
          action={
            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              {journal && journal.blocks.length > 0 ? <StatusPill tone={journalStateTone(journal.state)}>{journal.state}</StatusPill> : null}
              {journal && journal.blocks.length > 0 ? (
                <StatusPill tone={totals.balanced ? "success" : "danger"}>
                  {totals.balanced ? "Balanced" : `Out of balance by ${money(totals.residual)}`}
                </StatusPill>
              ) : null}
              {journal && journal.blocks.length > 0 ? (
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={downloadCsv}>
                  <Download className="mr-1.5 size-3.5" /> Download CSV
                </Button>
              ) : null}
              {journal && journal.blocks.length > 0 && !journal.blocked && totals.balanced && journal.state !== "posted" && activeRun ? (
                <Button size="sm" className="h-8 rounded-lg text-xs" disabled={postBusy} onClick={() => void postJournal(activeRun.id)}>
                  {postBusy ? "Posting…" : "Post journal"}
                </Button>
              ) : null}
            </div>
          }
        />
        {postError ? <p role="alert" className="mb-3 text-xs text-destructive">{postError}</p> : null}
        {!activeRun ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No payroll run selected.</p>
        ) : journalLoading && !journal ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : journalError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">{journalError}</p>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        ) : !journal || journal.blocks.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
            {journal?.blocked
              ? "No journal can be built while components remain unmapped. Clear the blocking list above, then validate again."
              : "This run has produced no journal lines yet. Calculate the run, then validate."}
          </p>
        ) : (
          <div className="space-y-6">
            {journal.legacy ? (
              <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                The journal endpoint is still returning the undimensioned figures. Cost centre, department, location and drill-back appear once it serves the mapped journal.
              </p>
            ) : null}
            {journal.blocks.map((block) => (
              <div key={block.legalEntityId}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-all text-xs font-bold text-foreground">Legal entity {block.legalEntityId}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={journalStateTone(block.state)}>{block.state}</StatusPill>
                    <StatusPill tone={block.balanced ? "success" : "danger"}>
                      {block.balanced ? `Balanced at ${money(block.totalDebitMinor)}` : `Residual ${money(block.residualMinor)}`}
                    </StatusPill>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-bold">Account</th>
                        <th className="px-3 py-2 font-bold">Component</th>
                        <th className="px-3 py-2 font-bold">Dimensions</th>
                        <th className="px-3 py-2 text-right font-bold">Debit</th>
                        <th className="px-3 py-2 text-right font-bold">Credit</th>
                        <th className="px-3 py-2 font-bold">Drill-back</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.lines.map((entry) => (
                        <tr key={entry.key} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">
                            {entry.accountCode}
                            {entry.accountName ? <span className="block font-normal text-muted-foreground">{entry.accountName}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{entry.componentCode ?? "Net pay"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {[
                              ["Cost centre", entry.costCenter],
                              ["Department", entry.department],
                              ["Location", entry.location],
                              ["Project", entry.project],
                              ["Run type", entry.runType],
                            ].map(([label, value]) => (
                              <span key={label} className="mr-2 inline-block whitespace-nowrap">
                                {label}: <span className={value ? "text-foreground" : "italic"}>{value ?? "none"}</span>
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{entry.debitMinor === 0 ? "—" : money(entry.debitMinor)}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{entry.creditMinor === 0 ? "—" : money(entry.creditMinor)}</td>
                          <td className="px-3 py-2 text-xs">
                            {entry.contributions.length === 0 ? (
                              <span className="text-muted-foreground">No linked payroll lines</span>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  className="font-bold text-primary hover:underline"
                                  onClick={() => setOpenLineKey((current) => (current === entry.key ? "" : entry.key))}
                                  aria-expanded={openLineKey === entry.key}
                                >
                                  {entry.contributions.length} payroll line{entry.contributions.length === 1 ? "" : "s"}
                                </button>
                                {openLineKey === entry.key ? (
                                  <ul className="mt-2 space-y-1">
                                    {entry.contributions.map((item) => (
                                      <li key={item.payrollLineId} className="flex justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-2 py-1">
                                        <span className="min-w-0 break-words text-foreground">{item.employeeName ?? item.employeeCode ?? item.employeeId}</span>
                                        <span className="shrink-0 tabular-nums text-muted-foreground">{money(item.amountMinor)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td className="px-3 py-2 text-xs font-bold text-foreground" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-foreground">{money(block.totalDebitMinor)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-foreground">{money(block.totalCreditMinor)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}
