"use client";

/**
 * S5 — Payroll Control Room.
 *
 * Reads `/api/v1/cockpits/payroll-control-room`, which returns every panel as an
 * availability envelope. A panel whose feed did not resolve renders the reason
 * it gave; nothing on this screen falls back to a placeholder figure, because a
 * wrong payroll number is worse than a missing one (DESIGN_SYSTEM.md section 9).
 *
 * Money arrives in minor units and is printed with `currencyLabel`. The charts
 * plot the major unit (`minor / 100`) because a paise axis is unreadable; every
 * figure stated as text beside them is the exact stored amount.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CircleCheck,
  ExternalLink,
  Landmark,
  RefreshCcw,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { chartSeriesColor, WaterfallBridge, type WaterfallItem } from "@/components/hrms/cockpit-charts";
import {
  DataTable,
  PageIntro,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
  type Column,
} from "@/components/hrms/page-primitives";
import { currencyLabel, useLive } from "@/components/hrms/workforce/records";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Wire contract                                                              */
/* -------------------------------------------------------------------------- */

type Feed<T> = { value: T; available: boolean; message?: string; origin?: string };

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

type PeriodOption = {
  runId: string;
  period: string;
  periodLabel: string;
  scope: string;
  scopeLabel: string;
  status: string;
  displayCode: string;
  grossMinor: number | null;
  netMinor: number | null;
  currency: string;
  employeeCount: number | null;
};

type BridgeBar = { label: string; amountMinor: number; kind: "base" | "delta" | "total" };

type VarianceView = {
  bars: BridgeBar[];
  attributed: string[];
  omitted: Array<{ category: string; reason: string }>;
  residualMinor: number;
  ties: boolean;
  priorPeriodLabel: string;
  currentPeriodLabel: string;
  currency: string;
};

type CompositionSlice = { code: string; label: string; amountMinor: number; sharePct: number | null };

type CompositionView = {
  slices: CompositionSlice[];
  componentTotalMinor: number;
  runGrossMinor: number | null;
  tiesToRunGross: boolean;
  currency: string;
};

type DepartmentCost = { department: string; amountMinor: number; employees: number };

type ExceptionRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  ruleCode: string;
  severity: string;
  status: string;
  reason: string;
  resolution: string | null;
  resolvable: boolean;
};

type RunCounts = {
  members: number;
  anomaliesOpen: number;
  anomaliesTotal: number;
  inputs: number;
  approvals: number;
  payslips: number;
};

type ControlRoom = {
  periods: PeriodOption[];
  selectedRunId: string | null;
  selected: PeriodOption | null;
  priorRunId: string | null;
  stepper: Feed<TimelineStep[]>;
  counts: Feed<RunCounts | null>;
  variance: Feed<VarianceView | null>;
  composition: Feed<CompositionView | null>;
  departments: Feed<DepartmentCost[]>;
  exceptions: Feed<ExceptionRow[]>;
  severityCounts: Feed<Array<{ label: string; value: number }>>;
  unavailableSources: Array<{ name: string; message: string }>;
};

type Envelope = { data: ControlRoom };

/* -------------------------------------------------------------------------- */
/* Local helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Minor units as the major unit, for chart axes only. Text always uses `currencyLabel`. */
function major(minor: number): number {
  return minor / 100;
}

function severityTone(severity: string): "danger" | "warning" | "info" | "neutral" {
  const key = severity.trim().toLowerCase();
  if (key === "high" || key === "critical" || key === "blocker") return "danger";
  if (key === "medium") return "warning";
  if (key === "low") return "info";
  return "neutral";
}

function exceptionStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  const key = status.trim().toLowerCase();
  if (key === "resolved") return "success";
  if (key === "open") return "warning";
  if (key === "acknowledged" || key === "overridden") return "info";
  return "neutral";
}

