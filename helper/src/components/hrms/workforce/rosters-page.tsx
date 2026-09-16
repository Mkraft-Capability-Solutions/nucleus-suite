"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const MODULE = "rosters";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { operationalResources, type OperationalResource } from "@/lib/operational-catalog";
import { humanize } from "@/lib/workflow-catalog";
import { detectionIntervals, detectionWindowOverlaps, type ClockInterval } from "@/lib/hr-rules";
import { workforcePolicyDefaults } from "@/lib/workforce-policy";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  AvatarMark,
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
  num,
  runTransition,
  statusTone,
  str,
  useOperational,
  usePeople,
  type OperationalRecord,
  type OperationalState,
} from "./records";

/**
 * Shift Planning & Rosters.
 *
 * Everything on this page is derived from the two catalog resources it reads —
 * `rosters` and `shifts`. Counts, coverage shares and the overlapping punch-in
 * warning are computed from the records the signed-in user is permitted to see;
 * nothing is sampled, modelled or filled in.
 */

const graceDefaultMinutes = workforcePolicyDefaults.lateness.graceMinutes;

type Transitions = OperationalResource["transitions"];

const rosterTransitions: Transitions = operationalResources.rosters.transitions;
const shiftTransitions: Transitions = operationalResources.shifts.transitions;

/** Actions the catalog declares for this resource that are legal from `status`. */
function legalActions(transitions: Transitions, status: string): string[] {
  return Object.entries(transitions)
    .filter(([, transition]) => transition.from.includes(status))
    .map(([action]) => action);
}

function actionClasses(action: string): string {
  if (action === "approve" || action === "publish") {
    return "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15";
  }
  if (action === "reject" || action === "cancel") {
    return "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15";
  }
  if (action === "return" || action === "withdraw" || action === "retire") {
    return "border-warning/25 bg-warning/10 text-warning hover:bg-warning/15";
  }
  return "border-border bg-secondary text-foreground hover:bg-secondary/70";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function textCell(value: unknown, fallback = "Not set") {
  const text = str(value);
  if (!text) return <span className="text-muted-foreground">{fallback}</span>;
  return <span className="text-foreground">{text}</span>;
}

function monoCell(value: unknown, fallback = "Not set") {
  const text = str(value);
  if (!text) return <span className="text-muted-foreground">{fallback}</span>;
  return <span className="font-mono text-[12px] tabular-nums text-foreground">{text}</span>;
}

function minutesCell(value: unknown, fallback = "Not set") {
  const parsed = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(parsed)) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }
  return <span className="font-mono text-[12px] tabular-nums text-foreground">{minutesLabel(parsed)}</span>;
}

/** Parses `HH:MM` (or `HH:MM:SS`) into minutes past midnight; null when unreadable. */
function parseClock(value: unknown): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * The same rule the server enforces on save (RL-19), imported rather than copied so
 * the badge below can never disagree with the refusal the save returns.
 */
type ShiftWindow = { code: string; window: string; intervals: ClockInterval[] };

function tally(rows: OperationalRecord[], field: string, fallback: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = str(row[field], fallback);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

type Notice = { ok: boolean; text: string };
type CoverageRow = { label: string; count: number };

/**
 * One of the two attendance policies the engine reads with the shift master. The
 * record itself is edited on its own workflow section; this card only says what is
 * published and where to change it.
 */
function PolicyCard({
  title,
  formCode,
  description,
  href,
  state,
  lines,
}: {
  title: string;
  formCode: string;
  description: string;
  href: string;
  state: OperationalState;
  /** What the published records say; empty when nothing is published. */
  lines: string[];
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-[13px] leading-[20px] text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formCode}</span>
      </div>
      <div className="mt-3 text-[13px] leading-[20px]">
        {state.error ? (
          <p className="text-destructive">{state.error}</p>
        ) : state.loading ? (
          <p className="text-muted-foreground">Loading published records.</p>
        ) : lines.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing published. The engine falls back to the approved attendance rule set, then to the declared
            policy, which refuses to guess any value the workbook leaves unstated.
          </p>
        ) : (
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line} className="font-mono text-[12px] tabular-nums text-foreground">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        href={href}
        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
      >
        Open {title.toLowerCase()}
      </Link>
    </div>
  );
}

