"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  BookOpen,
  CalendarPlus,
  CircleSlash,
  Clock3,
  LogIn,
  LogOut,
  RefreshCcw,
  ShieldAlert,
  Target,
  Timer,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConcentricRings, MatrixHeatmap, ProgressGauge } from "../cockpit-charts";
import { EmployeeWelcomeHero } from "../hero/employee-welcome-hero";
import {
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StateBlock,
  StatusPill,
  Surface,
} from "../page-primitives";
import { currencyLabel, dateLabel, minutesLabel, useLive } from "../workforce/records";

/**
 * S8 Employee Home — the only employee-audience cockpit.
 *
 * Everything on this page is the signed-in employee's own record, read from
 * `/api/v1/cockpits/employee-home`, which takes its subject from the session
 * and accepts no employee identifier. Nothing is estimated: where the platform
 * has not produced a figure the panel says so (DESIGN_SYSTEM.md section 9),
 * and no person is ever rendered as a placeholder.
 *
 * The layout is single column at base because this is the cockpit most likely
 * to be opened on a phone; controls are 40px high and both circular charts
 * scale with their container.
 */

type Source<T> = { value: T; available: boolean; message?: string; origin?: string };

type ShiftPanel = {
  shiftCode: string | null;
  shiftName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  targetMinutes: number | null;
  workedMinutes: number | null;
  breakMinutes: number | null;
  punchedInAt: string | null;
  sessionOpen: boolean;
};

type LeaveRing = { label: string; value: number; max?: number };

type PayPanel = {
  period: string;
  periodLabel: string;
  isCurrentPeriod: boolean;
  displayCode: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: string;
};

type WeekPanel = {
  weekStart: string;
  days: Array<{ date: string; weekday: string; minutes: number | null }>;
  totalMinutes: number;
  targetMinutes: number | null;
  targetBasis: string | null;
  projects: Array<{ label: string; minutes: number }>;
};

type AttendanceMatrix = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

type GoalRow = { id: string; title: string; progressPct: number | null; health: string; keyResultCount: number };

type LearningRow = {
  id: string;
  courseTitle: string;
  stateLabel: string;
  dueDate: string | null;
  overdue: boolean;
  daysOverdue: number | null;
  pathLabel: string;
};

type PodMember = { employeeId: string; name: string; designation: string; presentToday: boolean | null };

type CockpitData = {
  linked: boolean;
  message: string | null;
  employeeId: string | null;
  today: string;
  period: string;
  profile: Source<{ name: string; employeeCode: string; designation: string; department: string; location: string } | null>;
  shift: Source<ShiftPanel>;
  leave: Source<{ rings: LeaveRing[]; totalAvailable: number }>;
  pay: Source<PayPanel | null>;
  week: Source<WeekPanel>;
  attendance: Source<AttendanceMatrix>;
  goals: Source<GoalRow[]>;
  learning: Source<LearningRow[]>;
  reportingLine: Source<{ manager: { employeeId: string | null; name: string } | null; pod: PodMember[] }>;
  unavailableSources: Array<{ name: string; message: string }>;
};

type Envelope = { data: CockpitData };

const ENDPOINT = "/api/v1/cockpits/employee-home";

