export type Gate = { allowed: boolean; reason: string | null };

export type LearningItem = {
  id: string;
  version: number;
  courseCode: string;
  courseTitle: string;
  learningPathLabel: string;
  state: string;
  stateLabel: string;
  progress: { percentComplete: number | null; tracked: boolean; basis: string };
  due: { label?: string; date?: string | null } & Record<string, unknown>;
  completedOn: string | null;
  certification: { name: string; issuingBody: string | null } | null;
  certificateHeld: boolean;
  complete: Gate;
};

export type LearningQueue = {
  items: LearningItem[];
  total: number;
  states: Array<{ key: string; label: string; backed: boolean; count: number }>;
  assign: Gate;
  courses: Array<{ code: string; title: string; mandatory: boolean }>;
  notes: { progress: string; dueDate: string; states: string };
};
