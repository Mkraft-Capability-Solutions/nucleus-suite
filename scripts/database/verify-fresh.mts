import { config } from 'dotenv';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
config({path:process.env.NUCLEUS_ENV_FILE||'.env.enterprise.local',quiet:true});
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('A development owner connection is required.');
const url = new URL(process.env.MIGRATION_DATABASE_URL);
// A disposable-database verifier must never infer permission to create databases on a hosted server.
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('Fresh verification is restricted to local PostgreSQL.');
const owner = new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:10000});
const name = `nucleus_verify_${randomBytes(6).toString('hex')}`;
let created = false;
try {
 await owner.query(`create database "${name}"`); created = true; url.pathname = '/'+name;
 const env = {...process.env,MIGRATION_DATABASE_URL:url.toString(),MIGRATION_DATABASE_DRIVER:'postgres',NUCLEUS_ENV_FILE:process.env.NUCLEUS_ENV_FILE||'.env.enterprise.local'};
 for (const script of ['scripts/migrate.ts','scripts/migrate.ts','scripts/database/verify-live.mts']) {
  const {stdout} = await promisify(execFile)('./node_modules/.bin/tsx',[script],{env,maxBuffer:1024*1024});
  process.stdout.write(stdout);
 }
 console.log('Fresh install, repeat migration and non-owner verification passed.');
} finally {
 if (created) await owner.query(`drop database "${name}"`);
 await owner.end();
}
