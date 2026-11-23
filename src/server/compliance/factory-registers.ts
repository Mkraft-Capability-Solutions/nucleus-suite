import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, recordAudit, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { isoOrNull, minorOrNull, textOrNull } from "./route-support";

/**
 * Factories Act registers for the compliance workspace.
 *
 * - Form 18 (notice of accident) and Form 36 (inspection book) entries are stored as typed rows in
 *   `vp_feature_records` (kinds below), one row per notice / visit, tenant scoped and audited.
 * - Form 28 (muster roll) is never stored by hand: it is derived on every read from `attendance_days`
 *   and `employees` for the requested month, so it is reproducible from stored data.
 *
 * Nothing here contacts the Factory Inspectorate. A notified-on date records what a person already did.
 * Whether an accident is notifiable is flagged from the Section 88 test (> 48 hours away from work);
 * the legal reading is for counsel to confirm.
 */

export const ACCIDENT_KIND = "factory_accident_form18";
export const INSPECTION_KIND = "factory_inspection_form36";

/** More than 48 hours (two working days) away from work makes an accident notifiable under Section 88. */
export const NOTIFIABLE_AFTER_DAYS = 2;
/** Factories Act spread-over ceiling per day, in minutes (10.5 hours). */
export const SPREADOVER_LIMIT_MINUTES = 630;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const notFuture = (value: string) => value <= new Date().toISOString().slice(0, 10);

export const accidentSchema = z
  .object({
    action: z.literal("accident"),
    injuredPersonName: z.string().trim().min(2, "Enter the injured person's name.").max(160),
    tokenNo: z.string().trim().min(1, "Enter the token number.").max(40),
    age: z.number().int().min(14, "Age must be at least 14.").max(100).optional(),
    sex: z.string().trim().max(20).optional(),
    occupation: z.string().trim().min(2, "Enter the occupation.").max(120),
    exactPlace: z.string().trim().min(2, "Enter where it happened.").max(200),
    dateOfOccurrence: isoDate.refine(notFuture, "The date cannot be in the future."),
    timeOfOccurrence: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.").optional(),
    natureOfInjury: z.string().trim().min(2, "Describe the injury.").max(300),
    causeOfAccident: z.string().trim().max(1000).optional(),
    lostWorkdays: z.number().min(0, "Lost workdays cannot be negative.").max(365),
    investigatingOfficer: z.string().trim().max(160).optional(),
    remedialActions: z.string().trim().min(2, "Record the remedial actions.").max(1000),
    inspectorateNotifiedOn: isoDate.refine(notFuture, "The date cannot be in the future.").optional(),
    context: z.unknown().optional(),
  })
  .refine((v) => !v.inspectorateNotifiedOn || v.inspectorateNotifiedOn >= v.dateOfOccurrence, {
    path: ["inspectorateNotifiedOn"],
    message: "The inspectorate cannot be notified before the accident happened.",
  });

export const inspectionSchema = z.object({
  action: z.literal("inspector"),
  inspector: z.string().trim().min(2, "Enter the inspector's name.").max(160),
  authority: z.string().trim().min(2, "Enter the authority.").max(200),
  visitDate: isoDate.refine(notFuture, "The visit date cannot be in the future."),
  purpose: z.string().trim().min(2, "Enter the purpose of the visit.").max(1000),
  observations: z.string().trim().max(2000).optional(),
  remedialDirections: z.string().trim().max(2000).optional(),
  context: z.unknown().optional(),
});

export const closeInspectionSchema = z.object({
  action: z.literal("close_inspection"),
  inspectionId: z.string().uuid(),
  certifyingManager: z.string().trim().min(2, "Enter who certifies compliance.").max(160),
  closureDate: isoDate.refine(notFuture, "The closure date cannot be in the future."),
  context: z.unknown().optional(),
});

export const factoryRegisterCommandSchema = z.union([accidentSchema, inspectionSchema, closeInspectionSchema]);
export type FactoryRegisterCommand = z.infer<typeof factoryRegisterCommandSchema>;

export type AccidentNotice = {
  id: string;
  injuredPersonName: string;
  tokenNo: string;
  employeeId: string | null;
  age: number | null;
  sex: string | null;
  occupation: string;
  exactPlace: string;
  dateOfOccurrence: string | null;
  timeOfOccurrence: string | null;
  natureOfInjury: string;
  causeOfAccident: string | null;
  lostWorkdays: number | null;
  notifiable: boolean;
  investigatingOfficer: string | null;
  remedialActions: string;
  inspectorateNotifiedOn: string | null;
  recordedAt: string | null;
};

