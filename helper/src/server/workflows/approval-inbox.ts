import "server-only";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { tenantTx, type Access } from "@/server/platform/access";
import { operationalScope } from "./operational-access";

export async function operationalApprovals(access: Access) {
  const grants = Object.entries(operationalResources).flatMap(([resource, definition]) => {
    if (![definition.permission + ".approve", definition.permission + ".team.approve"].some(permission => access.context.permissions.includes(permission))) return [];
    const scope = operationalScope(access, definition.permission, "approve");
    const statuses = [...new Set(Object.values(definition.transitions).filter(action => action.approval).flatMap(action => action.from))];
    return [{ resource, scope, statuses }];
  });
  if (!grants.length) return [];
  const [rows] = await tenantTx(access, [sqlClient`
    select r.id,r.version,r.resource,r.status,r.data,r.updated_at
    from hrms_operation_records r
    join jsonb_to_recordset(${JSON.stringify(grants)}::jsonb) as grant_scope(resource text,scope text,statuses jsonb) on grant_scope.resource=r.resource
    where r.tenant_id=${access.tenantId}
      and r.status in(select jsonb_array_elements_text(grant_scope.statuses))
      and r.created_by_membership_id <> ${access.context.membershipId}
      and (r.employee_id is null or r.employee_id is distinct from ${access.context.employeeId ?? null}::uuid)
      and (grant_scope.scope='all' or r.employee_id in(select id from employees where tenant_id=${access.tenantId} and manager_employee_id=${access.context.employeeId ?? null}::uuid))
      and (r.resource <> 'tickets' or grant_scope.scope <> 'team' or r.data->>'category' <> 'grievance')
    order by r.updated_at,r.id limit 101
  `]);
  return rows as Array<{id:string;version:number;resource:string;status:string;data:Record<string,unknown>;updated_at:string}>;
}