/** 40px, full width on a phone — the shared control standard for this cockpit. */
const LINK_BUTTON =
  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 font-heading text-[13px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-auto";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clockLabel(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

export function EmployeeHomeCockpit() {
  const { data, loading, error, refresh } = useLive<Envelope>(ENDPOINT);
  const cockpit = data?.data;

  const [punching, setPunching] = useState(false);
  const [punchResult, setPunchResult] = useState<{ ok: boolean; message: string } | null>(null);

  const punchIn = useCallback(async () => {
    if (!cockpit?.employeeId) return;
    const shift = cockpit.shift.value;
    if (shift.sessionOpen) return;
    setPunching(true);
    try {
      const shiftCode = shift.shiftCode ?? "";
      const response = await fetch("/api/v1/attendance/punches", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey() },
        cache: "no-store",
        body: JSON.stringify({
          employeeId: cockpit.employeeId,
          workDate: cockpit.today,
          ...(["A", "B", "C"].includes(shiftCode) ? { shiftCode } : {}),
          punches: [{ at: new Date().toISOString(), type: "in", source: "web" }],
        }),
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (response.ok) {
        setPunchResult({ ok: true, message: "Punch in recorded." });
        refresh();
      } else {
        const detail = asRecord(payload.error);
        setPunchResult({
          ok: false,
          message:
            typeof detail.message === "string" && detail.message.trim() !== ""
              ? detail.message
              : `The punch was refused (${response.status}).`,
        });
      }
    } catch {
      setPunchResult({ ok: false, message: "The attendance service could not be reached." });
    } finally {
      setPunching(false);
    }
  }, [cockpit, refresh]);

  const punchOut = useCallback(async () => {
    if (!cockpit?.employeeId) return;
    const shift = cockpit.shift.value;
    // The open session is the thing being closed, so openness — not the presence
    // of a stored timestamp — is what gates the control. The server refuses an
    // out-of-sequence punch either way.
    if (!shift.sessionOpen) return;
    setPunching(true);
    try {
      const shiftCode = shift.shiftCode ?? "";
      const response = await fetch("/api/v1/attendance/punches", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey() },
        cache: "no-store",
        body: JSON.stringify({
          employeeId: cockpit.employeeId,
          workDate: cockpit.today,
          ...(["A", "B", "C"].includes(shiftCode) ? { shiftCode } : {}),
          // Only the OUT. The IN is already on file — re-posting it wrote a
          // duplicate IN row on every punch-out and left the day unpairable.
          punches: [{ at: new Date().toISOString(), type: "out", source: "web" }],
        }),
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (response.ok) {
        setPunchResult({ ok: true, message: "Punch out recorded." });
        refresh();
      } else {
        // The attendance engine's own refusal, shown exactly as it arrived.
        const detail = asRecord(payload.error);
        setPunchResult({
          ok: false,
          message:
            typeof detail.message === "string" && detail.message.trim() !== ""
              ? detail.message
              : `The punch was refused (${response.status}).`,
        });
      }
    } catch {
      setPunchResult({ ok: false, message: "The attendance service could not be reached." });
    } finally {
      setPunching(false);
    }
  }, [cockpit, refresh]);

  const shift = cockpit?.shift.value;
  const canPunchOut = Boolean(shift?.sessionOpen && shift?.punchedInAt);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S8 · EMPLOYEE HOME"
        title="My workday"
        description="Your shift, leave, pay, timesheet, goals and learning — only your own records, and only what the platform has actually produced."
        action={
          <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading && (
        <Surface>
          <StateBlock tone="loading" title="Loading your workday" description="Reading your attendance, leave, pay and learning records." />
        </Surface>
      )}

      {error !== "" && (
        <Surface>
          <StateBlock tone="error" icon={ShieldAlert} title="This cockpit could not be loaded" description={error} />
        </Surface>
      )}

      {cockpit && !cockpit.linked && (
        <Surface>
          <StateBlock
            tone="empty"
            icon={CircleSlash}
            title="No employee record is linked to this account"
            description={cockpit.message ?? undefined}
          />
        </Surface>
      )}

      {cockpit && cockpit.linked && (
        <div className="grid min-w-0 gap-5">
          {/* Today at a glance. It renders from this already-loaded payload and
              drives the same punch callbacks as the shift panel below, so there
              is one punch state machine on the page, not two. */}
          <EmployeeWelcomeHero
            today={cockpit.today}
            profile={cockpit.profile}
            shift={cockpit.shift}
            reportingLine={cockpit.reportingLine}
            punching={punching}
            punchResult={punchResult}
            onPunchIn={punchIn}
            onPunchOut={punchOut}
          />

          {cockpit.profile.available && cockpit.profile.value && (
            <Surface>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="min-w-0 truncate font-heading text-lg font-semibold text-foreground">
                  {cockpit.profile.value.name}
                </h2>
                <span className="font-mono text-[12px] text-muted-foreground">{cockpit.profile.value.employeeCode}</span>
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                  {cockpit.profile.value.designation} · {cockpit.profile.value.department} ·{" "}
                  {cockpit.profile.value.location}
                </span>
              </div>
            </Surface>
          )}

          {/* 1-3: shift, leave, pay */}
          <div className="grid min-w-0 gap-5 lg:grid-cols-3">
            <Surface>
              <SectionHeading title="Today's shift" description={`Attendance recorded for ${cockpit.today}.`} />
              {cockpit.shift.available && shift ? (
                <>
                  {shift.targetMinutes === null ? (
                    <StateBlock
                      tone="empty"
                      icon={Clock3}
                      title="No shift assigned"
                      description="No active shift assignment carries a start and end time, so there is no target to measure today's work against."
                    />
                  ) : (
                    <ProgressGauge
                      value={shift.workedMinutes}
                      max={shift.targetMinutes}
                      label="Worked today"
                      sublabel={
                        shift.shiftName || shift.shiftCode
                          ? `${shift.shiftName ?? shift.shiftCode} · ${shift.startsAt ?? "?"}–${shift.endsAt ?? "?"}`
                          : undefined
                      }
                      emptyTitle="No hours recorded yet"
                      emptyNote="The gauge fills once a punch or an attendance day is recorded for today."
                    />
                  )}
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="min-w-0 rounded-lg border border-border p-2">
                      <dt className="truncate text-[11px] text-muted-foreground">Punched in</dt>
                      <dd className="mt-0.5 font-mono text-[13px] font-bold text-foreground tabular-nums">
                        {clockLabel(shift.punchedInAt)}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-border p-2">
                      <dt className="truncate text-[11px] text-muted-foreground">Worked</dt>
                      <dd className="mt-0.5 font-mono text-[13px] font-bold text-foreground tabular-nums">
                        {shift.workedMinutes === null ? "—" : minutesLabel(shift.workedMinutes)}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-border p-2">
                      <dt className="truncate text-[11px] text-muted-foreground">Break</dt>
                      <dd className="mt-0.5 font-mono text-[13px] font-bold text-foreground tabular-nums">
                        {shift.breakMinutes === null ? "—" : minutesLabel(shift.breakMinutes)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid gap-2">
                    {shift.sessionOpen ? (
                      <Button
                        type="button"
                        onClick={punchOut}
                        disabled={!canPunchOut || punching}
                        className="w-full sm:w-auto"
                      >
                        <LogOut className="size-4" />
                        {punching ? "Recording…" : "Punch out"}
                      </Button>
                    ) : (
                      <Button type="button" onClick={punchIn} disabled={punching} className="w-full sm:w-auto">
                        <LogIn className="size-4" />
                        {punching ? "Recording…" : "Punch in"}
                      </Button>
                    )}
                    <p className="text-[12px] text-muted-foreground">
                      {shift.sessionOpen
                        ? "Closes today's session against the attendance engine by recording an out punch at the current time."
                        : "Opens today's session against the attendance engine using the current time."}
                    </p>
                    {punchResult && (
                      <p
                        role={punchResult.ok ? "status" : "alert"}
                        className={`rounded-lg border p-2.5 text-[12px] ${
                          punchResult.ok
                            ? "border-success/25 bg-success/10 text-success"
                            : "border-destructive/25 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {punchResult.message}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="Shift status unavailable"
                  description={cockpit.shift.message}
                />
              )}
            </Surface>

            <Surface>
              <SectionHeading title="My leave balance" description="Days available by leave type, from your own ledger." />
              {cockpit.leave.available && cockpit.leave.value.rings.length > 0 ? (
                <>
                  <ConcentricRings rings={cockpit.leave.value.rings} centreLabel="days available" />
                  <div className="mt-4">
                    <Link href="/leave" className={LINK_BUTTON}>
                      <CalendarPlus className="size-4" />
                      Apply leave
                    </Link>
                  </div>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="No leave balance to show"
                  description={
                    cockpit.leave.message ??
                    "No leave entitlement or ledger movement is recorded against your employee record yet."
                  }
                  action={
                    <Link href="/leave" className={LINK_BUTTON}>
                      <CalendarPlus className="size-4" />
                      Open leave
                    </Link>
                  }
                />
              )}
            </Surface>

            <Surface>
              <SectionHeading title="My pay" description="Produced by the payroll engine — never estimated here." />
              {cockpit.pay.available && cockpit.pay.value ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={cockpit.pay.value.isCurrentPeriod ? "success" : "warning"}>
                      {cockpit.pay.value.periodLabel}
                    </StatusPill>
                    <StatusPill tone="neutral">{cockpit.pay.value.state}</StatusPill>
                  </div>
                  {!cockpit.pay.value.isCurrentPeriod && (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      Payroll has not been run for {cockpit.period} yet. This is your last released payslip,{" "}
                      {cockpit.pay.value.periodLabel}.
                    </p>
                  )}
                  <dl className="mt-4 grid gap-2">
                    {[
                      { label: "Gross", amount: cockpit.pay.value.grossMinor },
                      { label: "Deductions", amount: cockpit.pay.value.deductionsMinor },
                      { label: "Net", amount: cockpit.pay.value.netMinor },
                    ].map((line) => (
                      <div
                        key={line.label}
                        className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg border border-border p-2.5"
                      >
                        <dt className="truncate text-[12px] text-muted-foreground">{line.label}</dt>
                        <dd className="shrink-0 font-mono text-[15px] font-bold text-foreground tabular-nums">
                          {currencyLabel(line.amount, cockpit.pay.value?.currency ?? "INR")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{cockpit.pay.value.displayCode}</p>
                  <div className="mt-4">
                    <Link href="/payslips" className={LINK_BUTTON}>
                      View payslips
                    </Link>
                  </div>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="No payslip produced yet"
                  description={
                    cockpit.pay.message ??
                    "The payroll engine has not produced a payslip for you, so there is no gross, deduction or net figure to show."
                  }
                />
              )}
            </Surface>
          </div>

          {/* 4: weekly timesheet */}
          <Surface>
            <SectionHeading
              title="This week's timesheet"
              description={
                cockpit.week.available
                  ? `Week beginning ${dateLabel(cockpit.week.value.weekStart)}.`
                  : "Logged hours per day for the current week."
              }
              action={
                <Link href="/timesheets" className={LINK_BUTTON}>
                  <Timer className="size-4" />
                  Log time
                </Link>
              }
            />
            {cockpit.week.available ? (
              <>
                <div className="grid grid-cols-7 gap-1.5">
                  {cockpit.week.value.days.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.minutes === null ? "nothing logged" : minutesLabel(day.minutes)}`}
                      className="min-w-0 rounded-lg border border-border p-1.5 text-center"
                    >
                      <p className="truncate text-[10px] font-semibold text-muted-foreground">{day.weekday}</p>
                      <p className="mt-1 font-mono text-[11px] font-bold text-foreground tabular-nums sm:text-[13px]">
                        {day.minutes === null ? "—" : (day.minutes / 60).toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <ProgressMeter
                    value={cockpit.week.value.totalMinutes}
                    max={cockpit.week.value.targetMinutes ?? Math.max(1, cockpit.week.value.totalMinutes)}
                    label={
                      <span>
                        Logged <strong className="text-foreground">{minutesLabel(cockpit.week.value.totalMinutes)}</strong>
                        {cockpit.week.value.targetMinutes === null
                          ? " · no target, because no shift length is assigned"
                          : ` of ${minutesLabel(cockpit.week.value.targetMinutes)} (${cockpit.week.value.targetBasis})`}
                      </span>
                    }
                  />
                </div>
                {cockpit.week.value.projects.length > 0 && (
                  <ul className="mt-4 grid gap-1.5">
                    {cockpit.week.value.projects.map((project) => (
                      <li key={project.label} className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12px] text-muted-foreground">{project.label}</span>
                        <span className="shrink-0 font-mono text-[12px] font-bold text-foreground tabular-nums">
                          {minutesLabel(project.minutes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <StateBlock
                tone="empty"
                icon={CircleSlash}
                title="Timesheet unavailable"
                description={cockpit.week.message}
              />
            )}
          </Surface>

          {/* 5: attendance heatmap */}
          <Surface>
            <SectionHeading
              title="My attendance, last eight weeks"
              description="Hours worked each day. A day with no attendance reading stays blank rather than reading as zero."
            />
            {cockpit.attendance.available ? (
              <MatrixHeatmap
                rows={cockpit.attendance.value.rows}
                columns={cockpit.attendance.value.columns}
                values={cockpit.attendance.value.values}
                valueLabel="Hours worked"
                ariaLabel="Hours worked by week and weekday over the last eight weeks"
                emptyTitle="No attendance recorded in this window"
                emptyNote="Days fill in as punches are processed into attendance days for you."
              />
            ) : (
              <StateBlock
                tone="empty"
                icon={CircleSlash}
                title="Attendance history unavailable"
                description={cockpit.attendance.message}
              />
            )}
          </Surface>

          {/* 6: goals and learning */}
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <Surface>
              <SectionHeading
                title="My goals"
                description="Objectives you own, with progress rolled up from their key results."
                action={
                  <Link href="/performance" className={LINK_BUTTON}>
                    <Target className="size-4" />
                    Open OKRs
                  </Link>
                }
              />
              {cockpit.goals.available ? (
                cockpit.goals.value.length === 0 ? (
                  <StateBlock
                    tone="empty"
                    icon={Target}
                    title="No objectives owned by you"
                    description="Nothing in the current cascade names you as the owner."
                  />
                ) : (
                  <ul className="grid gap-3">
                    {cockpit.goals.value.map((goal) => (
                      <li key={goal.id} className="min-w-0">
                        <div className="flex min-w-0 items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate text-[13px] font-medium text-foreground">{goal.title}</p>
                          <span className="shrink-0 font-mono text-[12px] font-bold text-foreground tabular-nums">
                            {goal.progressPct === null ? "—" : `${goal.progressPct}%`}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <ProgressMeter value={goal.progressPct ?? 0} max={100} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {goal.keyResultCount} key result{goal.keyResultCount === 1 ? "" : "s"} ·{" "}
                          {goal.progressPct === null ? "progress not determined" : `health ${goal.health}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <StateBlock tone="empty" icon={CircleSlash} title="Goals unavailable" description={cockpit.goals.message} />
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="My learning"
                description="Courses assigned to you. Anything past its due date is flagged."
                action={
                  <Link href="/my-learning" className={LINK_BUTTON}>
                    <BookOpen className="size-4" />
                    Open learning
                  </Link>
                }
              />
              {cockpit.learning.available ? (
                cockpit.learning.value.length === 0 ? (
                  <StateBlock
                    tone="empty"
                    icon={BookOpen}
                    title="No learning assigned"
                    description="No enrolment is recorded against your employee record."
                  />
                ) : (
                  <ul className="grid gap-2.5">
                    {cockpit.learning.value.map((row) => (
                      <li key={row.id} className="min-w-0 rounded-lg border border-border p-3">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                            {row.courseTitle}
                          </p>
                          <StatusPill tone={row.overdue ? "danger" : "neutral"} dot={row.overdue}>
                            {row.overdue
                              ? `Overdue${row.daysOverdue === null ? "" : ` ${row.daysOverdue}d`}`
                              : row.stateLabel}
                          </StatusPill>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {row.pathLabel} · {row.dueDate ? `due ${dateLabel(row.dueDate)}` : "no due date recorded"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <StateBlock
                  tone="empty"
                  icon={CircleSlash}
                  title="Learning unavailable"
                  description={cockpit.learning.message}
                />
              )}
            </Surface>
          </div>

          {/* 7: reporting line and pod */}
          <Surface>
            <SectionHeading
              title="My reporting line"
              description="Taken from the reporting hierarchy this account is allowed to see. Presence is shown only where attendance actually recorded it."
            />
            {cockpit.reportingLine.available ? (
              <div className="grid min-w-0 gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reports to</p>
                  {cockpit.reportingLine.value.manager ? (
                    <p className="mt-1 flex min-w-0 items-center gap-2 text-[14px] font-medium text-foreground">
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{cockpit.reportingLine.value.manager.name}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      No manager is recorded against your employee record.
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">My pod</p>
                  {cockpit.reportingLine.value.pod.length === 0 ? (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      No colleagues are visible to this account in the reporting hierarchy.
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {cockpit.reportingLine.value.pod.map((member) => (
                        <li
                          key={member.employeeId}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-foreground">{member.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{member.designation}</p>
                          </div>
                          {member.presentToday === null ? (
                            <span className="shrink-0 text-[11px] text-muted-foreground">No reading</span>
                          ) : (
                            <StatusPill tone={member.presentToday ? "success" : "neutral"} dot>
                              {member.presentToday ? "Present" : "Not present"}
                            </StatusPill>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <StateBlock
                tone="empty"
                icon={CircleSlash}
                title="Reporting line unavailable"
                description={cockpit.reportingLine.message}
              />
            )}
          </Surface>

          {cockpit.unavailableSources.length > 0 && (
            <Surface>
              <SectionHeading
                title="Not available to this account"
                description="These feeds were refused or are not configured, so the panels above leave them out rather than estimate them."
              />
              <ul className="grid gap-2">
                {cockpit.unavailableSources.map((entry) => (
                  <li key={entry.name} className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.name}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
