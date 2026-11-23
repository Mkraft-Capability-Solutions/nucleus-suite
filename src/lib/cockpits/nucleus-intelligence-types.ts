/** Nucleus Intelligence (AI governance console) payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type SeverityTone = "danger" | "warning" | "success" | "info" | "neutral";

export type Detection = {
  id: string;
  feed: string;
  subject: string;
  detail: string;
  severity: string;
  tone: SeverityTone;
  recordedAt: string | null;
  reference: string | null;
  open: boolean;
};

export type GuardrailRow = {
  id: string;
  agent: string;
  tool: string;
  status: string;
  tone: SeverityTone;
  autonomyCeiling: string;
  dryRunRecorded: boolean;
  outcomeRecorded: boolean;
  reversed: boolean;
  kind: string | null;
  proposedAt: string | null;
  lastChangeAt: string | null;
};

export type RegisteredModel = {
  id: string;
  model: string;
  runs: number;
  registeredAt: string | null;
  lastRunAt: string | null;
};

export type EvalSuiteSummary = {
  suite: string;
  description: string | null;
  passed: number;
  total: number;
  passRatePct: number | null;
  lastRunAt: string | null;
  everRun: boolean;
};

export type ReviewItem = {
  id: string;
  runId: string | null;
  summary: string;
  status: string;
  tone: SeverityTone;
  decision: string | null;
  comment: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  assignedMembershipId: string | null;
  /** True only when the row is still pending; the endpoint rejects anything else with a 409. */
  decidable: boolean;
  /** Where the decision is actually made. Wired to a real POST. */
  decideEndpoint: string;
};

export type NucleusIntelligencePayload = {
  kpis: {
    openDetections: Source<number>;
    governedActions: Source<number>;
    pendingReviews: Source<number>;
    evaluationPassRatePct: Source<number | null>;
  };
  detections: Source<Detection[]>;
  detectionSeverityNote: string;
  guardrails: Source<GuardrailRow[]>;
  guardrailNotes: { blockedNotRecorded: string; allowlistedTools: readonly string[]; allowlistNote: string };
  modelRegister: Source<RegisteredModel[]>;
  evaluationSuites: Source<EvalSuiteSummary[]>;
  governanceFieldsNotRecorded: ReadonlyArray<{ field: string; detail: string }>;
  reviewQueue: Source<ReviewItem[]>;
  reviewDecisions: readonly string[];
  canDecideReviews: boolean;
  canDecideNote: string;
  naturalLanguageQueryConsole: Source<null>;
  unavailableSources: Array<{ name: string; message: string }>;
  generatedAt: string;
};
