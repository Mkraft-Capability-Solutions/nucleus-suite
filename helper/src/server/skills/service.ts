import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

const LEVELS = ["L1", "L2", "L3", "L4", "L5"] as const;
const SOURCES = ["course-completion", "manager-assessment", "peer-endorsement", "certification", "interview"] as const;

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

async function ensureEmployeeSkill(access: Access, employeeId: string, skillId: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from employee_skills where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and skill_id = ${skillId} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into employee_skills (id, tenant_id, employee_id, skill_id, attributes)
      values (${id}, ${access.tenantId}, ${employeeId}, ${skillId}, '{"proficiency":"L1","verified":false}'::jsonb)
    `,
  ]);
  return id;
}

export const recordEvidenceSchema = z.object({
  employeeId: z.string().uuid(),
  skillName: z.string().trim().min(1).max(120),
  source: z.enum(SOURCES),
  level: z.enum(LEVELS),
  reference: z.string().trim().min(1).max(200),
});

export async function recordEvidence(access: Access, input: z.infer<typeof recordEvidenceSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const skillId = await ensureSkill(access, input.skillName);
  const employeeSkillId = await ensureEmployeeSkill(access, input.employeeId, skillId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into skill_evidence (id, tenant_id, employee_skill_id, attributes)
      values (${id}, ${access.tenantId}, ${employeeSkillId},
        ${JSON.stringify({ source: input.source, level: input.level, reference: input.reference, status: "pending" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'skill.evidence_record', 'skill_evidence', ${id}, 'Skill evidence recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "pending" };
}

export const verifyEvidenceSchema = z.object({
  evidenceId: z.string().uuid(),
  verdict: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

export async function verifyEvidence(access: Access, input: z.infer<typeof verifyEvidenceSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_skill_id, attributes from skill_evidence where tenant_id = ${access.tenantId} and id = ${input.evidenceId} limit 1`,
  ]);
  const evidence = (rows as Array<{ id: string; employee_skill_id: string; attributes: { status: string; level: (typeof LEVELS)[number] } }>)[0];
  if (!evidence) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (evidence.attributes.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Evidence is already decided." });
  }
  const status = input.verdict === "verified" ? "verified" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update skill_evidence set attributes = attributes || ${JSON.stringify({ status, note: input.note ?? null, verified_by: access.context.actorUserId })}::jsonb
      where id = ${input.evidenceId} and tenant_id = ${access.tenantId}
    `,
    ...(input.verdict === "verified"
      ? [sqlClient`
        update employee_skills set attributes = attributes || ${JSON.stringify({ proficiency: evidence.attributes.level, verified: true })}::jsonb
        where id = ${evidence.employee_skill_id} and tenant_id = ${access.tenantId}
      `]
      : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`skill.evidence_${status}`}, 'skill_evidence', ${input.evidenceId}, 'Skill evidence decided', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: input.evidenceId, status };
}

export async function employeeSkills(access: Access, employeeId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.attributes as proficiency, s.attributes as skill
      from employee_skills e join skills s on s.id = e.skill_id
      where e.tenant_id = ${access.tenantId} and e.employee_id = ${employeeId}
    `,
  ]);
  return rows;
}

/** One-query command-centre projection; avoids one API request per employee. */
export async function capabilityByDepartment(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [sqlClient`
    select employee.department as name,
           (count(employee_skill.id) filter (where employee_skill.attributes->>'verified' = 'true'))::int as value
    from employees employee
    left join employee_skills employee_skill
      on employee_skill.tenant_id = employee.tenant_id and employee_skill.employee_id = employee.id
    where employee.tenant_id = ${access.tenantId} and employee.status = 'active'
    group by employee.department
    order by value desc, employee.department
    limit 8
  `]);
  return rows;
}
