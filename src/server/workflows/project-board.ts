import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { operationalScope } from "./operational-access";

/**
 * Project workspace board (ProjectView): projects and their tasks in `project_workforce`.
 *
 * Permission `workforce.projects` with the usual all/self scopes. Visibility is decided here, never in the
 * browser: "all" projects are public, "team" projects are visible to the creator, the pod members and anyone
 * holding a task in the project, "private" projects only to the creator. A caller with the full
 * `workforce.projects.read` permission sees every project. Members and assignees are employee ids that must
 * exist in the tenant; progress is derived from task columns and is null when a project has no tasks.
 */

export const PROJECT_VISIBILITIES = ["all", "team", "private"] as const;
export const PROJECT_ACCENTS = ["signal", "status-ok", "pending", "agent", "info"] as const;
export const TASK_COLUMNS = ["todo", "inprogress", "review", "done"] as const;
export const TASK_TAGS = ["dev", "design", "research", "security", "operations"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));
const optionalDate = z.iso.date().optional().or(z.literal("").transform(() => undefined));

export const createProjectSchema = z.object({
  title: z.string().trim().min(3, "Enter a project title of at least 3 characters.").max(150),
  description: optionalText(1000),
  dueDate: optionalDate,
  accent: z.enum(PROJECT_ACCENTS).default("signal"),
  visibility: z.enum(PROJECT_VISIBILITIES).default("team"),
  memberEmployeeIds: z.array(z.string().uuid()).max(50).default([]),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid("Choose a project."),
  title: z.string().trim().min(3, "Enter a task title of at least 3 characters.").max(200),
  assigneeEmployeeId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  tag: z.enum(TASK_TAGS),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueDate: optionalDate,
});

/** A task moves one column at a time, forward or back. */
export const moveTaskSchema = z
  .object({ from: z.enum(TASK_COLUMNS), to: z.enum(TASK_COLUMNS) })
  .refine((value) => Math.abs(TASK_COLUMNS.indexOf(value.from) - TASK_COLUMNS.indexOf(value.to)) === 1, {
    message: "A task moves one column at a time.",
    path: ["to"],
  });

export type CreateProject = z.infer<typeof createProjectSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type MoveTask = z.infer<typeof moveTaskSchema>;

export type BoardMember = { employeeId: string; name: string };
export type BoardProject = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  accent: (typeof PROJECT_ACCENTS)[number];
  visibility: (typeof PROJECT_VISIBILITIES)[number];
  members: BoardMember[];
  createdByViewer: boolean;
  taskCounts: Record<TaskColumn, number>;
  /** Share of tasks in Done. Null when the project has no tasks: an empty project is not 0 % done. */
  progressPercent: number | null;
  viewerTaskCount: number;
  createdAt: string | null;
};
export type BoardTask = {
  id: string;
  projectId: string;
  title: string;
  assigneeEmployeeId: string | null;
  assigneeName: string | null;
  assignedToViewer: boolean;
  tag: string | null;
  priority: string | null;
  dueDate: string | null;
  column: TaskColumn;
  createdAt: string | null;
};
export type ProjectBoard = {
  viewer: { employeeId: string | null; scope: "all" | "self" | "team"; canWrite: boolean };
  projects: BoardProject[];
  tasks: BoardTask[];
};

type UnknownRecord = Record<string, unknown>;
type Row = { id: string; status: string | null; attributes: unknown; created_at: string | Date | null };

const READ_LIMIT = 200;
const TASK_LIMIT = 2000;

function attributesOf(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function isoDateOrNull(value: unknown): string | null {
  const candidate = text(value);
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}
function stamp(value: string | Date | null): string | null {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}
function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}
function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && uuidOrNull(item) !== null) : [];
}
function columnOf(value: unknown): TaskColumn {
  const normalized = typeof value === "string" ? value.toLowerCase().replace(/[-_\s]/g, "") : "";
  return oneOf(TASK_COLUMNS, normalized, "todo");
}

