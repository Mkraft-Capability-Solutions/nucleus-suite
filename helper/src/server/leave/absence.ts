import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { addDays, combinationConflict, type LeaveScheme } from "./scheme";

/**
 * RL-11's contiguous-absence check, and the overlap guard that was missing
 * beside it.
 *
 * The restriction was previously evaluated against the types inside one
 * application — and `requestLeave` submits a single-element array, so the branch
 * could never fire. The rule is explicit that it must not work that way: "the
 * check must run across a contiguous absence, INCLUDING WHERE THE TWO LEAVE
 * TYPES ARE APPLIED FOR SEPARATELY". 2 CL on 10-11 June followed by 3 EL on
 * 12-14 June is one absence and is blocked, whatever order the two applications
 * arrive in.
 *
 * Nothing here decides which pairs conflict; that comes from the scheme, which
 * reads `leave_types.cannot_combine_with` and the configuration's `excluded_with`.
 */

/** Requests that still hold days. A rejected or cancelled request is not an absence. */
const LIVE_STATUSES = ["pending_supervisor", "pending_hod", "pending_hr", "approved"];

export type NeighbouringAbsence = {
  id: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  status: string;
  /** How it meets the requested period. */
  relation: "overlaps" | "ends_the_day_before" | "starts_the_day_after";
};

/**
 * Every live request that overlaps the period or sits immediately either side of
 * it. One query does both jobs: an overlap is a double booking, a neighbour is
 * the other half of a contiguous absence.
 */
export async function neighbouringAbsences(
  access: Access,
  args: { employeeId: string; startsOn: string; endsOn: string; excludeRequestId?: string | null },
): Promise<NeighbouringAbsence[]> {
  const dayBefore = addDays(args.startsOn, -1);
  const dayAfter = addDays(args.endsOn, 1);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select r.id, coalesce(r.leave_type, '') as "leaveType", r.starts_on::text as "startsOn",
          r.ends_on::text as "endsOn", coalesce(r.status, '') as status
        from leave_requests r
        where r.tenant_id = $1 and r.employee_id = $2::uuid
          and lower(coalesce(r.status, '')) = any($3::text[])
          and ($4::uuid is null or r.id <> $4::uuid)
          and r.starts_on <= $6::date and r.ends_on >= $5::date
        order by r.starts_on asc
        limit 200`,
      [access.tenantId, args.employeeId, LIVE_STATUSES, args.excludeRequestId ?? null, dayBefore, dayAfter],
    ),
  ]);
  return (rows as Array<Omit<NeighbouringAbsence, "relation">>).map((row) => ({
    ...row,
    relation:
      row.startsOn <= args.endsOn && row.endsOn >= args.startsOn
        ? "overlaps"
        : row.endsOn === dayBefore
          ? "ends_the_day_before"
          : "starts_the_day_after",
  }));
}

/**
 * Refuses a request that double-books days already applied for, or that would
 * extend a contiguous absence with a leave type the scheme forbids beside it.
 */
export async function assertAbsenceIsPermitted(
  access: Access,
  scheme: LeaveScheme,
  args: { employeeId: string; leaveType: string; startsOn: string; endsOn: string; excludeRequestId?: string | null },
): Promise<void> {
  const neighbours = await neighbouringAbsences(access, args);

  const overlap = neighbours.find((neighbour) => neighbour.relation === "overlaps");
  if (overlap) {
    throw new HttpError({
      status: 409,
      code: "POLICY_VIOLATION",
      message: `${overlap.startsOn} to ${overlap.endsOn} is already applied for as ${overlap.leaveType} (${overlap.status}). The same days cannot be applied for twice.`,
      details: [{ field: "startsOn", issue: `Overlaps leave request ${overlap.id}.` }],
    });
  }

  const conflict = neighbours.find(
    (neighbour) => neighbour.relation !== "overlaps" && combinationConflict(scheme, args.leaveType, neighbour.leaveType),
  );
  if (conflict) {
    const side = conflict.relation === "ends_the_day_before" ? "immediately before" : "immediately after";
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `${args.leaveType} cannot be combined with ${conflict.leaveType}. ${conflict.leaveType} on ${conflict.startsOn} to ${conflict.endsOn} falls ${side} this period, so the two form one contiguous absence even though they are separate applications.`,
      details: [{ field: "leaveType", issue: `Contiguous with leave request ${conflict.id} (${conflict.leaveType}).` }],
    });
  }
}
