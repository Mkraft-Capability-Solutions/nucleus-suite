import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Staffing vendor (contractor agency) master. Tenant scoped; `employee.read` to list, `employee.write` to create.
 * Agency names are unique per tenant (case-insensitive). Statutory filing state comes from the latest
 * `contractor_statutory_evidence` row per agency; an agency without evidence reports null, never a made-up status.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

export const createAgencySchema = z.object({
  name: z.string().trim().min(2, "Enter the agency name.").max(200),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,24}$/, "Use 2 to 24 capital letters, digits and hyphens.").optional().or(z.literal("").transform(() => undefined)),
  registration: optionalText(120),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN, for example ABCDE1234F.").optional().or(z.literal("").transform(() => undefined)),
  contactPerson: optionalText(120),
  contactPhone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/, "Enter a valid phone number.").optional().or(z.literal("").transform(() => undefined)),
});
export type CreateAgency = z.infer<typeof createAgencySchema>;

export type AgencyMasterRow = {
  id: string;
  name: string | null;
  code: string | null;
  licenceNumber: string | null;
  pan: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contractCount: number;
  workerCount: number;
  pfEvidence: { status: string | null; period: string | null };
  esicEvidence: { status: string | null; period: string | null };
};

type AgencyQueryRow = Record<string, string | number | null>;

const s = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? null : String(value));

export function projectAgency(row: AgencyQueryRow): AgencyMasterRow {
  return {
    id: String(row.id),
    name: s(row.name),
    code: s(row.code),
    licenceNumber: s(row.licence_number),
    pan: s(row.pan),
    contactPerson: s(row.contact_person),
    contactPhone: s(row.contact_phone),
    contractCount: Number(row.contract_count) || 0,
    workerCount: Number(row.worker_count) || 0,
    pfEvidence: { status: s(row.pf_status), period: s(row.pf_period) },
    esicEvidence: { status: s(row.esic_status), period: s(row.esic_period) },
  };
}

/** Evidence rows carry an `evidence_type` (pf / ecr / esic); the newest period of each kind wins. */
const evidence = (kind: "pf" | "esic", column: "verification_status" | "period") => `(select ev.attributes->>'${column}'
    from contractor_statutory_evidence ev
    where ev.tenant_id = org.tenant_id and ev.contractor_organization_id = org.id
      and lower(coalesce(ev.attributes->>'evidence_type', ev.attributes->>'type', '')) ${kind === "pf" ? "in ('pf', 'ecr', 'pf_ecr', 'epf')" : "in ('esic', 'esi', 'esic_return')"}
    order by coalesce(ev.attributes->>'period', '') desc limit 1)`;

export async function listAgencyMaster(access: Access): Promise<AgencyMasterRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select org.id, org.attributes->>'name' as name, org.attributes->>'code' as code,
         coalesce(org.attributes->>'licence_number', org.attributes->>'license_number', org.attributes->>'registration') as licence_number,
         org.attributes->>'pan' as pan, org.attributes->>'contact_person' as contact_person, org.attributes->>'contact_phone' as contact_phone,
         (select count(*) from contractor_contracts ct where ct.tenant_id = org.tenant_id and ct.contractor_organization_id = org.id) as contract_count,
         (select count(*) from contract_worker_assignments cwa
            join contractor_contracts ct on ct.tenant_id = cwa.tenant_id and ct.id = cwa.contractor_contract_id
            where cwa.tenant_id = org.tenant_id and ct.contractor_organization_id = org.id
              and coalesce(cwa.attributes->>'status', 'active') = 'active') as worker_count,
         ${evidence("pf", "verification_status")} as pf_status, ${evidence("pf", "period")} as pf_period,
         ${evidence("esic", "verification_status")} as esic_status, ${evidence("esic", "period")} as esic_period
       from contractor_organizations org
       where org.tenant_id = $1
       order by coalesce(org.attributes->>'name', '')
       limit 200`,
      [access.tenantId],
    ),
  ]);
  return (rows as AgencyQueryRow[]).map(projectAgency);
}

export async function createAgencyRecord(access: Access, input: CreateAgency, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [existing] = await tenantTx(access, [
    sqlClient`select id from contractor_organizations where tenant_id = ${access.tenantId} and lower(attributes->>'name') = ${input.name.toLowerCase()} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `An agency named ${input.name} already exists.`, details: [{ field: "name", issue: "duplicate" }] });
  }
  const id = randomUUID();
  const attributes = {
    name: input.name,
    code: input.code ?? null,
    registration: input.registration ?? null,
    licence_number: input.registration ?? null,
    pan: input.pan ?? null,
    contact_person: input.contactPerson ?? null,
    contact_phone: input.contactPhone ?? null,
  };
  await tenantTx(access, [
    sqlClient`insert into contractor_organizations (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'contractor.agency_create',
        'contractor_organization', ${id}, 'Contractor agency created', '{}'::jsonb, ${JSON.stringify({ name: input.name, code: input.code ?? null })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, name: input.name, code: input.code ?? null };
}
