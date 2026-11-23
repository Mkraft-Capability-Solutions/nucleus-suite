/** People Command Centre payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type AttritionTone = "success" | "warning" | "danger" | "neutral";

export type MatrixView = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

export type RadarAxisPoint = { axis: string; current: number; comparison: number };

export type OmittedAxis = { axis: string; reason: string };

export type FlowGraph = { nodes: Array<{ name: string }>; links: Array<{ source: number; target: number; value: number }>; centreIndex: number };

export type ThresholdBar = { label: string; value: number; tone: AttritionTone; exits: number; roster: number };

export type PeopleCommandCentrePayload = {
  generatedAt: string;
  period: { from: string; to: string; label: string };
  rosterSampleCapped: boolean;
  kpis: {
    activeHeadcount: Source<number | null>;
    attritionAnnualisedPercent: Source<number | null>;
    averageCompaRatio: Source<number | null>;
    orgHealthIndex: Source<number | null>;
  };
  orgHealth: Source<{ axes: RadarAxisPoint[]; omitted: OmittedAxis[]; currentLabel: string; comparisonLabel: string }>;
  headcountTrend: Source<{ points: Array<{ label: string; left: number; right: number }>; leftLabel: string; rightLabel: string; planNote: string }>;
  talentFlow: Source<FlowGraph & { omitted: OmittedAxis[] }>;
  attritionByDepartment: Source<ThresholdBar[]>;
  attritionMatrix: Source<MatrixView>;
  capability: Source<Array<{ label: string; value: number }>>;
  compaPerformance: Source<null>;
  unavailableSources: Array<{ name: string; message: string }>;
};
