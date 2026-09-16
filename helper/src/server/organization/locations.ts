import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues, picklists } from "@/lib/picklists";
import { isIanaTimeZone } from "@/server/organization/entity-identifiers";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { assertCurrentVersion, HttpError } from "@/server/platform/http";

/**
 * Location / Work Site Master (FRM-PLT-02).
 *
 * `locations` is an envelope table, so the whole form lives on `attributes` under the
 * workbook's field names. `code`, `name`, `city`, `state` and `establishment_type` keep the
 * keys the directory, the position register and the seeders already read, and the
 * workbook's `status` is the envelope's own `record_status`. The legal entity travels
 * through the required `establishment_id` foreign key rather than a second attribute.
 */

/** The workbook's address block without the state, which is its own picklist field. */
export const locationAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  /** Six digits. The PIN-to-state resolution the workbook asks for needs a PIN master the app does not carry. */
  pin: z.string().trim().regex(/^\d{6}$/, "PIN must be six digits."),
});

/** PL_TIMEZONE is an open set (the IANA database seeded at install), so any IANA zone is accepted. */
const timeZoneSchema = z.string().trim().max(40).refine(isIanaTimeZone, "Enter an IANA time zone such as Asia/Kolkata.");

const geofencePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const locationSchema = z.object({
  locationCode: z.string().trim().toUpperCase().min(1).max(10).regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Uppercase letters, digits, hyphen and underscore only; no spaces."),
  locationName: z.string().trim().min(2).max(100),
  legalEntityId: z.string().uuid(),
  locationType: z.enum(picklistValues("PL_LOCATION_TYPE")).default("plant"),
  parentLocationId: z.string().uuid().nullable().optional(),
  address: locationAddressSchema,
  stateCode: z.enum(picklistValues("PL_STATE")),
  district: z.string().trim().min(1).max(60),
  calendarId: z.string().uuid(),
  shiftGroup: z.string().trim().min(1).max(80),
  weekStartDay: z.enum(picklistValues("PL_WEEKDAY")).default("monday"),
  geofencePoint: geofencePointSchema.nullable().optional(),
  geofenceRadiusM: z.number().int().min(50).max(5000).default(200),
  timeZone: timeZoneSchema.default("Asia/Kolkata"),
  /** Defaults to the address state on write; set only where the work state differs. */
  ptState: z.enum(picklistValues("PL_STATE")).optional(),
  lwfApplicable: z.boolean(),
  esiCovered: z.boolean(),
  factoryLicenceNo: z.string().trim().max(40).optional(),
  status: z.enum(picklistValues("PL_ACTIVE_STATUS")).default("active"),
  effectiveFrom: z.iso.date().optional(),
});

export type LocationInput = z.infer<typeof locationSchema>;

/** Edit form: any subset; the service merges it over the stored record and re-validates. */
export const updateLocationSchema = z.object({
  locationCode: z.string().trim().optional(),
  locationName: z.string().trim().optional(),
  legalEntityId: z.string().uuid().optional(),
  locationType: z.enum(picklistValues("PL_LOCATION_TYPE")).optional(),
  parentLocationId: z.string().uuid().nullable().optional(),
  address: locationAddressSchema.optional(),
  stateCode: z.enum(picklistValues("PL_STATE")).optional(),
  district: z.string().trim().optional(),
  calendarId: z.string().uuid().optional(),
  shiftGroup: z.string().trim().optional(),
  weekStartDay: z.enum(picklistValues("PL_WEEKDAY")).optional(),
  geofencePoint: geofencePointSchema.nullable().optional(),
  geofenceRadiusM: z.number().int().optional(),
  timeZone: z.string().trim().optional(),
  ptState: z.enum(picklistValues("PL_STATE")).nullable().optional(),
  lwfApplicable: z.boolean().optional(),
  esiCovered: z.boolean().optional(),
  factoryLicenceNo: z.string().trim().nullable().optional(),
  status: z.enum(picklistValues("PL_ACTIVE_STATUS")).optional(),
  effectiveFrom: z.iso.date().optional(),
});

export type LocationPatch = z.infer<typeof updateLocationSchema>;

/** The attribute bag exactly as stored. */
export type LocationAttributes = {
  code: string;
  name: string;
  location_type: string;
  parent_location_id: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  pin: string;
  state: string;
  district: string;
  calendar_id: string;
  shift_group: string;
  week_start_day: string;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number;
  time_zone: string;
  pt_state: string;
  lwf_applicable: boolean;
  esi_covered: boolean;
  factory_licence_no: string | null;
  effective_from: string;
};

