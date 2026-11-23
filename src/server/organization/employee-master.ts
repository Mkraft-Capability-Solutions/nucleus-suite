import "server-only";

import { sqlClient } from "@/lib/db";
import {
  coerceCustomValue, CUSTOM_FIELD_MODULE, CUSTOM_FIELD_TYPES, visaRuleIssues,
  type CustomFieldDefinition, type CustomFieldType, type CustomFieldValue, type EmployeeMasterView, type FieldIssue, type PatchEmployeeMaster,
} from "@/lib/employee-master/contract";
import { onEmployeeAlertSourcesChanged } from "@/server/alerts/recompute-hook";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { decryptFromBytes, encryptToBytes } from "@/server/workflows/field-encryption";

/**
 * Employee master: currency, visa / expatriate and typed custom attributes (module EMPLOYEE_MASTER).
 * Reads need employee.read; the visa number is shown in full only with employee.visa.read or employee.write.
 * Writes need employee.write and run in one transaction with an audit row and an outbox event.
 */

type MasterRow = {
  id: string; version: number; employee_code: string; first_name: string; last_name: string; work_email: string | null;
  designation: string; department: string; location: string; status: string; joining_date: string; legal_entity_id: string | null; currency: string;
  base_currency: string | null; payroll_currency: string | null; fx_rate_override: string | null;
  is_expatriate: boolean; home_country: string | null; host_country: string | null; tax_residency_country: string | null; sponsor_entity_id: string | null;
  visa_type: string | null; visa_number_ciphertext: Uint8Array | null; visa_number_last4: string | null; visa_issuing_country: string | null;
  visa_issue_date: string | null; visa_expiry_date: string | null; visa_entry_type: "SINGLE" | "MULTIPLE" | null;
  work_permit_number: string | null; work_permit_expiry_date: string | null;
};
type DefinitionRow = { id: string; field_key: string; label: string; field_type: string; is_required: boolean; options: unknown; sort_order: number };
type ValueRow = { custom_field_definition_id: string; value_text: string | null; value_number: string | null; value_date: string | null; value_boolean: boolean | null };

const visaContext = (tenantId: string, employeeId: string) => `employee-visa:${tenantId}:${employeeId}`;

export function canReadVisaNumber(access: Access): boolean {
  const check = (action: string) => authorize(access.context, { action, resource: { tenantId: access.tenantId } }).allowed;
  return check("employee.visa.read") || check("employee.write");
}

const ISO_COUNTRY = /^[A-Z]{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const trimmed = (value: string | null) => (value === null ? null : value.trim());

export function toDefinition(row: DefinitionRow): CustomFieldDefinition | null {
  if (!(CUSTOM_FIELD_TYPES as readonly string[]).includes(row.field_type)) return null;
  const options = Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === "string") : [];
  return { id: row.id, key: row.field_key, label: row.label, type: row.field_type as CustomFieldType, required: row.is_required, options, sortOrder: row.sort_order };
}

function readValue(definition: CustomFieldDefinition, row: ValueRow | undefined): CustomFieldValue {
  if (!row) return null;
  switch (definition.type) {
    case "TEXT": case "SELECT": return row.value_text;
    case "NUMBER": return row.value_number === null ? null : Number(row.value_number);
    case "DATE": return row.value_date;
    case "BOOLEAN": return row.value_boolean;
  }
}

const definitionsQuery = (tenantId: string) => sqlClient`
  select id, field_key, label, field_type, is_required, options, sort_order from custom_field_definitions
  where tenant_id = ${tenantId} and module = ${CUSTOM_FIELD_MODULE} and record_status = 'active'
    and field_key is not null and label is not null and field_type is not null
  order by sort_order asc, label asc`;

export async function listCustomFieldDefinitions(access: Access, module: string): Promise<CustomFieldDefinition[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  if (module !== CUSTOM_FIELD_MODULE) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: `Custom fields are available for module ${CUSTOM_FIELD_MODULE} only.`, details: [{ field: "module", issue: "unsupported" }] });
  }
  const [rows] = await tenantTx(access, [definitionsQuery(access.tenantId)]);
  return (rows as DefinitionRow[]).map(toDefinition).filter((item): item is CustomFieldDefinition => item !== null);
}

