import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

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
  const modelName = process.env.OPENAI_MODEL?.trim() || "deterministic-fallback";
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

export const createRequisitionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentName: z.string().trim().min(1).max(80).default("Weaving"),
  positionCode: z.string().trim().min(1).max(40).default("SPN-OP-03"),
  hiringManagerEmployeeId: z.string().uuid(),
  manpowerRef: z.string().trim().max(40).optional(),
});

export async function createRequisition(access: Access, input: z.infer<typeof createRequisitionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
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
        ${JSON.stringify({ code, title: input.title, manpower_ref: input.manpowerRef ?? null, status: "draft" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.requisition_create', 'requisition', ${id}, 'Requisition drafted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, code, status: "draft" };
}

export async function approveRequisition(access: Access, id: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from requisitions where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const requisition = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!requisition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (requisition.attributes.status !== "draft") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only draft requisitions can be approved." });
  }
  await tenantTx(access, [
    sqlClient`update requisitions set attributes = attributes || '{"status":"approved"}'::jsonb, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.requisition_approve', 'requisition', ${id}, 'Requisition approved', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "approved" };
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

export const createCandidateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(),
  source: z.string().trim().max(60).default("referral"),
});

export async function createCandidate(access: Access, input: z.infer<typeof createCandidateSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into candidates (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ name: input.name, email: input.email ?? null, phone: input.phone ?? null, source: input.source, consent: true })}::jsonb)
    `,
  ]);
  return { id };
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
  await tenantTx(access, [
    sqlClient`
      insert into applications (id, tenant_id, candidate_id, requisition_id, attributes)
      values (${id}, ${access.tenantId}, ${input.candidateId}, ${input.requisitionId},
        ${JSON.stringify({ stage: "applied", extraction_id: input.extractionId, consent: true })}::jsonb)
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
          model_version: process.env.OPENAI_MODEL?.trim() || "deterministic-fallback",
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

export const disposeApplicationSchema = z.object({
  resultId: z.string().uuid(),
  decision: z.enum(["advance", "hold", "needs_review", "reject"]),
  reason: z.string().trim().min(1).max(500),
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
        ${JSON.stringify({ application_id: applicationId, decision: input.decision, reason: input.reason, actor_kind: "human" })}::jsonb)
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

export const createOfferSchema = z.object({
  applicationId: z.string().uuid(),
  positionCode: z.string().trim().min(1).max(40).default("SPN-OP-03"),
  basicMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createOffer(access: Access, input: z.infer<typeof createOfferSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const positionId = await ensurePosition(access, input.positionCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into offers (id, tenant_id, application_id, position_id, attributes)
      values (${id}, ${access.tenantId}, ${input.applicationId}, ${positionId},
        ${JSON.stringify({ status: "drafted", basic_minor: input.basicMinor, currency: input.currency, joining_date: input.joiningDate })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'talent.offer_draft', 'offer', ${id}, 'Offer drafted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "drafted" };
}

export async function transitionOffer(access: Access, offerId: string, action: "send" | "accept" | "decline", requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [offerRows] = await tenantTx(access, [
    sqlClient`select id, application_id, position_id, attributes from offers where tenant_id = ${access.tenantId} and id = ${offerId} limit 1`,
  ]);
  const offer = (offerRows as Array<{ id: string; application_id: string; position_id: string; attributes: { status: string; basic_minor: number; currency: string; joining_date: string } }>)[0];
  if (!offer) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const expected: Record<string, string> = { send: "drafted", accept: "offered", decline: "offered" };
  const next: Record<string, string> = { send: "offered", accept: "accepted", decline: "declined" };
  if (offer.attributes.status !== expected[action]) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Offer is ${offer.attributes.status}; cannot ${action}.` });
  }
  await tenantTx(access, [
    sqlClient`update offers set attributes = attributes || ${JSON.stringify({ status: next[action] })}::jsonb, updated_at = now() where id = ${offerId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`talent.offer_${action}`}, 'offer', ${offerId}, ${`Offer ${action}ed`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  if (action !== "accept") return { id: offerId, status: next[action] };
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
  if (existingLink) return { id: offerId, status: "accepted", employeeId: existingLink.employee_id, linked: true };
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
        ${candidate?.attributes.email ?? null}, 'Operator', 'Weaving', 'Plant North', ${offer.attributes.joining_date}, ${offer.attributes.basic_minor}, ${offer.attributes.currency})
    `,
    sqlClient`
      insert into candidate_employee_links (tenant_id, application_id, candidate_id, employee_id, offer_id, person_id, attributes)
      values (${access.tenantId}, ${offer.application_id}, ${candidateId}, ${employeeId}, ${offerId}, ${personId}, '{"converted":true}'::jsonb)
    `,
  ]);
  return { id: offerId, status: "accepted", employeeId, linked: false };
}
