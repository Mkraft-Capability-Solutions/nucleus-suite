/**
 * RL-24 — salary visibility by payroll location.
 *
 * A permission says WHAT a role may read; a data scope says WHICH RECORDS it may read it
 * on. Without the second dimension a plant HR user either sees every salary in the tenant
 * or none, which is exactly what R-09 forbids. `scopeDimension`, `canViewSalaryStructure`
 * and `canViewRateStructure` are the three Role & Data Scope Setup (F-SEC-01) settings.
 *
 * The dimension names a column the employee record actually carries, so a scope can always
 * be evaluated: `attendance_location` is `employees.location` (where the person works) and
 * `payroll_location` is `employees.payroll_owner` (where the person is paid). A dimension
 * with nothing to compare against would be a setting that silently does nothing.
 */
export const DATA_SCOPE_DIMENSIONS = ["attendance_location", "payroll_location"] as const;
export type DataScopeDimension = (typeof DATA_SCOPE_DIMENSIONS)[number];

export type DataScopeGrant = {
  roleCode: string;
  dimension: DataScopeDimension;
  /** The values on that dimension the role may see. Empty covers nothing, never everything. */
  values: readonly string[];
  canViewSalaryStructure: boolean;
  canViewRateStructure: boolean;
};

/**
 * The scoped values of the record being read, as far as the caller has resolved them.
 * `payroll_group` is the pay group code of the employee's current salary assignment; the
 * User, Role and Scope Grant's payroll-group grant (FRM-PLT-03) is evaluated on it.
 */
export type ResourceScope = Partial<Record<DataScopeDimension | "payroll_group", string | null>>;

/**
 * The scope half of one principal's User, Role and Scope Grant (FRM-PLT-03). Where a role
 * data scope is shared by everyone holding the role, this is the individual grant: the
 * sites a plant user may see, the pay groups whose pay fields are readable, and the two
 * behaviour switches. Lists are codes. An empty list means the grant does not narrow on
 * that dimension - the form requires at least one entity and one location, so the empty
 * case only arises for the optional payroll-group grant.
 */
export type MembershipScopeGrant = {
  entityGrant: readonly string[];
  locationGrant: readonly string[];
  payrollGroupGrant: readonly string[];
  /** Read versus write on attendance at the granted sites. Off refuses the time-edit actions. */
  canEditTime: boolean;
  /** Whether the caller's reporting line is visible beyond the granted sites; resolved per query. */
  includeReportingLine: boolean;
};

export type AuthorizationContext = {
  actorUserId: string;
  membershipId: string;
  tenantId: string;
  employeeId?: string | null;
  permissions: readonly string[];
  roles: readonly string[];
  /**
   * The data scopes configured for this caller's roles. Absent or empty means the tenant
   * has configured none, and scope checks then do not narrow anything — a scope can only
   * ever take access away, so an unconfigured tenant behaves exactly as before.
   */
  dataScopes?: readonly DataScopeGrant[];
  /**
   * The caller's own scope grant (FRM-PLT-03), when an administrator has saved one.
   * Absent means no individual grant was recorded and nothing narrows beyond the roles.
   */
  membershipScope?: MembershipScopeGrant | null;
};

export type AuthorizationRequest = {
  action: string;
  resource: { tenantId: string; sensitivity?: readonly string[]; scope?: ResourceScope };
  requestedFields?: readonly string[];
};

export type AuthorizationDecision = {
  allowed: boolean;
  reasonCode:
    | "ALLOWED"
    | "ACTION_FORBIDDEN"
    | "TENANT_CONTEXT_MISMATCH"
    | "FIELD_FORBIDDEN"
    | "SCOPE_FORBIDDEN";
  allowedFields: string[];
};

const FIELD_PERMISSION: Record<string, string> = {
  compensation: "payroll.rate.read",
  rate: "payroll.rate.read",
  bank: "employee.bank.read",
  tax: "employee.tax.read",
  health: "employee.health.read",
};

