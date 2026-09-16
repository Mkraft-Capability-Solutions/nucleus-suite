import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, parsePagination, requestIdFrom } from "@/server/platform/http";

const tables: Record<string, string> = { employments: "employments", departments: "departments", positions: "positions", locations: "locations", grades: "grades", costCenters: "cost_centers", jurisdictions: "jurisdictions", legalEntities: "legal_entities", workerCategories: "worker_categories", payGroups: "pay_groups", holidayCalendars: "holiday_calendars" };
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const permissions = ["employee.read", "employee.dossier.read", "employee.dossier.write", ...Object.values(operationalResources).flatMap(resource => [resource.permission + ".read", resource.permission + ".write", resource.permission + ".approve"])];
    const fullPermission = permissions.find(value => access.context.permissions.includes(value));
    const scopedPermissions = ["hr.helpdesk", "workforce.travel", "workforce.timesheets"].flatMap(prefix => ["team.read", "team.approve", "self.read", "self.write"].map(suffix => prefix + "." + suffix));
    const permission = fullPermission ?? scopedPermissions.find(value => access.context.permissions.includes(value));
    if (!permission) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Reference lookup is not available for this role." });
    enforce(access.context, permission, { tenantId: access.tenantId });
    const { resource } = await context.params;
    if (resource !== "employees" && !Object.hasOwn(tables, resource)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown reference list." });
    if (!fullPermission && (resource !== "employees" || !access.context.employeeId)) throw new HttpError({status:403,code:"FORBIDDEN",message:"This role can only select employees within its permitted scope."});
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const search = "%" + (params.get("search") ?? "").slice(0, 100) + "%";
    const query = resource === "employees"
      ? "select id,version,first_name || ' ' || last_name || ' · ' || employee_code as name from employees where tenant_id=$1 and (first_name || ' ' || last_name || ' ' || employee_code) ilike $2 order by first_name,id limit $3 offset $4"
      : resource === "employments"
        ? "select e.id,e.version,p.first_name || ' ' || p.last_name || ' · ' || p.employee_code as name from employments e join employees p on p.tenant_id=e.tenant_id and p.id=e.employee_id where e.tenant_id=$1 and (p.first_name || ' ' || p.last_name || ' ' || p.employee_code) ilike $2 order by e.id limit $3 offset $4"
        : 'select id,version,coalesce(attributes->>\'name\',attributes->>\'title\',attributes->>\'code\',id::text) as name from "' + tables[resource] + '" where tenant_id=$1 and attributes::text ilike $2 order by id limit $3 offset $4';
    // Global jurisdictions have no tenant column; expose only their names/codes.
    let actual = resource === "jurisdictions" ? "select id,1 as version,name || ' · ' || code as name from jurisdictions where (name || ' ' || code) ilike $1 order by id limit $2 offset $3" : resource === "legalEntities" ? "select id,1 as version,legal_name as name from legal_entities where tenant_id=$1 and legal_name ilike $2 order by id limit $3 offset $4" : query;
    const values = resource === "jurisdictions" ? [search, pageSize + 1, (page - 1) * pageSize] : [access.tenantId, search, pageSize + 1, (page - 1) * pageSize];
    if (!fullPermission) {
      const team = scopedPermissions.some(value => value.includes(".team.") && access.context.permissions.includes(value));
      actual = "select id,version,first_name || ' ' || last_name || ' · ' || employee_code as name from employees where tenant_id=$1 and (id=$5::uuid or ($6::boolean and manager_employee_id=$5::uuid)) and (first_name || ' ' || last_name || ' ' || employee_code) ilike $2 order by first_name,id limit $3 offset $4";
      values.push(access.context.employeeId!, String(team));
    }
    const [result] = await tenantTx(access, [sqlClient.query(actual, values)]);
    const items = result as Array<{ id: string; version: number; name: string }>;
    return collection({ type: "reference", requestId, self: new URL(request.url).pathname, items: items.slice(0, pageSize), nextCursor: items.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null });
  } catch (error) { return fail(error, requestId); }
}
