import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
config({ path: process.env.NUCLEUS_ENV_FILE || '.env.enterprise.local', quiet: true });
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Migration database is required.');
const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
const inventory = JSON.parse(readFileSync('plan/localization-inventory.json', 'utf8')) as Array<{namespace:string;key:string;sourceFile:string;sourcePointer:string;sourceHash:string;classification:string}>;
let count = 0;
try {
 await client.query('begin');
 await client.query("insert into ui_locales(code,native_name,direction) values('en','English','ltr') on conflict do nothing");
 const sourceCache = new Map<string, Record<string, unknown>>();
 for (const item of inventory.filter(item => item.classification === 'label-candidate')) {
  if (!sourceCache.has(item.sourceFile)) sourceCache.set(item.sourceFile, JSON.parse(readFileSync(item.sourceFile,'utf8')));
  const value = item.sourcePointer.split('/').slice(1).reduce((node, part) => node[part.replace(/~1/g,'/').replace(/~0/g,'~')], sourceCache.get(item.sourceFile)) as string;
  if (createHash('sha256').update(value).digest('hex') !== item.sourceHash) throw new Error('Localization source changed; regenerate inventory before importing.');
  const namespace = (await client.query('insert into ui_namespaces(name) values($1) on conflict(name) do update set name=excluded.name returning id',[item.namespace])).rows[0].id;
  const message = (await client.query('insert into ui_messages(namespace_id,message_key,source_file,source_pointer) values($1,$2,$3,$4) on conflict(namespace_id,message_key) do update set source_file=excluded.source_file,source_pointer=excluded.source_pointer returning id',[namespace,item.key,item.sourceFile,item.sourcePointer])).rows[0].id;
  // Never overwrite reviewed translations or publish unreviewed fixture content.
  await client.query("insert into ui_translations(message_id,locale_code,content) values($1,'en',$2) on conflict do nothing",[message,value]);
  count++;
 }
 await client.query('commit');
 console.log(JSON.stringify({importedCandidates:count,published:false,existingTranslations:'preserved'}));
} finally { await client.query('rollback'); client.release(); await pool.end(); }