const masterQuery = (tenantId: string, id: string) => sqlClient`
  select id, version, employee_code, first_name, last_name, work_email, designation, department, location, status, joining_date::text,
         legal_entity_id, currency, trim(base_currency) as base_currency, trim(payroll_currency) as payroll_currency, fx_rate_override::text,
         is_expatriate, trim(home_country) as home_country, trim(host_country) as host_country, trim(tax_residency_country) as tax_residency_country,
         sponsor_entity_id, visa_type, visa_number_ciphertext, visa_number_last4, trim(visa_issuing_country) as visa_issuing_country,
         visa_issue_date::text, visa_expiry_date::text, visa_entry_type, work_permit_number, work_permit_expiry_date::text
  from employees where tenant_id = ${tenantId} and id = ${id} limit 1`;

function notFound(): never {
  throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
}

export function projectMaster(access: Access, row: MasterRow, definitions: CustomFieldDefinition[], values: ValueRow[]): EmployeeMasterView {
  const full = canReadVisaNumber(access);
  const byDefinition = new Map(values.map((value) => [value.custom_field_definition_id, value]));
  return {
    id: row.id,
    version: row.version,
    core: { employeeCode: row.employee_code, firstName: row.first_name, lastName: row.last_name, workEmail: row.work_email, designation: row.designation, department: row.department, location: row.location, status: row.status, joiningDate: row.joining_date, legalEntityId: row.legal_entity_id },
    currency: { baseCurrency: trimmed(row.base_currency), payrollCurrency: trimmed(row.payroll_currency), fxRateOverride: row.fx_rate_override === null ? null : Number(row.fx_rate_override), legacyCurrency: row.currency },
    visa: {
      isExpatriate: row.is_expatriate, homeCountry: trimmed(row.home_country), hostCountry: trimmed(row.host_country), taxResidencyCountry: trimmed(row.tax_residency_country),
      sponsorEntityId: row.sponsor_entity_id, visaType: row.visa_type,
      visaNumber: full && row.visa_number_ciphertext ? decryptFromBytes(row.visa_number_ciphertext, visaContext(access.tenantId, row.id)) : null,
      visaNumberLast4: row.visa_number_last4, visaNumberMasked: !full,
      visaIssuingCountry: trimmed(row.visa_issuing_country), visaIssueDate: row.visa_issue_date, visaExpiryDate: row.visa_expiry_date, visaEntryType: row.visa_entry_type,
      workPermitNumber: row.work_permit_number, workPermitExpiryDate: row.work_permit_expiry_date,
    },
    customFields: definitions.map((definition) => ({ ...definition, value: readValue(definition, byDefinition.get(definition.id)) })),
  };
}

export async function getEmployeeMaster(access: Access, id: string): Promise<EmployeeMasterView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  if (!uuidOrNull(id)) notFound();
  const [rows, definitions, values] = await tenantTx(access, [
    masterQuery(access.tenantId, id),
    definitionsQuery(access.tenantId),
    sqlClient`select custom_field_definition_id, value_text, value_number::text, value_date::text, value_boolean
              from custom_field_values where tenant_id = ${access.tenantId} and employee_id = ${id}`,
  ]);
  const row = (rows as MasterRow[])[0];
  if (!row) notFound();
  const defs = (definitions as DefinitionRow[]).map(toDefinition).filter((item): item is CustomFieldDefinition => item !== null);
  if (row.visa_number_ciphertext && canReadVisaNumber(access)) {
    await tenantTx(access, [sqlClient`
      insert into access_events (tenant_id, membership_id, subject_type, subject_id, field_domain, purpose, decision, reason_code, request_id)
      values (${access.tenantId}, ${access.context.membershipId}, 'employee', ${id}, 'visa', 'profile-view', 'allowed', 'ALLOWED', gen_random_uuid())`]);
  }
  return projectMaster(access, row, defs, values as ValueRow[]);
}

