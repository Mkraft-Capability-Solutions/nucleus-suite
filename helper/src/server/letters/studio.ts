import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { letterReferenceFor, letterTemplateName } from "@/server/letters/service";
import { mergeFieldSpec, referencedMergeFields } from "@/server/letters/merge-fields";

/**
 * HR Letter Studio — the merge side of SCR-067.
 *
 * `service.ts` already owns the register (list, detail, template save, issue). This
 * module adds only what a two-pane merge studio needs and the register does not have:
 * a *preview* that says, token by token, which column supplied which value, and a
 * draft writer that stamps the merged text on a `generated_letters` row.
 *
 * Two rules govern everything below.
 *
 *  1. A token is resolved from a column this database actually holds, or it is
 *     reported unresolved with the reason. Nothing is guessed, and nothing is
 *     derived from a neighbouring figure (basic pay is not CTC).
 *  2. Every resolution carries its `source` — the table and column it came from —
 *     so the person signing the letter can check it rather than trust it.
 *
 * `merge-fields.ts` classifies several tokens as `manual` because *the employee row*
 * cannot supply them. That classification is about `employees` alone. Some of those
 * tokens do have a real source one join away (`employments.probationMonths`,
 * `employee_assignments.noticePeriodDays`, `grades.code`, a finalised payroll run),
 * and those are resolved here, each naming the join it came from. The ones with no
 * source anywhere — CTC, a disciplinary history, a last working day — stay
 * unresolved, and the studio prints `[no value: token]` where they sit.
 */

/** How a token was filled, shown verbatim in the studio's provenance table. */
export type TokenScope = "merge" | "recipient" | "letterhead";

export type TokenResolution = {
  /** `name`, `letterhead.company` — the token as the preview labels it. */
  token: string;
  label: string;
  scope: TokenScope;
  /** `null` means nothing in this tenant's data supplies it. Never a blank string. */
  value: string | null;
  /** The table and column the value came from, or why nothing could. */
  source: string;
  /** Money only: the exact minor-unit amount, so the client formats it itself. */
  amountMinor?: number;
  currency?: string;
};

export type StudioTemplate = {
  id: string;
  name: string;
  code: string;
  letterType: string | null;
  version: string | null;
  subject: string;
  body: string;
  /** Tokens the subject and body reference, first-seen order. */
  tokens: string[];
};

export type StudioRecipient = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  location: string;
  status: string;
};

export type StudioCatalogue = {
  templates: StudioTemplate[];
  recipients: StudioRecipient[];
  /**
   * There is no PDF renderer anywhere in this repository, so the studio offers
   * print and a stored draft, and says as much rather than showing a dead button.
   */
  pdfExportAvailable: false;
  /** Whether the caller may read the payroll figures some tokens need. */
  compensationReadable: boolean;
};

