import "server-only";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Candidate profile edits (PATCH /api/v1/candidates/:id).
 *
 * Only profile fields can change here. Pipeline stage belongs to the application and moves one step at
 * a time through POST /api/v1/applications/:id/advance, so a `stage` in the body is refused rather than
 * written. A candidate that does not exist is a 404; nothing is echoed back as if it had been saved.
 */
export const updateCandidateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(30).optional(),
    source: z.string().trim().max(60).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update." });

export type UpdateCandidate = z.infer<typeof updateCandidateSchema>;

export function assertNoStageChange(body: unknown): void {
  if (body && typeof body === "object" && ("stage" in body || "to" in body)) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Pipeline stage is changed on the application: use POST /api/v1/applications/{id}/advance.",
      details: [{ field: "stage", issue: "not editable here" }],
    });
  }
}

export async function updateCandidateRecord(access: Access, candidateId: string, input: UpdateCandidate, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (!uuidOrNull(candidateId)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Candidate not found." });
  const [rows] = await tenantTx(access, [
    sqlClient`
      with changed as (
        update candidates set attributes = attributes || ${JSON.stringify(input)}::jsonb, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${candidateId}::uuid
        returning id, attributes
      ), audited as (
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'talent.candidate_update', 'candidate', changed.id,
               'Candidate profile updated', ${JSON.stringify({ fields: Object.keys(input) })}::jsonb, ${uuidOrNull(requestId)}::uuid
        from changed
      )
      select id, attributes from changed
    `,
  ]);
  const updated = (rows as Array<{ id: string; attributes: Record<string, unknown> }>)[0];
  if (!updated) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Candidate not found." });
  return updated;
}