export function RostersPage() {
  const rosters = useOperational("rosters");
  const shifts = useOperational("shifts");
  // F-SHF-03 and F-ATT-06: the two policies the engine reads alongside the shift
  // master. Only published records count, which is the same test the server applies.
  const nightRules = useOperational("night-extension-rules");
  const gracePolicies = useOperational("grace-late-policies");
  const { nameOf } = usePeople();
  const [tab, setTab] = useState("plan");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const refreshRosters = rosters.refresh;
  const refreshShifts = shifts.refresh;

  const publishedNightRules = nightRules.rows.filter((row) => row.status === "published");
  // The grace policy in force: latest effective date wins, the order the engine
  // uses. A future-dated policy is still listed as published but is not yet read.
  const today = new Date().toISOString().slice(0, 10);
  const activeGracePolicy = gracePolicies.rows
    .filter((row) => row.status === "published" && str(row.effectiveFrom).slice(0, 10) <= today)
    .sort((left, right) => str(right.effectiveFrom).localeCompare(str(left.effectiveFrom)))[0];
  const graceFallbackMinutes = activeGracePolicy ? num(activeGracePolicy.graceInMinutes, graceDefaultMinutes) : graceDefaultMinutes;

  const act = useCallback(
    async (resource: "rosters" | "shifts", row: OperationalRecord, action: string, label: string) => {
      const key = `${resource}:${row.id}:${action}`;
      setBusy(key);
      setNotice(null);
      const result = await runTransition(resource, row.id, row.version, action);
      setNotice({
        ok: result.ok,
        text: result.ok ? `${humanize(action)} applied to ${label}. ${result.message}` : result.message,
      });
      if (result.ok) {
        if (resource === "rosters") refreshRosters();
        else refreshShifts();
      }
      setBusy("");
    },
    [refreshRosters, refreshShifts],
  );

  function actionCell(resource: "rosters" | "shifts", transitions: Transitions, row: OperationalRecord, label: string) {
    const actions = legalActions(transitions, row.status);
    if (actions.length === 0) {
      return <span className="text-[12px] text-muted-foreground">No action from {humanize(row.status)}</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => {
          const key = `${resource}:${row.id}:${action}`;
          const running = busy === key;
          return (
            <button
              key={action}
              type="button"
              disabled={busy !== ""}
              aria-busy={running}
              onClick={() => {
                void act(resource, row, action, label);
              }}
              className={cn(
                "inline-flex h-10 items-center rounded-lg border px-3 text-xs font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                actionClasses(action),
              )}
            >
              {running ? `${humanize(action)}…` : humanize(action)}
            </button>
          );
        })}
      </div>
    );
  }

  const rosterRows = rosters.rows;
  const shiftRows = shifts.rows;
  const publishedRosters = rosterRows.filter((row) => row.status === "published");
  const awaitingApproval = rosterRows.filter((row) => row.status === "submitted").length;
  const needsAttention = rosterRows.filter((row) => row.status === "returned" || row.status === "rejected").length;

  const publishedShifts = shiftRows.filter((row) => row.status === "published");
  const readableWindows: ShiftWindow[] = [];
  const unreadableWindows: string[] = [];
  for (const row of publishedShifts) {
    const code = str(row.shiftCode, str(row.name, str(row.id, "Unnamed shift")));
    const from = parseClock(row.earliestIn);
    const to = parseClock(row.latestIn);
    if (from === null || to === null) {
      unreadableWindows.push(code);
      continue;
    }
    readableWindows.push({
      code,
      window: `${str(row.earliestIn)}–${str(row.latestIn)}`,
      intervals: detectionIntervals(from, to),
    });
  }
  const overlaps = detectionWindowOverlaps(readableWindows);

  const rosterColumns: Column<OperationalRecord>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => {
        const name = nameOf(row.employeeId);
        return (
          <div className="flex items-center gap-3">
            <AvatarMark initials={initialsOf(name)} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
                {str(row.employeeId, "No employee reference")}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: "shiftCode", header: "Shift code", render: (row) => monoCell(row.shiftCode, "Unassigned") },
    {
      key: "dates",
      header: "Date range",
      render: (row) => (
        <span className="font-mono text-[12px] tabular-nums text-foreground">
          {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
        </span>
      ),
    },
    { key: "site", header: "Site", render: (row) => textCell(row.site, "No site") },
    { key: "break", header: "Break", align: "right", render: (row) => minutesCell(row.breakMinutes) },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)} dot>{humanize(row.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        actionCell(
          "rosters",
          rosterTransitions,
          row,
          `${nameOf(row.employeeId)} · ${str(row.shiftCode, "no shift code")}`,
        ),
    },
  ];

  const shiftColumns: Column<OperationalRecord>[] = [
    { key: "shiftCode", header: "Shift code", render: (row) => monoCell(row.shiftCode, "No code") },
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{str(row.name, "Unnamed shift")}</p>
          <p className="truncate text-[11px] text-muted-foreground">{str(row.site, "All sites")}</p>
        </div>
      ),
    },
    {
      key: "window",
      header: "Window",
      render: (row) => (
        <span className="font-mono text-[12px] tabular-nums text-foreground">
          {str(row.startTime, "—")}–{str(row.endTime, "—")}
        </span>
      ),
    },
    { key: "duration", header: "Duration", align: "right", render: (row) => minutesCell(row.durationMinutes) },
    {
      key: "grace",
      header: "Grace in / out",
      align: "right",
      render: (row) => {
        const graceIn = Number(row.graceInMinutes);
        const graceOut = Number(row.graceOutMinutes);
        if (!Number.isFinite(graceIn) || !Number.isFinite(graceOut)) {
          return <span className="text-muted-foreground">Policy default {graceFallbackMinutes}m</span>;
        }
        return (
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {graceIn}m / {graceOut}m
          </span>
        );
      },
    },
    { key: "break", header: "Break", align: "right", render: (row) => minutesCell(row.breakMinutes) },
    {
      key: "thresholds",
      header: "Full / half day",
      align: "right",
      render: (row) => {
        const full = Number(row.fullDayMinutes);
        const half = Number(row.halfDayMinutes);
        if (!Number.isFinite(full) || !Number.isFinite(half)) {
          return <span className="text-muted-foreground">Not set</span>;
        }
        return (
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {minutesLabel(full)} / {minutesLabel(half)}
          </span>
        );
      },
    },
    {
      key: "punchWindow",
      header: "Punch-in window",
      render: (row) => {
        const from = str(row.earliestIn);
        const to = str(row.latestIn);
        if (!from || !to) return <span className="text-muted-foreground">Not set</span>;
        const code = str(row.shiftCode, str(row.name, str(row.id, "Unnamed shift")));
        const clashes = overlaps.some((pair) => pair.left.code === code || pair.right.code === code);
        return (
          <span className="flex items-center gap-2">
            <span className="font-mono text-[12px] tabular-nums text-foreground">
              {from}–{to}
            </span>
            {clashes && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                Overlaps
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "ot",
      header: "OT",
      render: (row) => {
        const value = str(row.otEligible);
        if (!value) return <span className="text-muted-foreground">Not set</span>;
        return (
          <StatusPill tone={value === "yes" ? "info" : "neutral"}>
            {value === "yes" ? "OT eligible" : "No OT"}
          </StatusPill>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)} dot>{humanize(row.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        actionCell("shifts", shiftTransitions, row, str(row.shiftCode, str(row.name, "this shift"))),
    },
  ];

  const coverageColumns = (total: number, heading: string): Column<CoverageRow>[] => [
    {
      key: "label",
      header: heading,
      render: (row) => <span className="text-sm font-medium text-foreground">{row.label}</span>,
    },
    {
      key: "count",
      header: "Published rosters",
      align: "right",
      render: (row) => (
        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{row.count}</span>
      ),
    },
    {
      key: "share",
      header: "Share of published",
      width: "40%",
      render: (row) => (
        <ProgressMeter
          value={row.count}
          max={total}
          label={
            <span className="font-mono tabular-nums">
              {Math.round((row.count / (total || 1)) * 100)}% of {total}
            </span>
          }
        />
      ),
    },
  ];

  const byShiftCode = tally(publishedRosters, "shiftCode", "No shift code");
  const bySite = tally(publishedRosters, "site", "No site recorded");

  const tabs: TabDefinition[] = [
    { id: "plan", label: "Roster plan", icon: CalendarDays, count: rosters.loading ? undefined : rosterRows.length },
    { id: "shifts", label: "Shift master", icon: Clock3, count: shifts.loading ? undefined : shiftRows.length },
    {
      id: "coverage",
      label: "Coverage",
      icon: Layers,
      count: rosters.loading ? undefined : publishedRosters.length,
    },
  ];

  const nightRulesLink = `/${MODULE}?section=${encodeURIComponent("operations/night-extension-rules")}`;
  const gracePoliciesLink = `/${MODULE}?section=${encodeURIComponent("operations/grace-late-policies")}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="WORKFORCE OPERATIONS"
        title="Shift planning & rosters"
        description="Plan and approve rostered shifts, maintain the shift master that every attendance calculation reads, and check how published coverage is distributed across shifts and sites."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Refresh roster and shift records"
              onClick={() => {
                refreshRosters();
                refreshShifts();
                nightRules.refresh();
                gracePolicies.refresh();
              }}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
            <OperationCreateDialog resource="rosters" label="New roster entry" onCreated={refreshRosters} />
          </div>
        }
      />

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Shift planning views" />

      {notice && (
        <div
          role={notice.ok ? "status" : "alert"}
          className={cn(
            "mb-4 rounded-lg border p-3 text-sm",
            notice.ok
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/25 bg-destructive/10 text-destructive",
          )}
        >
          {notice.text}
        </div>
      )}

      <TabPanel id="plan" active={tab}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Roster records in view"
            value={rosters.loading ? "—" : rosterRows.length}
            hint="Rosters your permissions return"
            icon={CalendarDays}
            tone="primary"
          />
          <StatTile
            label="Awaiting approval"
            value={rosters.loading ? "—" : awaitingApproval}
            hint="Status submitted"
            icon={Clock3}
            tone="warning"
          />
          <StatTile
            label="Published"
            value={rosters.loading ? "—" : publishedRosters.length}
            hint="Live for attendance matching"
            icon={CheckCircle2}
            tone="success"
          />
          <StatTile
            label="Needs attention"
            value={rosters.loading ? "—" : needsAttention}
            hint="Returned or rejected"
            icon={AlertTriangle}
            tone="danger"
          />
        </div>

        <Surface className="mt-6 p-5">
          <SectionHeading
            title="Roster plan"
            description={`Rostered shifts and their approval state. Late arrivals are judged against the ${activeGracePolicy ? "published grace & late policy's" : "tenant grace default of"} ${graceFallbackMinutes} minutes unless the shift sets its own grace.`}
            action={
              <OperationCreateDialog
                resource="rosters"
                label="Add roster"
                variant="secondary"
                onCreated={refreshRosters}
              />
            }
          />
          {rosters.error ? (
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Roster records could not be loaded"
              description={rosters.error}
              action={
                <button
                  type="button"
                  onClick={refreshRosters}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          ) : rosters.loading ? (
            <StateBlock
              tone="loading"
              icon={CalendarDays}
              title="Loading roster records"
              description="Reading the roster register you have access to."
            />
          ) : (
            <DataTable
              caption="Rostered shifts with their approval state and available actions"
              columns={rosterColumns}
              rows={rosterRows}
              rowKey={(row) => row.id}
              minWidth={1180}
              empty={
                <StateBlock
                  icon={CalendarDays}
                  title="No roster records"
                  description="No rostered shifts are visible to you yet. Add the first roster entry to begin planning."
                  action={
                    <OperationCreateDialog
                      resource="rosters"
                      label="New roster entry"
                      onCreated={refreshRosters}
                    />
                  }
                />
              }
            />
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="shifts" active={tab}>
        {overlaps.length > 0 && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-warning/25 bg-warning/10 p-4 text-warning"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-semibold">
                  Overlapping punch-in windows among published shifts
                </h3>
                <p className="mt-1 text-[13px] leading-[20px]">
                  Shift detection matches a punch time against the earliest-in to latest-in window. Overlapping
                  windows are refused when a shift is saved, so these pairs are already published and must be
                  narrowed here before either record can be edited again.
                </p>
                <ul className="mt-2 space-y-1">
                  {overlaps.map((pair) => (
                    <li key={`${pair.left.code}|${pair.right.code}`} className="font-mono text-[12px] tabular-nums">
                      {pair.left.code} ({pair.left.window}) overlaps {pair.right.code} ({pair.right.window})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <Surface className="mb-4 p-5">
          <SectionHeading
            title="Policies read with these shifts"
            description="The night extension rule (RL-18) and the grace & late policy (RL-17) the attendance engine applies to every shift below. Only a published record changes engine behaviour."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <PolicyCard
              title="Night extension rules"
              formCode="F-SHF-03"
              description="Lets an employee who worked past the trigger hour arrive late the next day and keep a full day."
              href={nightRulesLink}
              state={nightRules}
              lines={publishedNightRules.map((row) =>
                [
                  `Shift ${str(row.appliesToShiftCode, "any")}`,
                  `after ${str(row.triggerAfterTime, "not set")}`,
                  `in by ${str(row.permittedArrivalUntil, "not set")}`,
                  `out by ${str(row.minimumDepartureTime, "not set")}`,
                  humanize(str(row.resultingDayStatus, "present")),
                  str(row.maxUsesPerMonth) ? `max ${str(row.maxUsesPerMonth)}/month` : "no monthly cap set",
                ].join(" · "),
              )}
            />
            <PolicyCard
              title="Grace & late policies"
              formCode="F-ATT-06"
              description="Grace minutes, the lates allowed each month, the consequence beyond that, and the grade exempt from it."
              href={gracePoliciesLink}
              state={gracePolicies}
              lines={
                activeGracePolicy
                  ? [
                    `${str(activeGracePolicy.policyCode, "Policy")} · effective ${dateLabel(activeGracePolicy.effectiveFrom)}`,
                    `${str(activeGracePolicy.graceInMinutes, "?")}m in / ${str(activeGracePolicy.graceOutMinutes, "?")}m out grace`,
                    `${str(activeGracePolicy.latesAllowedPerMonth, "?")} lates a ${humanize(str(activeGracePolicy.counterResetBasis, "calendar_month")).toLowerCase()}, then ${humanize(str(activeGracePolicy.consequenceBeyondAllowance, "half_day")).toLowerCase()}`,
                    str(activeGracePolicy.exemptFromGradeRank)
                      ? `exempt from grade rank ${str(activeGracePolicy.exemptFromGradeRank)}`
                      : "exempt grade rank not set: refused when a late needs it",
                  ]
                  : []
              }
            />
          </div>
        </Surface>

        <Surface className="p-5">
          <SectionHeading
            title="Shift master"
            description={`The single source of shift definitions for the product. Where a shift leaves grace unset, the ${activeGracePolicy ? "published grace & late policy's" : "tenant late-grace default of"} ${graceFallbackMinutes} minutes applies.`}
            action={
              <OperationCreateDialog
                resource="shifts"
                label="Add shift"
                variant="secondary"
                onCreated={refreshShifts}
              />
            }
          />
          {shifts.error ? (
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Shift definitions could not be loaded"
              description={shifts.error}
              action={
                <button
                  type="button"
                  onClick={refreshShifts}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          ) : shifts.loading ? (
            <StateBlock
              tone="loading"
              icon={Clock3}
              title="Loading shift definitions"
              description="Reading the shift master you have access to."
            />
          ) : (
            <>
              <DataTable
                caption="Shift definitions with windows, thresholds and available actions"
                columns={shiftColumns}
                rows={shiftRows}
                rowKey={(row) => row.id}
                minWidth={1640}
                empty={
                  <StateBlock
                    icon={Clock3}
                    title="No shift definitions"
                    description="The shift master is empty for your scope. Define a shift before rostering against it."
                    action={
                      <OperationCreateDialog
                        resource="shifts"
                        label="New shift definition"
                        onCreated={refreshShifts}
                      />
                    }
                  />
                }
              />
              <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
                Overlap check covered{" "}
                <span className="font-mono tabular-nums">{readableWindows.length}</span> published shift
                {readableWindows.length === 1 ? "" : "s"} with a readable punch-in window
                {unreadableWindows.length > 0 && (
                  <>
                    {" "}
                    and skipped <span className="font-mono tabular-nums">{unreadableWindows.length}</span> without one (
                    {unreadableWindows.join(", ")})
                  </>
                )}
                . Draft, submitted and retired shifts are not checked because they do not drive punch matching.
              </p>
            </>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="coverage" active={tab}>
        <Surface className="p-5">
          <SectionHeading
            title="Coverage"
            description="Published roster records grouped by shift code and by site. Derived from the rosters currently visible to you — no separate query and no other period."
          />
          {rosters.error ? (
            <StateBlock
              tone="error"
              icon={AlertTriangle}
              title="Coverage could not be derived"
              description={rosters.error}
              action={
                <button
                  type="button"
                  onClick={refreshRosters}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  Try again
                </button>
              }
            />
          ) : rosters.loading ? (
            <StateBlock
              tone="loading"
              icon={Layers}
              title="Loading roster records"
              description="Coverage is derived once the roster register has loaded."
            />
          ) : publishedRosters.length === 0 ? (
            <StateBlock
              icon={Layers}
              title="No published rosters"
              description="Coverage is counted from published rosters only. Approve and publish roster entries to see the breakdown."
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="font-heading text-sm font-semibold text-foreground">By shift code</h3>
                </div>
                <DataTable
                  caption="Published roster count per shift code"
                  columns={coverageColumns(publishedRosters.length, "Shift code")}
                  rows={byShiftCode}
                  rowKey={(row) => row.label}
                  minWidth={520}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="font-heading text-sm font-semibold text-foreground">By site</h3>
                </div>
                <DataTable
                  caption="Published roster count per site"
                  columns={coverageColumns(publishedRosters.length, "Site")}
                  rows={bySite}
                  rowKey={(row) => row.label}
                  minWidth={520}
                />
              </div>
            </div>
          )}
        </Surface>
      </TabPanel>
    </div>
  );
}
