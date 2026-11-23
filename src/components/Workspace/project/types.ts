/** Response shape of GET /api/v1/projects/board (mirrors src/server/workflows/project-board.ts). */
export const TASK_COLUMNS = ["todo", "inprogress", "review", "done"] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];
export const PROJECT_ACCENTS = ["signal", "status-ok", "pending", "agent", "info"] as const;
export type Accent = (typeof PROJECT_ACCENTS)[number];
export const TASK_TAGS = ["dev", "design", "research", "security", "operations"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export const PROJECT_VISIBILITIES = ["team", "all", "private"] as const;

export type BoardProject = {
  id: string; title: string; description: string | null; dueDate: string | null; accent: Accent;
  visibility: "all" | "team" | "private"; members: Array<{ employeeId: string; name: string }>;
  createdByViewer: boolean; taskCounts: Record<TaskColumn, number>; progressPercent: number | null; viewerTaskCount: number;
};
export type BoardTask = {
  id: string; projectId: string; title: string; assigneeEmployeeId: string | null; assigneeName: string | null;
  assignedToViewer: boolean; tag: string | null; priority: string | null; dueDate: string | null; column: TaskColumn;
};
export type ProjectBoard = {
  viewer: { employeeId: string | null; scope: "all" | "self" | "team"; canWrite: boolean };
  projects: BoardProject[];
  tasks: BoardTask[];
};