/**
 * The two field domains R-09 puts behind a data scope, and the F-SEC-01 flag that has to
 * be on for each. Every other field domain is scope-neutral: the permission alone decides.
 */
const SCOPE_GATED_FIELDS: Record<string, keyof Pick<DataScopeGrant, "canViewSalaryStructure" | "canViewRateStructure">> = {
  compensation: "canViewSalaryStructure",
  rate: "canViewRateStructure",
};

/**
 * Whether the caller's configured scopes let this field domain through for this record.
 *
 * Fail-closed on purpose: a caller who holds a scope but did not resolve the record's value
 * on that scope's dimension has not shown the record is inside it, so the field is masked.
 * The opposite convention — treating "no value" as "all values" — is how a scope silently
 * stops applying.
 */
export function dataScopeAllows(
  context: AuthorizationContext,
  scope: ResourceScope | undefined,
  field: string,
): boolean {
  const flag = SCOPE_GATED_FIELDS[field];
  if (!flag) return true;
  const grants = context.dataScopes ?? [];
  const roleAllows = grants.length === 0 || grants.some((grant) => {
    if (!grant[flag]) return false;
    const value = scope?.[grant.dimension];
    if (value === undefined || value === null || value === "") return false;
    return grant.values.includes(value);
  });
  if (!roleAllows) return false;
  return payrollGroupAllows(context.membershipScope, scope);
}

/**
 * FRM-PLT-03 payroll-group grant: "pay fields return NULL outside the grant". Same
 * fail-closed rule as the role scope - a record whose pay group was not resolved is
 * outside the grant. Only a grant that names pay groups narrows anything.
 */
export function payrollGroupAllows(grant: MembershipScopeGrant | null | undefined, scope: ResourceScope | undefined): boolean {
  if (!grant || grant.payrollGroupGrant.length === 0) return true;
  const value = scope?.payroll_group;
  if (value === undefined || value === null || value === "") return false;
  return grant.payrollGroupGrant.includes(value);
}

/**
 * The actions that write attendance. FRM-PLT-03 splits read from write on the same grant
 * with `can_edit_time`; a principal whose grant has it off keeps every read.
 */
const TIME_EDIT_ACTIONS = new Set([
  "attendance.write",
  "attendance.manage",
  "attendance.exception_accept",
  "attendance.exception_resolve",
  "attendance.recompute_queue",
]);

/** True when the caller's own grant, if any, refuses this action. */
export function membershipScopeRefuses(context: AuthorizationContext, action: string): boolean {
  const grant = context.membershipScope;
  if (!grant) return false;
  return TIME_EDIT_ACTIONS.has(action) && !grant.canEditTime;
}

export function authorize(
  context: AuthorizationContext,
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (context.tenantId !== request.resource.tenantId) {
    return { allowed: false, reasonCode: "TENANT_CONTEXT_MISMATCH", allowedFields: [] };
  }

  const permissions = new Set(context.permissions);
  if (!permissions.has(request.action) || membershipScopeRefuses(context, request.action)) {
    return { allowed: false, reasonCode: "ACTION_FORBIDDEN", allowedFields: [] };
  }

  const requestedFields = request.requestedFields ?? [];
  const sensitive = request.resource.sensitivity ?? [];
  const guardedFields = [...requestedFields, ...sensitive];

  const deniedField = guardedFields.find((field) => {
    const requiredPermission = FIELD_PERMISSION[field];
    return requiredPermission && !permissions.has(requiredPermission);
  });
  if (deniedField) {
    return { allowed: false, reasonCode: "FIELD_FORBIDDEN", allowedFields: [] };
  }

  const outOfScopeField = guardedFields.find((field) => !dataScopeAllows(context, request.resource.scope, field));
  if (outOfScopeField) {
    return { allowed: false, reasonCode: "SCOPE_FORBIDDEN", allowedFields: [] };
  }

  return { allowed: true, reasonCode: "ALLOWED", allowedFields: [...requestedFields] };
}
