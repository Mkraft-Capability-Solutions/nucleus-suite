import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
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

/**
 * A statutory code as the workbook bounds it: Char(22) of the uppercase letters, digits and
 * separators Indian PF and ESI establishment codes use. The workbook says "format validated"
 * without stating the format, so this rejects obviously-wrong input without inventing a
 * jurisdiction-specific pattern - see tmp/_audit/requests/talent.md.
 */
const statutoryCode = z.string().trim().min(1).max(22).regex(/^[A-Z0-9/\-]+$/, "Use uppercase letters, digits, / and - only.");

/**
 * CTG-01 vendor master. The labour licence and the PF/ESI codes belong to the vendor rather
 * than to one contract, so they are held here once and checked against each contract period
 * and each deployment.
 */
export const createAgencySchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(40),
  registration: z.string().trim().max(120).optional(),
  pan: z.string().trim().max(10).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  licenceNo: z.string().trim().min(1).max(60),
  licenceValidTill: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorPfCode: statutoryCode,
  vendorEsiCode: statutoryCode,
});

export async function createAgency(access: Access, input: z.infer<typeof createAgencySchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_organizations (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({
        name: input.name,
        code: input.code,
        registration: input.registration ?? null,
        pan: input.pan ?? null,
        contact_person: input.contactPerson ?? null,
        contact_phone: input.contactPhone ?? null,
        licence_no: input.licenceNo,
        licence_valid_till: input.licenceValidTill,
        vendor_pf_code: input.vendorPfCode,
        vendor_esi_code: input.vendorEsiCode,
      })}::jsonb)
    `,
  ]);
  return { id };
}

/**
 * CTG-01 engagement. `code` is the workbook's `contract_ref`, unique per vendor.
 *
 * The rate card must meet the state minimum wage for each skill. No minimum-wage table exists
 * in this repository, so that test is not run here and the gap is recorded rather than a floor
 * being invented - see tmp/_audit/requests/talent.md.
 */
export const createContractSchema = z.object({
  agencyId: z.string().uuid(),
  code: z.string().trim().min(1).max(40),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locationCode: z.string().trim().min(1).max(60),
  orgUnit: z.string().trim().min(1).max(80),
  scopeOfWork: z.string().trim().min(50).max(1000),
  workerClass: z.enum(picklistValues("PL_WORKER_CLASS")),
  sanctionedCount: z.number().int().min(1).max(10_000),
  /** The workbook's repeating rate card: skill, daily rate, OT rate. */
  rateCard: z.array(z.object({
    skill: z.string().trim().min(1).max(80),
    dailyRateMinor: z.number().int().positive(),
    overtimeRateMinor: z.number().int().nonnegative(),
  })).min(1).max(50),
  attendanceRequired: z.boolean().default(true),
  status: z.enum(picklistValues("PL_ACTIVE_STATUS")).default("active"),
  monthlyMinor: z.number().int().positive(),
  varianceThresholdPct: z.number().min(0).max(100).default(2),
}).superRefine((value, context) => {
  if (value.endsOn < value.startsOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "The contract period ends before it starts." });
  }
});

export async function createContract(access: Access, input: z.infer<typeof createContractSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.endsOn < input.startsOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The contract period ends before it starts." });
  }
  const [agencyRows] = await tenantTx(access, [
    sqlClient`select attributes from contractor_organizations where tenant_id = ${access.tenantId} and id = ${input.agencyId} limit 1`,
  ]);
  const agency = (agencyRows as Array<{ attributes: { licence_valid_till?: string | null } }>)[0];
  if (!agency) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // Contract Labour Act: the vendor's licence must still be valid at the end of the period it works.
  const licenceValidTill = agency.attributes.licence_valid_till ?? null;
  if (licenceValidTill !== null && licenceValidTill < input.endsOn) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: `The vendor's labour licence expires on ${licenceValidTill}, before this contract ends on ${input.endsOn}.`,
      details: [{ field: "endsOn", issue: "Licence validity must cover the whole contract period." }],
    });
  }
  const [duplicateRows] = await tenantTx(access, [
    sqlClient`select id from contractor_contracts where tenant_id = ${access.tenantId} and contractor_organization_id = ${input.agencyId} and attributes->>'code' = ${input.code} limit 1`,
  ]);
  if ((duplicateRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Contract reference ${input.code} already exists for this vendor.` });
  }
  const entityId = await ensureLegalEntity(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_contracts (id, tenant_id, contractor_organization_id, legal_entity_id, attributes)
      values (${id}, ${access.tenantId}, ${input.agencyId}, ${entityId},
        ${JSON.stringify({
          code: input.code,
          contract_number: input.code,
          starts_on: input.startsOn,
          ends_on: input.endsOn,
          location_code: input.locationCode,
          org_unit: input.orgUnit,
          scope_of_work: input.scopeOfWork,
          worker_class: input.workerClass,
          sanctioned_count: input.sanctionedCount,
          rate_card: input.rateCard,
          attendance_required: input.attendanceRequired,
          monthly_minor: input.monthlyMinor,
          variance_threshold_pct: input.varianceThresholdPct,
          status: input.status,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'contractor.contract_create', 'contractor_contract', ${id}, 'Contractor contract created', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: input.status };
}

/**
 * CTG-02 submission half. `billedMinor` is the workbook's `invoice_amount` under the name the
 * reconciliation console already reads it by, and `contractId` its `engagement_id`.
 *
 * Attendance days, the variance and the approved amount are not inputs: the first two are
 * computed by `@/server/contractors/reconciliation` from captured attendance, and the third is
 * recorded when the variance is dispositioned.
 */
export const submitInvoiceSchema = z.object({
  contractId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(40),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractedMinor: z.number().int().positive(),
  billedMinor: z.number().int().positive(),
  gstMinor: z.number().int().nonnegative().optional(),
  /** The workbook's repeating claim table: skill, days, rate, amount. */
  claimedDays: z.array(z.object({
    skill: z.string().trim().min(1).max(80),
    days: z.number().nonnegative(),
    dailyRateMinor: z.number().int().nonnegative(),
    amountMinor: z.number().int().nonnegative(),
  })).min(1).max(50),
  claimedOtHours: z.number().nonnegative().default(0),
  /** Proof of the vendor's PF/ESI remittance. Payment is held until it is on file. */
  vendorRemittanceRef: z.string().trim().min(1).max(200),
  period: z.string().regex(/^\d{4}-\d{2}$/),
}).superRefine((value, context) => {
  const lineTotal = value.claimedDays.reduce((sum, line) => sum + line.amountMinor, 0);
  if (lineTotal !== value.billedMinor) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billedMinor"],
      message: `The invoice amount must equal the claimed lines. Lines total ${lineTotal}, invoice states ${value.billedMinor}.`,
    });
  }
});

export async function submitInvoice(access: Access, input: z.infer<typeof submitInvoiceSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [contractRows] = await tenantTx(access, [
    sqlClient`select contractor_organization_id, attributes from contractor_contracts where tenant_id = ${access.tenantId} and id = ${input.contractId} limit 1`,
  ]);
  const contract = (contractRows as Array<{ contractor_organization_id: string; attributes: { variance_threshold_pct: number } }>)[0];
  if (!contract) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // CTG-02: the invoice number is unique per vendor and year, so the year is part of the key.
  const invoiceYear = input.invoiceDate.slice(0, 4);
  const [duplicateRows] = await tenantTx(access, [
    sqlClient`
      select inv.id from contractor_invoices inv
      join contractor_contracts ct on ct.tenant_id = inv.tenant_id and ct.id = inv.contractor_contract_id
      where inv.tenant_id = ${access.tenantId}
        and ct.contractor_organization_id = ${contract.contractor_organization_id}
        and inv.attributes->>'invoice_number' = ${input.invoiceNumber}
        and left(coalesce(inv.attributes->>'invoice_date', ''), 4) = ${invoiceYear}
      limit 1
    `,
  ]);
  if ((duplicateRows as unknown[]).length > 0) {
    throw new HttpError({
      status: 409, code: "VERSION_CONFLICT",
      message: `Invoice ${input.invoiceNumber} has already been submitted by this vendor for ${invoiceYear}.`,
    });
  }
  const variancePct = Math.abs(input.billedMinor - input.contractedMinor) / input.contractedMinor * 100;
  const held = variancePct > (contract.attributes.variance_threshold_pct ?? 2);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into contractor_invoices (id, tenant_id, contractor_contract_id, attributes)
      values (${id}, ${access.tenantId}, ${input.contractId},
        ${JSON.stringify({
          invoice_number: input.invoiceNumber,
          invoice_date: input.invoiceDate,
          contracted_minor: input.contractedMinor,
          billed_minor: input.billedMinor,
          gst_minor: input.gstMinor ?? null,
          claimed_ot_hours: input.claimedOtHours,
          vendor_remittance_ref: input.vendorRemittanceRef,
          variance_pct: Math.round(variancePct * 100) / 100,
          period: input.period,
          status: held ? "held" : "approved",
          reconciliation_status: held ? "held" : "matched",
        })}::jsonb)
    `,
    ...input.claimedDays.map((line) => sqlClient`
      insert into contractor_invoice_lines (tenant_id, contractor_invoice_id, attributes)
      values (${access.tenantId}, ${id},
        ${JSON.stringify({ skill: line.skill, days: line.days, daily_rate_minor: line.dailyRateMinor, amount_minor: line.amountMinor })}::jsonb)
    `),
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
  /** The badge the gate reads. `listContractWorkers` shows it as the worker code. */
  gateBadgeNumber: z.string().trim().max(40).optional(),
  trade: z.string().trim().max(80).optional(),
  category: z.enum(["contract", "third-party-employee", "third-party-helper"]).default("contract"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function assignWorker(access: Access, input: z.infer<typeof assignWorkerSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [contractRows] = await tenantTx(access, [
    sqlClient`
      select ct.attributes as contract_attributes, org.attributes as agency_attributes,
        (select count(*)::int from contract_worker_assignments cwa
          where cwa.tenant_id = ct.tenant_id and cwa.contractor_contract_id = ct.id) as deployed
      from contractor_contracts ct
      left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
      where ct.tenant_id = ${access.tenantId} and ct.id = ${input.contractId} limit 1
    `,
  ]);
  const contract = (contractRows as Array<{
    contract_attributes: { sanctioned_count?: number | null };
    agency_attributes: { licence_no?: string | null; licence_valid_till?: string | null } | null;
    deployed: number;
  }>)[0];
  if (!contract) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // CTG-01: an expired labour licence blocks new deployment, whatever the contract says.
  const licenceValidTill = contract.agency_attributes?.licence_valid_till ?? null;
  if (licenceValidTill !== null && licenceValidTill < input.startsOn) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: `The vendor's labour licence expired on ${licenceValidTill}; no further worker can be deployed under it.`,
    });
  }
  const sanctioned = contract.contract_attributes.sanctioned_count ?? null;
  if (sanctioned !== null && contract.deployed >= sanctioned) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: `This contract's sanctioned deployment of ${sanctioned} is already filled.`,
    });
  }
  const personId = crypto.randomUUID();
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`
      insert into contract_worker_assignments (id, tenant_id, contractor_contract_id, person_id, attributes)
      values (${id}, ${access.tenantId}, ${input.contractId}, ${personId},
        ${JSON.stringify({
          worker_name: input.personName,
          gate_badge_number: input.gateBadgeNumber ?? null,
          trade: input.trade ?? null,
          category: input.category,
          starts_on: input.startsOn,
          status: "active",
        })}::jsonb)
    `,
  ]);
  return { id, personId, status: "active" };
}
