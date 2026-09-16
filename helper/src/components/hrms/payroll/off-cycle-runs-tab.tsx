"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Layers, ListChecks, Repeat, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { picklists } from "@/lib/picklists";
import { cn } from "@/lib/utils";
import { SectionHeading, StateBlock, StatusPill, StatTile, Surface } from "../page-primitives";
import { asRecord, currencyLabel, dateLabel, listFromEnvelope, num, str, useLive } from "../workforce/records";

/**
 * Off-cycle payroll runs and the disbursement batch ledger.
 *
 * Run types are the platform's own, not a specification's. `payroll_runs.scope` is
 * the stored column; `PL_RUN_TYPE` is the vocabulary the create-run form offers,
 * and `RUN_TYPE_TO_SCOPE` in `src/server/payroll/service.ts` maps between them.
 * That module is `server-only`, so the two entries whose spellings differ are
 * restated here and nowhere else on the client; every other run type is the same
 * word in both vocabularies. `correction` is a scope with NO run type: corrections
 * are produced by `correctRun`, never by drafting a run, so it can appear in the
 * ledger but is never offered as a run type.
 *
 * Batch rows are `disbursement_batches` through `GET /api/v1/disbursements`. Money
 * is in minor units throughout and is rendered only through `currencyLabel`.
 */

/** Mirrors `RUN_TYPE_TO_SCOPE` (src/server/payroll/service.ts). Keep the two in step. */
const RUN_TYPE_TO_SCOPE: Record<string, string> = {
  regular: "regular",
  off_cycle_overtime: "ot",
  arrears: "arrears",
  full_and_final: "full_final",
  bonus: "bonus",
  reimbursement: "reimbursement",
};

/** Mirrors `RUN_SCOPE_LABELS` (src/server/payroll/service.ts), including the run-type-less `correction`. */
const SCOPE_LABELS: Record<string, string> = {
  regular: "Regular",
  ot: "Off-cycle overtime",
  arrears: "Arrears",
  full_final: "Full and final",
  bonus: "Bonus",
  reimbursement: "Reimbursement",
  correction: "Correction",
};

/** Every scope a run row can carry, in ledger order. */
const ALL_SCOPES = ["regular", "ot", "arrears", "full_final", "bonus", "reimbursement", "correction"];

/** Everything except the ordinary monthly run — what this tab is for. */
const OFF_CYCLE_SCOPES = ALL_SCOPES.filter((scope) => scope !== "regular");

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

type RunRow = {
  id: string;
  period: string;
  scope: string;
  status: string;
  employeeCount: number;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  currency: string;
  finalizedAt: string;
};

type BatchRow = {
  id: string;
  payrollRunId: string;
  runPeriod: string;
  runScope: string;
  state: string;
  format: string;
  fileName: string;
  fileReference: string;
  valueDate: string;
  currency: string;
  totalAmountMinor: number;
  accountCount: number;
  excludedCount: number;
  releasedAt: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Mirrors `formatPeriodLabel` (src/server/payroll/service.ts). */
function periodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Mirrors `displayRunCode` (src/server/payroll/service.ts): PR-YYYY-MM-XXXX. */
function runCode(period: string, id: string): string {
  const suffix = (id.replace(/-/g, "").slice(0, 4) || "0000").toUpperCase();
  return `PR-${period}-${suffix}`;
}

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function runStatusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "paid" || status === "closed") return "success";
  if (status === "finalized" || status === "approved") return "info";
  if (status === "failed") return "danger";
  if (status === "draft") return "neutral";
  return "warning";
}

function batchStateTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "released") return "success";
  if (state === "verified") return "info";
  if (state === "failed") return "danger";
  if (state === "superseded") return "neutral";
  return "warning";
}

