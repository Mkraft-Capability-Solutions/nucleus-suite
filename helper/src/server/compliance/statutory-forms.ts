import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * R-18 / R-27 — statutory form data, and the Form F serial register.
 *
 * `generate_statutory_form` renders an approved per-state template against a
 * `values` map. Until now that map came from the CALLER: the statutory screen
 * sent `values: {}` and the readiness screen offered free-text boxes, so every
 * figure on a statutory return was whatever somebody typed. T-32 is explicit
 * that no figure may be typed in.
 *
 * This module supplies the map instead, from the records the app already holds:
 *
 *  - Form F from the employee record and the establishment it is joined to.
 *  - Forms 28, 18 and 36 from the establishment and the payroll figures for the
 *    period.
 *
 * Three things it deliberately does NOT do.
 *
 *  1. **It does not author templates.** Q-13 — which state's rules apply to
 *     Form 28, Form 18, Form 36 and Form F — is unanswered, and a Factory Act
 *     form in the wrong state variant is a compliance failure. Layouts stay
 *     client configuration, saved as `vp_rule_sets` rows under the existing
 *     `${stateCode}:${formCode}` code. `describeStatutoryTemplates` reports what
 *     is approved and what is not, and `templateSeedingInstructions` says
 *     exactly how to supply one.
 *
 *  2. **It does not invent a value it cannot source.** A merge field whose
 *     source record is empty is reported in `missing` and is absent from
 *     `values`, so a template that needs it fails loudly on generation rather
 *     than printing a blank where a statutory figure belongs.
 *
 *  3. **It does not renumber.** A serial, once issued, is either used or voided
 *     with a reason; it is never reissued and never silently skipped, which is
 *     what makes the RP-13 register gapless.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The forms this module derives values for. */
export const STATUTORY_FORM_CODES = ["FORM_F", "FORM_28", "FORM_18", "FORM_36"] as const;
export type StatutoryFormCode = (typeof STATUTORY_FORM_CODES)[number];

/** Forms issued per employee rather than per establishment period. */
export const EMPLOYEE_FORM_CODES: readonly StatutoryFormCode[] = ["FORM_F"];

/** Forms that carry a serial from the register (RP-13). */
export const SERIALISED_FORM_CODES: readonly StatutoryFormCode[] = ["FORM_F"];

export function isStatutoryFormCode(value: string): value is StatutoryFormCode {
  return (STATUTORY_FORM_CODES as readonly string[]).includes(value);
}

/**
 * The rule-set code a template is stored under. This is the one piece of the
 * original design that was right, so it is kept exactly: one approved,
 * effective-dated template per state per form.
 */
export function statutoryTemplateKey(stateCode: string, formCode: string): string {
  return `${stateCode.trim().toUpperCase()}:${formCode.trim().toUpperCase()}`;
}

/** Placeholder the serial is substituted into, so the number is allocated once. */
export const SERIAL_MERGE_FIELD = "serial_number";

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

export type MergeValue = string | number;

export type DerivedField = { field: string; source: string };
export type MissingField = { field: string; source: string; issue: string };

export type StatutoryFormDerivation = {
  formCode: string;
  /** Resolved from the establishment, never typed: config register, "State variant". */
  stateCode: string;
  period: string;
  establishmentId: string | null;
  establishmentKey: string;
  employeeId: string | null;
  values: Record<string, MergeValue>;
  /** Where each supplied value came from, so a figure on a return is traceable. */
  sources: DerivedField[];
  /** Fields whose source record holds nothing. Reported, never defaulted. */
  missing: MissingField[];
};

export const deriveStatutoryFormSchema = z.object({
  formCode: z.string().trim().min(1).max(40),
  /** Optional: it is resolved from the establishment when omitted. */
  stateCode: z.string().trim().min(2).max(20).optional(),
  /** The establishment the form is raised for. Required for every form. */
  locationId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  period: z.string().trim().min(1).max(20),
});

export type DeriveStatutoryFormInput = z.infer<typeof deriveStatutoryFormSchema>;

type LocationRow = {
  id: string;
  code: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  establishment_type: string | null;
  registration_number: string | null;
  legal_entity_id: string | null;
  legal_entity_code: string | null;
  legal_entity_name: string | null;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  designation: string;
  department: string;
  location: string;
  category: string;
  joining_date: string;
  status: string;
  address_line: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
};

