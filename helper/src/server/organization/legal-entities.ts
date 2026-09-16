import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues, picklists } from "@/lib/picklists";
import {
  ESI_EMPLOYER_PATTERN,
  PF_ESTABLISHMENT_PATTERN,
  TAN_PATTERN,
  gstinMatchesState,
  isCinOrLlpin,
  isEntityPan,
  jurisdictionCodeFor,
} from "@/server/organization/entity-identifiers";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Legal Entity Master (FRM-PLT-01).
 *
 * `legal_entities` keeps its typed columns for what the rest of the system joins on
 * (`code`, `legal_name`, `currency_code`, `status`); everything else the workbook captures
 * lives on the `attributes` bag migration 0023 added, keyed by the workbook's own field
 * names so the audit trail reads against the spec.
 */

/** Address block: the workbook's grouped address fields, one object per address. */
export const addressBlockSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.enum(picklistValues("PL_STATE")),
  /** Six digits. The workbook's PIN-to-state check needs a PIN master the app does not carry. */
  pin: z.string().trim().regex(/^\d{6}$/, "PIN must be six digits."),
});

export type AddressBlock = z.infer<typeof addressBlockSchema>;

/** ISO 4217 alpha code, lower case on the wire like every other picklist value. */
const currencySchema = z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "Use a three-letter ISO 4217 code.");

export const legalEntitySchema = z.object({
  entityCode: z.string().trim().min(1).max(10).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Uppercase letters, digits, hyphen and underscore only; no spaces."),
  registeredName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional(),
  entityType: z.enum(picklistValues("PL_ENTITY_TYPE")).default("private_limited"),
  cinLlpin: z.string().trim().toUpperCase().refine(isCinOrLlpin, "Enter a 21-character CIN or an 8-character LLPIN (AAA-1234)."),
  entityPan: z.string().trim().toUpperCase().refine(isEntityPan, "PAN must read ABCDE1234F with C, F, A or T as the fourth character."),
  tan: z.string().trim().toUpperCase().regex(TAN_PATTERN, "TAN must read ABCD12345E."),
  gstin: z.string().trim().toUpperCase().max(15).optional(),
  pfCode: z.string().trim().toUpperCase().regex(PF_ESTABLISHMENT_PATTERN, "PF code must read Region/Office/Establishment/Extension, e.g. MH/BAN/0012345/000.").optional(),
  esiCode: z.string().trim().regex(ESI_EMPLOYER_PATTERN, "ESI employer code must be 17 digits.").optional(),
  ptRegNo: z.string().trim().max(30).optional(),
  lwfRegNo: z.string().trim().max(30).optional(),
  establishmentLicence: z.string().trim().max(40).optional(),
  establishmentType: z.enum(picklistValues("PL_ESTB_TYPE")).default("factory"),
  registeredAddress: addressBlockSchema,
  /** Null or absent means the communication address is the registered address. */
  commAddress: addressBlockSchema.nullable().optional(),
  fyStartMonth: z.enum(picklistValues("PL_MONTH")).default("april"),
  currencyCode: currencySchema.default("inr"),
  signatoryName: z.string().trim().min(1).max(100),
  signatoryDesignation: z.string().trim().min(1).max(60),
  entityStatus: z.enum(picklistValues("PL_ACTIVE_STATUS")).default("active"),
  effectiveFrom: z.iso.date().optional(),
}).superRefine((value, ctx) => {
  // "State code must match address": the first two GSTIN digits are the registered state.
  if (value.gstin && !gstinMatchesState(value.gstin, value.registeredAddress.state)) {
    ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN must be 15 characters and carry the registered address state code." });
  }
});

export type LegalEntityInput = z.infer<typeof legalEntitySchema>;

/** Edit form: any subset; the service merges it over the stored record and re-validates. */
export const updateLegalEntitySchema = z.object({
  entityCode: z.string().trim().min(1).max(10).optional(),
  registeredName: z.string().trim().min(2).max(200).optional(),
  tradeName: z.string().trim().max(200).nullable().optional(),
  entityType: z.enum(picklistValues("PL_ENTITY_TYPE")).optional(),
  cinLlpin: z.string().trim().optional(),
  entityPan: z.string().trim().optional(),
  tan: z.string().trim().optional(),
  gstin: z.string().trim().nullable().optional(),
  pfCode: z.string().trim().nullable().optional(),
  esiCode: z.string().trim().nullable().optional(),
  ptRegNo: z.string().trim().nullable().optional(),
  lwfRegNo: z.string().trim().nullable().optional(),
  establishmentLicence: z.string().trim().nullable().optional(),
  establishmentType: z.enum(picklistValues("PL_ESTB_TYPE")).optional(),
  registeredAddress: addressBlockSchema.optional(),
  commAddress: addressBlockSchema.nullable().optional(),
  fyStartMonth: z.enum(picklistValues("PL_MONTH")).optional(),
  currencyCode: z.string().trim().optional(),
  signatoryName: z.string().trim().optional(),
  signatoryDesignation: z.string().trim().optional(),
  entityStatus: z.enum(picklistValues("PL_ACTIVE_STATUS")).optional(),
  effectiveFrom: z.iso.date().optional(),
});

