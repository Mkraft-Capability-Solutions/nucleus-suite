import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as postgresMigrate } from 'drizzle-orm/node-postgres/migrator';
import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { migrate as neonMigrate } from 'drizzle-orm/neon-http/migrator';
import { migrationConfigurationProblems, readRuntimeConfiguration } from '../src/lib/runtime-config';
import { verifyMigrationFiles, verifyAppliedMigrationHashes } from './database/migration-files';

config({ path: [process.env.NUCLEUS_ENV_FILE || '.env.local', '.env'], quiet: true });
async function main() {
    verifyMigrationFiles();
    if (!['neon', 'postgres'].includes(process.env.MIGRATION_DATABASE_DRIVER || 'neon')) throw new Error('Unsupported migration database driver.');
    const configuration = readRuntimeConfiguration();
    const problems = migrationConfigurationProblems(configuration);
    if (problems.length) throw new Error(problems.join('; '));
    if (process.env.MIGRATION_DATABASE_DRIVER === 'postgres') {
        const pool = new Pool({ connectionString: configuration.migrationDatabaseUrl, max: 1, connectionTimeoutMillis: 10000 });
        try {
            const exists = (await pool.query("select to_regclass('drizzle.__drizzle_migrations') as relation")).rows[0].relation;
            if (exists) await verifyAppliedMigrationHashes((await pool.query('select hash,created_at from drizzle.__drizzle_migrations')).rows);
            await postgresMigrate(postgresDrizzle(pool), { migrationsFolder: './db/migrations' });
        }
        finally { await pool.end(); }
    } else {
        const client = neon(configuration.migrationDatabaseUrl!);
        const [exists] = await client`select to_regclass('drizzle.__drizzle_migrations') as relation`;
        if (exists.relation) await verifyAppliedMigrationHashes(await client`select hash,created_at from drizzle.__drizzle_migrations` as Array<{hash:string;created_at:string}>);
        await neonMigrate(neonDrizzle(client), { migrationsFolder: './db/migrations' });
    }
    console.info('Nucleus database migrations applied successfully.');
}
void main().catch((error: unknown) => {
    // Connection details and SQL parameter values must never reach logs.
    const cause = (error as { cause?: { code?: string } })?.cause;
    console.error('Migration failed. Inspect configuration or database constraints.', cause?.code || 'MIGRATION_ERROR');
    process.exitCode = 1;
});
