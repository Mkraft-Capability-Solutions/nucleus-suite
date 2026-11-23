/** Performance & Calibration (S6) payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type CycleOption = { id: string; code: string; name: string; status: string; createdAt: string | null };

export type ParticipationSummary = {
  participants: number;
  participantsWithSubmissions: number;
  responses: number;
  completionPct: number | null;
};

export type SessionOption = { id: string; label: string; status: string; department: string | null; createdAt: string | null };

export type PersonRef = { id: string; code: string; name: string };

/** Structural copy of the server's nine-box banding policy (`tenant_settings.settings -> performance -> nine_box`). */
export type NineBoxBoundariesView = { ratingScaleMax: number; mediumAtOrAbove: number; highAtOrAbove: number };

export type DistributionView = {
  scaleMax: number;
  buckets: Array<{ bucket: string; actual: number; guided: number | null }>;
  ratingsCounted: number;
  ignoredRatings: number;
  truncated: boolean;
  guidedConfigured: boolean;
  guidedNote: string;
};

export type CompetencyView = {
  functions: string[];
  /** One axis per benchmarked competency; `byFunction` is the assessed average. */
  axes: Array<{ competency: string; target: number; byFunction: Record<string, { average: number; assessed: number }> }>;
  scaleMax: number;
};

export type NineBoxCellView = {
  id: string;
  label: string;
  count: number;
  performance: 1 | 2 | 3;
  potential: 1 | 2 | 3;
  employees: PersonRef[];
};

export type NineBoxView = {
  cells: NineBoxCellView[];
  placed: number;
  bandingConfigured: boolean;
  bandingNote: string;
  boundaries: NineBoxBoundariesView | null;
  unplacedNote: string;
};

export type PerformanceCalibrationView = {
  cycles: CycleOption[];
  selectedCycleId: string | null;
  cycle: CycleOption | null;
  sessions: SessionOption[];
  selectedSessionId: string | null;
  participation: Source<ParticipationSummary | null>;
  distribution: Source<DistributionView | null>;
  competency: Source<CompetencyView | null>;
  nineBox: Source<NineBoxView | null>;
  unavailableSources: Array<{ name: string; message: string }>;
};
