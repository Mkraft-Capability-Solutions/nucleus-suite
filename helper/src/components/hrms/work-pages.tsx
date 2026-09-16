"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Banknote, CalendarCheck2, HandCoins, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson } from "@/lib/client-api";
import { INTEREST_METHODS, INTEREST_METHOD_LABELS, LOAN_PURPOSES, LOAN_PURPOSE_LABELS } from "@/lib/loan-constants";
import { picklists } from "@/lib/picklists";
import { cancelAvailability, LEAVE_CANCEL_REASON_MIN } from "./leave-cancellation";
import { useWorkspace } from "./workspace-provider";
import { CompanyLoansTab } from "./payroll/company-loans-tab";
import { FnfNoDuesTab } from "./payroll/fnf-no-dues-tab";
import { GrossToNetTab } from "./payroll/gross-to-net-tab";
import { OffCycleRunsTab } from "./payroll/off-cycle-runs-tab";
import { PlantScopingTab } from "./payroll/plant-scoping-tab";
import {
  AiLabel,
  AvatarMark,
  PageIntro,
  SectionHeading,
  StatusPill,
  Surface,
} from "./page-primitives";
import {
  ModuleStat,
  ModuleTabs,
  RegisterNotice,
  RegisterStates,
  TabPanel,
  listFromEnvelope,
  listOf,
  recordFromEnvelope,
  stateLabel,
  useRegisterResource,
  type Notice,
} from "./register-primitives";

/* ------------------------------------------------------------------ */
/* Shared live-data helpers (no fixtures: every figure comes from fetch) */
/* ------------------------------------------------------------------ */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** POST helper for live creation/decision actions. Throws with the server error envelope on non-2xx (callers confirm only on success). */
async function postJson(
  path: string,
  body: unknown,
  options?: { idempotency?: boolean; version?: number },
): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Consequential POSTs carry an Idempotency-Key; harmless where the route ignores it.
  if (options?.idempotency !== false) headers["Idempotency-Key"] = crypto.randomUUID();
  // Version precondition for irreversible transitions (payroll finalize, loan disburse, advance pay).
  if (options?.version !== undefined) headers["If-Match"] = `"${String(options.version)}"`;
  const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body ?? {}) });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(path, response.status, payload));
  return payload;
}

function apiErrorMessage(path: string, status: number, payload: unknown): string {
  const err = asRecord(payload).error;
  if (typeof err === "object" && err !== null) {
    const record = err as UnknownRecord;
    const code = str(record.code, "REQUEST_FAILED");
    const message = str(record.message, `Request failed (${String(status)}): ${path}`);
    const details = Array.isArray(record.details)
      ? (record.details as unknown[])
          .map((entry) => {
            const item = asRecord(entry);
            return `${str(item.field, "?")}: ${str(item.issue, "?")}`;
          })
          .join("; ")
      : "";
    return details ? `${code}: ${message} (${details})` : `${code}: ${message}`;
  }
  return `Request failed (${String(status)}): ${path}`;
}

/** Rupees (major units) → integer minor units (paise). Null when the input is not a positive amount. */
function rupeesToMinor(rupees: string): number | null {
  const parsed = Number(rupees);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

/** Local "HH:MM" + work date → ISO instant (Zulu offset, accepted by zod datetime offset:true). */
function toOffsetIso(workDate: string, time: string): string {
  const local = new Date(`${workDate}T${time}:00`);
  if (Number.isNaN(local.getTime())) return "";
  return local.toISOString();
}

/** A server refusal, announced. The message is the server's own wording, never reworded. */
function FormError({ message }: { message: string }): ReactNode {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 font-mono text-[11px] leading-relaxed text-destructive">
      {message}
    </p>
  );
}

function FormOk({ message }: { message: string }): ReactNode {
  if (!message) return null;
  return (
    <p role="status" className="mt-3 font-mono text-[11px] leading-relaxed text-success">
      {message}
    </p>
  );
}

/** Backend money is integer minor units (paise). Rendered with en-IN grouping. */
function formatMinor(minor: unknown, currency: unknown): string {
  const value = num(minor);
  if (value === null) return "—";
  const major = value / 100;
  const grouped = major.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const code = str(currency, "INR");
  return code === "INR" ? `₹${grouped}` : `₹${grouped} ${code}`;
}

function formatMinutes(minutes: unknown): string {
  const value = num(minutes);
  if (value === null) return "—";
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours)}h ${String(mins).padStart(2, "0")}m`;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function dayKey(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function personLabel(item: UnknownRecord): string {
  const name = `${str(item.firstName)} ${str(item.lastName)}`.trim();
  return name || str(item.employeeCode, str(item.id, "Unknown employee"));
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

const selectClass =
  "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass =
  "h-10 rounded-xl border border-border bg-card px-3 font-mono text-xs text-foreground";

function LoadingLine(): ReactNode {
  return <p className="py-6 text-center font-mono text-xs text-muted-foreground">Loading…</p>;
}

function EmptyLine({ children }: { children: ReactNode }): ReactNode {
  return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-xs leading-relaxed text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={onRetry}>
        <RefreshCcw className="mr-1.5 size-3.5" /> Retry
      </Button>
    </div>
  );
}

type PeopleState = {
  people: UnknownRecord[];
  loading: boolean;
  error: string;
  reload: () => void;
};

function usePeople(): PeopleState {
  const [people, setPeople] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/people?search=&page=1&pageSize=100");
        const items = asRecord(raw).data;
        if (!cancelled) setPeople(Array.isArray(items) ? (items as UnknownRecord[]) : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load people.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { people, loading, error, reload: () => setNonce((n) => n + 1) };
}

function usePeopleNameMap(people: UnknownRecord[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      const id = str(person.id);
      if (id) map.set(id, personLabel(person));
    }
    return map;
  }, [people]);
}

/* ------------------------------------------------------------------ */
/* Attendance — Leave & Time-Office Engine console                     */
/* GET /api/v1/attendance/engine · /session · /timesheet · /anomalies   */
/* GET /api/v1/attendance/team-summary · /days                         */
/* POST /api/v1/attendance/punches · POST /api/v1/regularizations      */
/* ------------------------------------------------------------------ */

type AttendanceDay = {
  id: string;
  date: string;
  shift: string;
  productive: number | null;
  gross: number | null;
  status: string;
  locked: boolean;
};

type AttendanceTeamEmployee = UnknownRecord & {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  recordedDays: number;
  present: number;
  halfDay: number;
  absent: number;
  productiveMinutes: number;
  payableOtMinutes: number;
};

function attendanceTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "present" || key === "locked") return "success";
  if (key === "half_day" || key === "halfday") return "warning";
  if (key === "absent") return "danger";
  return "neutral";
}

/** Only strings survive: a rule line the server did not send is never invented here. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Current calendar month as YYYY-MM. */
function currentPeriod(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Shifts a YYYY-MM period by whole months, rolling the year over. */
function shiftPeriod(period: string, delta: number): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return period;
  const zeroBased = (year * 12 + (month - 1)) + delta;
  return `${String(Math.floor(zeroBased / 12))}-${String((zeroBased % 12) + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function periodLabel(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  if (!Number.isInteger(year) || month < 1 || month > 12) return period;
  return `${MONTH_NAMES[month - 1]} ${String(year)}`;
}

const TIMESHEET_LABELS: Record<string, string> = {
  in: "Present",
  late: "Late",
  off: "Weekly off",
  absent: "Absent",
  leave: "Leave",
};

function timesheetTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "in") return "success";
  if (status === "late") return "warning";
  if (status === "absent") return "danger";
  if (status === "leave") return "info";
  return "neutral";
}

/**
 * Rule-pack header shared by both engine consoles. Everything rendered here is
 * read from the pack the server returned — when no pack is configured the card
 * says so instead of showing invented rule text.
 */
