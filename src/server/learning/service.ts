import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

async function assertEmployee(access: Access, employeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

export const createCourseSchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  mandatory: z.boolean().default(false),
  durationMinutes: z.number().int().positive().max(100000).default(120),
});

export async function createCourse(access: Access, input: z.infer<typeof createCourseSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from courses where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return { id: existing.id, duplicate: true };
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into courses (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: input.code, title: input.title, mandatory: input.mandatory, duration_minutes: input.durationMinutes })}::jsonb)
    `,
  ]);
  return { id, duplicate: false };
}

export async function listCourses(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from courses where tenant_id = ${access.tenantId} order by created_at`,
  ]);
  return rows;
}

export const createPathSchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  courseCodes: z.array(z.string().trim().min(1).max(40)).min(1).max(50),
});

export async function createLearningPath(access: Access, input: z.infer<typeof createPathSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into learning_paths (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: input.code, title: input.title, course_codes: input.courseCodes })}::jsonb)
    `,
  ]);
  return { id };
}

export const enrollSchema = z.object({
  employeeId: z.string().uuid(),
  courseCode: z.string().trim().min(1).max(40),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function enrollEmployee(access: Access, input: z.infer<typeof enrollSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.employeeId);
  const [courseRows] = await tenantTx(access, [
    sqlClient`select id from courses where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.courseCode} limit 1`,
  ]);
  const course = (courseRows as Array<{ id: string }>)[0];
  if (!course) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The course does not exist." });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into enrollments (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ course_code: input.courseCode, due_date: input.dueDate ?? null, status: "assigned" })}::jsonb)
    `,
  ]);
  return { id, status: "assigned" };
}

export async function completeEnrollment(access: Access, enrollmentId: string, scorePct: number | undefined, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from enrollments where tenant_id = ${access.tenantId} and id = ${enrollmentId} limit 1`,
  ]);
  const enrollment = (rows as Array<{ id: string; employee_id: string; attributes: { status: string; course_code: string } }>)[0];
  if (!enrollment) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (enrollment.attributes.status !== "assigned") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only assigned enrollments can be completed." });
  }
  const completionId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`update enrollments set attributes = attributes || '{"status":"verified"}'::jsonb where id = ${enrollmentId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into learning_completions (id, tenant_id, employee_id, enrollment_id, attributes)
      values (${completionId}, ${access.tenantId}, ${enrollment.employee_id}, ${enrollmentId},
        ${JSON.stringify({ course_code: enrollment.attributes.course_code, score_pct: scorePct ?? null, verified: true })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'learning.complete', 'enrollment', ${enrollmentId}, 'Learning verified; skill evidence updated', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { enrollmentId, completionId, status: "verified" };
}

export async function listEnrollments(access: Access, employeeId: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = employeeId ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, attributes from enrollments where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or employee_id = ${employeeId})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}
