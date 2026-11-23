/** Payroll Control Room (S5) payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

/** One step of the persisted run timeline (mirrors the payroll service's cockpit timeline step). */
export type PayrollTimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

export type BridgeBar = {
  label: string;
  amountMinor: number;
  kind: "base" | "delta" | "total";
};

export type OmittedMovement = { category: string; reason: string };

export type VarianceBridge = {
  bars: BridgeBar[];
  /** The movement categories the stored lines could actually attribute. */
  attributed: string[];
  /** Categories the bridge deliberately does not draw, each with its reason. */
  omitted: OmittedMovement[];
  /** Opening minus the movements minus closing. Non-zero means do not draw it. */
  residualMinor: number;
  /** True only when the movements reconcile the opening base to the closing total. */
  ties: boolean;
};

export type CompositionSlice = { code: string; label: string; amountMinor: number; sharePct: number | null };

export type DepartmentCost = { department: string; amountMinor: number; employees: number };

export type PeriodOption = {
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

export type ExceptionRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  ruleCode: string;
  severity: string;
  status: string;
  reason: string;
  resolution: string | null;
  /** `resolveAnomaly` only accepts an anomaly that is still open. */
  resolvable: boolean;
};

export type CompositionView = {
  slices: CompositionSlice[];
  componentTotalMinor: number;
  runGrossMinor: number | null;
  /** False when the summed lines and the run's stored gross disagree. */
  tiesToRunGross: boolean;
  currency: string;
};

export type RunCounts = { members: number; anomaliesOpen: number; anomaliesTotal: number; inputs: number; approvals: number; payslips: number };

export type VarianceView = VarianceBridge & { priorPeriodLabel: string; currentPeriodLabel: string; currency: string };

export type PayrollControlRoomView = {
  periods: PeriodOption[];
  selectedRunId: string | null;
  selected: PeriodOption | null;
  priorRunId: string | null;
  stepper: Source<PayrollTimelineStep[]>;
  counts: Source<RunCounts | null>;
  variance: Source<VarianceView | null>;
  composition: Source<CompositionView | null>;
  departments: Source<DepartmentCost[]>;
  exceptions: Source<ExceptionRow[]>;
  severityCounts: Source<Array<{ label: string; value: number }>>;
  unavailableSources: Array<{ name: string; message: string }>;
};
