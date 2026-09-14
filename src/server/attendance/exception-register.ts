import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Audit actions this register writes. Constants so the routes, the service and
 * the tests all name the same string. */
export const EXCEPTION_ACCEPT_ACTION = "attendance.exception_accept";
export const EXCEPTION_RESOLVE_ACTION = "attendance.exception_resolve";
const EXCEPTION_ENTITY_TYPE = "attendance_exception";

export type ExceptionState = "open" | "proposed" | "resolved" | "rejected";

/**
 * Pure queue state for one attendance exception (unit-tested).
 *
 * The stored status wins: an exception the time office has already closed
 * (resolved / regularized / closed) reads as resolved and a rejected one reads
 * as rejected, whatever else is attached. Only an exception that is still open
 * can be lifted to `proposed`, and that happens solely because a real
 * regularization proposal exists for the same employee and date.
 */
export function deriveExceptionState(
  storedStatus: string | null | undefined,
  hasProposal: boolean,
): ExceptionState {
  const normalized = (storedStatus ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["resolved", "regularized", "closed", "approved"].includes(normalized)) return "resolved";
  if (["rejected", "declined"].includes(normalized)) return "rejected";
  if (hasProposal) return "proposed";
  return "open";
}

/**
 * Whole days between the exception's date and today (unit-tested).
 *
 * Returns null when the date is missing or not an ISO calendar date — an
 * unknown age is never rendered as zero. The result is deliberately NOT clamped
 * at zero: a dated-forward exception returns a negative number so the screen can
 * show that the exception sits in the future rather than pretending it is new.
 */