function runStatusTone(status: string): "success" | "info" | "neutral" {
  const key = status.trim().toLowerCase();
  if (key === "finalized" || key === "paid" || key === "closed") return "success";
  if (key === "draft") return "neutral";
  return "info";
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const RESOLUTION_STATUSES = [
  { value: "resolved", label: "Resolved — the underlying data was corrected" },
  { value: "acknowledged", label: "Acknowledged — assigned for correction" },
  { value: "overridden", label: "Waived — accepted with a recorded reason" },
] as const;

async function postResolution(id: string, status: string, resolution: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`/api/v1/payroll-anomalies/${id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey() },
      body: JSON.stringify({ status, resolution }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true, message: "The exception was recorded against this run." };
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "";
    if (response.status === 409) {
      return {
        ok: false,
        message:
          message ||
          "This exception was already decided while the console was open. Refresh to see who decided it and why.",
      };
    }
    return { ok: false, message: message || `The request could not be completed (${response.status}).` };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

const selectClass =
  "h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground";

/* -------------------------------------------------------------------------- */
/* Money-aware chart chrome                                                   */
/* -------------------------------------------------------------------------- */

type MoneyTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: string | number; payload?: { label?: string; amountMinor?: number } }>;
  label?: string | number;
  currency: string;
};

/** Prints the exact stored minor amount, never the rounded axis value. */
const MoneyTooltip = ({ active, payload, label, currency }: MoneyTooltipProps) => {
  const entry = active && payload && payload.length > 0 ? payload[payload.length - 1] : undefined;
  const minor = entry?.payload?.amountMinor;
  if (!entry || typeof minor !== "number") return null;
  return (
    <div
      className="max-w-[240px] rounded-lg border border-border p-3 shadow-[var(--shadow-overlay)]"
      style={{ background: "var(--popover)", color: "var(--popover-foreground)" }}
    >
      <p className="truncate font-mono text-xs font-semibold text-muted-foreground">
        {entry.payload?.label ?? String(label ?? "")}
      </p>
      <p className="break-words font-mono text-sm font-bold text-foreground tabular-nums">
        {currencyLabel(minor, currency)}
      </p>
    </div>
  );
};

/**
 * Cost composition as a donut. Built here rather than from `ConcentricRings`
 * because the centre must read as currency and the rings print raw counts.
 */
function CostCompositionDonut({ view }: { view: CompositionView }) {
  const data = view.slices.map((slice, index) => ({
    label: slice.label,
    amountMinor: slice.amountMinor,
    value: major(slice.amountMinor),
    fill: chartSeriesColor(index),
  }));
  const centre = view.runGrossMinor ?? view.componentTotalMinor;

  return (
    <div>
      <div
        className="relative h-[210px] min-h-[210px] w-full sm:h-[240px]"
        role="img"
        aria-label={`Cost composition: ${view.slices
          .map((slice) => `${slice.label} ${currencyLabel(slice.amountMinor, view.currency)}`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={1}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive
            >
              {data.map((slice) => (
                <Cell key={slice.label} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip currency={view.currency} />} wrapperStyle={{ outline: "none" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
          <div className="min-w-0">
            <p className="truncate font-mono text-lg font-bold tracking-tight text-foreground tabular-nums sm:text-xl">
              {currencyLabel(centre, view.currency)}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              gross for the period
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {view.slices.map((slice, index) => (
          <li key={slice.code} className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: chartSeriesColor(index) }} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{slice.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              {slice.sharePct === null ? "—" : `${slice.sharePct}%`}
            </span>
            <span className="shrink-0 font-mono text-[12px] font-bold text-foreground tabular-nums">
              {currencyLabel(slice.amountMinor, view.currency)}
            </span>
          </li>
        ))}
      </ul>
      {!view.tiesToRunGross && view.runGrossMinor !== null && (
        <p className="mt-3 text-[12px] leading-[18px] text-warning" role="status">
          The component lines total {currencyLabel(view.componentTotalMinor, view.currency)}, which differs from the gross
          of {currencyLabel(view.runGrossMinor, view.currency)} stored on the run. Recalculate the run before relying on
          the split.
        </p>
      )}
    </div>
  );
}

/** Cost per function as vertical bars, plotted in the major unit. */
function DepartmentCostBars({ rows, currency }: { rows: DepartmentCost[]; currency: string }) {
  const data = rows.map((row) => ({
    label: row.department,
    amountMinor: row.amountMinor,
    value: major(row.amountMinor),
  }));
  return (
    <div
      className="h-[260px] min-h-[260px] w-full sm:h-[300px]"
      role="img"
      aria-label={`Cost per function: ${rows
        .map((row) => `${row.department} ${currencyLabel(row.amountMinor, currency)}`)
        .join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            minTickGap={4}
            tickFormatter={(value: string) => (String(value).length > 10 ? `${String(value).slice(0, 9)}…` : String(value))}
            tick={{ fill: "var(--text-2)", fontSize: 10 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tickCount={5}
            tick={{ fill: "var(--text-2)", fontSize: 10 }}
          />
          <Tooltip
            content={<MoneyTooltip currency={currency} />}
            wrapperStyle={{ outline: "none" }}
            cursor={{ fill: "var(--row-hover)" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive>
            {data.map((row, index) => (
              <Cell key={row.label} fill={chartSeriesColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The gross bridge plus the exact amounts behind it and the movements it does not draw. */
function GrossBridgePanel({ view, items }: { view: VarianceView; items: WaterfallItem[] }) {
  return (
    <>
      <WaterfallBridge
        items={items}
        valuePrefix="₹"
        ariaLabel={`Gross cost bridge from ${view.priorPeriodLabel} to ${view.currentPeriodLabel}`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: 420 }}>
          <caption className="sr-only">
            Exact amounts behind the gross cost bridge
          </caption>
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Movement
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {view.bars.map((bar) => (
              <tr key={`${bar.kind}-${bar.label}`} className="border-t border-border">
                <td className="py-2 pr-3 text-[12px] text-foreground">
                  {bar.label}
                  {bar.kind !== "delta" && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {bar.kind}
                    </span>
                  )}
                </td>
                <td
                  className={cn(
                    "py-2 pl-3 text-right font-mono text-[12px] font-bold tabular-nums",
                    bar.kind === "delta" && bar.amountMinor > 0 && "text-success",
                    bar.kind === "delta" && bar.amountMinor < 0 && "text-destructive",
                    bar.kind !== "delta" && "text-foreground",
                  )}
                >
                  {bar.kind === "delta" && bar.amountMinor > 0 ? "+" : ""}
                  {currencyLabel(bar.amountMinor, view.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Not drawn, and why
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {view.omitted.map((entry) => (
            <li key={entry.category} className="text-[12px] leading-[18px] text-muted-foreground">
              <span className="font-semibold text-foreground">{entry.category}:</span> {entry.reason}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel chrome                                                               */
/* -------------------------------------------------------------------------- */

/** Renders a feed's stated reason instead of a chart. Never a zero. */
function Unavailable({ title, feed }: { title: string; feed: Feed<unknown> }) {
  return (
    <StateBlock
      tone="empty"
      icon={AlertTriangle}
      title={title}
      description={feed.message ?? "This source is unavailable for your role or is not configured for this tenant."}
    />
  );
}

function stepTone(state: TimelineStep["state"]): string {
  if (state === "done") return "border-success/30 bg-success/10 text-success";
  if (state === "current") return "border-primary/40 bg-primary/10 text-primary";
  return "border-border bg-secondary text-muted-foreground";
}

/* -------------------------------------------------------------------------- */
/* Console                                                                    */
/* -------------------------------------------------------------------------- */

export function PayrollControlRoomCockpit() {
  const [runId, setRunId] = useState("");
  const [focused, setFocused] = useState<ExceptionRow | null>(null);
  const [decision, setDecision] = useState<string>(RESOLUTION_STATUSES[0].value);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const path = runId ? `/api/v1/cockpits/payroll-control-room?runId=${runId}` : "/api/v1/cockpits/payroll-control-room";
  const state = useLive<Envelope>(path);
  const view = state.data?.data ?? null;

  const refresh = state.refresh;
  const resetForm = useCallback(() => {
    setFocused(null);
    setNote("");
    setOutcome(null);
    setDecision(RESOLUTION_STATUSES[0].value);
  }, []);

  const submitResolution = useCallback(async () => {
    if (!focused || note.trim().length === 0) return;
    setBusy(true);
    const result = await postResolution(focused.id, decision, note.trim());
    setBusy(false);
    setOutcome(result);
    if (result.ok) {
      setNote("");
      setFocused(null);
      refresh();
    }
  }, [decision, focused, note, refresh]);

  const bridgeItems = useMemo<WaterfallItem[] | null>(() => {
    const variance = view?.variance;
    if (!variance?.available || !variance.value) return null;
    return variance.value.bars.map((bar) => ({
      label: bar.label,
      value: major(bar.amountMinor),
      kind: bar.kind,
    }));
  }, [view]);

  const currency = view?.selected?.currency ?? "INR";

  const exceptionColumns = useMemo<Column<ExceptionRow>[]>(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{row.employeeName}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{row.employeeCode}</p>
          </div>
        ),
      },
      {
        key: "rule",
        header: "Rule",
        render: (row) => <span className="font-mono text-[12px] text-foreground">{row.ruleCode}</span>,
      },
      {
        key: "severity",
        header: "Severity",
        render: (row) => (
          <StatusPill tone={severityTone(row.severity)} dot>
            {row.severity}
          </StatusPill>
        ),
      },
      {
        key: "reason",
        header: "Why it was raised",
        render: (row) => (
          <span className="block max-w-[320px] text-[12px] leading-[18px] text-muted-foreground">
            {row.reason || "The rule recorded no facts."}
          </span>
        ),
      },
      {
        key: "status",
        header: "State",
        render: (row) => (
          <div className="min-w-0">
            <StatusPill tone={exceptionStatusTone(row.status)}>{row.status}</StatusPill>
            {row.resolution && (
              <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground" title={row.resolution}>
                {row.resolution}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "action",
        header: "",
        align: "right",
        render: (row) =>
          row.resolvable ? (
            <Button
              variant="outline"
              onClick={() => {
                setFocused(row);
                setOutcome(null);
              }}
            >
              Decide
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Decided</span>
          ),
      },
    ],
    [],
  );

  const periodSelector = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="payroll-control-room-period">
        Payroll period
      </label>
      <select
        id="payroll-control-room-period"
        className={cn(selectClass, "max-w-full")}
        value={view?.selectedRunId ?? ""}
        onChange={(event) => {
          setRunId(event.target.value);
          resetForm();
        }}
        disabled={!view || view.periods.length === 0}
      >
        {view && view.periods.length > 0 ? (
          view.periods.map((period) => (
            <option key={period.runId} value={period.runId}>
              {period.periodLabel} · {period.scopeLabel} · {period.displayCode}
            </option>
          ))
        ) : (
          <option value="">No payroll run</option>
        )}
      </select>
      <Button variant="outline" onClick={refresh} aria-label="Refresh the control room">
        <RefreshCcw className="size-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S5 · PAYROLL CONTROL ROOM"
        title="Payroll Control Room"
        description="Execution state, month-on-month cost movement, cost composition and the exceptions blocking this run. Every figure is the run's own stored data; anything that cannot be derived exactly is shown as unavailable with the reason."
        action={periodSelector}
      />

      {state.error && (
        <Surface className="mb-4">
          <StateBlock tone="error" icon={ShieldAlert} title="The control room could not be loaded" description={state.error} />
        </Surface>
      )}

      {state.loading && !view && (
        <Surface>
          <StateBlock tone="loading" title="Loading the control room…" description="Reading the payroll runs for this tenant." />
        </Surface>
      )}

      {view && (
        <div className="space-y-4">
          {/* ---------------------------------------------------------- KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={`Gross · ${view.selected?.periodLabel ?? "no period"}`}
              value={
                view.selected?.grossMinor === null || view.selected === null ? (
                  <span className="text-base font-semibold text-muted-foreground">Not calculated</span>
                ) : (
                  currencyLabel(view.selected.grossMinor ?? 0, currency)
                )
              }
              hint={view.selected ? `${view.selected.displayCode} · ${view.selected.scopeLabel}` : undefined}
              icon={BadgeIndianRupee}
              tone="primary"
            />
            <StatTile
              label="Net payable"
              value={
                view.selected?.netMinor === null || view.selected === null ? (
                  <span className="text-base font-semibold text-muted-foreground">Not calculated</span>
                ) : (
                  currencyLabel(view.selected.netMinor ?? 0, currency)
                )
              }
              hint="Gross less every deduction posted to this run"
              icon={Landmark}
              tone="info"
            />
            <StatTile
              label="Employees in the run"
              value={
                view.counts.available && view.counts.value ? (
                  view.counts.value.members
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={
                view.counts.available && view.counts.value
                  ? `${view.counts.value.payslips} payslip(s) · ${view.counts.value.approvals} approval(s)`
                  : view.counts.message
              }
              icon={Users}
              tone="neutral"
            />
            <StatTile
              label="Open exceptions"
              value={
                view.counts.available && view.counts.value ? (
                  view.counts.value.anomaliesOpen
                ) : (
                  <span className="text-base font-semibold text-muted-foreground">Unavailable</span>
                )
              }
              hint={
                view.counts.available && view.counts.value
                  ? `${view.counts.value.anomaliesTotal} raised on this run in total`
                  : view.counts.message
              }
              icon={ShieldAlert}
              tone={view.counts.value && view.counts.value.anomaliesOpen > 0 ? "danger" : "success"}
            />
          </div>

          {/* ------------------------------------------------------- Stepper */}
          <Surface className="p-4 sm:p-5">
            <SectionHeading
              title="Execution state"
              description="Each stage is the state the run's own records prove: its status, its locked inputs, its anomalies, its approvals and its payslips."
              action={
                view.selected ? (
                  <StatusPill tone={runStatusTone(view.selected.status)} dot>
                    {view.selected.status}
                  </StatusPill>
                ) : undefined
              }
            />
            {view.stepper.available && view.stepper.value.length > 0 ? (
              <>
                <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  {view.stepper.value.map((step, index) => (
                    <li
                      key={step.key}
                      className={cn("min-w-0 rounded-lg border p-3", stepTone(step.state))}
                      aria-current={step.state === "current" ? "step" : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current font-mono text-[10px] font-bold">
                          {step.state === "done" ? <CircleCheck className="size-3.5" /> : index + 1}
                        </span>
                        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest opacity-80">
                          {step.state}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[13px] font-semibold text-foreground" title={step.label}>
                        {step.label}
                      </p>
                    </li>
                  ))}
                </ol>
                {view.stepper.origin && (
                  <p className="mt-3 text-[11px] text-muted-foreground">Source: {view.stepper.origin}.</p>
                )}
              </>
            ) : (
              <Unavailable title="Execution state unavailable" feed={view.stepper} />
            )}
          </Surface>

          {/* ------------------------------------- Bridge + cost composition */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Surface className="p-4 sm:p-5 lg:col-span-8">
              <SectionHeading
                title="Month-on-month gross movement"
                description={
                  view.variance.available && view.variance.value
                    ? `From ${view.variance.value.priorPeriodLabel} to ${view.variance.value.currentPeriodLabel}, attributed to the component that actually moved.`
                    : "Bridges the previous comparable run's gross to this one."
                }
              />
              {bridgeItems && view.variance.value ? (
                <GrossBridgePanel view={view.variance.value} items={bridgeItems} />
              ) : (
                <Unavailable title="No bridge for this period" feed={view.variance} />
              )}
            </Surface>

            <Surface className="p-4 sm:p-5 lg:col-span-4">
              <SectionHeading
                title="Cost composition"
                description="Every earning component the run posted, summed across everyone in it."
              />
              {view.composition.available && view.composition.value ? (
                <CostCompositionDonut view={view.composition.value} />
              ) : (
                <Unavailable title="Composition unavailable" feed={view.composition} />
              )}
            </Surface>
          </div>

          {/* --------------------------------------------- Cost per function */}
          <Surface className="p-4 sm:p-5">
            <SectionHeading
              title="Cost per function"
              description="Gross earnings for this run, grouped by the department recorded against each employee."
            />
            {view.departments.available && view.departments.value.length > 0 ? (
              <>
                <DepartmentCostBars rows={view.departments.value} currency={currency} />
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm" style={{ minWidth: 480 }}>
                    <caption className="sr-only">Exact gross cost per function</caption>
                    <thead>
                      <tr className="text-[11px] text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Function
                        </th>
                        <th scope="col" className="py-2 px-3 text-right font-medium">
                          Employees
                        </th>
                        <th scope="col" className="py-2 pl-3 text-right font-medium">
                          Gross
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.departments.value.map((row) => (
                        <tr key={row.department} className="border-t border-border">
                          <td className="py-2 pr-3 text-[12px] text-foreground">{row.department}</td>
                          <td className="py-2 px-3 text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                            {row.employees}
                          </td>
                          <td className="py-2 pl-3 text-right font-mono text-[12px] font-bold text-foreground tabular-nums">
                            {currencyLabel(row.amountMinor, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Unavailable
                title="No cost by function"
                feed={
                  view.departments.available
                    ? {
                        value: [],
                        available: false,
                        message:
                          "This run has posted no earning lines against an employee record, so there is nothing to group by function.",
                      }
                    : view.departments
                }
              />
            )}
          </Surface>

          {/* ---------------------------------------------------- Exceptions */}
          <Surface className="p-0">
            <div className="p-4 sm:p-5">
              <SectionHeading
                title="Blocking exceptions"
                description="Anomalies the payroll rules raised against this run. Each decision is written to the run's audit trail with the reason you give."
                action={
                  view.selected ? (
                    <Link
                      href={`/payroll?record=${view.selected.runId}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      Open the run
                      <ExternalLink className="size-3.5" />
                    </Link>
                  ) : undefined
                }
              />
              {view.severityCounts.available && view.severityCounts.value.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {view.severityCounts.value.map((entry) => (
                    <StatusPill key={entry.label} tone={severityTone(entry.label)} dot>
                      {entry.label}: {entry.value} open
                    </StatusPill>
                  ))}
                </div>
              )}
            </div>
            {view.exceptions.available ? (
              <DataTable<ExceptionRow>
                columns={exceptionColumns}
                rows={view.exceptions.value}
                rowKey={(row) => row.id}
                minWidth={940}
                selectedKey={focused?.id}
                caption="Payroll exceptions raised against this run"
                empty={
                  <StateBlock
                    tone="empty"
                    icon={CircleCheck}
                    title="No exceptions on this run"
                    description="The payroll rules raised nothing against this run. Exceptions appear here the moment one is."
                  />
                }
              />
            ) : (
              <Unavailable title="Exceptions unavailable" feed={view.exceptions} />
            )}

            {focused && (
              <div className="border-t border-border p-4 sm:p-5">
                <SectionHeading
                  title={`Decide · ${focused.ruleCode} · ${focused.employeeName}`}
                  description={focused.reason || "The rule recorded no facts."}
                  action={
                    <Button variant="ghost" onClick={resetForm}>
                      Cancel
                    </Button>
                  }
                />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                  <div className="lg:col-span-4">
                    <label
                      className="mb-1.5 block text-[12px] font-semibold text-foreground"
                      htmlFor="payroll-exception-decision"
                    >
                      Decision
                    </label>
                    <select
                      id="payroll-exception-decision"
                      className={cn(selectClass, "w-full")}
                      value={decision}
                      onChange={(event) => setDecision(event.target.value)}
                    >
                      {RESOLUTION_STATUSES.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-6">
                    <label className="mb-1.5 block text-[12px] font-semibold text-foreground" htmlFor="payroll-exception-note">
                      Reason <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="payroll-exception-note"
                      className={inputClass}
                      value={note}
                      maxLength={500}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="What was checked, and what was done about it"
                      aria-describedby="payroll-exception-help"
                    />
                    <p id="payroll-exception-help" className="mt-1 text-[11px] text-muted-foreground">
                      Recorded on the run&apos;s audit trail against your membership.
                    </p>
                  </div>
                  <div className="flex items-start lg:col-span-2">
                    <Button
                      className="w-full"
                      disabled={busy || note.trim().length === 0}
                      onClick={() => {
                        void submitResolution();
                      }}
                    >
                      {busy ? "Recording…" : "Record"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {outcome && (
              <div className="border-t border-border p-4 sm:p-5">
                <p
                  role={outcome.ok ? "status" : "alert"}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-[12px] leading-[18px]",
                    outcome.ok ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive",
                  )}
                >
                  {outcome.message}
                </p>
              </div>
            )}
          </Surface>

          {/* ------------------------------------------------- Feed honesty */}
          {view.unavailableSources.length > 0 && (
            <Surface className="p-4 sm:p-5">
              <SectionHeading
                title="What this console could not read"
                description="Listed so nothing above is mistaken for a complete picture."
              />
              <ul className="space-y-1.5">
                {view.unavailableSources.map((entry) => (
                  <li key={entry.name} className="text-[12px] leading-[18px] text-muted-foreground">
                    <span className="font-mono text-[11px] font-semibold text-foreground">{entry.name}</span> — {entry.message}
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
