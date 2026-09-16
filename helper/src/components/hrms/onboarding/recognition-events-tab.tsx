"use client";

import { useMemo, useState } from "react";
import { Award, Cake, CalendarHeart, Lock, RefreshCcw, UserPlus } from "lucide-react";
import { picklists } from "@/lib/picklists";
import { StateBlock, StatusPill, Surface } from "@/components/hrms/page-primitives";
import {
  asRecord,
  listOf,
  num,
  recordFromEnvelope,
  str,
  useRegisterResource,
  type UnknownRecord,
} from "@/components/hrms/register-primitives";
import { currencyLabel } from "@/components/hrms/workforce/records";

/**
 * Recognition & Events.
 *
 * Four panels, each reading real records:
 *
 *  1. Upcoming birthdays      — `employees.date_of_birth`, month and day only.
 *  2. Work anniversaries      — `employees.joining_date`, with years of service.
 *  3. New joiners             — `employees.joining_date`, joined or joining.
 *  4. Recognition hall of fame — `recognition_events`, through the register.
 *
 * The first three come from `GET /api/v1/engagement/milestones`. The fourth
 * comes from `GET /api/v1/recognition-register`, which already projects an
 * award's recipient, category, citation, nominator and award value; nominating
 * is `POST` to the same route, so this surface adds no second write path.
 *
 * DATA HONESTY. Nothing on this surface is illustrative. No person, award,
 * category or bounty is written into this file. Where a panel has nothing to
 * show it says which of the two reasons applies — no records match the window,
 * or the underlying field is not recorded at all — because an empty birthday
 * list under a tenant that records no birth dates would assert that nobody has
 * a birthday this fortnight.
 */

const MILESTONES_PATH = "/api/v1/engagement/milestones";
const REGISTER_PATH = "/api/v1/recognition-register?pageSize=25";
const PEOPLE_PATH = "/api/v1/people?search=&page=1&pageSize=100";

/** The recognition categories are configuration, read from the picklist registry. */
const AWARD_CATEGORIES = picklists.PL_AWARD_CATEGORY.values;

/* ------------------------------------------------------------------ */
/* Row shapes                                                          */
/* ------------------------------------------------------------------ */

type Person = { id: string; name: string; department: string; designation: string };

type MilestonePerson = { employeeId: string; name: string; department: string; designation: string };

type BirthdayRow = MilestonePerson & { dateLabel: string; occursOn: string; daysAway: number };

type AnniversaryRow = MilestonePerson & { dateLabel: string; occursOn: string; daysAway: number; years: number };

type JoinerRow = MilestonePerson & { joiningDate: string; relation: string; daysFromToday: number };

type BirthdayPanel =
  | { available: true; items: BirthdayRow[]; recorded: number; population: number; coverageNote: string }
  | { available: false; reason: string };

type Board = {
  asOf: string;
  windowDays: number;
  windowEndsOn: string;
  lookbackDays: number;
  birthdays: BirthdayPanel;
  anniversaries: AnniversaryRow[];
  newJoiners: JoinerRow[];
};

type AwardRow = {
  id: string;
  recipient: string;
  categoryLabel: string;
  citation: string;
  conferredBy: string;
  awardMinor: number | null;
  currency: string;
  state: string;
  programmeName: string;
};

type Programme = { id: string; name: string; currency: string; defaultAwardMinor: number | null };

/** The nomination form. Widened to `string` so a select can set any option. */
type NominationForm = {
  recipientEmployeeId: string;
  programmeId: string;
  awardCategory: string;
  citation: string;
  periodStart: string;
  periodEnd: string;
  awardValue: string;
};

const EMPTY_NOMINATION: NominationForm = {
  recipientEmployeeId: "",
  programmeId: "",
  awardCategory: AWARD_CATEGORIES[0].value,
  citation: "",
  periodStart: "",
  periodEnd: "",
  awardValue: "",
};

/* ------------------------------------------------------------------ */
/* Envelope readers                                                    */
/* ------------------------------------------------------------------ */