function invalid(details: FieldIssue[]): never {
  throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The employee master update is invalid.", details });
}

/** Validate a patch against stored state and definitions; returns the typed custom values to write. */
export function validatePatch(row: MasterRow, input: PatchEmployeeMaster, definitions: CustomFieldDefinition[]) {
  const issues: FieldIssue[] = [];
  const visa = input.visa ?? {};
  const merged = {
    isExpatriate: visa.isExpatriate ?? row.is_expatriate,
    hostCountry: visa.hostCountry !== undefined ? visa.hostCountry : trimmed(row.host_country),
    visaType: visa.visaType !== undefined ? visa.visaType : row.visa_type,
    hasVisaNumber: visa.visaNumber !== undefined ? visa.visaNumber !== null : row.visa_number_ciphertext !== null,
    visaIssuingCountry: visa.visaIssuingCountry !== undefined ? visa.visaIssuingCountry : trimmed(row.visa_issuing_country),
    visaIssueDate: visa.visaIssueDate !== undefined ? visa.visaIssueDate : row.visa_issue_date,
    visaExpiryDate: visa.visaExpiryDate !== undefined ? visa.visaExpiryDate : row.visa_expiry_date,
  };
  issues.push(...visaRuleIssues(merged));
  for (const [field, value] of Object.entries({ homeCountry: visa.homeCountry, hostCountry: visa.hostCountry, taxResidencyCountry: visa.taxResidencyCountry, visaIssuingCountry: visa.visaIssuingCountry })) {
    if (value && !ISO_COUNTRY.test(value)) issues.push({ field: `visa.${field}`, issue: "Use a 2-letter ISO 3166 country code." });
  }
  for (const [field, value] of Object.entries({ baseCurrency: input.currency?.baseCurrency, payrollCurrency: input.currency?.payrollCurrency })) {
    if (value && !ISO_CURRENCY.test(value)) issues.push({ field: `currency.${field}`, issue: "Use a 3-letter ISO 4217 currency code." });
  }
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const customWrites: Array<{ definition: CustomFieldDefinition; value: CustomFieldValue }> = [];
  for (const [key, raw] of Object.entries(input.customFields ?? {})) {
    const definition = byKey.get(key);
    if (!definition) { issues.push({ field: `customFields.${key}`, issue: "Unknown custom field." }); continue; }
    const result = coerceCustomValue(definition, raw);
    if ("issue" in result) issues.push({ field: `customFields.${key}`, issue: result.issue });
    else customWrites.push({ definition, value: result.value });
  }
  if (issues.length) invalid(issues);
  return customWrites;
}

const COLUMN: Record<string, string> = {
  firstName: "first_name", lastName: "last_name", workEmail: "work_email", designation: "designation", department: "department", location: "location",
  baseCurrency: "base_currency", payrollCurrency: "payroll_currency", fxRateOverride: "fx_rate_override",
  isExpatriate: "is_expatriate", homeCountry: "home_country", hostCountry: "host_country", taxResidencyCountry: "tax_residency_country", sponsorEntityId: "sponsor_entity_id",
  visaType: "visa_type", visaIssuingCountry: "visa_issuing_country", visaIssueDate: "visa_issue_date", visaExpiryDate: "visa_expiry_date", visaEntryType: "visa_entry_type",
  workPermitNumber: "work_permit_number", workPermitExpiryDate: "work_permit_expiry_date",
};

/** Build the parameterised UPDATE from a fixed column allow-list (never from client keys). */
export function buildEmployeeUpdate(tenantId: string, employeeId: string, input: PatchEmployeeMaster, visaCipher: { bytes: Buffer | null; last4: string | null } | undefined) {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  const { visaNumber: _visaNumber, ...visaRest } = input.visa ?? {};
  void _visaNumber;
  for (const [key, value] of Object.entries({ ...(input.core ?? {}), ...(input.currency ?? {}), ...visaRest })) {
    const column = COLUMN[key];
    if (column && value !== undefined) push(column, value);
  }
  if (visaCipher) { push("visa_number_ciphertext", visaCipher.bytes); push("visa_number_last4", visaCipher.last4); }
  values.push(tenantId, employeeId);
  const text = `update employees set ${[...sets, "version = version + 1", "updated_at = now()"].join(", ")}
    where tenant_id = $${values.length - 1} and id = $${values.length} returning id, version`;
  return { text, values, changed: sets.length };
}

