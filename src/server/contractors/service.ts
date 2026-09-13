import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

async function ensureLegalEntity(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No legal entity exists for this tenant yet." });
  return id;
}

export const createAgencySchema = z.object({
  name: z.string().trim().min(1).max(200),
  registration: z.string().trim().max(120).optional(),
});

export async function createAgency(access: Access, input: z.infer<typeof createAgencySchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_organizations (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ name: input.name, registration: input.registration ?? null })}::jsonb)
    `,
  ]);
  return { id };
}

export const createContractSchema = z.object({
  agencyId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyMinor: z.number().int().positive(),
  varianceThresholdPct: z.number().min(0).max(100).default(2),
});

export async function createContract(access: Access, input: z.infer<typeof createContractSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.endsOn < input.startsOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The contract period ends before it starts." });
  }
  const entityId = await ensureLegalEntity(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_contracts (id, tenant_id, contractor_organization_id, legal_entity_id, attributes)
      values (${id}, ${access.tenantId}, ${input.agencyId}, ${entityId},
        ${JSON.stringify({ code: input.code, starts_on: input.startsOn, ends_on: input.endsOn, monthly_minor: input.monthlyMinor, variance_threshold_pct: input.varianceThresholdPct, status: "active" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'contractor.contract_create', 'contractor_contract', ${id}, 'Contractor contract created', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "active" };
}

export const submitInvoiceSchema = z.object({
  contractId: z.string().uuid(),
  contractedMinor: z.number().int().positive(),
  billedMinor: z.number().int().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function submitInvoice(access: Access, input: z.infer<typeof submitInvoiceSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [contractRows] = await tenantTx(access, [
    sqlClient`select attributes from contractor_contracts where tenant_id = ${access.tenantId} and id = ${input.contractId} limit 1`,
  ]);
  const contract = (contractRows as Array<{ attributes: { variance_threshold_pct: number } }>)[0];
  if (!contract) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const variancePct = Math.abs(input.billedMinor - input.contractedMinor) / input.contractedMinor * 100;
  const held = variancePct > (contract.attributes.variance_threshold_pct ?? 2);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_invoices (id, tenant_id, contractor_contract_id, attributes)
      values (${id}, ${access.tenantId}, ${input.contractId},
        ${JSON.stringify({ contracted_minor: input.contractedMinor, billed_minor: input.billedMinor, variance_pct: Math.round(variancePct * 100) / 100, period: input.period, status: held ? "held" : "approved" })}::jsonb)
    `,
  ]);
  return { id, status: held ? "held" : "approved", variancePct: Math.round(variancePct * 100) / 100 };
}

export async function listInvoices(access: Access, contractId: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = contractId;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, contractor_contract_id, attributes, created_at from contractor_invoices where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or contractor_contract_id = ${contractId})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}

export const assignWorkerSchema = z.object({
  contractId: z.string().uuid(),
  personName: z.string().trim().min(1).max(120),
  category: z.enum(["contract", "third-party-employee", "third-party-helper"]).default("contract"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function assignWorker(access: Access, input: z.infer<typeof assignWorkerSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const personId = crypto.randomUUID();
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`
      insert into contract_worker_assignments (id, tenant_id, contractor_contract_id, person_id, attributes)
      values (${id}, ${access.tenantId}, ${input.contractId}, ${personId},
        ${JSON.stringify({ person_name: input.personName, category: input.category, starts_on: input.startsOn, status: "active" })}::jsonb)
    `,
  ]);
  return { id, personId, status: "active" };
}
