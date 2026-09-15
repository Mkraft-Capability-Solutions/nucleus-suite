const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cO3Qs5NyYiKU@ep-old-block-ae88r1lh-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
  });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(res.rows.map(r => r.table_name).join('\n'));
  await client.end();
}
main().catch(console.error);
