import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** SCR-013 — sanctioned strength board over `manpower_plan_lines`. */

export type SanctionedStrengthState = "within_headroom" | "at_limit" | "over_plan";

/**
 * Pure headroom mapping shared by the board contract (unit-tested).
 * Mirrors HEADROOM_STATUS_CASE exactly: a missing/unparsable sanctioned figure
 * behaves as 0 (same as the SQL coalesce), a missing filled figure is treated as
 * "nothing deployed yet" and therefore always sits within headroom.
 */
export function deriveHeadroomState(sanctioned: number | null, filled: number | null): SanctionedStrengthState {
  const plan = typeof sanctioned === "number" && Number.isFinite(sanctioned) ? sanctioned : 0;
  if (filled === null || filled === undefined || typeof filled !== "number" || !Number.isFinite(filled)) {
    return "within_headroom";
  }
  if (filled > plan) return "over_plan";
  if (plan > 0 && filled === plan) return "at_limit";
  return "within_headroom";
}

export type SanctionedStrengthRow = {
  id: string;
  record_code: string;
  organisation: string;
  designation: string;
  location: string;
  worker_class: string | null;
  sanctioned: number;
  filled: number;
  open_requisitions: number;
  headroom: number;
  status: SanctionedStrengthState;
  effective_from: string | null;
  valid_to: string | null;
  approved_by: string | null;
  plan_title: string | null;
};

const REVISE_ACTION = "organization.sanctioned_strength_revise";
const ENTITY_TYPE = "manpower_plan_line";

/** Shared status derivation; the JS twin is deriveHeadroomState. */
const HEADROOM_STATUS_CASE = `case when n.filled > n.sanctioned then 'over_plan'
  when n.sanctioned > 0 and n.filled = n.sanctioned then 'at_limit'
  else 'within_headroom' end`;

/**
 * Counters live in a generic jsonb bag, so every figure is regex-guarded before
 * the cast: a free-text value degrades to 0 instead of aborting the whole board.
 */
const COUNTER_LATERAL = `left join lateral (
  select case when l.attributes->>'sanctioned' ~ '^-?[0-9]+$' then (l.attributes->>'sanctioned')::int else 0 end as sanctioned,
         case when l.attributes->>'filled' ~ '^-?[0-9]+$' then (l.attributes->>'filled')::int else 0 end as filled,
         case when l.attributes->>'open_requisitions' ~ '^-?[0-9]+$' then (l.attributes->>'open_requisitions')::int else 0 end as open_requisitions
) n on true`;

const SANCTIONED_SELECT = `select l.id,
  coalesce(l.attributes->>'record_code', l.id::text) as record_code,
  coalesce(dep.attributes->>'name', dep.attributes->>'title', 'Unassigned') as organisation,
  coalesce(jp.attributes->>'name', jp.attributes->>'title', 'All designations') as designation,
  coalesce(loc.attributes->>'name', loc.attributes->>'title', 'Unassigned') as location,
  l.attributes->>'worker_class' as worker_class,
  n.sanctioned, n.filled, n.open_requisitions,
  (n.sanctioned - n.filled - n.open_requisitions) as headroom,
  (${HEADROOM_STATUS_CASE}) as status,
  l.attributes->>'effective_from' as effective_from,
  l.attributes->>'valid_to' as valid_to,
  l.attributes->>'approved_by' as approved_by,
  coalesce(mp.attributes->>'title', mp.attributes->>'plan_year') as plan_title
from manpower_plan_lines l
left join departments dep on dep.tenant_id = l.tenant_id and dep.id = l.department_id
left join job_profiles jp on jp.tenant_id = l.tenant_id and jp.id = l.job_profile_id
left join locations loc on loc.tenant_id = l.tenant_id and loc.id = l.location_id
left join manpower_plans mp on mp.tenant_id = l.tenant_id and mp.id = l.manpower_plan_id
${COUNTER_LATERAL}`;

/** Plan lines without a sanctioned figure are narrative rows, never board rows. */
const SANCTIONED_PRESENT = `l.attributes->>'sanctioned' is not null`;