/** The location master as the directory, the register and the edit form read it. */
export type LocationRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  establishment_type: string | null;
  headcount: number;
  legal_entity_id: string | null;
  entity_code: string | null;
  location_type: string | null;
  parent_location_id: string | null;
  parent_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  pin: string | null;
  district: string | null;
  calendar_id: string | null;
  shift_group: string | null;
  week_start_day: string | null;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
  time_zone: string | null;
  pt_state: string | null;
  lwf_applicable: boolean | null;
  esi_covered: boolean | null;
  factory_licence_no: string | null;
  status: string;
  effective_from: string | null;
  version: number;
};

/** Pure: the stored shape for one validated form, so create and edit write the same keys. */
export function locationAttributes(input: LocationInput, today: string): LocationAttributes {
  return {
    code: input.locationCode,
    name: input.locationName,
    location_type: input.locationType,
    parent_location_id: input.parentLocationId ?? null,
    address_line1: input.address.line1,
    address_line2: input.address.line2 || null,
    city: input.address.city,
    pin: input.address.pin,
    state: input.stateCode,
    district: input.district,
    calendar_id: input.calendarId,
    shift_group: input.shiftGroup,
    week_start_day: input.weekStartDay,
    geofence_lat: input.geofencePoint?.lat ?? null,
    geofence_lng: input.geofencePoint?.lng ?? null,
    geofence_radius_m: input.geofenceRadiusM,
    time_zone: input.timeZone,
    pt_state: input.ptState ?? input.stateCode,
    lwf_applicable: input.lwfApplicable,
    esi_covered: input.esiCovered,
    factory_licence_no: input.factoryLicenceNo || null,
    effective_from: input.effectiveFrom ?? today,
  };
}

type StateValue = LocationInput["stateCode"];

/** Seeded rows hold the state's printed label; the form works in PL_STATE values. */
export function stateValueFor(stored: string | null | undefined): StateValue | undefined {
  if (!stored) return undefined;
  const entry = picklists.PL_STATE.values.find((candidate) => candidate.value === stored || candidate.label === stored);
  return entry?.value;
}

/** Pure: the form shape for a stored row, so the edit screen shows exactly what was saved. */
export function locationForm(row: LocationRow): Partial<LocationInput> {
  const optional = (value: string | null | undefined) => (value ? value : undefined);
  return {
    locationCode: row.code,
    locationName: row.name,
    legalEntityId: row.legal_entity_id ?? undefined,
    locationType: (row.location_type as LocationInput["locationType"] | null) ?? undefined,
    parentLocationId: row.parent_location_id,
    address: row.address_line1 && row.city && row.pin
      ? { line1: row.address_line1, line2: optional(row.address_line2), city: row.city, pin: row.pin }
      : undefined,
    stateCode: stateValueFor(row.state),
    district: optional(row.district),
    calendarId: optional(row.calendar_id),
    shiftGroup: optional(row.shift_group),
    weekStartDay: (row.week_start_day as LocationInput["weekStartDay"] | null) ?? undefined,
    geofencePoint: row.geofence_lat !== null && row.geofence_lng !== null ? { lat: row.geofence_lat, lng: row.geofence_lng } : null,
    geofenceRadiusM: row.geofence_radius_m ?? undefined,
    timeZone: optional(row.time_zone),
    ptState: stateValueFor(row.pt_state),
    lwfApplicable: row.lwf_applicable ?? undefined,
    esiCovered: row.esi_covered ?? undefined,
    factoryLicenceNo: optional(row.factory_licence_no),
    status: row.status === "inactive" ? "inactive" : "active",
    effectiveFrom: optional(row.effective_from),
  };
}

/** Pure: merge an edit over the stored form and re-validate the whole record. */
export function mergeLocationPatch(current: Partial<LocationInput>, patch: LocationPatch): LocationInput {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = value === null ? undefined : value;
  }
  // Null is a value for the two optional references: it detaches the parent and clears the fence.
  if (patch.parentLocationId === null) merged.parentLocationId = null;
  if (patch.geofencePoint === null) merged.geofencePoint = null;
  const parsed = locationSchema.safeParse(merged);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "The location payload is invalid.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}

