import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

async function ensureLegalEntity(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  let id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) {
    const [jurisdictionRows] = await tenantTx(access, [
      sqlClient`select id from jurisdictions limit 1`,
    ]);
    const jurisdictionId = (jurisdictionRows as Array<{ id: string }>)[0]?.id ?? null;
    id = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status) values (${id}, ${access.tenantId}, ${jurisdictionId}, 'MK-IND', 'Nucleus / MKraft Technologies India Pvt Ltd', 'INR', 'active') on conflict do nothing`,
    ]);
  }
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
  contractId: z.string().uuid().optional(),
  vendorName: z.string().trim().optional(),
  personName: z.string().trim().min(1).max(120),
  category: z.enum(["contract", "third-party-employee", "third-party-helper"]).default("contract"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  role: z.string().trim().max(80).optional().default("Contract Operative"),
  uan: z.string().trim().max(30).optional().default("100982347891"),
  aadhaar: z.string().trim().max(30).optional(),
  site: z.string().trim().max(80).optional().default("Bangalore Electronic City Plant 1"),
  shift: z.string().trim().max(40).optional().default("General Plant Shift"),
  dailyWage: z.number().nonnegative().optional().default(650),
});

export async function assignWorker(access: Access, rawInput: z.input<typeof assignWorkerSchema>) {
  const input = assignWorkerSchema.parse(rawInput);
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  let effectiveContractId = input.contractId;
  let effectiveVendorName = input.vendorName;

  if (!effectiveContractId) {
    const [contractRows] = await tenantTx(access, [
      sqlClient`
        select c.id, o.attributes->>'name' as vendor_name 
        from contractor_contracts c
        left join contractor_organizations o on o.id = c.contractor_organization_id
        where c.tenant_id = ${access.tenantId}
        order by c.created_at asc
        limit 1
      `,
    ]);
    const firstContract = (contractRows as Array<{ id: string; vendor_name?: string }>)[0];
    if (firstContract?.id) {
      effectiveContractId = firstContract.id;
      if (!effectiveVendorName && firstContract.vendor_name) {
        effectiveVendorName = firstContract.vendor_name;
      }
    } else {
      // Ensure contractor org
      const [orgRows] = await tenantTx(access, [
        sqlClient`select id from contractor_organizations where tenant_id = ${access.tenantId} limit 1`,
      ]);
      let orgId = (orgRows as Array<{ id: string }>)[0]?.id;
      if (!orgId) {
        const newOrg = await createAgency(access, { name: input.vendorName || "Nucleus Prime Contractors" });
        orgId = newOrg.id;
      }
      const newContract = await createContract(
        access,
        {
          agencyId: orgId,
          code: `CNT-${Date.now().toString().slice(-4)}`,
          startsOn: input.startsOn,
          endsOn: "2027-12-31",
          monthlyMinor: 5000000,
          varianceThresholdPct: 2,
        },
        crypto.randomUUID()
      );
      effectiveContractId = newContract.id;
    }
  }

  const personId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const workerCode = `CW-${Math.floor(1000 + Math.random() * 9000)}`;

  // Demo Point 2 & 3: Contractual Employees & Helpers don't have Rest Days; 3rd party employees do have Rest Days
  const hasRestDays = input.category === "third-party-employee";

  const workerAttributes = {
    worker_code: workerCode,
    person_name: input.personName,
    vendor_name: effectiveVendorName || "Shree Powerloom Services",
    category: input.category,
    starts_on: input.startsOn,
    role: input.role,
    uan: input.uan,
    aadhaar: input.aadhaar ?? null,
    site: input.site,
    shift: input.shift,
    daily_wage: input.dailyWage,
    has_rest_days: hasRestDays,
    status: "active",
  };

  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`
      insert into contract_worker_assignments (id, tenant_id, contractor_contract_id, person_id, attributes)
      values (${id}, ${access.tenantId}, ${effectiveContractId}, ${personId},
        ${JSON.stringify(workerAttributes)}::jsonb)
    `,
  ]);

  return {
    id,
    workerCode,
    personId,
    name: input.personName,
    vendor: workerAttributes.vendor_name,
    category: input.category,
    role: input.role,
    uan: input.uan,
    site: input.site,
    shift: input.shift,
    dailyWage: input.dailyWage,
    hasRestDays,
    status: "Active",
  };
}

export async function listContractWorkers(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select 
        a.id,
        a.person_id,
        a.contractor_contract_id,
        a.attributes,
        a.created_at,
        coalesce(a.attributes->>'vendor_name', o.attributes->>'name', 'Shree Powerloom Services') as vendor_name,
        coalesce(c.attributes->>'code', 'CNT-MAIN') as contract_code
      from contract_worker_assignments a
      left join contractor_contracts c on c.id = a.contractor_contract_id
      left join contractor_organizations o on o.id = c.contractor_organization_id
      where a.tenant_id = ${access.tenantId}
      order by a.created_at desc
      limit 200
    `,
  ]);

  return (rows as Array<{
    id: string;
    person_id: string;
    attributes: Record<string, unknown>;
    created_at: string;
    vendor_name: string;
    contract_code: string;
  }>).map((r) => {
    const attr = r.attributes || {};
    const category = (attr.category as string) || "contract";
    const hasRestDays = category === "third-party-employee";
    return {
      id: (attr.worker_code as string) || `CW-${r.id.slice(0, 4)}`,
      assignmentId: r.id,
      personId: r.person_id,
      name: (attr.person_name as string) || "Contract Worker",
      vendor: (attr.vendor_name as string) || r.vendor_name,
      category,
      role: (attr.role as string) || "Contract Operative",
      uan: (attr.uan as string) || "100982347891",
      site: (attr.site as string) || "Bangalore Electronic City Plant 1",
      shift: (attr.shift as string) || "General Plant Shift",
      dailyWage: (attr.daily_wage as number) || 650,
      hasRestDays: attr.has_rest_days !== undefined ? Boolean(attr.has_rest_days) : hasRestDays,
      status: (attr.status as string) || "Active",
      startsOn: (attr.starts_on as string) || r.created_at?.slice(0, 10),
    };
  });
}
