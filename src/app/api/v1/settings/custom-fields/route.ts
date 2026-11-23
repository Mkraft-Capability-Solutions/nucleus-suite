import { listCustomFieldDefinitions } from "@/server/organization/employee-master";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** GET ?module=EMPLOYEE_MASTER — active custom field definitions for the tenant. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const moduleKey = new URL(request.url).searchParams.get("module") ?? "";
    const items = await listCustomFieldDefinitions(access, moduleKey);
    return ok({ type: "custom_field_definitions", id: moduleKey, version: 1, attributes: { module: moduleKey, items, total: items.length }, requestId, self: `/api/v1/settings/custom-fields?module=${moduleKey}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