export type LegalEntityPatch = z.infer<typeof updateLegalEntitySchema>;

/** The attribute bag exactly as stored, keyed by the workbook field names. */
export type LegalEntityAttributes = {
  trade_name: string | null;
  entity_type: string;
  cin_llpin: string;
  entity_pan: string;
  tan: string;
  gstin: string | null;
  pf_code: string | null;
  esi_code: string | null;
  pt_reg_no: string | null;
  lwf_reg_no: string | null;
  establishment_licence: string | null;
  establishment_type: string;
  registered_address: AddressBlock;
  comm_address: AddressBlock | null;
  fy_start_month: string;
  signatory_name: string;
  signatory_designation: string;
  effective_from: string;
};

export type LegalEntityRow = {
  id: string;
  code: string;
  legal_name: string;
  currency_code: string | null;
  status: string;
  attributes: Partial<LegalEntityAttributes>;
  headcount: number;
  /** True once a payroll run exists for the entity: code and currency are then immutable. */
  locked: boolean;
  version: number;
};

/** Pure: the stored shape for one validated form, so create and edit write the same keys. */
export function legalEntityAttributes(input: LegalEntityInput, today: string): LegalEntityAttributes {
  return {
    trade_name: input.tradeName || null,
    entity_type: input.entityType,
    cin_llpin: input.cinLlpin,
    entity_pan: input.entityPan,
    tan: input.tan,
    gstin: input.gstin || null,
    pf_code: input.pfCode || null,
    esi_code: input.esiCode || null,
    pt_reg_no: input.ptRegNo || null,
    lwf_reg_no: input.lwfRegNo || null,
    establishment_licence: input.establishmentLicence || null,
    establishment_type: input.establishmentType,
    registered_address: input.registeredAddress,
    comm_address: input.commAddress ?? null,
    fy_start_month: input.fyStartMonth,
    signatory_name: input.signatoryName,
    signatory_designation: input.signatoryDesignation,
    effective_from: input.effectiveFrom ?? today,
  };
}

/** Pure: the form shape for a stored row, so the edit screen shows exactly what was saved. */
export function legalEntityForm(row: Pick<LegalEntityRow, "code" | "legal_name" | "currency_code" | "status" | "attributes">): Partial<LegalEntityInput> {
  const attributes = row.attributes;
  const optional = (value: string | null | undefined) => (value ? value : undefined);
  return {
    entityCode: row.code,
    registeredName: row.legal_name,
    tradeName: optional(attributes.trade_name),
    entityType: attributes.entity_type as LegalEntityInput["entityType"] | undefined,
    cinLlpin: attributes.cin_llpin,
    entityPan: attributes.entity_pan,
    tan: attributes.tan,
    gstin: optional(attributes.gstin),
    pfCode: optional(attributes.pf_code),
    esiCode: optional(attributes.esi_code),
    ptRegNo: optional(attributes.pt_reg_no),
    lwfRegNo: optional(attributes.lwf_reg_no),
    establishmentLicence: optional(attributes.establishment_licence),
    establishmentType: attributes.establishment_type as LegalEntityInput["establishmentType"] | undefined,
    registeredAddress: attributes.registered_address,
    commAddress: attributes.comm_address ?? null,
    fyStartMonth: attributes.fy_start_month as LegalEntityInput["fyStartMonth"] | undefined,
    currencyCode: row.currency_code ? row.currency_code.toLowerCase() : undefined,
    signatoryName: attributes.signatory_name,
    signatoryDesignation: attributes.signatory_designation,
    entityStatus: row.status === "inactive" ? "inactive" : "active",
    effectiveFrom: attributes.effective_from,
  };
}

/**
 * Pure: merges an edit over the stored form and re-validates the whole record, so a
 * partial edit can never leave a field the workbook requires blank or inconsistent.
 * Null clears an optional field; absent keeps the stored value.
 */
export function mergeLegalEntityPatch(current: Partial<LegalEntityInput>, patch: LegalEntityPatch): LegalEntityInput {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = value === null ? undefined : value;
  }
  // `commAddress` is the one field where null is a value ("same as registered"), not a clearing.
  if (patch.commAddress === null) merged.commAddress = null;
  const parsed = legalEntitySchema.safeParse(merged);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "The legal entity payload is invalid.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}

const LOCKED_SQL = `exists (
  select 1 from payroll_runs r
  join pay_groups g on g.tenant_id = r.tenant_id and g.id = r.pay_group_id
  where r.tenant_id = le.tenant_id and g.legal_entity_id = le.id
) as locked`;

const ENTITY_SELECT = `select le.id, le.code, le.legal_name, le.currency_code, le.status,
    coalesce(le.attributes, '{}'::jsonb) as attributes,
    (select count(distinct em.employee_id)::int from employments em
      where em.tenant_id = le.tenant_id and em.legal_entity_id = le.id) as headcount,
    ${LOCKED_SQL},
    1 as version
  from legal_entities le`;