type PayrollTotalsRow = {
  run_id: string | null;
  run_status: string | null;
  employees_paid: number | string | null;
  gross_minor: number | string | null;
  deductions_minor: number | string | null;
  net_minor: number | string | null;
};

function text(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Minor units to a plain decimal string, so a template prints a figure, not paise. */
function majorAmount(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(minor));
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

async function loadEstablishment(access: Access, locationId: string): Promise<LocationRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select l.id,
        l.attributes->>'code' as code,
        l.attributes->>'name' as name,
        l.attributes->>'city' as city,
        l.attributes->>'state' as state,
        l.attributes->>'establishment_type' as establishment_type,
        coalesce(l.attributes->>'registration_number', l.attributes->>'establishment_registration_number') as registration_number,
        le.id as legal_entity_id, le.code as legal_entity_code, le.legal_name as legal_entity_name
      from locations l
      left join legal_entities le on le.tenant_id = l.tenant_id and le.id = (l.attributes->>'legal_entity_id')::uuid
      where l.tenant_id = ${access.tenantId} and l.id = ${locationId} limit 1`,
  ]);
  const row = (rows as LocationRow[])[0];
  if (!row) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The establishment was not found in this workspace." });
  }
  return row;
}

async function loadFormEmployee(access: Access, employeeId: string): Promise<EmployeeRow> {
  const [rows] = await tenantTx(access, [
    // The address comes from the dossier's contact rows, preferring a permanent
    // address and falling back to the current one; both are effective-dated.
    sqlClient`select e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.designation,
        e.department, e.location, e.category, e.joining_date::text as joining_date, e.status,
        address.value as address_line, address.attributes->>'city' as address_city,
        address.attributes->>'state' as address_state, address.attributes->>'postalCode' as address_postal_code
      from employees e
      left join lateral (
        select c.attributes->>'value' as value, c.attributes
        from employee_contacts c
        where c.tenant_id = e.tenant_id and c.employee_id = e.id
          and c.attributes->>'contactType' in ('permanent_address', 'current_address')
          and coalesce(c.attributes->>'effectiveTo', '9999-12-31') >= to_char(current_date, 'YYYY-MM-DD')
        order by (c.attributes->>'contactType' = 'permanent_address') desc, c.attributes->>'effectiveFrom' desc
        limit 1
      ) address on true
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId} limit 1`,
  ]);
  const row = (rows as EmployeeRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The employee was not found in this workspace." });
  return row;
}

/**
 * The payroll figures an establishment return is built from: the finalized run
 * for the period, restricted to employees posted at that establishment.
 *
 * A run that is not finalized is not used. A return built from a run somebody can
 * still change is a figure that will not reconcile to the payslips it claims to
 * summarise.
 */
async function loadPayrollTotals(access: Access, period: string, locationCode: string | null): Promise<PayrollTotalsRow | null> {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [rows] = await tenantTx(access, [
    sqlClient`select r.id as run_id, r.status as run_status,
        count(m.id)::int as employees_paid,
        coalesce(sum((m.attributes->>'gross_minor')::bigint), 0)::bigint as gross_minor,
        coalesce(sum((m.attributes->>'deductions_minor')::bigint), 0)::bigint as deductions_minor,
        coalesce(sum((m.attributes->>'net_minor')::bigint), 0)::bigint as net_minor
      from payroll_runs r
      join payroll_run_employees m on m.tenant_id = r.tenant_id and m.payroll_run_id = r.id
      join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
      where r.tenant_id = ${access.tenantId} and r.period = ${period} and r.status = 'finalized'
        and (${locationCode}::text is null or e.location = ${locationCode})
      group by r.id, r.status
      order by r.id
      limit 1`,
  ]);
  return (rows as PayrollTotalsRow[])[0] ?? null;
}

type Collector = {
  values: Record<string, MergeValue>;
  sources: DerivedField[];
  missing: MissingField[];
};

function put(collector: Collector, field: string, value: MergeValue | null, source: string, issue: string): void {
  if (value === null || value === "") {
    collector.missing.push({ field, source, issue });
    return;
  }
  collector.values[field] = value;
  collector.sources.push({ field, source });
}

/**
 * Every merge value a statutory form may draw on, derived from live records.
 *
 * The set is a documented superset: a template uses the fields its state's
 * layout prescribes, and `assertTemplateCoverage` refuses a template that asks
 * for anything this cannot supply, naming the field.
 */
export async function deriveStatutoryFormValues(
  access: Access,
  input: DeriveStatutoryFormInput,
): Promise<StatutoryFormDerivation> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const formCode = input.formCode.trim().toUpperCase();
  const establishment = await loadEstablishment(access, input.locationId);
  const stateCode = (input.stateCode ?? text(establishment.state) ?? "").trim().toUpperCase();
  if (!stateCode) {
    throw new HttpError({
      status: 422,
      code: "ESTABLISHMENT_STATE_MISSING",
      message:
        `Establishment ${text(establishment.code) ?? establishment.id} has no state on record, and the state variant of a statutory form is taken from the establishment. ` +
        `Set the state on the location master before generating ${formCode}.`,
      details: [{ field: "state", issue: "locations.attributes->>'state' is empty." }],
    });
  }

  const collector: Collector = { values: {}, sources: [], missing: [] };
  const establishmentSource = "locations (establishment master)";
  put(collector, "establishment_code", text(establishment.code), establishmentSource, "The location has no code.");
  put(collector, "establishment_name", text(establishment.name), establishmentSource, "The location has no name.");
  put(collector, "establishment_city", text(establishment.city), establishmentSource, "The location has no city.");
  put(collector, "establishment_state", stateCode, establishmentSource, "The location has no state.");
  put(collector, "establishment_type", text(establishment.establishment_type), establishmentSource, "The location has no establishment type.");
  put(
    collector,
    "establishment_registration_number",
    text(establishment.registration_number),
    establishmentSource,
    "The establishment has no registration number on the location master; every Factory Act form prints it.",
  );
  put(collector, "legal_entity_code", text(establishment.legal_entity_code), "legal_entities", "The establishment is not linked to a legal entity.");
  put(collector, "legal_entity_name", text(establishment.legal_entity_name), "legal_entities", "The establishment is not linked to a legal entity.");
  put(collector, "period", input.period, "the request", "No period was given.");
  put(collector, "generated_on", new Date().toISOString().slice(0, 10), "the clock", "");
  put(collector, "state_code", stateCode, establishmentSource, "The location has no state.");
  put(collector, "form_code", formCode, "the request", "No form code was given.");

  let employeeId: string | null = null;
  if (EMPLOYEE_FORM_CODES.includes(formCode as StatutoryFormCode)) {
    if (!input.employeeId) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: `${formCode} is issued per employee; name the employee it is being generated for.`,
        details: [{ field: "employeeId", issue: "Required for a per-employee form." }],
      });
    }
    const employee = await loadFormEmployee(access, input.employeeId);
    employeeId = employee.id;
    const employeeSource = "employees (employee record)";
    put(collector, "employee_code", text(employee.employee_code), employeeSource, "The employee has no code.");
    put(collector, "employee_name", [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim(), employeeSource, "The employee has no name.");
    put(collector, "employee_first_name", text(employee.first_name), employeeSource, "The employee has no first name.");
    put(collector, "employee_last_name", text(employee.last_name), employeeSource, "The employee has no last name.");
    put(collector, "designation", text(employee.designation), employeeSource, "The employee has no designation.");
    // Config register, F-STA-02: "Nature of work - from designation".
    put(collector, "nature_of_work", text(employee.designation), `${employeeSource} designation`, "The employee has no designation, which is what nature of work is taken from.");
    put(collector, "department", text(employee.department), employeeSource, "The employee has no department.");
    put(collector, "employment_category", text(employee.category), employeeSource, "The employee has no employment category.");
    put(collector, "date_of_joining", text(employee.joining_date), employeeSource, "The employee has no joining date.");
    put(collector, "work_email", text(employee.work_email), employeeSource, "The employee has no work email.");
    put(collector, "employee_address", text(employee.address_line), "employee_contacts (dossier)", "No permanent or current address is on the dossier.");
    put(collector, "employee_address_city", text(employee.address_city), "employee_contacts (dossier)", "The dossier address has no city.");
    put(collector, "employee_address_state", text(employee.address_state), "employee_contacts (dossier)", "The dossier address has no state.");
    put(collector, "employee_address_postal_code", text(employee.address_postal_code), "employee_contacts (dossier)", "The dossier address has no postal code.");
  } else {
    const totals = await loadPayrollTotals(access, input.period, text(establishment.code));
    const payrollSource = "payroll_runs / payroll_run_employees (finalized run for the period)";
    const issue = `No finalized payroll run for ${input.period} covers this establishment, so its wage figures cannot be derived.`;
    put(collector, "payroll_run_id", totals?.run_id ?? null, payrollSource, issue);
    put(collector, "employees_paid", totals ? Number(totals.employees_paid ?? 0) : null, payrollSource, issue);
    put(collector, "gross_wages_minor", totals ? Number(totals.gross_minor ?? 0) : null, payrollSource, issue);
    put(collector, "gross_wages", totals ? majorAmount(Number(totals.gross_minor ?? 0)) : null, payrollSource, issue);
    put(collector, "deductions_minor", totals ? Number(totals.deductions_minor ?? 0) : null, payrollSource, issue);
    put(collector, "deductions", totals ? majorAmount(Number(totals.deductions_minor ?? 0)) : null, payrollSource, issue);
    put(collector, "net_wages_minor", totals ? Number(totals.net_minor ?? 0) : null, payrollSource, issue);
    put(collector, "net_wages", totals ? majorAmount(Number(totals.net_minor ?? 0)) : null, payrollSource, issue);
    const [headcountRows] = await tenantTx(access, [
      sqlClient`select count(*)::int as on_roll from employees
        where tenant_id = ${access.tenantId} and status = 'active'
          and (${text(establishment.code)}::text is null or location = ${text(establishment.code)})`,
    ]);
    const onRoll = Number((headcountRows as Array<{ on_roll: number }>)[0]?.on_roll ?? 0);
    put(collector, "headcount_on_roll", onRoll, "employees (active headcount at the establishment)", "");
  }

  return {
    formCode,
    stateCode,
    period: input.period,
    establishmentId: establishment.id,
    establishmentKey: text(establishment.code) ?? establishment.id,
    employeeId,
    values: collector.values,
    sources: collector.sources,
    missing: collector.missing,
  };
}

// ---------------------------------------------------------------------------
// Template coverage
// ---------------------------------------------------------------------------

/** Every `{{ field }}` a template asks for, in the order it first appears. */
export function templateMergeFields(template: string): string[] {
  const fields: string[] = [];
  for (const match of template.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)) {
    const field = match[1];
    if (field && !fields.includes(field)) fields.push(field);
  }
  return fields;
}

/**
 * Refuse a generation whose template needs something the records do not hold,
 * naming the field, where it would have come from and why it is empty.
 *
 * `renderMergeTemplate` throws a bare `Error` for a missing field, which reaches
 * the caller as a 500 with no guidance. This turns the same condition into an
 * actionable 422 BEFORE anything is rendered or written.
 */
export function assertTemplateCoverage(input: {
  template: string;
  derivation: StatutoryFormDerivation;
  /** Fields supplied by the issuing step rather than the derivation, e.g. the serial. */
  additionalFields?: readonly string[];
}): void {
  const supplied = new Set([...Object.keys(input.derivation.values), ...(input.additionalFields ?? [])]);
  const required = templateMergeFields(input.template);
  const absent = required.filter((field) => !supplied.has(field));
  if (absent.length === 0) return;
  const explained = absent.map((field) => {
    const known = input.derivation.missing.find((entry) => entry.field === field);
    return known
      ? { field, issue: `${known.issue} Source: ${known.source}.` }
      : { field, issue: `The approved ${input.derivation.stateCode} ${input.derivation.formCode} template asks for "${field}", which this system does not derive. Either the template names a different field or the data has no home in Nucleus yet.` };
  });
  throw new HttpError({
    status: 422,
    code: "STATUTORY_MERGE_FIELD_MISSING",
    message:
      `${input.derivation.formCode} cannot be generated: ${absent.length} merge field${absent.length === 1 ? "" : "s"} the approved template needs ` +
      `${absent.length === 1 ? "has" : "have"} no value on record (${absent.join(", ")}). Nothing is typed into a statutory form, so the record must be completed first.`,
    details: explained,
  });
}

// ---------------------------------------------------------------------------
// RP-13 — the serial register
// ---------------------------------------------------------------------------

export type FormSerial = {
  id: string;
  establishmentKey: string;
  formCode: string;
  serialNumber: number;
  statutoryInstanceId: string | null;
  employeeId: string | null;
  issuedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

type SerialRow = {
  id: string;
  establishment_key: string;
  form_code: string;
  serial_number: number | string;
  statutory_instance_id: string | null;
  employee_id: string | null;
  issued_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

function serialRow(row: SerialRow): FormSerial {
  return {
    id: row.id,
    establishmentKey: row.establishment_key,
    formCode: row.form_code,
    serialNumber: Number(row.serial_number),
    statutoryInstanceId: row.statutory_instance_id,
    employeeId: row.employee_id,
    issuedAt: row.issued_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}

/**
 * Take the next serial for an establishment and form.
 *
 * Gapless by construction: the number is `max + 1` computed under a tenant-local
 * advisory lock inside the same transaction as the insert, so two generations
 * racing cannot take the same number and no number is ever skipped by a rolled
 * back sequence. A serial that is taken and then not used is VOIDED with a
 * reason, never deleted — a register that quietly loses 47 is not gapless, it is
 * just missing a form.
 */
export async function allocateFormSerial(
  access: Access,
  input: { establishmentKey: string; formCode: string; employeeId?: string | null; statutoryInstanceId?: string | null },
): Promise<FormSerial> {
  enforce(access.context, "compliance.forms.generate", { tenantId: access.tenantId });
  const [, rows] = await tenantTx(access, [
    sqlClient`select pg_advisory_xact_lock(hashtextextended(${`statutory.serial:${access.tenantId}:${input.establishmentKey}:${input.formCode}`}, 0))`,
    sqlClient`
      insert into statutory_form_serials (tenant_id, establishment_key, form_code, serial_number, statutory_instance_id, employee_id, issued_by_membership_id)
      select ${access.tenantId}, ${input.establishmentKey}, ${input.formCode},
             coalesce(max(serial_number), 0) + 1, ${input.statutoryInstanceId ?? null}::uuid, ${input.employeeId ?? null}::uuid, ${access.context.membershipId}::uuid
      from statutory_form_serials
      where tenant_id = ${access.tenantId} and establishment_key = ${input.establishmentKey} and form_code = ${input.formCode}
      returning id, establishment_key, form_code, serial_number, statutory_instance_id, employee_id,
                issued_at::text as issued_at, voided_at::text as voided_at, void_reason
    `,
  ]);
  const row = (rows as SerialRow[])[0];
  if (!row) throw new HttpError({ status: 500, code: "INTERNAL_ERROR", message: "A form serial could not be allocated." });
  return serialRow(row);
}

/** Bind an allocated serial to the form instance that was actually written. */
export async function confirmFormSerial(access: Access, serialId: string, statutoryInstanceId: string): Promise<void> {
  await tenantTx(access, [
    sqlClient`update statutory_form_serials set statutory_instance_id = ${statutoryInstanceId}
      where tenant_id = ${access.tenantId} and id = ${serialId} and voided_at is null`,
  ]);
}

export const voidFormSerialSchema = z.object({ reason: z.string().trim().min(10).max(300) });

/**
 * Void a serial that was taken but never became a form. The number stays in the
 * register carrying its reason, which is what a paper serial register does with
 * a spoiled form and what keeps the sequence unbroken.
 */
export async function voidFormSerial(access: Access, serialId: string, reason: string, requestId: string): Promise<FormSerial> {
  const parsed = voidFormSerialSchema.safeParse({ reason });
  if (!parsed.success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason of at least 10 characters is required to void a form serial." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`update statutory_form_serials set voided_at = now(), void_reason = ${parsed.data.reason}
      where tenant_id = ${access.tenantId} and id = ${serialId} and voided_at is null
      returning id, establishment_key, form_code, serial_number, statutory_instance_id, employee_id,
                issued_at::text as issued_at, voided_at::text as voided_at, void_reason`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'statutory.form_serial_voided', 'statutory_form_serial', ${serialId}, ${parsed.data.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  const row = (rows as SerialRow[])[0];
  if (!row) throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "That serial does not exist or was already voided." });
  return serialRow(row);
}

/**
 * Pure gap check over one establishment's serials, so the register can assert its
 * own promise rather than claim it. Returns the numbers that should exist and do
 * not.
 */
export function findSerialGaps(serials: Array<{ serialNumber: number }>): number[] {
  if (serials.length === 0) return [];
  const present = new Set(serials.map((entry) => entry.serialNumber));
  const highest = Math.max(...present);
  const gaps: number[] = [];
  for (let candidate = 1; candidate <= highest; candidate += 1) {
    if (!present.has(candidate)) gaps.push(candidate);
  }
  return gaps;
}

export type FormSerialRegister = {
  formCode: string;
  establishments: Array<{
    establishmentKey: string;
    issued: number;
    voided: number;
    highestSerial: number;
    gaps: number[];
    serials: Array<FormSerial & { employeeCode: string | null; employeeName: string | null; joiningDate: string | null; instanceStatus: string | null }>;
  }>;
  gapless: boolean;
};

/**
 * RP-13 — the Form F register, per establishment, filtered by joining date.
 * `gaps` is computed, not asserted: if the sequence ever broke, the register says
 * so rather than presenting a tidy list with a number quietly absent.
 */
export async function loadFormSerialRegister(
  access: Access,
  filters: { formCode?: string; establishmentKey?: string | null; joinedFrom?: string | null; joinedTo?: string | null } = {},
): Promise<FormSerialRegister> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const formCode = (filters.formCode ?? "FORM_F").trim().toUpperCase();
  const establishmentKey = filters.establishmentKey ?? null;
  const joinedFrom = filters.joinedFrom ?? null;
  const joinedTo = filters.joinedTo ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`select s.id, s.establishment_key, s.form_code, s.serial_number, s.statutory_instance_id, s.employee_id,
        s.issued_at::text as issued_at, s.voided_at::text as voided_at, s.void_reason,
        e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as employee_name,
        e.joining_date::text as joining_date, i.status as instance_status
      from statutory_form_serials s
      left join employees e on e.tenant_id = s.tenant_id and e.id = s.employee_id
      left join vp_statutory_instances i on i.tenant_id = s.tenant_id and i.id = s.statutory_instance_id
      where s.tenant_id = ${access.tenantId} and s.form_code = ${formCode}
        and (${establishmentKey}::text is null or s.establishment_key = ${establishmentKey})
        and (${joinedFrom}::date is null or e.joining_date >= ${joinedFrom}::date)
        and (${joinedTo}::date is null or e.joining_date <= ${joinedTo}::date)
      order by s.establishment_key, s.serial_number`,
  ]);
  const grouped = new Map<string, FormSerialRegister["establishments"][number]>();
  for (const raw of rows as Array<SerialRow & { employee_code: string | null; employee_name: string | null; joining_date: string | null; instance_status: string | null }>) {
    const entry = grouped.get(raw.establishment_key) ?? {
      establishmentKey: raw.establishment_key,
      issued: 0,
      voided: 0,
      highestSerial: 0,
      gaps: [],
      serials: [],
    };
    const serial = serialRow(raw);
    entry.serials.push({
      ...serial,
      employeeCode: raw.employee_code,
      employeeName: raw.employee_name && raw.employee_name.length > 0 ? raw.employee_name : null,
      joiningDate: raw.joining_date,
      instanceStatus: raw.instance_status,
    });
    entry.issued += 1;
    if (serial.voidedAt) entry.voided += 1;
    entry.highestSerial = Math.max(entry.highestSerial, serial.serialNumber);
    grouped.set(raw.establishment_key, entry);
  }
  const establishments = [...grouped.values()].map((entry) => ({
    ...entry,
    // The gap check runs over the unfiltered sequence meaning of the rows shown;
    // a joining-date filter naturally hides serials, so it is only meaningful
    // when the register is read without one.
    gaps: joinedFrom === null && joinedTo === null ? findSerialGaps(entry.serials) : [],
  }));
  return { formCode, establishments, gapless: establishments.every((entry) => entry.gaps.length === 0) };
}

// ---------------------------------------------------------------------------
// Template configuration (Q-13 stays with the client)
// ---------------------------------------------------------------------------

export type TemplateStatus = {
  stateCode: string;
  formCode: string;
  templateKey: string;
  approved: boolean;
  version: number | null;
  effectiveFrom: string | null;
  /** The merge fields this template asks for, once one is approved. */
  mergeFields: string[];
};

export const TEMPLATE_SEEDING_INSTRUCTIONS =
  'A statutory form layout is prescribed by state rules and is client configuration, not application code. Save one with POST /api/v1/commands/save_rule_set: {"action":"save_rule_set","domain":"statutory","code":"<STATE>:<FORM_CODE>","effectiveFrom":"YYYY-MM-DD","config":{"template":"<the approved layout, with {{ merge_field }} placeholders>"}}. The layout must be the variant the establishment\'s state prescribes (open question Q-13); Nucleus supplies the figures, never the form.';

/**
 * Which state/form templates are approved and effective, and which are not.
 * Drives the refusal message so "no template" is actionable rather than terminal.
 */
export async function describeStatutoryTemplates(
  access: Access,
  filters: { stateCode?: string | null; formCode?: string | null } = {},
): Promise<{ items: TemplateStatus[]; instructions: string; derivableFields: string[] }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select code, version, effective_from::text as effective_from, config
      from vp_rule_sets
      where tenant_id = ${access.tenantId} and domain = 'statutory' and status = 'approved'
        and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
      order by code, version desc`,
  ]);
  const approved = new Map<string, { version: number; effective_from: string; template: string | null }>();
  for (const row of rows as Array<{ code: string; version: number; effective_from: string; config: { template?: string } }>) {
    if (!approved.has(row.code)) {
      approved.set(row.code, { version: row.version, effective_from: row.effective_from, template: row.config?.template ?? null });
    }
  }
  const states = filters.stateCode
    ? [filters.stateCode.trim().toUpperCase()]
    : [...new Set([...approved.keys()].map((code) => code.split(":")[0] ?? "").filter((value) => value.length > 0))];
  const forms = filters.formCode ? [filters.formCode.trim().toUpperCase()] : [...STATUTORY_FORM_CODES];
  const items: TemplateStatus[] = [];
  for (const stateCode of states) {
    for (const formCode of forms) {
      const key = statutoryTemplateKey(stateCode, formCode);
      const found = approved.get(key);
      items.push({
        stateCode,
        formCode,
        templateKey: key,
        approved: Boolean(found?.template),
        version: found?.version ?? null,
        effectiveFrom: found?.effective_from ?? null,
        mergeFields: found?.template ? templateMergeFields(found.template) : [],
      });
    }
  }
  return { items, instructions: TEMPLATE_SEEDING_INSTRUCTIONS, derivableFields: [...DERIVABLE_MERGE_FIELDS] };
}