export type StudioPreview = {
  template: { id: string; name: string; code: string; version: string | null; letterType: string | null };
  recipient: StudioRecipient;
  subject: string;
  /** The merged text. Unresolved tokens appear as `[no value: token]`, never blank. */
  body: string;
  tokens: TokenResolution[];
  unresolved: string[];
  /** Stated, not shown as a number: the reference exists only once a draft is stored. */
  referenceNote: string;
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/**
 * Mirrors `currencyLabel()` in `components/hrms/workforce/records.ts`, which cannot be
 * imported here: that module is a client module. Minor units in, rupees out, never
 * through a float beyond the single divide the formatter needs.
 */
function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function bigint(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** A code with its display name, e.g. `Quality Assurance (QA)`; the code alone if unnamed. */
function displayOrCode(name: string | null, code: string | null): string | null {
  const resolvedName = text(name);
  const resolvedCode = text(code);
  if (resolvedName && resolvedCode && resolvedName !== resolvedCode) return `${resolvedName} (${resolvedCode})`;
  return resolvedName ?? resolvedCode;
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

type TemplateRow = { id: string; attributes: Record<string, unknown> | null };

function projectTemplate(row: TemplateRow): StudioTemplate {
  const attributes = row.attributes ?? {};
  const subject = text(attributes.subject) ?? "";
  const body = text(attributes.body) ?? "";
  return {
    id: row.id,
    name: letterTemplateName(attributes),
    code: text(attributes.template_code) ?? row.id.slice(0, 8),
    letterType: text(attributes.letter_type),
    version: text(attributes.version),
    subject,
    body,
    tokens: referencedMergeFields([subject, body].join("\n")),
  };
}

type RecipientRow = {
  id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  designation_code: string | null;
  designation_name: string | null;
  department_code: string | null;
  department_name: string | null;
  location_code: string | null;
  location_name: string | null;
  status: string | null;
};

function projectRecipient(row: RecipientRow): StudioRecipient {
  return {
    id: row.id,
    employeeCode: text(row.employee_code) ?? row.id.slice(0, 8),
    name: `${text(row.first_name) ?? ""} ${text(row.last_name) ?? ""}`.trim() || "Unnamed employee",
    designation: displayOrCode(row.designation_name, row.designation_code) ?? "No designation on record",
    department: displayOrCode(row.department_name, row.department_code) ?? "No department on record",
    location: displayOrCode(row.location_name, row.location_code) ?? "No location on record",
    status: text(row.status) ?? "unknown",
  };
}

/**
 * `employees` joined to the code tables the directory already resolves names from.
 * Built per call: a tagged-template query object runs once, so it cannot be hoisted
 * to a module constant and shared between requests.
 */
const recipientSelect = (tenantId: string) => sqlClient`
  select e.id, e.employee_code, e.first_name, e.last_name,
    e.designation as designation_code,
    coalesce(jp.attributes->>'title', jp.attributes->>'name') as designation_name,
    e.department as department_code, dep.attributes->>'name' as department_name,
    e.location as location_code, loc.attributes->>'name' as location_name,
    e.status
  from employees e
  left join job_profiles jp on jp.tenant_id = e.tenant_id and jp.attributes->>'code' = e.designation
  left join departments dep on dep.tenant_id = e.tenant_id and dep.attributes->>'code' = e.department
  left join locations loc on loc.tenant_id = e.tenant_id and loc.attributes->>'code' = e.location
  where e.tenant_id = ${tenantId}
  order by e.employee_code asc
  limit 200
`;

/**
 * Templates and recipients for the studio's two selectors.
 *
 * Both lists are the tenant's own rows. An empty template list is returned as an
 * empty list, and the studio says no template is configured — it does not fall back
 * to a specimen letter.
 */
export async function letterStudioCatalogue(access: Access): Promise<StudioCatalogue> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [templateRows, recipientRows] = await tenantTx(access, [
    sqlClient`select id, attributes from letter_templates where tenant_id = ${access.tenantId} order by created_at asc limit 200`,
    recipientSelect(access.tenantId),
  ]);
  return {
    templates: (templateRows as TemplateRow[]).map(projectTemplate),
    recipients: (recipientRows as RecipientRow[]).map(projectRecipient),
    pdfExportAvailable: false,
    compensationReadable: canReadCompensation(access),
  };
}

/* ------------------------------------------------------------------ */
/* Employee facts behind the tokens                                    */
/* ------------------------------------------------------------------ */

type EmployeeFactRow = RecipientRow & {
  location_city: string | null;
  location_state: string | null;
  joining_date: string | null;
  confirmation_date: string | null;
  manager_name: string | null;
  manager_code: string | null;
  probation_months: string | null;
  notice_days: string | null;
  band_code: string | null;
  entity_legal_name: string | null;
  entity_code: string | null;
};

type PayRow = {
  period: string | null;
  currency: string | null;
  gross_minor: string | number | null;
  net_minor: string | number | null;
  deductions_minor: string | number | null;
  run_employee_id: string;
};

type PayLineRow = { code: string | null; kind: string | null; amount: string | number | null };

/**
 * Compensation figures are payroll data, so they are gated on the payroll read the
 * payroll services already enforce. This is a *check*, not an enforcement: a caller
 * without it still gets the letter, with the pay tokens reported unresolved and the
 * reason given. Nothing is widened — a caller who cannot read payroll never sees a
 * payroll figure.
 */
function canReadCompensation(access: Access): boolean {
  return authorize(access.context, { action: "payroll.read", resource: { tenantId: access.tenantId } }).allowed;
}

async function readEmployeeFacts(access: Access, employeeId: string): Promise<EmployeeFactRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name,
        e.designation as designation_code,
        coalesce(jp.attributes->>'title', jp.attributes->>'name') as designation_name,
        e.department as department_code, dep.attributes->>'name' as department_name,
        e.location as location_code, loc.attributes->>'name' as location_name,
        loc.attributes->>'city' as location_city, loc.attributes->>'state' as location_state,
        e.status,
        e.joining_date::text as joining_date,
        e.metadata->>'confirmation_date' as confirmation_date,
        mgr.employee_code as manager_code,
        case when mgr.id is null then null
          else trim(coalesce(mgr.first_name, '') || ' ' || coalesce(mgr.last_name, '')) end as manager_name,
        emp.probation_months, emp.notice_days, emp.band_code,
        le.legal_name as entity_legal_name, le.code as entity_code
      from employees e
      left join job_profiles jp on jp.tenant_id = e.tenant_id and jp.attributes->>'code' = e.designation
      left join departments dep on dep.tenant_id = e.tenant_id and dep.attributes->>'code' = e.department
      left join locations loc on loc.tenant_id = e.tenant_id and loc.attributes->>'code' = e.location
      left join employees mgr on mgr.tenant_id = e.tenant_id and mgr.id = e.manager_employee_id
      left join lateral (
        select em.legal_entity_id,
          em.attributes->>'probationMonths' as probation_months,
          ea.attributes->>'noticePeriodDays' as notice_days,
          g.attributes->>'code' as band_code
        from employments em
        left join employee_assignments ea on ea.tenant_id = em.tenant_id and ea.employment_id = em.id
        left join grades g on g.tenant_id = ea.tenant_id and g.id = ea.grade_id
        where em.tenant_id = e.tenant_id and em.employee_id = e.id
        order by em.created_at desc limit 1
      ) emp on true
      left join legal_entities le on le.tenant_id = e.tenant_id and le.id = emp.legal_entity_id
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId}
      limit 1
    `,
  ]);
  const row = (rows as EmployeeFactRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/** The tenant's own name, the last fallback for a letterhead with no legal entity. */
async function readTenantName(access: Access): Promise<string | null> {
  try {
    const [rows] = await tenantTx(access, [
      sqlClient`select coalesce(nullif(legal_name, ''), name) as name from tenants where id = ${access.tenantId} limit 1`,
    ]);
    return text((rows as Array<{ name: string | null }>)[0]?.name);
  } catch {
    return null;
  }
}

/**
 * The most recent FINALISED payroll run for this employee, with its lines.
 *
 * Finalised only: a letter that quotes a figure from a run still being calculated
 * quotes a number that can still change. `null` when no such run exists, which the
 * pay tokens then report as their reason.
 */
async function readLatestPay(access: Access, employeeId: string): Promise<{ pay: PayRow; lines: PayLineRow[] } | null> {
  try {
    const [payRows] = await tenantTx(access, [
      sqlClient`
        select r.period, r.currency,
          pre.attributes->>'gross_minor' as gross_minor,
          pre.attributes->>'net_minor' as net_minor,
          pre.attributes->>'deductions_minor' as deductions_minor,
          pre.id as run_employee_id
        from payroll_run_employees pre
        join payroll_runs r on r.tenant_id = pre.tenant_id and r.id = pre.payroll_run_id
        where pre.tenant_id = ${access.tenantId} and pre.employee_id = ${employeeId}
          and r.finalized_at is not null
        order by r.period desc
        limit 1
      `,
    ]);
    const pay = (payRows as PayRow[])[0];
    if (!pay) return null;
    const [lineRows] = await tenantTx(access, [
      sqlClient`
        select attributes->>'code' as code, attributes->>'kind' as kind, attributes->>'amount_minor' as amount
        from payroll_lines
        where tenant_id = ${access.tenantId} and payroll_run_employee_id = ${pay.run_employee_id}
        order by created_at asc
      `,
    ]);
    return { pay, lines: lineRows as PayLineRow[] };
  } catch {
    // The payroll tables are provisioned by a later migration in some tenants. A
    // missing source is "no value", never a 500 on the letter.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Token resolution                                                    */
/* ------------------------------------------------------------------ */

type Resolved = { value: string | null; source: string; amountMinor?: number; currency?: string };

const NO_SOURCE = (reason: string): Resolved => ({ value: null, source: reason });

/**
 * Every merge token the studio can fill, and the exact column behind it.
 *
 * A token absent from this map has no source in this schema at all; the studio then
 * falls back to the catalogue's own note in `merge-fields.ts`, which states why.
 */
function resolveMergeToken(
  token: string,
  facts: EmployeeFactRow,
  pay: { pay: PayRow; lines: PayLineRow[] } | null,
  compensationReadable: boolean,
  issuedOn: string,
): Resolved {
  const payPeriod = pay?.pay.period ?? null;
  const payCurrency = text(pay?.pay.currency) ?? "INR";
  const payGated = (): Resolved =>
    !compensationReadable
      ? NO_SOURCE("Payroll figures are withheld: this role does not hold `payroll.read`.")
      : NO_SOURCE("No finalised payroll run exists for this employee, so there is no figure to quote.");

  switch (token) {
    case "name": {
      const value = `${text(facts.first_name) ?? ""} ${text(facts.last_name) ?? ""}`.trim();
      return value === ""
        ? NO_SOURCE("`employees.first_name` / `employees.last_name` are blank on this record.")
        : { value, source: "employees.first_name + employees.last_name" };
    }
    case "designation": {
      const value = displayOrCode(facts.designation_name, facts.designation_code);
      return value
        ? { value, source: "job_profiles.attributes.title, matched on employees.designation" }
        : NO_SOURCE("`employees.designation` is blank on this record.");
    }
    case "doj": {
      const value = text(facts.joining_date);
      return value ? { value, source: "employees.joining_date" } : NO_SOURCE("`employees.joining_date` is blank on this record.");
    }
    case "location": {
      const value = displayOrCode(facts.location_name, facts.location_code);
      return value
        ? { value, source: "locations.attributes.name, matched on employees.location" }
        : NO_SOURCE("`employees.location` is blank on this record.");
    }
    case "reporting_to": {
      const value = text(facts.manager_name);
      return value
        ? { value, source: `employees.manager_employee_id → ${text(facts.manager_code) ?? "manager"}` }
        : NO_SOURCE("No reporting manager is set on `employees.manager_employee_id`.");
    }
    case "confirmation_date": {
      const value = text(facts.confirmation_date);
      return value
        ? { value, source: "employees.metadata.confirmation_date" }
        : NO_SOURCE("This employee has not been confirmed: `employees.metadata.confirmation_date` is unset.");
    }
    case "band": {
      const value = text(facts.band_code);
      return value
        ? { value, source: "grades.attributes.code, via employee_assignments.grade_id" }
        : NO_SOURCE("No grade is assigned on `employee_assignments.grade_id`.");
    }
    case "notice_days": {
      const value = text(facts.notice_days);
      return value
        ? { value, source: "employee_assignments.attributes.noticePeriodDays" }
        : NO_SOURCE("`employee_assignments.attributes.noticePeriodDays` is unset for this employee.");
    }
    case "probation_months": {
      const value = text(facts.probation_months);
      return value
        ? { value, source: "employments.attributes.probationMonths" }
        : NO_SOURCE("`employments.attributes.probationMonths` is unset for this employee.");
    }
    case "effective_date":
      return { value: issuedOn, source: "The issue date entered in this studio, stored on the letter." };
    case "period":
      return payPeriod && compensationReadable
        ? { value: payPeriod, source: "payroll_runs.period of the latest finalised run" }
        : payGated();
    case "gross": {
      const amount = compensationReadable ? bigint(pay?.pay.gross_minor) : null;
      return amount === null
        ? payGated()
        : {
            value: money(amount, payCurrency),
            source: `payroll_run_employees.attributes.gross_minor, period ${payPeriod ?? "unknown"}`,
            amountMinor: amount,
            currency: payCurrency,
          };
    }
    case "net": {
      const amount = compensationReadable ? bigint(pay?.pay.net_minor) : null;
      return amount === null
        ? payGated()
        : {
            value: money(amount, payCurrency),
            source: `payroll_run_employees.attributes.net_minor, period ${payPeriod ?? "unknown"}`,
            amountMinor: amount,
            currency: payCurrency,
          };
    }
    case "components_table": {
      if (!compensationReadable || !pay || pay.lines.length === 0) return payGated();
      const rows = pay.lines
        .map((line) => {
          const amount = bigint(line.amount);
          const label = text(line.code) ?? "component";
          const kind = text(line.kind) === "deduction" ? "Deduction" : "Earning";
          return amount === null ? null : `${label} (${kind}): ${money(amount, payCurrency)}`;
        })
        .filter((line): line is string => line !== null);
      return rows.length === 0
        ? payGated()
        : {
            value: rows.join("\n"),
            source: `payroll_lines for period ${payPeriod ?? "unknown"} — every earning and statutory deduction on the run`,
          };
    }
    default:
      return NO_SOURCE(mergeFieldSpec(token)?.note ?? `\`${token}\` is not a merge field this system recognises.`);
  }
}