/** Every entity of the tenant with the full master record and its payroll lock. */
export async function listLegalEntities(access: Access): Promise<LegalEntityRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${ENTITY_SELECT} where le.tenant_id = $1 order by le.code asc limit 200`, [access.tenantId]),
  ]);
  return rows as LegalEntityRow[];
}

export async function getLegalEntity(access: Access, id: string): Promise<LegalEntityRow> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${ENTITY_SELECT} where le.tenant_id = $1 and le.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const row = (rows as LegalEntityRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/**
 * The base currency must be one of the values the workbook lists, or exist in the
 * ISO 4217 table seeded at install (which is where PL_CURRENCY defers the rest of its set).
 */
async function assertCurrency(access: Access, code: string): Promise<string> {
  const iso = code.toUpperCase();
  if (picklists.PL_CURRENCY.values.some((entry) => entry.value === code)) return iso;
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from currencies where alpha_code = ${iso} and active = true limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `${iso} is not a currency the install seeded.` });
  }
  return iso;
}

/**
 * The foundation table needs a jurisdiction. The registered state resolves to its
 * `IN-XX` jurisdiction when the install seeded one, then to the country row, then to the
 * jurisdiction the tenant's existing entities already use. Nothing is created here.
 */
async function resolveJurisdiction(access: Access, state: AddressBlock["state"]): Promise<string> {
  const [stateRows, countryRows, existingRows] = await tenantTx(access, [
    sqlClient`select id from jurisdictions where code = ${jurisdictionCodeFor(state)} limit 1`,
    sqlClient`select id from jurisdictions where code = 'IN' and kind = 'country' limit 1`,
    sqlClient`select jurisdiction_id as id from legal_entities where tenant_id = ${access.tenantId} order by created_at asc limit 1`,
  ]);
  const found = [stateRows, countryRows, existingRows]
    .map((rows) => (rows as Array<{ id: string }>)[0]?.id)
    .find((id): id is string => typeof id === "string");
  if (!found) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No jurisdiction is seeded for this install; the entity cannot be registered yet." });
  }
  return found;
}

export async function createLegalEntity(access: Access, input: LegalEntityInput, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [existing] = await tenantTx(access, [
    sqlClient`select 1 from legal_entities where tenant_id = ${access.tenantId} and code = ${input.entityCode} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An entity with this code already exists." });
  }
  const currency = await assertCurrency(access, input.currencyCode);
  const jurisdictionId = await resolveJurisdiction(access, input.registeredAddress.state);
  const id = randomUUID();
  const attributes = legalEntityAttributes(input, new Date().toISOString().slice(0, 10));
  const after = { code: input.entityCode, legal_name: input.registeredName, currency_code: currency, status: input.entityStatus, ...attributes };
  await tenantTx(access, [
    sqlClient`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status, attributes)
      values (${id}, ${access.tenantId}, ${jurisdictionId}, ${input.entityCode}, ${input.registeredName}, ${currency}, ${input.entityStatus}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.legal_entity_create', 'legal_entity', ${id}, 'Legal entity created',
        ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, code: input.entityCode, legalName: input.registeredName };
}

export async function updateLegalEntity(access: Access, id: string, patch: LegalEntityPatch, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const current = await getLegalEntity(access, id);
  const merged = mergeLegalEntityPatch(legalEntityForm(current), patch);
  const currency = await assertCurrency(access, merged.currencyCode);
  // Immutable after the first payroll run: the code is on every filed return and the
  // currency on every computed line, so neither can change once a run refers to them.
  if (current.locked) {
    if (merged.entityCode !== current.code) {
      throw new HttpError({ status: 409, code: "ENTITY_LOCKED", message: "The entity code cannot change after the first payroll run." });
    }
    if (currency !== (current.currency_code ?? "").toUpperCase()) {
      throw new HttpError({ status: 409, code: "ENTITY_LOCKED", message: "The base currency is locked after the first payroll run." });
    }
  }
  if (merged.entityCode !== current.code) {
    const [clash] = await tenantTx(access, [
      sqlClient`select 1 from legal_entities where tenant_id = ${access.tenantId} and code = ${merged.entityCode} and id <> ${id} limit 1`,
    ]);
    if ((clash as unknown[]).length > 0) {
      throw new HttpError({ status: 409, code: "CONFLICT", message: "An entity with this code already exists." });
    }
  }
  const attributes = legalEntityAttributes(merged, current.attributes.effective_from ?? new Date().toISOString().slice(0, 10));
  const before = { code: current.code, legal_name: current.legal_name, currency_code: current.currency_code, status: current.status, ...current.attributes };
  const after = { code: merged.entityCode, legal_name: merged.registeredName, currency_code: currency, status: merged.entityStatus, ...attributes };
  await tenantTx(access, [
    sqlClient`update legal_entities
      set code = ${merged.entityCode}, legal_name = ${merged.registeredName}, currency_code = ${currency},
          status = ${merged.entityStatus}, attributes = ${JSON.stringify(attributes)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.legal_entity_update', 'legal_entity', ${id}, 'Legal entity updated',
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, code: merged.entityCode, legalName: merged.registeredName };
}
