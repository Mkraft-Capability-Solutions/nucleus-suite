import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { resolveAttendanceScope } from "@/server/attendance/service";

/**
 * Audit action names are held as constants rather than inline SQL literals so
 * the SQL contract tests never read `attendance.overtime_approve` as a table
 * alias reference.
 */
export const OVERTIME_APPROVE_ACTION = "attendance.overtime_approve";
export const OVERTIME_TAG_RUN_ACTION = "attendance.overtime_tag_run";

const OVERTIME_ENTITY_TYPE = "overtime_entry";

export type OvertimeState = "pending_approval" | "approved" | "tagged_to_run" | "paid";

/**
 * Stored placeholders that record an absence rather than a value. The imported
 * rows write "Not paid" into `pay_in_run` for overtime settled as comp-off, and
 * "-" where nothing was recorded; neither is a payroll run tag.
 */
const ABSENT_MARKERS = new Set(["", "-", "—", "–", "none", "n/a", "na", "not paid", "not tagged", "not raised", "null"]);

function storedValue(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && !ABSENT_MARKERS.has(trimmed.toLowerCase()) ? trimmed : null;
}

/**
 * Pure lifecycle mapping for one overtime entry (unit-tested). Payment is the
 * strongest evidence, then a payroll run tag, then an approval date; without
 * any of those the entry is still awaiting approval.
 */
export function deriveOvertimeState(
  approvedOn: string | null,
  payRun: string | null,
  paidRunId: string | null,
): OvertimeState {
  if (storedValue(paidRunId)) return "paid";
  if (storedValue(payRun)) return "tagged_to_run";
  if (storedValue(approvedOn)) return "approved";
  return "pending_approval";
}

/**
 * Pure `H:MM` rendering of an overtime duration (unit-tested). Absent, zero and
 * unusable minute counts render as an em dash rather than "0:00", because no
 * payable overtime arose at all.
 */
export function formatOvertimeHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const total = Math.trunc(Math.abs(minutes));
  if (total <= 0) return "—";
  return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The stored `ot_hours` label when one was recorded, otherwise the derived one. */
export function overtimeLabel(storedHours: string | null | undefined, minutes: number | null | undefined): string {
  return storedValue(storedHours) ?? formatOvertimeHours(minutes);
}

export type OvertimeRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  date: string | null;
  overtime_minutes: number | null;
  overtime_minutes_raw: number | null;
  overtime_label: string;
  multiplier: string | null;
  reduction_reason: string | null;
  weekly_cap_status: string | null;
  eligibility_basis: string | null;
  day_type: string | null;
  pay_run: string | null;
  approved_by: string | null;
  approved_on: string | null;
  record_reference: string | null;
  status: OvertimeState;
};

type OvertimeQueryRow = Omit<OvertimeRow, "overtime_label" | "status"> & {
  stored_hours: string | null;
  paid_payroll_run_id: string | null;
  attendance_entry_id: string | null;
};

const NUMERIC = `~ '^-?[0-9]+$'`;

// The per-entry multiplier is the stored one; when an entry does not carry it,
// the value falls back to the one stored on its own overtime policy. It is
// never composed here.
const OVERTIME_SELECT = `select ot.id,
    ot.employee_id,
    coalesce(e.employee_code, '') as employee_code,
    trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as employee_name,
    ot.attributes->>'ot_date' as date,
    -- The payable figure is the approver's, the raw one is the engine's; an entry
    -- carrying only one of them reads the same value into both columns.
    case when coalesce(ot.attributes->>'ot_minutes_payable', ot.attributes->>'ot_minutes', '') ${NUMERIC}
         then coalesce(ot.attributes->>'ot_minutes_payable', ot.attributes->>'ot_minutes')::int end as overtime_minutes,
    case when coalesce(ot.attributes->>'ot_minutes_raw', ot.attributes->>'ot_minutes', '') ${NUMERIC}
         then coalesce(ot.attributes->>'ot_minutes_raw', ot.attributes->>'ot_minutes')::int end as overtime_minutes_raw,
    ot.attributes->>'reduction_reason' as reduction_reason,
    ot.attributes->>'weekly_ot_cap_status' as weekly_cap_status,
    ot.attributes->>'ot_hours' as stored_hours,
    coalesce(ot.attributes->>'rate_multiplier', pol.attributes->>'rate_multiplier') as multiplier,
    ot.attributes->>'eligibility_basis' as eligibility_basis,
    ot.attributes->>'day_type' as day_type,
    ot.attributes->>'pay_in_run' as pay_run,
    ot.attributes->>'approved_by' as approved_by,
    ot.attributes->>'approved_on' as approved_on,
    ot.attributes->>'ot_record' as record_reference,
    ot.paid_payroll_run_id::text as paid_payroll_run_id,
    ot.attendance_entry_id::text as attendance_entry_id
  from overtime_entries ot
  left join employees e on e.tenant_id = ot.tenant_id and e.id = ot.employee_id
  left join overtime_policies pol on pol.tenant_id = ot.tenant_id and pol.id = ot.overtime_policy_id`;

