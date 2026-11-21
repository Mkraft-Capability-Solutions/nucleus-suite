import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { COMPANY_KINDS, type Company } from "@/lib/career";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Group structure: the organisation is the group; its registered companies (legal_entities) form a
 * tree through parent_legal_entity_id (db/migrations/0031). Reading needs employee.read; changing
 * the structure needs tenant.manage (owners and administrators).
 */

export type CompanyRow = Company & { headcount: number; currencyCode: string };

type RawCompany = {
  id: string; legal_name: string; code: string | null; parent_legal_entity_id: string | null; entity_kind: Company["kind"];
  industry: string | null; status: string; currency_code: string; headcount: number;
};

function toCompany(row: RawCompany): CompanyRow {
  return {
    id: row.id, name: row.legal_name, code: row.code, parentId: row.parent_legal_entity_id, kind: row.entity_kind,
    industry: row.industry, status: row.status, currencyCode: row.currency_code, headcount: Number(row.headcount ?? 0),
  };
}

export async function listCompanies(access: Access): Promise<CompanyRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select le.id, le.legal_name, le.code, le.parent_legal_entity_id, le.entity_kind, le.industry, le.status, le.currency_code,
        (select count(*) from employees e where e.tenant_id = le.tenant_id and e.legal_entity_id = le.id
          and coalesce(lower(e.status), 'active') not in ('separated', 'exited', 'relieved', 'archived', 'inactive'))::int as headcount
      from legal_entities le where le.tenant_id = ${access.tenantId}
      order by le.legal_name`,
  ]);
  return (rows as RawCompany[]).map(toCompany);
}

const companyFields = {
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dot, dash and underscore only."),
  parentId: z.string().uuid().nullable(),
  kind: z.enum(COMPANY_KINDS),
  industry: z.string().trim().max(120).nullable(),
};

export const createCompanySchema = z.object({
  ...companyFields,
  parentId: companyFields.parentId.optional().default(null),
  industry: companyFields.industry.optional().default(null),
  kind: companyFields.kind.default("company"),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
}).strict();

export const updateCompanySchema = z.object({
  name: companyFields.name.optional(),
  parentId: companyFields.parentId.optional(),
  kind: companyFields.kind.optional(),
  industry: companyFields.industry.optional(),
  status: z.enum(["active", "inactive", "closed"]).optional(),
  reason: z.string().trim().min(5).max(500),
}).strict();

function structureError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (/cannot be placed under itself|deeper than 50 levels/i.test(message)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A company cannot be placed under itself or one of its own subsidiaries." });
  }
  if (/legal_entities_tenant_id_code_key|duplicate key/i.test(message)) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "Another company already uses this code." });
  }
  throw error;
}

export async function createCompany(access: Access, input: z.infer<typeof createCompanySchema>, requestId: string): Promise<CompanyRow> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  const [defaults] = await tenantTx(access, [
    sqlClient`
      select (select j.id from jurisdictions j where j.kind = 'country' order by j.created_at limit 1) as jurisdiction_id,
        coalesce((select s.currency from tenant_settings s where s.tenant_id = ${access.tenantId} limit 1),
          (select t.default_currency from tenants t where t.id = ${access.tenantId}), 'INR') as currency`,
  ]);
  const base = (defaults as Array<{ jurisdiction_id: string | null; currency: string }>)[0];
  if (!base?.jurisdiction_id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No jurisdiction is configured for companies yet." });
  try {
    await tenantTx(access, [
      sqlClient`
        insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status, parent_legal_entity_id, entity_kind, industry)
        values (${id}, ${access.tenantId}, ${base.jurisdiction_id}, ${input.code}, ${input.name}, ${input.currencyCode ?? base.currency}, 'active',
          ${input.parentId}, ${input.kind}, ${input.industry})`,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.company_create', 'legal_entity', ${id},
          'Company added to the group structure', ${JSON.stringify(input)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
    ]);
  } catch (error) {
    structureError(error);
  }
  const created = (await listCompanies(access)).find((company) => company.id === id);
  if (!created) throw new HttpError({ status: 500, code: "INTERNAL_ERROR", message: "The company was not saved." });
  return created;
}

export async function updateCompany(access: Access, id: string, input: z.infer<typeof updateCompanySchema>, requestId: string): Promise<CompanyRow> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const current = (await listCompanies(access)).find((company) => company.id === id);
  if (!current) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The company was not found." });
  const next = {
    name: input.name ?? current.name,
    parentId: input.parentId === undefined ? current.parentId : input.parentId,
    kind: input.kind ?? current.kind,
    industry: input.industry === undefined ? current.industry : input.industry,
    status: input.status ?? current.status,
  };
  try {
    await tenantTx(access, [
      sqlClient`
        update legal_entities set legal_name = ${next.name}, parent_legal_entity_id = ${next.parentId}, entity_kind = ${next.kind},
          industry = ${next.industry}, status = ${next.status}, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}`,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.company_update', 'legal_entity', ${id},
          ${input.reason}, ${JSON.stringify(current)}::jsonb, ${JSON.stringify(next)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
    ]);
  } catch (error) {
    structureError(error);
  }
  return (await listCompanies(access)).find((company) => company.id === id)!;
}
