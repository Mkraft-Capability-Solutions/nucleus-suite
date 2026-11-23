import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Tenant API keys over api_clients / api_keys (tenant.manage). Only a SHA-256
 * hash and a display prefix are stored; the raw key is returned once at issue.
 * A key's scopes are limited to permissions the issuer holds.
 */

export const API_KEY_ENVIRONMENTS = ["sandbox", "production"] as const;

export type ApiKeyView = {
  id: string;
  name: string;
  prefix: string;
  environment: string;
  scopes: string[];
  status: "active" | "revoked" | "expired";
  expiresOn: string | null;
  createdAt: string;
};

type KeyRow = { id: string; record_status: string; attributes: Record<string, unknown>; created_at: string };

function mapKey(row: KeyRow, today = new Date().toISOString().slice(0, 10)): ApiKeyView {
  const attributes = row.attributes;
  const expiresOn = typeof attributes.expires_on === "string" ? attributes.expires_on : null;
  const revoked = row.record_status === "revoked" || typeof attributes.revoked_at === "string";
  return {
    id: row.id,
    name: typeof attributes.name === "string" ? attributes.name : "",
    prefix: typeof attributes.prefix === "string" ? attributes.prefix : "",
    environment: typeof attributes.environment === "string" ? attributes.environment : "",
    scopes: Array.isArray(attributes.scopes) ? attributes.scopes.filter((scope): scope is string => typeof scope === "string") : [],
    status: revoked ? "revoked" : expiresOn && expiresOn < today ? "expired" : "active",
    expiresOn,
    createdAt: row.created_at,
  };
}

export async function listApiKeys(access: Access): Promise<ApiKeyView[]> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, record_status, attributes - 'key_hash' as attributes, created_at::text as created_at
      from api_keys where tenant_id = ${access.tenantId}
      order by created_at desc limit 100
    `,
  ]);
  return (rows as KeyRow[]).map((row) => mapKey(row));
}

export const createApiKeySchema = z.object({
  name: z.string().trim().min(3, "Use at least 3 characters.").max(80, "Use at most 80 characters."),
  environment: z.enum(API_KEY_ENVIRONMENTS),
  scopes: z.array(z.string().trim().min(1).max(80)).min(1, "Choose at least one scope.").max(30),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an expiry date."),
});

export async function createApiKey(
  access: Access,
  input: z.infer<typeof createApiKeySchema>,
  requestId: string,
): Promise<{ key: ApiKeyView; secret: string }> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (input.expiresOn <= today || input.expiresOn > max) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expiry must be a future date within one year.", details: [{ field: "expiresOn", issue: "range" }] });
  }
  const isSuperAdmin = access.context.roles.some((role) => role.toLowerCase().replace(/[-_]/g, "") === "superadmin");
  const held = new Set(access.context.permissions);
  const escalated = input.scopes.filter((scope) => !held.has(scope));
  if (!isSuperAdmin && escalated.length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `You cannot issue scopes you do not hold: ${escalated.join(", ")}.`, details: [{ field: "scopes", issue: "escalation" }] });
  }
  const [known] = await tenantTx(access, [
    sqlClient`select permission_key from permissions where status = 'active' and permission_key = any(${input.scopes})`,
  ]);
  const knownKeys = new Set((known as Array<{ permission_key: string }>).map((row) => row.permission_key));
  const unknown = input.scopes.filter((scope) => !knownKeys.has(scope));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "UNKNOWN_PERMISSION", message: `Unknown scopes: ${unknown.join(", ")}.`, details: [{ field: "scopes", issue: "unknown" }] });
  }
  const [clientRows] = await tenantTx(access, [
    sqlClient`select id from api_clients where tenant_id = ${access.tenantId} and attributes->>'environment' = ${input.environment} and record_status = 'active' limit 1`,
  ]);
  let clientId = (clientRows as Array<{ id: string }>)[0]?.id;
  const statements = [];
  if (!clientId) {
    clientId = crypto.randomUUID();
    statements.push(sqlClient`
      insert into api_clients (id, tenant_id, attributes)
      values (${clientId}, ${access.tenantId}, ${JSON.stringify({ environment: input.environment, created_by: access.context.membershipId })}::jsonb)
    `);
  }
  const secret = `nk_${input.environment === "production" ? "live" : "test"}_${randomBytes(24).toString("base64url")}`;
  const prefix = secret.slice(0, 12);
  const id = crypto.randomUUID();
  const attributes = {
    name: input.name,
    prefix,
    environment: input.environment,
    scopes: [...new Set(input.scopes)].sort(),
    expires_on: input.expiresOn,
    key_hash: createHash("sha256").update(secret).digest("hex"),
    created_by: access.context.membershipId,
  };
  statements.push(
    sqlClient`insert into api_keys (id, tenant_id, api_client_id, attributes) values (${id}, ${access.tenantId}, ${clientId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.api_key_create', 'api_key', ${id}, 'API key issued',
        ${JSON.stringify({ name: input.name, prefix, environment: input.environment, scopes: attributes.scopes, expiresOn: input.expiresOn })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  );
  await tenantTx(access, statements);
  const visible = { name: attributes.name, prefix, environment: attributes.environment, scopes: attributes.scopes, expires_on: attributes.expires_on };
  return { key: mapKey({ id, record_status: "active", attributes: visible, created_at: new Date().toISOString() }), secret };
}

export async function getApiKey(access: Access, id: string): Promise<ApiKeyView> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The API key was not found." });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, record_status, attributes - 'key_hash' as attributes, created_at::text as created_at from api_keys where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const row = (rows as KeyRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The API key was not found." });
  return mapKey(row);
}

export const revokeApiKeySchema = z.object({ reason: z.string().trim().min(3, "Give a reason of at least 3 characters.").max(500) });

export async function revokeApiKey(access: Access, id: string, reason: string, requestId: string): Promise<ApiKeyView> {
  const key = await getApiKey(access, id);
  if (key.status === "revoked") throw new HttpError({ status: 409, code: "ALREADY_REVOKED", message: "This API key is already revoked." });
  await tenantTx(access, [
    sqlClient`
      update api_keys set record_status = 'revoked', updated_at = now(), version = version + 1,
        attributes = attributes || ${JSON.stringify({ revoked_at: new Date().toISOString(), revoked_by: access.context.membershipId })}::jsonb
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.api_key_revoke', 'api_key', ${id}, ${reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return getApiKey(access, id);
}
