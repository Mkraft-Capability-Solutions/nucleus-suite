import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { decideRequisition, establishmentControlFor, REQUISITION_TYPES } from "./establishment";

// ---------------------------------------------------------------------------
// Reference-data ensures (idempotent, tenant-scoped, audited once)
// ---------------------------------------------------------------------------

export async function ensureBusinessUnit(access: Access, code = "HO"): Promise<string> {
  const [entityRows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const entityId = (entityRows as Array<{ id: string }>)[0]?.id;
  if (!entityId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No legal entity exists for this tenant yet." });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from business_units where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into business_units (id, tenant_id, legal_entity_id, attributes) values (${id}, ${access.tenantId}, ${entityId}, ${JSON.stringify({ code, name: code === "HO" ? "Head Office" : code })}::jsonb)`,
  ]);
  return id;
}

export async function ensureDepartment(access: Access, name = "Weaving"): Promise<string> {
  const unitId = await ensureBusinessUnit(access);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from departments where tenant_id = ${access.tenantId} and attributes->>'name' = ${name} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into departments (id, tenant_id, business_unit_id, attributes) values (${id}, ${access.tenantId}, ${unitId}, ${JSON.stringify({ name })}::jsonb)`,
  ]);
  return id;
}

export async function ensureGrade(access: Access, code = "E3"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from grades where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into grades (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code })}::jsonb)`,
  ]);
  return id;
}

export async function ensureJobProfile(access: Access, code = "SPN-OP", title = "Spinning Operator"): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from job_profiles where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into job_profiles (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, title })}::jsonb)`,
  ]);
  return id;
}

export async function ensurePosition(access: Access, code = "SPN-OP-03"): Promise<string> {
  const departmentId = await ensureDepartment(access);
  const gradeId = await ensureGrade(access);
  const profileId = await ensureJobProfile(access);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from positions where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into positions (id, tenant_id, department_id, grade_id, job_profile_id, attributes) values (${id}, ${access.tenantId}, ${departmentId}, ${gradeId}, ${profileId}, ${JSON.stringify({ code, status: "open" })}::jsonb)`,
  ]);
  return id;
}

export async function ensureOntology(access: Access): Promise<{ ontologyId: string; versionId: string }> {
  const [ontoRows] = await tenantTx(access, [
    sqlClient`select id from skill_ontologies where tenant_id = ${access.tenantId} and attributes->>'code' = 'STD-SKILLS' limit 1`,
  ]);
  let ontologyId = (ontoRows as Array<{ id: string }>)[0]?.id;
  if (!ontologyId) {
    ontologyId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into skill_ontologies (id, tenant_id, attributes) values (${ontologyId}, ${access.tenantId}, '{"code":"STD-SKILLS","name":"Standard skill ontology"}'::jsonb)`,
    ]);
  }
  const [versionRows] = await tenantTx(access, [
    sqlClient`select id from skill_ontology_versions where tenant_id = ${access.tenantId} and skill_ontology_id = ${ontologyId} and attributes->>'version' = 'v1' limit 1`,
  ]);
  let versionId = (versionRows as Array<{ id: string }>)[0]?.id;
  if (!versionId) {
    versionId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into skill_ontology_versions (id, tenant_id, skill_ontology_id, attributes) values (${versionId}, ${access.tenantId}, ${ontologyId}, '{"version":"v1","status":"published"}'::jsonb)`,
    ]);
  }
  return { ontologyId, versionId };
}