export function ageInDays(date: string | null | undefined, today = new Date().toISOString().slice(0, 10)): number | null {
  const iso = (date ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const then = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.round((now - then) / 86_400_000);
}

export type ExceptionRow = {
  id: string;
  exception_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  kind: string;
  severity: string | null;
  detail: string | null;
  proposal: string | null;
  resolution_action: string | null;
  amended_value: string | null;
  age_days: number | null;
  status: ExceptionState;
};

type ExceptionQueryRow = {
  id: string;
  exception_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  kind: string;
  severity: string | null;
  detail: string | null;
  proposal: string | null;
  resolution_action: string | null;
  amended_value: string | null;
  stored_status: string | null;
};

/**
 * The exception reference is its own key: a stored reference when the source
 * system supplied one, otherwise the short form of the row id. The employee code
 * and the date are deliberately NOT reused here — they already have their own
 * columns on the screen.
 */
const EXCEPTION_SELECT = `select x.id,
    coalesce(nullif(x.attributes->>'exception_reference', ''), nullif(x.attributes->>'exception_id', ''),
             nullif(x.attributes->>'reference', ''), left(x.id::text, 8)) as exception_reference,
    x.employee_id,
    emp.employee_code,
    case when emp.id is null then null
         else nullif(trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')), '') end as employee_name,
    x.attributes->>'date' as date,
    coalesce(nullif(x.attributes->>'exception_type', ''), nullif(x.attributes->>'kind', ''), '') as kind,
    nullif(x.attributes->>'severity', '') as severity,
    nullif(x.attributes->>'resolution_action', '') as resolution_action,
    nullif(x.attributes->>'amended_value', '') as amended_value,
    x.attributes->>'detail' as detail,
    (select nullif(trim(concat_ws(', ',
              case when coalesce(r.attributes->>'claimed_in', r.attributes->>'requested_punch_in', '') <> ''
                   then 'In ' || coalesce(r.attributes->>'claimed_in', r.attributes->>'requested_punch_in') end,
              case when coalesce(r.attributes->>'claimed_out', r.attributes->>'requested_punch_out', '') <> ''
                   then 'Out ' || coalesce(r.attributes->>'claimed_out', r.attributes->>'requested_punch_out') end)), '')
       from attendance_regularizations r
       left join attendance_entries ent on ent.tenant_id = r.tenant_id and ent.id = r.attendance_entry_id
       where r.tenant_id = x.tenant_id
         and coalesce(r.attributes->>'employee_id', ent.employee_id::text, '') = x.employee_id::text
         and coalesce(r.attributes->>'date', ent.attributes->>'date', '') = coalesce(x.attributes->>'date', '')
       order by r.created_at desc limit 1) as proposal,
    coalesce(x.attributes->>'status', '') as stored_status
  from attendance_exceptions x
  left join employees emp on emp.tenant_id = x.tenant_id and emp.id = x.employee_id`;

function projectException(row: ExceptionQueryRow, today?: string): ExceptionRow {
  const { stored_status: storedStatus, ...rest } = row;
  return {
    ...rest,
    age_days: ageInDays(row.date, today),
    status: deriveExceptionState(storedStatus, row.proposal !== null && row.proposal !== ""),
  };
}

/** SCR-025 queue: every recorded attendance exception with its proposal and age. */
export async function listExceptionRegister(access: Access, search: string): Promise<ExceptionRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${EXCEPTION_SELECT}
       where x.tenant_id = $1
         and ($2 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(x.attributes->>'exception_type', '')) ilike $2)
       order by coalesce(x.attributes->>'date', '') desc, x.created_at desc
       limit 200`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as ExceptionQueryRow[]).map((row) => projectException(row));
}

async function loadException(access: Access, id: string): Promise<ExceptionQueryRow> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${EXCEPTION_SELECT} where x.tenant_id = $1 and x.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as ExceptionQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return found;
}

/**
 * One exception with the attendance day it disputes, the punches actually
 * recorded that day and its audit trail. Both the day and the punch list are
 * empty when the source rows genuinely do not exist — nothing is reconstructed.
 */
export async function getExceptionRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const found = await loadException(access, id);
  const record = projectException(found);

  const [dayRows, punchRows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.attributes->>'date' as date, a.attributes->>'day' as day,
             a.attributes->>'day_type' as day_type, a.attributes->>'status' as status,
             a.attributes->>'shift_assigned' as shift_assigned, a.attributes->>'shift_applied' as shift_applied,
             a.attributes->>'first_in' as first_in, a.attributes->>'last_out' as last_out,
             a.attributes->>'gross_minutes' as gross_minutes, a.attributes->>'break_minutes' as break_minutes,
             a.attributes->>'gate_pass_minutes' as gate_pass_minutes
      from attendance_entries a
      join attendance_exceptions x2 on x2.tenant_id = a.tenant_id and x2.id = ${id}
      where a.tenant_id = ${access.tenantId}
        and (a.id = x2.attendance_entry_id
             or (a.employee_id = x2.employee_id and a.attributes->>'date' = x2.attributes->>'date'))
      limit 1
    `,
    sqlClient`
      select ev.id, ev.attributes->>'event_id' as event_id, ev.attributes->>'time' as time,
             ev.attributes->>'direction' as direction, ev.attributes->>'device' as device,
             ev.attributes->>'punch_date' as punch_date, ev.attributes->>'note' as note
      from attendance_events ev
      where ev.tenant_id = ${access.tenantId} and ev.employee_id = ${found.employee_id}
        and coalesce(ev.attributes->>'attendance_date', ev.attributes->>'punch_date') = ${found.date ?? ""}
      order by ev.attributes->>'time' asc
      limit 100
    `,
  ]);

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = ${EXCEPTION_ENTITY_TYPE} and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return {
    record,
    day: (dayRows as Array<Record<string, unknown>>)[0] ?? null,
    punches: punchRows as Array<Record<string, unknown>>,
    auditTrail,
  };
}

export const acceptProposalSchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * Accepts the regularization proposal attached to an exception. The proposal
 * text is copied onto the exception so the decision keeps its evidence; no
 * attendance figure is recalculated here.
 */
