const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cO3Qs5NyYiKU@ep-old-block-ae88r1lh-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
  });

  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS statutory_register (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id text NOT NULL,
      employee_id uuid,
      attributes jsonb NOT NULL DEFAULT '{}',
      status text NOT NULL DEFAULT 'draft',
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      deleted_at timestamp with time zone
    );
  `);
  
  console.log("Created statutory_register table successfully.");
  await client.end();
}

main().catch(console.error);