export async function ensureRubric(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from candidate_match_rubric_versions where tenant_id = ${access.tenantId} and attributes->>'code' = 'RUBRIC-v2' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into candidate_match_rubric_versions (id, tenant_id, attributes) values (${id}, ${access.tenantId}, '{"code":"RUBRIC-v2","judgments":["strong","partial","not_evidenced","conflicting"]}'::jsonb)`,
  ]);
  return id;
}

export async function ensureModel(access: Access): Promise<{ modelId: string; promptId: string }> {
  const modelName = process.env.OPENAI_MODEL ?? "deterministic-fallback";
  const [modelRows] = await tenantTx(access, [
    sqlClient`select id from model_configs where tenant_id = ${access.tenantId} and attributes->>'model' = ${modelName} limit 1`,
  ]);
  let modelId = (modelRows as Array<{ id: string }>)[0]?.id;
  if (!modelId) {
    modelId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into model_configs (id, tenant_id, attributes) values (${modelId}, ${access.tenantId}, ${JSON.stringify({ model: modelName })}::jsonb)`,
    ]);
  }
  const [promptRows] = await tenantTx(access, [
    sqlClient`select id from prompt_versions where tenant_id = ${access.tenantId} and model_config_id = ${modelId} and attributes->>'code' = 'JD-MATCH-v5' limit 1`,
  ]);
  let promptId = (promptRows as Array<{ id: string }>)[0]?.id;
  if (!promptId) {
    promptId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into prompt_versions (id, tenant_id, model_config_id, attributes) values (${promptId}, ${access.tenantId}, ${modelId}, '{"code":"JD-MATCH-v5"}'::jsonb)`,
    ]);
  }
  return { modelId, promptId };
}

async function assertEmployee(access: Access, employeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

// ---------------------------------------------------------------------------
// Requisitions
// ---------------------------------------------------------------------------

/**
 * TAL-01. `departmentName` is the workbook's `org_unit` and `positions` its `vacancy_count`;
 * both keep the names the rest of the module already uses for them.
 *
 * Four of the workbook's fields are not inputs here. The sanction panel is computed by
 * `establishmentControlFor`; the approval chain and status are the record envelope's own
 * approval transitions; the override pair and the recruiter belong to approval, so they live
 * on `approveRequisitionSchema`; and the job description is the linked, versioned
 * `job_descriptions` record - `createJdSchema` takes this requisition's id - rather than a
 * second copy of the same text held on the requisition.
 */
export const createRequisitionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentName: z.string().trim().min(1).max(80).default("Weaving"),
  positionCode: z.string().trim().min(1).max(40).default("SPN-OP-03"),
  locationCode: z.string().trim().min(1).max(60),
  workerClass: z.enum(picklistValues("PL_WORKER_CLASS")),
  hiringManagerEmployeeId: z.string().uuid(),
  manpowerRef: z.string().trim().max(40).optional(),
  /**
   * TAL-01 establishment control. The type defaults so existing callers keep working:
   * an unclassified requisition is an addition, which is the classification that
   * gets checked against the ceiling rather than the one that bypasses it.
   */
  requisitionType: z.enum(REQUISITION_TYPES).default("addition"),
  designation: z.string().trim().min(1).max(120),
  positions: z.number().int().min(1).max(99).default(1),
  againstPositionCode: z.string().trim().max(40).optional(),
  replacingEmployeeId: z.string().uuid().optional(),
  requiredBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employmentType: z.enum(picklistValues("PL_EMPLOYMENT_TYPE")).default("permanent"),
  ctcMinMinor: z.number().int().nonnegative(),
  ctcMaxMinor: z.number().int().nonnegative(),
  justification: z.string().trim().min(30).max(500).optional(),
  qualificationRequired: z.string().trim().min(1).max(200),
  experienceMinYears: z.number().min(0).max(50),
  experienceMaxYears: z.number().min(0).max(50),
  skills: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
}).superRefine((value, context) => {
  if (value.ctcMaxMinor < value.ctcMinMinor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ctcMaxMinor"], message: "The budgeted CTC range ends below where it starts." });
  }
  if (value.experienceMaxYears < value.experienceMinYears) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["experienceMaxYears"], message: "The experience range ends below where it starts." });
  }
  // A replacement backfills a named seat and explains itself that way; an addition has to argue for new headcount.
  if (value.requisitionType === "addition" && !value.justification) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["justification"], message: "An addition must justify the new headcount it asks for." });
  }
  if (value.requisitionType === "replacement" && !value.againstPositionCode?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["againstPositionCode"], message: "A replacement must name the vacated position code it backfills." });
  }
});

/**
 * TAL-01 `required_by`: "not in the past". Kept out of the schema so the generated form
 * contract stays date-agnostic and the rule is applied against the clock at the moment the
 * requisition is actually raised.
 */
export function requiredByIsReachable(requiredBy: string, today: Date = new Date()): boolean {
  return requiredBy >= today.toISOString().slice(0, 10);
}

export async function createRequisition(access: Access, input: z.infer<typeof createRequisitionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (!requiredByIsReachable(input.requiredBy)) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: "The required-by date has already passed; it is what the recruiter SLA is measured against.",
      details: [{ field: "requiredBy", issue: "Must not be in the past." }],
    });
  }
  await assertEmployee(access, input.hiringManagerEmployeeId);
  const departmentId = await ensureDepartment(access, input.departmentName);
  const positionId = await ensurePosition(access, input.positionCode);
  const [countRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from requisitions where tenant_id = ${access.tenantId}`,
  ]);
  const serial = ((countRows as Array<{ total: number }>)[0]?.total ?? 0) + 1;
  const code = `REQ-${new Date().getUTCFullYear()}-${String(serial).padStart(3, "0")}`;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into requisitions (id, tenant_id, department_id, hiring_manager_employee_id, position_id, attributes)
      values (${id}, ${access.tenantId}, ${departmentId}, ${input.hiringManagerEmployeeId}, ${positionId},
        ${JSON.stringify({
          code,
          title: input.title,
          manpower_ref: input.manpowerRef ?? null,
          status: "draft",
          requisition_type: input.requisitionType,
          designation: input.designation,
          location_code: input.locationCode,
          worker_class: input.workerClass,
          positions: input.positions,
          against_position_code: input.againstPositionCode ?? null,
          replacing_employee_id: input.replacingEmployeeId ?? null,
          required_by: input.requiredBy,
          employment_type: input.employmentType,
          ctc_min_minor: input.ctcMinMinor,
          ctc_max_minor: input.ctcMaxMinor,
          justification: input.justification ?? null,
          qualification_required: input.qualificationRequired,
          experience_min_years: input.experienceMinYears,
          experience_max_years: input.experienceMaxYears,
          skills: input.skills,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.requisition_create', 'requisition', ${id}, 'Requisition drafted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, code, status: "draft", requisitionType: input.requisitionType };
}

export const approveRequisitionSchema = z.object({
  /** RL-463: an authorised role may exceed the ceiling with a recorded reason. */
  override: z.boolean().default(false),
  overrideReason: z.string().trim().max(1000).optional(),
  /** TAL-01: the recruiter who owns the opening from approval onwards, and whose SLA `required_by` drives. */
  recruiterEmployeeId: z.string().uuid(),
});

/**
 * TAL-01.2/.3/.4. The establishment ceiling is checked HERE, at approval, because
 * that is where RL-462 places it: a draft may be raised freely, but it cannot be
 * approved into existence above approved manpower.
 */
export async function approveRequisition(
  access: Access,
  id: string,
  input: z.infer<typeof approveRequisitionSchema>,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.department_id, r.attributes,
             own.attributes->>'code' as position_code, own.record_status as position_status,
             backfill.record_status as backfill_status, (backfill.id is not null) as backfill_found
      from requisitions r
      left join positions own on own.tenant_id = r.tenant_id and own.id = r.position_id
      left join positions backfill on backfill.tenant_id = r.tenant_id
        and backfill.attributes->>'code' = r.attributes->>'against_position_code'
      where r.tenant_id = ${access.tenantId} and r.id = ${id} limit 1
    `,
  ]);
  const requisition = (rows as Array<{
    id: string; department_id: string; position_status: string | null;
    backfill_status: string | null; backfill_found: boolean;
    attributes: { status: string; requisition_type?: string; designation?: string | null; positions?: number; against_position_code?: string | null };
  }>)[0];
  if (!requisition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (requisition.attributes.status !== "draft") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only draft requisitions can be approved." });
  }

  const requisitionType = requisition.attributes.requisition_type === "replacement" ? "replacement" : "addition";
  const designation = requisition.attributes.designation ?? null;
  const positions = Number(requisition.attributes.positions ?? 1);
  const againstPositionCode = requisition.attributes.against_position_code ?? null;

  // A replacement is checked against the vacated seat; an addition against the ceiling.
  let line = null;
  let controlActive = false;
  let controlNote: string | null = null;
  if (requisitionType === "addition") {
    const control = await establishmentControlFor(access, {
      departmentId: requisition.department_id,
      designation: designation ?? "",
      // This draft is already inside the board's `open` count. `decideRequisition` subtracts
      // its positions below, so leaving it in would charge the ceiling for it twice and
      // refuse a requisition that exactly fits.
      excludeRequisitionId: id,
    });
    if (!control.active) {
      // Establishment control is not configured for this tenant. Record that the
      // approval was unchecked rather than implying it passed a check.
      controlNote = control.reason;
    } else {
      controlActive = true;
      if (!designation) {
        throw new HttpError({
          status: 422, code: "SANCTION_KEY_INCOMPLETE",
          message: "An addition must carry a designation: sanctioned strength is held by org unit, designation and location, so headroom cannot be resolved without it.",
          details: [{ field: "designation", issue: "Required to resolve the sanction key." }],
        });
      }
      line = control.line;
      if (!line) {
        throw new HttpError({
          status: 422, code: "SANCTION_MISSING",
          message: "No approved manpower line exists for this department and designation. An unsanctioned key is not an unlimited one: approve sanctioned strength for it first.",
          details: [{ field: "designation", issue: `No approved sanctioned strength for "${designation}" in this department.` }],
        });
      }
    }
  }

  const decision = controlActive || requisitionType === "replacement"
    ? decideRequisition({
    requisitionType,
    positions,
    counts: line ? { sanctioned: line.sanctioned, filled: line.filled, open: line.open } : { sanctioned: 0, filled: 0, open: 0 },
    againstPositionCode,
    againstPositionVacant:
      requisitionType !== "replacement"
        ? true
        : requisition.backfill_found && requisition.backfill_status !== "filled" && requisition.backfill_status !== "frozen",
    override: input.override,
    overrideReason: input.overrideReason ?? null,
    overriderAuthorised: access.context.permissions.includes("workforce.manpower.approve"),
    overriderDistinctFromApprover: line?.approvedByMembershipId !== access.context.membershipId,
      })
    : { allowed: true as const, consumesSanction: false, headroomAfter: 0, overridden: false, warnings: [] };

  if (!decision.allowed) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: decision.message, details: [{ field: "requisition", issue: decision.code }] });
  }

  await assertEmployee(access, input.recruiterEmployeeId);
  const approvedAttributes = {
    status: "approved",
    approved_at: new Date().toISOString(),
    recruiter_employee_id: input.recruiterEmployeeId,
    consumes_sanction: decision.consumesSanction,
    headroom_after: decision.headroomAfter,
    override: decision.overridden,
    override_reason: decision.overridden ? (input.overrideReason ?? null) : null,
    establishment_checked: controlActive,
    establishment_note: controlNote,
  };
  await tenantTx(access, [
    sqlClient`update requisitions set attributes = attributes || ${JSON.stringify(approvedAttributes)}::jsonb, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${decision.overridden ? "talent.requisition_override" : "talent.requisition_approve"}, 'requisition', ${id},
        ${decision.overridden ? (input.overrideReason ?? "Establishment override") : "Requisition approved within headroom"},
        ${JSON.stringify(approvedAttributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "approved", establishmentChecked: controlActive, establishmentNote: controlNote, ...decision };
}

// ---------------------------------------------------------------------------
// Job descriptions (versioned; only approved JDs are scorable)
// ---------------------------------------------------------------------------

export const createJdSchema = z.object({
  requisitionId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  requirements: z.array(z.object({
    ref: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(500),
    mustHave: z.boolean(),
  })).min(1).max(30),
});

export async function createJobDescription(access: Access, input: z.infer<typeof createJdSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const profileId = await ensureJobProfile(access);
  const { versionId } = await ensureOntology(access);
  const [versionRows] = await tenantTx(access, [
    sqlClient`select coalesce(max((attributes->>'version_no')::int), 0)::int as latest from job_descriptions where tenant_id = ${access.tenantId} and attributes->>'title' = ${input.title}`,
  ]);
  const versionNo = ((versionRows as Array<{ latest: number }>)[0]?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into job_descriptions (id, tenant_id, job_profile_id, requisition_id, skill_ontology_version_id, attributes)
      values (${id}, ${access.tenantId}, ${profileId}, ${input.requisitionId ?? null}, ${versionId},
        ${JSON.stringify({ title: input.title, version: `jd/v${versionNo}`, version_no: versionNo, requirements: input.requirements, status: "draft" })}::jsonb)
    `,
  ]);
  for (const requirement of input.requirements) {
    const skillId = await ensureSkill(access, requirement.text);
    await tenantTx(access, [
      sqlClient`
        insert into job_skill_requirements (tenant_id, job_description_id, skill_id, skill_ontology_version_id, attributes)
        values (${access.tenantId}, ${id}, ${skillId}, ${versionId},
          ${JSON.stringify({ ref: requirement.ref, must_have: requirement.mustHave })}::jsonb)
      `,
    ]);
  }
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.jd_create', 'job_description', ${id}, 'JD drafted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, version: `jd/v${versionNo}`, status: "draft" };
}

async function ensureSkill(access: Access, name: string): Promise<string> {
  const key = name.trim().slice(0, 120);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from skills where tenant_id = ${access.tenantId} and attributes->>'name' = ${key} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into skills (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ name: key })}::jsonb)`,
  ]);
  return id;
}

export async function approveJobDescription(access: Access, id: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from job_descriptions where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const jd = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!jd) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (jd.attributes.status !== "draft") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only draft JDs can be approved." });
  }
  await tenantTx(access, [
    sqlClient`update job_descriptions set attributes = attributes || '{"status":"approved"}'::jsonb, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.jd_approve', 'job_description', ${id}, 'JD approved and frozen for scoring', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "approved" };
}

// ---------------------------------------------------------------------------
// Candidates, resumes, applications
// ---------------------------------------------------------------------------

/**
 * TAL-02 candidate half. `source` is the workbook's `source_channel` under the name the app
 * already used for it; `phone` is its `mobile`. The resume itself is not a field here - it is
 * posted to `/candidates/:id/resume`, which freezes an extraction the scoring run is pinned to.
 *
 * The duplicate check the workbook asks for on mobile and email is a warning, not a block, so
 * it is reported by `createCandidate` rather than enforced by this schema.
 */
export const createCandidateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.string().email().max(120),
  /** E.164: an optional +, then 8-15 digits with no leading zero. */
  phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(picklistValues("PL_GENDER")).optional(),
  currentLocation: z.string().trim().max(60).optional(),
  source: z.enum(picklistValues("PL_SOURCE_CHANNEL")),
  referrerEmployeeId: z.string().uuid().optional(),
  agencyId: z.string().uuid().optional(),
  totalExperienceYears: z.number().min(0).max(50),
  currentEmployer: z.string().trim().max(150).optional(),
  currentDesignation: z.string().trim().max(150).optional(),
  currentCtcMinor: z.number().int().nonnegative().optional(),
  expectedCtcMinor: z.number().int().nonnegative().optional(),
  noticePeriodDays: z.number().int().min(0).max(180).optional(),
}).superRefine((value, context) => {
  // The channel decides which attribution the record must carry; neither is optional once chosen.
  if (value.source === "employee_referral" && !value.referrerEmployeeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["referrerEmployeeId"], message: "A referred candidate must name the referrer; the referral award matures against it." });
  }
  if (value.source === "recruitment_agency" && !value.agencyId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["agencyId"], message: "An agency-sourced candidate must name the agency." });
  }
});

export async function createCandidate(access: Access, input: z.infer<typeof createCandidateSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  // TAL-02: a duplicate on either contact point is surfaced, never used to refuse the record.
  const [duplicateRows] = await tenantTx(access, [
    sqlClient`
      select id from candidates
      where tenant_id = ${access.tenantId}
        and (attributes->>'email' = ${input.email} or attributes->>'phone' = ${input.phone})
      limit 5
    `,
  ]);
  const duplicates = (duplicateRows as Array<{ id: string }>).map((row) => row.id);
  await tenantTx(access, [
    sqlClient`
      insert into candidates (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        current_location: input.currentLocation ?? null,
        source: input.source,
        referrer_employee_id: input.referrerEmployeeId ?? null,
        agency_id: input.agencyId ?? null,
        total_experience_years: input.totalExperienceYears,
        current_employer: input.currentEmployer ?? null,
        current_designation: input.currentDesignation ?? null,
        current_ctc_minor: input.currentCtcMinor ?? null,
        expected_ctc_minor: input.expectedCtcMinor ?? null,
        notice_period_days: input.noticePeriodDays ?? null,
        consent: true,
      })}::jsonb)
    `,
  ]);
  return { id, duplicateCandidateIds: duplicates };
}

export const submitResumeSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Resume"),
  mimeType: z.string().trim().min(1).max(100).default("application/pdf"),
  contentBase64: z.string().min(1).max(15_000_000),
});

export async function submitResume(access: Access, candidateId: string, input: z.infer<typeof submitResumeSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [candidateRows] = await tenantTx(access, [
    sqlClient`select id from candidates where tenant_id = ${access.tenantId} and id = ${candidateId} limit 1`,
  ]);
  if ((candidateRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "Resumes are bounded to 10 MiB." });
  }
  const text = bytes.toString("utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const [typeRows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'RESUME' limit 1`,
  ]);
  let typeId = (typeRows as Array<{ id: string }>)[0]?.id;
  if (!typeId) {
    typeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into document_types (id, tenant_id, attributes) values (${typeId}, ${access.tenantId}, '{"code":"RESUME","name":"Resume"}'::jsonb)`,
    ]);
  }
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const lines = text.split("\n");
  const locator = lines.map((line, index) => ({ line: index + 1, hash: createHash("sha256").update(line).digest("hex").slice(0, 16) }));
  await tenantTx(access, [
    sqlClient`
      insert into documents (id, tenant_id, document_type_id, candidate_id, attributes)
      values (${documentId}, ${access.tenantId}, ${typeId}, ${candidateId}, ${JSON.stringify({ title: input.title, current_version: 1 })}::jsonb)
    `,
    sqlClient`
      insert into document_versions (id, tenant_id, document_id, attributes)
      values (${versionId}, ${access.tenantId}, ${documentId},
        ${JSON.stringify({ version: 1, title: input.title, mime: input.mimeType, size_bytes: bytes.length, sha256: checksum, scan: "available" })}::jsonb)
    `,
    sqlClient`
      insert into candidate_documents (tenant_id, candidate_id, document_id, attributes)
      values (${access.tenantId}, ${candidateId}, ${documentId}, '{"kind":"resume"}'::jsonb)
    `,
  ]);
  const extractionId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into document_extractions (id, tenant_id, document_version_id, attributes)
      values (${extractionId}, ${access.tenantId}, ${versionId},
        ${JSON.stringify({ sanitized_text: text, checksum, parser: "text-extract/v1", locator_map: locator })}::jsonb)
    `,
  ]);
  return { documentId, extractionId, checksum, lines: lines.length };
}

