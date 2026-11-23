import "server-only";

import registry from "@/config/ui/lib.operational-module-registry.json";
import { OPERATIONAL_MODULES, type OperationalModuleConfig } from "@/server/ops/modules-service";
import { HttpError } from "@/server/platform/http";

/**
 * Where an operational module (registry screen) keeps its records, and which permissions guard it.
 * Table modules use a generic tenant table (id, tenant_id, employee_id, status, attributes, timestamps);
 * service modules are event-sourced in audit_events through src/server/ops/modules-service.
 * A module with neither has no storage: callers get 404 instead of a fabricated record.
 */

/** Explicit allow-list: moduleId -> SQL table name. Never derive an identifier from user input. */
export const MODULE_TABLES: Readonly<Record<string, string>> = {
  document_vault: "document_vault",
  probation_confirmation: "probation_confirmation",
  resignation_exit: "resignation_exit",
  attendance_detail: "attendance_detail",
  shift_master: "shift_master",
  location_master: "location_master",
  roster_schedule: "roster_schedule",
  leave_policy_admin: "leave_policy_admin",
  compensatory_off: "compensatory_off",
  leave_encashment: "leave_encashment",
  tax_declarations: "tax_declarations",
  bank_disbursement: "bank_disbursement",
  gl_mapping: "gl_mapping",
  reconciliation: "reconciliation_table",
  reimbursement_claim: "reimbursement_claim",
  salary_advance: "salary_advance",
  clearance_board: "clearance_board",
  rule_pack_manager: "rule_pack_manager",
  golden_case_library: "golden_case_library",
  contractor_invoice: "contractor_invoice",
  statutory_register: "statutory_register",
  requisitions: "job_requisitions",
  performance_reviews: "performance_reviews",
  learning_paths: "learning_paths",
  contractor_workforce: "contractor_workforce",
  project_workforce: "project_workforce",
  assistant_helpdesk: "helpdesk_tickets",
  helpdesk_ticket: "helpdesk_tickets",
};

/** Read permission per table module when modules-service has no entry for it. */
const TABLE_READ_PERMISSION: Readonly<Record<string, string>> = {
  attendance_detail: "attendance.read",
  shift_master: "attendance.read",
  roster_schedule: "attendance.read",
  compensatory_off: "leave.read",
  leave_encashment: "leave.read",
  leave_policy_admin: "leave.read",
  tax_declarations: "payroll.read",
  bank_disbursement: "payroll.read",
  gl_mapping: "payroll.read",
  reconciliation: "payroll.read",
  reimbursement_claim: "payroll.read",
  salary_advance: "payroll.read",
  rule_pack_manager: "payroll.read",
  golden_case_library: "payroll.read",
  contractor_invoice: "payroll.read",
};

/** Write permission that pairs with each read permission (all are seeded in db/migrations). */
const WRITE_FOR_READ: Readonly<Record<string, string>> = {
  "employee.read": "employee.write",
  "attendance.read": "attendance.write",
  "leave.read": "leave.maintain",
  "payroll.read": "payroll.run",
  "compliance.read": "compliance.filing",
};

export type ModuleStore =
  | { kind: "table"; moduleId: string; table: string; read: string; write: string; service: OperationalModuleConfig | null }
  | { kind: "service"; moduleId: string; read: string; write: string; service: OperationalModuleConfig };

type RegistryModule = { id: string; states?: string[] };

export function moduleStates(moduleId: string): string[] {
  const found = (registry.modules as RegistryModule[]).find((item) => item.id === moduleId);
  return Array.isArray(found?.states) ? found.states : [];
}

export function resolveModuleStore(moduleId: string): ModuleStore {
  const service = Object.hasOwn(OPERATIONAL_MODULES, moduleId) ? OPERATIONAL_MODULES[moduleId] : null;
  const table = Object.hasOwn(MODULE_TABLES, moduleId) ? MODULE_TABLES[moduleId] : null;
  const read = service?.permission || (table ? TABLE_READ_PERMISSION[moduleId] : undefined) || "employee.read";
  const write = WRITE_FOR_READ[read] ?? "employee.write";
  if (table) return { kind: "table", moduleId, table, read, write, service };
  if (service) return { kind: "service", moduleId, read, write, service };
  throw new HttpError({ status: 404, code: "MODULE_NOT_FOUND", message: `No record store is configured for module '${moduleId}'.` });
}

/** Postgres undefined_table: the generic table was never provisioned in this database. */
export function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "42P01";
}
