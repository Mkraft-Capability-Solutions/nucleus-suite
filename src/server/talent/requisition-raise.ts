import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { OVERRIDE_REASON_MIN_LENGTH, REQUISITION_TYPES } from "./establishment";

/**
 * Raise a requisition with its TAL-01 terms (SCR-090 create form).
 *
 * Writes the attributes the requisition register and the establishment gate read back:
 * `requisition_type`, `designation`, `positions`, `against_position_code`, `replacing_employee_id`,
 * `ctc_max_minor` and the override request. Nothing is defaulted: the department, hiring manager and,
 * for a replacement, the vacated position and incumbent must already exist in the tenant. The headroom
 * gate itself runs at approval (RL-462); raising only records what was asked for.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

export const raiseRequisitionSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a job title of at least 3 characters.").max(200),
    departmentId: z.string().uuid("Choose a department."),
    designation: optionalText(120),
    requisitionType: z.enum(REQUISITION_TYPES),
    positions: z.coerce.number().int().min(1).max(99).default(1),
    hiringManagerEmployeeId: z.string().uuid("Choose the hiring manager."),
    againstPositionCode: optionalText(40),
    replacingEmployeeId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    ctcMaxMinor: z.coerce.number().int().positive("Enter a positive annual CTC budget.").max(1_000_000_000_000),
    overrideRequested: z.boolean().default(false),
    overrideReason: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.requisitionType === "addition" && !value.designation) {
      ctx.addIssue({ code: "custom", path: ["designation"], message: "An addition needs a designation so its sanctioned strength can be found." });
    }
    if (value.requisitionType === "replacement") {
      if (!value.againstPositionCode) ctx.addIssue({ code: "custom", path: ["againstPositionCode"], message: "A replacement must name the vacated position code." });
      if (!value.replacingEmployeeId) ctx.addIssue({ code: "custom", path: ["replacingEmployeeId"], message: "Choose the previous incumbent." });
    }
    if (value.overrideRequested && (value.overrideReason?.length ?? 0) < OVERRIDE_REASON_MIN_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["overrideReason"], message: `An override needs a justification of at least ${OVERRIDE_REASON_MIN_LENGTH} characters.` });
    }
  });

export type RaiseRequisition = z.infer<typeof raiseRequisitionSchema>;

export async function raiseRequisition(access: Access, input: RaiseRequisition, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const replacing = input.requisitionType === "replacement" ? input.replacingEmployeeId ?? null : null;
  const positionCode = input.requisitionType === "replacement" ? input.againstPositionCode ?? null : null;

  const [departmentRows, managerRows, replacingRows, positionRows, duplicateRows, countRows] = await tenantTx(access, [
    sqlClient`select id from departments where tenant_id = ${access.tenantId} and id = ${input.departmentId}::uuid limit 1`,
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.hiringManagerEmployeeId}::uuid limit 1`,
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${replacing}::uuid limit 1`,
    sqlClient`select id from positions where tenant_id = ${access.tenantId} and attributes->>'code' = ${positionCode} limit 1`,
    sqlClient`select id from requisitions where tenant_id = ${access.tenantId} and department_id = ${input.departmentId}::uuid
              and lower(attributes->>'title') = lower(${input.title})
              and coalesce(attributes->>'status', 'draft') in ('draft', 'approved') limit 1`,
    sqlClient`select count(*)::int as total from requisitions where tenant_id = ${access.tenantId}`,
  ]);

  if ((departmentRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The chosen department does not exist.", details: [{ field: "departmentId", issue: "unknown" }] });
  }
  if ((managerRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The chosen hiring manager does not exist.", details: [{ field: "hiringManagerEmployeeId", issue: "unknown" }] });
  }
  if (replacing && (replacingRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The chosen previous incumbent does not exist.", details: [{ field: "replacingEmployeeId", issue: "unknown" }] });
  }
  if (positionCode && (positionRows as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: `Position ${positionCode} does not exist, so it cannot be backfilled.`, details: [{ field: "againstPositionCode", issue: "unknown" }] });
  }
  if ((duplicateRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `An open requisition for "${input.title}" already exists in this department.`, details: [{ field: "title", issue: "duplicate" }] });
  }

  const serial = ((countRows as Array<{ total: number }>)[0]?.total ?? 0) + 1;
  const code = `REQ-${new Date().getUTCFullYear()}-${String(serial).padStart(3, "0")}`;
  const id = randomUUID();
  const positionId = (positionRows as Array<{ id: string }>)[0]?.id ?? null;
  const attributes = {
    code,
    title: input.title,
    status: "draft",
    requisition_type: input.requisitionType,
    designation: input.designation ?? null,
    positions: input.positions,
    against_position_code: positionCode,
    replacing_employee_id: replacing,
    ctc_max_minor: input.ctcMaxMinor,
    override_requested: input.overrideRequested,
    override_reason: input.overrideRequested ? input.overrideReason ?? null : null,
  };
  await tenantTx(access, [
    sqlClient`insert into requisitions (id, tenant_id, department_id, hiring_manager_employee_id, position_id, attributes)
              values (${id}, ${access.tenantId}, ${input.departmentId}::uuid, ${input.hiringManagerEmployeeId}::uuid, ${positionId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
              values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'talent.requisition_create', 'requisition', ${id},
                      'Requisition drafted', ${JSON.stringify({ code, requisition_type: input.requisitionType, positions: input.positions })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, code, status: "draft" as const };
}
