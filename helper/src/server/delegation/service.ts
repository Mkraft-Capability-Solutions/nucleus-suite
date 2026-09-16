import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const createDelegationSchema = z.object({
  delegateMembershipId: z.string().uuid(),
  scopes: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  validFrom: z.string().datetime({ offset: true }),
  validTo: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(1).max(300),
}).superRefine((value, context) => {
  if (Date.parse(value.validTo) <= Date.parse(value.validFrom)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The delegation window ends before it starts." });
  }
});

export async function createDelegation(access: Access, input: z.infer<typeof createDelegationSchema>, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  if (input.delegateMembershipId === access.context.membershipId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Delegation to self is meaningless." });
  }
  if (Date.parse(input.validTo) <= Date.parse(input.validFrom)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The delegation window ends before it starts." });
  }
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id from memberships where tenant_id = ${access.tenantId} and id = ${input.delegateMembershipId} and status = 'active' limit 1`,
  ]);
  if ((memberRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The delegate membership was not found." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into delegation_windows (id, tenant_id, delegator_membership_id, delegate_membership_id, permission_ceiling, reason, valid_from, valid_to)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${input.delegateMembershipId}, ${input.scopes}, ${input.reason}, ${input.validFrom}, ${input.validTo})
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'delegation.grant', 'delegation_window', ${id}, 'Delegation granted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function revokeDelegation(access: Access, delegationId: string, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, revoked_at from delegation_windows where tenant_id = ${access.tenantId} and id = ${delegationId} limit 1`,
  ]);
  const delegation = (rows as Array<{ id: string; revoked_at: string | null }>)[0];
  if (!delegation) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (delegation.revoked_at) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The delegation is already revoked." });
  await tenantTx(access, [
    sqlClient`update delegation_windows set revoked_at = now() where id = ${delegationId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'delegation.revoke', 'delegation_window', ${delegationId}, 'Delegation revoked', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: delegationId, revoked: true };
}

export async function listDelegations(access: Access, activeOnly: boolean) {
  enforce(access.context, "membership.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    activeOnly
      ? sqlClient`
        select id, delegator_membership_id, delegate_membership_id, permission_ceiling, reason, valid_from, valid_to, revoked_at
        from delegation_windows where tenant_id = ${access.tenantId} and revoked_at is null
          and valid_from <= now() and valid_to > now() order by valid_to asc limit 100
      `
      : sqlClient`
        select id, delegator_membership_id, delegate_membership_id, permission_ceiling, reason, valid_from, valid_to, revoked_at
        from delegation_windows where tenant_id = ${access.tenantId} order by created_at desc limit 100
      `,
  ]);
  return rows;
}

/** True when the actor currently holds the delegator's scope (and is not the delegator). */
export async function actsAsDelegate(access: Access, delegatorMembershipId: string | null, scope: string): Promise<boolean> {
  if (!delegatorMembershipId || delegatorMembershipId === access.context.membershipId) return false;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select 1 from delegation_windows
      where tenant_id = ${access.tenantId} and delegator_membership_id = ${delegatorMembershipId}
        and delegate_membership_id = ${access.context.membershipId} and revoked_at is null
        and valid_from <= now() and valid_to > now() and ${scope} = any(permission_ceiling) limit 1
    `,
  ]);
  return (rows as unknown[]).length > 0;
}