export async function listSanctionedStrength(access: Access, search: string): Promise<SanctionedStrengthRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${SANCTIONED_SELECT}
       where l.tenant_id = $1 and ${SANCTIONED_PRESENT}
         and (coalesce(l.attributes->>'record_code', '') || ' ' || coalesce(dep.attributes->>'name', '') || ' ' || coalesce(loc.attributes->>'name', '')) ilike $2
       order by coalesce(l.attributes->>'record_code', l.id::text) asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return rows as SanctionedStrengthRow[];
}

/**
 * One plan line plus a factual cross-check: how many active employees are really
 * deployed against the same department and location today. The count is evidence,
 * not policy, so a failure degrades to null rather than failing the record.
 */
export async function getSanctionedStrengthRecord(access: Access, id: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${SANCTIONED_SELECT} where l.tenant_id = $1 and l.id = $2::uuid and ${SANCTIONED_PRESENT} limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const record = (rows as SanctionedStrengthRow[])[0];
  if (!record) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  let deployed: number | null = null;
  try {
    const [deployedRows] = await tenantTx(access, [
      sqlClient.query(
        `select count(distinct e.id)::int as deployed
         from manpower_plan_lines l
         join employee_assignments a on a.tenant_id = l.tenant_id and a.record_status = 'active'
           and a.department_id = l.department_id and a.location_id = l.location_id
         join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id
         join employees e on e.tenant_id = a.tenant_id and e.id = em.employee_id and e.status = 'active'
         where l.tenant_id = $1 and l.id = $2::uuid`,
        [access.tenantId, id],
      ),
    ]);
    deployed = (deployedRows as Array<{ deployed: number }>)[0]?.deployed ?? 0;
  } catch {
    deployed = null;
  }
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = ${ENTITY_TYPE} and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, deployed, auditTrail };
}

/**
 * Sanctions are revised annually, so a revision restates the validity window along with
 * the figure. validFrom is stored under the effective_from attribute the board already
 * reads - the workbook's valid_from and this record's effective date are one field.
 * The sanction key (org unit, designation, location, worker class) is not revisable:
 * changing it would identify a different sanction, and there is no create path yet.
 */
export const reviseSanctionedStrengthSchema = z.object({
  sanctioned: z.number().int().min(0).max(1000000),
  validFrom: z.iso.date(),
  validTo: z.iso.date(),
  approvalReference: z.string().trim().min(3).max(200),
  reason: z.string().trim().min(3).max(500),
}).refine((input) => input.validFrom <= input.validTo, {
  path: ["validTo"],
  message: "The sanction cannot end before it starts.",
});

/** Revise the sanctioned figure for one plan line; always audited with before/after. */
export async function reviseSanctionedStrength(
  access: Access,
  id: string,
  input: z.infer<typeof reviseSanctionedStrengthSchema>,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes->>'sanctioned' as sanctioned from manpower_plan_lines
      where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const line = (rows as Array<{ id: string; sanctioned: string | null }>)[0];
  if (!line) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const from = line.sanctioned !== null && /^-?[0-9]+$/.test(line.sanctioned) ? Number(line.sanctioned) : null;
  const approvedBy = access.context.actorUserId;
  await tenantTx(access, [
    sqlClient`
      update manpower_plan_lines
      set attributes = attributes || jsonb_build_object(
            'sanctioned', ${input.sanctioned}::int,
            'effective_from', ${input.validFrom}::text,
            'valid_to', ${input.validTo}::text,
            'approval_reference', ${input.approvalReference}::text,
            'approved_by', ${approvedBy}::text
          ),
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${REVISE_ACTION}, ${ENTITY_TYPE}, ${id}, ${input.reason},
        ${JSON.stringify({ sanctioned: from })}::jsonb,
        ${JSON.stringify({ sanctioned: input.sanctioned, validFrom: input.validFrom, validTo: input.validTo, approvalReference: input.approvalReference, approvedBy })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from, to: input.sanctioned };
}
