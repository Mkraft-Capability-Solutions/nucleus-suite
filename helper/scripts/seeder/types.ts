import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

export const TENANT_ID = "0acd3c35-d82b-42b7-8b8f-f45461192e79";

// Excluded users per explicit user instruction (pure admin/superadmin with zero operational records)
export const EXCLUDED_EMAILS = [
  "admin@mkraft.local",
  "demo@mkraft.local",
  "admin@brigtenz.tech",
  "superadmin@brigtenz.tech"
];

export function getClient() {
  const configuration = readRuntimeConfiguration();
  if (!configuration.migrationDatabaseUrl) {
    throw new Error("MIGRATION_DATABASE_URL is required.");
  }
  return neon(configuration.migrationDatabaseUrl);
}

export type DbClient = ReturnType<typeof getClient>;

export const NON_TENANT_TABLES = new Set([
  "account",
  "agent_tools",
  "auth_security_events",
  "countries",
  "currencies",
  "integration_catalog",
  "jurisdictions",
  "permissions",
  "rule_pack_versions",
  "session",
  "statutory_forms",
  "statutory_rule_packs",
  "tenants",
  "user",
  "verification",
]);

export async function hasData(client: DbClient, tableName: string, tenantScoped = true): Promise<boolean> {
  const isScoped = tenantScoped && !NON_TENANT_TABLES.has(tableName);
  const sql = isScoped
    ? `SELECT 1 FROM "${tableName}" WHERE tenant_id = '${TENANT_ID}' LIMIT 1`
    : `SELECT 1 FROM "${tableName}" LIMIT 1`;
  const res = await client.query(sql);
  return res.length > 0;
}

export async function getCount(client: DbClient, tableName: string, tenantScoped = true): Promise<number> {
  const isScoped = tenantScoped && !NON_TENANT_TABLES.has(tableName);
  const sql = isScoped
    ? `SELECT count(*)::int as count FROM "${tableName}" WHERE tenant_id = '${TENANT_ID}'`
    : `SELECT count(*)::int as count FROM "${tableName}"`;
  const res = await client.query(sql);
  return (res as Array<{ count: number }>)[0]?.count ?? 0;
}

export function uuid() {
  return randomUUID();
}

export function dateStr(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function timestampStr(year: number, month: number, day: number, hour = 9, minute = 0, second = 0): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  const s = String(second).padStart(2, "0");
  return `${year}-${m}-${d}T${h}:${min}:${s}+05:30`;
}

export interface RosterItem {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string;
  salaryMinor: number;
  userId: string;
  personId: string;
  employeeId: string;
  employmentId: string;
  membershipId: string;
  positionId: string;
  gradeId: string;
  managerCode: string | null;
}

export interface SeedContext {
  client: DbClient;
  tenantId: string;
  // Shared entities across domains
  legalEntityId: string;
  jurisdictionId: string;
  countryId: string;
  currencyId: string;
  currencyCode: string;
  buHoId: string;
  buPlantId: string;
  departmentIds: Record<string, string>;
  gradeIds: Record<string, string>;
  jobProfileIds: Record<string, string>;
  positionIds: Record<string, string>;
  roleIds: Record<string, string>;
  roster: RosterItem[];
  employeeByCode: Record<string, RosterItem>;
  membershipByCode: Record<string, string>;
  // Master IDs
  leaveTypeIds: Record<string, string>;
  leavePolicyId: string;
  shiftMorningId: string;
  shiftEveningId: string;
  attendancePolicyId: string;
  payGroupId: string;
  salaryStructureId: string;
  payComponentIds: Record<string, string>;
  statutoryRulePackId: string;
  rulePackVersionId: string;
  loanProductId: string;
  // Shared IDs for Talent & Perf
  modelConfigId: string;
  promptVersionId: string;
  skillOntologyId: string;
  skillOntologyVersionId: string;
  skillIds: Record<string, string>;
  reviewCycle2024Id: string;
  reviewCycle2025Id: string;
  reviewCycle2026Id: string;
  reviewTemplateId: string;
  goalCycle2024Id: string;
  goalCycle2025Id: string;
  goalCycle2026Id: string;
  documentTypeIds: Record<string, string>;
  documentIds: Record<string, string>;
  workflowDefIds: Record<string, string>;
  workflowVersionIds: Record<string, string>;
  workflowStepIds: Record<string, string>;
  scheduledTaskIds: Record<string, string>;
  establishmentId: string;
  locationHoId: string;
  locationPlantId: string;
  costCenterId: string;
}

export function createEmptyContext(client: DbClient): SeedContext {
  return {
    client,
    tenantId: TENANT_ID,
    legalEntityId: "",
    jurisdictionId: "",
    countryId: "",
    currencyId: "",
    currencyCode: "INR",
    buHoId: "",
    buPlantId: "",
    departmentIds: {},
    gradeIds: {},
    jobProfileIds: {},
    positionIds: {},
    roleIds: {},
    roster: [],
    employeeByCode: {},
    membershipByCode: {},
    leaveTypeIds: {},
    leavePolicyId: "",
    shiftMorningId: "",
    shiftEveningId: "",
    attendancePolicyId: "",
    payGroupId: "",
    salaryStructureId: "",
    payComponentIds: {},
    statutoryRulePackId: "",
    rulePackVersionId: "",
    loanProductId: "",
    modelConfigId: "",
    promptVersionId: "",
    skillOntologyId: "",
    skillOntologyVersionId: "",
    skillIds: {},
    reviewCycle2024Id: "",
    reviewCycle2025Id: "",
    reviewCycle2026Id: "",
    reviewTemplateId: "",
    goalCycle2024Id: "",
    goalCycle2025Id: "",
    goalCycle2026Id: "",
    documentTypeIds: {},
    documentIds: {},
    workflowDefIds: {},
    workflowVersionIds: {},
    workflowStepIds: {},
    scheduledTaskIds: {},
    establishmentId: "",
    locationHoId: "",
    locationPlantId: "",
    costCenterId: "",
  };
}
