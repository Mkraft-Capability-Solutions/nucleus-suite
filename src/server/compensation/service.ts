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

export const createBandSchema = z.object({
  gradeCode: z.string().trim().min(1).max(20).default("E3"),
  minMinor: z.number().int().positive(),
  maxMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
});

export async function createBand(access: Access, input: z.infer<typeof createBandSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.minMinor >= input.maxMinor) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Band minimum must be below the maximum." });
  }
  const [gradeRows] = await tenantTx(access, [
    sqlClient`select id from grades where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.gradeCode} limit 1`,
  ]);
  let gradeId = (gradeRows as Array<{ id: string }>)[0]?.id;
  if (!gradeId) {
    gradeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into grades (id, tenant_id, attributes) values (${gradeId}, ${access.tenantId}, ${JSON.stringify({ code: input.gradeCode })}::jsonb)`,
    ]);
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compensation_bands (id, tenant_id, grade_id, attributes)
      values (${id}, ${access.tenantId}, ${gradeId},
        ${JSON.stringify({ grade_code: input.gradeCode, min_minor: input.minMinor, max_minor: input.maxMinor, currency: input.currency })}::jsonb)
    `,
  ]);
  return { id };
}

export const createCycleSchema = z.object({
  code: z.string().trim().min(1).max(40).default("COMP-FY27"),
  budgetMinor: z.number().int().positive(),
});

export async function createCompCycle(access: Access, input: z.infer<typeof createCycleSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const entityId = await ensureLegalEntity(access);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compensation_cycles (id, tenant_id, legal_entity_id, attributes)
      values (${id}, ${access.tenantId}, ${entityId},
        ${JSON.stringify({ code: input.code, budget_minor: input.budgetMinor, allocated_minor: 0, status: "budgeted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'comp.cycle_create', 'compensation_cycle', ${id}, 'Compensation cycle budgeted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, code: input.code };
}

export const createBudgetSchema = z.object({
  cycleId: z.string().uuid(),
  departmentName: z.string().trim().min(1).max(80).optional(),
  amountMinor: z.number().int().positive(),
});

export async function createBudget(access: Access, input: z.infer<typeof createBudgetSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compensation_budgets (id, tenant_id, compensation_cycle_id, attributes)
      values (${id}, ${access.tenantId}, ${input.cycleId},
        ${JSON.stringify({ department: input.departmentName ?? null, amount_minor: input.amountMinor, consumed_minor: 0 })}::jsonb)
    `,
  ]);
  return { id };
}

export const proposeCompSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  newBasicMinor: z.number().int().positive(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  justification: z.string().trim().min(1).max(1000),
});

export async function proposeCompensation(access: Access, input: z.infer<typeof proposeCompSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [assignmentRows] = await tenantTx(access, [
    sqlClient`select id from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} order by created_at desc limit 1`,
  ]);
  const assignmentId = (assignmentRows as Array<{ id: string }>)[0]?.id;
  if (!assignmentId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The employee has no salary assignment to revise." });
  }
  const [bandRows] = await tenantTx(access, [
    sqlClient`
      select (attributes->>'min_minor')::bigint as min_minor, (attributes->>'max_minor')::bigint as max_minor
      from compensation_bands where tenant_id = ${access.tenantId} order by created_at desc limit 1
    `,
  ]);
  const band = (bandRows as Array<{ min_minor: number | string; max_minor: number | string }>)[0];
  if (band && (input.newBasicMinor < Number(band.min_minor) || input.newBasicMinor > Number(band.max_minor))) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Recommendation breaches band guardrails; escalate instead." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into compensation_proposals (id, tenant_id, compensation_cycle_id, current_salary_assignment_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.cycleId}, ${assignmentId}, ${input.employeeId},
        ${JSON.stringify({ new_basic_minor: input.newBasicMinor, effective_date: input.effectiveDate, justification: input.justification, status: "proposed", recommended_by: access.context.actorUserId })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'comp.propose', 'compensation_proposal', ${id}, 'Compensation proposed within guardrails', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "proposed" };
}

export async function approveCompProposal(access: Access, proposalId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, current_salary_assignment_id, attributes from compensation_proposals where tenant_id = ${access.tenantId} and id = ${proposalId} limit 1`,
  ]);
  const proposal = (rows as Array<{ id: string; employee_id: string; current_salary_assignment_id: string; attributes: { status: string; new_basic_minor: number; effective_date: string; recommended_by: string } }>)[0];
  if (!proposal) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (proposal.attributes.status !== "proposed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Proposal is ${proposal.attributes.status}.` });
  }
  if (proposal.attributes.recommended_by === access.context.actorUserId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Maker and checker must differ for compensation approval." });
  }
  const [assignmentRows] = await tenantTx(access, [
    sqlClient`select pay_group_id, salary_structure_id from employee_salary_assignments where id = ${proposal.current_salary_assignment_id} and tenant_id = ${access.tenantId} limit 1`,
  ]);
  const current = (assignmentRows as Array<{ pay_group_id: string; salary_structure_id: string }>)[0];
  if (!current) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Current salary assignment is missing." });
  const newAssignmentId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into employee_salary_assignments (id, tenant_id, employee_id, pay_group_id, salary_structure_id, attributes)
      values (${newAssignmentId}, ${access.tenantId}, ${proposal.employee_id}, ${current.pay_group_id}, ${current.salary_structure_id},
        ${JSON.stringify({ basic_minor: Number(proposal.attributes.new_basic_minor), effective_from: proposal.attributes.effective_date, supersedes: proposal.current_salary_assignment_id })}::jsonb)
    `,
    sqlClient`
      update compensation_proposals set proposed_salary_assignment_id = ${newAssignmentId},
        attributes = attributes || ${JSON.stringify({ status: "approved", approved_by: access.context.actorUserId })}::jsonb
      where id = ${proposalId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'comp.approve', 'compensation_proposal', ${proposalId}, 'Compensation approved with maker/checker separation', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: proposalId, status: "approved", effectiveDate: proposal.attributes.effective_date };
}

export async function listProposals(access: Access, args: { cycleId: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const filter = args.cycleId;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from compensation_proposals where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or compensation_cycle_id = ${args.cycleId})
    `,
    sqlClient`
      select id, employee_id, compensation_cycle_id, attributes from compensation_proposals where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or compensation_cycle_id = ${args.cycleId})
      order by created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}
