import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Integration operations for the integrations screen: connection status with
 * the last sync / test request and the last error (from transactional_outbox),
 * event-outbox health, webhook endpoints and tenant domains. Sync and test are
 * queued as outbox events; the job runner publishes them, and their status
 * here is the outbox status, never an assumed success.
 */

type OutboxRow = {
  id: string; event_type: string; status: string; attempts: number; created_at: string; published_at: string | null;
};

export type JobView = { id: string; status: string; attempts: number; requestedAt: string; publishedAt: string | null };

export type ConnectionView = {
  id: string;
  code: string | null;
  name: string | null;
  category: string | null;
  environment: string | null;
  status: string | null;
  createdAt: string;
  lastSync: JobView | null;
  lastTest: JobView | null;
  lastError: JobView | null;
};

export type IntegrationsOverview = {
  connections: ConnectionView[];
  eventBus: Record<"pending" | "leased" | "published" | "failed" | "dead", number>;
  webhooks: Array<{ id: string; host: string | null; events: string[]; status: string | null; createdAt: string }>;
  domains: Array<{ id: string; domain: string | null; status: string | null; verified: boolean }>;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function host(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function toJob(row: OutboxRow | undefined): JobView | null {
  return row ? { id: row.id, status: row.status, attempts: Number(row.attempts), requestedAt: row.created_at, publishedAt: row.published_at } : null;
}

export async function getIntegrationsOverview(access: Access): Promise<IntegrationsOverview> {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  const [connectionRows, outboxRows, busRows, webhookRows, domainRows] = await tenantTx(access, [
    sqlClient`
      select c.id, c.attributes, k.attributes as catalog, c.created_at::text as created_at
      from integration_connections c join integration_catalog k on k.id = c.integration_catalog_id
      where c.tenant_id = ${access.tenantId}
      order by c.created_at desc limit 100
    `,
    sqlClient`
      select id, aggregate_id, event_type, status, attempts, created_at::text as created_at, published_at::text as published_at
      from transactional_outbox
      where tenant_id = ${access.tenantId} and aggregate_type = 'integration_connection'
        and event_type in ('integration.sync_requested', 'integration.test_requested')
      order by created_at desc limit 500
    `,
    sqlClient`select status, count(*)::int as count from transactional_outbox where tenant_id = ${access.tenantId} group by status`,
    sqlClient`select id, attributes, created_at::text as created_at from webhook_endpoints where tenant_id = ${access.tenantId} order by created_at desc limit 50`,
    sqlClient`select id, attributes from tenant_domains where tenant_id = ${access.tenantId} order by created_at asc limit 20`,
  ]);
  const jobs = outboxRows as Array<OutboxRow & { aggregate_id: string }>;
  const latest = (connectionId: string, eventType: string, failed: boolean) =>
    jobs.filter((job) => job.aggregate_id === connectionId && job.event_type === eventType && ["failed", "dead"].includes(job.status) === failed)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const connections = (connectionRows as Array<{ id: string; attributes: Record<string, unknown>; catalog: Record<string, unknown> | null; created_at: string }>).map((row) => {
    const catalog = row.catalog ?? {};
    const syncOk = latest(row.id, "integration.sync_requested", false);
    const syncFailed = latest(row.id, "integration.sync_requested", true);
    const testOk = latest(row.id, "integration.test_requested", false);
    const testFailed = latest(row.id, "integration.test_requested", true);
    const pick = (a: OutboxRow | undefined, b: OutboxRow | undefined) => (a && b ? (a.created_at > b.created_at ? a : b) : a ?? b);
    const lastError = pick(syncFailed, testFailed);
    return {
      id: row.id,
      code: text(catalog.code),
      name: text(catalog.name) ?? text(catalog.code),
      category: text(catalog.category),
      environment: text(row.attributes.environment),
      status: text(row.attributes.status),
      createdAt: row.created_at,
      lastSync: toJob(pick(syncOk, syncFailed)),
      lastTest: toJob(pick(testOk, testFailed)),
      lastError: toJob(lastError),
    };
  });
  const eventBus = { pending: 0, leased: 0, published: 0, failed: 0, dead: 0 };
  for (const row of busRows as Array<{ status: keyof typeof eventBus; count: number }>) {
    if (row.status in eventBus) eventBus[row.status] = Number(row.count);
  }
  return {
    connections,
    eventBus,
    webhooks: (webhookRows as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>).map((row) => ({
      id: row.id,
      host: host(row.attributes.url),
      events: Array.isArray(row.attributes.events) ? row.attributes.events.filter((event): event is string => typeof event === "string") : [],
      status: text(row.attributes.status),
      createdAt: row.created_at,
    })),
    domains: (domainRows as Array<{ id: string; attributes: Record<string, unknown> }>).map((row) => ({
      id: row.id,
      domain: text(row.attributes.domain) ?? text(row.attributes.hostname),
      status: text(row.attributes.status),
      verified: row.attributes.verified === true || row.attributes.status === "verified",
    })),
  };
}

export type ConnectionJobKind = "sync" | "test";

/** Queue a sync (integration.sync) or a connection test (tenant.manage) as an outbox event. */
export async function requestConnectionJob(
  access: Access,
  connectionId: string,
  kind: ConnectionJobKind,
  idempotencyKey: string,
  requestId: string,
): Promise<JobView> {
  enforce(access.context, kind === "sync" ? "integration.sync" : "tenant.manage", { tenantId: access.tenantId });
  if (!z.string().uuid().safeParse(connectionId).success) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The connection was not found." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from integration_connections where tenant_id = ${access.tenantId} and id = ${connectionId} limit 1`,
  ]);
  const connection = (rows as Array<{ id: string; attributes: Record<string, unknown> }>)[0];
  if (!connection) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The connection was not found." });
  if (connection.attributes.status === "disconnected") {
    throw new HttpError({ status: 409, code: "CONNECTION_INACTIVE", message: "This connection is disconnected. Reconnect it first." });
  }
  const eventType = `integration.${kind}_requested`;
  const outboxKey = `${eventType}:${connectionId}:${idempotencyKey}`.slice(0, 200);
  const [existing] = await tenantTx(access, [
    sqlClient`
      select id, event_type, status, attempts, created_at::text as created_at, published_at::text as published_at
      from transactional_outbox where tenant_id = ${access.tenantId} and idempotency_key = ${outboxKey} limit 1
    `,
  ]);
  const replay = (existing as OutboxRow[])[0];
  if (replay) return toJob(replay) as JobView;
  const id = crypto.randomUUID();
  const [inserted] = await tenantTx(access, [
    sqlClient`
      insert into transactional_outbox (id, tenant_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key)
      values (${id}, ${access.tenantId}, ${eventType}, 'integration_connection', ${connectionId},
        ${JSON.stringify({ connectionId, requestedBy: access.context.membershipId })}::jsonb, ${outboxKey})
      returning id, event_type, status, attempts, created_at::text as created_at, published_at::text as published_at
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`integration.${kind}_request`}, 'integration_connection', ${connectionId},
        ${kind === "sync" ? "Sync requested" : "Connection test requested"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return toJob((inserted as OutboxRow[])[0]) as JobView;
}

export async function getConnectionActivity(access: Access, connectionId: string) {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  if (!z.string().uuid().safeParse(connectionId).success) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The connection was not found." });
  }
  const [exists, jobs, audit] = await tenantTx(access, [
    sqlClient`select id from integration_connections where tenant_id = ${access.tenantId} and id = ${connectionId} limit 1`,
    sqlClient`
      select id, event_type, status, attempts, created_at::text as created_at, published_at::text as published_at
      from transactional_outbox
      where tenant_id = ${access.tenantId} and aggregate_type = 'integration_connection' and aggregate_id = ${connectionId}
      order by created_at desc limit 50
    `,
    sqlClient`
      select id, action, reason, created_at::text as created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'integration_connection' and entity_id = ${connectionId}
      order by created_at desc limit 50
    `,
  ]);
  if ((exists as unknown[]).length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The connection was not found." });
  return {
    jobs: (jobs as OutboxRow[]).map((row) => ({ ...toJob(row), eventType: row.event_type })),
    audit: audit as Array<{ id: string; action: string; reason: string | null; created_at: string }>,
  };
}