function milestonePerson(row: UnknownRecord): MilestonePerson {
  return {
    employeeId: str(row.employeeId),
    name: str(row.name, "Unnamed employee"),
    department: str(row.department),
    designation: str(row.designation),
  };
}

function readBirthdayPanel(raw: UnknownRecord): BirthdayPanel {
  if (raw.available !== true) {
    return {
      available: false,
      reason: str(raw.reason, "Birthday data is not available to this role."),
    };
  }
  return {
    available: true,
    items: listOf(raw.items).map((row) => ({
      ...milestonePerson(row),
      dateLabel: str(row.dateLabel),
      occursOn: str(row.occursOn),
      daysAway: num(row.daysAway),
    })),
    recorded: num(raw.recorded),
    population: num(raw.population),
    coverageNote: str(raw.coverageNote),
  };
}

function readBoard(payload: unknown): Board | null {
  const data = recordFromEnvelope(payload);
  if (str(data.asOf) === "") return null;
  return {
    asOf: str(data.asOf),
    windowDays: num(data.windowDays, 14),
    windowEndsOn: str(data.windowEndsOn),
    lookbackDays: num(data.lookbackDays, 30),
    birthdays: readBirthdayPanel(asRecord(data.birthdays)),
    anniversaries: listOf(asRecord(data.anniversaries).items).map((row) => ({
      ...milestonePerson(row),
      dateLabel: str(row.dateLabel),
      occursOn: str(row.occursOn),
      daysAway: num(row.daysAway),
      years: num(row.years),
    })),
    newJoiners: listOf(asRecord(data.newJoiners).items).map((row) => ({
      ...milestonePerson(row),
      joiningDate: str(row.joiningDate),
      relation: str(row.relation, "joined"),
      daysFromToday: num(row.daysFromToday),
    })),
  };
}