const LOCATION_SELECT = `select l.id,
    coalesce(l.attributes->>'code', left(l.id::text, 8)) as code,
    coalesce(l.attributes->>'name', 'Unnamed location') as name,
    l.attributes->>'city' as city,
    l.attributes->>'state' as state,
    l.attributes->>'establishment_type' as establishment_type,
    (select count(*)::int from employees e
      where e.tenant_id = l.tenant_id and e.location = l.attributes->>'code') as headcount,
    est.legal_entity_id, le.code as entity_code,
    l.attributes->>'location_type' as location_type,
    l.attributes->>'parent_location_id' as parent_location_id,
    parent.attributes->>'code' as parent_code,
    l.attributes->>'address_line1' as address_line1,
    l.attributes->>'address_line2' as address_line2,
    l.attributes->>'pin' as pin,
    l.attributes->>'district' as district,
    l.attributes->>'calendar_id' as calendar_id,
    l.attributes->>'shift_group' as shift_group,
    l.attributes->>'week_start_day' as week_start_day,
    (l.attributes->>'geofence_lat')::float8 as geofence_lat,
    (l.attributes->>'geofence_lng')::float8 as geofence_lng,
    (l.attributes->>'geofence_radius_m')::int as geofence_radius_m,
    l.attributes->>'time_zone' as time_zone,
    l.attributes->>'pt_state' as pt_state,
    (l.attributes->>'lwf_applicable')::boolean as lwf_applicable,
    (l.attributes->>'esi_covered')::boolean as esi_covered,
    l.attributes->>'factory_licence_no' as factory_licence_no,
    coalesce(l.record_status, 'active') as status,
    l.attributes->>'effective_from' as effective_from,
    l.version::int as version
  from locations l
  left join establishments est on est.tenant_id = l.tenant_id and est.id = l.establishment_id
  left join legal_entities le on le.tenant_id = est.tenant_id and le.id = est.legal_entity_id
  left join locations parent on parent.tenant_id = l.tenant_id and parent.id::text = l.attributes->>'parent_location_id'`;

/** Locations tab (SCR-002) and the location master, with the live headcount at each site. */
export async function listLocations(access: Access): Promise<LocationRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${LOCATION_SELECT} where l.tenant_id = $1 order by coalesce(l.attributes->>'code', '') asc limit 200`, [access.tenantId]),
  ]);
  return rows as LocationRow[];
}

export async function getLocation(access: Access, id: string): Promise<LocationRow> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${LOCATION_SELECT} where l.tenant_id = $1 and l.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const row = (rows as LocationRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

export type LocationLookups = {
  /** Plant work calendars that are not archived, from the operational `plant-calendars` resource. */
  calendars: Array<{ id: string; name: string; locationCode: string | null; calendarYear: number | null; status: string }>;
  /** Shift groups in use on shifts that are not retired: shift inference operates only inside a group. */
  shiftGroups: string[];
};

/** The references the form's two lookups offer. */
export async function listLocationLookups(access: Access): Promise<LocationLookups> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [calendarRows, shiftRows] = await tenantTx(access, [
    sqlClient`select id, data->>'name' as name, data->>'locationCode' as location_code,
        (data->>'calendarYear')::int as calendar_year, status
      from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'plant-calendars' and status <> 'archived'
      order by created_at desc limit 200`,
    sqlClient`select distinct data->>'shiftGroup' as shift_group from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'shifts' and status <> 'retired'
        and coalesce(data->>'shiftGroup', '') <> '' order by 1 limit 200`,
  ]);
  return {
    calendars: (calendarRows as Array<{ id: string; name: string | null; location_code: string | null; calendar_year: number | null; status: string }>)
      .map((row) => ({ id: row.id, name: row.name ?? "Unnamed calendar", locationCode: row.location_code, calendarYear: row.calendar_year, status: row.status })),
    shiftGroups: (shiftRows as Array<{ shift_group: string }>).map((row) => row.shift_group),
  };
}

/** The lookups the workbook requires resolve to live records, or the save is refused. */
async function assertReferences(access: Access, input: LocationInput, selfId: string | null): Promise<void> {
  const [entityRows, calendarRows, shiftRows, parentRows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and id = ${input.legalEntityId} and status = 'active' limit 1`,
    sqlClient`select 1 from hrms_operation_records where tenant_id = ${access.tenantId} and id = ${input.calendarId} and resource = 'plant-calendars' and status <> 'archived' limit 1`,
    sqlClient`select 1 from hrms_operation_records where tenant_id = ${access.tenantId} and resource = 'shifts' and data->>'shiftGroup' = ${input.shiftGroup} and status <> 'retired' limit 1`,
    input.parentLocationId
      ? sqlClient`select id from locations where tenant_id = ${access.tenantId} and id = ${input.parentLocationId} limit 1`
      : sqlClient`select null::uuid as id where false`,
  ]);
  if ((entityRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The legal entity must exist and be active." });
  }
  if ((calendarRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The holiday calendar must be an active plant work calendar." });
  }
  if ((shiftRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The shift group must be one an active shift belongs to." });
  }
  if (input.parentLocationId) {
    if (input.parentLocationId === selfId) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A location cannot be its own parent." });
    }
    if ((parentRows as unknown[]).length === 0) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The parent location was not found." });
    }
    if (selfId) await assertNoParentCycle(access, selfId, input.parentLocationId);
  }
}

