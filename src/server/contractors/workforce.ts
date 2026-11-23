import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Contract workforce register (principal-employer view of contract labour).
 *
 * Reads `contract_worker_assignments` joined to the contract, the agency and the deployment location. Nothing is
 * invented: an attribute the record does not carry is returned as null and the console shows it as "not recorded".
 * Writes require a real contract (no auto-created agency or contract) and a real tenant location, and are audited.
 * Aadhaar is never stored in full: only the last four digits are kept, for matching against KYC paperwork.
 */

export const WORKER_CATEGORIES = ["contract", "third-party-employee", "third-party-helper"] as const;
export type WorkerCategory = (typeof WORKER_CATEGORIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.");
const twelveDigits = (message: string) => z.string().trim().regex(/^\d{12}$/, message).optional().or(z.literal("").transform(() => undefined));

export const assignContractWorkerSchema = z.object({
  contractId: z.string().uuid("Choose the agency contract."),
  personName: z.string().trim().min(2, "Enter the worker's full name.").max(120),
  category: z.enum(WORKER_CATEGORIES),
  role: z.string().trim().min(2, "Enter the role or trade.").max(80),
  dailyWage: z.number().positive("The daily wage must be greater than zero.").max(100_000),
  uan: twelveDigits("UAN must be 12 digits."),
  esicNumber: z.string().trim().regex(/^\d{10,17}$/, "ESIC number must be 10 to 17 digits.").optional().or(z.literal("").transform(() => undefined)),
  aadhaar: twelveDigits("Aadhaar must be 12 digits."),
  locationId: z.string().uuid("Choose the work site."),
  startsOn: isoDate,
});
export type AssignContractWorker = z.infer<typeof assignContractWorkerSchema>;

/** Statutory rule used by the register: only third-party skilled employees earn paid weekly rest days. */
export function restDaysFor(category: string): boolean {
  return category === "third-party-employee";
}

export type ComplianceState = "verified" | "pending_verification" | "kyc_incomplete";

/** KYC state: verified only when a reviewer marked it so; missing UAN means the KYC itself is incomplete. */
export function complianceFor(verified: unknown, uan: string | null): ComplianceState {
  if (verified === true || verified === "true") return "verified";
  return uan ? "pending_verification" : "kyc_incomplete";
}

export type ContractWorkerView = {
  id: string;
  workerCode: string | null;
  name: string | null;
  agencyId: string | null;
  agencyName: string | null;
  contractId: string;
  contractCode: string | null;
  category: string | null;
  trade: string | null;
  uan: string | null;
  esicNumber: string | null;
  site: string | null;
  dailyWage: number | null;
  currency: string;
  hasRestDays: boolean;
  compliance: ComplianceState;
  status: string | null;
  startsOn: string | null;
};

type WorkerQueryRow = {
  id: string;
  contractor_contract_id: string;
  attributes: Record<string, unknown> | null;
  agency_id: string | null;
  agency_name: string | null;
  contract_code: string | null;
  location_name: string | null;
  currency: string | null;
  total: number | string;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function projectWorker(row: WorkerQueryRow): ContractWorkerView {
  const attr = row.attributes ?? {};
  const category = text(attr.category);
  const uan = text(attr.uan);
  return {
    id: row.id,
    workerCode: text(attr.worker_code) ?? text(attr.gate_badge_number),
    name: text(attr.worker_name) ?? text(attr.person_name),
    agencyId: row.agency_id,
    agencyName: text(row.agency_name) ?? text(attr.vendor_name),
    contractId: row.contractor_contract_id,
    contractCode: text(row.contract_code),
    category,
    trade: text(attr.trade) ?? text(attr.role),
    uan,
    esicNumber: text(attr.esic_number) ?? text(attr.esic),
    site: text(row.location_name) ?? text(attr.site),
    dailyWage: num(attr.daily_wage),
    currency: text(row.currency) ?? "INR",
    hasRestDays: typeof attr.has_rest_days === "boolean" ? attr.has_rest_days : restDaysFor(category ?? ""),
    compliance: complianceFor(attr.verified, uan),
    status: text(attr.status),
    startsOn: text(attr.starts_on),
  };
}

/** One page of the register, newest first, with an optional free-text search across name, code, agency, trade and site. */
export async function listContractWorkforce(
  access: Access,
  options: { page: number; pageSize: number; search?: string | null },
): Promise<{ items: ContractWorkerView[]; total: number }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const search = options.search?.trim() ? `%${options.search.trim().toLowerCase()}%` : "";
  const offset = (options.page - 1) * options.pageSize;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select cwa.id, cwa.contractor_contract_id, cwa.attributes,
         org.id as agency_id, org.attributes->>'name' as agency_name,
         coalesce(ct.attributes->>'contract_number', ct.attributes->>'code') as contract_code,
         loc.attributes->>'name' as location_name,
         ten.default_currency as currency,
         count(*) over () as total
       from contract_worker_assignments cwa
       join contractor_contracts ct on ct.tenant_id = cwa.tenant_id and ct.id = cwa.contractor_contract_id
       left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
       left join locations loc on loc.tenant_id = cwa.tenant_id and loc.id::text = cwa.attributes->>'location_id'
       left join tenants ten on ten.id = cwa.tenant_id
       where cwa.tenant_id = $1
         and ($2 = '' or lower(concat_ws(' ', cwa.attributes->>'worker_name', cwa.attributes->>'person_name',
               cwa.attributes->>'worker_code', cwa.attributes->>'trade', cwa.attributes->>'role',
               org.attributes->>'name', loc.attributes->>'name', cwa.attributes->>'site')) like $2)
       order by cwa.created_at desc
       limit $3 offset $4`,
      [access.tenantId, search, options.pageSize, offset],
    ),
  ]);
  const list = rows as WorkerQueryRow[];
  return { items: list.map(projectWorker), total: Number(list[0]?.total ?? 0) };
}

export type ContractOption = { id: string; code: string | null; agencyId: string; agencyName: string | null; status: string | null; startsOn: string | null; endsOn: string | null };

/** Contracts a worker can be deployed under, with their agency, for the register form. */
export async function listContractOptions(access: Access): Promise<ContractOption[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select ct.id, coalesce(ct.attributes->>'contract_number', ct.attributes->>'code') as code,
        ct.contractor_organization_id as agency_id, org.attributes->>'name' as agency_name,
        ct.attributes->>'status' as status, ct.attributes->>'starts_on' as starts_on, ct.attributes->>'ends_on' as ends_on
      from contractor_contracts ct
      left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
      where ct.tenant_id = ${access.tenantId}
      order by coalesce(org.attributes->>'name', ''), ct.created_at desc limit 200`,
  ]);
  return (rows as Array<Record<string, string | null>>).map((row) => ({
    id: String(row.id), code: row.code, agencyId: String(row.agency_id), agencyName: row.agency_name,
    status: row.status, startsOn: row.starts_on, endsOn: row.ends_on,
  }));
}

