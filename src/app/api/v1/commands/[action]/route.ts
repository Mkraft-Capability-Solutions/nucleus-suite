import { createHash, randomUUID } from "node:crypto";
import { sqlClient } from "@/lib/db";
import { commandPermissions } from "@/lib/command-permissions";
import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { executeVpCommand, vpCommandSchema } from "@/server/vp/service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
function permission(action: string) {
  if (!Object.hasOwn(commandPermissions, action)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown command." });
  return commandPermissions[action as keyof typeof commandPermissions];
}

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { action } = await context.params;
    enforce(access.context, permission(action), { tenantId: access.tenantId });
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams);
    const [rows] = await tenantTx(access, [sqlClient`select coalesce(response->>'id',id::text) as id, 1 as version, action, status, response as result, created_at from hrms_command_requests where tenant_id=${access.tenantId} and action=${action} order by created_at desc,id desc limit ${pageSize + 1} offset ${(page - 1) * pageSize}`]);
    const items = rows as Array<{ id: string; version: number }>;
    return collection({ type: "command-request", items: items.slice(0, pageSize), requestId, self: new URL(request.url).pathname, nextCursor: items.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null });
  } catch (error) { return fail(error, requestId); }
}

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { action } = await context.params;
    enforce(access.context, permission(action), { tenantId: access.tenantId });
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Enter the command fields." });
    const parsed = vpCommandSchema.safeParse({ ...raw, action });
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Check the command fields.", details: parsed.error.issues.map(issue => ({ field: issue.path.join("."), issue: issue.message })) });
    const key = requireIdempotencyKey(request.headers);
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const id = randomUUID();
    const [claimed] = await tenantTx(access, [sqlClient`insert into hrms_command_requests(id,tenant_id,actor_membership_id,action,idempotency_key,fingerprint,status) values(${id},${access.tenantId},${access.context.membershipId},${action},${key},${fingerprint},'processing') on conflict(tenant_id,idempotency_key) do nothing returning id`]);
    if (!(claimed as unknown[]).length) {
      const [rows] = await tenantTx(access, [sqlClient`select id,fingerprint,status,response,actor_membership_id from hrms_command_requests where tenant_id=${access.tenantId} and idempotency_key=${key}`]);
      const prior = (rows as Array<{ id: string; fingerprint: string; status: string; response: Record<string, unknown>; actor_membership_id: string }>)[0];
      if (!prior || prior.fingerprint !== fingerprint || prior.actor_membership_id !== access.context.membershipId) throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This key belongs to another command." });
      if (prior.status !== "completed") throw new HttpError({ status: 409, code: "COMMAND_REQUIRES_REVIEW", message: "This command is processing or needs reconciliation. Review its history before retrying; it will not run twice automatically." });
      return ok({ type: "command-request", id: String(prior.response.id ?? prior.id), version: 1, attributes: prior.response, requestId, self: new URL(request.url).pathname });
    }
    try {
      const result = await executeVpCommand(access, parsed.data, requestId);
      await tenantTx(access, [sqlClient`update hrms_command_requests set status='completed',response=${JSON.stringify(result)}::jsonb,updated_at=now() where tenant_id=${access.tenantId} and id=${id}`]);
      return ok({ type: "command-request", id: "id" in result ? String(result.id) : id, version: 1, attributes: result, requestId, self: new URL(request.url).pathname });
    } catch (error) {
      await tenantTx(access, [sqlClient`update hrms_command_requests set status='failed',response=${JSON.stringify({ requestId, message: error instanceof HttpError ? error.message : "Reconcile this command before retrying." })}::jsonb,updated_at=now() where tenant_id=${access.tenantId} and id=${id}`]);
      throw error;
    }
  } catch (error) { return fail(error, requestId); }
}
