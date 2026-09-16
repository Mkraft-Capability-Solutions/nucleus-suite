"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  Receipt,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarMark, ProgressMeter, StatusPill, Surface } from "../page-primitives";
import { minutesLabel } from "../workforce/records";
import { useWorkspace } from "../workspace-provider";

/**
 * Employee Welcome Hero — "today at a glance" at the top of S8 Employee Home.
 *
 * Every figure here is handed down from the cockpit's already-loaded
 * `/api/v1/cockpits/employee-home` payload. The hero issues NO fetch of its
 * own and holds no copy of the punch state machine: the cockpit owns the punch
 * callbacks and the server's refusal text, and this block only renders whichever
 * control the derived session state allows.
 *
 * DATA HONESTY (DESIGN_SYSTEM.md section 9). A value the platform has not
 * produced renders as an em dash or a short factual phrase — never as a zero
 * that would read as a real reading, and never as sample content.
 *
 * Two things the reference mock shows are deliberately absent:
 *  - a profile photograph, because no photo field exists anywhere in the
 *    schema. `AvatarMark` initials are the honest substitute.
 *  - weather, because this application has no weather source at all.
 *    EXTENSION POINT: if a weather reading is ever actually stored against a
 *    location, render it beside the office location below. Until a real source
 *    exists nothing may be shown there — a static "24°C Pleasant" would be
 *    fabricated data.
 */

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit tested in employee-welcome-hero.test.ts)                */
/* -------------------------------------------------------------------------- */

/** The em dash every absent figure renders as. Never substitute a zero. */
export const NO_VALUE = "—";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DayPart = "morning" | "afternoon" | "evening";

/**
 * Time-of-day band for the greeting.
 *
 * Boundaries are inclusive at the start: 00:00–11:59 morning, 12:00–16:59
 * afternoon, 17:00–23:59 evening. Anything unusable falls back to morning
 * rather than throwing in a heading.
 */
export function dayPartForHour(hour: number): DayPart {
  const normalised = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 0;
  if (normalised < 12) return "morning";
  if (normalised < 17) return "afternoon";
  return "evening";
}

/** "Good morning, Anita!" — or the bare salutation when no name is recorded. */
export function greetingFor(hour: number, firstName: string | null | undefined): string {
  const part = dayPartForHour(hour);
  const salutation =
    part === "morning" ? "Good morning" : part === "afternoon" ? "Good afternoon" : "Good evening";
  const name = (firstName ?? "").trim();
  return name === "" ? `${salutation}!` : `${salutation}, ${name}!`;
}

/**
 * The hour on the tenant's own clock. Falls back to the browser clock when the
 * workspace exposes no timezone, or exposes one this runtime cannot resolve —
 * a wrong zone would silently shift the greeting for a whole tenant.
 */
export function hourInZone(at: Date, timeZone?: string | null): number {
  const zone = (timeZone ?? "").trim();
  if (zone !== "") {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        hour12: false,
      }).formatToParts(at);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      if (Number.isFinite(hour)) return hour % 24;
    } catch {
      /* Unusable timezone — fall through to the browser clock. */
    }
  }
  return at.getHours();
}

/** First token of a recorded name, or null when nothing is recorded. */
export function firstNameOf(full: string | null | undefined): string | null {
  const parts = (full ?? "").trim().split(/\s+/).filter((part) => part !== "");
  return parts.length === 0 ? null : parts[0];
}

