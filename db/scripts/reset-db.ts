import { sqlClient } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';

/**
 * Development ONLY Script
 * Force-drops the public schema, cascading all tables and relationships,
 * and recreates a blank slate.
 */
async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ FATAL: Cannot run reset-db in a production environment.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  rl.question('⚠️ WARNING: This will WIPE the entire local database. Type "YES" to proceed: ', async (answer) => {
    if (answer !== 'YES') {
      console.log('Abort.');
      process.exit(0);
    }
    
    console.log('🗑️ Resetting database schema...');
    try {
      await sqlClient.execute(sql`DROP SCHEMA public CASCADE;`);
      await sqlClient.execute(sql`CREATE SCHEMA public;`);
      console.log('✅ Database reset complete. The schema is now empty.');
    } catch (err) {
      console.error('❌ Failed to reset schema:');
      console.error(err);
      process.exit(1);
    } finally {
      rl.close();
      process.exit(0);
    }
  });
}

resetDatabase();
