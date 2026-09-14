import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** SCR-067 Letters and issue register: template library plus issued letters in one queue. */
export type LetterState = "template_active" | "draft" | "pending_approval" | "issued" | "reissued";

export type LetterKind = "template" | "issue";

function normalizeStatus(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Pure letter-state derivation mirrored by LETTER_ISSUE_STATUS_CASE below (unit-tested).
 * Templates are always live; issues honour supersession first, then an explicit
 * status, then the presence of an issue date, then the template approval gate.
 */
export function deriveLetterState(
  kind: LetterKind,
  raw: { approvalRequired?: boolean; issuedOn?: string | null; supersededBy?: string | null; status?: string | null },
): LetterState {
  if (kind === "template") return "template_active";
  if ((raw.supersededBy ?? "").trim() !== "") return "reissued";
  const status = normalizeStatus(raw.status);
  if (status === "draft" || status === "pending_approval" || status === "issued") return status;
  if ((raw.issuedOn ?? "").trim() !== "") return "issued";
  if (raw.approvalRequired === true) return "pending_approval";
  return "draft";
}

/** Excel-shape and legacy-shape templates carry the display name under different keys. */
export function letterTemplateName(attributes: Record<string, unknown>): string {
  const excel = attributes?.template_name;
  if (typeof excel === "string" && excel.trim() !== "") return excel;
  const legacy = attributes?.name;
  if (typeof legacy === "string" && legacy.trim() !== "") return legacy;
  return "Letter template";
}

/** SQL mirror of letterTemplateName for the alias given. */
const templateNameSql = (alias: string) =>
  `coalesce(nullif(${alias}.attributes->>'template_name', ''), nullif(${alias}.attributes->>'name', ''), 'Letter template')`;

/** SQL mirror of deriveLetterState for issues. Requires the gl and tpl aliases. */
const LETTER_ISSUE_STATUS_CASE = `case
  when coalesce(gl.attributes->>'superseded_by', '') <> '' then 'reissued'
  when replace(lower(trim(coalesce(gl.attributes->>'status', ''))), ' ', '_') in ('draft', 'pending_approval', 'issued')
    then replace(lower(trim(coalesce(gl.attributes->>'status', ''))), ' ', '_')
  when coalesce(gl.attributes->>'issued_on', '') <> '' then 'issued'
  when lower(coalesce(tpl.attributes->>'approval_required', 'false')) = 'true' then 'pending_approval'
  else 'draft' end`;

const TEMPLATE_SELECT = `select lt.id,
    'template' as kind,
    ${templateNameSql("lt")} as letter,
    coalesce(nullif(lt.attributes->>'template_code', ''), lt.id::text) as reference,
    null::text as employee_code,
    null::text as employee_name,
    lt.attributes->>'version' as version,
    null::text as effective_date,
    null::text as approver,
    lt.attributes->>'letter_type' as letter_type,
    null::jsonb as delivery_channels,
    false as acknowledgement_required,
    null::text as reprint_reason,
    'template_active' as status,
    0 as sort_group
  from letter_templates lt
  where lt.tenant_id = $1
    and (coalesce(lt.attributes->>'template_name', '') || ' ' || coalesce(lt.attributes->>'name', '') || ' '
      || coalesce(lt.attributes->>'template_code', '')) ilike $2`;

const ISSUE_EMPLOYEE_JOIN = `left join employees e on e.tenant_id = gl.tenant_id
    and e.id = coalesce(gl.employee_id, (gl.attributes->>'employee_id')::uuid)`;

const ISSUE_SELECT = `select gl.id,
    'issue' as kind,
    ${templateNameSql("tpl")} as letter,
    coalesce(nullif(gl.attributes->>'letter_reference', ''), gl.id::text) as reference,
    e.employee_code,
    case when e.id is null then null else e.first_name || ' ' || e.last_name end as employee_name,
    coalesce(gl.attributes->>'template_version', tpl.attributes->>'version') as version,
    gl.attributes->>'issued_on' as effective_date,
    gl.attributes->>'approver' as approver,
    gl.attributes->>'letter_type' as letter_type,
    gl.attributes->'delivery_channels' as delivery_channels,
    coalesce((gl.attributes->>'acknowledgement_required')::boolean, false) as acknowledgement_required,
    gl.attributes->>'reprint_reason' as reprint_reason,
    (${LETTER_ISSUE_STATUS_CASE}) as status,
    1 as sort_group
  from generated_letters gl
  left join letter_templates tpl on tpl.tenant_id = gl.tenant_id and tpl.id = gl.letter_template_id
  ${ISSUE_EMPLOYEE_JOIN}
  where gl.tenant_id = $1
    and (${templateNameSql("tpl")} || ' ' || coalesce(gl.attributes->>'letter_reference', '') || ' '
      || coalesce(e.employee_code, '') || ' ' || coalesce(e.first_name, '') || ' '
      || coalesce(e.last_name, '')) ilike $2`;

export type LetterRegisterRow = {
  id: string;
  kind: LetterKind;
  letter: string;
  reference: string;
  employee_code: string | null;
  employee_name: string | null;
  version: string | null;
  effective_date: string | null;
  approver: string | null;
  letter_type: string | null;
  delivery_channels: string[] | null;
  acknowledgement_required: boolean;
  reprint_reason: string | null;
  status: LetterState;
};

export type LetterIssueRow = {
  id: string;
  reference: string;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  status: LetterState;
};

/** Unified queue: the template library first, then every issued letter. */
export async function listLettersRegister(access: Access, search: string): Promise<LetterRegisterRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select id, kind, letter, reference, employee_code, employee_name, version, effective_date, approver,
              letter_type, delivery_channels, acknowledgement_required, reprint_reason, status
       from (
         ${TEMPLATE_SELECT}
         union all
         ${ISSUE_SELECT}
       ) queue
       order by sort_group asc, reference asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return rows as LetterRegisterRow[];
}

