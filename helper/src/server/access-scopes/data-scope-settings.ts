import {
  DATA_SCOPE_DIMENSIONS,
  type DataScopeDimension,
  type DataScopeGrant,
  type MembershipScopeGrant,
} from "@/server/identity/authorization";

/**
 * Role & Data Scope Setup (F-SEC-01), the configuration half of RL-24.
 *
 * The four settings the configuration register names — scope dimension, the values on it,
 * and the two structure-visibility flags — are held per role code on
 * `tenant_settings.settings -> 'dataScopes'`. That is the tenant's own settings envelope,
 * so a new setting needs no migration, and role codes are already unique per tenant
 * (`roles_tenant_code_uq`), which is the key this map is on.
 *
 * Parsing lives here, apart from the database and permission layer, because the caller's
 * authorization context is built from it before any `Access` exists.
 */
export const DATA_SCOPES_SETTINGS_KEY = "dataScopes";

/** The register's stated default: a role is scoped on attendance location until told otherwise. */
export const DEFAULT_SCOPE_DIMENSION: DataScopeDimension = "attendance_location";

export type StoredRoleScope = {
  scopeDimension: DataScopeDimension;
  scopeValues: string[];
  canViewSalaryStructure: boolean;
  canViewRateStructure: boolean;
};

function parseStored(value: unknown): StoredRoleScope | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const dimension = DATA_SCOPE_DIMENSIONS.find((candidate) => candidate === record.scopeDimension);
  if (!dimension) return null;
  const values = Array.isArray(record.scopeValues)
    ? record.scopeValues.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    scopeDimension: dimension,
    scopeValues: values,
    canViewSalaryStructure: record.canViewSalaryStructure === true,
    canViewRateStructure: record.canViewRateStructure === true,
  };
}

/** The stored map as `{ roleCode: scope }`. An unreadable entry is dropped, never guessed at. */
export function parseDataScopeSettings(settings: unknown): Record<string, StoredRoleScope> {
  const bag = typeof settings === "object" && settings !== null ? (settings as Record<string, unknown>) : {};
  const raw = bag[DATA_SCOPES_SETTINGS_KEY];
  if (typeof raw !== "object" || raw === null) return {};
  const parsed: Record<string, StoredRoleScope> = {};
  for (const [roleCode, value] of Object.entries(raw as Record<string, unknown>)) {
    const scope = parseStored(value);
    if (scope) parsed[roleCode] = scope;
  }
  return parsed;
}

/** The grants that apply to one caller, resolved from the tenant map by the caller's role codes. */
export function grantsForRoles(settings: unknown, roleCodes: readonly string[]): DataScopeGrant[] {
  const configured = parseDataScopeSettings(settings);
  const grants: DataScopeGrant[] = [];
  for (const roleCode of roleCodes) {
    const scope = configured[roleCode];
    if (!scope) continue;
    grants.push({
      roleCode,
      dimension: scope.scopeDimension,
      values: scope.scopeValues,
      canViewSalaryStructure: scope.canViewSalaryStructure,
      canViewRateStructure: scope.canViewRateStructure,
    });
  }
  return grants;
}

/**
 * User, Role and Scope Grant (FRM-PLT-03), the per-principal half. One record per
 * membership id on `tenant_settings.settings -> 'principalGrants'`, next to the role
 * scopes: the same row the authorization context is already built from, so the grant
 * reaches the evaluator without a second read. The roles and dates of the same form are
 * the `membership_roles` rows; this record carries what those rows cannot.
 */
export const PRINCIPAL_GRANTS_SETTINGS_KEY = "principalGrants";

export type StoredPrincipalGrant = {
  principalType: string;
  ownerPrincipalId: string | null;
  authMethod: string;
  mfaRequired: boolean;
  entityGrant: string[];
  locationGrant: string[];
  payrollGroupGrant: string[];
  canEditTime: boolean;
  includeReportingLine: boolean;
  delegateToPrincipal: string | null;
  updatedAt: string;
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry !== "") : [];
}

function parsePrincipalGrant(value: unknown): StoredPrincipalGrant | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.principalType !== "string" || typeof record.authMethod !== "string") return null;
  return {
    principalType: record.principalType,
    ownerPrincipalId: typeof record.ownerPrincipalId === "string" ? record.ownerPrincipalId : null,
    authMethod: record.authMethod,
    mfaRequired: record.mfaRequired === true,
    entityGrant: stringList(record.entityGrant),
    locationGrant: stringList(record.locationGrant),
    payrollGroupGrant: stringList(record.payrollGroupGrant),
    canEditTime: record.canEditTime === true,
    includeReportingLine: record.includeReportingLine === true,
    delegateToPrincipal: typeof record.delegateToPrincipal === "string" ? record.delegateToPrincipal : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

/** The stored map as `{ membershipId: grant }`. An unreadable entry is dropped, never guessed at. */
export function parsePrincipalGrants(settings: unknown): Record<string, StoredPrincipalGrant> {
  const bag = typeof settings === "object" && settings !== null ? (settings as Record<string, unknown>) : {};
  const raw = bag[PRINCIPAL_GRANTS_SETTINGS_KEY];
  if (typeof raw !== "object" || raw === null) return {};
  const parsed: Record<string, StoredPrincipalGrant> = {};
  for (const [membershipId, value] of Object.entries(raw as Record<string, unknown>)) {
    const grant = parsePrincipalGrant(value);
    if (grant) parsed[membershipId] = grant;
  }
  return parsed;
}

/** The scope half of one caller's grant, in the shape the evaluator reads; null when none was saved. */
export function membershipScopeFor(settings: unknown, membershipId: string): MembershipScopeGrant | null {
  const grant = parsePrincipalGrants(settings)[membershipId];
  if (!grant) return null;
  return {
    entityGrant: grant.entityGrant,
    locationGrant: grant.locationGrant,
    payrollGroupGrant: grant.payrollGroupGrant,
    canEditTime: grant.canEditTime,
    includeReportingLine: grant.includeReportingLine,
  };
}
