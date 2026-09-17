import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: process.env.NUCLEUS_ENV_FILE || '.env.enterprise.local', quiet: true });
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('A development migration database is required.');
const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
const checks: string[] = [];
async function rejectsSql(sql: string, values: unknown[], code: string) {
    await client.query('savepoint rejection');
    let actual: string | undefined;
    try { await client.query(sql, values); } catch (error) { actual = (error as { code: string }).code; }
    await client.query('rollback to savepoint rejection');
    assert.equal(actual, code); 
}
try {
 await client.query('begin');
 const country = (await client.query("select country_code,default_jurisdiction_code from payroll_country_configuration where is_default and enabled")).rows;
 assert.deepEqual(country, [{country_code:'IN',default_jurisdiction_code:'IN'}]);
 checks.push('India is the initial enabled payroll default');
 const tenant = randomUUID(), otherTenant = randomUUID(), actor = randomUUID(), membership = randomUUID();
 await client.query('insert into tenants(id,name,slug) values ($1,$2,$3),($4,$5,$6)', [tenant,'Verification A',tenant,otherTenant,'Verification B',otherTenant]);
 await client.query('insert into "user"(id,name,email) values($1,$2,$3)', [actor,'Verification',`${actor}@invalid.example`]);
 await client.query('insert into memberships(id,tenant_id,user_id,role) values($1,$2,$3,$4)', [membership,tenant,actor,'ADMIN']);
 await client.query("insert into configuration_definitions(key,value_type) values('verification.integer','integer')");
 await client.query("insert into tenant_configuration_values(tenant_id,key,value) values($1,'verification.integer','1'),($2,'verification.integer','2')", [tenant,otherTenant]);
 await rejectsSql("insert into system_configuration_values(key,value) values('verification.integer','not-an-integer')", [], '23514');
 checks.push('Typed configuration rejects invalid values');
 const person = randomUUID(), employee = randomUUID();
 await client.query('insert into people(id,tenant_id) values($1,$2)', [person,tenant]);
 await client.query("insert into employees(id,tenant_id,person_id,employee_code,first_name,last_name,designation,department,location,joining_date) values($1,$2,$3,'VERIFY','Verification','Only','Verification','Verification','Verification','2026-01-01')", [employee,tenant,person]);
 await client.query("insert into payroll_jurisdictions(code,country_code,currency_code) values('VERIFY','ZZ','XXX')");
 await client.query("insert into payroll_profiles(tenant_id,employee_id,jurisdiction_code,pay_frequency,effective_from) values($1,$2,'VERIFY','monthly','2026-01-01')", [tenant,employee]);
 await rejectsSql("insert into payroll_profiles(tenant_id,employee_id,jurisdiction_code,pay_frequency,effective_from) values($1,$2,'VERIFY','monthly','2026-02-01')", [tenant,employee], '23P01');
 checks.push('Overlapping payroll effective dates rejected');
 await rejectsSql("insert into payroll_profiles(tenant_id,employee_id,jurisdiction_code,pay_frequency,effective_from) values($1,$2,'VERIFY','monthly','2026-01-01')", [otherTenant,employee], '23503');
 checks.push('Payroll profile cannot reference another tenant employee');
 await client.query('set local role app_runtime');
 const role = (await client.query('select current_user,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
 assert.equal(role.current_user, 'app_runtime'); assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false);
 assert.equal((await client.query('select * from tenant_configuration_values')).rowCount, 0);
 await client.query("select set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true),set_config('app.membership_id',$3,true)", [actor,tenant,membership]);
 const visible = (await client.query('select tenant_id,value from tenant_configuration_values')).rows;
 assert.deepEqual(visible, [{tenant_id:tenant,value:'1'}]);
 await rejectsSql("insert into tenant_configuration_values(tenant_id,key,value) values($1,'verification.integer','3')", [otherTenant], '42501');
 checks.push('Non-owner role sees only its tenant and cannot write another tenant');
 await rejectsSql("update payroll_country_configuration set enabled=false where country_code='IN'", [], '42501');
 checks.push('Tenant runtime cannot change global payroll countries');
 const audit = (await client.query("select has_table_privilege(current_user,'audit_events','UPDATE') as update, has_table_privilege(current_user,'audit_events','DELETE') as delete, has_table_privilege(current_user,'audit_events','TRUNCATE') as truncate")).rows[0];
 assert.deepEqual(audit, {update:false,delete:false,truncate:false});
 checks.push('Runtime role cannot update, delete or truncate audit events');
 await client.query('rollback');
 const summary = (await client.query("select (select count(*)::int from drizzle.__drizzle_migrations) as migrations, (select count(*)::int from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tables")).rows[0];
 writeFileSync('plan/database-verification.json', JSON.stringify({status:'passed',...summary,checks,fixtures:'All verification records rolled back; no synthetic HR records persisted.'},null,2)+'\n');
 console.log(JSON.stringify({status:'passed',...summary,checks},null,2));
} finally { await client.query('rollback'); client.release(); await pool.end(); }
