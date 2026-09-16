import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";
import { TENANT_ID } from "./seeder/types";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const configuration = readRuntimeConfiguration();
  const client = neon(configuration.migrationDatabaseUrl!);

  console.log(`Checking existing data for target tenant: ${TENANT_ID}`);

  // Fetch all tables and columns in 1 query
  const columns = await client`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
  `;

  const tablesWithTenant = new Set<string>();
  const allTables = new Set<string>();

  for (const row of columns as Array<{ table_name: string; column_name: string }>) {
    allTables.add(row.table_name);
    if (row.column_name === "tenant_id") {
      tablesWithTenant.add(row.table_name);
    }
  }

  const tableList = [...allTables].sort();

  // Run in chunks of 20 parallel queries
  const chunkSize = 20;
  const populatedForTenant: Array<{ table: string; count: number }> = [];
  const populatedGlobal: Array<{ table: string; count: number }> = [];
  const emptyTables: string[] = [];

  for (let i = 0; i < tableList.length; i += chunkSize) {
    const chunk = tableList.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (t) => {
        const hasTenant = tablesWithTenant.has(t);
        try {
          const sql = hasTenant
            ? `SELECT count(*)::int as count FROM "${t}" WHERE tenant_id = '${TENANT_ID}'`
            : `SELECT count(*)::int as count FROM "${t}"`;
          const res = await client.query(sql);
          const count = (res as Array<{ count: number }>)[0]?.count ?? 0;
          if (count > 0) {
            if (hasTenant) {
              populatedForTenant.push({ table: t, count });
            } else {
              populatedGlobal.push({ table: t, count });
            }
          } else {
            emptyTables.push(t);
          }
        } catch (err: unknown) {
          console.error(`Error on ${t}:`, (err as { message: string }).message);
        }
      })
    );
  }

  console.log(`\n=== POPULATED FOR TARGET TENANT (${populatedForTenant.length}) ===`);
  for (const p of populatedForTenant.sort((a, b) => b.count - a.count)) {
    console.log(`  ${p.table}: ${p.count}`);
  }

  console.log(`\n=== POPULATED GLOBAL TABLES (${populatedGlobal.length}) ===`);
  for (const p of populatedGlobal.sort((a, b) => b.count - a.count)) {
    console.log(`  ${p.table}: ${p.count}`);
  }

  console.log(`\n=== EMPTY TABLES FOR TARGET TENANT (${emptyTables.length}) ===`);
  console.log(emptyTables.sort().join(", "));
}

main().catch(console.error);
