import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  MERGE_FIELDS,
  MERGE_FIELD_KEYS,
  RECORD_MERGE_FIELD_KEYS,
  referencedMergeFields,
  renderTemplate,
  validateTemplateMergeFields,
  type MergeEmployee,
} from "@/server/letters/merge-fields";

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

/**
 * The template name AS THE ISSUE CARRIES IT. An issued letter reproduces as sent, so
 * the name stamped on it at issue outranks the template's current name - renaming a
 * template must not rewrite the letters already out. Falls back to the live template
 * for rows issued before the snapshot existed.
 */
const ISSUED_NAME_SQL = `coalesce(nullif(gl.attributes->>'template_name', ''), ${templateNameSql("tpl")})`;

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
    ${ISSUED_NAME_SQL} as letter,
    coalesce(nullif(gl.attributes->>'letter_reference', ''), gl.id::text) as reference,
    e.employee_code,
    case when e.id is null then null else e.first_name || ' ' || e.last_name end as employee_name,
    coalesce(gl.attributes->>'template_version', tpl.attributes->>'version') as version,
    gl.attributes->>'issued_on' as effective_date,
    gl.attributes->>'approver' as approver,
    gl.attributes->>'letter_type' as letter_type,
    gl.document_id,
    gl.attributes->'delivery_channels' as delivery_channels,
    coalesce((gl.attributes->>'acknowledgement_required')::boolean, false) as acknowledgement_required,
    gl.attributes->>'reprint_reason' as reprint_reason,
    (${LETTER_ISSUE_STATUS_CASE}) as status,
    1 as sort_group
  from generated_letters gl
  left join letter_templates tpl on tpl.tenant_id = gl.tenant_id and tpl.id = gl.letter_template_id
  ${ISSUE_EMPLOYEE_JOIN}
  where gl.tenant_id = $1
    and (${ISSUED_NAME_SQL} || ' ' || coalesce(gl.attributes->>'letter_reference', '') || ' '
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
             ${ISSUED_NAME_SQL} as letter,
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
             coalesce(nullif(gl.attributes->>'rendered_subject', ''), tpl.attributes->>'subject', '') as subject,
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
  return { record, issues, auditTrail, snapshot: kind === "issue" ? issueSnapshot(record) : null };
}

/**
 * The letter exactly as it was sent.
 *
 * Read from the issue row alone - not from the template, not from the employee join.
 * That is the whole point of stamping it: editing the template afterwards, renaming
 * it, or changing the employee's designation cannot alter a letter already out.
 * `null` fields mean the issue predates the snapshot, which is stated rather than
 * papered over by re-rendering the current template.
 */
export type LetterSnapshot = {
  available: boolean;
  subject: string | null;
  body: string | null;
  templateName: string | null;
  templateVersion: string | null;
  issuedOn: string | null;
  mergeValues: Record<string, string>;
  /** Which text this reproduction came from. */
  source: string | null;
  note: string;
};

function issueSnapshot(record: LetterRegisterRow & { attributes?: unknown }): LetterSnapshot {
  const attributes = (record.attributes ?? {}) as Record<string, unknown>;
  const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
  const body = text(attributes.rendered_body);
  const values = attributes.merge_values;
  return {
    available: body !== null,
    subject: text(attributes.rendered_subject),
    body,
    templateName: text(attributes.template_name),
    templateVersion: text(attributes.template_version),
    issuedOn: text(attributes.issued_on),
    mergeValues:
      typeof values === "object" && values !== null
        ? Object.fromEntries(Object.entries(values as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>
        : {},
    source: text(attributes.snapshot_source),
    note:
      body !== null
        ? "Reproduced from the text stamped on this issue, not from the template as it stands now."
        : "This letter was issued before the rendered text was stamped on the issue record, so it cannot be reproduced exactly as sent.",
  };
}

/* ------------------------------------------------------------------ */
/* Template library - the write path                                   */
/* ------------------------------------------------------------------ */

/**
 * Save a letter template (F-DOC-01).
 *
 * `letter_templates` had no writer anywhere in this repository, which is why the
 * workbook's central rule about templates could never be enforced: a template
 * naming a merge field that does not exist has to fail HERE, on save, and not
 * months later when somebody issues that letter to a real person. The refusal is
 * `validateTemplateMergeFields`, run over the subject and the body together.
 *
 * `body` uses `{{field}}` placeholders drawn from `MERGE_FIELDS`, which is the
 * client's own vocabulary read off their templates - see the merge-field catalogue.
 */
export const saveLetterTemplateSchema = z.object({
  templateCode: z.string().trim().min(1).max(40),
  templateName: z.string().trim().min(1).max(120),
  letterType: z.enum(picklistValues("PL_LETTER_TYPE")),
  /** Free text: the client versions templates as "v2.1 effective 2026-04-01". */
  version: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20_000),
  /** Whether an issue from this template waits for approval before it counts as issued. */
  approvalRequired: z.boolean().default(true),
  legalEntityId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500),
});