/** Single template or issued letter, with downstream issues and an isolated audit trail. */
export async function getLetterRecord(access: Access, id: string, kind: LetterKind) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    kind === "template"
      ? sqlClient.query(
          `select lt.id,
             'template' as kind,
             ${templateNameSql("lt")} as letter,
             coalesce(nullif(lt.attributes->>'template_code', ''), lt.id::text) as reference,
             null::text as employee_code,
             null::text as employee_name,
             lt.attributes->>'version' as version,
             null::text as effective_date,
             null::text as approver,
             lt.attributes->>'letter_type' as letter_type,
             null::jsonb as delivery_channels,
             false as acknowledgement_required,
             null::text as reprint_reason,
             'template_active' as status,
             coalesce(lt.attributes->>'subject', '') as subject,
             lt.attributes as attributes
           from letter_templates lt
           where lt.tenant_id = $1 and lt.id = $2::uuid limit 1`,
          [access.tenantId, id],
        )
      : sqlClient.query(
          `select gl.id,
             'issue' as kind,
             ${templateNameSql("tpl")} as letter,
             coalesce(nullif(gl.attributes->>'letter_reference', ''), gl.id::text) as reference,
             e.employee_code,
             case when e.id is null then null else e.first_name || ' ' || e.last_name end as employee_name,
             coalesce(gl.attributes->>'template_version', tpl.attributes->>'version') as version,
             gl.attributes->>'issued_on' as effective_date,
             gl.attributes->>'approver' as approver,
             gl.attributes->>'letter_type' as letter_type,
             gl.attributes->'delivery_channels' as delivery_channels,
             coalesce((gl.attributes->>'acknowledgement_required')::boolean, false) as acknowledgement_required,
             gl.attributes->>'reprint_reason' as reprint_reason,
             (${LETTER_ISSUE_STATUS_CASE}) as status,
             coalesce(tpl.attributes->>'subject', '') as subject,
             gl.attributes as attributes
           from generated_letters gl
           left join letter_templates tpl on tpl.tenant_id = gl.tenant_id and tpl.id = gl.letter_template_id
           ${ISSUE_EMPLOYEE_JOIN}
           where gl.tenant_id = $1 and gl.id = $2::uuid limit 1`,
          [access.tenantId, id],
        ),
  ]);
  const record = (rows as LetterRegisterRow[])[0];
  if (!record) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  let issues: LetterIssueRow[] = [];
  if (kind === "template") {
    const [issueRows] = await tenantTx(access, [
      sqlClient.query(
        `select gl.id,
           coalesce(nullif(gl.attributes->>'letter_reference', ''), gl.id::text) as reference,
           e.employee_code,
           case when e.id is null then null else e.first_name || ' ' || e.last_name end as employee_name,
           gl.attributes->>'issued_on' as issued_on,
           (${LETTER_ISSUE_STATUS_CASE}) as status
         from generated_letters gl
         left join letter_templates tpl on tpl.tenant_id = gl.tenant_id and tpl.id = gl.letter_template_id
         ${ISSUE_EMPLOYEE_JOIN}
         where gl.tenant_id = $1 and gl.letter_template_id = $2::uuid
         order by coalesce(gl.attributes->>'issued_on', '') desc, gl.created_at desc limit 20`,
        [access.tenantId, id],
      ),
    ]);
    issues = issueRows as LetterIssueRow[];
  }
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type in ('letter_template', 'generated_letter')
          and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, issues, auditTrail };
}

