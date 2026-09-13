export type AuthorizationContext = {
  actorUserId: string;
  membershipId: string;
  tenantId: string;
  employeeId?: string | null;
  permissions: readonly string[];
  roles: readonly string[];
};

export type AuthorizationRequest = {
  action: string;
  resource: { tenantId: string; sensitivity?: readonly string[] };
  requestedFields?: readonly string[];
};

export type AuthorizationDecision = {
  allowed: boolean;
  reasonCode: "ALLOWED" | "ACTION_FORBIDDEN" | "TENANT_CONTEXT_MISMATCH" | "FIELD_FORBIDDEN";
  allowedFields: string[];
};

const FIELD_PERMISSION: Record<string, string> = {
  compensation: "payroll.rate.read",
  bank: "employee.bank.read",
  tax: "employee.tax.read",
  health: "employee.health.read",
};

export function authorize(
  context: AuthorizationContext,
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (context.tenantId !== request.resource.tenantId) {
    return { allowed: false, reasonCode: "TENANT_CONTEXT_MISMATCH", allowedFields: [] };
  }

  const permissions = new Set(context.permissions);
  if (!permissions.has(request.action)) {
    return { allowed: false, reasonCode: "ACTION_FORBIDDEN", allowedFields: [] };
  }

  const requestedFields = request.requestedFields ?? [];
  const deniedField = requestedFields.find((field) => {
    const requiredPermission = FIELD_PERMISSION[field];
    return requiredPermission && !permissions.has(requiredPermission);
  });
  if (deniedField) {
    return { allowed: false, reasonCode: "FIELD_FORBIDDEN", allowedFields: [] };
  }

  const sensitive = request.resource.sensitivity ?? [];
  const missingSensitivityPermission = sensitive.find((field) => {
    const requiredPermission = FIELD_PERMISSION[field];
    return requiredPermission && !permissions.has(requiredPermission);
  });
  if (missingSensitivityPermission) {
    return { allowed: false, reasonCode: "FIELD_FORBIDDEN", allowedFields: [] };
  }

  return { allowed: true, reasonCode: "ALLOWED", allowedFields: [...requestedFields] };
}
