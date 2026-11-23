/**
 * Fills every empty tenant-scoped table with linked demo records, per tenant that has employees.
 *
 *   npx tsx scripts/demo/seed-fill-gaps.ts            # dry run: everything inside one transaction, rolled back
 *   npx tsx scripts/demo/seed-fill-gaps.ts --apply    # commit
 *
 * Guarantees:
 *  - No duplicates: a table is skipped for a tenant that already has any row in it, so re-running is a no-op.
 *  - Referential integrity: every foreign key points at a real row of the same tenant. A table whose
 *    required parent has no rows is skipped (no leave without an employee, no payslip without a run).
 *    Tables are retried in passes, so a parent filled earlier in the run unlocks its children.
 *  - Names: rows carry readable names/titles (domain vocabularies where known, the linked employee's
 *    name where the row belongs to an employee) and dossier tables use the app's own picklist values.
 * Each table is inserted under a savepoint; a table the generator cannot satisfy is reported, not fatal.
 * All identities are fictitious. Reads MIGRATION_DATABASE_URL from the environment only.
 */
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { dossierResources } from "../../src/lib/dossier-catalog";
import type { Field } from "../../src/lib/workflow-catalog";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

const APPLY = process.argv.includes("--apply");
const TODAY = new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

let seed = 20261123;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(items: readonly T[], index: number): T => items[index % items.length] as T;

/* ------------------------------------------------------------------ */
/* Vocabularies                                                        */
/* ------------------------------------------------------------------ */

const NAMES: Record<string, string[]> = {
  holiday_calendars: ["India national holidays", "Maharashtra state holidays", "Karnataka state holidays"],
  holidays: ["Republic Day", "Holi", "Independence Day", "Gandhi Jayanti", "Diwali", "Christmas", "Eid al-Fitr", "Ganesh Chaturthi"],
  leave_policies: ["Standard leave policy", "Factory workers leave policy", "Trainee leave policy"],
  shifts: ["General shift", "Morning shift", "Evening shift", "Night shift"],
  shift_master: ["General 09:00–18:00", "First 06:00–14:00", "Second 14:00–22:00", "Third 22:00–06:00"],
  work_schedules: ["Five-day week", "Six-day week", "Rotational roster"],
  skills: ["Python", "SQL", "Project management", "Lean manufacturing", "Financial analysis", "Negotiation", "Data visualisation", "People leadership"],
  skill_ontologies: ["Enterprise skills taxonomy"],
  courses: ["Workplace safety essentials", "POSH awareness", "Data privacy basics", "Leadership foundations"],
  certifications: ["ISO 9001 Lead Auditor", "PMP", "Six Sigma Green Belt", "AWS Cloud Practitioner"],
  teams: ["Platform engineering", "Plant operations", "Talent acquisition", "Finance operations"],
  cost_centers: ["CC-1001 Corporate", "CC-2001 Manufacturing", "CC-3001 Sales", "CC-4001 Shared services"],
  job_families: ["Engineering", "Operations", "Finance", "Human resources", "Sales"],
  benefit_plans: ["Group medical insurance", "Group term life", "Meal card", "National Pension System"],
  pay_components: ["Basic", "House rent allowance", "Special allowance", "Conveyance", "Provident fund", "Professional tax"],
  salary_structures: ["Staff structure", "Worker structure", "Management structure"],
  document_types: ["PAN card", "Aadhaar card", "Passport", "Offer letter", "Relieving letter", "Degree certificate"],
  letter_templates: ["Offer letter", "Appointment letter", "Confirmation letter", "Experience letter"],
  notification_templates: ["Leave approved", "Payslip published", "Policy acknowledgement due", "Document expiring"],
  recognition_programs: ["Spot award", "Quarterly excellence", "Peer kudos"],
  surveys: ["Quarterly engagement pulse", "Onboarding experience", "Hybrid work survey"],
  induction_programs: ["New joiner induction", "Plant safety induction"],
  onboarding_templates: ["Corporate onboarding", "Plant onboarding"],
  review_templates: ["Annual performance review", "Probation review"],
  workflow_definitions: ["Leave approval", "Expense approval", "Requisition approval", "Exit clearance"],
  overtime_policies: ["Factories Act overtime", "Staff overtime"],
  gate_pass_policies: ["Visitor gate pass", "Material gate pass"],
  compensation_cycles: ["FY annual increment cycle", "Mid-year correction cycle"],
  manpower_plans: ["FY manpower plan"],
  succession_plans: ["Plant head succession", "Finance controller succession"],
  learning_paths: ["Manager essentials", "Engineering onboarding"],
  knowledge_sources: ["HR policy handbook", "Statutory compliance manual"],
  integration_catalog: ["Tally Prime", "SAP S/4HANA", "Biometric gateway", "Google Workspace"],
  gl_accounts: ["5001 Salaries and wages", "5002 Employer PF", "2101 Salary payable", "2102 PF payable"],
  worker_categories: ["Staff", "Worker", "Trainee", "Contract"],
  job_descriptions: ["Software engineer", "Production supervisor", "HR business partner", "Accounts executive"],
  job_postings: ["Senior software engineer", "Quality inspector", "Payroll specialist"],
  retention_policies: ["Payroll records — 8 years", "Candidate data — 2 years"],
  metric_definitions: ["Headcount", "Attrition rate", "Absenteeism rate", "Time to hire"],
  scorecards: ["Plant scorecard", "Corporate scorecard"],
  workforce_scenarios: ["Expansion plan", "Cost optimisation"],
  biometric_devices: ["Main gate reader", "Plant entry reader", "Office lobby reader"],
  statutory_forms: ["Form 12 adult worker register", "Form 25 muster roll", "Form B wage register"],
  enrollment_windows: ["Annual benefits enrollment"],
  prompt_versions: ["Assistant system prompt v1"],
  agent_tools: ["workforce_analysis", "leave_balance_lookup", "policy_search"],
  feed_audiences: ["All employees", "Managers", "Plant staff"],
  announcements: ["Annual day celebration", "New leave policy effective next month", "Quarterly town hall", "Health check-up camp"],
};

