"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderKanban,
  RefreshCw,
  Users,
} from "lucide-react";
import { humanize } from "@/lib/workflow-catalog";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  DataTable,
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StatTile,
  StateBlock,
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
  monthStartISO,
  num,
  runTransition,
  statusTone,
  str,
  todayISO,
  useOperational,
  usePeople,
  type OperationalRecord,
} from "./records";

/**
 * Timesheets & Productivity.
 *
 * Every figure on this page is summed from the `timesheets` records returned by
 * `/api/v1/operations/timesheets`. Nothing is modelled, sampled or estimated:
 * when a period holds no entries the page says so instead of showing zeroes.
 */

const FIELD_CONTROL =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary";

const STATUS_OPTIONS = ["draft", "submitted", "approved", "returned", "rejected", "cancelled"];

type TransitionOption = { action: string; label: string; intent: "primary" | "quiet" | "danger" };

/** Only the transitions the catalog declares as legal from each status. */
const TRANSITIONS: Record<string, TransitionOption[]> = {
  draft: [
    { action: "submit", label: "Submit", intent: "primary" },
    { action: "cancel", label: "Cancel", intent: "quiet" },
  ],
  returned: [
    { action: "submit", label: "Resubmit", intent: "primary" },
    { action: "cancel", label: "Cancel", intent: "quiet" },
  ],
  submitted: [
    { action: "approve", label: "Approve", intent: "primary" },
    { action: "return", label: "Return", intent: "quiet" },
    { action: "reject", label: "Reject", intent: "danger" },
    { action: "cancel", label: "Cancel", intent: "quiet" },
  ],
};

function billingLabel(value: unknown): string {
  const billing = str(value);
  if (billing === "billable") return "Billable";
  if (billing === "non_billable") return "Not billable";
  return "Not recorded";
}

function actionClass(intent: TransitionOption["intent"]): string {
  if (intent === "primary") return "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15";
  if (intent === "danger") return "border-destructive/30 text-destructive hover:bg-destructive/10";
  return "border-border text-muted-foreground hover:bg-secondary hover:text-foreground";
}