/** "No cycles": walking up from the proposed parent must never reach the location itself. */
async function assertNoParentCycle(access: Access, selfId: string, parentId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`with recursive chain as (
        select id, attributes->>'parent_location_id' as parent, 1 as depth
        from locations where tenant_id = ${access.tenantId} and id = ${parentId}
        union all
        select l.id, l.attributes->>'parent_location_id', c.depth + 1
        from locations l join chain c on l.tenant_id = ${access.tenantId} and l.id::text = c.parent
        where c.depth < 50
      )
      select 1 from chain where id = ${selfId} limit 1`,
  ]);
  if ((rows as unknown[]).length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "That parent would make the location its own ancestor." });
  }
}

/**
 * The envelope requires an establishment. A location belongs to exactly one entity, so it
 * takes the entity's establishment, creating the entity's first one from the entity's own
 * code, name and jurisdiction when none exists yet.
 */
async function establishmentFor(access: Access, legalEntityId: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from establishments where tenant_id = ${access.tenantId} and legal_entity_id = ${legalEntityId} order by created_at asc limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const [entityRows] = await tenantTx(access, [
    sqlClient`select code, legal_name, jurisdiction_id from legal_entities where tenant_id = ${access.tenantId} and id = ${legalEntityId} limit 1`,
  ]);
  const entity = (entityRows as Array<{ code: string; legal_name: string; jurisdiction_id: string }>)[0];
  if (!entity) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The legal entity was not found." });
  const id = randomUUID();
  await tenantTx(access, [
    sqlClient`insert into establishments (id, tenant_id, legal_entity_id, jurisdiction_id, attributes)
      values (${id}, ${access.tenantId}, ${legalEntityId}, ${entity.jurisdiction_id}, ${JSON.stringify({ code: entity.code, name: entity.legal_name })}::jsonb)`,
  ]);
  return id;
}

async function assertCodeFree(access: Access, code: string, selfId: string | null): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from locations where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} and (${selfId}::uuid is null or id <> ${selfId}::uuid) limit 1`,
  ]);
  if ((rows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "A location with this code already exists." });
  }
}

export async function createLocation(access: Access, input: LocationInput, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  await assertCodeFree(access, input.locationCode, null);
  await assertReferences(access, input, null);
  const establishmentId = await establishmentFor(access, input.legalEntityId);
  const id = randomUUID();
  const attributes = locationAttributes(input, new Date().toISOString().slice(0, 10));
  await tenantTx(access, [
    sqlClient`insert into locations (id, tenant_id, establishment_id, record_status, attributes)
      values (${id}, ${access.tenantId}, ${establishmentId}, ${input.status}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.location_create', 'location', ${id}, 'Location created',
        ${JSON.stringify({ legal_entity_id: input.legalEntityId, status: input.status, ...attributes })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, code: input.locationCode, name: input.locationName };
}

export async function updateLocation(access: Access, id: string, version: number, patch: LocationPatch, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const current = await getLocation(access, id);
  assertCurrentVersion(version, current.version);
  const merged = mergeLocationPatch(locationForm(current), patch);
  if (merged.locationCode !== current.code) await assertCodeFree(access, merged.locationCode, id);
  await assertReferences(access, merged, id);
  const establishmentId = await establishmentFor(access, merged.legalEntityId);
  const attributes = locationAttributes(merged, current.effective_from ?? new Date().toISOString().slice(0, 10));
  const before = { ...current, legal_entity_id: current.legal_entity_id, status: current.status };
  await tenantTx(access, [
    // `||` keeps keys this form does not own (establishment_type from the seeders) intact.
    sqlClient`update locations
      set establishment_id = ${establishmentId}, record_status = ${merged.status},
          attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify(attributes)}::jsonb,
          version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.location_update', 'location', ${id}, 'Location updated',
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify({ legal_entity_id: merged.legalEntityId, status: merged.status, ...attributes })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, code: merged.locationCode, name: merged.locationName };
}