function nullableMinor(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function readAwards(payload: unknown): AwardRow[] {
  return listOf(recordFromEnvelope(payload).items).map((row) => ({
    id: str(row.id),
    recipient: str(row.nomineeName, "Unnamed employee"),
    // The category is what the record stores; a kudos row that carries none
    // says so rather than borrowing a category from another award.
    categoryLabel: str(row.awardCategoryLabel, "No category recorded"),
    citation: str(row.citation),
    conferredBy: str(row.nominatorName),
    awardMinor: nullableMinor(row.awardMinor),
    currency: str(row.currency, "INR"),
    state: str(row.state, "nominated"),
    programmeName: str(row.programmeName),
  }));
}

function readProgrammes(payload: unknown): Programme[] {
  return listOf(recordFromEnvelope(payload).programmes).map((row) => ({
    id: str(row.id),
    name: str(row.name, "Recognition programme"),
    currency: str(row.currency, "INR"),
    defaultAwardMinor: nullableMinor(row.defaultAwardMinor),
  }));
}

function readPeople(payload: unknown): Person[] {
  const data = asRecord(payload).data;
  const rows = Array.isArray(data) ? (data as UnknownRecord[]) : [];
  return rows
    .map((row) => ({
      id: str(row.id),
      name: `${str(row.firstName)} ${str(row.lastName)}`.trim() || str(row.employeeCode, "Unnamed employee"),
      department: str(row.department),
      designation: str(row.designation),
    }))
    .filter((person) => person.id !== "");
}

/* ------------------------------------------------------------------ */
/* Copy helpers                                                        */
/* ------------------------------------------------------------------ */

function whenLabel(daysAway: number): string {
  if (daysAway <= 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

function joinerWhen(row: JoinerRow): string {
  if (row.daysFromToday === 0) return "Today";
  if (row.daysFromToday === 1) return "Tomorrow";
  if (row.daysFromToday === -1) return "Yesterday";
  return row.daysFromToday > 0 ? `In ${row.daysFromToday} days` : `${Math.abs(row.daysFromToday)} days ago`;
}

function yearsLabel(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

function subtitle(person: MilestonePerson): string {
  return [person.designation, person.department].filter((part) => part !== "").join(" · ");
}

function stateLabelFor(state: string): string {
  const spaced = state.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function stateTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "published" || state === "paid") return "success";
  if (state === "approved") return "info";
  if (state === "rejected") return "danger";
  if (state === "nominated") return "warning";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

const controlClass =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const buttonClass =
  "inline-flex h-10 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "inline-flex h-10 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

function Panel({
  title,
  description,
  icon: Icon,
  count,
  className,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Cake;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Surface className={className ? `flex flex-col ${className}` : "flex flex-col"}>
      <div className="mb-3 flex min-w-0 items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {title}
            {count !== undefined && (
              <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground tabular-nums">
                {count}
              </span>
            )}
          </h3>
          <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Surface>
  );
}

/** One person in a milestone panel: name, context, and when it happens. */
function MilestoneRow({
  person,
  when,
  detail,
  badge,
}: {
  person: MilestonePerson;
  when: string;
  detail?: string;
  badge?: React.ReactNode;
}) {
  const context = subtitle(person);
  return (
    <li className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[13px] font-semibold text-foreground">{person.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{context === "" ? "No department recorded" : context}</p>
      </div>
      <div className="min-w-0 shrink-0 text-right">
        <p className="text-[12px] font-semibold text-foreground">{when}</p>
        {detail !== undefined && <p className="text-[11px] text-muted-foreground">{detail}</p>}
        {badge}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The tab                                                             */
/* ------------------------------------------------------------------ */

export function RecognitionEventsTab() {
  const milestonesState = useRegisterResource(MILESTONES_PATH);
  const registerState = useRegisterResource(REGISTER_PATH);
  const peopleState = useRegisterResource(PEOPLE_PATH);

  const board = useMemo(() => readBoard(milestonesState.data), [milestonesState.data]);
  const awards = useMemo(() => readAwards(registerState.data), [registerState.data]);
  const programmes = useMemo(() => readProgrammes(registerState.data), [registerState.data]);
  const people = useMemo(() => readPeople(peopleState.data), [peopleState.data]);
  const canWrite = recordFromEnvelope(registerState.data).canWrite === true;
  const citationMinimum = num(recordFromEnvelope(registerState.data).citationMinimum, 50);

  const [nominateOpen, setNominateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [form, setForm] = useState<NominationForm>(EMPTY_NOMINATION);

  const selectedProgramme = programmes.find((programme) => programme.id === form.programmeId) ?? null;

  function refreshAll(): void {
    milestonesState.refresh();
    registerState.refresh();
  }

  /** Pre-fills the award value from the programme's own configured default, if it has one. */
  function chooseProgramme(id: string): void {
    const programme = programmes.find((entry) => entry.id === id) ?? null;
    setForm((current) => ({
      ...current,
      programmeId: id,
      awardValue:
        programme?.defaultAwardMinor !== null && programme?.defaultAwardMinor !== undefined
          ? (programme.defaultAwardMinor / 100).toFixed(2)
          : "",
    }));
  }

  const citationLength = form.citation.trim().length;
  const blocker =
    form.recipientEmployeeId === ""
      ? "Choose the employee being recognised."
      : form.programmeId === ""
        ? "Choose the recognition programme this award is made under."
        : citationLength < citationMinimum
          ? `The citation must be at least ${citationMinimum} characters; it is ${citationLength}.`
          : form.periodStart === "" || form.periodEnd === ""
            ? "A recognition award carries a period. Enter the dates it covers."
            : form.periodEnd < form.periodStart
              ? "The period ends before it starts."
              : "";

  async function nominate(): Promise<void> {
    setBusy(true);
    setNotice("");
    setProblem("");
    try {
      const body: UnknownRecord = {
        action: "nominate",
        recipientEmployeeId: form.recipientEmployeeId,
        programmeId: form.programmeId,
        awardCategory: form.awardCategory,
        citation: form.citation.trim(),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      };
      const rupees = Number(form.awardValue);
      if (form.awardValue.trim() !== "" && Number.isFinite(rupees)) body.awardMinor = Math.round(rupees * 100);
      const response = await fetch("/api/v1/recognition-register", {
        method: "POST",
        // Every recognition write is idempotency-keyed, so a retried click
        // cannot raise the same nomination twice.
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = asRecord(asRecord(payload).error);
        const details = listOf(error.details)
          .map((detail) => `${str(detail.field)}: ${str(detail.issue)}`)
          .join(" ");
        setProblem(`${str(error.message, `Request failed (${response.status}).`)} ${details}`.trim());
        return;
      }
      // The server may attach notes (for example, that the programme configures
      // no ceiling so no limit was applied). They are shown, not swallowed.
      const notes = (Array.isArray(asRecord(asRecord(payload).data).notes)
        ? (asRecord(asRecord(payload).data).notes as unknown[])
        : []
      ).map((note) => String(note));
      setNominateOpen(false);
      setForm(EMPTY_NOMINATION);
      setNotice(`Nomination raised. It now waits on the recognition committee. ${notes.join(" ")}`.trim());
      registerState.refresh();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const loadingBoard = milestonesState.loading;
  const boardError = milestonesState.error;

  return (
    <section aria-label="Recognition and events" className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[12px] text-muted-foreground">
          {board === null
            ? "Birthdays, work anniversaries, new joiners and recognition awards, derived from the employee records themselves."
            : `Rolling window of ${board.windowDays} days from ${board.asOf} to ${board.windowEndsOn}. New joiners cover the previous ${board.lookbackDays} days and the same window ahead.`}
        </p>
        <button type="button" onClick={refreshAll} className={buttonClass}>
          <RefreshCcw className="size-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>

      {notice !== "" && (
        <p role="status" className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-foreground">
          {notice}
        </p>
      )}
      {problem !== "" && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-foreground">
          {problem}
        </p>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* 1 — Upcoming birthdays. Month and day only; the year is never read. */}
        <Panel
          title="Upcoming birthdays"
          description="From each employee's recorded date of birth. Only the month and the day are read — never the year."
          icon={Cake}
          count={board?.birthdays.available === true ? board.birthdays.items.length : undefined}
        >
          {loadingBoard ? (
            <StateBlock tone="loading" title="Loading birthdays…" />
          ) : boardError !== "" ? (
            <StateBlock tone="error" title="Birthdays could not be loaded" description={boardError} />
          ) : board === null ? (
            <StateBlock tone="empty" title="No milestone data" description="The milestone read returned nothing." />
          ) : board.birthdays.available === false ? (
            <StateBlock
              tone="empty"
              icon={Lock}
              title="Birthdays are not shown to this role"
              description={board.birthdays.reason}
            />
          ) : board.birthdays.recorded === 0 ? (
            // The distinction that matters: no birth dates recorded is a gap in
            // the data, not a fortnight in which nobody has a birthday.
            <StateBlock
              tone="empty"
              icon={Cake}
              title="No birth dates recorded"
              description={board.birthdays.coverageNote}
            />
          ) : board.birthdays.items.length === 0 ? (
            <StateBlock
              tone="empty"
              icon={Cake}
              title="No birthdays in this window"
              description={`${board.birthdays.recorded} of ${board.birthdays.population} active employees have a birth date recorded, and none of them falls between ${board.asOf} and ${board.windowEndsOn}.`}
            />
          ) : (
            <>
              <ul className="min-w-0">
                {board.birthdays.items.map((row) => (
                  <MilestoneRow
                    key={row.employeeId}
                    person={row}
                    when={whenLabel(row.daysAway)}
                    detail={row.dateLabel}
                  />
                ))}
              </ul>
              {board.birthdays.recorded < board.birthdays.population && (
                <p className="mt-3 border-t border-border pt-2 text-[11px] leading-[16px] text-muted-foreground">
                  {board.birthdays.recorded} of {board.birthdays.population} active employees have a birth date recorded.
                  Anyone whose record does not is absent from this panel.
                </p>
              )}
            </>
          )}
        </Panel>

        {/* 2 — Work anniversaries. The year IS shown: years of service is the point. */}
        <Panel
          title="Work anniversaries"
          description="From the joining date on the employee record, counted as completed years of service."
          icon={CalendarHeart}
          count={board?.anniversaries.length}
        >
          {loadingBoard ? (
            <StateBlock tone="loading" title="Loading anniversaries…" />
          ) : boardError !== "" ? (
            <StateBlock tone="error" title="Anniversaries could not be loaded" description={boardError} />
          ) : board === null || board.anniversaries.length === 0 ? (
            <StateBlock
              tone="empty"
              icon={CalendarHeart}
              title="No work anniversaries in this window"
              description={
                board === null
                  ? "The milestone read returned nothing."
                  : `No active employee completes a further year of service between ${board.asOf} and ${board.windowEndsOn}.`
              }
            />
          ) : (
            <ul className="min-w-0">
              {board.anniversaries.map((row) => (
                <MilestoneRow
                  key={row.employeeId}
                  person={row}
                  when={yearsLabel(row.years)}
                  detail={`${row.dateLabel} · ${whenLabel(row.daysAway)}`}
                />
              ))}
            </ul>
          )}
        </Panel>

        {/* 3 — New joiners, labelled against today rather than assumed. */}
        <Panel
          title="New joiners"
          description="Employees whose joining date is in the recent past or the near future."
          icon={UserPlus}
          count={board?.newJoiners.length}
        >
          {loadingBoard ? (
            <StateBlock tone="loading" title="Loading new joiners…" />
          ) : boardError !== "" ? (
            <StateBlock tone="error" title="New joiners could not be loaded" description={boardError} />
          ) : board === null || board.newJoiners.length === 0 ? (
            <StateBlock
              tone="empty"
              icon={UserPlus}
              title="No new joiners in this window"
              description={
                board === null
                  ? "The milestone read returned nothing."
                  : `No active employee has a joining date between ${board.lookbackDays} days ago and ${board.windowEndsOn}.`
              }
            />
          ) : (
            <ul className="min-w-0">
              {board.newJoiners.map((row) => (
                <MilestoneRow
                  key={row.employeeId}
                  person={row}
                  when={joinerWhen(row)}
                  detail={row.joiningDate}
                  badge={
                    <span className="mt-1 inline-flex">
                      <StatusPill tone={row.relation === "joined" ? "success" : "info"} dot>
                        {row.relation === "joined" ? "Joined" : "Joining"}
                      </StatusPill>
                    </span>
                  }
                />
              ))}
            </ul>
          )}
        </Panel>

        {/* 4 — Recognition hall of fame, read from the recognition register. */}
        <Panel
          title="Recognition hall of fame"
          description="Award records from the recognition register: recipient, category, citation, who conferred it and any cash bounty."
          icon={Award}
          count={awards.length}
          className="sm:col-span-2 xl:col-span-3"
        >
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNominateOpen((open) => !open);
                setProblem("");
              }}
              disabled={!canWrite || programmes.length === 0}
              aria-expanded={nominateOpen}
              className={primaryButtonClass}
            >
              <Award className="size-3.5" aria-hidden="true" /> Nominate employee
            </button>
            {!canWrite && (
              <span className="text-[11px] text-muted-foreground">
                Raising a nomination needs the employee.write permission, which this role does not hold.
              </span>
            )}
            {canWrite && programmes.length === 0 && (
              <span className="text-[11px] text-muted-foreground">
                No recognition programme is configured for this tenant, so there is nothing to nominate anybody under.
                An award is always made under a programme.
              </span>
            )}
          </div>

          {nominateOpen && canWrite && programmes.length > 0 && (
            <form
              className="mb-4 grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (blocker === "") void nominate();
              }}
            >
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">Employee</span>
                <select
                  className={controlClass}
                  value={form.recipientEmployeeId}
                  onChange={(event) => setForm({ ...form, recipientEmployeeId: event.target.value })}
                >
                  <option value="">Select an employee</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                      {person.department === "" ? "" : ` · ${person.department}`}
                    </option>
                  ))}
                </select>
                {peopleState.error !== "" && (
                  <span className="text-[11px] text-muted-foreground">
                    The employee directory could not be loaded: {peopleState.error}
                  </span>
                )}
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">Programme</span>
                <select className={controlClass} value={form.programmeId} onChange={(event) => chooseProgramme(event.target.value)}>
                  <option value="">Select a programme</option>
                  {programmes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">Award category</span>
                <select
                  className={controlClass}
                  value={form.awardCategory}
                  onChange={(event) => setForm({ ...form, awardCategory: event.target.value })}
                >
                  {AWARD_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">
                  Award value ({selectedProgramme?.currency ?? "INR"})
                </span>
                <input
                  className={controlClass}
                  inputMode="decimal"
                  value={form.awardValue}
                  onChange={(event) => setForm({ ...form, awardValue: event.target.value })}
                  placeholder="Leave blank for a non-monetary award"
                />
                <span className="text-[11px] text-muted-foreground">
                  {selectedProgramme === null
                    ? "Select a programme to see whether it configures a default award."
                    : selectedProgramme.defaultAwardMinor === null
                      ? "This programme configures no default award, so nothing has been pre-filled."
                      : `Pre-filled from this programme's configured default of ${currencyLabel(selectedProgramme.defaultAwardMinor, selectedProgramme.currency)}.`}
                </span>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">Period start</span>
                <input
                  type="date"
                  className={controlClass}
                  value={form.periodStart}
                  onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-foreground">Period end</span>
                <input
                  type="date"
                  className={controlClass}
                  value={form.periodEnd}
                  onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold text-foreground">
                  Citation (at least {citationMinimum} characters — it prints on the certificate)
                </span>
                <textarea
                  className="min-h-20 w-full min-w-0 rounded-lg border border-border bg-card p-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.citation}
                  onChange={(event) => setForm({ ...form, citation: event.target.value })}
                />
                <span className="text-[11px] text-muted-foreground">
                  {citationLength} of {citationMinimum} characters.
                </span>
              </label>

              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2">
                <button type="submit" disabled={busy || blocker !== ""} className={primaryButtonClass}>
                  {busy ? "Raising…" : "Raise nomination"}
                </button>
                <button type="button" onClick={() => setNominateOpen(false)} className={buttonClass}>
                  Cancel
                </button>
                {blocker !== "" && <span className="min-w-0 text-[11px] text-muted-foreground">{blocker}</span>}
              </div>
            </form>
          )}

          {registerState.loading ? (
            <StateBlock tone="loading" title="Loading recognition awards…" />
          ) : registerState.error !== "" ? (
            <StateBlock tone="error" title="Recognition awards could not be loaded" description={registerState.error} />
          ) : awards.length === 0 ? (
            <StateBlock
              tone="empty"
              icon={Award}
              title="No recognition awards recorded"
              description="No award has been raised in this tenant yet. Nominating somebody is the first entry in this register."
            />
          ) : (
            <ul className="min-w-0 space-y-3">
              {awards.map((award) => (
                <li key={award.id} className="min-w-0 rounded-lg border border-border p-3">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-[13px] font-semibold text-foreground">{award.recipient}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {award.categoryLabel}
                        {award.programmeName === "" ? "" : ` · ${award.programmeName}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {award.awardMinor !== null && award.awardMinor > 0 && (
                        <span className="font-mono text-[12px] font-bold text-foreground tabular-nums">
                          {currencyLabel(award.awardMinor, award.currency)}
                        </span>
                      )}
                      <StatusPill tone={stateTone(award.state)} dot>
                        {stateLabelFor(award.state)}
                      </StatusPill>
                    </div>
                  </div>
                  {award.citation !== "" && (
                    <p className="mt-2 text-[12px] leading-[18px] text-muted-foreground">{award.citation}</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {award.conferredBy === "" ? "No nominator recorded on this award." : `Conferred by ${award.conferredBy}.`}
                    {award.awardMinor === null || award.awardMinor === 0
                      ? " No cash bounty is recorded against it."
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