function daysWaiting(value: unknown): number | null {
  const raw = str(value);
  if (!raw) return null;
  const created = new Date(raw).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

type Aggregate = { key: string; label: string; sublabel: string; entries: number; minutes: number; billable: number };

function aggregate(rows: OperationalRecord[], keyOf: (row: OperationalRecord) => string): Map<string, Aggregate> {
  const groups = new Map<string, Aggregate>();
  for (const row of rows) {
    const key = keyOf(row);
    const existing = groups.get(key) ?? { key, label: "", sublabel: "", entries: 0, minutes: 0, billable: 0 };
    const minutes = num(row.minutes);
    existing.entries += 1;
    existing.minutes += minutes;
    if (str(row.billing) === "billable") existing.billable += minutes;
    groups.set(key, existing);
  }
  return groups;
}

function shareOf(billable: number, total: number): string {
  if (total <= 0) return "No time logged";
  return `${Math.round((billable / total) * 100)}% billable`;
}

export function TimesheetsPage() {
  const [tab, setTab] = useState("entries");
  const [from, setFrom] = useState(() => monthStartISO());
  const [to, setTo] = useState(() => todayISO());
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const timesheets = useOperational("timesheets");
  const projects = useOperational("projects");
  const { nameOf } = usePeople();

  const refreshEntries = timesheets.refresh;

  const projectIndex = useMemo(() => {
    const index = new Map<string, { code: string; name: string }>();
    for (const project of projects.rows) {
      index.set(project.id, { code: str(project.code), name: str(project.name) });
    }
    return index;
  }, [projects.rows]);

  const projectText = useCallback(
    (value: unknown) => {
      const reference = str(value);
      const project = projectIndex.get(reference);
      if (!project) return reference || "No project";
      return [project.code, project.name].filter(Boolean).join(" · ") || reference;
    },
    [projectIndex],
  );

  const projectCell = useCallback(
    (value: unknown) => {
      const reference = str(value);
      const project = projectIndex.get(reference);
      if (!project) {
        return (
          <div className="min-w-0">
            <p className="font-mono text-xs tabular-nums text-foreground">{reference || "No project"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {reference ? "Project record not in this worklist" : "No project recorded"}
            </p>
          </div>
        );
      }
      return (
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold tabular-nums text-foreground">{project.code || reference}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{project.name || "Name not recorded"}</p>
        </div>
      );
    },
    [projectIndex],
  );

  const periodRows = useMemo(
    () =>
      timesheets.rows.filter((row) => {
        const day = str(row.workDate);
        if (!day) return false;
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      }),
    [timesheets.rows, from, to],
  );

  const filtered = useMemo(
    () =>
      periodRows
        .filter((row) => (projectFilter ? str(row.projectId) === projectFilter : true))
        .filter((row) => (statusFilter ? row.status === statusFilter : true))
        .slice()
        .sort((a, b) => str(b.workDate).localeCompare(str(a.workDate))),
    [periodRows, projectFilter, statusFilter],
  );

  const awaiting = useMemo(
    () =>
      timesheets.rows
        .filter((row) => row.status === "submitted")
        .slice()
        .sort((a, b) => str(a.createdAt).localeCompare(str(b.createdAt))),
    [timesheets.rows],
  );

  const totals = useMemo(() => {
    let logged = 0;
    let billable = 0;
    let nonBillable = 0;
    let submitted = 0;
    for (const row of filtered) {
      const minutes = num(row.minutes);
      logged += minutes;
      if (str(row.billing) === "billable") billable += minutes;
      if (str(row.billing) === "non_billable") nonBillable += minutes;
      if (row.status === "submitted") submitted += 1;
    }
    return { logged, billable, nonBillable, submitted };
  }, [filtered]);

  const byProject = useMemo(() => {
    const groups = aggregate(filtered, (row) => str(row.projectId));
    return [...groups.values()]
      .map((group) => ({ ...group, label: projectText(group.key), sublabel: group.key }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered, projectText]);

  const byPerson = useMemo(() => {
    const groups = aggregate(filtered, (row) => str(row.employeeId));
    return [...groups.values()]
      .map((group) => ({ ...group, label: nameOf(group.key), sublabel: group.key }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filtered, nameOf]);

  const act = useCallback(
    async (row: OperationalRecord, action: string) => {
      const key = `${row.id}:${action}`;
      setBusyKey(key);
      setNotice(null);
      const result = await runTransition("timesheets", row.id, row.version, action);
      setBusyKey("");
      setNotice(result);
      if (result.ok) refreshEntries();
    },
    [refreshEntries],
  );

  const actionCell = useCallback(
    (row: OperationalRecord) => {
      const options = TRANSITIONS[row.status] ?? [];
      if (options.length === 0) {
        return <span className="text-[11px] text-muted-foreground">No action available</span>;
      }
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          {options.map((option) => {
            const key = `${row.id}:${option.action}`;
            const busy = busyKey === key;
            return (
              <button
                key={option.action}
                type="button"
                disabled={busyKey !== ""}
                onClick={() => void act(row, option.action)}
                className={`inline-flex h-10 sm:h-8 items-center rounded-lg border px-2.5 text-[11px] font-semibold transition-colors duration-150 disabled:opacity-50 ${actionClass(option.intent)}`}
              >
                {busy ? "Working…" : option.label}
              </button>
            );
          })}
        </div>
      );
    },
    [act, busyKey],
  );

  const entryColumns: Column<OperationalRecord>[] = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{nameOf(row.employeeId)}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-muted-foreground">{row.id}</p>
          </div>
        ),
      },
      { key: "project", header: "Project", render: (row) => projectCell(row.projectId) },
      {
        key: "workDate",
        header: "Work date",
        render: (row) => (
          <div>
            <p className="text-sm text-foreground">{dateLabel(row.workDate, "Not recorded")}</p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">{str(row.workDate, "—")}</p>
          </div>
        ),
      },
      {
        key: "minutes",
        header: "Duration",
        align: "right",
        render: (row) => (
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minutesLabel(num(row.minutes))}</span>
        ),
      },
      {
        key: "task",
        header: "Task",
        render: (row) => <span className="text-sm text-foreground">{str(row.task, "Not recorded")}</span>,
      },
      {
        key: "billing",
        header: "Billing",
        render: (row) => <span className="text-sm text-muted-foreground">{billingLabel(row.billing)}</span>,
      },
      {
        key: "notes",
        header: "Notes",
        render: (row) => (
          <span className="block max-w-64 truncate text-[12px] text-muted-foreground">{str(row.notes, "No notes")}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusPill tone={statusTone(row.status)}>{humanize(row.status)}</StatusPill>,
      },
      { key: "actions", header: "Actions", align: "right", render: actionCell },
    ],
    [actionCell, nameOf, projectCell],
  );

  const approvalColumns: Column<OperationalRecord>[] = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{nameOf(row.employeeId)}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-muted-foreground">{row.id}</p>
          </div>
        ),
      },
      { key: "project", header: "Project", render: (row) => projectCell(row.projectId) },
      {
        key: "workDate",
        header: "Work date",
        render: (row) => <span className="text-sm text-foreground">{dateLabel(row.workDate, "Not recorded")}</span>,
      },
      {
        key: "minutes",
        header: "Duration",
        align: "right",
        render: (row) => (
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minutesLabel(num(row.minutes))}</span>
        ),
      },
      {
        key: "billing",
        header: "Billing",
        render: (row) => <span className="text-sm text-muted-foreground">{billingLabel(row.billing)}</span>,
      },
      {
        key: "ageing",
        header: "Waiting since entry created",
        align: "right",
        render: (row) => {
          const days = daysWaiting(row.createdAt);
          if (days === null) return <span className="text-[11px] text-muted-foreground">Creation time not recorded</span>;
          return (
            <span className="font-mono text-sm tabular-nums text-foreground">
              {days} {days === 1 ? "day waiting" : "days waiting"}
            </span>
          );
        },
      },
      { key: "actions", header: "Actions", align: "right", render: actionCell },
    ],
    [actionCell, nameOf, projectCell],
  );

  const productivityColumns = (unit: string): Column<Aggregate>[] => [
    {
      key: "label",
      header: unit,
      render: (group) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{group.label}</p>
          {group.sublabel && group.sublabel !== group.label && (
            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-muted-foreground">{group.sublabel}</p>
          )}
        </div>
      ),
    },
    {
      key: "entries",
      header: "Entries",
      align: "right",
      render: (group) => <span className="font-mono text-sm tabular-nums text-foreground">{group.entries}</span>,
    },
    {
      key: "minutes",
      header: "Total logged",
      align: "right",
      render: (group) => (
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minutesLabel(group.minutes)}</span>
      ),
    },
    {
      key: "billable",
      header: "Billable",
      align: "right",
      render: (group) => (
        <span className="font-mono text-sm tabular-nums text-foreground">{minutesLabel(group.billable)}</span>
      ),
    },
    {
      key: "share",
      header: "Billable share",
      render: (group) => (
        <div className="min-w-28">
          <ProgressMeter
            value={group.billable}
            max={group.minutes > 0 ? group.minutes : 1}
            label={<span className="font-mono tabular-nums">{shareOf(group.billable, group.minutes)}</span>}
          />
        </div>
      ),
    },
  ];

  const periodText = `${dateLabel(from, "the earliest entry")} to ${dateLabel(to, "today")}`;
  const filterText = [
    projectFilter ? `project ${projectText(projectFilter)}` : "",
    statusFilter ? `status ${humanize(statusFilter)}` : "",
  ]
    .filter(Boolean)
    .join(" and ");

  const tabs: TabDefinition[] = [
    { id: "entries", label: "Time entries", icon: ClipboardList, count: timesheets.loading ? undefined : filtered.length },
    { id: "productivity", label: "Productivity", icon: FolderKanban },
    { id: "approvals", label: "Awaiting approval", icon: Clock3, count: timesheets.loading ? undefined : awaiting.length },
  ];

  function listState() {
    if (timesheets.loading) {
      return <StateBlock tone="loading" icon={ClipboardList} title="Loading time entries…" description="Reading the timesheet worklist." />;
    }
    if (timesheets.error) {
      return (
        <StateBlock
          tone="error"
          icon={AlertTriangle}
          title="Time entries could not be loaded"
          description={timesheets.error}
          action={
            <button
              type="button"
              onClick={() => refreshEntries()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
          }
        />
      );
    }
    return null;
  }

  const blocked = listState();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Workforce operations"
        title="Timesheets & productivity"
        description="Logged time, billable split and the approval queue, read live from the timesheet register. Figures are summed from the entries listed here — nothing is estimated."
        action={<OperationCreateDialog resource="timesheets" label="New time entry" onCreated={refreshEntries} />}
      />

      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`mb-4 rounded-lg border p-3 text-sm ${
            notice.ok
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          }`}
        >
          {notice.message}
        </p>
      )}

      {projects.error && (
        <p role="alert" className="mb-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
          Project names could not be loaded, so entries show their raw project reference. {projects.error}
        </p>
      )}

      <Surface className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[12px] font-semibold text-muted-foreground">
            Period from
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className={`mt-1.5 font-mono tabular-nums ${FIELD_CONTROL}`}
            />
          </label>
          <label className="block text-[12px] font-semibold text-muted-foreground">
            Period to
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className={`mt-1.5 font-mono tabular-nums ${FIELD_CONTROL}`}
            />
          </label>
          <label className="block text-[12px] font-semibold text-muted-foreground">
            Project
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className={`mt-1.5 ${FIELD_CONTROL}`}
            >
              <option value="">All projects</option>
              {projects.rows.map((project) => (
                <option key={project.id} value={project.id}>
                  {[str(project.code), str(project.name)].filter(Boolean).join(" · ") || project.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-muted-foreground">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={`mt-1.5 ${FIELD_CONTROL}`}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-[12px] text-muted-foreground">
            Showing {periodText}
            {filterText ? `, limited to ${filterText}` : ""}. Work dates are matched against the period.
          </p>
          <button
            type="button"
            aria-label="Reload timesheet records"
            disabled={timesheets.loading}
            onClick={() => refreshEntries()}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </Surface>

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Timesheet views" />

      <TabPanel id="entries" active={tab}>
        {blocked ?? (
          <>
            {filtered.length > 0 && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Total logged in period"
                  value={minutesLabel(totals.logged)}
                  hint={`${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} between ${periodText}`}
                  icon={CalendarRange}
                  tone="primary"
                />
                <StatTile
                  label="Billable time"
                  value={minutesLabel(totals.billable)}
                  hint={shareOf(totals.billable, totals.logged)}
                  icon={CheckCircle2}
                  tone="success"
                />
                <StatTile
                  label="Non-billable time"
                  value={minutesLabel(totals.nonBillable)}
                  hint="Entries marked not billable"
                  icon={Clock3}
                  tone="info"
                />
                <StatTile
                  label="Awaiting approval"
                  value={totals.submitted}
                  hint="Submitted entries inside this period"
                  icon={Users}
                  tone="warning"
                />
              </div>
            )}

            <Surface className="p-0">
              <div className="border-b border-border p-5">
                <SectionHeading
                  title="Time entries"
                  description={`Entries whose work date falls between ${periodText}${filterText ? `, limited to ${filterText}` : ""}.`}
                />
              </div>
              <DataTable
                columns={entryColumns}
                rows={filtered}
                rowKey={(row) => row.id}
                minWidth={1180}
                caption="Timesheet entries for the selected period"
                empty={
                  <StateBlock
                    icon={ClipboardList}
                    title={`No time entries between ${periodText}`}
                    description={
                      filterText
                        ? `Nothing matches ${filterText} in this period. Widen the period or clear the filters.`
                        : "Nothing has been logged against this period yet. Add an entry to start the register."
                    }
                    action={
                      <OperationCreateDialog
                        resource="timesheets"
                        label="New time entry"
                        onCreated={refreshEntries}
                      />
                    }
                  />
                }
              />
            </Surface>
          </>
        )}
      </TabPanel>

      <TabPanel id="productivity" active={tab}>
        {blocked ?? (
          <>
            <Surface className="mb-6 p-5">
              <SectionHeading
                title="How these figures are produced"
                description={`Both tables sum the ${filtered.length} timesheet ${filtered.length === 1 ? "entry" : "entries"} whose work date falls between ${periodText}${filterText ? `, limited to ${filterText}` : ""}. Source: the timesheet register. Billable share is billable minutes divided by total minutes logged; entries with no billing value count towards the total but not the billable figure.`}
              />
            </Surface>

            {filtered.length === 0 ? (
              <Surface className="p-0">
                <StateBlock
                  icon={FolderKanban}
                  title={`No time logged between ${periodText}`}
                  description="Productivity is not calculated for an empty period. Change the period or clear the filters to see real figures."
                />
              </Surface>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <Surface className="p-0">
                  <div className="border-b border-border p-5">
                    <SectionHeading title="By project" description="Logged time per project in the selected period." />
                  </div>
                  <DataTable
                    columns={productivityColumns("Project")}
                    rows={byProject}
                    rowKey={(group) => group.key || "unassigned"}
                    minWidth={620}
                    caption="Logged time grouped by project"
                  />
                </Surface>

                <Surface className="p-0">
                  <div className="border-b border-border p-5">
                    <SectionHeading title="By person" description="Logged time per employee in the selected period." />
                  </div>
                  <DataTable
                    columns={productivityColumns("Employee")}
                    rows={byPerson}
                    rowKey={(group) => group.key || "unassigned"}
                    minWidth={620}
                    caption="Logged time grouped by employee"
                  />
                </Surface>
              </div>
            )}
          </>
        )}
      </TabPanel>

      <TabPanel id="approvals" active={tab}>
        {blocked ?? (
          <Surface className="p-0">
            <div className="border-b border-border p-5">
              <SectionHeading
                title="Awaiting approval"
                description="Every submitted entry in this worklist, oldest first. The period filter above does not apply here, so nothing waiting is hidden."
              />
              <p className="mt-3 rounded-lg border border-info/25 bg-info/10 p-3 text-[12px] leading-[18px] text-info">
                Segregation of duties: the server refuses an approval when the approver raised the entry or the entry
                belongs to them. If an action is refused, the server&rsquo;s own message is shown above unchanged.
              </p>
            </div>
            <DataTable
              columns={approvalColumns}
              rows={awaiting}
              rowKey={(row) => row.id}
              minWidth={980}
              caption="Timesheet entries awaiting approval, oldest first"
              empty={
                <StateBlock
                  icon={CheckCircle2}
                  title="Nothing is awaiting approval"
                  description="No timesheet entry in this worklist is in the submitted state."
                />
              }
            />
          </Surface>
        )}
      </TabPanel>
    </div>
  );
}
