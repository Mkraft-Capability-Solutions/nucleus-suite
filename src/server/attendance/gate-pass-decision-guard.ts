import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible } from "@/server/attendance/service";

/**
 * Guard run before a gate-pass decision: the pass must exist in the caller's tenant, its employee must be inside
 * the caller's attendance scope, and nobody may decide their own pass (INV-SEC-02).
 */
export async function assertCanDecideGatePass(access: Access, id: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from gate_passes where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const pass = (rows as Array<{ employee_id: string }>)[0];
  if (!pass) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, pass.employee_id);
  if (access.context.employeeId && access.context.employeeId === pass.employee_id) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "You cannot decide your own gate pass." });
  }
}
