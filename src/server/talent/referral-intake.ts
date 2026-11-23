import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Employee referral intake (SCR-090 "Refer candidate").
 *
 * One transaction writes the candidate, the application against the chosen requisition (when one is
 * given) and the referral. The referrer is the caller's own employee record; an account with no linked
 * employee cannot refer. No score, skill, bonus or experience is written: those come from assessment,
 * the candidate's own record and the tenant's referral award scheme, never from intake.
 */

export const referralIntakeSchema = z.object({
  candidateName: z.string().trim().min(2, "Enter the candidate's full name.").max(120),
  candidateEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("").transform(() => undefined)),
  candidatePhone: z.string().trim().max(30).optional().transform((value) => (value ? value : undefined)),
  requisitionId: z.string().uuid("Choose the requisition the candidate is referred for.").optional(),
  note: z.string().trim().max(500).optional().transform((value) => (value ? value : undefined)),
});

export type ReferralIntake = z.infer<typeof referralIntakeSchema>;

export async function submitReferral(access: Access, input: ReferralIntake, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [memberRows, requisitionRows, duplicateRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and id = ${access.context.membershipId} and status = 'active' limit 1`,
    sqlClient`select id, attributes->>'status' as status from requisitions where tenant_id = ${access.tenantId} and id = ${input.requisitionId ?? null}::uuid limit 1`,
    sqlClient`select r.id from referrals r
              join candidates c on c.tenant_id = r.tenant_id and c.id = r.candidate_id
              left join applications a on a.tenant_id = r.tenant_id and a.id = r.application_id
              where r.tenant_id = ${access.tenantId} and lower(c.attributes->>'name') = lower(${input.candidateName})
                and a.requisition_id is not distinct from ${input.requisitionId ?? null}::uuid
              limit 1`,
  ]);
  const referrer = access.context.employeeId ?? (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
  if (!referrer) {
    throw new HttpError({ status: 403, code: "EMPLOYEE_LINK_REQUIRED", message: "Referrals require an account linked to an employee profile." });
  }
  const requisition = (requisitionRows as Array<{ id: string; status: string | null }>)[0];
  if (input.requisitionId && !requisition) {
    throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The chosen requisition does not exist.", details: [{ field: "requisitionId", issue: "unknown" }] });
  }
  if (requisition && ["closed", "cancelled", "filled"].includes(requisition.status ?? "")) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "That requisition is no longer open for referrals.", details: [{ field: "requisitionId", issue: "closed" }] });
  }
  if ((duplicateRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `${input.candidateName} has already been referred for this requisition.`, details: [{ field: "candidateName", issue: "duplicate" }] });
  }

  const candidateId = randomUUID();
  const applicationId = input.requisitionId ? randomUUID() : null;
  const referralId = randomUUID();
  const candidate = { name: input.candidateName, email: input.candidateEmail ?? null, phone: input.candidatePhone ?? null, source: "employee_referral" };
  const statements = [
    sqlClient`insert into candidates (id, tenant_id, attributes) values (${candidateId}, ${access.tenantId}, ${JSON.stringify(candidate)}::jsonb)`,
  ];
  if (applicationId) {
    statements.push(sqlClient`insert into applications (id, tenant_id, candidate_id, requisition_id, attributes)
      values (${applicationId}, ${access.tenantId}, ${candidateId}, ${input.requisitionId ?? null}::uuid, ${JSON.stringify({ stage: "applied", source: "employee_referral" })}::jsonb)`);
  }
  statements.push(
    sqlClient`insert into referrals (id, tenant_id, application_id, candidate_id, referrer_employee_id, attributes)
              values (${referralId}, ${access.tenantId}, ${applicationId}, ${candidateId}, ${referrer}, ${JSON.stringify({ status: "referred", note: input.note ?? null })}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
              values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'talent.referral_create', 'referral', ${referralId},
                      'Employee referral submitted', ${JSON.stringify({ candidate_id: candidateId, application_id: applicationId })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  );
  await tenantTx(access, statements);
  return { id: referralId, candidateId, applicationId, status: "referred" as const };
}