export type InspectionEntry = {
  id: string;
  inspector: string;
  authority: string;
  visitDate: string | null;
  purpose: string;
  observations: string | null;
  remedialDirections: string | null;
  status: "open" | "closed";
  certifyingManager: string | null;
  closureDate: string | null;
  recordedAt: string | null;
};

type FeatureRow = { id: string; employee_id: string | null; status: string; effective_on: unknown; data: Record<string, unknown>; created_at: unknown };

function readAccident(row: FeatureRow): AccidentNotice {
  const d = row.data ?? {};
  const lost = typeof d.lostWorkdays === "number" ? d.lostWorkdays : null;
  return {
    id: row.id,
    injuredPersonName: textOrNull(d.injuredPersonName) ?? "",
    tokenNo: textOrNull(d.tokenNo) ?? "",
    employeeId: row.employee_id,
    age: typeof d.age === "number" ? d.age : null,
    sex: textOrNull(d.sex),
    occupation: textOrNull(d.occupation) ?? "",
    exactPlace: textOrNull(d.exactPlace) ?? "",
    dateOfOccurrence: textOrNull(d.dateOfOccurrence),
    timeOfOccurrence: textOrNull(d.timeOfOccurrence),
    natureOfInjury: textOrNull(d.natureOfInjury) ?? "",
    causeOfAccident: textOrNull(d.causeOfAccident),
    lostWorkdays: lost,
    notifiable: lost !== null && lost > NOTIFIABLE_AFTER_DAYS,
    investigatingOfficer: textOrNull(d.investigatingOfficer),
    remedialActions: textOrNull(d.remedialActions) ?? "",
    inspectorateNotifiedOn: textOrNull(d.inspectorateNotifiedOn),
    recordedAt: isoOrNull(row.created_at),
  };
}

function readInspection(row: FeatureRow): InspectionEntry {
  const d = row.data ?? {};
  return {
    id: row.id,
    inspector: textOrNull(d.inspector) ?? "",
    authority: textOrNull(d.authority) ?? "",
    visitDate: textOrNull(d.visitDate),
    purpose: textOrNull(d.purpose) ?? "",
    observations: textOrNull(d.observations),
    remedialDirections: textOrNull(d.remedialDirections),
    status: row.status === "closed" ? "closed" : "open",
    certifyingManager: textOrNull(d.certifyingManager),
    closureDate: textOrNull(d.closureDate),
    recordedAt: isoOrNull(row.created_at),
  };
}

