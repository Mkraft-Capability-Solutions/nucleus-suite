import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const configuration = readRuntimeConfiguration();
  const client = neon(configuration.migrationDatabaseUrl!);

  // Get all columns for all public tables
  const columns = await client`
    SELECT 
      table_name, 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `;

  const tablesMap: Record<
    string,
    Array<{ column: string; type: string; nullable: boolean; default: unknown }>
  > = {};
  for (const col of columns as Array<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: unknown;
  }>) {
    if (!tablesMap[col.table_name]) {
      tablesMap[col.table_name] = [];
    }
    tablesMap[col.table_name].push({
      column: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === "YES",
      default: col.column_default
    });
  }

  // Get all foreign keys
  const fks = await client`
    SELECT
      tc.table_name as child_table,
      kcu.column_name as child_column,
      ccu.table_name AS parent_table,
      ccu.column_name AS parent_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
  `;

  // Get current row count for all tables
  const counts = await client`
    SELECT relname as table_name, n_live_tup as count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname ASC
  `;

  const summary = {
    totalTables: Object.keys(tablesMap).length,
    tables: tablesMap,
    foreignKeys: fks,
    counts: Object.fromEntries((counts as Array<{ table_name: string; count: number }>).map(c => [c.table_name, c.count]))
  };

  writeFileSync(
    join(process.cwd(), "scripts", "schema-dump.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log(`Successfully dumped schema details for ${summary.totalTables} tables to scripts/schema-dump.json`);
}

main().catch(console.error);