/** Fixed rows always shown alongside the merge tokens: who it is for, whose paper it is on. */
function contextRows(facts: EmployeeFactRow, tenantName: string | null, issuedOn: string): TokenResolution[] {
  const employeeCode = text(facts.employee_code);
  const department = displayOrCode(facts.department_name, facts.department_code);
  const company = text(facts.entity_legal_name) ?? tenantName;
  const addressParts = [displayOrCode(facts.location_name, facts.location_code), text(facts.location_city), text(facts.location_state)]
    .filter((part): part is string => part !== null);
  return [
    {
      token: "recipient.employee_code",
      label: "Employee code",
      scope: "recipient",
      value: employeeCode,
      source: employeeCode ? "employees.employee_code" : "`employees.employee_code` is blank on this record.",
    },
    {
      token: "recipient.department",
      label: "Department",
      scope: "recipient",
      value: department,
      source: department
        ? "departments.attributes.name, matched on employees.department"
        : "`employees.department` is blank on this record.",
    },
    {
      token: "letterhead.company",
      label: "Issuing company",
      scope: "letterhead",
      value: company,
      source: text(facts.entity_legal_name)
        ? "legal_entities.legal_name, via the employee's employment"
        : tenantName
          ? "tenants.legal_name — no legal entity is linked to this employee's employment"
          : "Neither a legal entity nor a tenant legal name is recorded.",
    },
    {
      token: "letterhead.entity_code",
      label: "Entity code",
      scope: "letterhead",
      value: text(facts.entity_code),
      source: text(facts.entity_code)
        ? "legal_entities.code"
        : "No legal entity is linked to this employee's employment.",
    },
    {
      token: "letterhead.address",
      label: "Issuing address",
      scope: "letterhead",
      value: addressParts.length > 0 ? addressParts.join(", ") : null,
      source:
        addressParts.length > 0
          ? "locations.attributes (name, city, state) for the employee's location"
          : "No address is held on the employee's location record.",
    },
    {
      token: "letterhead.issue_date",
      label: "Issue date",
      scope: "letterhead",
      value: issuedOn,
      source: "The issue date entered in this studio, stored on the letter.",
    },
  ];
}

