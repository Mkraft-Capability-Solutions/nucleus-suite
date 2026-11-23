/** Talent Acquisition Command payload, shared by the cockpit service and its screen. */

/** The funnel milestones, each pinned to its index in the contract's stage flow. */
export const FUNNEL_MILESTONES = [
  { key: "applied", label: "Applied", stage: "applied" },
  { key: "screened", label: "Screened", stage: "screening" },
  { key: "interviewed", label: "Interviewed", stage: "interview" },
  { key: "offered", label: "Offered", stage: "offered" },
  { key: "joined", label: "Joined", stage: "converted" },
] as const;

export type FunnelStage = { label: string; value: number };

export type HiringFunnel = {
  stages: FunnelStage[];
  /** Applications whose recorded stage is terminal, counted at "Applied" only. */
  terminal: number;
  total: number;
};

export type BridgeItem = { label: string; value: number; kind: "base" | "delta" | "total" };

export type OfferBridge = { items: BridgeItem[]; reachedOffer: number; joined: number };

export type StageBreakdownRow = { stage: string; label: string; count: number; terminal: boolean };

export type TalentAcquisitionData = {
  kpis: {
    openRequisitions: number | null;
    openRequisitionsNote: string;
    activeCandidates: number | null;
    activeCandidatesNote: string;
    offersOutstanding: number | null;
    offersOutstandingNote: string;
    timeToHireDays: number | null;
    timeToHireNote: string;
    activePostings: number | null;
  };
  funnel: {
    stages: FunnelStage[];
    conversions: Array<{ label: string; percent: number | null }>;
    terminal: number;
    total: number;
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  bridge: {
    items: BridgeItem[];
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  candidateExperience: {
    available: false;
    message: string;
    detail: string;
  };
  stageBreakdown: { rows: StageBreakdownRow[]; available: boolean; message?: string; origin: string };
  unavailableSources: Array<{ name: string; message: string }>;
};
