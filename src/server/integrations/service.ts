import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

const SECRET_KEY_PATTERN = /secret|password|token|api[_-]?key|private/i;

function rejectEmbeddedSecrets(config: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEY_PATTERN.test(key) && typeof value === "string" && value.length > 0) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Connection config must reference secrets (secret_ref), never embed them (key '${key}').` });
    }
  }
}

export async function listCatalog(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from integration_catalog order by created_at limit 100`,
  ]);
  return rows;
}

export const connectSchema = z.object({
  catalogCode: z.string().trim().min(1).max(80),
  environment: z.enum(["Sandbox", "Simulated", "Live"]),
  config: z.record(z.string(), z.unknown()).default({}),
  secretRef: z.string().trim().max(200).optional(),
  verifiedRoundTrip: z.boolean().default(false),
});

export async function connectIntegration(access: Access, input: z.infer<typeof connectSchema>, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  rejectEmbeddedSecrets(input.config as Record<string, unknown>);
  if (input.environment === "Live" && !input.verifiedRoundTrip) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Live requires a verified round-trip before the label is claimed." });
  }
  const [catalogRows] = await tenantTx(access, [
    sqlClient`select id from integration_catalog where attributes->>'code' = ${input.catalogCode} limit 1`,
  ]);
  let catalogId = (catalogRows as Array<{ id: string }>)[0]?.id;
  if (!catalogId) {
    catalogId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into integration_catalog (id, attributes) values (${catalogId}, ${JSON.stringify({ code: input.catalogCode })}::jsonb)`,
    ]);
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into integration_connections (id, tenant_id, integration_catalog_id, attributes)
      values (${id}, ${access.tenantId}, ${catalogId},
        ${JSON.stringify({ environment: input.environment, config: input.config, secret_ref: input.secretRef ?? null, verified_round_trip: input.verifiedRoundTrip, status: "connected" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.connect', 'integration_connection', ${id}, 'Integration connected', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, environment: input.environment };
}

export async function listConnections(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select c.id, c.attributes, k.attributes as catalog
      from integration_connections c join integration_catalog k on k.id = c.integration_catalog_id
      where c.tenant_id = ${access.tenantId} order by c.created_at desc limit 100
    `,
  ]);
  // Never expose secret material: project only labels, config keys and refs.
  return (rows as Array<{ id: string; attributes: Record<string, unknown>; catalog: unknown }>).map((row) => ({
    id: row.id,
    catalog: row.catalog,
    environment: row.attributes.environment,
    status: row.attributes.status,
    configKeys: Object.keys((row.attributes.config as Record<string, unknown>) ?? {}),
    secretRef: row.attributes.secret_ref ?? null,
    verifiedRoundTrip: row.attributes.verified_round_trip ?? false,
  }));
}

export const createEndpointSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  secret: z.string().min(16).max(200),
});

export async function createWebhookEndpoint(access: Access, input: z.infer<typeof createEndpointSchema>) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  const secretHash = createHash("sha256").update(input.secret).digest("hex");
  await tenantTx(access, [
    sqlClient`
      insert into webhook_endpoints (id, tenant_id, attributes)
      values (${id}, ${access.tenantId},
        ${JSON.stringify({ url: input.url, events: input.events, secret_hash: secretHash, status: "active" })}::jsonb)
    `,
  ]);
  return { id, url: input.url, events: input.events };
}

export async function subscribeWebhook(access: Access, endpointId: string, events: string[]) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into webhook_subscriptions (id, tenant_id, webhook_endpoint_id, attributes)
      values (${id}, ${access.tenantId}, ${endpointId}, ${JSON.stringify({ events, status: "active" })}::jsonb)
    `,
  ]);
  return { id };
}

export async function listDeliveries(access: Access, subscriptionId: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = subscriptionId;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, webhook_subscription_id, attributes, created_at from webhook_deliveries where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or webhook_subscription_id = ${subscriptionId})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}

export async function replayDelivery(access: Access, deliveryId: string, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from webhook_deliveries where tenant_id = ${access.tenantId} and id = ${deliveryId} limit 1`,
  ]);
  const delivery = (rows as Array<{ id: string; attributes: Record<string, unknown> }>)[0];
  if (!delivery) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await tenantTx(access, [
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key)
      values (${access.tenantId}, 'webhook.replay', 'webhook_delivery', ${deliveryId},
        ${JSON.stringify({ original: delivery.attributes })}::jsonb, ${`webhook-replay:${deliveryId}`})
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.webhook_replay', 'webhook_delivery', ${deliveryId}, 'Delivery replay authorized', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { deliveryId, replay: "queued" };
}
