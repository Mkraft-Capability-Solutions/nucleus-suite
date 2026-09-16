import "server-only";

import { isAdminPrincipal } from "@/lib/cockpit-catalog";
import { enforce, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Who is served the whole tenant's leave, and who is served only their own.
 *
 * Every leave register — requests, the request queue, the balance ledger and the
 * balances themselves — enforced one flat `leave.read` and then returned every
 * row in the tenant. `leave.read` is held by the standard employee role (see
 * `scripts/seeder/domain01-identity.ts`), and these screens are now on the
 * employee navigation allowlist, so "My leave" was serving every employee's
 * leave to every employee.
 *
 * `operationalScope` (src/server/workflows/operational-access.ts) does not fit:
 * it needs `leave.self.read` / `leave.team.read` keys and the permission
 * catalogue (db/migrations/0003_auth_completion.sql) carries only
 * `leave.read`, `leave.write` and `leave.approve`. Inventing the keys would mean
 * a migration and a re-grant of every role. So the rule is the one the rest of
 * the platform already reaches for when a permission catalogue has no self key —
 * exactly `payslipScopeFrom` in src/server/payroll/payslips.ts and
 * `canReadWholeCascade` in src/server/performance/okr.ts:
 *
 *  - an administrative principal (`isAdminPrincipal`, the same rule the cockpit
 *    catalogue and the home surface use) reads the tenant;
 *  - so does anybody holding `leave.approve`, because that is precisely the set
 *    of people who have to see somebody else's leave to do their job — the
 *    supervisor, the HOD and the HR Head of W-01, and the manager role, all of
 *    which are granted `leave.approve` in every seeded role set;
 *  - everybody else — the standard employee, who holds `leave.read` and
 *    `leave.write` and nothing wider — reads only their own rows, and is
 *    refused outright when no employee profile is linked to the account.
 */

export type LeaveReadScope = "tenant" | "self";

/** The permission that admits a caller to the whole tenant's leave. */
export const LEAVE_WIDE_READ_PERMISSION = "leave.approve";

/** Whether this caller may read leave belonging to other employees. */
export function canReadWholeLeaveRegister(permissions: readonly string[], roles: readonly string[] = []): boolean {
  return isAdminPrincipal(permissions, roles) || permissions.includes(LEAVE_WIDE_READ_PERMISSION);
}

/** Which slice this caller gets, decided before a single row is read. */
export function leaveReadScopeFor(permissions: readonly string[], roles: readonly string[] = []): LeaveReadScope {
  return canReadWholeLeaveRegister(permissions, roles) ? "tenant" : "self";
}

export type ResolvedLeaveScope = {
  scope: LeaveReadScope;
  /** The employee every self-scoped query is pinned to; null for tenant scope. */
  selfEmployeeId: string | null;
};

/**
 * Resolves the slice and enforces the read permission, exactly as
 * `resolvePayslipScope` does. A self-scoped account with no linked employee
 * profile is refused with `EMPLOYEE_LINK_REQUIRED` rather than quietly widened.
 */
export function resolveLeaveReadScope(access: Access): ResolvedLeaveScope {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (canReadWholeLeaveRegister(access.context.permissions, access.context.roles)) {
    return { scope: "tenant", selfEmployeeId: null };
  }
  const selfEmployeeId = access.context.employeeId ?? null;
  if (!selfEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile to view its own leave.",
    });
  }
  return { scope: "self", selfEmployeeId };
}

/**
 * The employee id a leave query binds into its SQL.
 *
 * For a self-scoped caller this is the caller's own employee id whatever the
 * request asked for: a client-supplied `employeeId` is not validated and
 * refused, it is discarded, so no filter a caller can write reaches the query.
 * For a tenant-scoped caller it is the requested filter, or null for no filter.
 */
export function leaveEmployeeFilter(scope: ResolvedLeaveScope, requested: string | null | undefined): string | null {
  if (scope.scope === "self") return scope.selfEmployeeId;
  const trimmed = typeof requested === "string" ? requested.trim() : "";
  return trimmed === "" ? null : trimmed;
}