/** Audit action bound as a parameter so the SQL text stays free of dotted identifiers. */
const ISSUE_ACTION = "letter.issue";

/**
 * Letter issue (FRM-EXP-01). `approver` is the workbook's signatory - the person the
 * letter is issued under - and is left under the name the register already prints.
 *
 * A reprint carries the template version the original was issued on, never the current
 * one; that is the whole point of retaining the version, and it is why a reprint copies
 * the original's version rather than re-reading the template.
 */
export const REPRINT_REASON_MIN_LENGTH = 10;

export const issueLetterSchema = z.object({
  letterType: z.enum(picklistValues("PL_LETTER_TYPE")),
  templateId: z.string().uuid(),
  employeeId: z.string().uuid(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  approver: z.string().trim().min(2).max(120),
  deliveryChannels: z.array(z.enum(picklistValues("PL_RELEASE_CHANNEL"))).min(1).default(["email", "employee_portal"]),
  acknowledgementRequired: z.boolean().default(true),
  /** Values for the merge fields a template cannot fill from the record itself. */
  manualFields: z.record(z.string().trim().min(1).max(60), z.string().trim().max(500)).optional(),
  reprintOfLetterId: z.string().uuid().optional(),
  reprintReason: z.string().trim().min(REPRINT_REASON_MIN_LENGTH).max(200).optional(),
  reason: z.string().trim().min(3).max(500),
}).refine(
  (input) => input.reprintOfLetterId === undefined || input.reprintReason !== undefined,
  { path: ["reprintReason"], message: `A reprint needs a reason of at least ${REPRINT_REASON_MIN_LENGTH} characters.` },
);

export type IssueLetterInput = z.infer<typeof issueLetterSchema>;

/** Deterministic human reference derived from the new row id; no sequence is invented. */
export function letterReferenceFor(id: string, effectiveDate: string): string {
  const year = effectiveDate.slice(0, 4);
  const suffix = id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `LTR-${year}-${suffix}`;
}

/** Issue a letter from a template to an employee. */
export async function issueLetter(
  access: Access,
  input: IssueLetterInput,
  requestId: string,
): Promise<{ id: string; reference: string }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [templateRows, employeeRows] = await tenantTx(access, [
    sqlClient`select id, attributes->>'version' as version from letter_templates where tenant_id = ${access.tenantId} and id = ${input.templateId} limit 1`,
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
  ]);
  if ((templateRows as unknown[]).length === 0 || (employeeRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  let templateVersion = (templateRows as Array<{ version: string | null }>)[0]?.version ?? null;
  if (input.reprintOfLetterId) {
    const [originalRows] = await tenantTx(access, [
      sqlClient`select id, attributes->>'template_version' as template_version from generated_letters
        where tenant_id = ${access.tenantId} and id = ${input.reprintOfLetterId} limit 1`,
    ]);
    const original = (originalRows as Array<{ id: string; template_version: string | null }>)[0];
    if (!original) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The letter being reprinted was not found." });
    templateVersion = original.template_version ?? templateVersion;
  }
  const id = randomUUID();
  const reference = letterReferenceFor(id, input.effectiveDate);
  const attributes = {
    letter_type: input.letterType,
    template_version: templateVersion,
    issued_on: input.effectiveDate,
    approver: input.approver,
    delivery_channels: input.deliveryChannels,
    acknowledgement_required: input.acknowledgementRequired,
    manual_fields: input.manualFields ?? null,
    reprint_of: input.reprintOfLetterId ?? null,
    reprint_reason: input.reprintReason ?? null,
    status: "issued",
    letter_reference: reference,
  };
  await tenantTx(access, [
    sqlClient`insert into generated_letters (id, tenant_id, letter_template_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.templateId}, ${input.employeeId}, ${JSON.stringify(attributes)}::jsonb)`,
    ...(input.reprintOfLetterId ? [sqlClient`update generated_letters
      set attributes = attributes || jsonb_build_object('superseded_by', ${id}::text), updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${input.reprintOfLetterId}`] : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${ISSUE_ACTION}, 'generated_letter', ${id}, ${input.reason},
        ${JSON.stringify({ ...attributes, template_id: input.templateId, employee_id: input.employeeId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, reference };
}


type EmployeeData = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  designation: string;
  department: string;
  location: string;
  joining_date: string | null;
  basic_salary_minor: number | null;
  date_of_birth: string | null;
  probation_end_date: string | null;
};

async function fetchEmployee(access: Access, employeeId: string): Promise<EmployeeData> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, first_name, last_name, employee_code, designation, department, location,
             joining_date::text, basic_salary_minor, date_of_birth::text, probation_end_date::text
      from employees
      where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
  ]);
  const emp = (rows as EmployeeData[])[0];
  if (!emp) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Employee not found." });
  return emp;
}

export const generateLetterSchema = z.object({
  employeeId: z.string().uuid(),
  letterType: z.enum(["appointment", "confirmation", "increment", "experience", "no_dues", "offer", "relieving", "form_f", "transfer"]),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function generateHrLetter(access: Access, input: z.infer<typeof generateLetterSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const emp = await fetchEmployee(access, input.employeeId);
  const content = `${input.letterType.toUpperCase()} LETTER\n\nFor: ${emp.first_name} ${emp.last_name} (${emp.employee_code})\nDate: ${new Date().toISOString().slice(0, 10)}\n`;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into hr_letters (id, tenant_id, employee_id, letter_type, content, generated_by_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.letterType}, ${content}, ${access.context.membershipId},
        ${JSON.stringify(input.attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'people.letter_generate', 'hr_letter', ${id},
        'HR letter generated',
        ${JSON.stringify({ letterType: input.letterType, employeeId: input.employeeId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, letterType: input.letterType, content, employeeId: input.employeeId, employeeName: `${emp.first_name} ${emp.last_name}` };
}

export async function listHrLetters(access: Access, args: { employeeId?: string | null; letterType?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from hr_letters
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.letterType ?? null}::text is null or letter_type = ${args.letterType ?? null}::text)
    `,
    sqlClient`
      select l.id, l.employee_id, l.letter_type, l.generated_at, l.attributes,
             e.first_name, e.last_name, e.employee_code
      from hr_letters l
      join employees e on e.id = l.employee_id and e.tenant_id = l.tenant_id
      where l.tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or l.employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.letterType ?? null}::text is null or l.letter_type = ${args.letterType ?? null}::text)
      order by l.generated_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}
