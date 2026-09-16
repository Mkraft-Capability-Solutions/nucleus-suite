import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * One chain item as the template declares it (FRM-LCY-01 `chain_item[]`): the item, its
 * owner, whether it blocks, and the offset the item's due date is derived from. The
 * offset is optional because a template that does not state one leaves the due date
 * unset rather than having a default guessed for it.
 */
const chainItemSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  required: z.boolean(),
  owner: z.string().trim().min(1).max(60),
  offsetDays: z.number().int().min(-90).max(180).optional(),
  /**
   * R-24: which items hold up confirmation is a tenant decision, so it is declared on the
   * template rather than in code. `required` is the Day-1 gate and this is the later
   * confirmation gate; an item can block one, both or neither. A template that declares it
   * on no item at all falls back to its required items - see `confirmationBlockers`.
   */
  blocksConfirmation: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  tasks: z.array(chainItemSchema).min(1).max(30),
});

export async function createTemplate(access: Access, input: z.infer<typeof createTemplateSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from onboarding_templates where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.code} limit 1`,
  ]);
  if ((rows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A template with this code already exists." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into onboarding_templates (id, tenant_id, attributes)
      values (${id}, ${access.tenantId},
        ${JSON.stringify({ code: input.code, name: input.name, tasks: input.tasks, status: "active" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.template_create', 'onboarding_template', ${id}, 'Onboarding template created', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  tasks: z.array(chainItemSchema).min(1).max(30).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function updateTemplate(access: Access, templateId: string, input: z.infer<typeof updateTemplateSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from onboarding_templates where tenant_id = ${access.tenantId} and id = ${templateId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const patch: Record<string, unknown> = {};
  if (input.name) patch.name = input.name;
  if (input.tasks) patch.tasks = input.tasks;
  if (input.status) patch.status = input.status;
  if (Object.keys(patch).length === 0) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "At least one field is required." });
  }
  await tenantTx(access, [
    sqlClient`update onboarding_templates set attributes = attributes || ${JSON.stringify(patch)}::jsonb, updated_at = now() where id = ${templateId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.template_update', 'onboarding_template', ${templateId}, 'Onboarding template updated', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: templateId, status: (patch.status as string | undefined) ?? "active", name: (patch.name as string | undefined) ?? null };
}

export async function listTemplates(access: Access, includeArchived: boolean) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    includeArchived
      ? sqlClient`select id, attributes, created_at from onboarding_templates where tenant_id = ${access.tenantId} order by created_at`
      : sqlClient`select id, attributes, created_at from onboarding_templates where tenant_id = ${access.tenantId} and attributes->>'status' = 'active' order by created_at`,
  ]);
  return rows;
}
