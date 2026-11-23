import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Legal entity and location masters (FRM-PLT-01 / FRM-PLT-02). Tenant scoped, `tenant.manage` to write,
 * unique code per tenant, every create audited. Statutory identifiers are validated by format only.
 */

const code = z.string().trim().toUpperCase().min(2).max(24).regex(/^[A-Z0-9-]+$/, "Use capital letters, digits and hyphens.");
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const formatted = (pattern: RegExp, message: string) => z.string().trim().toUpperCase().regex(pattern, message).optional().or(z.literal("").transform(() => undefined));

export const createLegalEntitySchema = z.object({
  entityCode: code,
  registeredName: z.string().trim().min(3).max(200),
  tradeName: optionalText(200),
  entityType: optionalText(60),
  cinLlpin: formatted(/^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4})$/, "Enter a valid CIN or LLPIN."),
  entityPan: formatted(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN, for example ABCDE1234F."),
  tan: formatted(/^[A-Z]{4}[0-9]{5}[A-Z]$/, "Enter a valid TAN."),
  gstin: formatted(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN."),
  pfCode: optionalText(40), esiCode: optionalText(40), ptRegNo: optionalText(40), lwfRegNo: optionalText(40),
  establishmentLicence: optionalText(60), establishmentType: optionalText(60),
  registeredAddress: z.string().trim().min(5).max(500),
  commAddress: optionalText(500),
  fyStartMonth: optionalText(12),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  signatoryName: optionalText(120), signatoryDesignation: optionalText(120),
  status: z.string().trim().toLowerCase().pipe(z.enum(["active", "inactive", "closed"])).default("active"),
  effectiveFrom: z.iso.date().optional(),
});

export const createLocationSchema = z.object({
  locationCode: code,
  locationName: z.string().trim().min(2).max(160),
  entityCode: code.optional(),
  locationType: optionalText(40),
  parentLocation: optionalText(24),
  address: optionalText(500),
  stateCode: optionalText(4), district: optionalText(80),
  calendarId: optionalText(40), shiftGroup: optionalText(40), weekStartDay: optionalText(12),
  geofencePoint: z.string().trim().regex(/^-?\d{1,2}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/, "Use latitude,longitude.").optional().or(z.literal("").transform(() => undefined)),
  geofenceRadiusM: z.coerce.number().int().min(10).max(10_000).optional(),
  timeZone: z.string().trim().max(64).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }, "Choose a valid time zone.").default("Asia/Kolkata"),
  ptState: optionalText(4), lwfApplicable: z.boolean().optional(), esiCovered: z.boolean().optional(),
  factoryLicenceNo: optionalText(60),
  status: z.string().trim().toLowerCase().pipe(z.enum(["active", "inactive"])).default("active"),
  effectiveFrom: z.iso.date().optional(),
});

export type CreateLegalEntity = z.infer<typeof createLegalEntitySchema>;
export type CreateLocation = z.infer<typeof createLocationSchema>;

const audit = (access: Access, action: string, entityType: string, id: string, after: unknown, requestId: string) => sqlClient`
  insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
  values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, ${entityType}, ${id},
          'Master record created', '{}'::jsonb, ${JSON.stringify(after)}::jsonb, ${requestId})`;

export async function createLegalEntity(access: Access, input: CreateLegalEntity, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [existing, jurisdictions] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and code = ${input.entityCode} limit 1`,
    sqlClient`select j.id from jurisdictions j join countries c on c.id = j.country_id where c.iso_code = 'IN' order by j.valid_from desc limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `Entity code ${input.entityCode} already exists.`, details: [{ field: "entityCode", issue: "duplicate" }] });
  }
  const jurisdictionId = (jurisdictions as Array<{ id: string }>)[0]?.id;
  if (!jurisdictionId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No jurisdiction is configured for this tenant yet." });

  const id = randomUUID();
  const { entityCode, registeredName, currencyCode, status, ...rest } = input;
  await tenantTx(access, [
    sqlClient`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status, attributes)
              values (${id}, ${access.tenantId}, ${jurisdictionId}, ${entityCode}, ${registeredName}, ${currencyCode}, ${status}, ${JSON.stringify(rest)}::jsonb)`,
    audit(access, "organization.legal_entity_create", "legal_entity", id, { code: entityCode, legal_name: registeredName }, requestId),
  ]);
  return { id, code: entityCode, legalName: registeredName, currencyCode, status };
}

export async function createLocation(access: Access, input: CreateLocation, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const [existing, entities] = await tenantTx(access, [
    sqlClient`select id from locations where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.locationCode} limit 1`,
    input.entityCode
      ? sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and code = ${input.entityCode} limit 1`
      : sqlClient`select null::uuid as id where false`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `Location code ${input.locationCode} already exists.`, details: [{ field: "locationCode", issue: "duplicate" }] });
  }
  const legalEntityId = (entities as Array<{ id: string }>)[0]?.id ?? null;
  if (input.entityCode && !legalEntityId) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: `Legal entity ${input.entityCode} does not exist.`, details: [{ field: "entityCode", issue: "unknown" }] });
  }
  const id = randomUUID();
  const { locationCode, locationName, status, stateCode, ...rest } = input;
  const attributes = { ...rest, code: locationCode, name: locationName, state: stateCode, legal_entity_id: legalEntityId, timezone: input.timeZone };
  await tenantTx(access, [
    sqlClient`insert into locations (id, tenant_id, record_status, attributes) values (${id}, ${access.tenantId}, ${status}, ${JSON.stringify(attributes)}::jsonb)`,
    audit(access, "organization.location_create", "location", id, { code: locationCode, name: locationName }, requestId),
  ]);
  return { id, code: locationCode, name: locationName, status };
}
