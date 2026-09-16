"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Coins,
  Layers,
  RefreshCw,
} from "lucide-react";
import { holidayMultiplierFor, workforcePolicyDefaults } from "@/lib/workforce-policy";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  DataTable,
  PageIntro,
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
  num,
  runTransition,
  statusTone,
  str,
  useOperational,
  type OperationalRecord,
} from "./records";

/**
 * Field Workforce.
 *
 * Owns the rules that decide, for a field or plant worker, whether a day is a
 * rest day, whether overtime is payable, and which wage multiplier applies.
 * Every figure shown here is either stored on a record returned by the
 * operational API or read from `workforcePolicyDefaults`; nothing is sampled.
 */

const CATEGORIES = "worker-categories";
const CALENDARS = "plant-calendars";
const HOLIDAYS = "holidays";

const holidayPolicy = workforcePolicyDefaults.holiday;
const overtimePolicy = workforcePolicyDefaults.overtime;
const latenessPolicy = workforcePolicyDefaults.lateness;

type TransitionSpec = { action: string; label: string; from: string[] };

/** Transitions declared by the catalog for each resource, with their legal source statuses. */
const baseTransitions: TransitionSpec[] = [
  { action: "submit", label: "Submit", from: ["draft", "returned"] },
  { action: "approve", label: "Approve", from: ["submitted"] },
  { action: "return", label: "Return", from: ["submitted"] },
  { action: "reject", label: "Reject", from: ["submitted"] },
  { action: "cancel", label: "Cancel", from: ["draft", "returned", "submitted"] },
  { action: "publish", label: "Publish", from: ["approved"] },
];

const categoryTransitions: TransitionSpec[] = [
  ...baseTransitions,
  { action: "retire", label: "Retire", from: ["published"] },
];

const calendarTransitions: TransitionSpec[] = [
  ...baseTransitions,
  { action: "archive", label: "Archive", from: ["published"] },
];

const holidayTransitions: TransitionSpec[] = [
  ...baseTransitions,
  { action: "cancel_holiday", label: "Cancel holiday", from: ["published"] },
];

const statusWords: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  returned: "Returned",
  rejected: "Rejected",
  cancelled: "Cancelled",
  published: "Published",
  retired: "Retired",
  archived: "Archived",
};

function statusWord(status: string): string {
  return statusWords[status] ?? status.replace(/[_-]/g, " ");
}

/** Plain-language rest-day rule for a worker category. */
const restDayPhrases: Record<string, string> = {
  fixed_sunday: "Weekly rest day every Sunday",
  fixed_sunday_alt_saturday: "Weekly rest day every Sunday, plus alternate Saturdays",
  rotational_weekly_off: "One rotational rest day each week, set by the roster",
  none: "No weekly rest day — daily wage",
};

/** The same rule stated compactly for a calendar row. */
const weeklyOffPhrases: Record<string, string> = {
  fixed_sunday: "Sunday weekly off",
  fixed_sunday_alt_saturday: "Sunday + alternate Saturday",
  rotational_weekly_off: "Rotational weekly off",
  none: "No weekly off",
};

const otPhrases: Record<string, string> = {
  all: "Overtime payable on any day worked beyond the shift",
  none: "No overtime — this category is not eligible",
  restday_holiday_only: "Overtime on rest days and holidays only",
};

const wageTypePhrases: Record<string, string> = {
  monthly: "Monthly wage",
  daily: "Daily wage",
};

const penaltyPhrases: Record<string, string> = {
  half_day: "half a day is deducted",
  absent: "the day is marked absent",
  none: "no penalty is applied",
};

const holidayTypeWords: Record<string, string> = {
  national: "National",
  state: "State",
  festival: "Festival",
  optional: "Optional",
};

function phrase(map: Record<string, string>, value: string, fallback: string): string {
  return map[value] ?? (value ? value.replace(/[_-]/g, " ") : fallback);
}

/** Late-grace sentence for a category, stated from policy rather than a literal. */
function gracePhrase(exempt: boolean): string {
  if (exempt) return "Exempt from the late-grace penalty";
  return `Late after ${latenessPolicy.graceMinutes} minutes; ${latenessPolicy.forgivenInstancesPerMonth} instances forgiven each month, then ${phrase(penaltyPhrases, latenessPolicy.penalty, "a penalty applies")}`;
}

