import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sqlClient } from '@/lib/db';

/**
 * Production Migration Script
 * Executes all pending Drizzle ORM migrations onto the active database.
 */
async function runMigrations() {
  console.log('🏗️ Applying database migrations...');
  
  try {
    // Requires Drizzle configured to output to db/migrations
    await migrate(sqlClient, { migrationsFolder: './db/migrations' });
    console.log('✅ Migrations applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed to apply:');
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigrations();