/** `{{ token }}` — the same tolerance `merge-fields.ts` applies. */
const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Fill a template's placeholders.
 *
 * An unresolved token becomes `[no value: token]` — visible, checkable, and
 * impossible to mistake for text the template author wrote. It is never left blank
 * and never left as the raw placeholder, both of which read as finished copy.
 */
function mergeText(source: string, values: Map<string, string | null>): string {
  return source.replace(PLACEHOLDER, (_whole, raw: string) => {
    const token = raw.trim();
    return values.get(token) ?? `[no value: ${token}]`;
  });
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

export const studioPreviewSchema = z.object({
  templateId: z.string().uuid(),
  employeeId: z.string().uuid(),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type StudioPreviewInput = z.infer<typeof studioPreviewSchema>;

async function buildPreview(access: Access, input: StudioPreviewInput): Promise<StudioPreview> {
  const [templateRows] = await tenantTx(access, [
    sqlClient`select id, attributes from letter_templates where tenant_id = ${access.tenantId} and id = ${input.templateId} limit 1`,
  ]);
  const templateRow = (templateRows as TemplateRow[])[0];
  if (!templateRow) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const template = projectTemplate(templateRow);
  if (template.body === "") {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "This template carries no body, so there is nothing to merge or to preview.",
      details: [{ field: "templateId", issue: "The template has no `body`. Save one through POST /api/v1/letters/templates." }],
    });
  }

  const facts = await readEmployeeFacts(access, input.employeeId);
  const compensationReadable = canReadCompensation(access);
  const pay = compensationReadable ? await readLatestPay(access, input.employeeId) : null;
  const tenantName = await readTenantName(access);

  const mergeRows: TokenResolution[] = template.tokens.map((token) => {
    const resolved = resolveMergeToken(token, facts, pay, compensationReadable, input.issuedOn);
    return {
      token,
      label: mergeFieldSpec(token)?.label ?? token,
      scope: "merge",
      value: resolved.value,
      source: resolved.source,
      ...(resolved.amountMinor === undefined ? {} : { amountMinor: resolved.amountMinor, currency: resolved.currency }),
    };
  });
  const values = new Map<string, string | null>(mergeRows.map((row) => [row.token, row.value]));

  return {
    template: { id: template.id, name: template.name, code: template.code, version: template.version, letterType: template.letterType },
    recipient: projectRecipient(facts),
    subject: mergeText(template.subject, values),
    body: mergeText(template.body, values),
    tokens: [...mergeRows, ...contextRows(facts, tenantName, input.issuedOn)],
    unresolved: mergeRows.filter((row) => row.value === null).map((row) => row.token),
    referenceNote: "A reference number is assigned and stored when the draft is saved; none is shown before then.",
  };
}

/** Preview one template merged for one employee, with every token's provenance. */
export async function previewStudioLetter(access: Access, input: StudioPreviewInput): Promise<StudioPreview> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  return buildPreview(access, input);
}