/**
 * TAL-02 application half. `stage` is not an input: it opens at "applied" and only
 * `advanceApplication` moves it, one human step at a time. `rank_score` is the single
 * assessment score recorded by `scoreApplication`, never a second field here.
 *
 * `retention_until` is carried on the record but left unset: the workbook names the field and
 * says "per the retention policy" without stating a period - see tmp/_audit/requests/talent.md.
 */
export const submitApplicationSchema = z.object({
  requisitionId: z.string().uuid(),
  candidateId: z.string().uuid(),
  extractionId: z.string().uuid(),
  consent: z.literal(true),
});


export async function submitApplication(access: Access, input: z.infer<typeof submitApplicationSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [reqRows] = await tenantTx(access, [
    sqlClient`select id, attributes from requisitions where tenant_id = ${access.tenantId} and id = ${input.requisitionId} limit 1`,
  ]);
  const requisition = (reqRows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!requisition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (requisition.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Applications require an approved requisition." });
  }
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from applications where tenant_id = ${access.tenantId} and requisition_id = ${input.requisitionId} and candidate_id = ${input.candidateId} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This candidate already applied to the requisition; the existing application is linked." });
  }
  const id = crypto.randomUUID();
  const historyId = crypto.randomUUID();
  const consentOn = new Date();
  await tenantTx(access, [
    sqlClient`
      insert into applications (id, tenant_id, candidate_id, requisition_id, attributes)
      values (${id}, ${access.tenantId}, ${input.candidateId}, ${input.requisitionId},
        ${JSON.stringify({
          stage: "applied",
          extraction_id: input.extractionId,
          consent: true,
          consent_on: consentOn.toISOString(),
          // Held for the purge job. No retention period is defined anywhere in the product,
          // and a guessed one would delete candidate records early, so it stays unset.
          retention_until: null,
        })}::jsonb)
    `,
    sqlClient`
      insert into application_stage_history (id, tenant_id, application_id, actor_membership_id, attributes)
      values (${historyId}, ${access.tenantId}, ${id}, ${access.context.membershipId},
        ${JSON.stringify({ from: null, to: "applied" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.apply', 'application', ${id}, 'Application submitted with consent', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, stage: "applied" };
}

// ---------------------------------------------------------------------------
// One-score assessment: exactly one integer 0-100, evidence + lineage
// ---------------------------------------------------------------------------

const FORBIDDEN_SCORE_KEYS = [
  "confidence", "heuristic", "mapping", "ontology_score", "subscore",
  "composite", "weight", "percentile", "cutoff", "ranking", "rank",
];

export const scoreApplicationSchema = z.object({
  jobDescriptionId: z.string().uuid(),
  scoreValue: z.number().int().min(0).max(100),
  extractionChecksum: z.string().min(1),
  findings: z.array(z.object({
    requirementRef: z.string().min(1),
    judgment: z.enum(["strong", "partial", "not_evidenced", "conflicting"]),
    evidence: z.array(z.object({ locator: z.string().min(1), excerptHash: z.string().min(1) })),
    provenance: z.enum(["literal", "alias-context", "tree-context", "LLM-semantic"]),
  })).min(1),
}).superRefine((value, context) => {
  for (const key of FORBIDDEN_SCORE_KEYS) {
    if (value.scoreValue !== undefined && key in (value as Record<string, unknown>)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Forbidden score field: ${key}.` });
    }
  }
  for (const finding of value.findings) {
    if ((finding.judgment === "strong" || finding.judgment === "partial") && finding.evidence.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Finding ${finding.requirementRef} needs resume evidence locators.` });
    }
  }
});

export async function scoreApplication(access: Access, applicationId: string, input: z.infer<typeof scoreApplicationSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const rawBody = input as Record<string, unknown>;
  for (const key of FORBIDDEN_SCORE_KEYS) {
    if (key in rawBody) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Forbidden score field rejected: ${key}. Exactly one integer score is permitted.` });
    }
  }
  const [appRows] = await tenantTx(access, [
    sqlClient`select id, attributes from applications where tenant_id = ${access.tenantId} and id = ${applicationId} limit 1`,
  ]);
  const application = (appRows as Array<{ id: string; attributes: { extraction_id: string } }>)[0];
  if (!application) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [jdRows] = await tenantTx(access, [
    sqlClient`select id, attributes from job_descriptions where tenant_id = ${access.tenantId} and id = ${input.jobDescriptionId} limit 1`,
  ]);
  const jd = (jdRows as Array<{ id: string; attributes: { status: string; version: string } }>)[0];
  if (!jd) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (jd.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Scoring requires the exact approved JD version." });
  }
  const [extractionRows] = await tenantTx(access, [
    sqlClient`select id, attributes from document_extractions where tenant_id = ${access.tenantId} and id = ${application.attributes.extraction_id} limit 1`,
  ]);
  const extraction = (extractionRows as Array<{ id: string; attributes: { checksum: string } }>)[0];
  if (!extraction || extraction.attributes.checksum !== input.extractionChecksum) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Resume extraction changed since evidence was prepared; re-run scoring on the frozen extraction." });
  }
  const rubricId = await ensureRubric(access);
  const { versionId } = await ensureOntology(access);
  const { modelId, promptId } = await ensureModel(access);
  const runId = crypto.randomUUID();
  const resultId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      update candidate_match_results set attributes = attributes || '{"superseded":true}'::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and candidate_match_run_id in
        (select id from candidate_match_runs where tenant_id = ${access.tenantId} and application_id = ${applicationId})
    `,
    sqlClient`
      insert into candidate_match_runs (id, tenant_id, application_id, candidate_match_rubric_version_id, job_description_id, model_config_id, prompt_version_id, resume_document_extraction_id, skill_ontology_version_id, attributes)
      values (${runId}, ${access.tenantId}, ${applicationId}, ${rubricId}, ${input.jobDescriptionId}, ${modelId}, ${promptId}, ${extraction.id}, ${versionId},
        ${JSON.stringify({ jd_version: jd.attributes.version, locked: true })}::jsonb)
    `,
    sqlClient`
      insert into candidate_match_results (id, tenant_id, candidate_match_run_id, attributes)
      values (${resultId}, ${access.tenantId}, ${runId},
        ${JSON.stringify({
          score_value: input.scoreValue,
          jd_version: jd.attributes.version,
          ontology_version: "v1",
          rubric_version: "RUBRIC-v2",
          prompt_version: "JD-MATCH-v5",
          model_version: process.env.OPENAI_MODEL ?? "deterministic-fallback",
          extraction_checksum: input.extractionChecksum,
          superseded: false,
        })}::jsonb)
    `,
    ...input.findings.map((finding) => sqlClient`
      insert into match_evidence (tenant_id, candidate_match_result_id, candidate_match_run_id, attributes)
      values (${access.tenantId}, ${resultId}, ${runId},
        ${JSON.stringify({ requirement_ref: finding.requirementRef, judgment: finding.judgment, evidence: finding.evidence, provenance: finding.provenance })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.score', 'candidate_match_result', ${resultId}, 'One-score assessment recorded',
        ${JSON.stringify({ score: input.scoreValue, jd: jd.attributes.version })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { runId, resultId, scoreValue: input.scoreValue };
}

// ---------------------------------------------------------------------------
// Human disposition + stage transitions (never automatic)
// ---------------------------------------------------------------------------

/**
 * TAL-02 rejection reason. The workbook wants a category from the list plus free text; the
 * existing `reason` is that free text, so only the category is added, and only rejections
 * need one - a hold or an advance is not a rejection and has no category to give.
 */
export const disposeApplicationSchema = z.object({
  resultId: z.string().uuid(),
  decision: z.enum(["advance", "hold", "needs_review", "reject"]),
  rejectionReason: z.enum(picklistValues("PL_REJECTION_REASON")).optional(),
  reason: z.string().trim().min(1).max(500),
}).superRefine((value, context) => {
  if (value.decision === "reject" && !value.rejectionReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "A rejection must name a reason category." });
  }
  if (value.decision !== "reject" && value.rejectionReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "A rejection reason belongs only to a rejection." });
  }
});

