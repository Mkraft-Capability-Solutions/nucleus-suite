export type OkrNode = {
  id: string;
  parentId: string | null;
  title: string;
  depth: number;
  weightPct: number | null;
  derivedProgressPct: number | null;
  health: { status: "green" | "amber" | "red" | "undetermined"; reason: string };
};

export type OkrTree = {
  nodes: OkrNode[];
  keyResults: Array<{ id: string; objectiveId: string; title: string; unit: string; current: number; target: number }>;
};

export type NineBoxGrid = {
  bandingConfigured: boolean;
  bandingNote: string;
  cells: Array<{ key: string; performance: string; potential: string; label: string; employeeIds: string[] }>;
  unplacedNote: string;
};
