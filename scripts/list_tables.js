const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function listTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Existing tables in database:");
    res.rows.forEach(row => console.log(row.table_name));
  } catch (err) {
    console.error("Error connecting to database:", err.message);
  } finally {
    await client.end();
  }
}

listTables();