function project(row: OvertimeQueryRow): OvertimeRow {
  const { stored_hours: storedHours, paid_payroll_run_id: paidRunId, attendance_entry_id: _link, ...rest } = row;
  void _link;
  return {
    ...rest,
    overtime_label: overtimeLabel(storedHours, rest.overtime_minutes),
    status: deriveOvertimeState(rest.approved_on, rest.pay_run, paidRunId),
  };
}

/**
 * Overtime approval and payroll-tagging queue, limited to the caller's scope.
 *
 * The workbook's filter row (location, org unit, period) is applied here: an
 * empty filter means "everything in scope", never a guessed default period.
 */
export async function listOvertimeRegister(
  access: Access,
  args: { search: string; location: string | null; orgUnit: string | null; period: string | null },
): Promise<OvertimeRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const trim = (value: string | null) => (value && value.trim() !== "" ? value.trim().slice(0, 80) : null);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${OVERTIME_SELECT}
       where ot.tenant_id = $1 and ot.employee_id = any($2::uuid[])
         and ($3 = '%%' or (coalesce(e.employee_code, '') || ' ' || coalesce(e.first_name, '')
              || ' ' || coalesce(e.last_name, '') || ' ' || coalesce(ot.attributes->>'ot_record', '')
              || ' ' || coalesce(ot.attributes->>'pay_in_run', '')) ilike $3)
         and ($4::text is null or e.location = $4::text)
         and ($5::text is null or e.department = $5::text)
         and ($6::text is null or left(coalesce(ot.attributes->>'ot_date', ''), 7) = $6::text)
       order by coalesce(ot.attributes->>'ot_date', '') desc, ot.created_at desc
       limit 200`,
      [access.tenantId, scope.employeeIds, like, trim(args.location), trim(args.orgUnit), trim(args.period)],
    ),
  ]);
  return (rows as OvertimeQueryRow[]).map(project);
}

async function loadOvertime(access: Access, id: string): Promise<{ row: OvertimeRow; attendanceEntryId: string | null }> {
  const scope = await resolveAttendanceScope(access);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${OVERTIME_SELECT} where ot.tenant_id = $1 and ot.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const found = (rows as OvertimeQueryRow[])[0];
  if (!found || !scope.employeeIds.includes(found.employee_id)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  return { row: project(found), attendanceEntryId: found.attendance_entry_id ?? null };
}

/** One overtime entry with the attendance day it was earned on and its audit trail. */
export async function getOvertimeRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const { row: record, attendanceEntryId } = await loadOvertime(access, id);

  // The attendance day the overtime was earned on, so an approver sees the
  // evidence next to the claim. Null when the entry is not linked to one.
  let day: Record<string, unknown> | null = null;
  if (attendanceEntryId) {
    const [dayRows] = await tenantTx(access, [
      sqlClient`
        select ae.id, ae.record_status, ae.attributes, ae.created_at::text as created_at
        from attendance_entries ae
        where ae.tenant_id = ${access.tenantId} and ae.id = ${attendanceEntryId} limit 1
      `,
    ]);
    day = (dayRows as Array<Record<string, unknown>>)[0] ?? null;
  }

  // The statutory weekly cap is a configured figure on the overtime policy. When no
  // policy carries one the check reports `null` — a cap is never assumed here, and a
  // breach is flagged rather than blocking the approval.
  let weeklyCap: { minutesInWeek: number; capMinutes: number | null; status: string | null } | null = null;
  if (record.date) {
    const [capRows] = await tenantTx(access, [
      sqlClient`
        select coalesce(sum(case when coalesce(peer.attributes->>'ot_minutes_payable', peer.attributes->>'ot_minutes', '') ~ '^-?[0-9]+$'
                                 then coalesce(peer.attributes->>'ot_minutes_payable', peer.attributes->>'ot_minutes')::int else 0 end), 0)::int as minutes_in_week,
               (select case when coalesce(pol.attributes->>'weekly_cap_minutes', '') ~ '^[0-9]+$'
                            then (pol.attributes->>'weekly_cap_minutes')::int end
                  from overtime_entries self
                  join overtime_policies pol on pol.tenant_id = self.tenant_id and pol.id = self.overtime_policy_id
                  where self.tenant_id = ${access.tenantId} and self.id = ${id}) as cap_minutes
        from overtime_entries peer
        where peer.tenant_id = ${access.tenantId} and peer.employee_id = ${record.employee_id}
          and peer.attributes->>'ot_date' ~ '^\\d{4}-\\d{2}-\\d{2}$'
          and date_trunc('week', (peer.attributes->>'ot_date')::date) = date_trunc('week', ${record.date}::date)
      `,
    ]);
    const row = (capRows as Array<{ minutes_in_week: number; cap_minutes: number | null }>)[0];
    const minutesInWeek = row?.minutes_in_week ?? 0;
    const capMinutes = row?.cap_minutes ?? null;
    weeklyCap = {
      minutesInWeek,
      capMinutes,
      status: capMinutes === null ? null : minutesInWeek > capMinutes ? "breach" : "within_limit",
    };
  }

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = ${OVERTIME_ENTITY_TYPE} and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, day, weeklyCap, auditTrail };
}

/** The actor's employee code, matching how approvals are recorded on the rows. */
async function actorReference(access: Access): Promise<string> {
  const employeeId = access.context.employeeId;
  if (!employeeId) return access.context.actorUserId;
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_code from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  return (rows as Array<{ employee_code: string }>)[0]?.employee_code ?? access.context.actorUserId;
}

/** Today in the tenant's own timezone; an approval date is never taken from the client. */
async function tenantToday(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select ((now() at time zone coalesce((select t.timezone from tenants t where t.id = ${access.tenantId}), 'Asia/Kolkata'))::date)::text as today`,
  ]);
  return ((rows as Array<{ today: string }>)[0]?.today ?? "").slice(0, 10);
}