/** Initials for `AvatarMark`. There is no photo field in the schema to use instead. */
export function initialsOf(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter((part) => part !== "");
  if (parts.length === 0) return NO_VALUE;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export type PunchState = "open" | "closed" | "none";

/**
 * The real state of today's session, as `getCurrentSession` now derives it from
 * punch rows:
 *  - "open"   — a running clock; the day has an IN with no matching OUT.
 *  - "closed" — the day's first IN is on file but the clock is not running.
 *  - "none"   — no punch has been recorded for today at all.
 */
export function punchStateOf(
  shift: { sessionOpen: boolean; punchedInAt: string | null } | null | undefined,
): PunchState {
  if (!shift) return "none";
  if (shift.sessionOpen) return "open";
  return (shift.punchedInAt ?? "").trim() === "" ? "none" : "closed";
}

export type PunchControl = { kind: "punch-out" | "punch-in"; label: string; hint: string };

/**
 * Exactly one control, never both. A closed day still offers Punch in: the
 * attendance engine decides whether a second session may open, and refuses with
 * a 409 whose message the cockpit surfaces verbatim. Pre-empting that refusal
 * here would put this component's guess in front of the engine's answer.
 */
export function punchControlFor(state: PunchState): PunchControl {
  if (state === "open") {
    return {
      kind: "punch-out",
      label: "Punch out",
      hint: "Closes today's session by recording an out punch at the current time.",
    };
  }
  return {
    kind: "punch-in",
    label: "Punch in",
    hint: "Opens a session against the attendance engine using the current time.",
  };
}

export type AttendanceStatus = { tone: "success" | "info" | "neutral"; label: string };

/** A worded status, so the state is never carried by colour alone. */
export function attendanceStatusFor(state: PunchState): AttendanceStatus {
  if (state === "open") return { tone: "success", label: "On the clock" };
  if (state === "closed") return { tone: "info", label: "Session closed for today" };
  return { tone: "neutral", label: "No punch recorded today" };
}

/** Minutes as `8h 30m`, or an em dash when the platform produced no figure. */
export function minutesOrDash(minutes: number | null | undefined): string {
  return typeof minutes === "number" && Number.isFinite(minutes) ? minutesLabel(minutes) : NO_VALUE;
}

/** A recorded string, or an em dash. An empty string is an absent value, not a blank one. */
export function textOrDash(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? NO_VALUE : trimmed;
}

/** Wall-clock time, in the tenant's zone where one is configured. */
export function timeLabel(at: Date, timeZone?: string | null): string {
  const zone = (timeZone ?? "").trim();
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (zone !== "") {
    try {
      return new Intl.DateTimeFormat(undefined, { ...options, timeZone: zone }).format(at);
    } catch {
      /* Unusable timezone — fall through to the browser clock. */
    }
  }
  return new Intl.DateTimeFormat(undefined, options).format(at);
}

/** A stored instant as a clock time, or an em dash when there is no instant. */
export function instantClockOrDash(value: string | null | undefined, timeZone?: string | null): string {
  const raw = (value ?? "").trim();
  if (raw === "") return NO_VALUE;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? NO_VALUE : timeLabel(parsed, timeZone);
}

/** The payload's `today` as a long date, or an em dash when it is unusable. */
export function longDateLabel(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  if (!DATE_PATTERN.test(raw)) return NO_VALUE;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return NO_VALUE;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

/**
 * Share of the assigned shift length already worked, or null when either side
 * of the ratio is missing. A missing target must not become a 0% meter.
 */
export function workedShare(
  worked: number | null | undefined,
  target: number | null | undefined,
): number | null {
  if (typeof worked !== "number" || !Number.isFinite(worked)) return null;
  if (typeof target !== "number" || !Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((worked / target) * 100)));
}

/** The assigned shift as `General · 09:00–18:00`, or a factual absence phrase. */
export function shiftLabel(shift: {
  shiftName: string | null;
  shiftCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
} | null | undefined): string {
  if (!shift) return "No shift assigned";
  const name = (shift.shiftName ?? shift.shiftCode ?? "").trim();
  const window =
    (shift.startsAt ?? "").trim() !== "" && (shift.endsAt ?? "").trim() !== ""
      ? `${shift.startsAt}–${shift.endsAt}`
      : "";
  if (name === "" && window === "") return "No shift assigned";
  if (window === "") return name;
  return name === "" ? window : `${name} · ${window}`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

type Feed<T> = { value: T; available: boolean; message?: string; origin?: string };

export type HeroShift = {
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

export type HeroProfile = {
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  location: string;
} | null;

export type EmployeeWelcomeHeroProps = {
  /** The payload's own working date, so the hero dates what the figures describe. */
  today: string;
  profile: Feed<HeroProfile>;
  shift: Feed<HeroShift>;
  reportingLine: Feed<{ manager: { name: string } | null }>;
  punching: boolean;
  punchResult: { ok: boolean; message: string } | null;
  onPunchIn: () => void;
  onPunchOut: () => void;
};

/** 40px controls — the operational standard, full width on a phone. */
const ACTION_LINK =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 font-heading text-[13px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-auto";

const CELL = "min-w-0 rounded-lg border border-border bg-secondary/40 p-2.5";

export function EmployeeWelcomeHero({
  today,
  profile,
  shift,
  reportingLine,
  punching,
  punchResult,
  onPunchIn,
  onPunchOut,
}: EmployeeWelcomeHeroProps) {
  const { workspace } = useWorkspace();
  const timeZone = workspace?.settings?.timezone ?? null;

  // Ambient clock. It ticks once a MINUTE — a per-second tick would re-render
  // the whole hero sixty times more often for a display that shows no seconds —
  // and the interval is cleared on unmount.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const person = profile.available ? profile.value : null;
  const greetingName = firstNameOf(workspace?.user.name) ?? firstNameOf(person?.name);
  const greeting = greetingFor(hourInZone(now, timeZone), greetingName);

  const shiftValue = shift.available ? shift.value : null;
  const state = punchStateOf(shiftValue);
  const control = punchControlFor(state);
  const status = attendanceStatusFor(state);
  const share = workedShare(shiftValue?.workedMinutes, shiftValue?.targetMinutes);

  const manager = reportingLine.available ? reportingLine.value.manager : null;

  return (
    <Surface className="rounded-xl border-primary/20 p-5 sm:p-6">
      <section
        aria-labelledby="employee-welcome-hero-greeting"
        className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]"
      >
        {/* Left zone — identity, live attendance, primary actions. */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <AvatarMark initials={initialsOf(person?.name)} color="var(--chart-1)" size="lg" />
            <div className="min-w-0 flex-1">
              <h2
                id="employee-welcome-hero-greeting"
                className="min-w-0 font-heading text-xl font-semibold leading-7 text-foreground sm:text-2xl sm:leading-8"
              >
                {greeting}
              </h2>
              {person ? (
                <>
                  <p className="mt-1 min-w-0 text-[13px] leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">{textOrDash(person.designation)}</span>
                    {" · "}
                    {textOrDash(person.department)}
                    {" · "}
                    <span className="font-mono text-[12px]">{textOrDash(person.employeeCode)}</span>
                  </p>
                  <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{textOrDash(person.location)}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        {manager ? `Reports to ${manager.name}` : "No manager recorded"}
                      </span>
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  {profile.message ?? "Your employee record could not be read, so your role and location are not shown."}
                </p>
              )}
            </div>
          </div>

          {/* Live attendance. */}
          <div className="mt-5 min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <StatusPill tone={status.tone} dot={state === "open"}>
                {status.label}
              </StatusPill>
              <span className="min-w-0 truncate text-[12px] text-muted-foreground">
                {shift.available ? shiftLabel(shiftValue) : (shift.message ?? "Shift status unavailable")}
              </span>
            </div>

            <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={CELL}>
                <dt className="truncate text-[11px] text-muted-foreground">Punched in</dt>
                <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground tabular-nums">
                  {instantClockOrDash(shiftValue?.punchedInAt, timeZone)}
                </dd>
              </div>
              <div className={CELL}>
                <dt className="truncate text-[11px] text-muted-foreground">Worked so far</dt>
                <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground tabular-nums">
                  {minutesOrDash(shiftValue?.workedMinutes)}
                </dd>
              </div>
              <div className={CELL}>
                <dt className="truncate text-[11px] text-muted-foreground">Shift target</dt>
                <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground tabular-nums">
                  {minutesOrDash(shiftValue?.targetMinutes)}
                </dd>
              </div>
              <div className={CELL}>
                <dt className="truncate text-[11px] text-muted-foreground">Break</dt>
                <dd className="mt-0.5 font-mono text-[14px] font-bold text-foreground tabular-nums">
                  {minutesOrDash(shiftValue?.breakMinutes)}
                </dd>
              </div>
            </dl>

            <div className="mt-3 min-w-0">
              {share === null ? (
                <p className="text-[12px] text-muted-foreground">
                  {shiftValue?.targetMinutes === null || shiftValue === null
                    ? "No shift length is assigned, so there is no target to measure today against."
                    : "No hours are recorded for today yet, so there is nothing to measure against the target."}
                </p>
              ) : (
                <ProgressMeter
                  value={share}
                  max={100}
                  tone={share >= 100 ? "success" : "primary"}
                  label={
                    <span>
                      <strong className="text-foreground">{share}%</strong> of the assigned shift length worked
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* Primary quick actions — every one is a real action or a real route. */}
          <div className="mt-5 grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {control.kind === "punch-out" ? (
              <Button
                type="button"
                onClick={onPunchOut}
                disabled={punching}
                aria-label="Punch out of today's attendance session"
                className="h-10 w-full sm:w-auto"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {punching ? "Recording…" : control.label}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onPunchIn}
                disabled={punching}
                aria-label="Punch in to today's attendance session"
                className="h-10 w-full sm:w-auto"
              >
                <LogIn className="size-4" aria-hidden="true" />
                {punching ? "Recording…" : control.label}
              </Button>
            )}
            <Link href="/leave" className={ACTION_LINK} aria-label="Apply for leave">
              <CalendarPlus className="size-4" aria-hidden="true" />
              Apply leave
            </Link>
            <Link href="/reimbursement-claims" className={ACTION_LINK} aria-label="Claim an expense">
              <Receipt className="size-4" aria-hidden="true" />
              Claim expense
            </Link>
            <Link href="/engagement" className={ACTION_LINK} aria-label="Read company broadcasts">
              <Megaphone className="size-4" aria-hidden="true" />
              Broadcasts
            </Link>
          </div>

          <p className="mt-2 text-[12px] text-muted-foreground">{control.hint}</p>

          {punchResult && (
            <p
              role={punchResult.ok ? "status" : "alert"}
              className={`mt-2 rounded-lg border p-2.5 text-[12px] ${
                punchResult.ok
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              {punchResult.message}
            </p>
          )}
        </div>

        {/* Right zone — the date, the live clock and where the work is based. */}
        <div className="min-w-0 rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
          <p className="mt-1.5 flex min-w-0 items-start gap-2 text-[14px] font-medium leading-5 text-foreground">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">{longDateLabel(today)}</span>
          </p>
          <p className="mt-3 flex min-w-0 items-center gap-2">
            <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {/* Ambient, not an alert: announcing every tick would interrupt a
                screen-reader mid-sentence once a minute. */}
            <span
              aria-live="off"
              className="font-mono text-[22px] font-bold leading-7 text-foreground tabular-nums"
            >
              {timeLabel(now, timeZone)}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {textOrDash(timeZone) === NO_VALUE ? "Your device clock" : `Tenant clock · ${timeZone}`}
          </p>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
            <p className="mt-1 flex min-w-0 items-start gap-2 text-[13px] leading-5 text-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                {person && textOrDash(person.location) !== NO_VALUE
                  ? person.location
                  : "No location recorded against your employee record"}
              </span>
            </p>
            {/* EXTENSION POINT — weather would belong here. There is no weather
                source in this application and none is called: a rendered figure
                would be invented data. */}
          </div>
        </div>
      </section>
    </Surface>
  );
}
