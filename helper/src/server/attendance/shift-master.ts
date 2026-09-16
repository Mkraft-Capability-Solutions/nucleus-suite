import "server-only";

import { sqlClient } from "@/lib/db";
import {
  detectionIntervals,
  detectionWindowContains,
  detectionWindowOverlaps,
  shiftRules,
  type ClockInterval,
  type ShiftThresholds,
} from "@/lib/hr-rules";
import { clockToMinuteOfDay } from "@/server/attendance/attendance-policy";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * The shift master (F-SHF-01) as the attendance engine reads it.
 *
 * The record the client configures lives in `hrms_operation_records` under the
 * `shifts` resource — the same row the Shift master screen writes. Every threshold,
 * grace, detection window and overtime setting the engine uses comes from there, so
 * a new shift length is a new record and never a new branch in this file (RL-16).
 */
export type ShiftMasterRecord = {
  code: string;
  name: string;
  startMinute: number | null;
  endMinute: number | null;
  durationMinutes: number;
  graceInMinutes: number | null;
  graceOutMinutes: number | null;
  thresholds: ShiftThresholds;
  /** RL-19 detection window, empty when the record does not configure one. */
  detection: ClockInterval[];
  detectionLabel: string | null;
  overtimeBasis: "gross-span" | "productive";
  overtimeAfterMinutes: number;
  otEligible: boolean;
  /** Where the record came from, so a screen can say "seeded" rather than imply it was approved. */
  source: "shift-master" | "seed";
};

/**
 * Seed shifts. These exist so a tenant that has not yet configured its shift master
 * can still process a day; every value is one the source workbook states.
 *
 * Detection windows are deliberately absent: RL-19 requires a window per shift and
 * the workbook never states the times, so auto-detection stays off until someone
 * configures it rather than guessing a boundary and silently reassigning shifts.
 */
export const SEED_SHIFTS = {
  A: { code: "A", name: "General / A shift", startsAt: "08:00", endsAt: "20:00", durationMinutes: 720 },
  B: { code: "B", name: "Night / B shift", startsAt: "20:00", endsAt: "08:00", durationMinutes: 720 },
  C: { code: "C", name: "Morning / C shift", startsAt: "08:00", endsAt: "16:00", durationMinutes: 480 },
} as const;

export type SeedShiftCode = keyof typeof SEED_SHIFTS;

function seedRecord(code: string): ShiftMasterRecord | null {
  const seed = SEED_SHIFTS[code as SeedShiftCode];
  if (!seed) return null;
  const hours = seed.durationMinutes / 60;
  const thresholds = shiftRules[hours];
  if (!thresholds) return null;
  return {
    code: seed.code,
    name: seed.name,
    startMinute: clockToMinuteOfDay(seed.startsAt),
    endMinute: clockToMinuteOfDay(seed.endsAt),
    durationMinutes: seed.durationMinutes,
    graceInMinutes: null,
    graceOutMinutes: null,
    thresholds: { halfDayBelowMinutes: thresholds.halfDayBelowMinutes, absentBelowMinutes: thresholds.absentBelowMinutes },
    detection: [],
    detectionLabel: null,
    // RL-04: the seeded shift pays overtime on gross hours after its own duration,
    // which is what reproduces the workbook's 19:20 less 12:00 = 7:20.
    overtimeBasis: "gross-span",
    overtimeAfterMinutes: seed.durationMinutes,
    otEligible: true,
    source: "seed",
  };
}

function readInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** `PL_OT_BASIS` stores gross_minutes / net_minutes; the engine speaks gross-span / productive. */
function readOvertimeBasis(value: unknown): "gross-span" | "productive" | null {
  if (value === "gross_minutes" || value === "gross-span") return "gross-span";
  if (value === "net_minutes" || value === "productive") return "productive";
  return null;
}

type ShiftRow = { data: Record<string, unknown>; status: string };

function projectShift(row: ShiftRow): ShiftMasterRecord | null {
  const code = typeof row.data.shiftCode === "string" ? row.data.shiftCode.trim() : "";
  if (code === "") return null;
  const seed = seedRecord(code);
  const duration = readInt(row.data.durationMinutes) ?? seed?.durationMinutes ?? null;
  if (duration === null || duration <= 0) return null;
  const halfDay = readInt(row.data.halfDayMinutes);
  const absentBelow = readInt(row.data.absentBelowMinutes);
  const fromMinute = clockToMinuteOfDay(row.data.earliestIn);
  const toMinute = clockToMinuteOfDay(row.data.latestIn);
  return {
    code,
    name: typeof row.data.name === "string" && row.data.name.trim() !== "" ? row.data.name.trim() : code,
    startMinute: clockToMinuteOfDay(row.data.startTime),
    endMinute: clockToMinuteOfDay(row.data.endTime),
    durationMinutes: duration,
    graceInMinutes: readInt(row.data.graceInMinutes),
    graceOutMinutes: readInt(row.data.graceOutMinutes),
    thresholds: {
      halfDayBelowMinutes: halfDay ?? seed?.thresholds.halfDayBelowMinutes ?? Number.NaN,
      absentBelowMinutes: absentBelow ?? seed?.thresholds.absentBelowMinutes ?? Number.NaN,
    },
    detection: fromMinute === null || toMinute === null ? [] : detectionIntervals(fromMinute, toMinute),
    detectionLabel: fromMinute === null || toMinute === null ? null : `${String(row.data.earliestIn)}–${String(row.data.latestIn)}`,
    overtimeBasis: readOvertimeBasis(row.data.otBasis) ?? "gross-span",
    overtimeAfterMinutes: readInt(row.data.otAfterMinutes) ?? duration,
    otEligible: row.data.otEligible !== "no",
    source: "shift-master",
  };
}

