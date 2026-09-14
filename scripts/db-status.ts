import { Pool } from "pg";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

async function main() {
  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const sqlQuery = `
    select
      (select count(*)::int from drizzle.__drizzle_migrations) as migrations,
      (select count(*)::int from information_schema.tables where table_schema = 'public') as tables,
      (select count(*)::int from pg_class where relrowsecurity) as rls_tables,
      (select count(*)::int from "user") as users,
      (select count(*)::int from tenants) as tenants,
      (select count(*)::int from permissions where status = 'active') as active_permissions
  `;

  if (process.env.MIGRATION_DATABASE_DRIVER === 'postgres' || configuration.migrationDatabaseUrl?.startsWith('postgres://') || configuration.migrationDatabaseUrl?.startsWith('postgresql://')) {
    const pool = new Pool({ connectionString: configuration.migrationDatabaseUrl, max: 1, connectionTimeoutMillis: 10000 });
    try {
      const res = await pool.query(sqlQuery);
      console.info(JSON.stringify(res.rows[0], null, 2));
    } finally {
      await pool.end();
    }
  } else {
    const client = neon(configuration.migrationDatabaseUrl!);
    const [summary] = await client`
      select
        (select count(*)::int from drizzle.__drizzle_migrations) as migrations,
        (select count(*)::int from information_schema.tables where table_schema = 'public') as tables,
        (select count(*)::int from pg_class where relrowsecurity) as rls_tables,
        (select count(*)::int from "user") as users,
        (select count(*)::int from tenants) as tenants,
        (select count(*)::int from permissions where status = 'active') as active_permissions
    `;
    console.info(JSON.stringify(summary, null, 2));
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database status check failed");
  process.exitCode = 1;
});