/** Registers a contract worker against an existing contract and location. Audited; the caller handles idempotency. */
export async function assignContractWorker(access: Access, input: AssignContractWorker, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [contracts, locations] = await tenantTx(access, [
    sqlClient`select ct.id, ct.attributes->>'status' as status, ct.attributes->>'starts_on' as starts_on, ct.attributes->>'ends_on' as ends_on,
        org.attributes->>'name' as agency_name
      from contractor_contracts ct
      left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
      where ct.tenant_id = ${access.tenantId} and ct.id = ${input.contractId} limit 1`,
    sqlClient`select id, attributes->>'name' as name from locations where tenant_id = ${access.tenantId} and id = ${input.locationId} limit 1`,
  ]);
  const contract = (contracts as Array<{ id: string; status: string | null; starts_on: string | null; ends_on: string | null; agency_name: string | null }>)[0];
  if (!contract) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The selected contract does not exist.", details: [{ field: "contractId", issue: "unknown" }] });
  }
  if (contract.status && contract.status.toLowerCase() !== "active") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Workers can only be deployed under an active contract.", details: [{ field: "contractId", issue: "inactive" }] });
  }
  if ((contract.starts_on && input.startsOn < contract.starts_on) || (contract.ends_on && input.startsOn > contract.ends_on)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The start date is outside the contract period.", details: [{ field: "startsOn", issue: "outside_contract" }] });
  }
  const location = (locations as Array<{ id: string; name: string | null }>)[0];
  if (!location) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The selected work site does not exist.", details: [{ field: "locationId", issue: "unknown" }] });
  }

  const id = randomUUID();
  const personId = randomUUID();
  const workerCode = `CW-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const hasRestDays = restDaysFor(input.category);
  const attributes = {
    worker_code: workerCode,
    worker_name: input.personName,
    category: input.category,
    trade: input.role,
    daily_wage: input.dailyWage,
    uan: input.uan ?? null,
    esic_number: input.esicNumber ?? null,
    aadhaar_last4: input.aadhaar ? input.aadhaar.slice(-4) : null,
    location_id: location.id,
    site: location.name,
    starts_on: input.startsOn,
    has_rest_days: hasRestDays,
    verified: false,
    status: "active",
  };
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`insert into contract_worker_assignments (id, tenant_id, contractor_contract_id, person_id, attributes)
      values (${id}, ${access.tenantId}, ${contract.id}, ${personId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'contractor.worker_assign',
        'contract_worker_assignment', ${id}, 'Contract worker registered', '{}'::jsonb,
        ${JSON.stringify({ worker_code: workerCode, contract_id: contract.id, location_id: location.id, category: input.category })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, workerCode, personId, name: input.personName, agencyName: contract.agency_name, site: location.name, hasRestDays, status: "active" };
}