/** Shift master records a running engine may use: approved or published, never a draft. */
const USABLE_SHIFT_STATES = ["approved", "published"];

export async function listShiftMaster(access: Access): Promise<ShiftMasterRecord[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select data, status from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'shifts'
        and status = any(${USABLE_SHIFT_STATES}::text[])
      order by updated_at desc, created_at desc
    `,
  ]);
  const seen = new Set<string>();
  const records: ShiftMasterRecord[] = [];
  for (const row of rows as ShiftRow[]) {
    const record = projectShift(row);
    if (!record || seen.has(record.code)) continue;
    seen.add(record.code);
    records.push(record);
  }
  return records;
}

/**
 * The shift a day is processed on. A configured record always wins; a code with no
 * record falls back to its seed, and an unknown code is refused rather than
 * processed on someone else's shift.
 */
export async function resolveShift(access: Access, code: string, preloaded?: readonly ShiftMasterRecord[]): Promise<ShiftMasterRecord> {
  const configured = (preloaded ?? await listShiftMaster(access)).find((record) => record.code === code);
  const record = configured ?? seedRecord(code);
  if (!record) {
    throw new HttpError({
      status: 422,
      code: "SHIFT_NOT_CONFIGURED",
      message: `Shift "${code}" has no approved shift master record. Create it on the Shift master screen before attendance can be processed on it.`,
      details: [{ field: "shiftCode", issue: "No approved or published shift master record carries this code." }],
    });
  }
  if (!Number.isFinite(record.thresholds.halfDayBelowMinutes) || !Number.isFinite(record.thresholds.absentBelowMinutes)) {
    throw new HttpError({
      status: 422,
      code: "SHIFT_NOT_CONFIGURED",
      message: `Shift "${code}" does not carry its half-day and absent thresholds. RL-16 puts them on the shift, so they must be set on the shift master record.`,
      details: [{ field: "halfDayMinutes", issue: "Set halfDayMinutes and absentBelowMinutes on the shift record." }],
    });
  }
  return record;
}

export type ShiftDetection = {
  rostered: string;
  detected: string | null;
  effective: string;
  reason: string | null;
};

/**
 * RL-19: the shift is resolved from the first in-punch against each shift's own
 * detection window, and the detected shift governs over the rostered one. Only
 * records that actually configure a window take part, so detection never silently
 * reassigns a day on a tenant that has not set its windows up.
 */
export function detectShift(records: readonly ShiftMasterRecord[], rostered: string, firstInMinute: number): ShiftDetection {
  const detected = records.find((record) => record.detection.length > 0 && detectionWindowContains(record.detection, firstInMinute));
  if (!detected || detected.code === rostered) {
    return { rostered, detected: null, effective: rostered, reason: null };
  }
  return {
    rostered,
    detected: detected.code,
    effective: detected.code,
    reason: `First in-punch at ${minuteLabel(firstInMinute)} falls in the ${detected.code} detection window ${detected.detectionLabel ?? ""}.`.trim(),
  };
}

function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export type DetectionWindowCandidate = { code: string; earliestIn: unknown; latestIn: unknown };

/**
 * RL-19: "Detection windows must not overlap". Enforced when a shift is saved,
 * because a client-side warning badge does not stop a save and an overlapping pair
 * makes the detected shift depend on row order.
 */
export function assertDetectionWindowsDoNotOverlap(candidates: readonly DetectionWindowCandidate[]): void {
  const windows: Array<{ code: string; intervals: ClockInterval[]; label: string }> = [];
  for (const candidate of candidates) {
    const from = clockToMinuteOfDay(candidate.earliestIn);
    const to = clockToMinuteOfDay(candidate.latestIn);
    if (from === null || to === null) continue;
    windows.push({ code: candidate.code, intervals: detectionIntervals(from, to), label: `${String(candidate.earliestIn)}–${String(candidate.latestIn)}` });
  }
  const clashes = detectionWindowOverlaps(windows);
  if (clashes.length === 0) return;
  throw new HttpError({
    status: 422,
    code: "SHIFT_WINDOW_OVERLAP",
    message: `Shift detection windows must not overlap. ${clashes
      .map((clash) => `${clash.left.code} (${clash.left.label}) overlaps ${clash.right.code} (${clash.right.label})`)
      .join("; ")}.`,
    details: clashes.map((clash) => ({ field: "earliestIn", issue: `${clash.left.code} overlaps ${clash.right.code}.` })),
  });
}

/**
 * Validates one shift about to be saved against every other usable shift record.
 * Called from the operational workflow writer so the rule holds for every caller,
 * API or screen.
 */
export async function assertShiftDetectionWindowIsFree(
  access: Access,
  candidate: { id?: string; shiftCode: unknown; earliestIn: unknown; latestIn: unknown },
): Promise<void> {
  const code = typeof candidate.shiftCode === "string" ? candidate.shiftCode.trim() : "";
  if (code === "" || clockToMinuteOfDay(candidate.earliestIn) === null || clockToMinuteOfDay(candidate.latestIn) === null) return;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select data from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'shifts'
        and status = any(${USABLE_SHIFT_STATES}::text[])
        and (${candidate.id ?? null}::uuid is null or id <> ${candidate.id ?? null}::uuid)
        and data->>'shiftCode' is distinct from ${code}
    `,
  ]);
  const others = (rows as Array<{ data: Record<string, unknown> }>).map((row) => ({
    code: String(row.data.shiftCode ?? ""),
    earliestIn: row.data.earliestIn,
    latestIn: row.data.latestIn,
  }));
  assertDetectionWindowsDoNotOverlap([
    { code, earliestIn: candidate.earliestIn, latestIn: candidate.latestIn },
    ...others,
  ]);
}