/* ------------------------------------------------------------------ */
/* Draft                                                               */
/* ------------------------------------------------------------------ */

export const saveStudioDraftSchema = studioPreviewSchema.extend({
  reason: z.string().trim().min(3).max(500),
});

export type SaveStudioDraftInput = z.infer<typeof saveStudioDraftSchema>;

export type SaveStudioDraftResult = {
  id: string;
  reference: string;
  issuedOn: string;
  unresolved: string[];
};

/**
 * Save a merged letter as a draft on `generated_letters`.
 *
 * The body written is the body the SERVER merges, not the text the browser had on
 * screen: a client that edited its copy of the preview cannot store a letter whose
 * values never came from the record.
 *
 * The draft is stored with its holes intact — `[no value: token]` where a value did
 * not exist — and the token list alongside it. That is deliberate: a draft is the
 * document a person still has to complete, and hiding the gaps would let one be
 * issued without anyone seeing them. `issueLetter` still refuses to *issue* a letter
 * with an unresolved field, so no holed letter can leave the system.
 */
export async function saveStudioDraft(
  access: Access,
  input: SaveStudioDraftInput,
  requestId: string,
): Promise<SaveStudioDraftResult> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const preview = await buildPreview(access, input);

  const id = randomUUID();
  const reference = letterReferenceFor(id, input.issuedOn);
  const mergeValues = Object.fromEntries(
    preview.tokens
      .filter((row) => row.scope === "merge" && row.value !== null)
      .map((row) => [row.token, row.value as string]),
  );
  const attributes = {
    letter_type: preview.template.letterType,
    template_name: preview.template.name,
    template_version: preview.template.version,
    rendered_subject: preview.subject,
    rendered_body: preview.body,
    merge_values: mergeValues,
    // The provenance shown in the studio, stored with the draft so the reader of the
    // record later can see which column each value came from.
    merge_sources: Object.fromEntries(preview.tokens.map((row) => [row.token, row.source])),
    unresolved_tokens: preview.unresolved,
    snapshot_source: "letter_studio_draft",
    issued_on: input.issuedOn,
    status: "draft",
    letter_reference: reference,
  };

  await tenantTx(access, [
    sqlClient`insert into generated_letters (id, tenant_id, letter_template_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.templateId}, ${input.employeeId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'letter.studio_draft', 'generated_letter', ${id}, ${input.reason},
        ${JSON.stringify({ ...attributes, template_id: input.templateId, employee_id: input.employeeId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, reference, issuedOn: input.issuedOn, unresolved: preview.unresolved };
}
