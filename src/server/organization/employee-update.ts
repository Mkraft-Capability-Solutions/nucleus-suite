import "server-only";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { applyPersonProfileRules, PERSON_PROFILE_KEYS, personProfileShape } from "@/server/organization/person-profile";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Every edit writes an audit entry, so the workbook holds its reason to ten characters. */
export const CHANGE_REASON_MIN_LENGTH = 10;

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  workEmail: z.string().email().optional(),
  designation: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().min(1).max(80).optional(),
  ...personProfileShape,
  reason: z.string().trim().min(CHANGE_REASON_MIN_LENGTH).max(500),
}).superRefine(applyPersonProfileRules)
  .refine(input => Object.keys(input).some(key => key !== "reason"), "Change at least one employee field.");

export async function updateEmployee(access: Access, id: string, version: number, input: z.infer<typeof updateEmployeeSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  // Only the profile keys the caller actually sent are merged, so an edit to one field
  // never clears the rest of the envelope.
  const profilePatch: Record<string, unknown> = {};
  const supplied = input as Record<string, unknown>;
  for (const key of PERSON_PROFILE_KEYS) {
    if (supplied[key] !== undefined) profilePatch[key] = supplied[key];
  }
  const [rows] = await tenantTx(access, [sqlClient`
    with changed as (
      update employees set first_name = coalesce(${input.firstName ?? null}, first_name),
        last_name = coalesce(${input.lastName ?? null}, last_name), work_email = coalesce(${input.workEmail ?? null}, work_email),
        designation = coalesce(${input.designation ?? null}, designation), department = coalesce(${input.department ?? null}, department),
        location = coalesce(${input.location ?? null}, location),
        metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify(profilePatch)}::jsonb,
        version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id} and version = ${version}
      returning id, version
    ), audited as (
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'people.update', 'employee', id,
        ${input.reason}, ${JSON.stringify(input)}::jsonb, ${uuidOrNull(requestId)}::uuid from changed
    ) select id, version from changed
  `]);
  const row = (rows as Array<{ id: string; version: number }>)[0];
  if (!row) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The employee changed or is no longer available. Refresh the record before editing." });
  return row;
}
