"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BadgeIndianRupee, FileText, Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workforcePolicyDefaults } from "@/lib/workforce-policy";
import { SectionHeading, StateBlock, StatusPill, StatTile, Surface } from "../page-primitives";
import { asRecord, currencyLabel, dateLabel, listFromEnvelope, num, str, useLive } from "../workforce/records";

/**
 * Gross-to-net, the payslip vault and earned-wage access for one employee and period.
 *
 * Every figure on this tab is a stored figure:
 *  - the breakdown is `payroll_lines`, read through `GET /api/v1/payslips/:id`
 *    (`getPayslipDetail` -> `buildPayslipLines`). Each row is one pay component
 *    with its own persisted amount; nothing is derived on the client;
 *  - the net is the payslip's own stored net. When the component lines do not add
 *    up to it the difference is PRINTED, never absorbed — a silent reconciliation
 *    would hide exactly the defect this screen exists to catch;
 *  - the vault's disbursed date is the release timestamp of the disbursement batch
 *    covering the payslip's run (`GET /api/v1/disbursements`). A payslip whose run
 *    has no released batch says so;
 *  - the compliance pack is the statutory filing register (`GET /api/v1/statutory-register`)
 *    narrowed to the selected period.
 *
 * Money arrives in minor units and is rendered only through `currencyLabel`.
 */

type PayslipRow = {
  id: string;
  displayCode: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  period: string;
  periodLabel: string;
  runId: string;
  runDisplayCode: string;
  scopeLabel: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: string;
  generatedAt: string;
};

type LineRow = { code: string; label: string; kind: string; amountMinor: number };

type Breakdown = {
  earnings: LineRow[];
  deductions: LineRow[];
  informational: LineRow[];
  earningsMinor: number;
  deductionsMinor: number;
  netMinor: number;
};

type ReleasedBatch = { runId: string; releasedAt: string; valueDate: string; fileReference: string };

type ComplianceRow = { id: string; formCode: string; stateCode: string; period: string; status: string; dueDate: string; band: string };

type EarnedWagePosition = {
  maxEarnedPercent: number;
  earnedToDateMinor: number | null;
  ceilingMinor: number | null;
  unavailableReason: string | null;
  advancesYtd: number;
  annualCap: number | null;
};

/** The single object an `ok()` envelope carries, without the collection unwrapping. */
function envelopeData(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload).data);
}

function toPayslipRow(row: Record<string, unknown>): PayslipRow {
  return {
    id: str(row.id),
    displayCode: str(row.displayCode, str(row.id).slice(0, 8)),
    employeeId: str(row.employeeId),
    employeeCode: str(row.employeeCode, "—"),
    employeeName: str(row.employeeName, "Unnamed employee"),
    period: str(row.period),
    periodLabel: str(row.periodLabel, str(row.period)),
    runId: str(row.runId),
    runDisplayCode: str(row.runDisplayCode, "—"),
    scopeLabel: str(row.scopeLabel, str(row.scope, "—")),
    currency: str(row.currency, "INR"),
    grossMinor: num(row.grossMinor),
    deductionsMinor: num(row.deductionsMinor),
    netMinor: num(row.netMinor),
    state: str(row.state, "generated"),
    generatedAt: str(row.generatedAt),
  };
}

function toLineRows(value: unknown): LineRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const line = asRecord(entry);
    return {
      code: str(line.code, "—"),
      label: str(line.label, str(line.code, "—")),
      kind: str(line.kind, "earning"),
      amountMinor: num(line.amountMinor),
    };
  });
}

function payslipStateTone(state: string): "success" | "warning" | "info" | "neutral" {
  if (state === "published" || state === "viewed") return "success";
  if (state === "generated") return "warning";
  if (state === "archived") return "neutral";
  return "info";
}

function bandTone(band: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (band === "overdue") return "danger";
  if (band === "due_soon") return "warning";
  if (band === "filed") return "success";
  if (band === "scheduled") return "info";
  return "neutral";
}

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

/** A money cell: right-aligned, monospaced, tabular, so columns of figures line up. */
function Amount({ minor, currency }: { minor: number; currency: string }) {
  // `-0` would render as "-₹0"; normalise it so a zero line never reads as a negative.
  const safe = minor === 0 ? 0 : minor;
  return <span className="font-mono text-[13px] tabular-nums text-foreground">{currencyLabel(safe, currency)}</span>;
}

