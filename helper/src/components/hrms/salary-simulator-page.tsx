"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Play, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? (value as unknown[]).map((entry) => String(entry)) : [];
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/** Integer minor units rendered exactly, never through floating point. */
function money(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.trunc(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
}

function signedMoney(amountMinor: number): string {
  if (amountMinor === 0) return "0.00";
  return `${amountMinor > 0 ? "+" : ""}${money(amountMinor)}`;
}

function sharePercent(share: number | null): string {
  return share === null ? "—" : `${(share * 100).toFixed(1)}%`;
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type Verdict = "pass" | "fail" | "indeterminate";

const VERDICT_LABELS: Record<Verdict, string> = { pass: "Floor pass", fail: "Floor fail", indeterminate: "Floor indeterminate" };

/** The row status IS the floor verdict: a real per-employee result, not a fixed label. */
function statusTone(verdict: Verdict): "success" | "warning" | "danger" | "neutral" {
  if (verdict === "pass") return "success";
  if (verdict === "fail") return "danger";
  if (verdict === "indeterminate") return "warning";
  return "neutral";
}

function stateTone(state: string): "success" | "warning" | "info" | "neutral" {
  if (state === "adopted") return "success";
  if (state === "submitted") return "info";
  if (state === "simulated") return "warning";
  return "neutral";
}

function stateLabel(state: string): string {
  if (state === "simulated") return "Simulated";
  if (state === "submitted") return "Submitted";
  if (state === "adopted") return "Adopted";
  return "Draft";
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

type ScenarioRow = {
  id: string;
  scenario: string;
  state: string;
  employeeCount: number;
  grossMinor: number;
  takeHomeMinor: number;
  floorVerdictSummary: string;
  blocked: boolean;
  createdAt: string | null;
};

type StatutoryItem = { code: string; label: string; amountMinor: number; basisMinor: number; rule: string; note: string | null };
type UnavailableItem = { code: string; label: string; missingRules: string[]; reason: string };

type EarningRow = { componentCode: string; label: string; amountMinor: number; partOfPfWage: boolean; countsTowardWageFloor: boolean };

type DeltaRow = { componentCode: string; label: string; currentMinor: number; proposedMinor: number; deltaMinor: number };

type EmployeeRow = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  basicMinor: number;
  grossMinor: number;
  takeHomeMinor: number;
  employeeDeductionsMinor: number;
  earnings: EarningRow[];
  statutory: StatutoryItem[];
  employerCost: { available: boolean; totalMinor: number | null; items: StatutoryItem[]; unavailable: UnavailableItem[] };
  takeHome: { excludesTds: boolean; caveat: string; excluded: UnavailableItem[] };
  wageFloor: {
    verdict: Verdict;
    percent: number | null;
    numeratorMinor: number;
    numeratorComponents: string[];
    denominatorMinor: number;
    denominatorBasis: string;
    observedShare: number | null;
    shortfallMinor: number | null;
    missingRules: string[];
    reason: string;
  };
  /** FRM-PAY-02 "Minimum wage test result". Indeterminate while no schedule, state or skill exists. */
  minimumWage: {
    verdict: Verdict;
    requiredMonthlyMinor: number | null;
    observedMonthlyMinor: number;
    shortfallMinor: number | null;
    missingRules: string[];
    reason: string;
  };
  delta: { hasCurrent: boolean; componentDeltas: DeltaRow[]; currentGrossMinor: number; currentTakeHomeMinor: number; grossDeltaMinor: number; takeHomeDeltaMinor: number };
  blockers: string[];
};

type SimulationDetail = {
  id: string;
  scenario: string;
  state: string;
  rulePackCode: string;
  truncated: boolean;
  employees: EmployeeRow[];
  aggregate: {
    employeeCount: number;
    grossMinor: number;
    takeHomeMinor: number;
    employeeDeductionsMinor: number;
    grossDeltaMinor: number;
    takeHomeDeltaMinor: number;
    floorPass: number;
    floorFail: number;
    floorIndeterminate: number;
    employerCostAvailable: boolean;
    takeHomeExcludesTds: boolean;
    missingRules: string[];
    blockers: string[];
  };
};

function readStatutory(value: unknown): StatutoryItem[] {
  return list(value).map((entry) => ({
    code: str(entry.code, "—"),
    label: str(entry.label, str(entry.code, "—")),
    amountMinor: int(entry.amountMinor),
    basisMinor: int(entry.basisMinor),
    rule: str(entry.rule, ""),
    note: typeof entry.note === "string" ? entry.note : null,
  }));
}

function readUnavailable(value: unknown): UnavailableItem[] {
  return list(value).map((entry) => ({
    code: str(entry.code, "—"),
    label: str(entry.label, str(entry.code, "—")),
    missingRules: strings(entry.missingRules),
    reason: str(entry.reason, ""),
  }));
}

function readEmployee(entry: UnknownRecord): EmployeeRow {
  const employerCost = asRecord(entry.employerCost);
  const takeHome = asRecord(entry.takeHome);
  const wageFloor = asRecord(entry.wageFloor);
  const minimumWage = asRecord(entry.minimumWage);
  const delta = asRecord(entry.delta);
  const rawVerdict = str(wageFloor.verdict, "indeterminate");
  return {
    employeeId: str(entry.employeeId),
    employeeCode: typeof entry.employeeCode === "string" ? entry.employeeCode : null,
    employeeName: str(entry.employeeName, str(entry.employeeId, "—")),
    basicMinor: int(entry.basicMinor),
    grossMinor: int(entry.grossMinor),
    takeHomeMinor: int(takeHome.takeHomeMinor),
    employeeDeductionsMinor: int(entry.employeeDeductionsMinor),
    earnings: list(entry.earnings).map((earning) => ({
      componentCode: str(earning.componentCode, "—"),
      label: str(earning.label, str(earning.componentCode, "—")),
      amountMinor: int(earning.amountMinor),
      partOfPfWage: earning.partOfPfWage === true,
      countsTowardWageFloor: earning.countsTowardWageFloor === true,
    })),
    statutory: readStatutory(entry.employeeStatutory),
    employerCost: {
      available: employerCost.available === true,
      totalMinor: employerCost.totalMinor === null || employerCost.totalMinor === undefined ? null : int(employerCost.totalMinor),
      items: readStatutory(employerCost.items),
      unavailable: readUnavailable(employerCost.unavailable),
    },
    takeHome: {
      excludesTds: takeHome.excludesTds === true,
      caveat: str(takeHome.caveat, ""),
      excluded: readUnavailable(takeHome.excluded),
    },
    wageFloor: {
      verdict: (rawVerdict === "pass" || rawVerdict === "fail" ? rawVerdict : "indeterminate") as Verdict,
      percent: typeof wageFloor.percent === "number" ? wageFloor.percent : null,
      numeratorMinor: int(wageFloor.numeratorMinor),
      numeratorComponents: strings(wageFloor.numeratorComponents),
      denominatorMinor: int(wageFloor.denominatorMinor),
      denominatorBasis: str(wageFloor.denominatorBasis, ""),
      observedShare: typeof wageFloor.observedShare === "number" ? wageFloor.observedShare : null,
      shortfallMinor: wageFloor.shortfallMinor === null || wageFloor.shortfallMinor === undefined ? null : int(wageFloor.shortfallMinor),
      missingRules: strings(wageFloor.missingRules),
      reason: str(wageFloor.reason, ""),
    },
    minimumWage: {
      verdict: (["pass", "fail", "indeterminate"].includes(str(minimumWage.verdict, "")) ? str(minimumWage.verdict) : "indeterminate") as Verdict,
      requiredMonthlyMinor: typeof minimumWage.requiredMonthlyMinor === "number" ? minimumWage.requiredMonthlyMinor : null,
      observedMonthlyMinor: int(minimumWage.observedMonthlyMinor),
      shortfallMinor: minimumWage.shortfallMinor === null || minimumWage.shortfallMinor === undefined ? null : int(minimumWage.shortfallMinor),
      missingRules: strings(minimumWage.missingRules),
      reason: str(minimumWage.reason, ""),
    },
    delta: {
      hasCurrent: delta.hasCurrent === true,
      componentDeltas: list(delta.componentDeltas).map((row) => ({
        componentCode: str(row.componentCode, "—"),
        label: str(row.label, str(row.componentCode, "—")),
        currentMinor: int(row.currentMinor),
        proposedMinor: int(row.proposedMinor),
        deltaMinor: int(row.deltaMinor),
      })),
      currentGrossMinor: int(delta.currentGrossMinor),
      currentTakeHomeMinor: int(delta.currentTakeHomeMinor),
      grossDeltaMinor: int(delta.grossDeltaMinor),
      takeHomeDeltaMinor: int(delta.takeHomeDeltaMinor),
    },
    blockers: strings(entry.blockers),
  };
}

function readDetail(payload: unknown): SimulationDetail {
  const data = asRecord(asRecord(payload).data);
  const aggregate = asRecord(data.aggregate);
  return {
    id: str(data.id),
    scenario: str(data.scenario, "Scenario"),
    state: str(data.state, "draft"),
    rulePackCode: str(data.rulePackCode, "in-pay/v1"),
    truncated: data.truncated === true,
    employees: list(data.employees).map(readEmployee),
    aggregate: {
      employeeCount: int(aggregate.employeeCount),
      grossMinor: int(aggregate.grossMinor),
      takeHomeMinor: int(aggregate.takeHomeMinor),
      employeeDeductionsMinor: int(aggregate.employeeDeductionsMinor),
      grossDeltaMinor: int(aggregate.grossDeltaMinor),
      takeHomeDeltaMinor: int(aggregate.takeHomeDeltaMinor),
      floorPass: int(aggregate.floorPass),
      floorFail: int(aggregate.floorFail),
      floorIndeterminate: int(aggregate.floorIndeterminate),
      employerCostAvailable: aggregate.employerCostAvailable === true,
      takeHomeExcludesTds: aggregate.takeHomeExcludesTds === true,
      missingRules: strings(aggregate.missingRules),
      blockers: strings(aggregate.blockers),
    },
  };
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

async function postSimulation(body: unknown): Promise<UnknownRecord> {
  const response = await fetch("/api/v1/wage-simulations", {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = asRecord(asRecord(payload).error);
    const details = list(error.details).map((detail) => str(detail.issue)).filter(Boolean);
    const message = str(error.message, `Request failed (${response.status}).`);
    throw new Error(details.length > 0 ? `${message} ${details.join(" ")}` : message);
  }
  return asRecord(asRecord(payload).data);
}

export function SalarySimulatorPage() {
  // Deep-link preselect (?record=<simulationId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<SimulationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("all");

  const [proposalOpen, setProposalOpen] = useState(false);
  const [scenario, setScenario] = useState("Basic uplift scenario");
  const [basis, setBasis] = useState<"current" | "basic" | "ctc">("current");
  const [basisAmount, setBasisAmount] = useState("30000");
  const [daPercent, setDaPercent] = useState("10");
  const [hraPercent, setHraPercent] = useState("40");
  const [conveyance, setConveyance] = useState("1600");
  const [special, setSpecial] = useState("2400");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [runOk, setRunOk] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionError, setActionError] = useState("");

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
        const raw = await getJson("/api/v1/wage-simulations?page=1&pageSize=50");
        const rows = list(asRecord(raw).data).map((item) => ({
          id: str(item.id),
          scenario: str(item.scenario, "Scenario"),
          state: str(item.state, "draft"),
          employeeCount: int(item.employeeCount),
          grossMinor: int(item.grossMinor),
          takeHomeMinor: int(item.takeHomeMinor),
          floorVerdictSummary: str(item.floorVerdictSummary, "—"),
          blocked: item.blocked === true,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
        }));
        if (live) setScenarios(rows);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Simulations could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const activeScenario = useMemo(
    () => scenarios.find((row) => row.id === selectedId) ?? scenarios[0] ?? null,
    [scenarios, selectedId],
  );
  const activeId = activeScenario?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/wage-simulations?simulationId=${encodeURIComponent(activeId)}`);
        if (live) {
          setDetail(readDetail(raw));
          setSelectedEmployeeId("");
        }
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "The simulation could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  /** A stale detail must not outlive its scenario; derived, so no setState runs inside the effect. */
  const shownDetail = activeId ? detail : null;

  const employees = useMemo(() => {
    const rows = shownDetail?.employees ?? [];
    if (verdictFilter === "all") return rows;
    return rows.filter((row) => row.wageFloor.verdict === verdictFilter);
  }, [shownDetail, verdictFilter]);

  const activeEmployee = useMemo(
    () => employees.find((row) => row.employeeId === selectedEmployeeId) ?? employees[0] ?? null,
    [employees, selectedEmployeeId],
  );

  async function runSimulation(): Promise<void> {
    setRunError("");
    setRunOk("");
    if (scenario.trim().length === 0) {
      setRunError("A scenario name is required.");
      return;
    }
    const amount = Number(basisAmount);
    if (basis !== "current" && (!Number.isFinite(amount) || amount <= 0)) {
      setRunError(basis === "ctc" ? "An annual CTC is required." : "A monthly basic is required.");
      return;
    }
    const percentage = (value: string): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed / 100 : 0;
    };
    const minor = (value: string): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    };
    setRunBusy(true);
    try {
      const data = await postSimulation({
        action: "simulate",
        scenario: scenario.trim(),
        basicMinor: basis === "basic" ? Math.round(amount * 100) : null,
        ctcMinor: basis === "ctc" ? Math.round(amount * 100) : null,
        lines: [
          { componentCode: "basic", calculationMethod: "fixed_amount", amountMinor: 0, percentageOf: null, percentageValue: null },
          { componentCode: "da", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: percentage(daPercent) },
          { componentCode: "hra", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: percentage(hraPercent) },
          { componentCode: "conveyance", calculationMethod: "fixed_amount", amountMinor: minor(conveyance), percentageOf: null, percentageValue: null },
          { componentCode: "special", calculationMethod: "fixed_amount", amountMinor: minor(special), percentageOf: null, percentageValue: null },
        ],
      });
      const id = str(data.id);
      setRunOk(`Scenario simulated over ${int(asRecord(data.aggregate).employeeCount)} employee(s). Nothing was posted.`);
      if (id) setSelectedId(id);
      setProposalOpen(false);
      refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "The simulation could not be run.");
    } finally {
      setRunBusy(false);
    }
  }

  async function transition(action: "submit" | "adopt"): Promise<void> {
    if (!activeId) return;
    setActionBusy(action);
    setActionError("");
    try {
      await postSimulation({ action, simulationId: activeId, reason: null });
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `The scenario could not be ${action === "submit" ? "submitted" : "adopted"}.`);
    } finally {
      setActionBusy("");
    }
  }

  const aggregate = shownDetail?.aggregate ?? null;
  const adoptBlockers = aggregate?.blockers ?? [];
  const canSubmit = shownDetail?.state === "simulated";
  const canAdopt = shownDetail?.state === "submitted" && adoptBlockers.length === 0;
  const adoptReason =
    shownDetail === null
      ? "Run a simulation first."
      : shownDetail.state === "adopted"
        ? "This scenario has already been adopted."
        : shownDetail.state !== "submitted"
          ? "Submit the scenario for approval before it can be adopted."
          : adoptBlockers.length > 0
            ? adoptBlockers[0]
            : "";

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="COMPENSATION · SCR-052"
        title="Salary structure simulator"
        description="Model a proposed salary structure and see its wage base, basic-share floor test, statutory cost and take-home impact per employee and in aggregate before anything is adopted."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => { setRunError(""); setRunOk(""); setProposalOpen((value) => !value); }}
            >
              <Play className="mr-1.5 size-4" /> Run simulation
            </Button>
          </div>
        }
      />

      {proposalOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Proposed structure"
            description="The proposal is applied to every employee in scope. Simulation is non-posting: no payroll line, journal or payslip is written."
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Scenario</span>
              <input aria-label="Scenario name" className={`${inputClass} w-56 max-w-full`} value={scenario} onChange={(e) => setScenario(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Basis</span>
              <select aria-label="Proposal basis" className={`${selectClass} w-full max-w-full sm:w-auto`} value={basis} onChange={(e) => setBasis(e.target.value as "current" | "basic" | "ctc")}>
                <option value="current">Each employee&apos;s current basic</option>
                <option value="basic">Fixed monthly basic</option>
                <option value="ctc">Annual CTC</option>
              </select>
            </label>
            {basis === "current" ? null : (
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{basis === "ctc" ? "Annual CTC" : "Monthly basic"}</span>
                <input aria-label="Basis amount" inputMode="decimal" className={`${inputClass} w-36 max-w-full`} value={basisAmount} onChange={(e) => setBasisAmount(e.target.value)} />
              </label>
            )}
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">DA % of basic</span>
              <input aria-label="Dearness allowance percent" inputMode="decimal" className={`${inputClass} w-24 max-w-full`} value={daPercent} onChange={(e) => setDaPercent(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">HRA % of basic</span>
              <input aria-label="House rent allowance percent" inputMode="decimal" className={`${inputClass} w-24 max-w-full`} value={hraPercent} onChange={(e) => setHraPercent(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Conveyance</span>
              <input aria-label="Conveyance amount" inputMode="decimal" className={`${inputClass} w-28 max-w-full`} value={conveyance} onChange={(e) => setConveyance(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Special allowance</span>
              <input aria-label="Special allowance amount" inputMode="decimal" className={`${inputClass} w-28 max-w-full`} value={special} onChange={(e) => setSpecial(e.target.value)} />
            </label>
            <Button className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-bold sm:w-auto" disabled={runBusy} onClick={() => void runSimulation()}>
              {runBusy ? "Simulating…" : "Simulate"}
            </Button>
          </div>
          {runError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{runError}</p> : null}
          {runOk ? <p className="mt-3 text-xs leading-relaxed text-success">{runOk}</p> : null}
        </Surface>
      ) : null}

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-052"
          description="Draft the proposed structure → simulate wage base, 50% floor test, statutory cost and take-home impact → compare against the current structure → submit → adopt. Take-home impact is shown before adoption, and a failing or unreachable floor verdict blocks adoption rather than warning about it."
        />
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Scenario</span>
          {loading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : scenarios.length === 0 ? (
            <span className="text-xs text-muted-foreground">No scenario has been simulated yet.</span>
          ) : (
            <select
              aria-label="Scenario"
              className={`${selectClass} w-full max-w-full sm:w-auto`}
              value={activeId}
              onChange={(e) => { setSelectedId(e.target.value); setSelectedEmployeeId(""); }}
            >
              {scenarios.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.scenario} · {stateLabel(row.state)} · {row.employeeCount} employee{row.employeeCount === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          )}
          {shownDetail ? <StatusPill tone={stateTone(shownDetail.state)}>{stateLabel(shownDetail.state)}</StatusPill> : null}
        </div>
        <Link href={activeId ? `/payroll?record=${encodeURIComponent(activeId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll
        </Link>
      </div>

      {aggregate ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Aggregate impact"
            description={`${aggregate.employeeCount} employee${aggregate.employeeCount === 1 ? "" : "s"} · rule pack ${shownDetail?.rulePackCode ?? "—"}${shownDetail?.truncated ? " · population truncated to the first 200 employees" : ""}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!canSubmit || actionBusy !== ""}
                  title={canSubmit ? "Submit this scenario for adoption" : "Only a simulated scenario can be submitted."}
                  onClick={() => void transition("submit")}
                >
                  {actionBusy === "submit" ? "Submitting…" : "Submit"}
                </Button>
                <Button
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!canAdopt || actionBusy !== ""}
                  title={canAdopt ? "Write the proposed lines onto the salary structure" : adoptReason}
                  onClick={() => void transition("adopt")}
                >
                  {actionBusy === "adopt" ? "Adopting…" : "Adopt"}
                </Button>
              </div>
            }
          />
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            {[
              [money(aggregate.grossMinor), "Monthly gross"],
              [money(aggregate.employeeDeductionsMinor), "Employee statutory"],
              [money(aggregate.takeHomeMinor), "Take home (ex TDS)"],
              [signedMoney(aggregate.grossDeltaMinor), "Gross vs current"],
              [signedMoney(aggregate.takeHomeDeltaMinor), "Take home vs current"],
            ].map(([value, label]) => (
              <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5">
                <p className="text-sm font-bold tabular-nums text-foreground sm:text-base">{value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Floor test across the population: {aggregate.floorPass} pass · {aggregate.floorFail} fail · {aggregate.floorIndeterminate} indeterminate.
            {aggregate.employerCostAvailable ? "" : " Employer cost is unavailable for this population."}
          </p>
          {!canAdopt && adoptReason ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span><span className="font-bold">Adoption blocked. </span>{adoptReason}</span>
            </p>
          ) : null}
          {aggregate.missingRules.length > 0 ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Unsupplied statutory rules in this pack: {aggregate.missingRules.join(", ")}. Figures that depend on them are reported as unavailable, never estimated.
            </p>
          ) : null}
          {actionError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{actionError}</p> : null}
        </Surface>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={detailLoading ? "Loading…" : `${employees.length} employee${employees.length === 1 ? "" : "s"} in the current scope`}
            action={
              <select aria-label="Floor verdict filter" className={`${selectClass} w-full max-w-full sm:w-auto`} value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
                <option value="all">All verdicts</option>
                <option value="pass">Floor pass</option>
                <option value="fail">Floor fail</option>
                <option value="indeterminate">Floor indeterminate</option>
              </select>
            }
          />
          {loading || detailLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error || detailError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error || detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : employees.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {scenarios.length === 0
                ? "No structure has been simulated yet. Run a simulation to model a proposed structure before it is adopted."
                : shownDetail === null
                  ? "Select a scenario to see its population."
                  : "No employee matches this verdict filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 text-right font-bold">Gross</th>
                    <th className="px-3 py-2 text-right font-bold">Take home</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((row) => {
                    const selected = row.employeeId === activeEmployee?.employeeId;
                    return (
                      <tr key={row.employeeId}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(row.employeeId)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.employeeName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{row.employeeCode ?? "—"} · Basic {money(row.basicMinor)}</span>
                            </span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{money(row.grossMinor)}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{money(row.takeHomeMinor)}</span>
                            <span><StatusPill tone={statusTone(row.wageFloor.verdict)}>{VERDICT_LABELS[row.wageFloor.verdict]}</StatusPill></span>
                            <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Take home is gross less the employee statutory deductions the rule pack can compute. It excludes TDS.
              </p>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Record detail"
            description={activeEmployee ? `${activeEmployee.employeeName} · ${activeEmployee.employeeCode ?? "—"}` : "Select an employee to inspect the proposed structure"}
            action={activeEmployee ? <StatusPill tone={statusTone(activeEmployee.wageFloor.verdict)}>{VERDICT_LABELS[activeEmployee.wageFloor.verdict]}</StatusPill> : undefined}
          />
          {!activeEmployee ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No employee selected.</p>
          ) : (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Component breakdown</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-1.5 font-bold">Component</th>
                      <th className="px-2 py-1.5 text-right font-bold">Amount</th>
                      <th className="px-2 py-1.5 font-bold">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployee.earnings.map((earning) => (
                      <tr key={earning.componentCode} className="border-t border-border/60">
                        <td className="px-2 py-1.5 text-xs text-foreground">{earning.label}</td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-foreground">{money(earning.amountMinor)}</td>
                        <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          {[earning.partOfPfWage ? "PF wage" : null, earning.countsTowardWageFloor ? "Floor" : null].filter(Boolean).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border">
                      <td className="px-2 py-1.5 text-xs font-bold text-foreground">Monthly gross</td>
                      <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-foreground">{money(activeEmployee.grossMinor)}</td>
                      <td className="px-2 py-1.5" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Statutory cost</h3>
              <ul className="mt-2 space-y-1.5">
                {activeEmployee.statutory.map((item) => (
                  <li key={item.code} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-foreground">{money(item.amountMinor)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Basis {money(item.basisMinor)} · rule {item.rule}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </li>
                ))}
                {activeEmployee.employerCost.items.map((item) => (
                  <li key={item.code} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-foreground">{money(item.amountMinor)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Basis {money(item.basisMinor)} · rule {item.rule}</p>
                  </li>
                ))}
                {activeEmployee.employerCost.unavailable.map((item) => (
                  <li key={item.code} className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="shrink-0 text-xs font-semibold text-warning">Unavailable</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.reason}</p>
                  </li>
                ))}
              </ul>
              {activeEmployee.employerCost.available ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Employer cost: {money(activeEmployee.employerCost.totalMinor ?? 0)}.
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  No employer-cost total is shown: {activeEmployee.employerCost.unavailable.flatMap((item) => item.missingRules).join(", ")} are not defined in the rule pack, and a partial employer cost read as a total would be misleading.
                </p>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Take home</h3>
              <div className="mt-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-xs font-semibold text-foreground">Gross less computable deductions</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{money(activeEmployee.takeHomeMinor)}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {money(activeEmployee.grossMinor)} gross − {money(activeEmployee.employeeDeductionsMinor)} employee statutory.
                </p>
              </div>
              {activeEmployee.takeHome.caveat ? (
                <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <span>{activeEmployee.takeHome.caveat}</span>
                </p>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Wage floor test</h3>
              <div className="mt-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-xs font-semibold text-foreground">Observed share</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{sharePercent(activeEmployee.wageFloor.observedShare)}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {money(activeEmployee.wageFloor.numeratorMinor)} from {activeEmployee.wageFloor.numeratorComponents.join(" + ") || "no flagged component"} against {money(activeEmployee.wageFloor.denominatorMinor)}.
                  {" "}{activeEmployee.wageFloor.denominatorBasis}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">
                    {activeEmployee.wageFloor.verdict === "pass" ? "Verdict: Pass. " : activeEmployee.wageFloor.verdict === "fail" ? "Verdict: Fail. " : "Verdict: Indeterminate. "}
                  </span>
                  {activeEmployee.wageFloor.reason}
                </p>
                {activeEmployee.wageFloor.shortfallMinor !== null ? (
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-destructive">
                    Shortfall against the floor: {money(activeEmployee.wageFloor.shortfallMinor)}.
                  </p>
                ) : null}
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Minimum wage test</h3>
              <div className="mt-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">Monthly wage</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{money(activeEmployee.minimumWage.observedMonthlyMinor)}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">
                    {activeEmployee.minimumWage.verdict === "pass" ? "Verdict: Pass. " : activeEmployee.minimumWage.verdict === "fail" ? "Verdict: Fail. " : "Verdict: Indeterminate. "}
                  </span>
                  {activeEmployee.minimumWage.reason}
                </p>
                {activeEmployee.minimumWage.shortfallMinor !== null ? (
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-destructive">
                    Shortfall against the statutory minimum: {money(activeEmployee.minimumWage.shortfallMinor)}.
                  </p>
                ) : null}
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Delta vs current structure</h3>
              {!activeEmployee.delta.hasCurrent ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  This employee has no current structure on record, so no delta is shown rather than a comparison against an assumed baseline.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[460px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-2 py-1.5 font-bold">Component</th>
                        <th className="px-2 py-1.5 text-right font-bold">Current</th>
                        <th className="px-2 py-1.5 text-right font-bold">Proposed</th>
                        <th className="px-2 py-1.5 text-right font-bold">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployee.delta.componentDeltas.map((row) => (
                        <tr key={row.componentCode} className="border-t border-border/60">
                          <td className="px-2 py-1.5 text-xs text-foreground">{row.label}</td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{money(row.currentMinor)}</td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums text-foreground">{money(row.proposedMinor)}</td>
                          <td className={`px-2 py-1.5 text-right text-xs tabular-nums ${row.deltaMinor === 0 ? "text-muted-foreground" : row.deltaMinor > 0 ? "text-success" : "text-destructive"}`}>
                            {signedMoney(row.deltaMinor)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border">
                        <td className="px-2 py-1.5 text-xs font-bold text-foreground">Monthly gross</td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{money(activeEmployee.delta.currentGrossMinor)}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-foreground">{money(activeEmployee.grossMinor)}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-foreground">{signedMoney(activeEmployee.delta.grossDeltaMinor)}</td>
                      </tr>
                      <tr className="border-t border-border/60">
                        <td className="px-2 py-1.5 text-xs font-bold text-foreground">Take home (ex TDS)</td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{money(activeEmployee.delta.currentTakeHomeMinor)}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-foreground">{money(activeEmployee.takeHomeMinor)}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums text-foreground">{signedMoney(activeEmployee.delta.takeHomeDeltaMinor)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeEmployee.blockers.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2">
                  <p className="text-xs font-bold text-foreground">Blocks adoption</p>
                  <ul className="mt-1 space-y-1">
                    {activeEmployee.blockers.map((blocker) => (
                      <li key={blocker} className="text-[11px] leading-relaxed text-muted-foreground">{blocker}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeScenario?.createdAt ? (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Simulated {timeLabel(activeScenario.createdAt)} against rule pack {shownDetail?.rulePackCode ?? "—"}. Simulation is non-posting.
                </p>
              ) : null}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