export const approveOvertimeSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    /** The minutes actually sent to payroll. Absent means the raw figure stands. */
    payableMinutes: z.number().int().min(0).max(100_000).optional(),
    reductionReason: z.string().trim().min(10).max(200).optional(),
  })
  .refine((input) => input.payableMinutes === undefined || input.reductionReason !== undefined, {
    path: ["reductionReason"],
    message: "A reduction must state why the payable minutes were cut.",
  });

/**
 * Records the overtime approval.
 *
 * The engine's raw minutes and the rule pack's multiplier are stored values and
 * are never recomputed here. The approver may nevertheless cut the payable
 * minutes — never raise them — and that cut is an explicit, reasoned override
 * recorded as a delta, not a recalculation.
 */
export async function approveOvertime(
  access: Access,
  id: string,
  input: z.infer<typeof approveOvertimeSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const { row } = await loadOvertime(access, id);
  if (row.status !== "pending_approval") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: `This overtime entry is already ${row.status.replace(/_/g, " ")}.`,
    });
  }
  if (input.payableMinutes !== undefined) {
    if (row.overtime_minutes_raw === null) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "This entry carries no raw overtime minutes, so the payable figure cannot be measured against them.",
      });
    }
    if (input.payableMinutes > row.overtime_minutes_raw) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "Payable overtime may be reduced below the raw minutes, never raised above them.",
      });
    }
  }
  const approvedBy = await actorReference(access);
  const approvedOn = await tenantToday(access);
  const before = {
    approved_on: row.approved_on,
    approved_by: row.approved_by,
    ...(input.payableMinutes === undefined ? {} : { ot_minutes_payable: row.overtime_minutes }),
  };
  const after = {
    approved_on: approvedOn,
    approved_by: approvedBy,
    ...(input.payableMinutes === undefined
      ? {}
      : { ot_minutes_payable: input.payableMinutes, reduction_reason: input.reductionReason ?? null }),
  };
  await tenantTx(access, [
    sqlClient`update overtime_entries set attributes = attributes || ${JSON.stringify(after)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${OVERTIME_APPROVE_ACTION}, ${OVERTIME_ENTITY_TYPE}, ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: row.status, to: "approved" as const, approvedOn, approvedBy, payableMinutes: input.payableMinutes ?? row.overtime_minutes };
}

export const tagPayRunSchema = z.object({
  payRun: z.string().trim().min(3).max(60),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Tags an approved overtime entry to the payroll run that will pay it. A paid
 * entry is immutable here — the payment is the settled fact.
 */
export async function tagOvertimePayRun(
  access: Access,
  id: string,
  input: z.infer<typeof tagPayRunSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const { row } = await loadOvertime(access, id);
  if (row.status === "paid") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "This overtime entry is already paid and cannot be retagged.",
    });
  }
  const before = { pay_in_run: row.pay_run };
  const after = { pay_in_run: input.payRun };
  await tenantTx(access, [
    sqlClient`update overtime_entries set attributes = attributes || ${JSON.stringify(after)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${OVERTIME_TAG_RUN_ACTION}, ${OVERTIME_ENTITY_TYPE}, ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: row.status, to: "tagged_to_run" as const, payRun: input.payRun };
}