export async function disposeApplication(access: Access, applicationId: string, input: z.infer<typeof disposeApplicationSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [resultRows] = await tenantTx(access, [
    sqlClient`select id from candidate_match_results where tenant_id = ${access.tenantId} and id = ${input.resultId} limit 1`,
  ]);
  if ((resultRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into candidate_match_dispositions (id, tenant_id, candidate_match_result_id, reviewer_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${input.resultId}, ${access.context.membershipId},
        ${JSON.stringify({ application_id: applicationId, decision: input.decision, rejection_reason: input.rejectionReason ?? null, reason: input.reason, actor_kind: "human" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.dispose', 'application', ${applicationId}, ${`${input.decision}: ${input.reason}`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, decision: input.decision };
}

const STAGE_FLOW = ["applied", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted"] as const;
const TERMINAL_STAGES = ["withdrawn", "rejected", "declined", "closed"] as const;

export async function advanceApplication(access: Access, applicationId: string, to: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const allowed = new Set<string>([...STAGE_FLOW, ...TERMINAL_STAGES]);
  if (!allowed.has(to)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Unknown application stage." });
  const [appRows] = await tenantTx(access, [
    sqlClient`select id, attributes from applications where tenant_id = ${access.tenantId} and id = ${applicationId} limit 1`,
  ]);
  const application = (appRows as Array<{ id: string; attributes: { stage: string } }>)[0];
  if (!application) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const from = application.attributes.stage;
  if (TERMINAL_STAGES.includes(from as (typeof TERMINAL_STAGES)[number])) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Application is terminal (${from}).` });
  }
  const fromIndex = STAGE_FLOW.indexOf(from as (typeof STAGE_FLOW)[number]);
  const toIndex = STAGE_FLOW.indexOf(to as (typeof STAGE_FLOW)[number]);
  if (toIndex === -1) {
    if (!TERMINAL_STAGES.includes(to as (typeof TERMINAL_STAGES)[number])) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Unknown application stage." });
    }
  } else if (fromIndex === -1 || toIndex !== fromIndex + 1) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Stages advance one step at a time by human decision." });
  }
  await tenantTx(access, [
    sqlClient`update applications set attributes = attributes || ${JSON.stringify({ stage: to })}::jsonb, updated_at = now() where id = ${applicationId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into application_stage_history (tenant_id, application_id, actor_membership_id, attributes)
      values (${access.tenantId}, ${applicationId}, ${access.context.membershipId}, ${JSON.stringify({ from, to })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.stage', 'application', ${applicationId}, ${`Stage ${from} -> ${to}`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: applicationId, from, to };
}

export async function listApplications(access: Access, args: { requisitionId?: string | null; candidateId?: string | null; stage?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const requisitionFilter = args.requisitionId ?? null;
  const candidateFilter = args.candidateId ?? null;
  const stageFilter = args.stage ?? null;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from applications where tenant_id = ${access.tenantId}
        and (${requisitionFilter}::uuid is null or requisition_id = ${args.requisitionId})
        and (${candidateFilter}::uuid is null or candidate_id = ${args.candidateId})
        and (${stageFilter}::text is null or attributes->>'stage' = ${args.stage})
    `,
    sqlClient`
      select id, candidate_id, requisition_id, attributes from applications where tenant_id = ${access.tenantId}
        and (${requisitionFilter}::uuid is null or requisition_id = ${args.requisitionId})
        and (${candidateFilter}::uuid is null or candidate_id = ${args.candidateId})
        and (${stageFilter}::text is null or attributes->>'stage' = ${args.stage})
      order by created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export async function getApplication(access: Access, applicationId: string) {  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [appRows] = await tenantTx(access, [
    sqlClient`select id, candidate_id, requisition_id, attributes from applications where tenant_id = ${access.tenantId} and id = ${applicationId} limit 1`,
  ]);
  const application = (appRows as Array<{ id: string; candidate_id: string; requisition_id: string; attributes: unknown }>)[0];
  if (!application) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [historyRows, resultRows, dispositionRows] = await tenantTx(access, [
    sqlClient`select attributes, created_at from application_stage_history where tenant_id = ${access.tenantId} and application_id = ${applicationId} order by created_at`,
    sqlClient`
      select r.id, r.attributes from candidate_match_results r
      join candidate_match_runs m on m.id = r.candidate_match_run_id
      where r.tenant_id = ${access.tenantId} and m.application_id = ${applicationId}
      order by r.created_at desc limit 1
    `,
    sqlClient`
      select d.attributes from candidate_match_dispositions d
      join candidate_match_results r on r.id = d.candidate_match_result_id
      join candidate_match_runs m on m.id = r.candidate_match_run_id
      where d.tenant_id = ${access.tenantId} and m.application_id = ${applicationId}
      order by d.created_at desc limit 1
    `,
  ]);
  return {
    application,
    stageHistory: historyRows,
    latestResult: (resultRows as Array<{ attributes: unknown }>)[0]?.attributes ?? null,
    latestDisposition: (dispositionRows as Array<{ attributes: unknown }>)[0]?.attributes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Offers + conversion (no duplicate people)
// ---------------------------------------------------------------------------

/**
 * TAL-04. The workbook's read-only candidate / requisition / position triple is carried by
 * `applicationId` — which owns both the candidate and the requisition — plus `positionCode`.
 *
 * `structure_preview` and `approval_status` are derived panels in the workbook: the preview is
 * computed from the CTC at render time and the approval state is the record envelope's own
 * approval transition, so neither is accepted as an input here. `released_on` is stamped by the
 * release transition for the same reason.
 */
export const createOfferSchema = z.object({
  applicationId: z.string().uuid(),
  positionCode: z.string().trim().min(1).max(40).default("SPN-OP-03"),
  designationCode: z.string().trim().min(1).max(120),
  band: z.string().trim().min(1).max(40),
  locationCode: z.string().trim().min(1).max(60),
  workerClass: z.enum(picklistValues("PL_WORKER_CLASS")),
  employmentType: z.enum(picklistValues("PL_EMPLOYMENT_TYPE")),
  /** The headline figure the letter quotes. `basicMinor` is the component the payroll record carries. */
  offeredCtcMinor: z.number().int().positive(),
  basicMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  joiningBonusMinor: z.number().int().nonnegative().default(0),
  clawbackMonths: z.number().int().nonnegative().default(0),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Optional at draft only because the workbook's default is the release date plus 7 days, which release supplies. */
  offerValidTill: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  letterTemplateId: z.string().trim().min(1).max(60),
}).superRefine((value, context) => {
  // Basic is a part of CTC, so a CTC below it describes no structure that can exist.
  if (value.offeredCtcMinor < value.basicMinor) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["offeredCtcMinor"],
      message: "Offered CTC cannot be below the basic component it contains.",
    });
  }
});

export async function createOffer(access: Access, input: z.infer<typeof createOfferSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const positionId = await ensurePosition(access, input.positionCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into offers (id, tenant_id, application_id, position_id, attributes)
      values (${id}, ${access.tenantId}, ${input.applicationId}, ${positionId},
        ${JSON.stringify({
          status: "drafted",
          designation_code: input.designationCode,
          band: input.band,
          location_code: input.locationCode,
          worker_class: input.workerClass,
          employment_type: input.employmentType,
          offered_ctc_minor: input.offeredCtcMinor,
          basic_minor: input.basicMinor,
          currency: input.currency,
          joining_bonus_minor: input.joiningBonusMinor,
          clawback_months: input.clawbackMonths,
          joining_date: input.joiningDate,
          offer_valid_till: input.offerValidTill ?? null,
          letter_template_id: input.letterTemplateId,
          offer_response: null,
          released_on: null,
          release_channel: null,
          decline_reason: null,
          decline_reason_note: null,
          accepted_on: null,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.offer_draft', 'offer', ${id}, 'Offer drafted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "drafted" };
}

/**
 * TAL-04 response leg. `offer_response` is the candidate's own answer and carries two states the
 * offer lifecycle alone cannot express — negotiating (the offer is still live) and lapsed (validity
 * ran out) — so both are transitions here rather than a separate stored dropdown.
 */
export const transitionOfferSchema = z.object({
  action: z.enum(["send", "accept", "decline", "negotiate", "lapse"]),
  releaseChannel: z.enum(picklistValues("PL_RELEASE_CHANNEL")).optional(),
  /** Honoured only on release, where the workbook's "release date plus 7 days" default is applied if absent. */
  offerValidTill: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  declineReason: z.enum(picklistValues("PL_DECLINE_REASON")).optional(),
  declineReasonNote: z.string().trim().max(200).optional(),
}).superRefine((value, context) => {
  if (value.action === "send" && !value.releaseChannel) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["releaseChannel"], message: "A release channel is required when an offer is released." });
  }
  if (value.action === "decline" && !value.declineReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["declineReason"], message: "A decline reason is required; it feeds the offer-drop analysis." });
  }
});

/** The workbook's default offer validity: the release date plus seven days. */
function defaultValidTill(releasedOn: Date): string {
  const till = new Date(releasedOn);
  till.setUTCDate(till.getUTCDate() + 7);
  return till.toISOString().slice(0, 10);
}

export async function transitionOffer(access: Access, offerId: string, input: z.infer<typeof transitionOfferSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const action = input.action;
  const [offerRows] = await tenantTx(access, [
    sqlClient`select id, application_id, position_id, attributes from offers where tenant_id = ${access.tenantId} and id = ${offerId} limit 1`,
  ]);
  const offer = (offerRows as Array<{
    id: string; application_id: string; position_id: string;
    attributes: {
      status: string; basic_minor: number; currency: string; joining_date: string;
      offer_valid_till?: string | null; designation_code?: string | null; location_code?: string | null;
    };
  }>)[0];
  if (!offer) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const expected: Record<string, string> = { send: "drafted", accept: "offered", decline: "offered", negotiate: "offered", lapse: "offered" };
  // Negotiation leaves the offer live; only the candidate's recorded response moves.
  const next: Record<string, string> = { send: "offered", accept: "accepted", decline: "declined", negotiate: "offered", lapse: "lapsed" };
  const response: Record<string, string> = { send: "pending", accept: "accepted", decline: "declined", negotiate: "negotiating", lapse: "lapsed" };
  if (offer.attributes.status !== expected[action]) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Offer is ${offer.attributes.status}; cannot ${action}.` });
  }
  const now = new Date();
  const patch: Record<string, unknown> = { status: next[action], offer_response: response[action] };
  if (action === "send") {
    const releasedOn = now.toISOString().slice(0, 10);
    const validTill = input.offerValidTill ?? offer.attributes.offer_valid_till ?? defaultValidTill(now);
    if (validTill <= releasedOn) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Offer validity must fall after the release date." });
    }
    patch.released_on = releasedOn;
    patch.release_channel = input.releaseChannel;
    patch.offer_valid_till = validTill;
  }
  if (action === "accept") patch.accepted_on = now.toISOString();
  if (action === "decline") {
    patch.decline_reason = input.declineReason;
    patch.decline_reason_note = input.declineReasonNote ?? null;
  }
  await tenantTx(access, [
    sqlClient`update offers set attributes = attributes || ${JSON.stringify(patch)}::jsonb, updated_at = now() where id = ${offerId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`talent.offer_${action}`}, 'offer', ${offerId}, ${`Offer response: ${response[action]}`},
        ${JSON.stringify(patch)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  if (action !== "accept") return { id: offerId, status: next[action], offerResponse: response[action] };
  // Convert: link or create the person exactly once.
  const [appRows] = await tenantTx(access, [
    sqlClient`select candidate_id from applications where tenant_id = ${access.tenantId} and id = ${offer.application_id} limit 1`,
  ]);
  const candidateId = (appRows as Array<{ candidate_id: string }>)[0]?.candidate_id;
  if (!candidateId) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Offer has no candidate application." });
  const [linkRows] = await tenantTx(access, [
    sqlClient`select employee_id from candidate_employee_links where tenant_id = ${access.tenantId} and candidate_id = ${candidateId} limit 1`,
  ]);
  const existingLink = (linkRows as Array<{ employee_id: string }>)[0];
  if (existingLink) return { id: offerId, status: "accepted", offerResponse: "accepted", employeeId: existingLink.employee_id, linked: true };
  const [candidateRows] = await tenantTx(access, [
    sqlClient`select attributes from candidates where tenant_id = ${access.tenantId} and id = ${candidateId} limit 1`,
  ]);
  const candidate = (candidateRows as Array<{ attributes: { name: string; email?: string } }>)[0];
  const name = candidate?.attributes.name ?? "New Joiner";
  const parts = name.trim().split(/\s+/);
  const personId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const codeSerial = Math.floor(Date.now() % 100000);
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`
      insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, designation, department, location, joining_date, basic_salary_minor, currency)
      values (${employeeId}, ${access.tenantId}, ${personId}, ${`HO-${codeSerial}`}, ${parts[0] ?? "New"}, ${parts.slice(1).join(" ") || "Joiner"},
        ${candidate?.attributes.email ?? null}, ${offer.attributes.designation_code ?? "Operator"}, 'Weaving',
        ${offer.attributes.location_code ?? "Plant North"}, ${offer.attributes.joining_date}, ${offer.attributes.basic_minor}, ${offer.attributes.currency})
    `,
    sqlClient`
      insert into candidate_employee_links (tenant_id, application_id, candidate_id, employee_id, offer_id, person_id, attributes)
      values (${access.tenantId}, ${offer.application_id}, ${candidateId}, ${employeeId}, ${offerId}, ${personId}, '{"converted":true}'::jsonb)
    `,
  ]);
  return { id: offerId, status: "accepted", offerResponse: "accepted", employeeId, linked: false };
}