export async function acceptExceptionProposal(access: Access, id: string, reason: string, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const found = await loadException(access, id);
  const state = deriveExceptionState(found.stored_status, found.proposal !== null && found.proposal !== "");
  if (state === "resolved" || state === "rejected") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: `This exception is already ${state} and cannot accept a proposal.`,
    });
  }
  if (!found.proposal) {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "There is no proposed correction on this exception to accept.",
    });
  }
  const after = { status: "resolved", accepted_proposal: found.proposal, resolution: "Proposal accepted" };
  await tenantTx(access, [
    sqlClient`update attendance_exceptions set attributes = attributes || ${JSON.stringify(after)}::jsonb,
      updated_at = now() where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${EXCEPTION_ACCEPT_ACTION}, ${EXCEPTION_ENTITY_TYPE}, ${id}, ${reason},
        ${JSON.stringify({ status: found.stored_status ?? "" })}::jsonb,
        ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: state, to: "resolved" as const, proposal: found.proposal };
}

export const resolveExceptionSchema = z
  .object({
    action: z.enum(picklistValues("PL_EXCEPTION_ACTION")),
    amendedValue: z.string().trim().min(1).max(100).optional(),
    reason: z.string().trim().min(10).max(500),
    bulkApply: z.boolean().optional(),
    /**
     * The other exceptions the same decision covers. The workbook allows a bulk
     * apply only across one exception type with one reason, so the selection is
     * explicit rather than inferred from a filter.
     */
    bulkIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .refine((input) => input.action !== "amend" || input.amendedValue !== undefined, {
    path: ["amendedValue"],
    message: "An amendment must carry the amended value.",
  })
  .refine((input) => !input.bulkApply || (input.bulkIds !== undefined && input.bulkIds.length > 0), {
    path: ["bulkIds"],
    message: "A bulk apply must name the exceptions it covers.",
  });

/** The stored status each resolution action settles the exception into. */
const EXCEPTION_ACTION_STATUS: Record<string, string> = {
  accept_proposal: "resolved",
  amend: "resolved",
  reject: "rejected",
  // An escalated exception is still unsettled; it reads as open until someone closes it.
  escalate: "escalated",
};

/** Closes (or escalates) one exception with an explicit written reason. */
export async function resolveException(
  access: Access,
  id: string,
  input: z.infer<typeof resolveExceptionSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const primary = await loadException(access, id);
  const state = deriveExceptionState(primary.stored_status, primary.proposal !== null && primary.proposal !== "");
  if (state === "resolved") {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This exception is already resolved." });
  }
  if (input.action === "accept_proposal" && !primary.proposal) {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "There is no proposed correction on this exception to accept.",
    });
  }

  // Every record the one decision covers, the selected exception first. A bulk
  // apply is refused across exception types: the workbook allows it only for the
  // same type with the same reason.
  const targets = [primary];
  for (const extraId of input.bulkApply ? (input.bulkIds ?? []).filter((other) => other !== id) : []) {
    const extra = await loadException(access, extraId);
    if (extra.kind !== primary.kind) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "A bulk resolution may only cover exceptions of the same type.",
      });
    }
    if (deriveExceptionState(extra.stored_status, extra.proposal !== null && extra.proposal !== "") === "resolved") {
      throw new HttpError({
        status: 409,
        code: "WORKFLOW_CONFLICT",
        message: "One of the selected exceptions is already resolved.",
      });
    }
    targets.push(extra);
  }

  const status = EXCEPTION_ACTION_STATUS[input.action] ?? "resolved";
  // One update and one audit row per record, so a bulk decision still leaves an
  // individual trail on every exception it touched.
  await tenantTx(access, targets.flatMap((target) => {
    const after = {
      status,
      resolution_action: input.action,
      resolution: input.reason,
      amended_value: input.action === "amend" ? (input.amendedValue ?? null) : null,
      ...(input.action === "accept_proposal" && target.proposal ? { accepted_proposal: target.proposal } : {}),
      bulk_apply: input.bulkApply ?? false,
    };
    return [
      sqlClient`update attendance_exceptions set attributes = attributes || ${JSON.stringify(after)}::jsonb,
        updated_at = now() where tenant_id = ${access.tenantId} and id = ${target.id}`,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          ${EXCEPTION_RESOLVE_ACTION}, ${EXCEPTION_ENTITY_TYPE}, ${target.id}, ${input.reason},
          ${JSON.stringify({ status: target.stored_status ?? "" })}::jsonb,
          ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ];
  }));
  return { id, from: state, to: status, action: input.action, applied: targets.length };
}
