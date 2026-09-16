import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import resources from "../src/server/workflows/resources.json";
config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(process.env.DATABASE_URL);
  const tables = Object.values(resources).map(entry => entry[0]);
  const rows = await sql`select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any(${tables}::text[])`;
  const missing = tables.flatMap(table => ["id", "tenant_id", "attributes", "created_at"].filter(column => !rows.some(row => row.table_name === table && row.column_name === column)).map(column => table + "." + column));
  const rls = await sql`select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any(${tables}::text[])`;
  const unscoped = tables.filter(table => !rls.some(row => row.relname === table && row.relrowsecurity && row.relforcerowsecurity));
  console.log(JSON.stringify({ tables: tables.length, missingColumns: missing, missingForcedRls: unscoped }, null, 2));
  if (missing.length || unscoped.length) process.exitCode = 1;
}
void main().catch(() => { console.error("Workflow storage verification could not connect or query the configured database."); process.exitCode = 1; });