export function OffCycleRunsTab() {
  const runsState = useLive("/api/v1/payroll-runs?page=1&pageSize=100");
  const runs: RunRow[] = useMemo(
    () =>
      listFromEnvelope(runsState.data)
        .map((row) => ({
          id: str(row.id),
          period: str(row.period),
          scope: str(row.scope, "regular"),
          status: str(row.status, "draft"),
          employeeCount: num(row.employee_count, num(row.employeeCount)),
          grossMinor: num(row.gross_minor, num(row.grossMinor)),
          deductionsMinor: num(row.deductions_minor, num(row.deductionsMinor)),
          netMinor: num(row.net_minor, num(row.netMinor)),
          currency: str(row.currency, "INR"),
          finalizedAt: str(row.finalized_at, str(row.finalizedAt)),
        }))
        .filter((row) => row.id),
    [runsState.data],
  );

  const [showRegular, setShowRegular] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("");

  const scopesInUse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of runs) counts.set(run.scope, (counts.get(run.scope) ?? 0) + 1);
    return counts;
  }, [runs]);

  const visibleRuns = useMemo(
    () =>
      runs.filter((run) => {
        if (scopeFilter) return run.scope === scopeFilter;
        return showRegular || run.scope !== "regular";
      }),
    [runs, scopeFilter, showRegular],
  );

  const offCycleRuns = useMemo(() => runs.filter((run) => run.scope !== "regular"), [runs]);
  const offCycleNetMinor = offCycleRuns.reduce((total, run) => total + run.netMinor, 0);
  const offCycleHeadcount = offCycleRuns.reduce((total, run) => total + run.employeeCount, 0);
  const runCurrency = runs[0]?.currency ?? "INR";

  const batchesState = useLive("/api/v1/disbursements?page=1&pageSize=100");
  const batches: BatchRow[] = useMemo(
    () =>
      listFromEnvelope(batchesState.data)
        .map((row) => ({
          id: str(row.id),
          payrollRunId: str(row.payrollRunId),
          runPeriod: str(row.runPeriod),
          runScope: str(row.runScope),
          state: str(row.state, "prepared"),
          format: str(row.format, "—"),
          fileName: str(row.fileName),
          fileReference: str(row.fileReference),
          valueDate: str(row.valueDate),
          currency: str(row.currency, "INR"),
          totalAmountMinor: num(row.totalAmountMinor),
          accountCount: num(row.accountCount),
          excludedCount: num(row.excludedCount),
          releasedAt: str(row.releasedAt),
        }))
        .filter((row) => row.id),
    [batchesState.data],
  );

  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");

  /**
   * The only bank file a browser may receive: the MASKED control copy that
   * `getBatch` composes. The bank-ready file carries real account numbers and is
   * built at release time on the server; it never travels here, so no control on
   * this screen offers it.
   */
  async function downloadControlCopy(batch: BatchRow) {
    setDownloading(batch.id);
    setDownloadError("");
    try {
      const response = await fetch(`/api/v1/disbursements/${batch.id}`, { cache: "no-store" });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        setDownloadError(str(asRecord(payload.error).message, `The control copy could not be read (${response.status}).`));
        return;
      }
      const file = asRecord(asRecord(payload.data).file);
      const content = str(file.content);
      if (!content) {
        setDownloadError("This batch stores no bank file content.");
        return;
      }
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = str(file.name, batch.fileName || `${batch.id}.txt`);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Could not reach the server.");
    } finally {
      setDownloading("");
    }
  }

  if (runsState.error) {
    return (
      <Surface>
        <StateBlock tone="error" icon={AlertTriangle} title="Payroll runs could not be loaded" description={runsState.error} />
      </Surface>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ---------------------------------------------------------------- what this platform supports */}
      <Surface>
        <SectionHeading
          title="Run types this platform supports"
          description="Read from the create-run vocabulary (PL_RUN_TYPE) and the stored run scopes, not from a specification. A run type not listed here cannot be drafted."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth: 560 }}>
            <caption className="sr-only">Supported payroll run types and their stored scopes</caption>
            <thead>
              <tr className="text-[11px] text-muted-foreground">
                <th scope="col" className="px-3 py-3 pl-0 font-medium">Run type (form)</th>
                <th scope="col" className="px-3 py-3 font-medium">Stored scope</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Runs on record</th>
              </tr>
            </thead>
            <tbody>
              {picklists.PL_RUN_TYPE.values.map((option) => {
                const scope = RUN_TYPE_TO_SCOPE[option.value] ?? option.value;
                return (
                  <tr key={option.value} className="border-t border-border">
                    <td className="px-3 py-3 pl-0 text-foreground">{option.label}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{scope}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{scopesInUse.get(scope) ?? 0}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border">
                <td className="px-3 py-3 pl-0 text-muted-foreground">
                  Correction <span className="text-[12px]">— no run type; produced by correcting a finalized run</span>
                </td>
                <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">correction</td>
                <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{scopesInUse.get("correction") ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-[19px] text-muted-foreground">
          All four run types the specification names — Regular, Off-Cycle OT, Retro Arrears and F&amp;F — exist here as the scopes{" "}
          <span className="font-mono">regular</span>, <span className="font-mono">ot</span>, <span className="font-mono">arrears</span> and{" "}
          <span className="font-mono">full_final</span>. The platform additionally supports <span className="font-mono">bonus</span> and{" "}
          <span className="font-mono">reimbursement</span> runs, which the specification does not name, and carries a{" "}
          <span className="font-mono">correction</span> scope that has no run type at all. Nothing on the specification&apos;s list is missing.
        </p>
      </Surface>

      {/* ---------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Off-cycle runs" value={String(offCycleRuns.length)} icon={Repeat} tone="primary" hint={`${runs.length} runs in total`} />
        <StatTile label="Employees in off-cycle runs" value={String(offCycleHeadcount)} icon={ListChecks} tone="info" hint="Summed across every non-regular run" />
        <StatTile label="Off-cycle net pay" value={currencyLabel(offCycleNetMinor, runCurrency)} icon={Wallet} tone="neutral" hint="Stored run totals" />
        <StatTile label="Disbursement batches" value={String(batches.length)} icon={Layers} tone="neutral" hint={`${batches.filter((batch) => batch.state === "released").length} released`} />
      </div>

      {/* ---------------------------------------------------------------- run ledger */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Run ledger"
            description="Stored run totals. A draft run shows zeros because nothing has been calculated against it yet."
            action={
              <Button variant="outline" size="sm" onClick={() => setShowRegular((current) => !current)} disabled={Boolean(scopeFilter)}>
                {showRegular ? "Hide regular runs" : "Include regular runs"}
              </Button>
            }
          />
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setScopeFilter("")}
              aria-pressed={scopeFilter === ""}
              className={cn(
                "inline-flex h-10 items-center rounded-lg border px-3 text-[13px] font-semibold transition-colors duration-150",
                scopeFilter === "" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {showRegular ? "All scopes" : "All off-cycle"}
            </button>
            {OFF_CYCLE_SCOPES.map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setScopeFilter((current) => (current === scope ? "" : scope))}
                aria-pressed={scopeFilter === scope}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors duration-150",
                  scopeFilter === scope ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {scopeLabel(scope)}
                <span className="font-mono text-[11px] tabular-nums">{scopesInUse.get(scope) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleRuns.length === 0 ? (
          <StateBlock
            title="No runs match this filter"
            description={scopeFilter ? `No ${scopeLabel(scopeFilter).toLowerCase()} run exists yet.` : "No off-cycle run has been drafted. Include regular runs to see the monthly cycle."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 900 }}>
              <caption className="sr-only">Payroll runs with their stored totals</caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="px-3 py-3 pl-5 font-medium">Run</th>
                  <th scope="col" className="px-3 py-3 font-medium">Type</th>
                  <th scope="col" className="px-3 py-3 font-medium">Period</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Employees</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Gross</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Deductions</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Net</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Finalized</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground">{runCode(run.period, run.id)}</td>
                    <td className="px-3 py-3 text-foreground">{scopeLabel(run.scope)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{periodLabel(run.period)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{run.employeeCount}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{currencyLabel(run.grossMinor, run.currency)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{currencyLabel(run.deductionsMinor, run.currency)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">{currencyLabel(run.netMinor, run.currency)}</td>
                    <td className="px-3 py-3">
                      <StatusPill tone={runStatusTone(run.status)} dot>
                        {humanise(run.status)}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-3 pr-5 text-muted-foreground">{run.finalizedAt ? dateLabel(run.finalizedAt) : "Not finalized"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- batch ledger */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Disbursement batch ledger"
            description="One row per prepared batch, with the bank file reference stored against it."
            action={<Button variant="outline" size="sm" onClick={batchesState.refresh}>Refresh</Button>}
          />
        </div>

        {downloadError && (
          <p className="mx-5 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive" role="alert">
            {downloadError}
          </p>
        )}

        {batchesState.error && <StateBlock tone="error" icon={AlertTriangle} title="Batches could not be loaded" description={batchesState.error} />}
        {!batchesState.error && batches.length === 0 && (
          <StateBlock title="No disbursement batch prepared" description="A batch appears here once a finalized run has one prepared against it." />
        )}

        {batches.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ minWidth: 1000 }}>
                <caption className="sr-only">Disbursement batches with their totals, status and bank file reference</caption>
                <thead>
                  <tr className="text-[11px] text-muted-foreground">
                    <th scope="col" className="px-3 py-3 pl-5 font-medium">Batch</th>
                    <th scope="col" className="px-3 py-3 font-medium">Run type</th>
                    <th scope="col" className="px-3 py-3 font-medium">Period</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Employees</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Disbursed total</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-3 py-3 font-medium">Bank file reference</th>
                    <th scope="col" className="px-3 py-3 pr-5 font-medium">Control copy</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-t border-border">
                      <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground" title={batch.id}>
                        {batch.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 text-foreground">{batch.runScope ? scopeLabel(batch.runScope) : "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{periodLabel(batch.runPeriod)}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
                        {batch.accountCount}
                        {batch.excludedCount > 0 && <span className="ml-1 text-[11px] text-muted-foreground">+{batch.excludedCount} excluded</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                        {currencyLabel(batch.totalAmountMinor, batch.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={batchStateTone(batch.state)} dot>
                          {humanise(batch.state)}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-3">
                        {batch.fileReference ? (
                          <span className="font-mono text-[12px] text-foreground">{batch.fileReference}</span>
                        ) : (
                          <span className="text-muted-foreground">Not stored</span>
                        )}
                      </td>
                      <td className="px-3 py-3 pr-5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadControlCopy(batch)}
                          disabled={downloading === batch.id}
                          aria-label={`Download the masked control copy of batch ${batch.id.slice(0, 8)}`}
                        >
                          <Download aria-hidden />
                          {downloading === batch.id ? "Reading…" : "Masked copy"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-5 py-3 text-[12px] leading-[19px] text-muted-foreground">
              &ldquo;Masked copy&rdquo; downloads the control file the batch endpoint composes: the same layout the bank receives with every account number masked to
              its last four characters. The bank-ready file is built from the encrypted dossier at release time and is never sent to a browser, so no control here
              offers it.
            </p>
          </>
        )}
      </Surface>
    </div>
  );
}