/** Visibility predicate for one project row, shared by reads and writes. */
function canSeeProject(project: UnknownRecord, access: Access, scope: string, taskAssignees: ReadonlySet<string>): boolean {
  if (scope === "all") return true;
  const visibility = oneOf(PROJECT_VISIBILITIES, project.visibility, "team");
  if (visibility === "all") return true;
  if (text(project.created_by_membership_id) === access.context.membershipId) return true;
  if (visibility === "private") return false;
  const employeeId = access.context.employeeId ?? null;
  if (!employeeId) return false;
  return idList(project.member_employee_ids).includes(employeeId) || taskAssignees.has(employeeId);
}

async function employeeNames(access: Access, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const [rows] = await tenantTx(access, [
    sqlClient`select id::text as id, first_name, last_name, employee_code from employees
              where tenant_id = ${access.tenantId} and id::text = any(${unique})`,
  ]);
  const names = new Map<string, string>();
  for (const row of rows as Array<{ id: string; first_name: string | null; last_name: string | null; employee_code: string | null }>) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    names.set(row.id, name || row.employee_code || row.id);
  }
  return names;
}

async function readRows(access: Access): Promise<{ projects: Row[]; tasks: Row[] }> {
  const [projectRows, taskRows] = await tenantTx(access, [
    sqlClient`select id::text as id, status, attributes, created_at from project_workforce
              where tenant_id = ${access.tenantId} and coalesce(attributes->>'kind', attributes->>'entry_kind') = 'project'
                and coalesce(status, 'active') <> 'archived'
              order by created_at desc limit ${READ_LIMIT}`,
    sqlClient`select id::text as id, status, attributes, created_at from project_workforce
              where tenant_id = ${access.tenantId} and attributes->>'kind' = 'task'
              order by created_at asc limit ${TASK_LIMIT}`,
  ]);
  return { projects: projectRows as Row[], tasks: taskRows as Row[] };
}

/** Resolves a task's project: `project_id` for current rows, the project title for rows written before it existed. */
function taskProjectId(task: UnknownRecord, byTitle: ReadonlyMap<string, string>): string | null {
  return text(task.project_id) ?? (text(task.project) ? byTitle.get(String(task.project).toLowerCase()) ?? null : null);
}

export async function loadProjectBoard(access: Access): Promise<ProjectBoard> {
  const scope = operationalScope(access, "workforce.projects", "read");
  const { projects, tasks } = await readRows(access);
  const viewerEmployeeId = access.context.employeeId ?? null;

  const byTitle = new Map<string, string>();
  for (const row of projects) {
    const title = text(attributesOf(row.attributes).title);
    if (title && !byTitle.has(title.toLowerCase())) byTitle.set(title.toLowerCase(), row.id);
  }

  const assigneesByProject = new Map<string, Set<string>>();
  for (const row of tasks) {
    const attributes = attributesOf(row.attributes);
    const projectId = taskProjectId(attributes, byTitle);
    const assignee = uuidOrNull(text(attributes.assignee_employee_id));
    if (!projectId || !assignee) continue;
    const bucket = assigneesByProject.get(projectId) ?? new Set<string>();
    bucket.add(assignee);
    assigneesByProject.set(projectId, bucket);
  }

  const visible = projects.filter((row) => canSeeProject(attributesOf(row.attributes), access, scope, assigneesByProject.get(row.id) ?? new Set()));
  const visibleIds = new Set(visible.map((row) => row.id));
  const visibleTasks = tasks
    .map((row) => ({ row, attributes: attributesOf(row.attributes) }))
    .map((entry) => ({ ...entry, projectId: taskProjectId(entry.attributes, byTitle) }))
    .filter((entry): entry is typeof entry & { projectId: string } => entry.projectId !== null && visibleIds.has(entry.projectId));

  const names = await employeeNames(access, [
    ...visible.flatMap((row) => idList(attributesOf(row.attributes).member_employee_ids)),
    ...visibleTasks.flatMap((entry) => (uuidOrNull(text(entry.attributes.assignee_employee_id)) ? [String(entry.attributes.assignee_employee_id)] : [])),
  ]);

  const boardTasks: BoardTask[] = visibleTasks.map(({ row, attributes, projectId }) => {
    const assignee = uuidOrNull(text(attributes.assignee_employee_id));
    return {
      id: row.id,
      projectId,
      title: text(attributes.title) ?? "",
      assigneeEmployeeId: assignee,
      assigneeName: assignee ? names.get(assignee) ?? null : null,
      assignedToViewer: Boolean(assignee && viewerEmployeeId && assignee === viewerEmployeeId),
      tag: text(attributes.tag)?.toLowerCase() ?? null,
      priority: text(attributes.priority)?.toLowerCase() ?? null,
      dueDate: isoDateOrNull(attributes.due_date),
      column: columnOf(attributes.column),
      createdAt: stamp(row.created_at),
    };
  });

  const boardProjects: BoardProject[] = visible.map((row) => {
    const attributes = attributesOf(row.attributes);
    const own = boardTasks.filter((task) => task.projectId === row.id);
    const taskCounts = TASK_COLUMNS.reduce(
      (counts, column) => ({ ...counts, [column]: own.filter((task) => task.column === column).length }),
      {} as Record<TaskColumn, number>,
    );
    return {
      id: row.id,
      title: text(attributes.title) ?? "",
      description: text(attributes.description) ?? text(attributes.desc),
      dueDate: isoDateOrNull(attributes.due_date) ?? isoDateOrNull(attributes.due),
      accent: oneOf(PROJECT_ACCENTS, attributes.accent, "signal"),
      visibility: oneOf(PROJECT_VISIBILITIES, attributes.visibility, "team"),
      members: idList(attributes.member_employee_ids).map((employeeId) => ({ employeeId, name: names.get(employeeId) ?? employeeId })),
      createdByViewer: text(attributes.created_by_membership_id) === access.context.membershipId,
      taskCounts,
      progressPercent: own.length === 0 ? null : Math.round((taskCounts.done / own.length) * 100),
      viewerTaskCount: own.filter((task) => task.assignedToViewer).length,
      createdAt: stamp(row.created_at),
    };
  });

  const permissions = access.context.permissions;
  return {
    viewer: {
      employeeId: viewerEmployeeId,
      scope,
      canWrite: permissions.includes("workforce.projects.write") || permissions.includes("workforce.projects.self.write"),
    },
    projects: boardProjects,
    tasks: boardTasks,
  };
}

const audit = (access: Access, action: string, entityType: string, id: string, after: unknown, reason: string, requestId: string) => sqlClient`
  insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
  values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, ${entityType}, ${id},
          ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;

async function assertEmployeesExist(access: Access, ids: string[], field: string): Promise<void> {
  if (ids.length === 0) return;
  const names = await employeeNames(access, ids);
  const unknown = ids.filter((id) => !names.has(id));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "One or more chosen employees do not exist in this organisation.", details: [{ field, issue: "unknown employee" }] });
  }
}

export async function createProject(access: Access, input: CreateProject, requestId: string) {
  operationalScope(access, "workforce.projects", "write");
  const members = [...new Set(input.memberEmployeeIds)];
  await assertEmployeesExist(access, members, "memberEmployeeIds");
  const [duplicates] = await tenantTx(access, [
    sqlClient`select id from project_workforce where tenant_id = ${access.tenantId} and attributes->>'kind' = 'project'
              and lower(attributes->>'title') = lower(${input.title}) and coalesce(status, 'active') <> 'archived' limit 1`,
  ]);
  if ((duplicates as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `A project named "${input.title}" already exists.`, details: [{ field: "title", issue: "duplicate" }] });
  }
  const id = randomUUID();
  const attributes = {
    kind: "project",
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
    accent: input.accent,
    visibility: input.visibility,
    member_employee_ids: members,
    created_by_membership_id: access.context.membershipId,
  };
  await tenantTx(access, [
    sqlClient`insert into project_workforce (id, tenant_id, status, attributes) values (${id}, ${access.tenantId}, 'active', ${JSON.stringify(attributes)}::jsonb)`,
    audit(access, "project.create", "project", id, { title: input.title, visibility: input.visibility }, "Project created", requestId),
  ]);
  return { id, title: input.title };
}

async function visibleProject(access: Access, projectId: string, scope: string): Promise<UnknownRecord> {
  const [projectRows, assigneeRows] = await tenantTx(access, [
    sqlClient`select id::text as id, status, attributes from project_workforce
              where tenant_id = ${access.tenantId} and id::text = ${projectId} and attributes->>'kind' = 'project' limit 1`,
    sqlClient`select distinct attributes->>'assignee_employee_id' as assignee from project_workforce
              where tenant_id = ${access.tenantId} and attributes->>'kind' = 'task' and attributes->>'project_id' = ${projectId}`,
  ]);
  const project = (projectRows as Array<{ status: string | null; attributes: unknown }>)[0];
  const assignees = new Set((assigneeRows as Array<{ assignee: string | null }>).flatMap((row) => (row.assignee ? [row.assignee] : [])));
  if (!project || !canSeeProject(attributesOf(project.attributes), access, scope, assignees)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The project was not found." });
  }
  if ((project.status ?? "active") !== "active") {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "Tasks can only be added to an active project." });
  }
  return attributesOf(project.attributes);
}

export async function createTask(access: Access, input: CreateTask, requestId: string) {
  const scope = operationalScope(access, "workforce.projects", "write");
  await visibleProject(access, input.projectId, scope);
  if (input.assigneeEmployeeId) await assertEmployeesExist(access, [input.assigneeEmployeeId], "assigneeEmployeeId");
  const id = randomUUID();
  const attributes = {
    kind: "task",
    project_id: input.projectId,
    title: input.title,
    assignee_employee_id: input.assigneeEmployeeId ?? null,
    tag: input.tag,
    priority: input.priority,
    due_date: input.dueDate ?? null,
    column: "todo",
    created_by_membership_id: access.context.membershipId,
  };
  await tenantTx(access, [
    sqlClient`insert into project_workforce (id, tenant_id, employee_id, status, attributes)
              values (${id}, ${access.tenantId}, ${input.assigneeEmployeeId ?? null}, 'active', ${JSON.stringify(attributes)}::jsonb)`,
    audit(access, "project.task_create", "project_task", id, { project_id: input.projectId, title: input.title }, "Project task created", requestId),
  ]);
  return { id, column: "todo" as const };
}

export async function moveTask(access: Access, taskId: string, input: MoveTask, requestId: string) {
  const scope = operationalScope(access, "workforce.projects", "write");
  if (!uuidOrNull(taskId)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The task was not found." });
  const [taskRows] = await tenantTx(access, [
    sqlClient`select id::text as id, attributes from project_workforce
              where tenant_id = ${access.tenantId} and id::text = ${taskId} and attributes->>'kind' = 'task' limit 1`,
  ]);
  const task = (taskRows as Array<{ attributes: unknown }>)[0];
  if (!task) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The task was not found." });
  const attributes = attributesOf(task.attributes);
  if (scope !== "all") {
    const employeeId = access.context.employeeId ?? null;
    const mine = (employeeId && text(attributes.assignee_employee_id) === employeeId) || text(attributes.created_by_membership_id) === access.context.membershipId;
    if (!mine) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only the assignee or the task creator can move this task." });
  }
  if (columnOf(attributes.column) !== input.from) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This task has moved since the board was loaded. Refresh and try again." });
  }
  const [moved] = await tenantTx(access, [
    sqlClient`
      with moved as (
        update project_workforce
        set attributes = jsonb_set(attributes, '{column}', to_jsonb(${input.to}::text)), updated_at = now()
        where tenant_id = ${access.tenantId} and id::text = ${taskId} and attributes->>'kind' = 'task'
          and coalesce(attributes->>'column', 'todo') = ${input.from}
        returning id::text as id
      )
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'project.task_move', 'project_task', moved.id,
             'Task moved across columns', ${JSON.stringify({ column: input.from })}::jsonb, ${JSON.stringify({ column: input.to })}::jsonb,
             ${uuidOrNull(requestId)}::uuid
      from moved
      returning entity_id
    `,
  ]);
  if ((moved as unknown[]).length === 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This task has moved since the board was loaded. Refresh and try again." });
  }
  return { id: taskId, column: input.to };
}
