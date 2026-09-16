import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

async function ensureLegalEntity(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const id = (rows as Array<{ id: string }>)[0]?.id;
  if (!id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No legal entity exists for this tenant yet." });
  return id;
}

export const createBenefitPlanSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  coverageMinor: z.number().int().positive(),
});

export async function createBenefitPlan(access: Access, input: z.infer<typeof createBenefitPlanSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const entityId = await ensureLegalEntity(access);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from benefit_plans where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return { id: existing.id, duplicate: true };
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into benefit_plans (id, tenant_id, legal_entity_id, attributes)
      values (${id}, ${access.tenantId}, ${entityId},
        ${JSON.stringify({ code: input.code, name: input.name, coverage_minor: input.coverageMinor })}::jsonb)
    `,
  ]);
  return { id, duplicate: false };
}

export const createBenefitOptionSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200).default("Standard"),
  employeeShareMinor: z.number().int().min(0),
});

export async function createBenefitOption(access: Access, input: z.infer<typeof createBenefitOptionSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [planRows] = await tenantTx(access, [
    sqlClient`select id from benefit_plans where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.planCode} limit 1`,
  ]);
  const planId = (planRows as Array<{ id: string }>)[0]?.id;
  if (!planId) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The benefit plan does not exist." });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into benefit_options (id, tenant_id, benefit_plan_id, attributes)
      values (${id}, ${access.tenantId}, ${planId},
        ${JSON.stringify({ code: input.code, name: input.name, employee_share_minor: input.employeeShareMinor })}::jsonb)
    `,
  ]);
  return { id };
}

export const enrollBenefitSchema = z.object({
  employeeId: z.string().uuid(),
  optionCode: z.string().trim().min(1).max(40),
});

export async function enrollBenefit(access: Access, input: z.infer<typeof enrollBenefitSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [optionRows] = await tenantTx(access, [
    sqlClient`select o.id, o.benefit_plan_id from benefit_options o where o.tenant_id = ${access.tenantId} and o.attributes->>'code' = ${input.optionCode} limit 1`,
  ]);
  const option = (optionRows as Array<{ id: string; benefit_plan_id: string }>)[0];
  if (!option) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The benefit option does not exist." });
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from benefit_enrollments where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and benefit_option_id = ${option.id} and attributes->>'status' = 'active' limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "An active enrollment already exists for this option." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into benefit_enrollments (id, tenant_id, benefit_option_id, benefit_plan_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${option.id}, ${option.benefit_plan_id}, ${input.employeeId}, '{"status":"active"}'::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'benefit.enroll', 'benefit_enrollment', ${id}, 'Benefit enrollment recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "active" };
}

export const claimBenefitSchema = z.object({
  enrollmentId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  diagnosis: z.string().trim().min(1).max(300),
});

export async function claimBenefit(access: Access, input: z.infer<typeof claimBenefitSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [enrollmentRows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.attributes as enrollment_attributes, p.attributes as plan_attributes
      from benefit_enrollments e join benefit_plans p on p.id = e.benefit_plan_id
      where e.tenant_id = ${access.tenantId} and e.id = ${input.enrollmentId} limit 1
    `,
  ]);
  const enrollment = (enrollmentRows as Array<{ id: string; enrollment_attributes: { status: string }; plan_attributes: { coverage_minor: number } }>)[0];
  if (!enrollment) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (enrollment.enrollment_attributes.status !== "active") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Claims need an active enrollment." });
  }
  const [usedRows] = await tenantTx(access, [
    sqlClient`
      select coalesce(sum((attributes->>'amount_minor')::bigint), 0)::bigint as used
      from benefit_claims where tenant_id = ${access.tenantId} and benefit_enrollment_id = ${input.enrollmentId}
        and attributes->>'status' != 'rejected'
    `,
  ]);
  const used = Number((usedRows as Array<{ used: number | string }>)[0]?.used ?? 0);
  const coverage = Number(enrollment.plan_attributes.coverage_minor ?? 0);
  if (used + input.amountMinor > coverage) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The claim exceeds the remaining coverage." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into benefit_claims (id, tenant_id, benefit_enrollment_id, attributes)
      values (${id}, ${access.tenantId}, ${input.enrollmentId},
        ${JSON.stringify({ amount_minor: input.amountMinor, diagnosis: input.diagnosis, status: "submitted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'benefit.claim', 'benefit_claim', ${id}, 'Benefit claim submitted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted", remainingMinor: coverage - used - input.amountMinor };
}

export async function listEnrollmentsFor(access: Access, employeeId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, benefit_plan_id, benefit_option_id, attributes from benefit_enrollments where tenant_id = ${access.tenantId} and employee_id = ${employeeId} order by created_at`,
  ]);
  return rows;
}
