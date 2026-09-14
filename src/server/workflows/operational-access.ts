import { enforce, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export function operationalScope(access: Access, permission: string, verb: "read" | "write" | "approve"): "all" | "self" | "team" {
  const full = permission + "." + verb;
  const team = permission + ".team." + verb;
  const self = permission + ".self." + verb;
  const selected = access.context.permissions.includes(full) ? full : verb !== "write" && access.context.permissions.includes(team) ? team : verb !== "approve" && access.context.permissions.includes(self) ? self : full;
  enforce(access.context, selected, { tenantId: access.tenantId });
  const scope = selected === full ? "all" : selected === team ? "team" : "self";
  if (scope !== "all" && !access.context.employeeId) throw new HttpError({ status: 403, code: "EMPLOYEE_LINK_REQUIRED", message: "Link this account to its employee profile before using self-service or team workflows." });
  return scope;
}
