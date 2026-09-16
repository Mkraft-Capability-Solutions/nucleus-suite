import { sqlClient } from '@/lib/db';
import { tenants } from '@/lib/db/schema'; // Update imports based on your actual exported tables
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

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
    
    console.log(`✅ Default tenant seeded successfully (ID: ${tenantId})`);
    
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