const STATUS_PREFERENCE = ["active", "approved", "completed", "published", "open", "submitted", "draft", "pending"];

/* ------------------------------------------------------------------ */
/* Schema introspection                                                */
/* ------------------------------------------------------------------ */

type Column = { name: string; type: string; udt: string; nullable: boolean; hasDefault: boolean };
type ForeignKey = { columns: string[]; refTable: string; refColumns: string[] };
type Table = { name: string; columns: Column[]; fks: ForeignKey[]; checks: Map<string, string[]>; jsonArrays: Set<string> };

async function loadSchema(client: PoolClient): Promise<Map<string, Table>> {
  const cols = await client.query<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; is_generated: string; is_identity: string }>(
    `select table_name, column_name, data_type, udt_name, is_nullable, column_default, is_generated, is_identity
       from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
  const tables = new Map<string, Table>();
  for (const c of cols.rows) {
    if (c.is_generated === "ALWAYS") continue;
    const table = tables.get(c.table_name) ?? { name: c.table_name, columns: [], fks: [], checks: new Map(), jsonArrays: new Set() };
    table.columns.push({ name: c.column_name, type: c.data_type, udt: c.udt_name, nullable: c.is_nullable === "YES", hasDefault: c.column_default !== null || c.is_identity === "YES" });
    tables.set(c.table_name, table);
  }
  const base = await client.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
  const baseNames = new Set(base.rows.map((r) => r.table_name));
  for (const name of [...tables.keys()]) if (!baseNames.has(name)) tables.delete(name);

  const fks = await client.query<{ tbl: string; cols: string[]; reftbl: string; refcols: string[] }>(
    `select c.conrelid::regclass::text tbl, c.confrelid::regclass::text reftbl,
            array(select a.attname::text from unnest(c.conkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.o) cols,
            array(select a.attname::text from unnest(c.confkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.o) refcols
       from pg_constraint c join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`);
  for (const fk of fks.rows) tables.get(fk.tbl.replace(/"/g, ""))?.fks.push({ columns: fk.cols, refTable: fk.reftbl.replace(/"/g, ""), refColumns: fk.refcols });

  const checks = await client.query<{ tbl: string; def: string }>(
    `select c.conrelid::regclass::text tbl, pg_get_constraintdef(c.oid) def from pg_constraint c join pg_namespace n on n.oid = c.connamespace where c.contype = 'c' and n.nspname = 'public'`);
  for (const check of checks.rows) {
    const table = tables.get(check.tbl.replace(/"/g, ""));
    if (!table) continue;
    const anyArray = /\(?\(?(\w+)\)?(?:::text)?\s*=\s*ANY\s*\(\(?ARRAY\[(.+?)\]/.exec(check.def);
    if (anyArray) {
      const values = [...anyArray[2]!.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
      if (values.length) table.checks.set(anyArray[1]!, values);
    }
    const inList = /\((\w+) IN \((.+?)\)\)/.exec(check.def);
    if (inList) table.checks.set(inList[1]!, [...inList[2]!.matchAll(/'([^']*)'/g)].map((m) => m[1]!));
    const arrayType = /jsonb_typeof\((\w+)\) = 'array'/.exec(check.def);
    if (arrayType) table.jsonArrays.add(arrayType[1]!);
  }
  return tables;
}

/* ------------------------------------------------------------------ */
/* Value generation                                                    */
/* ------------------------------------------------------------------ */

const humanize = (table: string) => table.replace(/_/g, " ").replace(/s$/, "").replace(/^./, (c) => c.toUpperCase());

type Employee = { id: string; code: string; name: string; email: string | null; department: string; designation: string; location: string };
type Context = { tenantId: string; employees: Employee[]; membershipId: string | null; userId: string | null };

function fieldValue(field: Field, index: number, employee: Employee | undefined): unknown {
  const name = field.name ?? "";
  if (field.options?.length) return field.default ?? pick(field.options, index);
  if (field.kind === "boolean") return field.default ?? index % 2 === 0;
  if (field.kind === "number") return field.default ?? Math.round((field.min ?? 0) + random() * Math.min(field.max ?? 100, 100));
  if (field.kind === "array") return field.default ?? (field.item?.options ? [pick(field.item.options, index)] : []);
  if (field.format === "date") return /to$|end/i.test(name) ? null : /birth/i.test(name) ? `19${85 + (index % 12)}-0${1 + (index % 9)}-1${index % 9}` : addDays(-30 * (index + 1));
  if (field.format === "uuid") return /employee/i.test(name) ? employee?.id ?? null : null;
  if (/name$/i.test(name)) return employee ? `${employee.name.split(" ")[0]} ${pick(["Sharma", "Iyer", "Patel", "Rao", "Khan"], index)}` : null;
  if (/phone|mobile/i.test(name)) return `+91 98${String(20000000 + index * 7919).slice(0, 8)}`;
  if (/email/i.test(name)) return employee?.email ?? null;
  if (/city/i.test(name)) return employee?.location ?? "Mumbai";
  if (/postal/i.test(name)) return `4000${10 + index}`;
  if (/currency/i.test(name)) return "INR";
  if (/bank/i.test(name)) return pick(["HDFC Bank", "State Bank of India", "ICICI Bank"], index);
  if (/account/i.test(name)) return `XXXXXX${String(1000 + index * 37).slice(-4)}`;
  if (/routing|ifsc/i.test(name)) return pick(["HDFC0000123", "SBIN0001234", "ICIC0000456"], index);
  if (/address|value/i.test(name)) return `${12 + index}, MG Road, ${employee?.location ?? "Mumbai"}`;
  return field.optional ? null : `${humanize(name)} ${index + 1}`;
}

function attributesFor(table: Table, index: number, employee: Employee | undefined): Record<string, unknown> {
  const dossier = Object.values(dossierResources).find((resource) => resource.table === table.name);
  const attributes: Record<string, unknown> = {};
  if (dossier) {
    for (const field of dossier.fields) {
      if (!field.name || field.name === "employeeId") continue;
      const value = fieldValue(field, index, employee);
      if (value !== null) attributes[field.name] = value;
    }
  }
  const vocabulary = NAMES[table.name];
  const label = vocabulary ? pick(vocabulary, index) : employee ? `${humanize(table.name)} — ${employee.name}` : `${humanize(table.name)} ${index + 1}`;
  if (!("name" in attributes)) attributes.name = label;
  attributes.title ??= label;
  attributes.code ??= `${table.name.split("_").map((w) => w[0]).join("").toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
  attributes.description ??= employee ? `${label} (${employee.code}, ${employee.department})` : label;
  attributes.effectiveFrom ??= addDays(-90 - index * 7);
  attributes.status ??= "active";
  if (employee) Object.assign(attributes, { employeeName: employee.name, employeeCode: employee.code, department: employee.department });
  attributes.demo = true;
  return attributes;
}

function columnValue(table: Table, column: Column, index: number, employee: Employee | undefined, ctx: Context): unknown {
  const allowed = table.checks.get(column.name);
  if (allowed?.length) {
    const preferred = STATUS_PREFERENCE.find((s) => allowed.includes(s));
    return /status/.test(column.name) && preferred ? preferred : pick(allowed, index);
  }
  const n = column.name;
  if (column.type === "jsonb" || column.type === "json") return JSON.stringify(table.jsonArrays.has(n) ? [] : {});
  if (column.type === "ARRAY") return "{}";
  if (column.type === "boolean") return index % 3 !== 0;
  if (column.type === "uuid") return null;
  if (column.type === "date") return /end|to$|until|expir|due/.test(n) ? addDays(30 + index * 15) : addDays(-60 - index * 7);
  if (column.type.startsWith("timestamp")) return new Date(Date.now() - (index + 1) * 3_600_000 * 24).toISOString();
  if (column.type.startsWith("time")) return pick(["09:00", "14:00", "22:00"], index);
  if (["integer", "bigint", "smallint"].includes(column.type)) return /year/.test(n) ? 2026 : /month/.test(n) ? 1 + (index % 12) : /minor|amount|salary|cost/.test(n) ? 2_500_000 + index * 125_000 : 1 + index;
  if (column.type === "numeric" || column.type === "double precision" || column.type === "real") return /percent|rate|score/.test(n) ? 70 + (index % 25) : 1 + index;
  if (column.type === "inet") return "10.0.0.1";
  // text
  if (/email/.test(n)) return employee?.email ?? `demo${index + 1}@example.com`;
  if (/^user_id$|_user_id$/.test(n)) return ctx.userId ?? `demo-user-${index + 1}`;
  if (/currency/.test(n)) return "INR";
  if (/country/.test(n)) return "IN";
  if (/locale|language/.test(n)) return "en";
  if (/timezone/.test(n)) return "Asia/Kolkata";
  if (/hash|checksum|digest/.test(n)) return `demo${table.name}${index}`.padEnd(64, "0").slice(0, 64);
  if (/(^|_)(key|code|slug|reference|number|tag|external_id)$/.test(n)) return `${table.name.slice(0, 6).toUpperCase()}-${String(index + 1).padStart(4, "0")}`;
  if (/(^|_)(name|title|label)$/.test(n)) return NAMES[table.name] ? pick(NAMES[table.name]!, index) : employee ? `${humanize(table.name)} — ${employee.name}` : `${humanize(table.name)} ${index + 1}`;
  if (/status|state|stage/.test(n)) return "active";
  if (/period/.test(n)) return TODAY.slice(0, 7);
  return `${humanize(n)} ${index + 1}`;
}

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

const SKIP = new Set(["tenants", "idempotency_keys", "transactional_outbox", "audit_events", "audit_event_changes", "access_events", "session", "account", "user", "verification",
  "ai_graph_checkpoint_blobs", "ai_graph_checkpoint_writes", "ai_graph_checkpoints", "integration_secrets", "api_keys", "webhook_deliveries", "inbound_events", "export_jobs", "file_imports", "import_rows"]);

const parentCache = new Map<string, Record<string, unknown>[]>();
const forgetParents = (tenantId: string, table: string) => {
  for (const key of [...parentCache.keys()]) if (key.startsWith(`${tenantId}|${table}|`)) parentCache.delete(key);
};
async function parentIds(client: PoolClient, fk: ForeignKey, tenantId: string, tables: Map<string, Table>): Promise<Record<string, unknown>[]> {
  const cacheKey = `${tenantId}|${fk.refTable}|${fk.refColumns.join(",")}`;
  const cached = parentCache.get(cacheKey);
  if (cached) return cached;
  const ref = tables.get(fk.refTable);
  const refCols = fk.refColumns.map((c) => `"${c}"`).join(", ");
  const tenantScoped = ref?.columns.some((c) => c.name === "tenant_id");
  const where = tenantScoped ? `where tenant_id::text = $1::text` : "";
  const result = await client.query(`select ${refCols} from "${fk.refTable}" ${where} order by 1 limit 50`, tenantScoped ? [tenantId] : []);
  parentCache.set(cacheKey, result.rows);
  return result.rows;
}

async function seedTable(client: PoolClient, table: Table, ctx: Context, tables: Map<string, Table>): Promise<{ inserted: number; reason?: string }> {

  const fkByColumn = new Map<string, { fk: ForeignKey; rows: Record<string, unknown>[] }>();
  for (const fk of table.fks) {
    const ownCols = fk.columns.filter((c) => c !== "tenant_id");
    if (ownCols.length === 0) continue;
    if (fk.refTable === table.name) continue; // self-reference stays null
    const required = ownCols.some((c) => !table.columns.find((col) => col.name === c)?.nullable);
    const rows = await parentIds(client, fk, ctx.tenantId, tables);
    if (rows.length === 0) {
      if (required) return { inserted: 0, reason: `no ${fk.refTable}` };
      continue;
    }
    for (const c of ownCols) fkByColumn.set(c, { fk, rows });
  }

  const employeeFk = [...fkByColumn.entries()].find(([c, v]) => v.fk.refTable === "employees" && /^employee_id$/.test(c));
  const driver = employeeFk ?? [...fkByColumn.entries()].find(([c]) => !table.columns.find((col) => col.name === c)?.nullable);
  const count = driver ? Math.min(driver[1].rows.length, employeeFk ? 12 : 8) : (NAMES[table.name]?.length ?? 5);

  const built: Record<string, unknown>[] = [];
  for (let index = 0; index < count; index++) {
    const row: Record<string, unknown> = { tenant_id: ctx.tenantId };
    const fkRowIndex = (column: string) => (driver && driver[0] === column ? index : index % (fkByColumn.get(column)?.rows.length ?? 1));
    for (const [column, { fk, rows }] of fkByColumn) {
      const parent = rows[fkRowIndex(column)]!;
      const position = fk.columns.indexOf(column);
      row[column] = parent[fk.refColumns[position]!];
    }
    const employeeId = row.employee_id as string | undefined;
    const employee = ctx.employees.find((e) => e.id === employeeId);
    for (const column of table.columns) {
      if (column.name in row) continue;
      if (column.name === "attributes" && (column.type === "jsonb")) { row.attributes = JSON.stringify(attributesFor(table, index, employee)); continue; }
      if (/membership_id$/.test(column.name) && !column.nullable && ctx.membershipId) { row[column.name] = ctx.membershipId; continue; }
      if (column.hasDefault || column.nullable) {
        if (column.nullable && !column.hasDefault && column.type !== "uuid" && /name|title|description|notes|reason|label|summary/.test(column.name)) row[column.name] = columnValue(table, column, index, employee, ctx);
        continue;
      }
      row[column.name] = columnValue(table, column, index, employee, ctx);
    }
    for (const [column, values] of table.checks) if (column in row === false && table.columns.find((c) => c.name === column)?.hasDefault && /status/.test(column)) {
      const preferred = STATUS_PREFERENCE.find((s) => values.includes(s));
      if (preferred) row[column] = preferred;
    }
    built.push(row);
  }
  const insertRows = async (rows: Record<string, unknown>[]) => {
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const values: unknown[] = [];
    const tuples = rows.map((r) => `(${columns.map((c) => { if (!(c in r)) return "default"; values.push(r[c]); return `$${values.length}`; }).join(", ")})`);
    await client.query(`insert into "${table.name}" (${columns.map((c) => `"${c}"`).join(", ")}) values ${tuples.join(", ")}`, values);
  };
  await client.query("savepoint batch_insert");
  try {
    await insertRows(built);
    await client.query("release savepoint batch_insert");
    forgetParents(ctx.tenantId, table.name);
    return { inserted: built.length };
  } catch (error) {
    await client.query("rollback to savepoint batch_insert");
    let inserted = 0;
    let lastError = (error as Error).message;
    for (const row of built) {
      await client.query("savepoint row_insert");
      try { await insertRows([row]); await client.query("release savepoint row_insert"); inserted++; }
      catch (rowError) { await client.query("rollback to savepoint row_insert"); lastError = (rowError as Error).message; }
    }
    forgetParents(ctx.tenantId, table.name);
    return inserted > 0 ? { inserted } : { inserted: 0, reason: lastError.slice(0, 160) };
  }
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required.");
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  const summary: Record<string, { inserted: number; skipped: string[] }> = {};
  try {
    const tables = await loadSchema(client);
    await client.query("begin");
    const tenantTables = [...tables.values()].filter((t) => !SKIP.has(t.name) && t.columns.some((c) => c.name === "tenant_id"));
    const tenants = await client.query<{ id: string; slug: string }>(`select t.id, t.slug from tenants t where exists (select 1 from employees e where e.tenant_id = t.id) order by t.slug`);
    for (const tenant of tenants.rows) {
      const employees = (await client.query<Employee>(
        `select id, employee_code code, first_name || ' ' || last_name as name, work_email email, department, designation, location
           from employees where tenant_id = $1 order by employee_code`, [tenant.id])).rows;
      const membership = (await client.query<{ id: string; user_id: string }>(`select id, user_id from memberships where tenant_id = $1 order by created_at limit 1`, [tenant.id])).rows[0];
      const ctx: Context = { tenantId: tenant.id, employees, membershipId: membership?.id ?? null, userId: membership?.user_id ?? null };
      const filled = await client.query<{ t: string }>(tenantTables.map((t) => `select '${t.name}' t where exists (select 1 from "${t.name}" where tenant_id::text = $1::text)`).join(" union all "), [tenant.id]);
      const hasData = new Set(filled.rows.map((r) => r.t));
      const pending = new Set(tenantTables.map((t) => t.name).filter((n) => !hasData.has(n)));
      const reasons = new Map<string, string>();
      let inserted = 0;
      for (let pass = 0; pass < 6 && pending.size > 0; pass++) {
        let progressed = false;
        for (const name of [...pending]) {
          await client.query("savepoint table_seed");
          try {
            const result = await seedTable(client, tables.get(name)!, ctx, tables);
            await client.query("release savepoint table_seed");
            if (result.inserted > 0) { pending.delete(name); progressed ||= result.inserted > 0; inserted += result.inserted; reasons.delete(name); }
            else reasons.set(name, result.reason ?? "no rows");
          } catch (error) {
            await client.query("rollback to savepoint table_seed");
            reasons.set(name, (error as Error).message.slice(0, 140));
          }
        }
        if (!progressed) break;
      }
      summary[tenant.slug] = { inserted, skipped: [...reasons].map(([t, r]) => `${t}: ${r}`) };
      // One transaction per tenant keeps locks short on a live database.
      await client.query(APPLY ? "commit" : "rollback");
      await client.query("begin");
    }
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  for (const [slug, s] of Object.entries(summary)) {
    console.info(`${slug}: ${s.inserted} rows inserted; ${s.skipped.length} tables not filled`);
    for (const line of s.skipped) console.info(`   - ${line}`);
  }
  console.info(APPLY ? "Committed." : "Dry run — rolled back. Pass --apply to commit.");
}

main().catch((error: unknown) => {
  console.error("Gap seeding failed:", (error as Error).message);
  process.exitCode = 1;
});
