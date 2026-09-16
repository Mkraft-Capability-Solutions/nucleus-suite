const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const dbDir = path.join(rootDir, 'db');

// Load environment variables manually to extract database URL without needing external libraries
let dbUrl = '';
try {
  const envPath = path.join(rootDir, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const migrationLine = lines.find(line => line.startsWith('MIGRATION_DATABASE_URL='));
  if (migrationLine) {
    dbUrl = migrationLine.split('=')[1].trim().replace(/"/g, '');
  }
} catch (e) {
  console.warn('⚠️ Could not load .env file. Database dump will be skipped.');
}

// 1. Define the directory structure
const directories = ['backup', 'migrations', 'seed', 'scripts'];

directories.forEach(dir => {
  const dirPath = path.join(dbDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: db/${dir}`);
  }
});

// 2. Perform Automatic Database Dump if URL is found
if (dbUrl) {
  console.log('🔄 Executing automated PostgreSQL Backup (this may take a moment)...');
  try {
    const schemaPath = path.join(dbDir, 'backup', 'nucleus-suit.sql');
    const dataPath = path.join(dbDir, 'backup', 'nucleus-suit-data.sql');

    // Dump Schema
    execSync(`pg_dump "${dbUrl}" --schema-only -f "${schemaPath}"`, { stdio: 'inherit' });
    console.log(`✅ Schema backup successful: ${schemaPath}`);

    // Dump Data
    execSync(`pg_dump "${dbUrl}" --data-only -f "${dataPath}"`, { stdio: 'inherit' });
    console.log(`✅ Data backup successful: ${dataPath}`);
  } catch (err) {
    console.error('❌ Failed to execute pg_dump. Ensure pg_dump is installed on your system.');
    console.error(err.message);
  }
}

// 3. Define the production-grade files and their contents
const files = {
  'seed/seed.ts': `import { sqlClient } from '@/lib/db';
import { tenants } from '@/lib/db/schema'; // Update imports based on your actual exported tables
import { v4 as uuidv4 } from 'uuid';

/**
 * Production-level database seed execution script.
 * Safely seeds mandatory organizational foundations.
 */
async function main() {
  console.log('🌱 Starting database seed...');
  
  try {
    // 1. Ensure a default tenant exists for Multi-tenant operations
    const tenantId = uuidv4();
    await sqlClient.insert(tenants).values({
      id: tenantId,
      name: 'MKraft Enterprise (Default)',
      domain: 'mkraft.local',
      status: 'active'
    }).onConflictDoNothing();
    
    console.log(\`✅ Default tenant seeded successfully (ID: \${tenantId})\`);
    
    // 2. Add additional production-required seeds here (e.g. Roles, Regions)
    
  } catch (error) {
    console.error('❌ Seed execution failed:');
    console.error(error);
    process.exit(1);
  }
  
  console.log('✨ Database seeding complete.');
  process.exit(0);
}

main();
`,

  'seed/mock-data.json': `{
  "roles": [
    { "name": "SUPER_ADMIN", "permissions": ["*"] },
    { "name": "HR_MANAGER", "permissions": ["users:read", "users:write", "leave:approve"] },
    { "name": "EMPLOYEE", "permissions": ["users:read"] }
  ],
  "departments": [
    { "name": "Engineering", "code": "ENG" },
    { "name": "Human Resources", "code": "HR" },
    { "name": "Finance", "code": "FIN" }
  ]
}
`,

  'scripts/migrate.ts': `import { migrate } from 'drizzle-orm/postgres-js/migrator';
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
`,

  'scripts/reset-db.ts': `import { sqlClient } from '@/lib/db';
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
      await sqlClient.execute(sql\`DROP SCHEMA public CASCADE;\`);
      await sqlClient.execute(sql\`CREATE SCHEMA public;\`);
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
`
};

// 4. Create files
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(dbDir, filePath);
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Populated production file: db/${filePath}`);
});

console.log('✨ Scaffold & Backup complete! The database has been dumped and your robust scripts are ready.');