/**
 * Policy default multiplier for a holiday type. The mapping is a tenant policy
 * setting, not a decision this page makes, so it is resolved from the policy
 * module rather than inferred here.
 */
function policyMultiplier(holidayType: string): number {
  return holidayMultiplierFor(holidayType, holidayPolicy);
}

type Multiplier = { value: number; fromPolicy: boolean };

function resolveMultiplier(row: OperationalRecord): Multiplier {
  const stored = num(row.wageMultiplier, 0);
  if (stored > 0) return { value: stored, fromPolicy: false };
  return { value: policyMultiplier(str(row.holidayType)), fromPolicy: true };
}

function multiplierLabel(value: number): string {
  return `${value.toFixed(1)}x`;
}

function TransitionActions({
  transitions,
  status,
  busyAction,
  pending,
  onRun,
}: {
  transitions: TransitionSpec[];
  status: string;
  busyAction: string;
  pending: boolean;
  onRun: (action: string, label: string) => void;
}) {
  const available = transitions.filter((transition) => transition.from.includes(status));
  if (available.length === 0) {
    return <span className="text-[12px] text-muted-foreground">No action available at {statusWord(status).toLowerCase()}</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {available.map((transition) => (
        <button
          key={transition.action}
          type="button"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            onRun(transition.action, transition.label);
          }}
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === transition.action ? `${transition.label}…` : transition.label}
        </button>
      ))}
    </div>
  );
}

function RuleLine({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:w-28">{term}</dt>
      <dd className="min-w-0 text-[13px] leading-5 text-foreground">{children}</dd>
    </div>
  );
}