export async function listFactoryRegisters(access: Access): Promise<{ accidents: AccidentNotice[]; inspections: InspectionEntry[] }> {
  enforce(access.context, "compliance.filing.read", { tenantId: access.tenantId });
  const [accidentRows, inspectionRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, status, effective_on, data, created_at from vp_feature_records
      where tenant_id = ${access.tenantId} and kind = ${ACCIDENT_KIND} order by effective_on desc nulls last, created_at desc limit 200`,
    sqlClient`select id, employee_id, status, effective_on, data, created_at from vp_feature_records
      where tenant_id = ${access.tenantId} and kind = ${INSPECTION_KIND} order by effective_on desc nulls last, created_at desc limit 200`,
  ]);
  return {
    accidents: (accidentRows as FeatureRow[]).map(readAccident),
    inspections: (inspectionRows as FeatureRow[]).map(readInspection),
  };
}

function strip<T extends { action: string; context?: unknown }>(input: T): Omit<T, "action" | "context"> {
  const { action: _action, context: _context, ...rest } = input;
  void _action;
  void _context;
  return rest;
}

export async function executeFactoryRegisterCommand(access: Access, command: FactoryRegisterCommand, requestId: string): Promise<{ id: string; kind: string; status: string }> {
  enforce(access.context, "compliance.filing.write", { tenantId: access.tenantId });

  if (command.action === "accident") {
    const data = strip(command);
    const [employeeRows] = await tenantTx(access, [
      sqlClient`select id from employees where tenant_id = ${access.tenantId} and employee_code = ${data.tokenNo} limit 1`,
    ]);
    const employeeId = (employeeRows as Array<{ id: string }>)[0]?.id ?? null;
    const id = randomUUID();
    const notifiable = data.lostWorkdays > NOTIFIABLE_AFTER_DAYS;
    await tenantTx(access, [
      sqlClient`insert into vp_feature_records (id, tenant_id, kind, employee_id, status, effective_on, data, created_by_membership_id)
        values (${id}, ${access.tenantId}, ${ACCIDENT_KIND}, ${employeeId}, ${data.inspectorateNotifiedOn ? "notified" : "recorded"},
          ${data.dateOfOccurrence}::date, ${JSON.stringify({ ...data, notifiable })}::jsonb, ${access.context.membershipId})`,
    ]);
    await recordAudit(access, { action: "compliance.form18_recorded", entityType: ACCIDENT_KIND, entityId: id, reason: "Form 18 accident notice recorded", after: { tokenNo: data.tokenNo, dateOfOccurrence: data.dateOfOccurrence, notifiable }, requestId });
    return { id, kind: ACCIDENT_KIND, status: data.inspectorateNotifiedOn ? "notified" : "recorded" };
  }

  if (command.action === "inspector") {
    const data = strip(command);
    const id = randomUUID();
    await tenantTx(access, [
      sqlClient`insert into vp_feature_records (id, tenant_id, kind, status, effective_on, data, created_by_membership_id)
        values (${id}, ${access.tenantId}, ${INSPECTION_KIND}, 'open', ${data.visitDate}::date, ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})`,
    ]);
    await recordAudit(access, { action: "compliance.form36_recorded", entityType: INSPECTION_KIND, entityId: id, reason: "Form 36 inspection visit recorded", after: { visitDate: data.visitDate, authority: data.authority }, requestId });
    return { id, kind: INSPECTION_KIND, status: "open" };
  }

  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, data from vp_feature_records where tenant_id = ${access.tenantId} and kind = ${INSPECTION_KIND} and id = ${command.inspectionId} limit 1`,
  ]);
  const inspection = (rows as Array<{ id: string; status: string; data: Record<string, unknown> }>)[0];
  if (!inspection) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That inspection entry was not found." });
  if (inspection.status === "closed") throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This inspection entry is already closed." });
  const visitDate = textOrNull(inspection.data.visitDate);
  if (visitDate && command.closureDate < visitDate) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The closure date cannot precede the visit date.", details: [{ field: "closureDate", issue: "before visit date" }] });
  }
  const [updated] = await tenantTx(access, [
    sqlClient`update vp_feature_records set status = 'closed', updated_at = now(),
        data = data || ${JSON.stringify({ certifyingManager: command.certifyingManager, closureDate: command.closureDate })}::jsonb
      where tenant_id = ${access.tenantId} and kind = ${INSPECTION_KIND} and id = ${inspection.id} and status <> 'closed' returning id`,
  ]);
  if ((updated as unknown[]).length === 0) throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This inspection entry changed meanwhile. Refresh and retry." });
  await recordAudit(access, { action: "compliance.form36_closed", entityType: INSPECTION_KIND, entityId: inspection.id, reason: "Inspection directions certified as complied", after: { certifyingManager: command.certifyingManager, closureDate: command.closureDate }, requestId });
  return { id: inspection.id, kind: INSPECTION_KIND, status: "closed" };
}

// ---------------------------------------------------------------------------
// Form 28 muster roll (derived)
// ---------------------------------------------------------------------------

export const musterQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM."),
  location: z.string().trim().max(160).optional(),
});

export type MusterMark = "P" | "H" | "A" | "L" | "HOL" | "WO" | "PEN";
const MARKS: Record<string, MusterMark> = { present: "P", half_day: "H", absent: "A", leave: "L", holiday: "HOL", rest_day: "WO", pending: "PEN" };

export type MusterWorker = {
  employeeId: string;
  tokenNo: string;
  name: string;
  sex: string | null;
  relay: string | null;
  natureOfWork: string;
  days: Array<{ day: number; mark: MusterMark; normalMinutes: number; otMinutes: number }>;
  daysPresent: number;
  normalMinutes: number;
  otMinutes: number;
  spreadoverBreaches: number;
};

export type MusterRoll = {
  month: string;
  daysInMonth: number;
  location: string | null;
  establishment: { name: string | null; factoryLicenceNo: string | null };
  workers: MusterWorker[];
  totals: { workers: number; normalMinutes: number; otMinutes: number; spreadoverBreaches: number; daysRecorded: number };
};

type MusterRow = {
  employee_id: string; employee_code: string; first_name: string; last_name: string; designation: string; gender: string | null;
  attendance_date: string | null; status: string | null; assigned_shift: string | null; productive_minutes: unknown; payable_ot_minutes: unknown; gross_span_minutes: unknown;
};

