import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { importPreviewSchema } from "@/server/organization/service";

export const applyImportSchema = importPreviewSchema;

export async function applyImport(access: Access, input: z.infer<typeof applyImportSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const codes = [...new Set(input.rows.map((row) => row.employeeCode))];
  if (codes.length !== input.rows.length) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The plan contains repeated employee codes; re-run the dry-run first." });
  }
  const [existing] = await tenantTx(access, [
    sqlClient`select employee_code from employees where tenant_id = ${access.tenantId} and employee_code = any(${codes})`,
  ]);
  const known = new Set((existing as Array<{ employee_code: string }>).map((row) => row.employee_code));
  const conflicts = input.rows.filter((row) => known.has(row.employeeCode));
  if (conflicts.length > 0) {
    throw new HttpError({
      status: 409, code: "VERSION_CONFLICT",
      message: `Employee codes already exist: ${conflicts.map((row) => row.employeeCode).join(", ")}.`,
    });
  }
  const created: string[] = [];
  await tenantTx(access, [
    ...input.rows.flatMap((row) => {
      const personId = crypto.randomUUID();
      const employeeId = crypto.randomUUID();
      created.push(employeeId);
      return [
        sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
        sqlClient`
          insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, designation, department, location, joining_date)
          values (${employeeId}, ${access.tenantId}, ${personId}, ${row.employeeCode}, ${row.firstName}, ${row.lastName},
            ${row.workEmail ?? null}, 'Operator', ${row.department}, 'Plant North', ${new Date().toISOString().slice(0, 10)})
        `,
      ];
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'people.import_apply', 'tenant', ${access.tenantId}, 'Dry-run import applied',
        ${JSON.stringify({ created: created.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { created: created.length, employeeIds: created, applied: true };
}