/**
 * Every merge field this module can supply. Published so a template author can
 * write a layout against real fields instead of guessing at names.
 */
export const DERIVABLE_MERGE_FIELDS = [
  "form_code",
  "state_code",
  "period",
  "generated_on",
  "establishment_code",
  "establishment_name",
  "establishment_city",
  "establishment_state",
  "establishment_type",
  "establishment_registration_number",
  "legal_entity_code",
  "legal_entity_name",
  SERIAL_MERGE_FIELD,
  "employee_code",
  "employee_name",
  "employee_first_name",
  "employee_last_name",
  "designation",
  "nature_of_work",
  "department",
  "employment_category",
  "date_of_joining",
  "work_email",
  "employee_address",
  "employee_address_city",
  "employee_address_state",
  "employee_address_postal_code",
  "payroll_run_id",
  "employees_paid",
  "headcount_on_roll",
  "gross_wages",
  "gross_wages_minor",
  "deductions",
  "deductions_minor",
  "net_wages",
  "net_wages_minor",
] as const;

/**
 * The refusal when no approved template is effective. Actionable: it names the
 * rule-set code to save, and says why Nucleus will not supply the layout itself.
 */
export function templateNotApprovedError(stateCode: string, formCode: string): HttpError {
  const key = statutoryTemplateKey(stateCode, formCode);
  return new HttpError({
    status: 422,
    code: "RULE_PACK_NOT_APPROVED",
    message:
      `No approved ${stateCode} ${formCode} template is effective. The layout of a Factory Act form is prescribed by that state's rules and is configured, not built in: ` +
      `save it as the statutory rule set "${key}" and it becomes effective from the date you give it. Nucleus derives every figure on the form; it does not author the form.`,
    details: [
      { field: "ruleSetCode", issue: key },
      { field: "howToSupply", issue: TEMPLATE_SEEDING_INSTRUCTIONS },
    ],
  });
}