export function GrossToNetTab() {
  const runsState = useLive("/api/v1/payroll-runs?page=1&pageSize=100");
  const periods = useMemo(() => {
    const seen = new Set<string>();
    for (const run of listFromEnvelope(runsState.data)) {
      const period = str(run.period);
      if (period) seen.add(period);
    }
    return [...seen].sort().reverse();
  }, [runsState.data]);

  // The selections are derived, not synchronised: an explicit choice wins while it
  // is still valid, otherwise the first available row does. Nothing has to be
  // written back when the underlying list changes.
  const [periodChoice, setPeriodChoice] = useState("");
  const period = periods.includes(periodChoice) ? periodChoice : (periods[0] ?? "");

  const payslipsState = useLive(period ? `/api/v1/payslips?period=${encodeURIComponent(period)}&page=1&pageSize=100` : "");
  const payslips = useMemo(() => listFromEnvelope(payslipsState.data).map(toPayslipRow).filter((row) => row.id), [payslipsState.data]);

  const [payslipChoice, setPayslipChoice] = useState("");
  const selectedId = payslips.some((row) => row.id === payslipChoice) ? payslipChoice : (payslips[0]?.id ?? "");

  const detailState = useLive(selectedId ? `/api/v1/payslips/${selectedId}` : "");
  const detail = useMemo(() => (selectedId ? envelopeData(detailState.data) : {}), [detailState.data, selectedId]);
  const selected = payslips.find((row) => row.id === selectedId) ?? null;

  const breakdown: Breakdown | null = useMemo(() => {
    const lines = asRecord(detail.lines);
    if (Object.keys(lines).length === 0) return null;
    return {
      earnings: toLineRows(lines.earnings),
      deductions: toLineRows(lines.deductions),
      informational: toLineRows(lines.informational),
      earningsMinor: num(lines.earningsMinor),
      deductionsMinor: num(lines.deductionsMinor),
      netMinor: num(lines.netMinor),
    };
  }, [detail]);

  const storedNetMinor = num(detail.netMinor, selected?.netMinor ?? 0);
  const storedGrossMinor = num(detail.grossMinor, selected?.grossMinor ?? 0);
  const currency = str(detail.currency, selected?.currency ?? "INR");
  const netDifferenceMinor = breakdown ? breakdown.netMinor - storedNetMinor : 0;
  const grossDifferenceMinor = breakdown ? breakdown.earningsMinor - storedGrossMinor : 0;

  // Disbursed dates: the released batch that covers each payslip's run.
  const batchesState = useLive("/api/v1/disbursements?page=1&pageSize=100");
  const releasedByRun = useMemo(() => {
    const index = new Map<string, ReleasedBatch>();
    for (const row of listFromEnvelope(batchesState.data)) {
      if (str(row.state) !== "released") continue;
      const runId = str(row.payrollRunId);
      if (!runId || index.has(runId)) continue;
      index.set(runId, {
        runId,
        releasedAt: str(row.releasedAt),
        valueDate: str(row.valueDate),
        fileReference: str(row.fileReference, "—"),
      });
    }
    return index;
  }, [batchesState.data]);

  // Statutory compliance pack. A real register endpoint backs this; when the
  // caller may not read it the card says so instead of showing a blank pack.
  const complianceState = useLive("/api/v1/statutory-register");
  const compliance: ComplianceRow[] = useMemo(() => {
    const items = envelopeData(complianceState.data).items;
    if (!Array.isArray(items)) return [];
    return items
      .map((entry) => {
        const row = asRecord(entry);
        return {
          id: str(row.id),
          formCode: str(row.formCode, "—"),
          stateCode: str(row.stateCode, "—"),
          period: str(row.period),
          status: str(row.status, "unknown"),
          dueDate: str(row.dueDate),
          band: str(row.band, "unknown"),
        };
      })
      .filter((row) => row.id && (!period || row.period === period));
  }, [complianceState.data, period]);

  const earnedWageState = useLive(selected?.employeeId ? `/api/v1/earned-wage-access?employeeId=${selected.employeeId}` : "");
  const earnedWage: EarnedWagePosition | null = useMemo(() => {
    const data = envelopeData(earnedWageState.data);
    if (!data.employeeId) return null;
    return {
      maxEarnedPercent: num(data.maxEarnedPercent, workforcePolicyDefaults.earnedWage.maxEarnedPercent),
      earnedToDateMinor: typeof data.earnedToDateMinor === "number" ? data.earnedToDateMinor : null,
      ceilingMinor: typeof data.ceilingMinor === "number" ? data.ceilingMinor : null,
      unavailableReason: typeof data.unavailableReason === "string" ? data.unavailableReason : null,
      advancesYtd: num(data.advancesYtd),
      annualCap: typeof data.annualCap === "number" ? data.annualCap : null,
    };
  }, [earnedWageState.data]);

  const vaultRows = useMemo(() => payslips.filter((row) => row.state === "published" || row.state === "viewed" || row.state === "archived"), [payslips]);

  if (runsState.error) {
    return (
      <Surface>
        <StateBlock tone="error" icon={AlertTriangle} title="Payroll runs could not be loaded" description={runsState.error} />
      </Surface>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ---------------------------------------------------------------- selectors */}
      <Surface>
        <SectionHeading
          title="Gross to net"
          description="Every row below is one stored pay component on the selected payslip. Source: payroll_lines, through the payslip detail endpoint."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[12px] text-muted-foreground">Period</span>
            <select
              value={period}
              onChange={(event) => setPeriodChoice(event.target.value)}
              className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {periods.length === 0 && <option value="">No payroll periods yet</option>}
              {periods.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[12px] text-muted-foreground">Employee payslip</span>
            <select
              value={selectedId}
              onChange={(event) => setPayslipChoice(event.target.value)}
              className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {payslips.length === 0 && <option value="">No payslips in this period</option>}
              {payslips.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.employeeCode} · {row.employeeName} · {row.scopeLabel}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Surface>

      {/* ---------------------------------------------------------------- KPIs */}
      {selected && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Gross earnings (stored)" value={currencyLabel(storedGrossMinor, currency)} icon={BadgeIndianRupee} tone="info" hint={selected.periodLabel} />
          <StatTile label="Deductions (stored)" value={currencyLabel(num(detail.deductionsMinor, selected.deductionsMinor), currency)} icon={Wallet} tone="warning" hint={selected.runDisplayCode} />
          <StatTile label="Net pay (stored)" value={currencyLabel(storedNetMinor, currency)} icon={Landmark} tone="primary" hint="The payslip's own stored net" />
          <StatTile
            label="Component lines"
            value={breakdown ? String(breakdown.earnings.length + breakdown.deductions.length + breakdown.informational.length) : "—"}
            icon={FileText}
            tone="neutral"
            hint={breakdown ? `${breakdown.earnings.length} earning · ${breakdown.deductions.length} deduction` : "Loading"}
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- breakdown */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title={selected ? `${selected.employeeName} · ${selected.periodLabel} · ${selected.displayCode}` : "Earnings to net"}
            description={selected ? `Run ${selected.runDisplayCode} (${selected.scopeLabel}).` : undefined}
            action={selected ? <StatusPill tone={payslipStateTone(selected.state)} dot>{humanise(selected.state)}</StatusPill> : undefined}
          />
        </div>

        {!selectedId && <StateBlock title="No payslip selected" description="Choose a period with generated payslips to see its earnings-to-net breakdown." />}
        {selectedId && detailState.error && <StateBlock tone="error" icon={AlertTriangle} title="This payslip could not be loaded" description={detailState.error} />}
        {selectedId && !detailState.error && !breakdown && <StateBlock tone="loading" title="Loading the component lines…" />}

        {breakdown && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ minWidth: 560 }}>
                <caption className="sr-only">Gross-to-net component breakdown for the selected payslip</caption>
                <thead>
                  <tr className="text-[11px] text-muted-foreground">
                    <th scope="col" className="px-3 py-3 pl-5 font-medium">
                      Component
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Code
                    </th>
                    <th scope="col" className="px-3 py-3 pr-5 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-secondary/50">
                    <th scope="colgroup" colSpan={3} className="px-3 py-2 pl-5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground">
                      EARNINGS
                    </th>
                  </tr>
                  {breakdown.earnings.length === 0 && (
                    <tr className="border-t border-border">
                      <td colSpan={3} className="px-3 py-3 pl-5 text-muted-foreground">
                        No earning lines are stored on this payslip.
                      </td>
                    </tr>
                  )}
                  {breakdown.earnings.map((line) => (
                    <tr key={`earning-${line.code}`} className="border-t border-border">
                      <td className="px-3 py-3 pl-5 text-foreground">{line.label}</td>
                      <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{line.code}</td>
                      <td className="px-3 py-3 pr-5 text-right">
                        <Amount minor={line.amountMinor} currency={currency} />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-3 pl-5 text-foreground" colSpan={2}>
                      Total earnings
                    </td>
                    <td className="px-3 py-3 pr-5 text-right">
                      <Amount minor={breakdown.earningsMinor} currency={currency} />
                    </td>
                  </tr>

                  <tr className="border-t border-border bg-secondary/50">
                    <th scope="colgroup" colSpan={3} className="px-3 py-2 pl-5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground">
                      DEDUCTIONS
                    </th>
                  </tr>
                  {breakdown.deductions.length === 0 && (
                    <tr className="border-t border-border">
                      <td colSpan={3} className="px-3 py-3 pl-5 text-muted-foreground">
                        No deduction lines are stored on this payslip.
                      </td>
                    </tr>
                  )}
                  {breakdown.deductions.map((line) => (
                    <tr key={`deduction-${line.code}`} className="border-t border-border">
                      <td className="px-3 py-3 pl-5 text-foreground">{line.label}</td>
                      <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">{line.code}</td>
                      <td className="px-3 py-3 pr-5 text-right">
                        <Amount minor={-line.amountMinor} currency={currency} />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-3 pl-5 text-foreground" colSpan={2}>
                      Total deductions
                    </td>
                    <td className="px-3 py-3 pr-5 text-right">
                      <Amount minor={-breakdown.deductionsMinor} currency={currency} />
                    </td>
                  </tr>

                  <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                    <td className="px-3 py-3 pl-5 text-foreground" colSpan={2}>
                      Net of the component lines
                    </td>
                    <td className="px-3 py-3 pr-5 text-right">
                      <Amount minor={breakdown.netMinor} currency={currency} />
                    </td>
                  </tr>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-3 pl-5 text-foreground" colSpan={2}>
                      Net pay stored on the payslip
                    </td>
                    <td className="px-3 py-3 pr-5 text-right">
                      <Amount minor={storedNetMinor} currency={currency} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {(netDifferenceMinor !== 0 || grossDifferenceMinor !== 0) && (
              <div className="m-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-semibold text-destructive">Discrepancy — the component lines do not reconcile to the stored totals</p>
                    <ul className="mt-2 space-y-1 text-[13px] text-foreground">
                      {netDifferenceMinor !== 0 && (
                        <li>
                          Net: lines total <span className="font-mono tabular-nums">{currencyLabel(breakdown.netMinor, currency)}</span> against a stored net of{" "}
                          <span className="font-mono tabular-nums">{currencyLabel(storedNetMinor, currency)}</span> — a difference of{" "}
                          <span className="font-mono font-semibold tabular-nums">{currencyLabel(netDifferenceMinor, currency)}</span>.
                        </li>
                      )}
                      {grossDifferenceMinor !== 0 && (
                        <li>
                          Gross: earning lines total <span className="font-mono tabular-nums">{currencyLabel(breakdown.earningsMinor, currency)}</span> against a stored gross of{" "}
                          <span className="font-mono tabular-nums">{currencyLabel(storedGrossMinor, currency)}</span> — a difference of{" "}
                          <span className="font-mono font-semibold tabular-nums">{currencyLabel(grossDifferenceMinor, currency)}</span>.
                        </li>
                      )}
                    </ul>
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      Neither figure has been adjusted. Informational lines (employer contributions and print-only rows) are never netted and are listed separately below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {breakdown.informational.length > 0 && (
              <div className="border-t border-border p-5">
                <p className="text-[12px] font-semibold text-muted-foreground">INFORMATIONAL — shown, never netted</p>
                <ul className="mt-2 space-y-1.5">
                  {breakdown.informational.map((line) => (
                    <li key={`info-${line.code}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-foreground">
                        {line.label} <span className="font-mono text-[11px] text-muted-foreground">{line.code}</span>
                      </span>
                      <Amount minor={line.amountMinor} currency={currency} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.traceRecorded === false && (
              <p className="border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
                No per-line calculation trace is stored for this payslip, so no drill-down is offered. The engine has not written `payroll_calculations` rows.
              </p>
            )}
          </>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- earned wage access */}
      <Surface>
        <SectionHeading
          title="Earned wage access"
          description={`Policy: a draw may not exceed ${workforcePolicyDefaults.earnedWage.maxEarnedPercent}% of wage earned to date (workforcePolicy.earnedWage.maxEarnedPercent, tenant-overridable). The ceiling is applied by the server before any draw is filed.`}
        />
        {!selected && <StateBlock title="No employee selected" description="Pick a payslip above to see that employee's earned-wage position." />}
        {selected && earnedWageState.error && (
          <StateBlock tone="error" icon={AlertTriangle} title="The earned-wage position could not be read" description={earnedWageState.error} />
        )}
        {selected && !earnedWageState.error && !earnedWage && <StateBlock tone="loading" title="Reading the earned-wage position…" />}
        {earnedWage && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Wage earned to date"
              value={earnedWage.earnedToDateMinor === null ? "Not available" : currencyLabel(earnedWage.earnedToDateMinor, currency)}
              tone="info"
              hint={earnedWage.earnedToDateMinor === null ? "No approved proration basis" : "Locked attendance days only"}
            />
            <StatTile
              label={`Drawable ceiling (${earnedWage.maxEarnedPercent}%)`}
              value={earnedWage.ceilingMinor === null ? "Not computable" : currencyLabel(earnedWage.ceilingMinor, currency)}
              tone={earnedWage.ceilingMinor === null ? "warning" : "primary"}
              hint="Enforced server-side on POST /api/v1/earned-wage-access"
            />
            <StatTile label="Draws taken this year" value={String(earnedWage.advancesYtd)} tone="neutral" hint={earnedWage.annualCap === null ? "No annual cap configured" : `Annual cap ${earnedWage.annualCap}`} />
            <StatTile label="Recovery" value="Next open run" tone="neutral" hint="Filed as advance_paid + advance_recovery payroll inputs" />
          </div>
        )}
        {earnedWage?.unavailableReason && (
          <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-[13px] text-foreground" role="status">
            <span className="font-semibold">Draws are refused. </span>
            {earnedWage.unavailableReason}
          </p>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- payslip vault */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Payslip vault"
            description="Released payslips for the selected period, with the release date of the disbursement batch covering their run."
          />
        </div>
        {payslipsState.error && <StateBlock tone="error" icon={AlertTriangle} title="Payslips could not be loaded" description={payslipsState.error} />}
        {!payslipsState.error && vaultRows.length === 0 && (
          <StateBlock title="No released payslips" description="Payslips appear here once they are published to employees. Generated-only payslips are not shown." />
        )}
        {vaultRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 760 }}>
              <caption className="sr-only">Released payslips and their disbursement dates</caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="px-3 py-3 pl-5 font-medium">Payslip</th>
                  <th scope="col" className="px-3 py-3 font-medium">Employee</th>
                  <th scope="col" className="px-3 py-3 font-medium">Run</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Net pay</th>
                  <th scope="col" className="px-3 py-3 font-medium">State</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Disbursed</th>
                </tr>
              </thead>
              <tbody>
                {vaultRows.map((row) => {
                  const batch = releasedByRun.get(row.runId) ?? null;
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground">{row.displayCode}</td>
                      <td className="px-3 py-3">
                        <span className="text-foreground">{row.employeeName}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{row.employeeCode}</span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <span className="font-mono text-[12px]">{row.runDisplayCode}</span>
                        <span className="ml-1.5">{row.scopeLabel}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Amount minor={row.netMinor} currency={row.currency} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={payslipStateTone(row.state)} dot>
                          {humanise(row.state)}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-3 pr-5">
                        {batch ? (
                          <span className="text-foreground">
                            {dateLabel(batch.releasedAt || batch.valueDate)}
                            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{batch.fileReference}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not disbursed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- compliance pack */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Statutory compliance pack"
            description={`Filing register for ${period || "the selected period"}. Source: the statutory filing register; this screen never contacts an authority.`}
            action={complianceState.error ? undefined : <Button variant="outline" size="sm" onClick={complianceState.refresh}>Refresh</Button>}
          />
        </div>
        {complianceState.error && (
          <StateBlock
            tone="error"
            icon={AlertTriangle}
            title="The statutory register is not readable from this account"
            description={complianceState.error}
          />
        )}
        {!complianceState.error && compliance.length === 0 && (
          <StateBlock title="No filings recorded for this period" description="Nothing is inferred: a filing appears here only once it exists in the register." />
        )}
        {compliance.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 640 }}>
              <caption className="sr-only">Statutory filings for the selected period</caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="px-3 py-3 pl-5 font-medium">Form</th>
                  <th scope="col" className="px-3 py-3 font-medium">State</th>
                  <th scope="col" className="px-3 py-3 font-medium">Due</th>
                  <th scope="col" className="px-3 py-3 font-medium">Workflow status</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Standing</th>
                </tr>
              </thead>
              <tbody>
                {compliance.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground">{row.formCode}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.stateCode}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.dueDate ? dateLabel(row.dueDate) : "No due date"}</td>
                    <td className="px-3 py-3 text-foreground">{humanise(row.status)}</td>
                    <td className="px-3 py-3 pr-5">
                      <StatusPill tone={bandTone(row.band)} dot>
                        {humanise(row.band)}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
