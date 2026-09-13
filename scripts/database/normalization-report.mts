import { config } from 'dotenv';
import { Pool } from 'pg';
import { writeFileSync } from 'node:fs';
config({path:process.env.NUCLEUS_ENV_FILE||'.env.enterprise.local',quiet:true});
const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1});
try {
 const rows=(await pool.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and data_type in ('json','jsonb') order by table_name,column_name")).rows;
 const report={status:'requires-domain-review',jsonColumns:rows.length,affectedTables:new Set(rows.map(row=>row.table_name)).size,interpretation:'A JSON column alone does not violate normalization. Review business attributes for extraction; opaque audit/external payloads may remain JSON. Do not declare the entire schema 3NF from table counts.',columns:rows};
 writeFileSync('plan/database-normalization-gaps.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({jsonColumns:report.jsonColumns,affectedTables:report.affectedTables}));
} finally{await pool.end();}
