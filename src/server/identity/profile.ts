import "server-only";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";

/**
 * The signed-in person's own profile. Identity comes only from the authenticated session (`Access`); the
 * employee record is read inside the caller's tenant. Nothing is defaulted: a missing value is `null`.
 */

export type OwnProfile = {
  id: string;
  employeeId: string | null;
  employeeCode: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  dept: string | null;
  location: string | null;
  photo: string | null;
  photoUrl: string | null;
  roles: string[];
};

export const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(32).regex(/^[+0-9 ()-]*$/, "Use digits, spaces and + ( ) - only.").optional(),
    jobTitle: z.string().trim().max(120).optional(),
    dept: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
  });
// Unknown keys (e.g. email) are dropped: the sign-in email is not self-service editable.
export type UpdateOwnProfile = z.infer<typeof updateOwnProfileSchema>;

type UserRow = { id: string; name: string | null; email: string | null; image: string | null };
type EmployeeRow = {
  id: string; employee_code: string | null; first_name: string | null; last_name: string | null; work_email: string | null;
  designation: string | null; department: string | null; location: string | null; photo: string | null; phone: string | null;
};

async function readEmployee(access: Access): Promise<EmployeeRow | null> {
  if (!access.context.employeeId) return null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, work_email, designation, department, location,
             coalesce(metadata->>'photo', metadata->>'avatar') as photo, metadata->>'phone' as phone
      from employees
      where tenant_id = ${access.tenantId} and id = ${access.context.employeeId}
      limit 1
    `,
  ]);
  return (rows as EmployeeRow[])[0] ?? null;
}

export async function getOwnProfile(access: Access): Promise<OwnProfile> {
  const users = (await sqlClient`select id, name, email, image from "user" where id = ${access.context.actorUserId} limit 1`) as unknown as UserRow[];
  const user = users[0] ?? null;
  const employee = await readEmployee(access);
  const employeeName = employee ? [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || null : null;
  const name = user?.name?.trim() || employeeName;
  const photo = employee?.photo || user?.image || null;
  return {
    id: access.context.actorUserId,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employee_code ?? null,
    name,
    firstName: employee?.first_name ?? name?.split(/\s+/)[0] ?? null,
    lastName: employee?.last_name ?? (name ? name.split(/\s+/).slice(1).join(" ") || null : null),
    email: user?.email ?? employee?.work_email ?? null,
    phone: employee?.phone ?? null,
    jobTitle: employee?.designation ?? null,
    dept: employee?.department ?? null,
    location: employee?.location ?? null,
    photo,
    photoUrl: photo,
    roles: [...access.context.roles],
  };
}

export async function updateOwnProfile(access: Access, input: UpdateOwnProfile, requestId: string): Promise<OwnProfile> {
  const [firstName, ...rest] = input.name ? input.name.split(/\s+/) : [];
  const lastName = input.name ? rest.join(" ") : undefined;
  if (input.name) {
    await sqlClient`update "user" set name = ${input.name}, updated_at = now() where id = ${access.context.actorUserId}`;
  }
  if (access.context.employeeId) {
    await tenantTx(access, [
      sqlClient`
        update employees set
          first_name = coalesce(${firstName ?? null}, first_name),
          last_name = coalesce(${lastName ?? null}, last_name),
          designation = coalesce(${input.jobTitle ?? null}, designation),
          department = coalesce(${input.dept ?? null}, department),
          location = coalesce(${input.location ?? null}, location),
          metadata = case when ${input.phone ?? null}::text is null then metadata
                          else jsonb_set(coalesce(metadata, '{}'::jsonb), '{phone}', to_jsonb(${input.phone ?? ""}::text), true) end,
          updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${access.context.employeeId}
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'profile.updated', 'employee',
                ${access.context.employeeId}, 'Self-service profile update', '{}'::jsonb, ${JSON.stringify({ fields: Object.keys(input) })}::jsonb, ${requestId})
      `,
    ]);
  }
  return getOwnProfile(access);
}