export type SaveLetterTemplateInput = z.infer<typeof saveLetterTemplateSchema>;

/** The document type every letter template hangs off; `document_type_id` is not nullable. */
async function ensureLetterDocumentType(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'LETTER' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = randomUUID();
  await tenantTx(access, [
    sqlClient`insert into document_types (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, '{"code":"LETTER","name":"HR letter"}'::jsonb)`,
  ]);
  return id;
}

/** Subject and body are checked together: a bad field in either refuses the save. */
function templateText(input: { subject: string; body: string }): string {
  return [input.subject, input.body].join("\n");
}

/** The save-time refusal the workbook demands, as an HTTP error. */
function assertTemplateMergeFields(input: { subject: string; body: string }): void {
  const issues = validateTemplateMergeFields(templateText(input));
  if (issues.length === 0) return;
  throw new HttpError({
    status: 422,
    code: "POLICY_VIOLATION",
    message: `This template references ${issues.length === 1 ? "a merge field" : "merge fields"} the employee record cannot supply, so it cannot be saved.`,
    details: issues,
  });
}

/**
 * Create a template, or replace the one carrying `templateCode`. Saving a new
 * version over an existing code does NOT rewrite the letters already issued from
 * it: each issue keeps its own stamped text and version.
 */
export async function saveLetterTemplate(
  access: Access,
  input: SaveLetterTemplateInput,
  requestId: string,
): Promise<{ id: string; templateCode: string; created: boolean; mergeFields: string[] }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  assertTemplateMergeFields(input);
  const documentTypeId = await ensureLetterDocumentType(access);
  const [existingRows] = await tenantTx(access, [
    sqlClient`select id from letter_templates where tenant_id = ${access.tenantId}
      and attributes->>'template_code' = ${input.templateCode} limit 1`,
  ]);
  const existing = (existingRows as Array<{ id: string }>)[0] ?? null;
  const id = existing?.id ?? randomUUID();
  const attributes = {
    template_code: input.templateCode,
    template_name: input.templateName,
    letter_type: input.letterType,
    version: input.version,
    subject: input.subject,
    body: input.body,
    approval_required: input.approvalRequired,
  };
  await tenantTx(access, [
    existing
      ? sqlClient`update letter_templates
          set attributes = attributes || ${JSON.stringify(attributes)}::jsonb,
              legal_entity_id = ${input.legalEntityId ?? null},
              version = version + 1, updated_at = now()
          where tenant_id = ${access.tenantId} and id = ${id}`
      : sqlClient`insert into letter_templates (id, tenant_id, document_type_id, legal_entity_id, attributes)
          values (${id}, ${access.tenantId}, ${documentTypeId}, ${input.legalEntityId ?? null}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${existing ? "letter.template_update" : "letter.template_create"}, 'letter_template', ${id}, ${input.reason},
        ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return {
    id,
    templateCode: input.templateCode,
    created: existing === null,
    mergeFields: referencedMergeFields(templateText(input)),
  };
}

/** The catalogue the template editor needs to say which fields it may use. */
export function letterMergeFieldCatalogue() {
  return {
    fields: MERGE_FIELDS,
    fromEmployeeRecord: RECORD_MERGE_FIELD_KEYS,
    suppliedAtIssue: MERGE_FIELD_KEYS.filter((key) => !RECORD_MERGE_FIELD_KEYS.includes(key)),
  };
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
): Promise<{ id: string; reference: string; documentId: string }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [templateRows, employeeRows] = await tenantTx(access, [
    sqlClient`select id, attributes from letter_templates where tenant_id = ${access.tenantId} and id = ${input.templateId} limit 1`,
    sqlClient`
      select e.id, e.first_name, e.last_name, e.designation, e.location,
             e.joining_date::text as joining_date,
             e.metadata->>'confirmation_date' as confirmation_date,
             case when mgr.id is null then null
               else trim(coalesce(mgr.first_name, '') || ' ' || coalesce(mgr.last_name, '')) end as manager_name
      from employees e
      left join employees mgr on mgr.tenant_id = e.tenant_id and mgr.id = e.manager_employee_id
      where e.tenant_id = ${access.tenantId} and e.id = ${input.employeeId} limit 1
    `,
  ]);
  const template = (templateRows as Array<{ id: string; attributes: Record<string, unknown> | null }>)[0];
  const employeeRow = (employeeRows as Array<{
    first_name: string | null; last_name: string | null; designation: string | null; location: string | null;
    joining_date: string | null; confirmation_date: string | null; manager_name: string | null;
  }>)[0];
  if (!template || !employeeRow) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const templateAttributes = template.attributes ?? {};
  let templateVersion = typeof templateAttributes.version === "string" ? templateAttributes.version : null;
  let templateName = letterTemplateName(templateAttributes);
  let subjectText = typeof templateAttributes.subject === "string" ? templateAttributes.subject : "";
  let bodyText = typeof templateAttributes.body === "string" ? templateAttributes.body : "";

  // A reprint reproduces the ORIGINAL, not the template as it stands now: it carries
  // the original's version, and where the original was stamped with its rendered text
  // that text is reprinted verbatim. A letter issued before the stamp existed has no
  // original text to copy, so the reprint renders the template afresh and records that.
  let reprintedFromOriginal = false;
  let reprintedValues: Record<string, string> = {};
  if (input.reprintOfLetterId) {
    const [originalRows] = await tenantTx(access, [
      sqlClient`select id, attributes from generated_letters
        where tenant_id = ${access.tenantId} and id = ${input.reprintOfLetterId} limit 1`,
    ]);
    const original = (originalRows as Array<{ id: string; attributes: Record<string, unknown> | null }>)[0];
    if (!original) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The letter being reprinted was not found." });
    const previous = original.attributes ?? {};
    if (typeof previous.template_version === "string") templateVersion = previous.template_version;
    if (typeof previous.template_name === "string" && previous.template_name.trim() !== "") templateName = previous.template_name;
    if (typeof previous.rendered_body === "string" && previous.rendered_body.trim() !== "") {
      reprintedFromOriginal = true;
      bodyText = previous.rendered_body;
      if (typeof previous.rendered_subject === "string") subjectText = previous.rendered_subject;
      const values = previous.merge_values;
      if (typeof values === "object" && values !== null) {
        reprintedValues = Object.fromEntries(
          Object.entries(values as Record<string, unknown>).filter(([, value]) => typeof value === "string"),
        ) as Record<string, string>;
      }
    }
  }

  if (bodyText.trim() === "") {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "This template carries no body, so there is nothing to issue or to reproduce later.",
      details: [{ field: "templateId", issue: "The template has no `body`. Save one through POST /api/v1/letters/templates." }],
    });
  }

  const merge: MergeEmployee = {
    firstName: employeeRow.first_name,
    lastName: employeeRow.last_name,
    designation: employeeRow.designation,
    joiningDate: employeeRow.joining_date,
    location: employeeRow.location,
    managerName: employeeRow.manager_name !== null && employeeRow.manager_name.trim() !== "" ? employeeRow.manager_name.trim() : null,
    confirmationDate: employeeRow.confirmation_date,
  };
  const manual = input.manualFields ?? {};
  // Already-rendered text carries no placeholders, so rendering it again is a no-op
  // that returns it unchanged - which is exactly what reprinting the original means.
  const renderedSubject = renderTemplate(subjectText, merge, manual);
  const renderedBody = renderTemplate(bodyText, merge, manual);
  const unresolved = [...renderedSubject.unresolved, ...renderedBody.unresolved];
  if (unresolved.length > 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "This letter cannot be issued with holes in it: one or more merge fields have no value.",
      details: unresolved,
    });
  }

  const id = randomUUID();
  const reference = letterReferenceFor(id, input.effectiveDate);
  // An issued letter is a document in its own right: `generated_letters.document_id` is not
  // nullable, and the vault is where the employee's copy lives. The rendered text is stored
  // as version 1 of that document, so the snapshot the issue record carries and the file the
  // vault serves are the same bytes.
  const documentTypeId = await ensureLetterDocumentType(access);
  const documentId = randomUUID();
  const documentBytes = Buffer.from(`${renderedSubject.text}\n\n${renderedBody.text}`, "utf8");
  const documentSha256 = createHash("sha256").update(documentBytes).digest("hex");
  const attributes = {
    letter_type: input.letterType,
    template_version: templateVersion,
    // The letter AS SENT. Everything from here to `issued_on` is stamped once and never
    // re-derived: it is what makes an issue reproducible after the template moves on.
    template_name: templateName,
    rendered_subject: renderedSubject.text,
    rendered_body: renderedBody.text,
    merge_values: { ...reprintedValues, ...renderedSubject.values, ...renderedBody.values },
    snapshot_source: reprintedFromOriginal ? "reprint_of_original" : "template_at_issue",
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
    sqlClient`insert into documents (id, tenant_id, document_type_id, employee_id, attributes)
      values (${documentId}, ${access.tenantId}, ${documentTypeId}, ${input.employeeId},
        ${JSON.stringify({ title: renderedSubject.text, code: reference, classification: "hr_letter", issued_on: input.effectiveDate, current_version: 1, letter_id: id })}::jsonb)`,
    sqlClient`insert into document_versions (tenant_id, document_id, attributes)
      values (${access.tenantId}, ${documentId},
        ${JSON.stringify({ version: 1, title: renderedSubject.text, mime: "text/plain", size_bytes: documentBytes.length, sha256: documentSha256, scan: "clean", content_base64: documentBytes.toString("base64"), expires_at: null })}::jsonb)`,
    sqlClient`insert into generated_letters (id, tenant_id, letter_template_id, employee_id, document_id, attributes)
      values (${id}, ${access.tenantId}, ${input.templateId}, ${input.employeeId}, ${documentId}, ${JSON.stringify(attributes)}::jsonb)`,
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
  return { id, reference, documentId };
}
