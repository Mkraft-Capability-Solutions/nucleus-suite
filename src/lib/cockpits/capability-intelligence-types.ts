/** Capability Intelligence payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type CapabilityAxis = { axis: string; current: number; comparison: number };

export type CapabilityMovement = {
  /** Populated only when a baseline run exists; otherwise empty. */
  axes: CapabilityAxis[];
  /** The latest reading per dimension. Always populated where scores exist. */
  current: Array<{ axis: string; value: number }>;
  baselineRecorded: boolean;
  employeesScored: number;
  employeesWithBaseline: number;
  averageIndex: number | null;
  currentLabel: string;
  comparisonLabel: string;
  note: string;
};

export type LearningFunnel = {
  stages: Array<{ label: string; value: number; basis: string }>;
  omitted: Array<{ label: string; reason: string }>;
  note: string;
};

export type LearningVolume = {
  measure: "hours" | "completions";
  /** What the bar length means. Never says "hours" unless it is hours. */
  axisLabel: string;
  bars: Array<{ label: string; value: number }>;
  completionsMeasured: number;
  completionsWithoutDuration: number;
  note: string;
};

export type CapabilityIntelligencePayload = {
  kpis: {
    courses: Source<number>;
    enrolments: Source<number>;
    completionPct: Source<number | null>;
    averageCapabilityIndex: Source<number | null>;
  };
  capabilityMovement: Source<CapabilityMovement>;
  learningFunnel: Source<LearningFunnel>;
  learningVolume: Source<LearningVolume>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};
