/** HR Operations Console payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type SlaState = "breached" | "due_today" | "within" | "unknown";

export type ApprovalItem = {
  id: string;
  queue: string;
  type: string;
  requester: string;
  reference: string;
  status: string;
  createdAt: string | null;
  ageDays: number | null;
  dueOn: string | null;
  dueBasis: string;
  sla: SlaState;
  href: string;
};

export type FunnelStage = { label: string; value: number };

export type MatrixView = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

export type HrOperationsConsolePayload = {
  generatedAt: string;
  today: string;
  kpis: {
    pendingApprovals: Source<number | null>;
    breachedItems: Source<number | null>;
    oldestQueueAgeDays: Source<number | null>;
    dayOneReady: Source<number | null>;
  };
  approvals: Source<{ items: ApprovalItem[]; queues: string[]; ageingNote: string }>;
  onboardingFunnel: Source<{ stages: FunnelStage[]; note: string }>;
  absenceDensity: Source<MatrixView & { note: string }>;
  helpdeskByCategory: Source<Array<{ label: string; value: number }>>;
  unavailableSources: Array<{ name: string; message: string }>;
};