export function buildMusterRoll(rows: readonly MusterRow[], month: string): Pick<MusterRoll, "workers" | "totals" | "daysInMonth"> {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const workers = new Map<string, MusterWorker>();
  const shifts = new Map<string, Map<string, number>>();
  let daysRecorded = 0;
  for (const row of rows) {
    let worker = workers.get(row.employee_id);
    if (!worker) {
      worker = {
        employeeId: row.employee_id, tokenNo: row.employee_code, name: `${row.first_name} ${row.last_name}`.trim(),
        sex: textOrNull(row.gender), relay: null, natureOfWork: row.designation, days: [], daysPresent: 0, normalMinutes: 0, otMinutes: 0, spreadoverBreaches: 0,
      };
      workers.set(row.employee_id, worker);
    }
    if (!row.attendance_date || !row.status) continue;
    const day = Number(String(row.attendance_date).slice(8, 10));
    const mark = MARKS[row.status] ?? "PEN";
    const normalMinutes = minorOrNull(row.productive_minutes) ?? 0;
    const otMinutes = minorOrNull(row.payable_ot_minutes) ?? 0;
    worker.days.push({ day, mark, normalMinutes, otMinutes });
    daysRecorded += 1;
    if (mark === "P") worker.daysPresent += 1;
    if (mark === "H") worker.daysPresent += 0.5;
    worker.normalMinutes += normalMinutes;
    worker.otMinutes += otMinutes;
    if ((minorOrNull(row.gross_span_minutes) ?? 0) > SPREADOVER_LIMIT_MINUTES) worker.spreadoverBreaches += 1;
    if (row.assigned_shift) {
      const counts = shifts.get(row.employee_id) ?? new Map<string, number>();
      counts.set(row.assigned_shift, (counts.get(row.assigned_shift) ?? 0) + 1);
      shifts.set(row.employee_id, counts);
    }
  }
  for (const worker of workers.values()) {
    worker.days.sort((a, b) => a.day - b.day);
    const counts = shifts.get(worker.employeeId);
    if (counts) worker.relay = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const list = [...workers.values()];
  return {
    daysInMonth,
    workers: list,
    totals: {
      workers: list.length,
      normalMinutes: list.reduce((sum, w) => sum + w.normalMinutes, 0),
      otMinutes: list.reduce((sum, w) => sum + w.otMinutes, 0),
      spreadoverBreaches: list.reduce((sum, w) => sum + w.spreadoverBreaches, 0),
      daysRecorded,
    },
  };
}

export async function loadMusterRoll(access: Access, query: z.infer<typeof musterQuerySchema>): Promise<MusterRoll> {
  enforce(access.context, "compliance.filing.read", { tenantId: access.tenantId });
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const from = `${query.month}-01`;
  const location = query.location ?? null;
  const [rows, entityRows, locationRows] = await tenantTx(access, [
    sqlClient`
      select e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.designation, e.metadata->>'gender' as gender,
        d.attendance_date::text as attendance_date, d.status, d.assigned_shift, d.productive_minutes, d.payable_ot_minutes, d.gross_span_minutes
      from employees e
      left join attendance_days d on d.tenant_id = e.tenant_id and d.employee_id = e.id
        and d.attendance_date >= ${from}::date and d.attendance_date < (${from}::date + interval '1 month')
      where e.tenant_id = ${access.tenantId}
        and e.joining_date < (${from}::date + interval '1 month')
        and (e.status = 'active' or d.id is not null)
        and (${location}::text is null or e.location = ${location})
      order by e.employee_code, d.attendance_date
      limit 20000
    `,
    sqlClient`select legal_name from legal_entities where tenant_id = ${access.tenantId} and status = 'active' order by created_at limit 1`,
    location
      ? sqlClient`select attributes->>'factoryLicenceNo' as licence from locations where tenant_id = ${access.tenantId} and (attributes->>'code' = ${location} or attributes->>'name' = ${location}) limit 1`
      : sqlClient`select null::text as licence where false`,
  ]);
  const built = buildMusterRoll(rows as MusterRow[], query.month);
  return {
    month: query.month,
    location,
    establishment: {
      name: (entityRows as Array<{ legal_name: string }>)[0]?.legal_name ?? null,
      factoryLicenceNo: textOrNull((locationRows as Array<{ licence: string | null }>)[0]?.licence),
    },
    ...built,
  };
}
