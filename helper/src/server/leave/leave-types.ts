import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";

/** Display names for the canonical codes, used only when a type is first created. */
const CANONICAL_NAMES: Record<string, string> = {
  EL: "Earned Leave",
  CL: "Casual Leave",
  SL: "Sick Leave",
  COFF: "Compensatory Off",
  BIRTHDAY: "Birthday Leave",
};

/**
 * The `leave_types` row for a code, created on first use.
 *
 * It creates the row, never its rules: a type bootstrapped here carries no
 * accrual quantity, cap, combination restriction or year-end treatment, so the
 * engine still refuses until the Leave Type Configuration form supplies them.
 */
export async function ensureLeaveType(access: Access, code: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from leave_types where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into leave_types (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name: CANONICAL_NAMES[code] ?? code, unit: "day" })}::jsonb)
    `,
  ]);
  return id;
}

/** The `leave_types` ids for a set of codes, in one pass. */
export async function ensureLeaveTypes(access: Access, codes: string[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const code of [...new Set(codes)]) ids.set(code, await ensureLeaveType(access, code));
  return ids;
}