export async function patchEmployeeMaster(access: Access, id: string, input: PatchEmployeeMaster, requestId: string): Promise<EmployeeMasterView> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (!uuidOrNull(id)) notFound();
  const sponsorId = input.visa?.sponsorEntityId;
  const [rows, definitions, sponsor] = await tenantTx(access, [
    masterQuery(access.tenantId, id),
    definitionsQuery(access.tenantId),
    sponsorId
      ? sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and id = ${sponsorId} limit 1`
      : sqlClient`select null::uuid as id where false`,
  ]);
  const row = (rows as MasterRow[])[0];
  if (!row) notFound();
  if (input.version !== undefined && input.version !== row.version) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This record was changed by someone else. Reload and try again." });
  }
  if (sponsorId && (sponsor as unknown[]).length === 0) invalid([{ field: "visa.sponsorEntityId", issue: "Choose a legal entity of this organisation." }]);
  const defs = (definitions as DefinitionRow[]).map(toDefinition).filter((item): item is CustomFieldDefinition => item !== null);
  const customWrites = validatePatch(row, input, defs);

  const visaNumber = input.visa?.visaNumber;
  const visaCipher = visaNumber === undefined ? undefined
    : visaNumber === null ? { bytes: null, last4: null }
    : { bytes: encryptToBytes(visaNumber, visaContext(access.tenantId, id)), last4: visaNumber.slice(-4) };
  const update = buildEmployeeUpdate(access.tenantId, id, input, visaCipher);

  const changedFields = [
    ...Object.keys(input.core ?? {}).map((key) => `core.${key}`),
    ...Object.keys(input.currency ?? {}).map((key) => `currency.${key}`),
    ...Object.keys(input.visa ?? {}).map((key) => `visa.${key}`),
    ...customWrites.map((write) => `customFields.${write.definition.key}`),
  ];
  const statements: unknown[] = [{ text: update.text, values: update.values }];
  for (const { definition, value } of customWrites) {
    const text = definition.type === "TEXT" || definition.type === "SELECT" ? value : null;
    const number = definition.type === "NUMBER" ? value : null;
    const date = definition.type === "DATE" ? value : null;
    const flag = definition.type === "BOOLEAN" ? value : null;
    statements.push(sqlClient`
      insert into custom_field_values (tenant_id, custom_field_definition_id, employee_id, value_text, value_number, value_date, value_boolean)
      values (${access.tenantId}, ${definition.id}, ${id}, ${text}, ${number}, ${date}, ${flag})
      on conflict (tenant_id, custom_field_definition_id, employee_id) where employee_id is not null
      do update set value_text = excluded.value_text, value_number = excluded.value_number, value_date = excluded.value_date,
                    value_boolean = excluded.value_boolean, version = custom_field_values.version + 1, updated_at = now()`);
  }
  // Audit and outbox never carry the visa number, only which fields changed.
  statements.push(sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'employee.master_update', 'employee', ${id},
            'Employee master updated', '{}'::jsonb, ${JSON.stringify({ fields: changedFields })}::jsonb, ${uuidOrNull(requestId)}::uuid)`);
  statements.push(sqlClient`
    insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
    values (${access.tenantId}, 'employee.master_updated', 'employee', ${id},
            ${JSON.stringify({ employeeId: id, fields: changedFields, visaExpiryChanged: changedFields.includes("visa.visaExpiryDate"), permitExpiryChanged: changedFields.includes("visa.workPermitExpiryDate") })}::jsonb)`);
  await tenantTx(access, statements);
  await onEmployeeAlertSourcesChanged(access, id);
  return getEmployeeMaster(access, id);
}
