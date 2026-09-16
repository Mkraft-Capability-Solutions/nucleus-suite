import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const configuration = readRuntimeConfiguration();
  const client = neon(configuration.migrationDatabaseUrl!);

  console.log("=== TENANTS ===");
  const tenants = await client`SELECT id, name, slug, legal_name, created_at FROM tenants ORDER BY created_at`;
  console.log(JSON.stringify(tenants, null, 2));

  console.log("\n=== USERS & MEMBERSHIPS ===");
  const users = await client`
    SELECT 
      u.id as user_id, 
      u.name as user_name, 
      u.email, 
      u.status as user_status,
      t.slug as tenant_slug,
      t.name as tenant_name,
      m.id as membership_id,
      m.role as member_role,
      e.id as employee_id,
      e.employee_code,
      e.designation,
      e.department
    FROM "user" u
    LEFT JOIN memberships m ON m.user_id = u.id
    LEFT JOIN tenants t ON t.id = m.tenant_id
    LEFT JOIN employees e ON e.id = m.employee_id
    ORDER BY t.slug NULLS LAST, e.employee_code NULLS LAST, u.email
  `;
  console.log(JSON.stringify(users, null, 2));

  console.log("\n=== TABLE LIVE TUPLE COUNTS ===");
  const stats = await client`
    SELECT relname as table_name, n_live_tup as count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC, relname ASC
  `;
  
  const populated = (stats as Array<{ table_name: string; count: number }>).filter(s => s.count > 0);
  const empty = (stats as Array<{ table_name: string; count: number }>).filter(s => s.count === 0);

  console.log(`Total public tables tracked: ${stats.length}`);
  console.log(`Tables with rows (${populated.length}):`);
  for (const p of populated) {
    console.log(`  ${p.table_name}: ${p.count}`);
  }
  console.log(`\nEmpty tables count: ${empty.length}`);
  console.log("Empty tables:", empty.map(e => e.table_name).join(", "));
}

main().catch(console.error);