function EngineBanner({
  title,
  engine,
  loading,
  error,
  onRetry,
  missingText,
}: {
  title: string;
  engine: UnknownRecord;
  loading: boolean;
  error: string;
  onRetry: () => void;
  missingText: string;
}): ReactNode {
  const code = str(engine.rulePackCode);
  const version = str(engine.rulePackVersion);
  const effectiveFrom = str(engine.effectiveFrom);
  const rules = stringList(engine.rules);
  return (
    <Surface className="mb-6">
      <SectionHeading
        title={title}
        description="The active rule pack, exactly as the engine has it recorded."
        action={code ? <StatusPill tone="info">{version ? `v${version}` : "Unversioned"}</StatusPill> : undefined}
      />
      {loading ? (
        <LoadingLine />
      ) : error ? (
        <ErrorBlock message={error} onRetry={onRetry} />
      ) : !code ? (
        <EmptyLine>{missingText}</EmptyLine>
      ) : (
        <>
          <p className="font-mono text-xs text-muted-foreground">
            {code}
            {version ? ` · v${version}` : ""}
            {effectiveFrom ? ` · effective from ${effectiveFrom.slice(0, 10)}` : " · no effective date recorded"}
          </p>
          {rules.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              This pack stores no readable rule lines, so none are shown.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {rules.map((rule) => (
                <span
                  key={rule}
                  className="rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-[11px] leading-4 text-muted-foreground"
                >
                  {rule}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Surface>
  );
}

/** Workbook picklists this screen offers, read from the registry rather than retyped. */
const REGULARISATION_TYPES = picklists.PL_REGULARISATION_TYPE.values;
const GATE_PASS_TYPES = picklists.PL_GATE_PASS_TYPE.values;
const PUNCH_SOURCES = picklists.PL_PUNCH_SOURCE.values;
const GEOFENCE_RESULTS = picklists.PL_GEOFENCE_RESULT.values;

/** Requested in/out times are mandatory only where there is a punch pair to correct. */
const PUNCH_CORRECTION_KINDS: readonly string[] = ["missing_punch", "device_failure"];

const ATTENDANCE_TABS = [
  { id: "timesheet", label: "Monthly Timesheet & Calendar" },
  { id: "gate-pass", label: "Gate Pass Quota & Ledger" },
  { id: "recompute", label: "Time-Office Recompute Ledger" },
  { id: "categories", label: "Worker Categories & Plant Calendars" },
] as const;

export function AttendancePage() {
  const [tab, setTab] = useState<string>("timesheet");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState(() => dayKey(-29));
  const [to, setTo] = useState(() => dayKey(0));
  const [teamData, setTeamData] = useState<UnknownRecord>({});
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState("");
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  // Monthly timesheet / session / gate-pass scope: one person, one YYYY-MM period.
  const [period, setPeriod] = useState<string>(currentPeriod);
  const [sheetEmployeeId, setSheetEmployeeId] = useState("");
  // POST /api/v1/attendance/punches (ingestPunchesSchema: employeeId, workDate, shiftCode, punches[>=2 alternate in→out])
  const [punchDate, setPunchDate] = useState(() => dayKey(0));
  const [punchShift, setPunchShift] = useState("A");
  const [punchIn, setPunchIn] = useState("09:00");
  const [punchOut, setPunchOut] = useState("18:00");
  const [punchSource, setPunchSource] = useState<string>("web");
  const [punchDevice, setPunchDevice] = useState("");
  const [punchLat, setPunchLat] = useState("");
  const [punchLng, setPunchLng] = useState("");
  const [punchGeofence, setPunchGeofence] = useState<string>(GEOFENCE_RESULTS[0].value);
  const [punchSelfie, setPunchSelfie] = useState("");
  const [punchJobCode, setPunchJobCode] = useState("");
  const [punchOffline, setPunchOffline] = useState(false);
  const [punchRemark, setPunchRemark] = useState("");
  const [punchBusy, setPunchBusy] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [punchOk, setPunchOk] = useState("");
  // POST /api/v1/regularizations (requestRegularizationSchema: employeeId, date, kind, reason, claimedIn?, claimedOut?, documentRef?)
  const [regDate, setRegDate] = useState(() => dayKey(0));
  const [regKind, setRegKind] = useState<string>(REGULARISATION_TYPES[0].value);
  const [regReason, setRegReason] = useState("");
  const [regIn, setRegIn] = useState("");
  const [regOut, setRegOut] = useState("");
  const [regDocumentRef, setRegDocumentRef] = useState("");
  // POST /api/v1/gate-passes (requestGatePassSchema: employeeId, date, fromTime, toTime, passType, reason, expectedReturn?)
  const [gateDate, setGateDate] = useState(() => dayKey(0));
  const [gateFrom, setGateFrom] = useState("14:00");
  const [gateTo, setGateTo] = useState("16:00");
  const [gateType, setGateType] = useState<string>(GATE_PASS_TYPES[0].value);
  const [gateReason, setGateReason] = useState("");
  const [gateExpectedReturn, setGateExpectedReturn] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");
  const [gateOk, setGateOk] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState("");
  const [regOk, setRegOk] = useState("");

  const rangeValid =
    /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const people = useMemo(
    () => (Array.isArray(teamData.employees) ? teamData.employees : []) as AttendanceTeamEmployee[],
    [teamData.employees],
  );
  const nameMap = usePeopleNameMap(people);
  const activeEmployeeId = employeeId;
  const canFetch = activeEmployeeId !== "" && rangeValid;
  const teamSummary = asRecord(teamData.summary);
  const teamScope = asRecord(teamData.scope);

  // Directory feed for the timesheet/session scope selector.
  const {
    people: directory,
    loading: directoryLoading,
    error: directoryError,
    reload: reloadDirectory,
  } = usePeople();
  const activeSheetId = sheetEmployeeId || (directory.length > 0 ? str(directory[0]?.id) : "");

  const engineState = useRegisterResource(`/api/v1/attendance/engine?year=${period.slice(0, 4)}`);
  const sessionState = useRegisterResource(
    activeSheetId ? `/api/v1/attendance/session?employeeId=${encodeURIComponent(activeSheetId)}&period=${period}` : "",
  );
  const timesheetState = useRegisterResource(
    activeSheetId ? `/api/v1/attendance/timesheet?employeeId=${encodeURIComponent(activeSheetId)}&period=${period}` : "",
  );
  const anomaliesState = useRegisterResource("/api/v1/attendance/anomalies?limit=20");

  const engineData = useMemo(() => recordFromEnvelope(engineState.data), [engineState.data]);
  const engine = useMemo(() => asRecord(engineData.engine), [engineData]);
  const workerCategories = useMemo(() => listOf(engineData.workerCategories), [engineData]);
  const plantCalendars = useMemo(() => listOf(engineData.plantCalendars), [engineData]);
  const sessionData = useMemo(() => recordFromEnvelope(sessionState.data), [sessionState.data]);
  const session = useMemo(() => asRecord(sessionData.session), [sessionData]);
  const shift = useMemo(() => asRecord(sessionData.shift), [sessionData]);
  const quota = useMemo(() => asRecord(sessionData.gatePassQuota), [sessionData]);
  const timesheet = useMemo(() => listFromEnvelope(timesheetState.data), [timesheetState.data]);
  const anomalies = useMemo(() => listFromEnvelope(anomaliesState.data), [anomaliesState.data]);

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    void (async () => {
      setPeopleLoading(true);
      setPeopleError("");
      try {
        const raw = await getJson(`/api/v1/attendance/team-summary?from=${from}&to=${to}`);
        if (!cancelled) setTeamData(asRecord(asRecord(raw).data));
      } catch (err) {
        if (!cancelled) setPeopleError(err instanceof Error ? err.message : "Could not load team attendance.");
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to, rangeValid, nonce]);

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    const targetEmployeeId = activeEmployeeId;
    const targetFrom = from;
    const targetTo = to;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson(
          `/api/v1/attendance/days?employeeId=${encodeURIComponent(targetEmployeeId)}&from=${targetFrom}&to=${targetTo}`,
        );
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          date: str(item.work_date, str(item.attendance_date, "—")),
          shift: str(item.assigned_shift, "—"),
          productive: num(item.productive_minutes),
          gross: num(item.gross_span_minutes),
          status: str(item.status, "—"),
          locked: bool(item.locked),
        }));
        if (!cancelled) setDays(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load attendance days.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetch, activeEmployeeId, from, to, nonce]);

  const breakdown = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let other = 0;
    let productiveTotal = 0;
    for (const day of days) {
      const tone = attendanceTone(day.status);
      if (tone === "success") present += 1;
      else if (tone === "warning") halfDay += 1;
      else if (tone === "danger") absent += 1;
      else other += 1;
      if (day.productive !== null) productiveTotal += day.productive;
    }
    return { present, halfDay, absent, other, productiveTotal, total: days.length };
  }, [days]);

  /** Real calendar grid: leading blanks to the first weekday, one cell per day of the month. */
  const monthGrid = useMemo(() => {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    if (!Number.isInteger(year) || month < 1 || month > 12) return { blanks: 0, cells: [] as Array<{ key: string; day: number; row: UnknownRecord | null }> };
    const blanks = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const byDate = new Map(timesheet.map((row) => [str(row.date), row]));
    const cells = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${period}-${String(day).padStart(2, "0")}`;
      cells.push({ key, day, row: byDate.get(key) ?? null });
    }
    return { blanks, cells };
  }, [period, timesheet]);

  const employeeName = activeEmployeeId
    ? (nameMap.get(activeEmployeeId) ?? shortId(activeEmployeeId))
    : "";
  const sheetPerson = directory.find((person) => str(person.id) === activeSheetId) ?? null;

  const sessionOpen = bool(session.open);
  const elapsed = num(session.elapsedMinutes);
  const checkedInAt = str(session.checkedInAt);
  const shiftName = str(shift.shiftName);
  const graceMinutes = num(shift.graceMinutes);
  /** The gate pass duration is derived from the two times, exactly as the server derives it. */
  const gateMinutes = useMemo(() => {
    const parse = (value: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null);
    const start = parse(gateFrom);
    const end = parse(gateTo);
    return start === null || end === null ? null : end - start;
  }, [gateFrom, gateTo]);
  const quotaCeiling = num(quota.ceilingMinutes);
  const quotaUsed = num(quota.usedMinutes);
  const quotaRemaining = num(quota.requestsRemaining);

  const engineStats = [
    {
      label: "Current Session",
      value: sessionState.loading ? null : sessionOpen && elapsed !== null ? formatMinutes(elapsed) : "Not checked in",
      note: sessionOpen && checkedInAt
        ? `Checked in at ${checkedInAt.slice(11, 16) || checkedInAt.slice(0, 16).replace("T", " ")}`
        : "No open punch session on record",
    },
    {
      label: "Active Shift Assignment",
      value: sessionState.loading ? null : shiftName || str(shift.shiftCode) || "No shift assigned",
      note: str(shift.startsAt) && str(shift.endsAt)
        ? `${str(shift.startsAt)} → ${str(shift.endsAt)} · Grace window: ${graceMinutes === null ? "not set" : `${String(graceMinutes)} mins`}`
        : "No shift window recorded for this employee",
    },
    {
      label: "Monthly Gate Pass Quota",
      value: sessionState.loading
        ? null
        : quotaCeiling === null || quotaCeiling === 0
          ? "No gate-pass policy configured"
          : `${String(quotaUsed ?? 0)} / ${String(quotaCeiling)} mins used`,
      note: quotaCeiling === null || quotaCeiling === 0
        ? `No ceiling is set for ${periodLabel(period)}`
        : `${quotaRemaining === null ? "Unlimited" : String(quotaRemaining)} request(s) remaining · ${str(quota.period, period)}`,
    },
  ];

  const tabs = ATTENDANCE_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "timesheet" ? monthGrid.cells.length
      : entry.id === "recompute" ? days.length
      : entry.id === "categories" ? workerCategories.length
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Time Office · Attendance Engine"
        title="Leave & Time-Office Engine"
        description="Cross midnight punch pairing, break exceptions, gate-pass quota validation, and multi-plant category rules."
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href="/gate-pass-register"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Gate pass register
            </Link>
            <AiLabel>{str(teamScope.kind, "Live")} scope</AiLabel>
          </span>
        }
      />
      <RegisterNotice notice={notice} />

      <EngineBanner
        title="Attendance rule pack"
        engine={engine}
        loading={engineState.loading}
        error={engineState.error}
        onRetry={engineState.refresh}
        missingText="No attendance rule pack is configured, so no engine rules can be shown."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {engineStats.map((item) => (
          <ModuleStat key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>

      {anomaliesState.loading || anomaliesState.error || anomalies.length === 0 ? null : (
        <Surface className="mb-6">
          <SectionHeading
            title={`${String(anomalies.length)} potential anomalies flagged for HR review`}
            description="Exceptions the engine could not resolve on its own."
          />
          <div className="space-y-2">
            {anomalies.map((row, index) => (
              <div
                key={str(row.id, `${str(row.employeeCode)}-${String(index)}`)}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {str(row.employeeName, "Unnamed employee")} · {str(row.employeeCode, "—")}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {str(row.date, "—")} · {stateLabel(str(row.kind))}
                    {str(row.detail) ? ` · ${str(row.detail)}` : ""}
                  </p>
                </div>
                <StatusPill tone="warning" dot>{stateLabel(str(row.status))}</StatusPill>
              </div>
            ))}
          </div>
        </Surface>
      )}

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Attendance engine sections" />

      <TabPanel id="timesheet" active={tab}>
        <Surface className="mb-6">
          <SectionHeading
            title="Monthly timesheet"
            description="One cell per calendar day, straight from the time office. Days with nothing recorded stay blank."
          />
          {directoryLoading ? (
            <LoadingLine />
          ) : directoryError ? (
            <ErrorBlock message={directoryError} onRetry={reloadDirectory} />
          ) : directory.length === 0 ? (
            <EmptyLine>No employees are visible to you, so no timesheet can be drawn.</EmptyLine>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Employee
                  </span>
                  <select
                    aria-label="Timesheet employee"
                    className={`${selectClass} w-full`}
                    value={activeSheetId}
                    onChange={(event) => setSheetEmployeeId(event.target.value)}
                  >
                    {directory.map((person) => (
                      <option key={str(person.id)} value={str(person.id)}>
                        {personLabel(person)} · {str(person.employeeCode, "—")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Previous month"
                    className="h-10 w-10 shrink-0 rounded-xl text-sm"
                    onClick={() => setPeriod((current) => shiftPeriod(current, -1))}
                  >
                    ‹
                  </Button>
                  <span className="min-w-0 flex-1 text-center font-mono text-xs font-bold text-foreground sm:min-w-[9rem] sm:flex-none">
                    {periodLabel(period)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Next month"
                    className="h-10 w-10 shrink-0 rounded-xl text-sm"
                    onClick={() => setPeriod((current) => shiftPeriod(current, 1))}
                  >
                    ›
                  </Button>
                </div>
              </div>
              <RegisterStates
                loading={timesheetState.loading}
                error={timesheetState.error}
                empty={!timesheetState.loading && !timesheetState.error && monthGrid.cells.length === 0}
                onRetry={timesheetState.refresh}
                loadingLabel="Loading the monthly timesheet…"
                errorTitle="Timesheet unavailable"
                emptyTitle="No calendar days for this period"
                emptyHint="Pick another month, or check that the period is a valid calendar month."
              />
              {!timesheetState.loading && !timesheetState.error && monthGrid.cells.length > 0 && (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
                    {WEEKDAY_LABELS.map((weekday) => (
                      <p
                        key={weekday}
                        className="pb-1 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {weekday}
                      </p>
                    ))}
                    {Array.from({ length: monthGrid.blanks }, (_, index) => (
                      <div key={`blank-${String(index)}`} aria-hidden className="min-h-[68px] rounded-xl" />
                    ))}
                    {monthGrid.cells.map((cell) => {
                      const status = cell.row ? str(cell.row.status, "not_recorded") : "not_recorded";
                      const recorded = status !== "not_recorded";
                      return (
                        <div
                          key={cell.key}
                          className={`min-h-[68px] rounded-xl border p-2 ${
                            recorded ? "border-border/80 bg-card" : "border-dashed border-border/50 bg-transparent"
                          }`}
                        >
                          <p className="font-mono text-[11px] font-bold text-foreground">{cell.day}</p>
                          {recorded ? (
                            <>
                              <span className="mt-1.5 block">
                                <StatusPill tone={timesheetTone(status)} dot>
                                  {TIMESHEET_LABELS[status] ?? stateLabel(status)}
                                </StatusPill>
                              </span>
                              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                                {cell.row && str(cell.row.shiftCode) ? str(cell.row.shiftCode) : "—"}
                                {cell.row && num(cell.row.grossMinutes) !== null
                                  ? ` · ${formatMinutes(cell.row.grossMinutes)}`
                                  : ""}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1.5 text-[10px] text-muted-foreground/50">Not recorded</p>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                    {periodLabel(period)} for {sheetPerson ? personLabel(sheetPerson) : "the selected employee"}. A day
                    with no record is left blank rather than counted as an absence.
                  </p>
                </>
              )}
            </>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="gate-pass" active={tab}>
        <Surface className="mb-6">
          <SectionHeading
            title="Request a gate pass"
            description="Short leave for the employee selected on the timesheet tab. The duration is taken from the two times."
          />
          {!activeSheetId ? (
            <EmptyLine>Select an employee on the timesheet tab to request a gate pass.</EmptyLine>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Date</span>
                  <input
                    aria-label="Gate pass date"
                    type="date"
                    className={inputClass}
                    value={gateDate}
                    onChange={(event) => setGateDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">From time</span>
                  <input
                    aria-label="Gate pass from time"
                    type="time"
                    className={inputClass}
                    value={gateFrom}
                    onChange={(event) => setGateFrom(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">To time</span>
                  <input
                    aria-label="Gate pass to time"
                    type="time"
                    className={inputClass}
                    value={gateTo}
                    onChange={(event) => setGateTo(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Type</span>
                  <select
                    aria-label="Gate pass type"
                    className={selectClass}
                    value={gateType}
                    onChange={(event) => setGateType(event.target.value)}
                  >
                    {GATE_PASS_TYPES.map((passType) => (
                      <option key={passType.value} value={passType.value}>
                        {passType.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Expected return (optional)
                  </span>
                  <input
                    aria-label="Gate pass expected return"
                    type="time"
                    className={inputClass}
                    value={gateExpectedReturn}
                    onChange={(event) => setGateExpectedReturn(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Reason</span>
                  <input
                    aria-label="Gate pass reason"
                    type="text"
                    placeholder="Bank visit"
                    className={inputClass}
                    value={gateReason}
                    onChange={(event) => setGateReason(event.target.value)}
                  />
                </label>
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                Duration {gateMinutes === null ? "—" : `${String(gateMinutes)} minute(s)`}
                {gateType === "official" ? " · Official passes do not consume the personal ceiling." : ""}
              </p>
              <Button
                className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                disabled={gateBusy}
                onClick={() => {
                  void (async () => {
                    setGateError("");
                    setGateOk("");
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(gateDate)) {
                      setGateError("BAD_REQUEST: A valid date (YYYY-MM-DD) is required.");
                      return;
                    }
                    if (gateMinutes === null || gateMinutes <= 0) {
                      setGateError("BAD_REQUEST: The gate pass must end after it starts.");
                      return;
                    }
                    if (gateReason.trim().length < 5) {
                      setGateError("BAD_REQUEST: A reason of at least 5 characters is required.");
                      return;
                    }
                    setGateBusy(true);
                    try {
                      const result = (await postJson("/api/v1/gate-passes", {
                        employeeId: activeSheetId,
                        date: gateDate,
                        fromTime: gateFrom,
                        toTime: gateTo,
                        passType: gateType,
                        reason: gateReason.trim(),
                        ...(gateExpectedReturn ? { expectedReturn: gateExpectedReturn } : {}),
                      })) as UnknownRecord;
                      const data = asRecord(result.data);
                      setGateOk(`Gate pass submitted (${str(data.id, "recorded")}, ${String(num(data.minutes) ?? gateMinutes)} minutes).`);
                      setNotice({ text: "Gate pass submitted for approval.", tone: "success" });
                      setGateReason("");
                      sessionState.refresh();
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Could not submit the gate pass.";
                      setGateError(message);
                      setNotice({ text: message, tone: "error" });
                    } finally {
                      setGateBusy(false);
                    }
                  })();
                }}
              >
                {gateBusy ? "Submitting…" : "Submit gate pass"}
              </Button>
              <FormError message={gateError} />
              <FormOk message={gateOk} />
            </>
          )}
        </Surface>
        <Surface>
          <SectionHeading
            title="Monthly gate pass quota"
            description="Short-leave minutes consumed against the ceiling for the selected period."
            action={
              <Link href="/gate-pass-register" className="text-xs font-semibold text-primary hover:underline">
                Open gate pass register
              </Link>
            }
          />
          {!activeSheetId ? (
            <EmptyLine>Select an employee on the timesheet tab to see their gate-pass quota.</EmptyLine>
          ) : (
            <>
              <RegisterStates
                loading={sessionState.loading}
                error={sessionState.error}
                empty={!sessionState.loading && !sessionState.error && Object.keys(quota).length === 0}
                onRetry={sessionState.refresh}
                loadingLabel="Loading the gate-pass quota…"
                errorTitle="Gate pass quota unavailable"
                emptyTitle="No quota returned"
                emptyHint="The engine returned no gate-pass quota for this employee and period."
              />
              {!sessionState.loading && !sessionState.error && Object.keys(quota).length > 0 && (
                quotaCeiling === null || quotaCeiling === 0 ? (
                  <EmptyLine>
                    No gate-pass policy configured for {periodLabel(period)}, so no ceiling can be enforced.
                  </EmptyLine>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Period", str(quota.period, period)],
                      ["Minutes used", String(quotaUsed ?? 0)],
                      ["Ceiling (mins)", String(quotaCeiling)],
                      ["Requests remaining", quotaRemaining === null ? "—" : String(quotaRemaining)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border/80 bg-secondary/30 p-5">
                        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
              <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                Individual gate passes and the movement log live in the gate pass register; this console only validates
                the quota the engine applies.
              </p>
            </>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="recompute" active={tab}>
        <Surface>
          <SectionHeading
            title="Team scope & range"
            description={`Showing ${String(teamSummary.visibleEmployees ?? 0)} visible employee(s). Select one person only when you want day-level detail or an action.`}
          />
          {peopleLoading ? (
            <LoadingLine />
          ) : peopleError ? (
            <ErrorBlock message={peopleError} onRetry={() => setNonce((n) => n + 1)} />
          ) : people.length === 0 ? (
            <EmptyLine>No employees found in the directory, so there is nobody to inspect.</EmptyLine>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Employee
                </span>
                <select
                  aria-label="Employee"
                  className={`${selectClass} w-full`}
                  value={activeEmployeeId}
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    setDays([]);
                  }}
                >
                  <option value="">All visible employees</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)} · {str(person.employeeCode, "—")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  From
                </span>
                <input
                  aria-label="From date"
                  type="date"
                  className={`${inputClass} w-full`}
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setDays([]);
                  }}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  To
                </span>
                <input
                  aria-label="To date"
                  type="date"
                  className={`${inputClass} w-full`}
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setDays([]);
                  }}
                />
              </label>
            </div>
          )}
        </Surface>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading
              title="Record Punches"
              description="Record clock-in and clock-out times for the selected employee."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Work date
                </span>
                <input
                  aria-label="Punch work date"
                  type="date"
                  className={`${inputClass} w-full`}
                  value={punchDate}
                  onChange={(event) => setPunchDate(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Shift
                </span>
                <select
                  aria-label="Punch shift"
                  className={`${selectClass} w-full`}
                  value={punchShift}
                  onChange={(event) => setPunchShift(event.target.value)}
                >
                  <option value="A">A · General</option>
                  <option value="B">B · Night</option>
                  <option value="C">C · Morning</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  In at
                </span>
                <input
                  aria-label="Punch in time"
                  type="time"
                  className={`${inputClass} w-full`}
                  value={punchIn}
                  onChange={(event) => setPunchIn(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Out at
                </span>
                <input
                  aria-label="Punch out time"
                  type="time"
                  className={`${inputClass} w-full`}
                  value={punchOut}
                  onChange={(event) => setPunchOut(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Capture source
                </span>
                <select
                  aria-label="Punch capture source"
                  className={selectClass}
                  value={punchSource}
                  onChange={(event) => setPunchSource(event.target.value)}
                >
                  {PUNCH_SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Device / terminal ID
                </span>
                <input
                  aria-label="Punch device reference"
                  type="text"
                  placeholder="Gate reader 2"
                  className={inputClass}
                  value={punchDevice}
                  onChange={(event) => setPunchDevice(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Latitude{punchSource === "mobile_app" ? "" : " (optional)"}
                </span>
                <input
                  aria-label="Punch latitude"
                  type="number"
                  step="0.000001"
                  className={inputClass}
                  value={punchLat}
                  onChange={(event) => setPunchLat(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Longitude{punchSource === "mobile_app" ? "" : " (optional)"}
                </span>
                <input
                  aria-label="Punch longitude"
                  type="number"
                  step="0.000001"
                  className={inputClass}
                  value={punchLng}
                  onChange={(event) => setPunchLng(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Geofence result
                </span>
                <select
                  aria-label="Punch geofence result"
                  className={selectClass}
                  value={punchGeofence}
                  onChange={(event) => setPunchGeofence(event.target.value)}
                >
                  {GEOFENCE_RESULTS.map((result) => (
                    <option key={result.value} value={result.value}>
                      {result.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Selfie reference (optional)
                </span>
                <input
                  aria-label="Punch selfie reference"
                  type="text"
                  className={inputClass}
                  value={punchSelfie}
                  onChange={(event) => setPunchSelfie(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Work order / job code (optional)
                </span>
                <input
                  aria-label="Punch job code"
                  type="text"
                  className={inputClass}
                  value={punchJobCode}
                  onChange={(event) => setPunchJobCode(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Remarks (optional)
                </span>
                <input
                  aria-label="Punch remarks"
                  type="text"
                  className={inputClass}
                  value={punchRemark}
                  onChange={(event) => setPunchRemark(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2.5">
                <input
                  aria-label="Punch queued offline"
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={punchOffline}
                  onChange={(event) => setPunchOffline(event.target.checked)}
                />
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Queued offline
                </span>
              </label>
            </div>
            <Button
              className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              disabled={!canFetch || punchBusy}
              onClick={() => {
                void (async () => {
                  setPunchError("");
                  setPunchOk("");
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(punchDate)) {
                    setPunchError("BAD_REQUEST: A valid work date (YYYY-MM-DD) is required.");
                    return;
                  }
                  if (!punchIn || !punchOut || punchOut <= punchIn) {
                    setPunchError("BAD_REQUEST: Out time must be after in time on the same day.");
                    return;
                  }
                  const inIso = toOffsetIso(punchDate, punchIn);
                  const outIso = toOffsetIso(punchDate, punchOut);
                  if (!inIso || !outIso) {
                    setPunchError("BAD_REQUEST: Punch times could not be parsed.");
                    return;
                  }
                  const lat = Number(punchLat);
                  const lng = Number(punchLng);
                  const hasGeo = punchLat.trim() !== "" && punchLng.trim() !== "" && Number.isFinite(lat) && Number.isFinite(lng);
                  if (punchSource === "mobile_app" && !hasGeo) {
                    setPunchError("BAD_REQUEST: A mobile punch must carry its latitude and longitude.");
                    return;
                  }
                  // Both punches in a pair share the capture evidence of the one submission.
                  const capture = {
                    source: punchSource,
                    ...(punchDevice.trim() ? { deviceReference: punchDevice.trim() } : {}),
                    ...(hasGeo ? { geo: { lat, lng }, geofenceResult: punchGeofence } : {}),
                    ...(punchSelfie.trim() ? { selfieRef: punchSelfie.trim() } : {}),
                    ...(punchJobCode.trim() ? { jobCode: punchJobCode.trim() } : {}),
                    offlineQueued: punchOffline,
                    ...(punchRemark.trim() ? { remark: punchRemark.trim() } : {}),
                  };
                  setPunchBusy(true);
                  try {
                    await postJson("/api/v1/attendance/punches", {
                      employeeId: activeEmployeeId,
                      workDate: punchDate,
                      shiftCode: punchShift,
                      punches: [
                        { at: inIso, type: "in", ...capture },
                        { at: outIso, type: "out", ...capture },
                      ],
                    });
                    setPunchOk(`Punches recorded for ${punchDate}. Day rows refreshed below.`);
                    setNotice({ text: `Punches recorded for ${punchDate}.`, tone: "success" });
                    setPunchRemark("");
                    setNonce((n) => n + 1);
                    timesheetState.refresh();
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Could not record punches.";
                    setPunchError(message);
                    setNotice({ text: message, tone: "error" });
                  } finally {
                    setPunchBusy(false);
                  }
                })();
              }}
            >
              {punchBusy ? "Recording…" : "Record punch in/out"}
            </Button>
            <FormError message={punchError} />
            <FormOk message={punchOk} />
          </Surface>

          <Surface>
            <SectionHeading
              title="Request Regularization"
              description="Request a missing-punch or shift correction."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Date
                </span>
                <input
                  aria-label="Regularization date"
                  type="date"
                  className={`${inputClass} w-full`}
                  value={regDate}
                  onChange={(event) => setRegDate(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Kind
                </span>
                <select
                  aria-label="Regularization kind"
                  className={`${selectClass} w-full`}
                  value={regKind}
                  onChange={(event) => setRegKind(event.target.value)}
                >
                  {REGULARISATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Requested in time{PUNCH_CORRECTION_KINDS.includes(regKind) ? "" : " (optional)"}
                </span>
                <input
                  aria-label="Claimed in"
                  type="text"
                  placeholder="09:00 AM"
                  className={`${inputClass} w-full`}
                  value={regIn}
                  onChange={(event) => setRegIn(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Requested out time{PUNCH_CORRECTION_KINDS.includes(regKind) ? "" : " (optional)"}
                </span>
                <input
                  aria-label="Claimed out"
                  type="text"
                  placeholder="06:00 PM"
                  className={`${inputClass} w-full`}
                  value={regOut}
                  onChange={(event) => setRegOut(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reason (at least 15 characters)
                </span>
                <input
                  aria-label="Regularization reason"
                  type="text"
                  placeholder="Forgot to punch out at the gate"
                  className={`${inputClass} w-full`}
                  value={regReason}
                  onChange={(event) => setRegReason(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Supporting document (optional)
                </span>
                <input
                  aria-label="Regularization supporting document"
                  type="text"
                  placeholder="Document reference"
                  className={inputClass}
                  value={regDocumentRef}
                  onChange={(event) => setRegDocumentRef(event.target.value)}
                />
              </label>
            </div>
            <Button
              className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              disabled={!canFetch || regBusy}
              onClick={() => {
                void (async () => {
                  setRegError("");
                  setRegOk("");
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(regDate)) {
                    setRegError("BAD_REQUEST: A valid date (YYYY-MM-DD) is required.");
                    return;
                  }
                  if (regReason.trim().length < 15) {
                    setRegError("BAD_REQUEST: A reason of at least 15 characters is required.");
                    return;
                  }
                  if (PUNCH_CORRECTION_KINDS.includes(regKind) && (!regIn.trim() || !regOut.trim())) {
                    setRegError("BAD_REQUEST: A punch correction must state both the requested in and out times.");
                    return;
                  }
                  setRegBusy(true);
                  try {
                    const result = (await postJson("/api/v1/regularizations", {
                      employeeId: activeEmployeeId,
                      date: regDate,
                      kind: regKind,
                      reason: regReason.trim(),
                      ...(regIn.trim() ? { claimedIn: regIn.trim() } : {}),
                      ...(regOut.trim() ? { claimedOut: regOut.trim() } : {}),
                      ...(regDocumentRef.trim() ? { documentRef: regDocumentRef.trim() } : {}),
                    })) as UnknownRecord;
                    const data = asRecord(result.data);
                    const used = num(data.usedThisMonth);
                    const cap = num(data.monthlyCap);
                    setRegOk(
                      `Regularization submitted (${str(data.id, "recorded")}). ${
                        used === null
                          ? "Monthly usage not reported."
                          : `${String(used)} used this month${cap === null ? " (no monthly cap configured)" : ` of ${String(cap)} allowed`}.`
                      }`,
                    );
                    setNotice({ text: "Regularization submitted for review.", tone: "success" });
                    setRegReason("");
                    setRegDocumentRef("");
                    setNonce((n) => n + 1);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Could not submit regularization.";
                    setRegError(message);
                    setNotice({ text: message, tone: "error" });
                  } finally {
                    setRegBusy(false);
                  }
                })();
              }}
            >
              {regBusy ? "Submitting…" : "Submit regularization"}
            </Button>
            <FormError message={regError} />
            <FormOk message={regOk} />
          </Surface>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [activeEmployeeId ? "Days" : "People", peopleLoading || loading ? "Loading…" : String(activeEmployeeId ? breakdown.total : teamSummary.visibleEmployees ?? 0)],
            ["Present", peopleLoading || loading ? "Loading…" : String(activeEmployeeId ? breakdown.present : teamSummary.present ?? 0)],
            ["Half day", peopleLoading || loading ? "Loading…" : String(activeEmployeeId ? breakdown.halfDay : teamSummary.halfDay ?? 0)],
            ["Absent", peopleLoading || loading ? "Loading…" : String(activeEmployeeId ? breakdown.absent : teamSummary.absent ?? 0)],
            [
              "Productive",
              peopleLoading || loading ? "Loading…" : formatMinutes(activeEmployeeId ? breakdown.productiveTotal : num(teamSummary.productiveMinutes) ?? 0),
            ],
          ].map(([label, value]) => (
            <Surface key={label} className="p-5">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground">{value}</p>
            </Surface>
          ))}
        </div>

        <Surface className="mt-6">
          <SectionHeading
            title={employeeName ? `Day Rows · ${employeeName}` : "Team attendance"}
            description={employeeName ? `${from} → ${to} · statuses as recorded by the time office` : `${from} → ${to} · ${String(teamSummary.recordedDays ?? 0)} recorded attendance day(s) across your visible scope`}
            action={
              days.some((day) => day.locked) ? (
                <StatusPill tone="info">Locked rows included</StatusPill>
              ) : undefined
            }
          />
          {peopleLoading || loading ? (
            <LoadingLine />
          ) : peopleError || error ? (
            <ErrorBlock message={peopleError || error} onRetry={() => setNonce((n) => n + 1)} />
          ) : !rangeValid ? (
            <EmptyLine>The start date is after the end date. Adjust the range to load day rows.</EmptyLine>
          ) : !activeEmployeeId && people.length === 0 ? (
            <EmptyLine>No employees are visible in your attendance scope.</EmptyLine>
          ) : !activeEmployeeId ? (
            <div className="space-y-3">
              {people.map((person) => (
                <button
                  type="button"
                  key={person.id}
                  className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5 text-left transition-colors hover:border-primary/40"
                  onClick={() => { setEmployeeId(person.id); setDays([]); }}
                >
                  <AvatarMark initials={initialsFor(personLabel(person))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{personLabel(person)} · {person.employeeCode}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {str(person.department, "Unassigned")} · {person.recordedDays} day(s) · {formatMinutes(person.productiveMinutes)} productive · {formatMinutes(person.payableOtMinutes)} OT
                    </p>
                  </div>
                  <StatusPill tone="success">{person.present} present</StatusPill>
                  {person.halfDay > 0 ? <StatusPill tone="warning">{person.halfDay} half day</StatusPill> : null}
                  {person.absent > 0 ? <StatusPill tone="danger">{person.absent} absent</StatusPill> : null}
                </button>
              ))}
            </div>
          ) : days.length === 0 ? (
            <EmptyLine>
              No attendance rows for this employee in the selected range. Days appear here once the
              time office records them.
            </EmptyLine>
          ) : (
            <div className="space-y-3">
              {days.map((day) => (
                <div
                  key={day.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5"
                >
                  <AvatarMark initials={initialsFor(employeeName)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-foreground">{day.date}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      Shift {day.shift} · Productive {formatMinutes(day.productive)} · Gross{" "}
                      {formatMinutes(day.gross)}
                    </p>
                  </div>
                  <StatusPill tone={attendanceTone(day.status)} dot>
                    {day.status}
                  </StatusPill>
                  {day.locked ? <StatusPill tone="info">Locked</StatusPill> : null}
                </div>
              ))}
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="categories" active={tab}>
        <RegisterStates
          loading={engineState.loading}
          error={engineState.error}
          empty={!engineState.loading && !engineState.error && workerCategories.length === 0 && plantCalendars.length === 0}
          onRetry={engineState.refresh}
          loadingLabel="Loading worker categories and plant calendars…"
          errorTitle="Engine configuration unavailable"
          emptyTitle="No worker categories or plant calendars configured"
          emptyHint="Category rules and holiday calendars appear here once the engine has them recorded."
        />
        {!engineState.loading && !engineState.error && (workerCategories.length > 0 || plantCalendars.length > 0) && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.5fr)]">
            <Surface className="overflow-hidden p-0">
              <div className="border-b border-border p-4">
                <p className="text-sm font-semibold text-foreground">Worker categories</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {workerCategories.length} category rule(s) evaluated by the engine.
                </p>
              </div>
              {workerCategories.length === 0 ? (
                <EmptyLine>No worker categories are configured for this tenant.</EmptyLine>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[860px] text-left">
                    <thead>
                      <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-3 py-3">Name</th>
                        <th className="px-3 py-3">Wage type</th>
                        <th className="px-3 py-3">Rest day pattern</th>
                        <th className="px-3 py-3">OT eligibility</th>
                        <th className="px-3 py-3">Leave eligible</th>
                        <th className="px-4 py-3">Statutory set</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {workerCategories.map((row, index) => (
                        <tr key={str(row.code, String(index))} className="text-xs">
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">{str(row.code, "—")}</td>
                          <td className="px-3 py-3 text-foreground">{str(row.name, "—")}</td>
                          <td className="px-3 py-3 text-muted-foreground">{str(row.wageType, "—")}</td>
                          <td className="px-3 py-3 text-muted-foreground">{str(row.restDayPattern, "—")}</td>
                          <td className="px-3 py-3 text-muted-foreground">{str(row.otEligibility, "—")}</td>
                          <td className="px-3 py-3 text-muted-foreground">{str(row.leaveEligible, "—")}</td>
                          <td className="px-4 py-3 text-muted-foreground">{str(row.statutorySet, "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="Plant calendars"
                description={`Holiday calendars for ${period.slice(0, 4)}.`}
              />
              {plantCalendars.length === 0 ? (
                <EmptyLine>No plant calendar is published for this year.</EmptyLine>
              ) : (
                <div className="space-y-3">
                  {plantCalendars.map((plant, index) => {
                    const holidays = listOf(plant.holidays);
                    return (
                      <div
                        key={str(plant.locationCode, String(index))}
                        className="rounded-2xl border border-border/80 bg-card p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">
                            {str(plant.locationName, str(plant.locationCode, "Unnamed location"))}
                          </p>
                          <StatusPill tone="info">{String(num(plant.holidayCount) ?? holidays.length)} holidays</StatusPill>
                        </div>
                        {holidays.length === 0 ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            No holidays are published for this location yet.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {holidays.map((holiday, holidayIndex) => (
                              <li
                                key={`${str(holiday.date)}-${String(holidayIndex)}`}
                                className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted-foreground"
                              >
                                <span className="shrink-0">{str(holiday.date, "—")}</span>
                                <span className="truncate text-right text-foreground">{str(holiday.name, "—")}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Surface>
          </div>
        )}
      </TabPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leave — Leave & Accrual Engine console                              */
/* GET /api/v1/leave/engine · /comp-off-clock · /early-returns         */
/* GET /api/v1/leave/balance-cards · GET /api/v1/leave-requests        */
/* POST /api/v1/leave-requests · POST /api/v1/leave-requests/:id/decide*/
/* ------------------------------------------------------------------ */

type LeaveRequest = {
  id: string;
  /** The envelope's version, carried so a withdrawal can send an If-Match precondition. */
  version: number | null;
  employeeId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number | null;
  status: string;
  reason: string;
};

function leaveTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const key = status.trim().toLowerCase();
  if (key === "approved") return "success";
  if (key === "rejected") return "danger";
  if (key === "cancelled") return "neutral";
  if (key.startsWith("pending")) return "warning";
  return "info";
}

function compOffTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "open") return "success";
  if (status === "consumed") return "neutral";
  if (status === "lapsed") return "danger";
  return "warning";
}

/** Days-to-expiry read honestly in both directions: a past date has already lapsed. */
function expiryLabel(daysToExpiry: number | null): string {
  if (daysToExpiry === null) return "No expiry recorded";
  if (daysToExpiry < 0) return `Expired ${String(Math.abs(daysToExpiry))} days ago`;
  if (daysToExpiry === 0) return "Expires today";
  return `${String(daysToExpiry)} day(s) to expiry`;
}

/** PL_HALF_DAY_SESSION, read from the registry so the vocabulary is never retyped. */
const HALF_DAY_SESSIONS = picklists.PL_HALF_DAY_SESSION.values;

const LEAVE_TABS = [
  { id: "balances", label: "Balances & Apply Leave" },
  { id: "pipeline", label: "3-Level Approval Pipeline" },
  { id: "comp-off", label: "Comp-Off 60-Day Expiry Clock" },
  { id: "early-returns", label: "Early Return Re-Credit" },
  { id: "band-rules", label: "Band Rules & Sandwich Matrix" },
] as const;

export function LeavePage() {
  const { people, loading: peopleLoading, error: peopleError, reload: reloadPeople } = usePeople();
  const nameMap = usePeopleNameMap(people);
  const [tab, setTab] = useState<string>("balances");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [requestsNonce, setRequestsNonce] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [balanceEmployeeId, setBalanceEmployeeId] = useState("");
  // POST /api/v1/leave-requests (requestLeaveSchema: employeeId, leaveType, startsOn, endsOn, days, reason?) — Idempotency-Key REQUIRED
  const [showLeaveForm, setShowLeaveForm] = useState(true);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("CL");
  const [leaveFrom, setLeaveFrom] = useState(() => dayKey(0));
  const [leaveTo, setLeaveTo] = useState(() => dayKey(0));
  const [leaveDays, setLeaveDays] = useState("1");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveHalfStart, setLeaveHalfStart] = useState(false);
  const [leaveHalfEnd, setLeaveHalfEnd] = useState(false);
  const [leaveHalfSession, setLeaveHalfSession] = useState<string>(HALF_DAY_SESSIONS[0].value);
  const [leaveDocumentRef, setLeaveDocumentRef] = useState("");
  const [leaveContact, setLeaveContact] = useState("");
  const [leaveAddress, setLeaveAddress] = useState("");
  const [leaveHandoverId, setLeaveHandoverId] = useState("");
  // POST /api/v1/coff-grants/claims (claimCoffSchema: employeeId, earnedOn, reason) — credit is derived server-side
  const [coffEmployeeId, setCoffEmployeeId] = useState("");
  const [coffWorkedDate, setCoffWorkedDate] = useState(() => dayKey(0));
  const [coffReason, setCoffReason] = useState("");
  const [coffBusy, setCoffBusy] = useState(false);
  const [coffError, setCoffError] = useState("");
  const [coffOk, setCoffOk] = useState("");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveOk, setLeaveOk] = useState("");
  // POST /api/v1/leave-requests/:id/decide {approve, comment?}
  const [decideBusyId, setDecideBusyId] = useState("");
  const [decideError, setDecideError] = useState("");
  // POST /api/v1/leave-requests/:id/cancel {reason} — the applicant withdrawing their own.
  const { workspace } = useWorkspace();
  const viewerEmployeeId = workspace?.context?.employeeId ?? null;
  const today = useMemo(() => dayKey(0), []);
  const [cancelTargetId, setCancelTargetId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusyId, setCancelBusyId] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelOk, setCancelOk] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRequestsLoading(true);
      setRequestsError("");
      try {
        const raw = await getJson("/api/v1/leave-requests?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          version: num(item.version),
          employeeId: str(item.employee_id),
          leaveType: str(item.leave_type, "—"),
          startsOn: str(item.starts_on, "—"),
          endsOn: str(item.ends_on, "—"),
          days: num(item.requested_days),
          status: str(item.status, "—"),
          reason: str(item.reason),
        }));
        if (!cancelled) setRequests(rows);
      } catch (err) {
        if (!cancelled)
          setRequestsError(err instanceof Error ? err.message : "Could not load leave requests.");
      } finally {
        if (!cancelled) setRequestsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestsNonce]);

  const firstPersonId = people.length > 0 ? str(people[0]?.id) : "";
  const activeBalanceId = balanceEmployeeId || firstPersonId;

  const engineState = useRegisterResource("/api/v1/leave/engine");
  const compOffState = useRegisterResource("/api/v1/leave/comp-off-clock");
  const earlyReturnState = useRegisterResource("/api/v1/leave/early-returns");
  const balanceState = useRegisterResource(
    activeBalanceId ? `/api/v1/leave/balance-cards?employeeId=${encodeURIComponent(activeBalanceId)}` : "",
  );

  const engineData = useMemo(() => recordFromEnvelope(engineState.data), [engineState.data]);
  const engine = useMemo(() => asRecord(engineData.engine), [engineData]);
  const pipeline = useMemo(() => asRecord(engineData.pipeline), [engineData]);
  const pipelineStages = useMemo(() => listOf(pipeline.stages), [pipeline]);
  const totalPending = num(pipeline.totalPending);
  const bandRules = useMemo(() => listOf(engineData.bandRules), [engineData]);
  const leaveTypeRules = useMemo(() => listOf(engineData.leaveTypeRules), [engineData]);
  const compOffGrants = useMemo(() => listFromEnvelope(compOffState.data), [compOffState.data]);
  const earlyReturns = useMemo(() => listFromEnvelope(earlyReturnState.data), [earlyReturnState.data]);
  const balanceCards = useMemo(() => listFromEnvelope(balanceState.data), [balanceState.data]);
  const openGrants = useMemo(
    () => compOffGrants.filter((grant) => str(grant.status) === "open").length,
    [compOffGrants],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    if (statusFilter === "pending")
      return requests.filter((request) => request.status.toLowerCase().startsWith("pending"));
    return requests.filter((request) => request.status.toLowerCase() === statusFilter);
  }, [requests, statusFilter]);

  function decide(request: LeaveRequest, approve: boolean) {
    void (async () => {
      setDecideError("");
      setDecideBusyId(request.id);
      try {
        await postJson(`/api/v1/leave-requests/${encodeURIComponent(request.id)}/decide`, { approve });
        setNotice({ text: `Request ${approve ? "approved" : "rejected"}.`, tone: "success" });
        setRequestsNonce((n) => n + 1);
        engineState.refresh();
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : approve ? "Could not approve leave." : "Could not reject leave.";
        setDecideError(message);
        setNotice({ text: message, tone: "error" });
      } finally {
        setDecideBusyId("");
      }
    })();
  }

  /**
   * Withdraw the viewer's own request. `cancelLeave` reverses whichever ledger entry the
   * request is holding — the approval debit if it was approved, the submit reservation
   * otherwise — so an approved request is withdrawn here too, not just a pending one.
   */
  function cancel(request: LeaveRequest) {
    void (async () => {
      setCancelError("");
      setCancelOk("");
      const reason = cancelReason.trim();
      if (reason.length < LEAVE_CANCEL_REASON_MIN) {
        setCancelError(
          `BAD_REQUEST: A cancellation reason of at least ${String(LEAVE_CANCEL_REASON_MIN)} characters is required.`,
        );
        return;
      }
      setCancelBusyId(request.id);
      try {
        await postJson(
          `/api/v1/leave-requests/${encodeURIComponent(request.id)}/cancel`,
          { reason },
          // Idempotency-Key always; If-Match only where the record actually carries a version.
          request.version === null ? undefined : { version: request.version },
        );
        setCancelOk("Request withdrawn. The days it was holding have been given back to your balance.");
        setNotice({ text: "Leave request withdrawn.", tone: "success" });
        setCancelTargetId("");
        setCancelReason("");
        setRequestsNonce((n) => n + 1);
        engineState.refresh();
        balanceState.refresh();
      } catch (err) {
        // The server's refusal — its own wording — is what the applicant reads.
        const message = err instanceof Error ? err.message : "Could not withdraw the leave request.";
        setCancelError(message);
        setNotice({ text: message, tone: "error" });
      } finally {
        setCancelBusyId("");
      }
    })();
  }

  /** Offered only where `cancelLeave` would actually act: see ./leave-cancellation. */
  function cancelControls(request: LeaveRequest): ReactNode {
    const availability = cancelAvailability({
      status: request.status,
      startsOn: request.startsOn,
      employeeId: request.employeeId,
      viewerEmployeeId,
      today,
    });
    if (!availability.offer) return null;
    const open = cancelTargetId === request.id;
    const busy = cancelBusyId === request.id;
    if (!open) {
      return (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg text-xs"
            onClick={() => {
              setCancelTargetId(request.id);
              setCancelReason("");
              setCancelError("");
              setCancelOk("");
            }}
          >
            Withdraw request
          </Button>
        </div>
      );
    }
    return (
      <div className="mt-3 rounded-xl border border-border/60 bg-secondary/20 p-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Why are you withdrawing it? (at least {LEAVE_CANCEL_REASON_MIN} characters)
          </span>
          <textarea
            aria-label="Leave withdrawal reason"
            className="min-h-[72px] w-full min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground"
            maxLength={300}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="h-10 rounded-lg text-xs" disabled={busy} onClick={() => cancel(request)}>
            {busy ? "Withdrawing…" : "Confirm withdrawal"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg text-xs"
            disabled={busy}
            onClick={() => {
              setCancelTargetId("");
              setCancelReason("");
              setCancelError("");
            }}
          >
            Keep the request
          </Button>
        </div>
        <p role="alert" className="mt-2 font-mono text-[11px] leading-relaxed text-destructive empty:mt-0">
          {cancelError}
        </p>
      </div>
    );
  }

  function decisionButtons(request: LeaveRequest): ReactNode {
    if (!request.status.trim().toLowerCase().startsWith("pending")) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-8 rounded-lg text-xs"
          disabled={decideBusyId === request.id}
          onClick={() => decide(request, true)}
        >
          {decideBusyId === request.id ? "Working…" : "Approve"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          disabled={decideBusyId === request.id}
          onClick={() => decide(request, false)}
        >
          {decideBusyId === request.id ? "Working…" : "Reject"}
        </Button>
      </div>
    );
  }

  function requestCard(request: LeaveRequest): ReactNode {
    const name = request.employeeId
      ? (nameMap.get(request.employeeId) ?? shortId(request.employeeId))
      : "Unknown employee";
    return (
      <div
        key={request.id}
        className="rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/30"
      >
        <div className="flex flex-wrap items-center gap-3">
          <AvatarMark initials={initialsFor(name)} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">{name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {request.leaveType} · {request.startsOn} → {request.endsOn}
              {request.days !== null
                ? ` · ${String(request.days)} day${request.days === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <StatusPill tone={leaveTone(request.status)}>{stateLabel(request.status)}</StatusPill>
        </div>
        {request.reason ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground">
            {request.reason}
          </p>
        ) : null}
        {decisionButtons(request)}
        {cancelControls(request)}
      </div>
    );
  }

  const tabs = LEAVE_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "pipeline" ? totalPending
      : entry.id === "comp-off" ? openGrants
      : entry.id === "early-returns" ? earlyReturns.length
      : entry.id === "band-rules" ? bandRules.length
      : entry.id === "balances" ? balanceCards.length
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Leave Intelligence · Accrual Engine"
        title="Leave & Accrual Engine"
        description="3 level approval workflows, comp off 60-day auto-lapse clocks, sandwich rule logic, and early return re-credit ledger."
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href="/leave-requests"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Leave request register
            </Link>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => { setShowLeaveForm((visible) => !visible); setTab("balances"); }}
            >
              <CalendarCheck2 className="mr-1.5 size-4" /> Request Leave
            </Button>
          </span>
        }
      />
      <RegisterNotice notice={notice} />

      <EngineBanner
        title="Leave rule pack"
        engine={engine}
        loading={engineState.loading}
        error={engineState.error}
        onRetry={engineState.refresh}
        missingText="No leave rule pack is configured, so no engine rules can be shown."
      />

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Leave engine sections" />

      <TabPanel id="balances" active={tab}>
        {showLeaveForm ? (
          <Surface className="mb-6">
            <SectionHeading
              title="Request Leave"
              description="Submit a governed leave request for approval."
            />
            {peopleLoading ? (
              <LoadingLine />
            ) : peopleError ? (
              <ErrorBlock message={peopleError} onRetry={reloadPeople} />
            ) : people.length === 0 ? (
              <EmptyLine>No employees found, so no leave can be requested.</EmptyLine>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Employee
                    </span>
                    <select
                      aria-label="Leave employee"
                      className={`${selectClass} w-full`}
                      value={leaveEmployeeId || firstPersonId}
                      onChange={(event) => setLeaveEmployeeId(event.target.value)}
                    >
                      {people.map((person) => (
                        <option key={str(person.id)} value={str(person.id)}>
                          {personLabel(person)} · {str(person.employeeCode, "—")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Leave type
                    </span>
                    <select
                      aria-label="Leave type"
                      className={`${selectClass} w-full`}
                      value={leaveType}
                      onChange={(event) => setLeaveType(event.target.value)}
                    >
                      {leaveTypeRules.length === 0 ? (
                        <option value={leaveType}>{leaveType}</option>
                      ) : (
                        leaveTypeRules.map((rule, index) => (
                          <option key={str(rule.code, String(index))} value={str(rule.code)}>
                            {str(rule.code, "—")} · {str(rule.name, "—")}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Days
                    </span>
                    <input
                      aria-label="Leave days"
                      type="number"
                      min="0.5"
                      max="60"
                      step="0.5"
                      className={`${inputClass} w-full`}
                      value={leaveDays}
                      onChange={(event) => setLeaveDays(event.target.value)}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Starts on
                    </span>
                    <input
                      aria-label="Leave starts on"
                      type="date"
                      className={`${inputClass} w-full`}
                      value={leaveFrom}
                      onChange={(event) => setLeaveFrom(event.target.value)}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Ends on
                    </span>
                    <input
                      aria-label="Leave ends on"
                      type="date"
                      className={`${inputClass} w-full`}
                      value={leaveTo}
                      onChange={(event) => setLeaveTo(event.target.value)}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Reason (optional)
                    </span>
                    <input
                      aria-label="Leave reason"
                      type="text"
                      placeholder="Family function"
                      className={`${inputClass} w-full`}
                      value={leaveReason}
                      onChange={(event) => setLeaveReason(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Half day session
                    </span>
                    <select
                      aria-label="Half day session"
                      className={selectClass}
                      value={leaveHalfSession}
                      disabled={!leaveHalfStart && !leaveHalfEnd}
                      onChange={(event) => setLeaveHalfSession(event.target.value)}
                    >
                      {HALF_DAY_SESSIONS.map((session) => (
                        <option key={session.value} value={session.value}>
                          {session.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2.5">
                    <input
                      aria-label="Half day at start"
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={leaveHalfStart}
                      onChange={(event) => setLeaveHalfStart(event.target.checked)}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Half day at start
                    </span>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2.5">
                    <input
                      aria-label="Half day at end"
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={leaveHalfEnd}
                      onChange={(event) => setLeaveHalfEnd(event.target.checked)}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Half day at end
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Contact during leave (optional)
                    </span>
                    <input
                      aria-label="Contact during leave"
                      type="tel"
                      placeholder="+919876543210"
                      className={inputClass}
                      value={leaveContact}
                      onChange={(event) => setLeaveContact(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Address during leave (optional)
                    </span>
                    <input
                      aria-label="Address during leave"
                      type="text"
                      className={inputClass}
                      value={leaveAddress}
                      onChange={(event) => setLeaveAddress(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Handover to (optional)
                    </span>
                    <select
                      aria-label="Handover to"
                      className={selectClass}
                      value={leaveHandoverId}
                      onChange={(event) => setLeaveHandoverId(event.target.value)}
                    >
                      <option value="">No handover recorded</option>
                      {people
                        .filter((person) => str(person.id) !== (leaveEmployeeId || firstPersonId))
                        .map((person) => (
                          <option key={str(person.id)} value={str(person.id)}>
                            {personLabel(person)} · {str(person.employeeCode, "—")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Supporting document (optional)
                    </span>
                    <input
                      aria-label="Supporting document reference"
                      type="text"
                      placeholder="Document reference"
                      className={inputClass}
                      value={leaveDocumentRef}
                      onChange={(event) => setLeaveDocumentRef(event.target.value)}
                    />
                  </label>
                </div>
                <Button
                  className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  disabled={leaveBusy}
                  onClick={() => {
                    void (async () => {
                      setLeaveError("");
                      setLeaveOk("");
                      const days = Number(leaveDays);
                      if (!leaveEmployeeId && !firstPersonId) {
                        setLeaveError("BAD_REQUEST: Select an employee.");
                        return;
                      }
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(leaveTo)) {
                        setLeaveError("BAD_REQUEST: Start and end dates (YYYY-MM-DD) are required.");
                        return;
                      }
                      if (!Number.isFinite(days) || days <= 0 || days > 60) {
                        setLeaveError("BAD_REQUEST: Days must be between 0.5 and 60.");
                        return;
                      }
                      if (leaveContact.trim() !== "" && !/^\+[1-9]\d{7,14}$/.test(leaveContact.trim())) {
                        setLeaveError("BAD_REQUEST: The contact number must be in E.164 form, e.g. +919876543210.");
                        return;
                      }
                      setLeaveBusy(true);
                      try {
                        const result = (await postJson("/api/v1/leave-requests", {
                          employeeId: leaveEmployeeId || firstPersonId,
                          leaveType,
                          startsOn: leaveFrom,
                          endsOn: leaveTo,
                          days,
                          ...(leaveReason.trim() ? { reason: leaveReason.trim() } : {}),
                          isHalfDayStart: leaveHalfStart,
                          isHalfDayEnd: leaveHalfEnd,
                          // The session only means something when one of the ends is a half day.
                          ...(leaveHalfStart || leaveHalfEnd ? { halfDaySession: leaveHalfSession } : {}),
                          ...(leaveDocumentRef.trim() ? { documentRef: leaveDocumentRef.trim() } : {}),
                          ...(leaveContact.trim() ? { contact: leaveContact.trim() } : {}),
                          ...(leaveAddress.trim() ? { leaveAddress: leaveAddress.trim() } : {}),
                          ...(leaveHandoverId ? { handoverPersonId: leaveHandoverId } : {}),
                        })) as UnknownRecord;
                        const data = asRecord(result.data);
                        setLeaveOk(`Leave submitted (${str(data.id, "recorded")}, ${str(data.status, "pending")}). List refreshed below.`);
                        setNotice({ text: "Leave request submitted into the approval chain.", tone: "success" });
                        setLeaveReason("");
                        setLeaveDocumentRef("");
                        setLeaveAddress("");
                        setRequestsNonce((n) => n + 1);
                        engineState.refresh();
                        balanceState.refresh();
                      } catch (err) {
                        const message = err instanceof Error ? err.message : "Could not submit leave.";
                        setLeaveError(message);
                        setNotice({ text: message, tone: "error" });
                      } finally {
                        setLeaveBusy(false);
                      }
                    })();
                  }}
                >
                  {leaveBusy ? "Submitting…" : "Submit request"}
                </Button>
                <FormError message={leaveError} />
                <FormOk message={leaveOk} />
              </>
            )}
          </Surface>
        ) : null}

        <Surface>
          <SectionHeading
            title="Balances"
            description="Every leave type the accrual engine holds for the selected employee."
            action={<AiLabel>Live balances</AiLabel>}
          />
          {peopleLoading ? (
            <LoadingLine />
          ) : peopleError ? (
            <ErrorBlock message={peopleError} onRetry={reloadPeople} />
          ) : people.length === 0 ? (
            <EmptyLine>No employees found, so no balances can be shown.</EmptyLine>
          ) : (
            <>
              <label className="flex max-w-sm flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Employee
                </span>
                <select
                  aria-label="Employee for balances"
                  className={`${selectClass} w-full`}
                  value={activeBalanceId}
                  onChange={(event) => setBalanceEmployeeId(event.target.value)}
                >
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)} · {str(person.employeeCode, "—")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4">
                <RegisterStates
                  loading={balanceState.loading}
                  error={balanceState.error}
                  empty={!balanceState.loading && !balanceState.error && balanceCards.length === 0}
                  onRetry={balanceState.refresh}
                  loadingLabel="Loading leave balances…"
                  errorTitle="Leave balances unavailable"
                  emptyTitle="No leave balance is held for this employee"
                  emptyHint="Balances appear once the accrual engine has credited this employee."
                />
              </div>
              {!balanceState.loading && !balanceState.error && balanceCards.length > 0 && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {balanceCards.map((card, index) => {
                    const allocated = num(card.allocated);
                    const available = num(card.available);
                    return (
                      <div
                        key={str(card.leaveType, String(index))}
                        className="rounded-2xl border border-border/80 bg-secondary/30 p-5"
                      >
                        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {str(card.leaveType, "—")}
                          {str(card.leaveTypeName) ? ` · ${str(card.leaveTypeName)}` : ""}
                        </p>
                        <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground">
                          {available === null ? "—" : String(available)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Available {available === null ? "—" : String(available)} of{" "}
                          {allocated === null ? "—" : String(allocated)} allocated
                        </p>
                        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                          {str(card.accrualNote, "No accrual note recorded for this type.")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Surface>

        <Surface className="mt-6">
          <SectionHeading
            title="Approval Desk"
            description="Live requests, newest first. Balances above are evaluated per employee."
            action={
              <select
                aria-label="Status filter"
                className={`${selectClass} w-full`}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            }
          />
          <p role="alert" className="mb-3 font-mono text-[11px] leading-relaxed text-destructive empty:mb-0">
            {decideError}
          </p>
          <p role="status" className="mb-3 font-mono text-[11px] leading-relaxed text-success empty:mb-0">
            {cancelOk}
          </p>
          {requestsLoading ? (
            <LoadingLine />
          ) : requestsError ? (
            <ErrorBlock message={requestsError} onRetry={() => setRequestsNonce((n) => n + 1)} />
          ) : filtered.length === 0 ? (
            <EmptyLine>
              {requests.length === 0
                ? "No leave requests exist yet. Requests appear here once submitted."
                : "No requests match this status filter."}
            </EmptyLine>
          ) : (
            <div className="space-y-3">{filtered.map((request) => requestCard(request))}</div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="pipeline" active={tab}>
        <RegisterStates
          loading={engineState.loading}
          error={engineState.error}
          empty={!engineState.loading && !engineState.error && pipelineStages.length === 0}
          onRetry={engineState.refresh}
          loadingLabel="Loading the approval pipeline…"
          errorTitle="Approval pipeline unavailable"
          emptyTitle="No approval chain is configured"
          emptyHint="The three-level chain appears here once the engine publishes it."
        />
        {!engineState.loading && !engineState.error && pipelineStages.length > 0 && (
          <div className="space-y-6">
            <Surface>
              <SectionHeading
                title="Approval chain"
                description={`${String(totalPending ?? 0)} request(s) waiting across the chain.`}
              />
              <ol className="space-y-2">
                {pipelineStages.map((stage, index) => (
                  <li
                    key={str(stage.stage, String(index))}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3.5 py-3"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary font-mono text-[11px] font-bold text-secondary-foreground">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 text-xs font-semibold text-foreground">
                      {str(stage.label, stateLabel(str(stage.stage)))}
                    </p>
                    <StatusPill tone={num(stage.count) ? "warning" : "neutral"}>
                      {String(num(stage.count) ?? 0)} waiting
                    </StatusPill>
                  </li>
                ))}
              </ol>
            </Surface>

            {pipelineStages.map((stage, index) => {
              const key = str(stage.stage);
              const stageRequests = requests.filter((request) => request.status.trim().toLowerCase() === key);
              return (
                <Surface key={`queue-${key || String(index)}`}>
                  <SectionHeading
                    title={str(stage.label, stateLabel(key))}
                    description="Requests currently resting at this step of the chain."
                  />
                  {requestsLoading ? (
                    <LoadingLine />
                  ) : requestsError ? (
                    <ErrorBlock message={requestsError} onRetry={() => setRequestsNonce((n) => n + 1)} />
                  ) : stageRequests.length === 0 ? (
                    <EmptyLine>Nothing is waiting at this step right now.</EmptyLine>
                  ) : (
                    <div className="space-y-3">{stageRequests.map((request) => requestCard(request))}</div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="comp-off" active={tab}>
        <Surface className="mb-6">
          <SectionHeading
            title="Claim compensatory off"
            description="Claim a credit for a rest day or holiday already worked. The credit and its expiry are derived from that day's attendance, not typed in, and nothing reaches your balance until an approver decides the claim. Claiming on somebody else's behalf needs the attendance permission."
          />
          {peopleLoading ? (
            <LoadingLine />
          ) : peopleError ? (
            <ErrorBlock message={peopleError} onRetry={reloadPeople} />
          ) : people.length === 0 ? (
            <EmptyLine>No employees found, so no compensatory off can be claimed.</EmptyLine>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Employee</span>
                  <select
                    aria-label="Comp-off employee"
                    className={selectClass}
                    value={coffEmployeeId || firstPersonId}
                    onChange={(event) => setCoffEmployeeId(event.target.value)}
                  >
                    {people.map((person) => (
                      <option key={str(person.id)} value={str(person.id)}>
                        {personLabel(person)} · {str(person.employeeCode, "—")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Worked date</span>
                  <input
                    aria-label="Comp-off worked date"
                    type="date"
                    className={inputClass}
                    value={coffWorkedDate}
                    onChange={(event) => setCoffWorkedDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Reason for working (at least 10 characters)
                  </span>
                  <input
                    aria-label="Comp-off reason"
                    type="text"
                    placeholder="Covered the plant shutdown"
                    className={inputClass}
                    value={coffReason}
                    onChange={(event) => setCoffReason(event.target.value)}
                  />
                </label>
              </div>
              <Button
                className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                disabled={coffBusy}
                onClick={() => {
                  void (async () => {
                    setCoffError("");
                    setCoffOk("");
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(coffWorkedDate)) {
                      setCoffError("BAD_REQUEST: A valid worked date (YYYY-MM-DD) is required.");
                      return;
                    }
                    if (coffReason.trim().length < 10) {
                      setCoffError("BAD_REQUEST: A reason of at least 10 characters is required.");
                      return;
                    }
                    setCoffBusy(true);
                    try {
                      // The claims route (claimCoff), not /api/v1/coff-grants (grantCoff).
                      // The grant route enforces `attendance.write`, which is an approver
                      // permission, so this control 403'd for the very people it is for.
                      // claimCoff needs only `leave.read` to claim your own day, and asks
                      // for `attendance.write` only when claiming on somebody else's behalf.
                      const result = (await postJson("/api/v1/coff-grants/claims", {
                        employeeId: coffEmployeeId || firstPersonId,
                        earnedOn: coffWorkedDate,
                        reason: coffReason.trim(),
                      })) as UnknownRecord;
                      const data = asRecord(result.data);
                      setCoffOk(
                        `Comp-off claimed: ${String(num(data.days) ?? "—")} day(s) for ${String(num(data.hoursWorked) ?? "—")} hour(s) worked, expiring ${str(data.expiresOn, "—")}. It is awaiting a decision and nothing is credited until it is approved.`,
                      );
                      setNotice({ text: "Comp-off claim raised. Nothing is credited until an approver decides it.", tone: "success" });
                      setCoffReason("");
                      compOffState.refresh();
                      balanceState.refresh();
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Could not claim compensatory off.";
                      setCoffError(message);
                      setNotice({ text: message, tone: "error" });
                    } finally {
                      setCoffBusy(false);
                    }
                  })();
                }}
              >
                {coffBusy ? "Claiming…" : "Claim comp-off"}
              </Button>
              <FormError message={coffError} />
              <FormOk message={coffOk} />
            </>
          )}
        </Surface>
        <RegisterStates
          loading={compOffState.loading}
          error={compOffState.error}
          empty={!compOffState.loading && !compOffState.error && compOffGrants.length === 0}
          onRetry={compOffState.refresh}
          loadingLabel="Loading the comp-off expiry clock…"
          errorTitle="Comp-off clock unavailable"
          emptyTitle="No comp-off grants on record"
          emptyHint="Grants appear here once compensatory off is credited against worked rest days."
        />
        {!compOffState.loading && !compOffState.error && compOffGrants.length > 0 && (
          <Surface className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <p className="text-sm font-semibold text-foreground">Comp-off 60-day expiry clock</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {compOffGrants.length} grant(s) · {openGrants} still open.
              </p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Credit id</th>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Earned on</th>
                    <th className="px-3 py-3">Expires on</th>
                    <th className="px-3 py-3">Days remaining</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3">Days to expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {compOffGrants.map((grant, index) => {
                    const status = str(grant.status, "open");
                    const remaining = num(grant.daysRemaining);
                    return (
                      <tr key={str(grant.id, `${str(grant.creditId)}-${String(index)}`)} className="text-xs">
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {str(grant.creditId) ? shortId(str(grant.creditId)) : "—"}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {str(grant.employeeName, "Unnamed employee")}
                          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                            {str(grant.employeeCode, "—")}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(grant.earnedOn, "—")}</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(grant.expiresOn, "—")}</td>
                        <td className="px-3 py-3 font-mono text-foreground">
                          {remaining === null ? "—" : String(remaining)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={compOffTone(status)} dot>{stateLabel(status)}</StatusPill>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{expiryLabel(num(grant.daysToExpiry))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="early-returns" active={tab}>
        <RegisterStates
          loading={earlyReturnState.loading}
          error={earlyReturnState.error}
          empty={!earlyReturnState.loading && !earlyReturnState.error && earlyReturns.length === 0}
          onRetry={earlyReturnState.refresh}
          loadingLabel="Loading early return re-credits…"
          errorTitle="Early return ledger unavailable"
          emptyTitle="No early return has been recorded yet"
          emptyHint="When an employee comes back before their approved end date, the unused days are re-credited here."
        />
        {!earlyReturnState.loading && !earlyReturnState.error && earlyReturns.length > 0 && (
          <Surface className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <p className="text-sm font-semibold text-foreground">Early return re-credit ledger</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {earlyReturns.length} re-credit(s) booked against closed requests.
              </p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-3 py-3">Leave type</th>
                    <th className="px-3 py-3">Starts on</th>
                    <th className="px-3 py-3">Ends on</th>
                    <th className="px-3 py-3">Requested days</th>
                    <th className="px-3 py-3">Actual return</th>
                    <th className="px-4 py-3">Re-credited days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {earlyReturns.map((row, index) => {
                    const recredited = num(row.recreditedDays);
                    return (
                      <tr key={str(row.id, String(index))} className="text-xs">
                        <td className="px-4 py-3 text-foreground">
                          {str(row.employeeName, "Unnamed employee")}
                          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                            {str(row.employeeCode, "—")}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(row.leaveType, "—")}</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(row.startsOn, "—")}</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(row.endsOn, "—")}</td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">
                          {num(row.requestedDays) === null ? "—" : String(num(row.requestedDays))}
                        </td>
                        <td className="px-3 py-3 font-mono text-muted-foreground">{str(row.actualReturnDate, "—")}</td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {recredited === null ? "Not re-credited" : String(recredited)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="band-rules" active={tab}>
        <RegisterStates
          loading={engineState.loading}
          error={engineState.error}
          empty={!engineState.loading && !engineState.error && bandRules.length === 0 && leaveTypeRules.length === 0}
          onRetry={engineState.refresh}
          loadingLabel="Loading band rules and the combination matrix…"
          errorTitle="Leave rule configuration unavailable"
          emptyTitle="No band or leave-type rules configured"
          emptyHint="Entitlement bands and the combination matrix appear here once the policy pack is published."
        />
        {!engineState.loading && !engineState.error && (bandRules.length > 0 || leaveTypeRules.length > 0) && (
          <div className="space-y-6">
            <Surface className="overflow-hidden p-0">
              <div className="border-b border-border p-4">
                <p className="text-sm font-semibold text-foreground">Entitlement band rules</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {bandRules.length} band rule(s) published by the policy pack.
                </p>
              </div>
              {bandRules.length === 0 ? (
                <EmptyLine>No entitlement band rules are published.</EmptyLine>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead>
                      <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Policy</th>
                        <th className="px-3 py-3">Band</th>
                        <th className="px-3 py-3">Leave type</th>
                        <th className="px-3 py-3">Annual days</th>
                        <th className="px-3 py-3">Frequency</th>
                        <th className="px-4 py-3">Credit date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {bandRules.map((rule, index) => (
                        <tr key={`${str(rule.policyCode)}-${str(rule.leaveType)}-${String(index)}`} className="text-xs">
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">{str(rule.policyCode, "—")}</td>
                          <td className="px-3 py-3 text-muted-foreground">{str(rule.leaveBand, "All bands")}</td>
                          <td className="px-3 py-3 font-mono text-muted-foreground">{str(rule.leaveType, "—")}</td>
                          <td className="px-3 py-3 font-mono text-foreground">
                            {num(rule.annualDays) === null ? "—" : String(num(rule.annualDays))}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{str(rule.accrualFrequency, "—")}</td>
                          <td className="px-4 py-3 text-muted-foreground">{str(rule.creditDate, "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>

            <Surface className="overflow-hidden p-0">
              <div className="border-b border-border p-4">
                <p className="text-sm font-semibold text-foreground">Sandwich & combination matrix</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Carry-forward, expiry and the leave types each type may not be combined with.
                </p>
              </div>
              {leaveTypeRules.length === 0 ? (
                <EmptyLine>No leave-type rules are published, so no combination matrix can be drawn.</EmptyLine>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[960px] text-left">
                    <thead>
                      <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-3 py-3">Name</th>
                        <th className="px-3 py-3">Carry forward</th>
                        <th className="px-3 py-3">Expiry rule</th>
                        <th className="px-3 py-3">Year-end action</th>
                        <th className="px-3 py-3">Max per month</th>
                        <th className="px-4 py-3">Cannot combine with</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {leaveTypeRules.map((rule, index) => {
                        const blocked = stringList(rule.cannotCombineWith);
                        return (
                          <tr key={str(rule.code, String(index))} className="text-xs align-top">
                            <td className="px-4 py-3 font-mono font-semibold text-foreground">{str(rule.code, "—")}</td>
                            <td className="px-3 py-3 text-foreground">{str(rule.name, "—")}</td>
                            <td className="px-3 py-3 text-muted-foreground">{str(rule.carryForward, "—")}</td>
                            <td className="px-3 py-3 text-muted-foreground">{str(rule.expiryRule, "—")}</td>
                            <td className="px-3 py-3 text-muted-foreground">{str(rule.yearEndAction, "—")}</td>
                            <td className="px-3 py-3 font-mono text-muted-foreground">
                              {num(rule.maxPerMonth) === null ? "—" : String(num(rule.maxPerMonth))}
                            </td>
                            <td className="px-4 py-3">
                              {blocked.length === 0 ? (
                                <span className="text-muted-foreground">No combination restriction</span>
                              ) : (
                                <span className="flex flex-wrap gap-1.5">
                                  {blocked.map((code) => (
                                    <span
                                      key={code}
                                      className="rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                                    >
                                      {code}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>
          </div>
        )}
      </TabPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payroll — live runs + anomalies for the selected run                */
/* GET /api/v1/payroll-runs · GET /api/v1/payroll-anomalies?runId=…    */
/* ------------------------------------------------------------------ */

type PayrollRun = {
  id: string;
  period: string;
  scope: string;
  status: string;
  employeeCount: number | null;
  grossMinor: number | null;
  deductionsMinor: number | null;
  netMinor: number | null;
  currency: string;
};

type PayrollAnomaly = {
  id: string;
  employeeId: string;
  ruleCode: string;
  severity: string;
  status: string;
  resolution: string;
};

function runTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const key = status.trim().toLowerCase();
  if (key === "finalized" || key === "paid" || key === "closed") return "success";
  if (key === "approved") return "info";
  if (key === "calculated") return "warning";
  if (key === "draft") return "neutral";
  return "info";
}

function anomalyTone(severity: string): "success" | "warning" | "danger" | "info" {
  const key = severity.trim().toLowerCase();
  // PL_SEVERITY is critical/warning/info. Findings raised before the switch still carry the
  // old high/medium/low, so both vocabularies map rather than one silently rendering neutral.
  if (key === "critical" || key === "high") return "danger";
  if (key === "warning" || key === "medium") return "warning";
  return "info";
}

const PAYROLL_TABS = [
  { id: "runs", label: "Payroll runs" },
  { id: "gross-to-net", label: "Gross-to-Net & EWA" },
  { id: "off-cycle", label: "Off-cycle runs" },
  { id: "loans", label: "Company loans & guarantor lock" },
  { id: "fnf", label: "Same-day F&F & no-dues" },
  { id: "plant-scope", label: "Plant location scoping" },
] as const;

export function PayrollPage() {
  const { people } = usePeople();
  const nameMap = usePeopleNameMap(people);
  const [tab, setTab] = useState<string>("runs");
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [runsNonce, setRunsNonce] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [anomalies, setAnomalies] = useState<PayrollAnomaly[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [anomaliesError, setAnomaliesError] = useState("");
  const [anomaliesNonce, setAnomaliesNonce] = useState(0);
  // POST /api/v1/payroll-runs (createRunSchema: period YYYY-MM, scope regular|ot) — Idempotency-Key REQUIRED
  const [runPeriod, setRunPeriod] = useState(() => dayKey(0).slice(0, 7));
  const [runScope, setRunScope] = useState("regular");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [runOk, setRunOk] = useState("");
  // Run transitions: calculate (Idempotency-Key REQUIRED) → approve → finalize (irreversible, typed confirm + If-Match)
  const [transitionBusy, setTransitionBusy] = useState("");
  const [transitionError, setTransitionError] = useState("");
  const [transitionOk, setTransitionOk] = useState("");
  const [finalizeArmed, setFinalizeArmed] = useState(false);
  const [finalizeText, setFinalizeText] = useState("");

  async function runTransition(kind: "calculate" | "approve" | "finalize", runId: string): Promise<void> {
    setTransitionError("");
    setTransitionOk("");
    setTransitionBusy(kind);
    try {
      if (kind === "calculate") {
        const result = (await postJson(
          `/api/v1/payroll-runs/${encodeURIComponent(runId)}/calculate`,
          {},
        )) as UnknownRecord;
        const data = asRecord(result.data);
        setTransitionOk(
          `Calculated: ${String(data.calculated ?? "?")} employees, net ${formatMinor(num(data.net), "INR")}.`,
        );
      } else if (kind === "approve") {
        await postJson(`/api/v1/payroll-runs/${encodeURIComponent(runId)}/approve`, {}, { idempotency: false });
        setTransitionOk("Run approved. It can now be finalized.");
      } else {
        await postJson(
          `/api/v1/payroll-runs/${encodeURIComponent(runId)}/finalize`,
          {},
          { idempotency: false, version: 1 },
        );
        setTransitionOk("Run finalized (irreversible). Payslips issued.");
        setFinalizeArmed(false);
        setFinalizeText("");
      }
      setRunsNonce((n) => n + 1);
      setAnomaliesNonce((n) => n + 1);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : `Could not ${kind} the run.`);
    } finally {
      setTransitionBusy("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRunsLoading(true);
      setRunsError("");
      try {
        const raw = await getJson("/api/v1/payroll-runs?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
          status: str(item.status, "—"),
          employeeCount: num(item.employee_count),
          grossMinor: num(item.gross_minor),
          deductionsMinor: num(item.deductions_minor),
          netMinor: num(item.net_minor),
          currency: str(item.currency, "INR"),
        }));
        if (!cancelled) setRuns(rows);
      } catch (err) {
        if (!cancelled)
          setRunsError(err instanceof Error ? err.message : "Could not load payroll runs.");
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runsNonce]);

  const activeRunId = selectedRunId || (runs.length > 0 ? (runs[0]?.id ?? "") : "");

  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    const targetRunId = activeRunId;
    void (async () => {
      setAnomaliesLoading(true);
      setAnomaliesError("");
      try {
        const raw = await getJson(
          `/api/v1/payroll-anomalies?runId=${encodeURIComponent(targetRunId)}`,
        );
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          employeeId: str(item.employee_id),
          ruleCode: str(item.rule_code, "—"),
          severity: str(item.severity, "—"),
          status: str(item.status, "—"),
          resolution: str(item.resolution),
        }));
        if (!cancelled) setAnomalies(rows);
      } catch (err) {
        if (!cancelled) {
          setAnomalies([]);
          setAnomaliesError(err instanceof Error ? err.message : "Could not load anomalies.");
        }
      } finally {
        if (!cancelled) setAnomaliesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRunId, anomaliesNonce]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === activeRunId) ?? null,
    [runs, activeRunId],
  );

  const tabs = PAYROLL_TABS.map((entry) => ({
    ...entry,
    count: entry.id === "runs" ? runs.length : null,
  }));

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Payroll Control · Live Runs"
        title="Audited for precision."
        description="Live payroll runs with status, period, and net pay, plus anomaly rows for the selected run."
        action={<AiLabel>Live payroll</AiLabel>}
      />

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Payroll engine sections" />

      <TabPanel id="runs" active={tab}>
      <Surface className="mb-6">
        <SectionHeading
          title="New Run"
          description="Create a draft payroll run for the selected period."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Period (YYYY-MM)
            </span>
            <input
              aria-label="Run period"
              type="month"
              className={`${inputClass} w-full`}
              value={runPeriod}
              onChange={(event) => setRunPeriod(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Scope
            </span>
            <select
              aria-label="Run scope"
              className={`${selectClass} w-full`}
              value={runScope}
              onChange={(event) => setRunScope(event.target.value)}
            >
              <option value="regular">Regular</option>
              <option value="ot">Overtime</option>
            </select>
          </label>
          <Button
            className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            disabled={runBusy}
            onClick={() => {
              void (async () => {
                setRunError("");
                setRunOk("");
                if (!/^\d{4}-\d{2}$/.test(runPeriod)) {
                  setRunError("BAD_REQUEST: A period (YYYY-MM) is required.");
                  return;
                }
                setRunBusy(true);
                try {
                  const result = (await postJson("/api/v1/payroll-runs", {
                    period: runPeriod,
                    scope: runScope,
                  })) as UnknownRecord;
                  const data = asRecord(result.data);
                  const newId = str(data.id);
                  if (newId) setSelectedRunId(newId);
                  setRunOk(`Run drafted (${runPeriod} · ${runScope}). Status: ${str(data.status, "draft")}.`);
                  setRunsNonce((n) => n + 1);
                } catch (err) {
                  setRunError(err instanceof Error ? err.message : "Could not create the run.");
                } finally {
                  setRunBusy(false);
                }
              })();
            }}
          >
            {runBusy ? "Drafting…" : "Create run"}
          </Button>
        </div>
        <FormError message={runError} />
        <FormOk message={runOk} />
      </Surface>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Net Pay · Selected Run",
            runsLoading ? "Loading…" : selectedRun ? formatMinor(selectedRun.netMinor, selectedRun.currency) : "—",
            selectedRun ? `${selectedRun.period} · ${selectedRun.scope}` : "No run selected",
          ],
          [
            "Gross · Selected Run",
            runsLoading ? "Loading…" : selectedRun ? formatMinor(selectedRun.grossMinor, selectedRun.currency) : "—",
            selectedRun ? `${selectedRun.period} · ${selectedRun.scope}` : "No run selected",
          ],
          [
            "Deductions · Selected Run",
            runsLoading
              ? "Loading…"
              : selectedRun
                ? formatMinor(selectedRun.deductionsMinor, selectedRun.currency)
                : "—",
            selectedRun ? `${selectedRun.period} · ${selectedRun.scope}` : "No run selected",
          ],
          [
            "Open Anomalies",
            anomaliesLoading ? "Loading…" : String(anomalies.filter((a) => a.status === "open").length),
            selectedRun ? `Run ${selectedRun.period}` : "No run selected",
          ],
        ].map(([label, value, note]) => (
          <Surface key={label} className="min-w-0 p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 min-w-0 font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">{value}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{note}</p>
          </Surface>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,.68fr)]">
        <Surface>
          <SectionHeading
            title="Payroll Runs"
            description="Newest first. Select a run to inspect its anomalies."
            action={<Banknote className="size-5 text-primary" />}
          />
          {runsLoading ? (
            <LoadingLine />
          ) : runsError ? (
            <ErrorBlock message={runsError} onRetry={() => setRunsNonce((n) => n + 1)} />
          ) : runs.length === 0 ? (
            <EmptyLine>
              No payroll runs exist yet. Runs appear here once a payroll cycle is drafted.
            </EmptyLine>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(run.id);
                    setAnomalies([]);
                  }}
                  className={`grid w-full gap-2 rounded-2xl border p-4 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                    run.id === selectedRunId
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-foreground">
                        {run.period} · {run.scope}
                      </p>
                      <StatusPill tone={runTone(run.status)}>{run.status}</StatusPill>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      Net {formatMinor(run.netMinor, run.currency)} ·{" "}
                      {run.employeeCount === null ? "—" : String(run.employeeCount)} employees
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-sm font-bold text-foreground sm:text-right">
                    {formatMinor(run.netMinor, run.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selectedRun ? (
            <div className="mt-4 rounded-2xl border border-border/80 bg-secondary/30 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Selected run · {selectedRun.period} · {selectedRun.scope} · {selectedRun.status}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs"
                  disabled={transitionBusy !== ""}
                  onClick={() => {
                    void runTransition("calculate", selectedRun.id);
                  }}
                >
                  {transitionBusy === "calculate" ? "Calculating…" : "Calculate"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs"
                  disabled={transitionBusy !== ""}
                  onClick={() => {
                    void runTransition("approve", selectedRun.id);
                  }}
                >
                  {transitionBusy === "approve" ? "Approving…" : "Approve"}
                </Button>
                {!finalizeArmed ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 rounded-lg text-xs"
                    disabled={transitionBusy !== ""}
                    onClick={() => {
                      setTransitionError("");
                      setTransitionOk("");
                      setFinalizeArmed(true);
                    }}
                  >
                    Finalize…
                  </Button>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      aria-label="Type period to confirm finalize"
                      type="text"
                      placeholder={`Type ${selectedRun.period} to confirm`}
                      className={`${inputClass} w-full`}
                      value={finalizeText}
                      onChange={(event) => setFinalizeText(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 rounded-lg text-xs"
                      disabled={transitionBusy !== "" || finalizeText.trim() !== selectedRun.period}
                      onClick={() => {
                        void runTransition("finalize", selectedRun.id);
                      }}
                    >
                      {transitionBusy === "finalize" ? "Finalizing…" : "Confirm finalize"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        setFinalizeArmed(false);
                        setFinalizeText("");
                      }}
                    >
                      Cancel
                    </Button>
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                Calculate → POST …/calculate · Approve → POST …/approve · Finalize → POST
                …/finalize (irreversible, maker/checker enforced, If-Match sent).
              </p>
              <FormError message={transitionError} />
              <FormOk message={transitionOk} />
            </div>
          ) : null}
        </Surface>

        <Surface>
          <SectionHeading
            title="Exception Control Desk"
            description={
              selectedRun
                ? `Anomalies for ${selectedRun.period} · ${selectedRun.scope}`
                : "Select a run to inspect anomalies"
            }
            action={<AiLabel>Continuous audit</AiLabel>}
          />
          {!selectedRun ? (
            <EmptyLine>Select a payroll run to load its anomaly rows.</EmptyLine>
          ) : anomaliesLoading ? (
            <LoadingLine />
          ) : anomaliesError ? (
            <ErrorBlock message={anomaliesError} onRetry={() => setAnomaliesNonce((n) => n + 1)} />
          ) : anomalies.length === 0 ? (
            <EmptyLine>No anomalies recorded for this run.</EmptyLine>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anomaly) => {
                const name = anomaly.employeeId
                  ? (nameMap.get(anomaly.employeeId) ?? shortId(anomaly.employeeId))
                  : "Unknown employee";
                return (
                  <div
                    key={anomaly.id}
                    className="rounded-2xl border border-border/80 bg-card p-4"
                  >
                    <div className="flex gap-3">
                      <AvatarMark initials={initialsFor(name)} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{name}</p>
                          <StatusPill tone={anomalyTone(anomaly.severity)}>
                            {anomaly.severity}
                          </StatusPill>
                          <StatusPill tone={anomaly.status === "open" ? "warning" : "success"}>
                            {anomaly.status}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground/90">
                          {anomaly.ruleCode}
                        </p>
                        {anomaly.resolution ? (
                          <p className="mt-1 text-xs text-muted-foreground">{anomaly.resolution}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </div>
      </TabPanel>

      <TabPanel id="gross-to-net" active={tab}>
        <GrossToNetTab />
      </TabPanel>

      <TabPanel id="off-cycle" active={tab}>
        <OffCycleRunsTab />
      </TabPanel>

      <TabPanel id="loans" active={tab}>
        <CompanyLoansTab />
      </TabPanel>

      <TabPanel id="fnf" active={tab}>
        <FnfNoDuesTab />
      </TabPanel>

      <TabPanel id="plant-scope" active={tab}>
        <PlantScopingTab />
      </TabPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loans & Advances — live loan rows + advance rows                    */
/* GET /api/v1/loans · GET /api/v1/salary-advances                     */
/* ------------------------------------------------------------------ */

type LoanRow = {
  id: string;
  employeeId: string;
  principalMinor: number | null;
  outstandingMinor: number | null;
  currency: string;
  status: string;
  directorOverride: boolean;
};

type AdvanceRow = {
  id: string;
  employeeId: string;
  amountMinor: number | null;
  period: string;
  status: string;
  reason: string;
};

export function LoansPage() {
  const { people } = usePeople();
  const nameMap = usePeopleNameMap(people);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [showLoanForms, setShowLoanForms] = useState(true);
  // POST /api/v1/loans (applyForLoan: employeeId, principalMinor, tenureMonths, annualRatePct, purpose, guarantorEmployeeIds[2..3]) — Idempotency-Key REQUIRED
  const [loanEmployeeId, setLoanEmployeeId] = useState("");
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [loanTenure, setLoanTenure] = useState("12");
  const [loanRate, setLoanRate] = useState("10");
  const [loanPurpose, setLoanPurpose] = useState<string>(LOAN_PURPOSES[0]);
  const [loanInterestMethod, setLoanInterestMethod] = useState<string>("");
  const [loanGuarantorA, setLoanGuarantorA] = useState("");
  const [loanGuarantorB, setLoanGuarantorB] = useState("");
  const [loanGuarantorC, setLoanGuarantorC] = useState("");
  const [loanBusy, setLoanBusy] = useState(false);
  const [loanError, setLoanError] = useState("");
  const [loanOk, setLoanOk] = useState("");
  // POST /api/v1/salary-advances (employeeId, amountMinor, period YYYY-MM, reason 10-200, instalments 1-3) — Idempotency-Key REQUIRED
  const [advEmployeeId, setAdvEmployeeId] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advPeriod, setAdvPeriod] = useState(() => dayKey(0).slice(0, 7));
  const [advReason, setAdvReason] = useState("");
  // FRM-CMB-02 recovers an advance over one to three payroll periods.
  const [advInstalments, setAdvInstalments] = useState("1");
  const [advBusy, setAdvBusy] = useState(false);
  const [advError, setAdvError] = useState("");
  const [advOk, setAdvOk] = useState("");
  // Row transitions: loan consent/approve/disburse(If-Match)/repay · advance approve/pay(If-Match)
  const [rowBusyId, setRowBusyId] = useState("");
  const [rowError, setRowError] = useState("");
  const [rowOk, setRowOk] = useState("");
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});

  function refreshLoans(): void {
    setNonce((n) => n + 1);
  }

  async function loanTransition(
    loanId: string,
    kind: "consent-approve" | "consent-reject" | "approve" | "disburse",
  ): Promise<void> {
    setRowError("");
    setRowOk("");
    setRowBusyId(`${kind}:${loanId}`);
    try {
      if (kind === "consent-approve" || kind === "consent-reject") {
        await postJson(`/api/v1/loans/${encodeURIComponent(loanId)}/consent`, {
          approve: kind === "consent-approve",
        });
        setRowOk(kind === "consent-approve" ? "Guarantor consent recorded." : "Guarantor rejection recorded (loan rejected).");
      } else if (kind === "approve") {
        await postJson(`/api/v1/loans/${encodeURIComponent(loanId)}/approve`, { directorOverride: false });
        setRowOk("Loan approved. It can now be disbursed.");
      } else {
        await postJson(`/api/v1/loans/${encodeURIComponent(loanId)}/disburse`, {}, { idempotency: false, version: 1 });
        setRowOk("Loan disbursed.");
      }
      refreshLoans();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Loan action failed.");
    } finally {
      setRowBusyId("");
    }
  }

  async function repayLoanNow(loanId: string): Promise<void> {
    setRowError("");
    setRowOk("");
    const minor = rupeesToMinor(repayAmounts[loanId] ?? "");
    if (minor === null) {
      setRowError("BAD_REQUEST: Enter a positive repayment amount in rupees.");
      return;
    }
    setRowBusyId(`repay:${loanId}`);
    try {
      const result = (await postJson(`/api/v1/loans/${encodeURIComponent(loanId)}/repay`, {
        amountMinor: minor,
      })) as UnknownRecord;
      const data = asRecord(result.data);
      setRowOk(`Repayment recorded. Outstanding: ${formatMinor(num(data.outstandingMinor), "INR")}.`);
      setRepayAmounts((prev) => ({ ...prev, [loanId]: "" }));
      refreshLoans();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Repayment failed.");
    } finally {
      setRowBusyId("");
    }
  }

  async function advanceTransition(advanceId: string, kind: "approve" | "pay"): Promise<void> {
    setRowError("");
    setRowOk("");
    setRowBusyId(`${kind}:${advanceId}`);
    try {
      if (kind === "approve") {
        await postJson(`/api/v1/salary-advances/${encodeURIComponent(advanceId)}/approve`, {}, { idempotency: false });
        setRowOk("Advance approved. It can now be paid.");
      } else {
        await postJson(
          `/api/v1/salary-advances/${encodeURIComponent(advanceId)}/pay`,
          {},
          { idempotency: false, version: 1 },
        );
        setRowOk("Advance paid with recovery scheduled.");
      }
      refreshLoans();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Advance action failed.");
    } finally {
      setRowBusyId("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [loansRaw, advancesRaw] = await Promise.all([
          getJson("/api/v1/loans?page=1&pageSize=100"),
          getJson("/api/v1/salary-advances?page=1&pageSize=100"),
        ]);
        const loanItems = asRecord(loansRaw).data;
        const advanceItems = asRecord(advancesRaw).data;
        const loanRows = (Array.isArray(loanItems) ? (loanItems as UnknownRecord[]) : []).map(
          (item) => ({
            id: str(item.id),
            employeeId: str(item.employee_id),
            principalMinor: num(item.principal_minor),
            outstandingMinor: num(item.outstanding_minor),
            currency: str(item.currency, "INR"),
            status: str(item.status, "—"),
            directorOverride: bool(item.director_override),
          }),
        );
        const advanceRows = (
          Array.isArray(advanceItems) ? (advanceItems as UnknownRecord[]) : []
        ).map((item) => {
          const attributes = asRecord(item.attributes);
          return {
            id: str(item.id),
            employeeId: str(item.employee_id),
            amountMinor: num(attributes.amount_minor),
            period: str(attributes.period, "—"),
            status: str(attributes.status, "—"),
            reason: str(attributes.reason),
          };
        });
        if (!cancelled) {
          setLoans(loanRows);
          setAdvances(advanceRows);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load loans and advances.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const outstandingTotal = useMemo(
    () =>
      loans.reduce<number>(
        (total, loan) => total + (loan.outstandingMinor === null ? 0 : loan.outstandingMinor),
        0,
      ),
    [loans],
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Financial Wellbeing · Live Loans & Advances"
        title="Help, with safeguards."
        description="Review employee loans and salary advances."
        action={
          <Button
            className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowLoanForms((visible) => !visible)}
          >
            <HandCoins className="mr-1.5 size-4" /> New Application
          </Button>
        }
      />

      {showLoanForms ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading
              title="New Loan Application"
              description="Submit an employee loan application for review."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Employee
                </span>
                <select
                  aria-label="Loan employee"
                  className={`${selectClass} w-full`}
                  value={loanEmployeeId}
                  onChange={(event) => setLoanEmployeeId(event.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)} · {str(person.employeeCode, "—")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Principal (₹)
                </span>
                <input
                  aria-label="Loan principal rupees"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="100000"
                  className={`${inputClass} w-full`}
                  value={loanPrincipal}
                  onChange={(event) => setLoanPrincipal(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Tenure (months, 1–84)
                </span>
                <input
                  aria-label="Loan tenure months"
                  type="number"
                  min="1"
                  max="84"
                  step="1"
                  className={`${inputClass} w-full`}
                  value={loanTenure}
                  onChange={(event) => setLoanTenure(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Annual rate % (0–36)
                </span>
                <input
                  aria-label="Loan annual rate"
                  type="number"
                  min="0"
                  max="36"
                  step="0.1"
                  className={`${inputClass} w-full`}
                  value={loanRate}
                  onChange={(event) => setLoanRate(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Purpose
                </span>
                <select
                  aria-label="Loan purpose"
                  className={`${selectClass} w-full`}
                  value={loanPurpose}
                  onChange={(event) => setLoanPurpose(event.target.value)}
                >
                  {LOAN_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>{LOAN_PURPOSE_LABELS[purpose] ?? purpose}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Interest method
                </span>
                <select
                  aria-label="Interest method"
                  className={`${selectClass} w-full`}
                  value={loanInterestMethod}
                  onChange={(event) => setLoanInterestMethod(event.target.value)}
                >
                  <option value="">Not recorded</option>
                  {INTEREST_METHODS.map((method) => (
                    <option key={method} value={method}>{INTEREST_METHOD_LABELS[method]}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">
                  A loan with no recorded method can be applied for, but cannot be sanctioned: the repayment schedule has no basis, so approval is refused rather than assuming one.
                </span>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Guarantor 1 (required)
                </span>
                <select
                  aria-label="Loan guarantor 1"
                  className={`${selectClass} w-full`}
                  value={loanGuarantorA}
                  onChange={(event) => setLoanGuarantorA(event.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Guarantor 2 (required)
                </span>
                <select
                  aria-label="Loan guarantor 2"
                  className={`${selectClass} w-full`}
                  value={loanGuarantorB}
                  onChange={(event) => setLoanGuarantorB(event.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Guarantor 3 (optional)
                </span>
                <select
                  aria-label="Loan guarantor 3"
                  className={`${selectClass} w-full`}
                  value={loanGuarantorC}
                  onChange={(event) => setLoanGuarantorC(event.target.value)}
                >
                  <option value="">None</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              disabled={loanBusy}
              onClick={() => {
                void (async () => {
                  setLoanError("");
                  setLoanOk("");
                  const principalMinor = rupeesToMinor(loanPrincipal);
                  const tenureMonths = Number(loanTenure);
                  const annualRatePct = Number(loanRate);
                  const guarantors = [loanGuarantorA, loanGuarantorB, loanGuarantorC].filter(Boolean);
                  if (!loanEmployeeId) {
                    setLoanError("BAD_REQUEST: Select the borrowing employee.");
                    return;
                  }
                  if (principalMinor === null) {
                    setLoanError("BAD_REQUEST: Enter a positive principal in rupees.");
                    return;
                  }
                  if (!Number.isInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 84) {
                    setLoanError("BAD_REQUEST: Tenure must be 1–84 months.");
                    return;
                  }
                  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 36) {
                    setLoanError("BAD_REQUEST: Annual rate must be 0–36%.");
                    return;
                  }
                  if (!(LOAN_PURPOSES as readonly string[]).includes(loanPurpose)) {
                    setLoanError(`BAD_REQUEST: Purpose must be one of ${LOAN_PURPOSES.join(", ")}.`);
                    return;
                  }
                  if (guarantors.length < 2) {
                    setLoanError("BAD_REQUEST: Two guarantors are mandatory.");
                    return;
                  }
                  setLoanBusy(true);
                  try {
                    const result = (await postJson("/api/v1/loans", {
                      employeeId: loanEmployeeId,
                      principalMinor,
                      tenureMonths,
                      annualRatePct,
                      purpose: loanPurpose,
                      guarantorEmployeeIds: guarantors,
                      ...(loanInterestMethod ? { interestMethod: loanInterestMethod } : {}),
                    })) as UnknownRecord;
                    const data = asRecord(result.data);
                    setLoanOk(`Loan submitted (${str(data.id, "recorded")}). Lists refreshed below.`);
                    setLoanPrincipal("");
                    setLoanPurpose(LOAN_PURPOSES[0]);
                    refreshLoans();
                  } catch (err) {
                    setLoanError(err instanceof Error ? err.message : "Could not submit the loan.");
                  } finally {
                    setLoanBusy(false);
                  }
                })();
              }}
            >
              {loanBusy ? "Submitting…" : "Submit loan application"}
            </Button>
            <FormError message={loanError} />
            <FormOk message={loanOk} />
          </Surface>

          <Surface>
            <SectionHeading
              title="New Salary Advance"
              description="Request a salary advance for the selected pay period."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Employee
                </span>
                <select
                  aria-label="Advance employee"
                  className={`${selectClass} w-full`}
                  value={advEmployeeId}
                  onChange={(event) => setAdvEmployeeId(event.target.value)}
                >
                  <option value="">Select…</option>
                  {people.map((person) => (
                    <option key={str(person.id)} value={str(person.id)}>
                      {personLabel(person)} · {str(person.employeeCode, "—")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Amount (₹, ≤ 1 month basic)
                </span>
                <input
                  aria-label="Advance amount rupees"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="20000"
                  className={`${inputClass} w-full`}
                  value={advAmount}
                  onChange={(event) => setAdvAmount(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Period (YYYY-MM)
                </span>
                <input
                  aria-label="Advance period"
                  type="month"
                  className={`${inputClass} w-full`}
                  value={advPeriod}
                  onChange={(event) => setAdvPeriod(event.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Instalments
                </span>
                <input
                  aria-label="Advance instalments"
                  type="number"
                  min="1"
                  max="3"
                  step="1"
                  className={inputClass}
                  value={advInstalments}
                  onChange={(event) => setAdvInstalments(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reason (at least 10 characters)
                </span>
                <input
                  aria-label="Advance reason"
                  type="text"
                  minLength={10}
                  maxLength={200}
                  placeholder="Emergency travel following a family hospitalisation"
                  className={`${inputClass} w-full`}
                  value={advReason}
                  onChange={(event) => setAdvReason(event.target.value)}
                />
              </label>
            </div>
            <Button
              className="mt-4 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              disabled={advBusy}
              onClick={() => {
                void (async () => {
                  setAdvError("");
                  setAdvOk("");
                  const amountMinor = rupeesToMinor(advAmount);
                  if (!advEmployeeId) {
                    setAdvError("BAD_REQUEST: Select an employee.");
                    return;
                  }
                  if (amountMinor === null) {
                    setAdvError("BAD_REQUEST: Enter a positive amount in rupees.");
                    return;
                  }
                  if (!/^\d{4}-\d{2}$/.test(advPeriod)) {
                    setAdvError("BAD_REQUEST: A period (YYYY-MM) is required.");
                    return;
                  }
                  if (advReason.trim().length < 10) {
                    setAdvError("BAD_REQUEST: A reason of at least 10 characters is required.");
                    return;
                  }
                  const instalments = Number(advInstalments);
                  if (!Number.isInteger(instalments) || instalments < 1 || instalments > 3) {
                    setAdvError("BAD_REQUEST: Recover the advance over one to three instalments.");
                    return;
                  }
                  setAdvBusy(true);
                  try {
                    const result = (await postJson("/api/v1/salary-advances", {
                      employeeId: advEmployeeId,
                      amountMinor,
                      period: advPeriod,
                      reason: advReason.trim(),
                      instalments,
                    })) as UnknownRecord;
                    const data = asRecord(result.data);
                    setAdvOk(`Advance requested (${str(data.id, "recorded")}). Lists refreshed below.`);
                    setAdvAmount("");
                    setAdvReason("");
                    refreshLoans();
                  } catch (err) {
                    setAdvError(err instanceof Error ? err.message : "Could not request the advance.");
                  } finally {
                    setAdvBusy(false);
                  }
                })();
              }}
            >
              {advBusy ? "Submitting…" : "Submit advance request"}
            </Button>
            <FormError message={advError} />
            <FormOk message={advOk} />
          </Surface>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Loan Applications", loading ? "Loading…" : String(loans.length), "across all employees"],
          [
            "Outstanding Principal",
            loading ? "Loading…" : formatMinor(outstandingTotal, "INR"),
            "sum of listed loans",
          ],
          ["Salary Advances", loading ? "Loading…" : String(advances.length), "across all employees"],
        ].map(([label, value, note]) => (
          <Surface key={label} className="min-w-0 p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 min-w-0 font-mono text-2xl font-bold tracking-tight text-foreground xl:text-3xl">{value}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{note}</p>
          </Surface>
        ))}
      </div>

      {rowError ? (
        <p className="mb-3 font-mono text-[11px] leading-relaxed text-destructive">{rowError}</p>
      ) : null}
      {rowOk ? (
        <p className="mb-3 font-mono text-[11px] leading-relaxed text-success">{rowOk}</p>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Surface>
          <SectionHeading
            title="Loans"
            description="Newest first, with outstanding principal."
            action={<AiLabel>Live loans</AiLabel>}
          />
          {loading ? (
            <LoadingLine />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => setNonce((n) => n + 1)} />
          ) : loans.length === 0 ? (
            <EmptyLine>
              No loan applications exist yet. Applications appear here once submitted.
            </EmptyLine>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => {
                const name = loan.employeeId
                  ? (nameMap.get(loan.employeeId) ?? shortId(loan.employeeId))
                  : "Unknown employee";
                return (
                  <div
                    key={loan.id}
                    className="rounded-2xl border border-border/80 bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <AvatarMark initials={initialsFor(name)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Principal {formatMinor(loan.principalMinor, loan.currency)} ·
                          Outstanding {formatMinor(loan.outstandingMinor, loan.currency)}
                        </p>
                      </div>
                      <StatusPill tone={loan.status === "repaid" || loan.status === "closed" ? "success" : "info"}>
                        {loan.status}
                      </StatusPill>
                    </div>
                    {loan.directorOverride ? (
                      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                        Director override recorded
                      </p>
                    ) : null}
                    {loan.status === "submitted" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void loanTransition(loan.id, "consent-approve");
                          }}
                        >
                          {rowBusyId === `consent-approve:${loan.id}` ? "Working…" : "Record consent"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void loanTransition(loan.id, "consent-reject");
                          }}
                        >
                          {rowBusyId === `consent-reject:${loan.id}` ? "Working…" : "Reject consent"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void loanTransition(loan.id, "approve");
                          }}
                        >
                          {rowBusyId === `approve:${loan.id}` ? "Working…" : "Approve"}
                        </Button>
                      </div>
                    ) : null}
                    {loan.status === "approved" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void loanTransition(loan.id, "disburse");
                          }}
                        >
                          {rowBusyId === `disburse:${loan.id}` ? "Working…" : "Disburse (If-Match)"}
                        </Button>
                      </div>
                    ) : null}
                    {loan.status === "disbursed" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          aria-label={`Repayment amount for loan ${loan.id}`}
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Repay ₹"
                          className={`${inputClass} w-full`}
                          value={repayAmounts[loan.id] ?? ""}
                          onChange={(event) =>
                            setRepayAmounts((prev) => ({ ...prev, [loan.id]: event.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void repayLoanNow(loan.id);
                          }}
                        >
                          {rowBusyId === `repay:${loan.id}` ? "Working…" : "Repay"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Salary Advances"
            description="Newest first, capped at one month of basic salary by policy."
            action={<AiLabel>Live advances</AiLabel>}
          />
          {loading ? (
            <LoadingLine />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => setNonce((n) => n + 1)} />
          ) : advances.length === 0 ? (
            <EmptyLine>
              No salary advances exist yet. Advances appear here once requested.
            </EmptyLine>
          ) : (
            <div className="space-y-3">
              {advances.map((advance) => {
                const name = advance.employeeId
                  ? (nameMap.get(advance.employeeId) ?? shortId(advance.employeeId))
                  : "Unknown employee";
                return (
                  <div
                    key={advance.id}
                    className="rounded-2xl border border-border/80 bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <AvatarMark initials={initialsFor(name)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {formatMinor(advance.amountMinor, "INR")} · Period {advance.period}
                        </p>
                      </div>
                      <StatusPill
                        tone={
                          advance.status === "recovered" || advance.status === "closed"
                            ? "success"
                            : advance.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {advance.status}
                      </StatusPill>
                    </div>
                    {advance.reason ? (
                      <p className="mt-3 rounded-xl border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                        {advance.reason}
                      </p>
                    ) : null}
                    {advance.status === "requested" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void advanceTransition(advance.id, "approve");
                          }}
                        >
                          {rowBusyId === `approve:${advance.id}` ? "Working…" : "Approve"}
                        </Button>
                      </div>
                    ) : null}
                    {advance.status === "approved" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={rowBusyId !== ""}
                          onClick={() => {
                            void advanceTransition(advance.id, "pay");
                          }}
                        >
                          {rowBusyId === `pay:${advance.id}` ? "Working…" : "Pay (If-Match)"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
