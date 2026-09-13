import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required.");

const client = neon(connectionString);
const migrationPaths = [
  resolve("db/migrations/0014_vp_readiness_completion.sql"),
  resolve("db/migrations/0015_attendance_hierarchy_scope.sql"),
];
let appliedStatements = 0;
for (const migrationPath of migrationPaths) {
  const source = await readFile(migrationPath, "utf8");
  const statements = source.split("--> statement-breakpoint").map((entry) => entry.trim()).filter(Boolean);
  for (const statement of statements) await client.query(statement);
  appliedStatements += statements.length;
}

const expectedTables = [
  "vp_rule_sets",
  "vp_location_grants",
  "vp_attendance_results",
  "vp_erp_records",
  "vp_gl_batches",
  "vp_gl_lines",
  "vp_statutory_instances",
  "vp_manpower_lines",
  "vp_feature_records",
];
const expectedList = expectedTables.map((table) => `'${table}'`).join(", ");
const rawRows = await client.query(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in (${expectedList})
  order by c.relname
`);
const rows = Array.isArray(rawRows) ? rawRows : rawRows.rows;
const missingTables = expectedTables.filter((table) => !rows.some((row) => row.table_name === table));
const insecureTables = rows.filter((row) => !row.rls_enabled || !row.rls_forced).map((row) => row.table_name);
if (missingTables.length || insecureTables.length) {
  throw new Error(`VP migration verification failed. Missing: ${missingTables.join(", ") || "none"}; RLS gaps: ${insecureTables.join(", ") || "none"}.`);
}

const hierarchyRows = await client.query(`
  select count(*)::int as linked_employees
  from employees
  where employee_code like 'E%' and manager_employee_id is not null
`);
const linkedEmployees = Number((Array.isArray(hierarchyRows) ? hierarchyRows : hierarchyRows.rows)[0]?.linked_employees ?? 0);
if (linkedEmployees < 67) throw new Error(`Attendance hierarchy verification failed: only ${linkedEmployees} E-series employees are linked.`);

console.info(`Applied ${migrationPaths.length} readiness migrations (${appliedStatements} statements). Verified ${rows.length} VP tables with forced RLS and ${linkedEmployees} E-series manager links.`);
