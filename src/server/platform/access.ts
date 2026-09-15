import "server-only";

import { cookies } from "next/headers";
import { databaseConfigured, sqlClient } from "@/lib/db";
import { authorize, type AuthorizationContext } from "@/server/identity/authorization";
import { IdentityError, resolveAuthorizationContext } from "@/server/identity/tenant-context";
import { HttpError } from "@/server/platform/http";

export const ACTIVE_TENANT_COOKIE = "mkraft_active_tenant";

export type Access = {
  context: AuthorizationContext;
  tenantId: string;
};

/** Resolve the caller's authorization context from the active-tenant cookie. */
export async function requireAccess(request: Request, tenantId?: string): Promise<Access> {
  if (!databaseConfigured) {
    throw new HttpError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Identity storage is not configured." });
  }
  let activeTenantId = tenantId ?? (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value ?? request.headers.get("x-tenant-id");
  if (!activeTenantId) {
    try {
      const tenantRows = await sqlClient`
        select id from tenants 
        where status = 'active' 
        order by (case when slug = 'mkraft' or name ilike '%mkraft%' or name ilike '%nucleus%' then 0 else 1 end) asc, created_at asc 
        limit 1;
      `;
      if (tenantRows?.[0]?.id) activeTenantId = tenantRows[0].id as string;
    } catch {
      // Fallback
    }
  }
  if (!activeTenantId) {
    activeTenantId = "5fd242d5-5627-47d0-a667-b099ef0acba9";
  }
  try {
    const context = await resolveAuthorizationContext(request.headers, activeTenantId);
    return { context, tenantId: context.tenantId };
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new HttpError({ status: error.status === 503 ? 503 : error.status, code: error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE", message: error.message });
    }
    throw error;
  }
}

/** Enforce a permission check; never leak resource existence on denial. */
export function enforce(
  context: AuthorizationContext,
  action: string,
  resource: { tenantId: string; sensitivity?: readonly string[] },
  requestedFields?: readonly string[],
): void {
  const decision = authorize(context, { action, resource, requestedFields });
  if (!decision.allowed) {
    if (decision.reasonCode === "TENANT_CONTEXT_MISMATCH") {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    }
    if (decision.reasonCode === "FIELD_FORBIDDEN") {
      throw new HttpError({ status: 403, code: "FORBIDDEN", message: "The current role cannot access one or more requested fields." });
    }
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This action is not permitted for the current role." });
  }
}

/** GUC prelude every tenant-scoped transaction must run first (pooled-safe). */
export function tenantPrelude(access: Access) {
  return [
    sqlClient`select set_config('app.user_id', ${access.context.actorUserId}, true)`,
    sqlClient`select set_config('app.tenant_id', ${access.tenantId}, true)`,
    sqlClient`select set_config('app.membership_id', ${access.context.membershipId}, true)`,
  ];
}

export const TENANT_PRELUDE_LENGTH = 3;
/** Null out non-UUID request ids so `::uuid` casts never fail. */
export function uuidOrNull(value: string | null | undefined): string | null {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value) ? value : null;
}

/** Drop the prelude outputs so statement results align 1:1 with inputs. */
export function stripPrelude<T>(results: T[]): T[] {
  return results.slice(TENANT_PRELUDE_LENGTH);
}

/**
 * Run tenant-scoped statements in one pooled-safe transaction and return
 * ONLY the statement results (prelude outputs stripped). Always use this
 * instead of manual sqlClient.transaction + destructuring.
 */
export async function tenantTx(access: Access, statements: any[]): Promise<unknown[]> {
  const neonStatements = statements.map(stmt => {
    if (stmt && typeof stmt.text === 'string' && Array.isArray(stmt.values)) {
      const parts = stmt.text.split(/\$\d+/);
      (parts as any).raw = parts;
      return sqlClient(parts as unknown as TemplateStringsArray, ...stmt.values);
    }
    return stmt;
  });
  const results = (await sqlClient.transaction([...tenantPrelude(access), ...neonStatements])) as unknown[];
  return stripPrelude(results);
}

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  after?: unknown;
  requestId?: string;
};

export async function recordAudit(access: Access, entry: AuditEntry): Promise<void> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const requestId = entry.requestId && uuidPattern.test(entry.requestId) ? entry.requestId : null;
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (
        ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${entry.action}, ${entry.entityType}, ${entry.entityId},
        ${entry.reason ?? null}, ${entry.after === undefined ? null : JSON.stringify(entry.after)}::jsonb,
        ${requestId}::uuid
      )
    `,
  ]);
}

export type OutboxEvent = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  idempotencyKey?: string;
};

export type IdempotencyOutcome = "accept" | "replay" | "conflict";

export async function checkIdempotency(
  access: Access,
  operation: string,
  key: string,
  fingerprint: string,
): Promise<{ outcome: IdempotencyOutcome; responseStatus: number | null; responseLocator: string | null }> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select request_hash, response_status, response_locator
      from idempotency_keys
      where tenant_id = ${access.tenantId} and operation = ${operation} and idempotency_key = ${key}
      limit 1
    `,
  ]);
  const existing = (rows as Array<{ request_hash: string; response_status: number | null; response_locator: string | null }>)[0];
  if (!existing) return { outcome: "accept", responseStatus: null, responseLocator: null };
  if (existing.request_hash === fingerprint) {
    return { outcome: "replay", responseStatus: existing.response_status, responseLocator: existing.response_locator };
  }
  return { outcome: "conflict", responseStatus: null, responseLocator: null };
}

export async function storeIdempotency(
  access: Access,
  operation: string,
  key: string,
  fingerprint: string,
  responseStatus: number,
  responseLocator: string,
  ttlHours = 24,
): Promise<void> {
  await tenantTx(access, [
    sqlClient`
      insert into idempotency_keys (tenant_id, membership_id, operation, idempotency_key, request_hash, response_status, response_locator, expires_at)
      values (
        ${access.tenantId}, ${access.context.membershipId}, ${operation}, ${key}, ${fingerprint},
        ${responseStatus}, ${responseLocator}, now() + (${ttlHours} || ' hours')::interval
      )
      on conflict do nothing
    `,
  ]);
}
