/**
 * Response shapes of the SCR-090 read models the recruitment workspace renders.
 * Mirrors src/server/talent/pipeline.ts, requisition-register.ts and establishment.ts (client code cannot
 * import server modules).
 */

export type PipelineCard = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  requisitionCode: string | null;
  roleTitle: string | null;
  department: string | null;
  stage: string;
  stageLabel: string;
  nextStage: string | null;
  nextStageLabel: string | null;
  terminal: boolean;
  matchScore: number | null;
  skills: string[];
  experienceYears: number | null;
  source: string | null;
  appliedAt: string | null;
};

export type BoardColumn = { id: string; label: string; caption: string; stages: string[]; cards: PipelineCard[] };

export type PipelineBoard = {
  columns: BoardColumn[];
  closed: PipelineCard[];
  unmapped: PipelineCard[];
  totals: { active: number; closed: number; scored: number; unscored: number };
  advisory: string;
};

export type ReferralMilestone = { key: string; label: string; amountMinor: number | null; state: string; blockedBy: string | null };
export type ReferralRow = {
  referralId: string;
  reference: string;
  candidateName: string;
  roleTitle: string | null;
  department: string | null;
  referredBy: string | null;
  referredOn: string | null;
  pipelineStageLabel: string | null;
  status: string;
  award: {
    configured: boolean;
    currency: string | null;
    milestones: ReferralMilestone[];
    eligibleMinor: number | null;
    disbursedMinor: number | null;
    nextMilestone: { label: string; requirement: string } | null;
  };
};
export type ReferralLedger = {
  schemeConfigured: boolean;
  schemeCode: string | null;
  currency: string | null;
  configurationGaps: string[];
  rows: ReferralRow[];
};

export type InterviewOverview = {
  plans: Array<{ planId: string; title: string | null; status: string; rounds: string[]; competencies: string[]; requisitionTitle: string | null; sessionCount: number }>;
  sessions: Array<{ sessionId: string; candidateName: string | null; planTitle: string | null; round: string | null; scheduledAt: string | null; status: string; debriefed: boolean; panel: Array<{ membershipId: string; name: string | null; submitted: boolean }>; cardsSubmitted: number }>;
};

export type FairnessView = {
  readiness: { computable: boolean; statement: string; missing: Array<{ key: string; label: string; requirement: string }> };
};

export type EstablishmentLine = {
  manpowerLineId: string | null;
  departmentId: string;
  departmentName: string;
  designation: string;
  planYear: number;
  sanctioned: number;
  filled: number;
  open: number;
  headroom: number;
  utilisationPercent: number | null;
  state: "within_headroom" | "at_limit" | "over_plan";
};
export type Establishment = { planYear: number; configured: boolean; lines: EstablishmentLine[]; overrideReasonMinLength: number };

export type HeadroomProjection = { kind: string; label: string; detail: string; headroom: number | null };
export type RequisitionGate = { allowed: boolean; code: string | null; message: string | null; checked: boolean; uncheckedReason: string | null; warnings: string[]; overridable: boolean };

export type RegisterRow = {
  id: string;
  code: string;
  title: string | null;
  position: string;
  department: string | null;
  requisitionType: "addition" | "replacement";
  positions: number;
  againstPositionCode: string | null;
  replacingEmployee: string | null;
  terms: { ctcMaxMinor: number | null };
  headroom: HeadroomProjection;
  displayState: string;
  displayStateLabel: string;
  displayStateReason: string;
};
export type RequisitionRegister = {
  planYear: number;
  controlConfigured: boolean;
  controlNote: string | null;
  overrideReasonMinLength: number;
  overriderAuthorised: boolean;
  departments: Array<{ id: string; name: string }>;
  rows: RegisterRow[];
  preview: { headroom: HeadroomProjection; gate: RequisitionGate } | null;
};

export type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };
