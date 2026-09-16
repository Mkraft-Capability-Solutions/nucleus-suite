"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  FolderKanban,
  Gauge,
  ListChecks,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { humanize } from "@/lib/workflow-catalog";
import { useWorkspace } from "../workspace-provider";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  DataTable,
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
  TabPanel,
  TabStrip,
  type Column,
  type TabDefinition,
} from "../page-primitives";
import {
  dateLabel,
  minutesLabel,
  num,
  runTransition,
  statusTone,
  str,
  useOperational,
  usePeople,
  type OperationalRecord,
} from "./records";

/**
 * Projects & Pod Allocation.
 *
 * Reads the `projects`, `tasks` and `allocations` catalog resources through the
 * shared operational engine. Every figure on this page is derived from those
 * responses; nothing is defaulted or sampled. Record creation is delegated to
 * the generic operational forms, and every inline control runs a transition the
 * catalog declares and that is legal from the record's current status.
 */

type TransitionOption = { action: string; label: string; from: string[] };

const PROJECT_TRANSITIONS: TransitionOption[] = [
  { action: "activate", label: "Activate", from: ["draft", "on_hold"] },
  { action: "hold", label: "Put on hold", from: ["active"] },
  { action: "close", label: "Close", from: ["active", "on_hold"] },
];

const TASK_TRANSITIONS: TransitionOption[] = [
  { action: "start", label: "Start", from: ["todo"] },
  { action: "review", label: "Send to review", from: ["in_progress"] },
  { action: "approve", label: "Approve", from: ["review"] },
  { action: "revise", label: "Send back", from: ["review"] },
  { action: "reopen", label: "Reopen", from: ["done"] },
  { action: "cancel", label: "Cancel", from: ["todo", "in_progress", "review"] },
];

const ALLOCATION_TRANSITIONS: TransitionOption[] = [
  { action: "submit", label: "Submit", from: ["draft", "returned"] },
  { action: "approve", label: "Approve", from: ["submitted"] },
  { action: "return", label: "Return", from: ["submitted"] },
  { action: "reject", label: "Reject", from: ["submitted"] },
  { action: "release", label: "Release", from: ["approved"] },
  { action: "cancel", label: "Cancel", from: ["draft", "returned", "submitted"] },
];

const BOARD_COLUMNS: { status: string; label: string; empty: string }[] = [
  { status: "todo", label: "To do", empty: "Nothing is waiting to be started." },
  { status: "in_progress", label: "In progress", empty: "No task is being worked on." },
  { status: "review", label: "Review", empty: "No task is waiting for review." },
  { status: "done", label: "Done", empty: "No task has been approved as done." },
];

const FORWARD_ACTIONS = new Set(["activate", "start", "review", "approve", "submit", "release"]);
const RISK_ACTIONS = new Set(["cancel", "reject", "hold", "close"]);

const CONTROL = "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-150";

function actionClass(action: string): string {
  if (FORWARD_ACTIONS.has(action)) return `${CONTROL} bg-primary text-primary-foreground hover:opacity-90`;
  if (RISK_ACTIONS.has(action)) return `${CONTROL} border border-destructive/30 text-destructive hover:bg-destructive/10`;
  return `${CONTROL} border border-border text-foreground hover:bg-secondary`;
}

function actionKey(resource: string, id: string, action: string): string {
  return `${resource}:${id}:${action}`;
}

function TransitionActions({
  resource,
  record,
  options,
  pending,
  onRun,
}: {
  resource: string;
  record: OperationalRecord;
  options: TransitionOption[];
  pending: string;
  onRun: (resource: string, record: OperationalRecord, action: string) => void;
}) {
  const available = options.filter((option) => option.from.includes(record.status));
  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((option) => {
        const key = actionKey(resource, record.id, option.action);
        const busy = pending === key;
        return (
          <button
            key={option.action}
            type="button"
            disabled={pending !== ""}
            onClick={() => onRun(resource, record, option.action)}
            className={`${actionClass(option.action)} text-xs disabled:pointer-events-none disabled:opacity-60`}
          >
            {busy ? "Working…" : option.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function ProjectsPage() {
  const { workspace } = useWorkspace();
  const projects = useOperational("projects");
  const tasks = useOperational("tasks");
  const allocations = useOperational("allocations");
  const { nameOf } = usePeople();

  const [tab, setTab] = useState("projects");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);

  const currentEmployeeId = str(workspace?.context?.employeeId ?? "");

  const refreshAll = useCallback(() => {
    projects.refresh();
    tasks.refresh();
    allocations.refresh();
  }, [projects, tasks, allocations]);

  const runAction = useCallback(
    (resource: string, record: OperationalRecord, action: string) => {
      const key = actionKey(resource, record.id, action);
      setPending(key);
      setNotice(null);
      void runTransition(resource, record.id, record.version, action)
        .then((result) => {
          setNotice({ ok: result.ok, text: result.ok ? `${humanize(action)} completed.` : result.message });
          if (result.ok) refreshAll();
        })
        .finally(() => setPending(""));
    },
    [refreshAll],
  );

  const projectRows = projects.rows;
  const taskRows = tasks.rows;
  const allocationRows = allocations.rows;

  /** Project reference → `CODE — Name`, used by the board filter and the pod table. */
  const projectLabels = useMemo(() => {
    const index = new Map<string, string>();
    for (const project of projectRows) {
      const code = str(project.code);
      const name = str(project.name);
      const label = [code, name].filter(Boolean).join(" — ");
      index.set(project.id, label || project.id);
    }
    return index;
  }, [projectRows]);

  /** Completed / total tasks per project, cancelled tasks excluded from both. */
  const taskProgress = useMemo(() => {
    const index = new Map<string, { total: number; done: number }>();
    for (const task of taskRows) {
      if (task.status === "cancelled") continue;
      const projectId = str(task.projectId);
      if (!projectId) continue;
      const entry = index.get(projectId) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === "done") entry.done += 1;
      index.set(projectId, entry);
    }
    return index;
  }, [taskRows]);

  const boardTasks = useMemo(() => {
    return taskRows.filter((task) => {
      if (task.status === "cancelled") return false;
      if (projectFilter !== "all" && str(task.projectId) !== projectFilter) return false;
      if (mineOnly && str(task.assigneeEmployeeId) !== currentEmployeeId) return false;
      return true;
    });
  }, [taskRows, projectFilter, mineOnly, currentEmployeeId]);

  const cancelledTasks = useMemo(
    () =>
      taskRows.filter((task) => {
        if (task.status !== "cancelled") return false;
        if (projectFilter !== "all" && str(task.projectId) !== projectFilter) return false;
        if (mineOnly && str(task.assigneeEmployeeId) !== currentEmployeeId) return false;
        return true;
      }).length,
    [taskRows, projectFilter, mineOnly, currentEmployeeId],
  );

  const podStats = useMemo(() => {
    const people = new Set<string>();
    const approvedByEmployee = new Map<string, number>();
    let percentTotal = 0;
    let percentCount = 0;
    for (const allocation of allocationRows) {
      const employeeId = str(allocation.employeeId);
      if (employeeId) people.add(employeeId);
      const percent = num(allocation.allocationPercent, 0);
      percentTotal += percent;
      percentCount += 1;
      if (allocation.status === "approved" && employeeId) {
        approvedByEmployee.set(employeeId, (approvedByEmployee.get(employeeId) ?? 0) + percent);
      }
    }
    let overAllocated = 0;
    for (const total of approvedByEmployee.values()) if (total > 100) overAllocated += 1;
    return {
      people: people.size,
      average: percentCount > 0 ? Math.round(percentTotal / percentCount) : 0,
      overAllocated,
      approvedPeople: approvedByEmployee.size,
    };
  }, [allocationRows]);

  const boardFiltered = projectFilter !== "all" || mineOnly;

  const tabs: TabDefinition[] = [
    {
      id: "projects",
      label: "Projects",
      icon: FolderKanban,
      count: projects.loading || projects.error ? undefined : projectRows.length,
    },
    {
      id: "board",
      label: "Task board",
      icon: ListChecks,
      count: tasks.loading || tasks.error ? undefined : boardTasks.length,
    },
    {
      id: "pods",
      label: "Pod allocation",
      icon: Users,
      count: allocations.loading || allocations.error ? undefined : allocationRows.length,
    },
  ];

  const allocationColumns: Column<OperationalRecord>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{nameOf(row.employeeId)}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{row.id}</p>
        </div>
      ),
    },
    {
      key: "project",
      header: "Project",
      render: (row) => {
        const reference = str(row.projectId);
        if (!reference) return <span className="text-muted-foreground">No project reference</span>;
        const label = projectLabels.get(reference);
        return label ? (
          <span className="text-foreground">{label}</span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">{reference}</span>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <span className="text-foreground">{str(row.role, "Not recorded")}</span>,
    },
    {
      key: "percent",
      header: "Allocation",
      align: "right",
      render: (row) => (
        <span className="font-mono tabular-nums text-foreground">{num(row.allocationPercent, 0)}%</span>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (row) => (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
        </span>
      ),
    },
    {
      key: "costCenter",
      header: "Cost centre",
      render: (row) => (
        <span className="font-mono text-[11px] text-muted-foreground">{str(row.costCenter, "Not set")}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)} dot>{humanize(row.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Next action",
      render: (row) => (
        <TransitionActions
          resource="allocations"
          record={row}
          options={ALLOCATION_TRANSITIONS}
          pending={pending}
          onRun={runAction}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Workforce operations"
        title="Projects & pod allocation"
        description="Track delivery projects, move tasks through their declared workflow, and keep pod allocations within capacity. Every figure is read live from the operational register."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              aria-label="Refresh projects, tasks and allocations"
              className={`${CONTROL} border border-border text-foreground hover:bg-secondary`}
            >
              <RefreshCw className="size-4" strokeWidth={2} />
            </button>
            <OperationCreateDialog resource="projects" label="New project" onCreated={projects.refresh} />
          </div>
        }
      />

      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={
            notice.ok
              ? "mb-4 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success"
              : "mb-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {notice.text}
        </p>
      )}

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Projects and pod allocation views" />

      <TabPanel id="projects" active={tab}>
        <SectionHeading
          title="Project register"
          description="Progress counts only tasks recorded against the project; cancelled tasks are excluded."
          action={
            <OperationCreateDialog
              resource="projects"
              label="New project"
              variant="secondary"
              onCreated={projects.refresh}
            />
          }
        />

        {projects.error ? (
          <Surface>
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Projects could not be loaded"
              description={projects.error}
              action={
                <button type="button" onClick={projects.refresh} className={`${CONTROL} border border-border text-foreground hover:bg-secondary`}>
                  Try again
                </button>
              }
            />
          </Surface>
        ) : projects.loading ? (
          <Surface>
            <StateBlock tone="loading" icon={FolderKanban} title="Loading projects…" description="Reading the project register." />
          </Surface>
        ) : projectRows.length === 0 ? (
          <Surface>
            <StateBlock
              icon={FolderKanban}
              title="No projects yet"
              description="Create the first project to start tracking tasks and pod allocation against it."
              action={
                <OperationCreateDialog resource="projects" label="New project" onCreated={projects.refresh} />
              }
            />
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projectRows.map((project) => {
              const progress = taskProgress.get(project.id);
              return (
                <Surface key={project.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-bold tracking-wide text-muted-foreground">
                        {str(project.code, "No code")}
                      </p>
                      <h3 className="mt-1 truncate font-heading text-[15px] font-semibold text-foreground">
                        {str(project.name, "Unnamed project")}
                      </h3>
                    </div>
                    <StatusPill tone={statusTone(project.status)} dot>
                      {humanize(project.status)}
                    </StatusPill>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldLine label="Client" value={str(project.client, "No client recorded")} />
                    <FieldLine label="Owner" value={nameOf(project.employeeId)} />
                    <FieldLine
                      label="Dates"
                      value={
                        <span className="font-mono text-[12px] tabular-nums">
                          {dateLabel(project.startDate)} – {dateLabel(project.endDate)}
                        </span>
                      }
                    />
                    <FieldLine
                      label="Cost centre"
                      value={<span className="font-mono text-[12px]">{str(project.costCenter, "Not set")}</span>}
                    />
                  </dl>

                  <div className="mt-4 border-t border-border pt-4">
                    {tasks.error ? (
                      <p role="alert" className="text-[12px] text-destructive">
                        Task progress unavailable: {tasks.error}
                      </p>
                    ) : tasks.loading ? (
                      <p role="status" className="text-[12px] text-muted-foreground">
                        Counting tasks…
                      </p>
                    ) : !progress ? (
                      <p className="text-[12px] text-muted-foreground">No tasks yet</p>
                    ) : (
                      <ProgressMeter
                        value={progress.done}
                        max={progress.total}
                        tone={progress.done === progress.total ? "success" : "primary"}
                        label={
                          <span className="font-mono tabular-nums">
                            {progress.done} of {progress.total} tasks complete
                          </span>
                        }
                      />
                    )}
                  </div>

                  <div className="mt-4">
                    <TransitionActions
                      resource="projects"
                      record={project}
                      options={PROJECT_TRANSITIONS}
                      pending={pending}
                      onRun={runAction}
                    />
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="board" active={tab}>
        <SectionHeading
          title="Task board"
          description="Tasks move only through the transitions the workflow declares. Cancelled tasks are kept off the board."
          action={
            <OperationCreateDialog
              resource="tasks"
              label="New task"
              variant="secondary"
              onCreated={tasks.refresh}
            />
          }
        />

        <Surface className="mb-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 sm:w-72">
              <label htmlFor="board-project-filter" className="text-[11px] text-muted-foreground">
                Project
              </label>
              <select
                id="board-project-filter"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="all">All projects</option>
                {projectRows.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectLabels.get(project.id) ?? project.id}
                  </option>
                ))}
              </select>
            </div>

            {currentEmployeeId !== "" && (
              <button
                type="button"
                aria-pressed={mineOnly}
                onClick={() => setMineOnly((current) => !current)}
                className={
                  mineOnly
                    ? `${CONTROL} bg-primary text-primary-foreground hover:opacity-90`
                    : `${CONTROL} border border-border text-foreground hover:bg-secondary`
                }
              >
                <UserCheck className="size-4" strokeWidth={2} />
                My tasks
              </button>
            )}

            {!tasks.loading && !tasks.error && cancelledTasks > 0 && (
              <p className="text-[12px] text-muted-foreground sm:ml-auto">
                <span className="font-mono tabular-nums">{cancelledTasks}</span> cancelled{" "}
                {cancelledTasks === 1 ? "task is" : "tasks are"} not shown on the board.
              </p>
            )}
          </div>
        </Surface>

        {tasks.error ? (
          <Surface>
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Tasks could not be loaded"
              description={tasks.error}
              action={
                <button type="button" onClick={tasks.refresh} className={`${CONTROL} border border-border text-foreground hover:bg-secondary`}>
                  Try again
                </button>
              }
            />
          </Surface>
        ) : tasks.loading ? (
          <Surface>
            <StateBlock tone="loading" icon={ListChecks} title="Loading tasks…" description="Reading the project task register." />
          </Surface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((column) => {
              const columnTasks = boardTasks.filter((task) => task.status === column.status);
              return (
                <Surface key={column.status} className="p-4">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                    <h3 className="font-heading text-sm font-semibold text-foreground">{column.label}</h3>
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-secondary-foreground tabular-nums">
                      {columnTasks.length}
                    </span>
                  </div>

                  {columnTasks.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-muted-foreground">
                      {boardFiltered ? `No ${column.label.toLowerCase()} task matches this filter.` : column.empty}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {columnTasks.map((task) => {
                        const estimate = num(task.estimateMinutes, 0);
                        return (
                          <li key={task.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                            <p className="text-sm font-semibold text-foreground">{str(task.title, "Untitled task")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <StatusPill tone="neutral">{humanize(str(task.tag, "No tag"))}</StatusPill>
                              <StatusPill tone={str(task.priority) === "urgent" || str(task.priority) === "high" ? "warning" : "info"}>
                                {humanize(str(task.priority, "No priority"))}
                              </StatusPill>
                            </div>
                            <dl className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <dt className="text-[11px] text-muted-foreground">Assignee</dt>
                                <dd className="truncate text-[12px] text-foreground">
                                  {str(task.assigneeEmployeeId) ? nameOf(task.assigneeEmployeeId) : "Unassigned"}
                                </dd>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <dt className="text-[11px] text-muted-foreground">Due</dt>
                                <dd className="font-mono text-[11px] tabular-nums text-foreground">
                                  {dateLabel(task.dueDate, "No due date")}
                                </dd>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <dt className="text-[11px] text-muted-foreground">Estimate</dt>
                                <dd className="font-mono text-[11px] tabular-nums text-foreground">
                                  {estimate > 0 ? minutesLabel(estimate) : "No estimate"}
                                </dd>
                              </div>
                            </dl>
                            <div className="mt-3">
                              <TransitionActions
                                resource="tasks"
                                record={task}
                                options={TASK_TRANSITIONS}
                                pending={pending}
                                onRun={runAction}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="pods" active={tab}>
        <SectionHeading
          title="Pod allocation"
          description="Capacity figures are calculated from the allocation records loaded below."
          action={
            <OperationCreateDialog
              resource="allocations"
              label="New allocation"
              variant="secondary"
              onCreated={allocations.refresh}
            />
          }
        />

        {allocations.error ? (
          <Surface>
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Allocations could not be loaded"
              description={allocations.error}
              action={
                <button
                  type="button"
                  onClick={allocations.refresh}
                  className={`${CONTROL} border border-border text-foreground hover:bg-secondary`}
                >
                  Try again
                </button>
              }
            />
          </Surface>
        ) : allocations.loading ? (
          <Surface>
            <StateBlock tone="loading" icon={Users} title="Loading allocations…" description="Reading the workforce allocation register." />
          </Surface>
        ) : allocationRows.length === 0 ? (
          <Surface>
            <StateBlock
              icon={Users}
              title="No allocations recorded"
              description="Capacity cannot be calculated until at least one allocation exists. Create the first one to begin."
              action={
                <OperationCreateDialog
                  resource="allocations"
                  label="New allocation"
                  onCreated={allocations.refresh}
                />
              }
            />
          </Surface>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatTile
                label="People allocated"
                value={podStats.people}
                icon={Users}
                tone="primary"
                hint={`Distinct employees across ${allocationRows.length} allocation ${allocationRows.length === 1 ? "record" : "records"}`}
              />
              <StatTile
                label="Average allocation"
                value={`${podStats.average}%`}
                icon={Gauge}
                tone="info"
                hint="Mean allocation percentage of the loaded records"
              />
              <StatTile
                label="Over-allocated people"
                value={podStats.overAllocated}
                icon={AlertTriangle}
                tone={podStats.overAllocated > 0 ? "danger" : "neutral"}
                hint={`Approved allocations above 100% across ${podStats.approvedPeople} ${podStats.approvedPeople === 1 ? "person" : "people"}`}
              />
            </div>

            <Surface className="mt-4 p-0">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <CalendarDays className="size-4 text-muted-foreground" strokeWidth={2} />
                <h3 className="font-heading text-sm font-semibold text-foreground">Allocation register</h3>
              </div>
              <DataTable
                columns={allocationColumns}
                rows={allocationRows}
                rowKey={(row) => row.id}
                minWidth={1120}
                caption="Workforce allocations with employee, project, role, allocation percentage, dates, cost centre and status"
              />
            </Surface>
          </>
        )}
      </TabPanel>
    </div>
  );
}
