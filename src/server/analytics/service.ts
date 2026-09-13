import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const MCI_WEIGHTS = { performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 } as const;

export const defineMetricSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  definition: z.string().trim().min(1).max(2000),
  privacyThreshold: z.number().int().min(2).max(100).default(5),
});

export async function defineMetric(access: Access, input: z.infer<typeof defineMetricSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from metric_definitions where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return { id: existing.id, duplicate: true };
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into metric_definitions (id, tenant_id, attributes)
      values (${id}, ${access.tenantId},
        ${JSON.stringify({ code: input.code, name: input.name, definition: input.definition, version: "metrics/v1", privacy_threshold: input.privacyThreshold })}::jsonb)
    `,
  ]);
  return { id, duplicate: false };
}

export const snapshotMetricSchema = z.object({
  definitionCode: z.string().trim().min(1).max(60),
  value: z.number(),
  cohortSize: z.number().int().min(0),
  drillThrough: z.array(z.string()).default([]),
});

export async function snapshotMetric(access: Access, input: z.infer<typeof snapshotMetricSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [defRows] = await tenantTx(access, [
    sqlClient`select id, attributes from metric_definitions where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.definitionCode} limit 1`,
  ]);
  const definition = (defRows as Array<{ id: string; attributes: { privacy_threshold: number } }>)[0];
  if (!definition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The metric definition does not exist." });
  const suppressed = input.cohortSize < (definition.attributes.privacy_threshold ?? 5);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into metric_snapshots (id, tenant_id, metric_definition_id, attributes)
      values (${id}, ${access.tenantId}, ${definition.id},
        ${JSON.stringify({
          value: suppressed ? null : input.value,
          cohort_size: input.cohortSize,
          suppressed,
          drill_through: suppressed ? [] : input.drillThrough,
          refreshed_at: new Date().toISOString(),
        })}::jsonb)
    `,
  ]);
  return { id, suppressed };
}

export async function listMetrics(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from metric_definitions where tenant_id = ${access.tenantId} order by created_at`,
  ]);
  return rows;
}

async function ensureMciVersion(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from capability_index_versions where tenant_id = ${access.tenantId} and attributes->>'formula' = 'mci/v2' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into capability_index_versions (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ formula: "mci/v2", weights: MCI_WEIGHTS, permitted_use: "development-planning-only" })}::jsonb)
    `,
  ]);
  return id;
}

export const computeMciSchema = z.object({
  employeeId: z.string().uuid(),
  inputs: z.object({
    performance: z.number().min(0).max(100),
    skills: z.number().min(0).max(100),
    learning: z.number().min(0).max(100),
    engagement: z.number().min(0).max(100),
    tenure: z.number().min(0).max(100),
  }),
});

export async function computeMci(access: Access, input: z.infer<typeof computeMciSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const versionId = await ensureMciVersion(access);
  const entries = Object.entries(input.inputs) as Array<[keyof typeof MCI_WEIGHTS, number]>;
  const total = entries.reduce((sum, [key, value]) => sum + (value * MCI_WEIGHTS[key]) / 100, 0);
  const index = Math.round(total * 100) / 100;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into capability_index_runs (id, tenant_id, capability_index_version_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${versionId}, ${input.employeeId},
        ${JSON.stringify({ inputs: input.inputs, weights: MCI_WEIGHTS, index, formula: "mci/v2", automated_decision: false })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'analytics.mci_compute', 'capability_index_run', ${id}, 'MCI computed for development planning', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, index, formula: "mci/v2" };
}

export async function getMciRun(access: Access, runId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from capability_index_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as Array<{ id: string; employee_id: string; attributes: unknown }>)[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}