function RefreshButton({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
    >
      <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function FieldWorkforcePage() {
  const categories = useOperational(CATEGORIES);
  const calendars = useOperational(CALENDARS);
  const holidays = useOperational(HOLIDAYS);

  const [tab, setTab] = useState("categories");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const runAction = useCallback(
    async (resource: string, row: OperationalRecord, action: string, label: string, refresh: () => void) => {
      setBusyKey(`${row.id}:${action}`);
      setFeedback(null);
      const result = await runTransition(resource, row.id, row.version, action);
      setBusyKey("");
      setFeedback({ ok: result.ok, message: result.ok ? `${label} completed.` : result.message });
      if (result.ok) refresh();
    },
    [],
  );

  const busyActionFor = useCallback(
    (id: string) => (busyKey.startsWith(`${id}:`) ? busyKey.slice(id.length + 1) : ""),
    [busyKey],
  );
  const pending = busyKey !== "";

  const calendarNames = useMemo(() => {
    const index = new Map<string, string>();
    for (const row of calendars.rows) {
      const code = str(row.locationCode);
      const name = str(row.name);
      index.set(row.id, [code, name].filter(Boolean).join(" · ") || row.id);
    }
    return index;
  }, [calendars.rows]);

  const selectedCalendarName = selectedCalendarId ? calendarNames.get(selectedCalendarId) ?? selectedCalendarId : "";

  const holidayRows = useMemo(() => {
    const rows = selectedCalendarId
      ? holidays.rows.filter((row) => str(row.calendarId) === selectedCalendarId)
      : holidays.rows;
    return [...rows].sort((left, right) => str(left.holidayDate).localeCompare(str(right.holidayDate)));
  }, [holidays.rows, selectedCalendarId]);

  const publishedHolidays = holidayRows.filter((row) => row.status === "published").length;
  const doubleWageDays = holidayRows.filter((row) => resolveMultiplier(row).value >= 2).length;

  const tabs: TabDefinition[] = [
    { id: "categories", label: "Worker categories", icon: Layers, count: categories.loading ? "—" : categories.rows.length },
    { id: "calendars", label: "Plant work calendars", icon: CalendarRange, count: calendars.loading ? "—" : calendars.rows.length },
    { id: "holidays", label: "Statutory holidays", icon: CalendarDays, count: holidays.loading ? "—" : holidayRows.length },
  ];

  const introAction =
    tab === "calendars" ? (
      <OperationCreateDialog resource={CALENDARS} label="New plant calendar" onCreated={calendars.refresh} />
    ) : tab === "holidays" ? (
      <OperationCreateDialog resource={HOLIDAYS} label="New holiday" onCreated={holidays.refresh} />
    ) : (
      <OperationCreateDialog resource={CATEGORIES} label="New worker category" onCreated={categories.refresh} />
    );

  const calendarColumns: Column<OperationalRecord>[] = [
    {
      key: "locationCode",
      header: "Location",
      render: (row) => <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">{str(row.locationCode, "—")}</span>,
    },
    {
      key: "name",
      header: "Calendar",
      render: (row) => <span className="font-medium text-foreground">{str(row.name, "Unnamed calendar")}</span>,
    },
    {
      key: "stateCode",
      header: "State",
      render: (row) => <span className="font-mono text-[13px] tabular-nums text-muted-foreground">{str(row.stateCode, "—")}</span>,
    },
    {
      key: "calendarYear",
      header: "Year",
      render: (row) => <span className="font-mono text-[13px] tabular-nums text-foreground">{num(row.calendarYear) > 0 ? num(row.calendarYear) : "—"}</span>,
    },
    {
      key: "weeklyOffPattern",
      header: "Weekly off",
      render: (row) => <span className="text-[13px] text-muted-foreground">{phrase(weeklyOffPhrases, str(row.weeklyOffPattern), "Not set")}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)} dot>{statusWord(row.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <TransitionActions
          transitions={calendarTransitions}
          status={row.status}
          busyAction={busyActionFor(row.id)}
          pending={pending}
          onRun={(action, label) => void runAction(CALENDARS, row, action, label, calendars.refresh)}
        />
      ),
    },
  ];

  const holidayColumns: Column<OperationalRecord>[] = [
    {
      key: "holidayDate",
      header: "Date",
      render: (row) => <span className="font-medium text-foreground">{dateLabel(row.holidayDate)}</span>,
    },
    {
      key: "name",
      header: "Holiday",
      render: (row) => <span className="text-foreground">{str(row.name, "Unnamed holiday")}</span>,
    },
    {
      key: "holidayType",
      header: "Type",
      render: (row) => <span className="text-[13px] text-muted-foreground">{phrase(holidayTypeWords, str(row.holidayType), "Not set")}</span>,
    },
    {
      key: "wageMultiplier",
      header: "Wage & OT multiplier",
      render: (row) => {
        const multiplier = resolveMultiplier(row);
        return (
          <div className="min-w-0">
            <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">{multiplierLabel(multiplier.value)}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {multiplier.fromPolicy ? "Policy default for this type" : "Stored on the record"}
            </p>
          </div>
        );
      },
    },
    {
      key: "payable",
      header: "Payable",
      render: (row) =>
        str(row.payable) === "yes" ? (
          <StatusPill tone="success">Payable</StatusPill>
        ) : str(row.payable) === "no" ? (
          <StatusPill tone="neutral">Unpaid</StatusPill>
        ) : (
          <span className="text-[12px] text-muted-foreground">Not set</span>
        ),
    },
    {
      key: "calendarId",
      header: "Calendar",
      render: (row) => {
        const reference = str(row.calendarId);
        const resolved = calendarNames.get(reference);
        return resolved ? (
          <span className="text-[13px] text-muted-foreground">{resolved}</span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">{reference || "No calendar"}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)} dot>{statusWord(row.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <TransitionActions
          transitions={holidayTransitions}
          status={row.status}
          busyAction={busyActionFor(row.id)}
          pending={pending}
          onRun={(action, label) => void runAction(HOLIDAYS, row, action, label, holidays.refresh)}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Workforce operations"
        title="Field workforce"
        description="Worker categories, plant work calendars and statutory holidays decide whether a field or plant day is a rest day, whether overtime is payable, and which wage multiplier applies."
        action={introAction}
      />

      <Surface className="mb-6">
        <SectionHeading
          title="How a day is resolved"
          description="These three checks run in order for every field and plant day before wages or overtime are calculated."
        />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              step: 1,
              title: "Holiday",
              body: `The plant calendar is checked first. A holiday worked pays at the holiday multiplier — ${multiplierLabel(holidayPolicy.statutoryHolidayMultiplier)} by policy for a national or state holiday, unless the record stores its own value.`,
            },
            {
              step: 2,
              title: "Rest day",
              body: `If the day is not a holiday, the worker category's rest-day pattern decides whether it is a weekly off. A rest day worked pays at ${multiplierLabel(holidayPolicy.weeklyOffMultiplier)} by policy.`,
            },
            {
              step: 3,
              title: "Ordinary working day",
              body: `Otherwise the shift thresholds apply at ${multiplierLabel(holidayPolicy.workingDayMultiplier)}, and time beyond the shift counts as overtime at ${multiplierLabel(overtimePolicy.multiplier)} only where the category allows it.`,
            },
          ].map((item) => (
            <li key={item.step} className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-md border border-primary/20 bg-primary/10 font-mono text-[11px] font-bold tabular-nums text-primary">
                  {item.step}
                </span>
                <h3 className="font-heading text-sm font-semibold text-foreground">{item.title}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </Surface>

      {feedback && (
        <div
          role={feedback.ok ? "status" : "alert"}
          className={
            feedback.ok
              ? "mb-6 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success"
              : "mb-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {feedback.message}
        </div>
      )}

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Field workforce rule sets" />

      <TabPanel id="categories" active={tab}>
        <SectionHeading
          title="Worker categories"
          description="Each category is a rule set: how the worker is paid, when they rest, whether overtime is payable, and which statutory components apply."
          action={
            <div className="flex items-center gap-2">
              <OperationCreateDialog resource={CATEGORIES} label="New category" onCreated={categories.refresh} />
              <RefreshButton label="Reload worker categories" onClick={categories.refresh} busy={categories.loading} />
            </div>
          }
        />
        {categories.loading ? (
          <Surface>
            <StateBlock tone="loading" title="Loading worker categories…" description="Reading the published rule sets for field and plant workers." />
          </Surface>
        ) : categories.error ? (
          <Surface>
            <StateBlock
              tone="error"
              icon={AlertCircle}
              title="Worker categories could not be loaded"
              description={categories.error}
              action={
                <button
                  type="button"
                  onClick={categories.refresh}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          </Surface>
        ) : categories.rows.length === 0 ? (
          <Surface>
            <StateBlock
              icon={Layers}
              title="No worker categories yet"
              description="A worker category defines the wage type, rest-day pattern and overtime eligibility for a group of field or plant workers. Create the first one to start classifying days."
              action={<OperationCreateDialog resource={CATEGORIES} label="New worker category" onCreated={categories.refresh} />}
            />
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.rows.map((row) => {
              const components = str(row.statutoryComponents)
                .split(/[,\s]+/)
                .map((part) => part.trim())
                .filter(Boolean);
              const exempt = str(row.graceExempt) === "yes";
              return (
                <Surface key={row.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] font-bold uppercase tabular-nums tracking-[0.12em] text-muted-foreground">
                        {str(row.code, "No code")}
                      </p>
                      <h3 className="mt-1 font-heading text-[15px] font-semibold text-foreground">
                        {str(row.label, "Unnamed category")}
                      </h3>
                    </div>
                    <StatusPill tone={statusTone(row.status)} dot>{statusWord(row.status)}</StatusPill>
                  </div>

                  <dl className="mt-4 space-y-3 border-t border-border pt-4">
                    <RuleLine term="Wage">{phrase(wageTypePhrases, str(row.wageType), "Wage type not set")}</RuleLine>
                    <RuleLine term="Rest day">{phrase(restDayPhrases, str(row.restDayPattern), "Rest-day pattern not set")}</RuleLine>
                    <RuleLine term="Overtime">{phrase(otPhrases, str(row.otEligibility), "Overtime rule not set")}</RuleLine>
                    <RuleLine term="Late grace">{gracePhrase(exempt)}</RuleLine>
                    <RuleLine term="Statutory">
                      {components.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5">
                          {components.map((component) => (
                            <StatusPill key={component} tone="info">{component}</StatusPill>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No statutory components recorded</span>
                      )}
                    </RuleLine>
                    {str(row.notes) && <RuleLine term="Notes">{str(row.notes)}</RuleLine>}
                  </dl>

                  <div className="mt-4 border-t border-border pt-4">
                    <TransitionActions
                      transitions={categoryTransitions}
                      status={row.status}
                      busyAction={busyActionFor(row.id)}
                      pending={pending}
                      onRun={(action, label) => void runAction(CATEGORIES, row, action, label, categories.refresh)}
                    />
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="calendars" active={tab}>
        <SectionHeading
          title="Plant work calendars"
          description="One calendar per location and year. Select a calendar to filter the statutory holidays tab to it."
          action={
            <div className="flex items-center gap-2">
              <OperationCreateDialog resource={CALENDARS} label="New calendar" onCreated={calendars.refresh} />
              <RefreshButton label="Reload plant calendars" onClick={calendars.refresh} busy={calendars.loading} />
            </div>
          }
        />
        {selectedCalendarId && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill tone="info" dot>Holidays filtered to {selectedCalendarName}</StatusPill>
            <button
              type="button"
              onClick={() => setSelectedCalendarId("")}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold hover:bg-secondary"
            >
              Show all calendars
            </button>
          </div>
        )}
        <Surface className="p-0">
          {calendars.loading ? (
            <StateBlock tone="loading" title="Loading plant calendars…" description="Reading location calendars and their weekly-off patterns." />
          ) : calendars.error ? (
            <StateBlock
              tone="error"
              icon={AlertCircle}
              title="Plant calendars could not be loaded"
              description={calendars.error}
              action={
                <button
                  type="button"
                  onClick={calendars.refresh}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          ) : (
            <DataTable
              columns={calendarColumns}
              rows={calendars.rows}
              rowKey={(row) => row.id}
              minWidth={1040}
              caption="Plant work calendars by location and year"
              selectedKey={selectedCalendarId}
              onRowClick={(row) => setSelectedCalendarId((current) => (current === row.id ? "" : row.id))}
              empty={
                <StateBlock
                  icon={CalendarRange}
                  title="No plant calendars yet"
                  description="A plant calendar fixes the weekly-off pattern and holiday list for one location and year. Create the first calendar to attach holidays to it."
                  action={<OperationCreateDialog resource={CALENDARS} label="New plant calendar" onCreated={calendars.refresh} />}
                />
              }
            />
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="holidays" active={tab}>
        <SectionHeading
          title="Statutory holidays"
          description="Holidays are resolved before rest days. A holiday worked pays at its multiplier; where a record stores none, the policy default for its type applies."
          action={
            <div className="flex items-center gap-2">
              <OperationCreateDialog resource={HOLIDAYS} label="New holiday" onCreated={holidays.refresh} />
              <RefreshButton label="Reload statutory holidays" onClick={holidays.refresh} busy={holidays.loading} />
            </div>
          }
        />
        {selectedCalendarId && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill tone="info" dot>Calendar: {selectedCalendarName}</StatusPill>
            <button
              type="button"
              onClick={() => setSelectedCalendarId("")}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold hover:bg-secondary"
            >
              Show all calendars
            </button>
          </div>
        )}

        {holidays.loading ? (
          <Surface>
            <StateBlock tone="loading" title="Loading statutory holidays…" description="Reading holiday records and their wage multipliers." />
          </Surface>
        ) : holidays.error ? (
          <Surface>
            <StateBlock
              tone="error"
              icon={AlertCircle}
              title="Statutory holidays could not be loaded"
              description={holidays.error}
              action={
                <button
                  type="button"
                  onClick={holidays.refresh}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          </Surface>
        ) : holidayRows.length === 0 ? (
          <Surface>
            <StateBlock
              icon={CalendarDays}
              title={selectedCalendarId ? "No holidays on this calendar" : "No holidays configured"}
              description={
                selectedCalendarId
                  ? `${selectedCalendarName} has no holiday records yet. Add one, or clear the filter to see every calendar.`
                  : "Holidays drive the first check in the resolution order. Add the statutory holidays for a plant calendar to classify those days."
              }
              action={<OperationCreateDialog resource={HOLIDAYS} label="New holiday" onCreated={holidays.refresh} />}
            />
          </Surface>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatTile
                label="Holidays configured"
                value={holidayRows.length}
                icon={CalendarDays}
                tone="primary"
                hint={selectedCalendarId ? selectedCalendarName : "Across every loaded calendar"}
              />
              <StatTile
                label="Published"
                value={publishedHolidays}
                icon={CheckCircle2}
                tone="success"
                hint="Live for attendance and payroll"
              />
              <StatTile
                label="Double-wage days"
                value={doubleWageDays}
                icon={Coins}
                tone="warning"
                hint={`Multiplier ${multiplierLabel(2)} or above, stored or policy default`}
              />
            </div>
            <Surface className="p-0">
              <DataTable
                columns={holidayColumns}
                rows={holidayRows}
                rowKey={(row) => row.id}
                minWidth={1180}
                caption="Statutory holidays with wage multipliers and calendar"
              />
            </Surface>
          </>
        )}
      </TabPanel>
    </div>
  );
}
