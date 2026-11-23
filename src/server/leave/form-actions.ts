import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { decideLeave, recordEarlyReturn } from "./service";
import { assertEarlyReturnOpen } from "./request-guards";
import { actsForOthers } from "./workspace";

/**
 * Handlers for the two leave forms of the generic action launcher, which only
 * know the employee by name or code (no request id): "Decide leave request"
 * (leaveDecision) and "Plan employee return" (returnPlan). Each resolves the
 * one request the form refers to and refuses, with the reason, when that is
 * not exactly one — it never picks a request on the user's behalf.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const leaveDecisionFormSchema = z.object({
  requestId: z.string().uuid().optional(),
  employee: z.string().trim().min(1, "Employee is required.").max(120),
  decision: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(["approve", "reject"], { message: "Decision must be Approve or Reject." }),
  ),
  remarks: z.string().trim().min(3, "Decision remarks need at least 3 characters.").max(1000),
});

export const returnPlanFormSchema = z.object({
  requestId: z.string().uuid().optional(),
  employee: z.string().trim().min(1, "Employee is required.").max(120),
  returnDate: z.string().regex(ISO_DATE, "Return date must be a date (YYYY-MM-DD)."),
  checklist: z.string().trim().min(3, "Return checklist needs at least 3 characters.").max(2000),
  owner: z.string().trim().min(1, "Plan owner is required.").max(120),
  notes: z.string().trim().max(2000).optional(),
});

type Candidate = { id: string; starts_on: string; ends_on: string; status: string; actual_return_date: string | null };

/** Picks the single request a form refers to (unit-tested); explains 0 or many. */
export function pickSingleRequest(candidates: Candidate[], employee: string, purpose: "decision" | "return"): Candidate {
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length === 0) {
    throw new HttpError({
      status: 404,
      code: "NOT_FOUND",
      message:
        purpose === "decision"
          ? `No leave request awaiting a decision was found for "${employee}".`
          : `No approved leave covering that return date was found for "${employee}".`,
      details: [{ field: "employee", issue: "no_match" }],
    });
  }
  throw new HttpError({
    status: 409,
    code: "AMBIGUOUS_REFERENCE",
    message: `${candidates.length} matching leave requests were found for "${employee}". Decide from the leave approvals list instead.`,
    details: [{ field: "employee", issue: "ambiguous" }],
  });
}

async function findCandidates(access: Access, employee: string, where: string, extra: unknown[]): Promise<Candidate[]> {
  const like = `%${employee.replace(/[%_]/g, "").slice(0, 120)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select r.id, r.starts_on::text as starts_on, r.ends_on::text as ends_on, r.status,
          r.actual_return_date::text as actual_return_date
        from leave_requests r
        join employees emp on emp.tenant_id = r.tenant_id and emp.id = r.employee_id
        where r.tenant_id = $1
          and (emp.employee_code = $2 or emp.id::text = $2
               or trim(emp.first_name || ' ' || emp.last_name) ilike $3)
          and ${where}
        order by r.starts_on desc
        limit 10`,
      [access.tenantId, employee.trim(), like, ...extra],
    ),
  ]);
  return rows as Candidate[];
}

export async function decideLeaveFromForm(
  access: Access,
  input: z.infer<typeof leaveDecisionFormSchema>,
  requestId: string,
): Promise<{ id: string; status: string }> {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const targetId = input.requestId
    ?? pickSingleRequest(await findCandidates(access, input.employee, "lower(r.status) like 'pending%'", []), input.employee, "decision").id;
  return decideLeave(access, targetId, input.decision === "approve", input.remarks, requestId);
}

export async function planEmployeeReturn(
  access: Access,
  input: z.infer<typeof returnPlanFormSchema>,
  requestId: string,
): Promise<{ id: string; earlyReturn: boolean; leaveDaysCreditedBack: number | null }> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (!actsForOthers(access)) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This action is not permitted for the current role." });
  }
  const request = input.requestId
    ? { id: input.requestId }
    : pickSingleRequest(
        await findCandidates(
          access,
          input.employee,
          "r.status = 'approved' and r.actual_return_date is null and r.starts_on <= $4::date and r.ends_on + 1 >= $4::date",
          [input.returnDate],
        ),
        input.employee,
        "return",
      );
  const [rows] = await tenantTx(access, [
    sqlClient`select ends_on::text as ends_on, status from leave_requests where tenant_id = ${access.tenantId} and id = ${request.id} limit 1`,
  ]);
  const found = (rows as Array<{ ends_on: string; status: string }>)[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  // Returning before the last approved day is an early return: the ledger re-credit goes through the leave service.
  let credited: number | null = null;
  const earlyReturn = input.returnDate <= found.ends_on;
  if (earlyReturn) {
    await assertEarlyReturnOpen(access, request.id);
    const result = await recordEarlyReturn(access, request.id, { actualReturnDate: input.returnDate }, requestId);
    credited = Number((result as { leaveDaysCreditedBack?: number }).leaveDaysCreditedBack ?? 0);
  }

  const plan = { return_date: input.returnDate, checklist: input.checklist, owner: input.owner, notes: input.notes ?? null };
  await tenantTx(access, [
    sqlClient`update leave_requests set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ return_plan: plan })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${request.id}`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.return_plan', 'leave_request', ${request.id}, 'Return plan recorded', ${JSON.stringify(plan)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id: request.id, earlyReturn, leaveDaysCreditedBack: credited };
}
