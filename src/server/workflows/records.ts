import "server-only";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { collection, HttpError, parsePagination } from "@/server/platform/http";
import resources from "./resources.json";

export async function workflowRecords(access: Access, resource: string, request: Request, requestId: string) {
  const entry = (resources as Record<string, string[]>)[resource];
  if (!entry || !Object.hasOwn(resources, resource)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This record list does not exist." });
  const [table, permission, fieldPermission] = entry;
  enforce(access.context, permission, { tenantId: access.tenantId });
  if (fieldPermission) enforce(access.context, fieldPermission, { tenantId: access.tenantId });
  const params = new URL(request.url).searchParams;
  const { page, pageSize } = parsePagination(params);
  const parentColumn = resource === "offboarding/items" ? "offboarding_case_id" : resource === "onboarding/tasks" ? "onboarding_instance_id" : null;
  const parentId = parentColumn ? params.get("parentId") : null;
  if (parentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Enter a valid joining or exit case reference." });
  // Table names come only from the checked-in allowlist. User input is always bound.
  const [result] = await tenantTx(access, [
    parentColumn
      ? sqlClient.query('select id, attributes || jsonb_build_object(\'parentReference\', "' + parentColumn + '") as attributes, created_at from "' + table + '" where tenant_id = $1 and ($4::uuid is null or "' + parentColumn + '" = $4::uuid) order by created_at desc, id desc limit $2 offset $3', [access.tenantId, pageSize + 1, (page - 1) * pageSize, parentId])
      : sqlClient.query('select id, attributes, created_at from "' + table + '" where tenant_id = $1 order by created_at desc, id desc limit $2 offset $3', [access.tenantId, pageSize + 1, (page - 1) * pageSize]),
  ]);
  const rows = result as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>;
  return collection({
    type: resource, requestId, self: new URL(request.url).pathname,
    items: rows.slice(0, pageSize).map(row => ({ id: row.id, version: 1, attributes: row.attributes, created_at: row.created_at })),
    nextCursor: rows.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null,
  });
}
