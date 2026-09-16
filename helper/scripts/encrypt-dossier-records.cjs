/* eslint-disable @typescript-eslint/no-require-imports */
// Encrypt existing bank/tax attributes without logging their contents.
const { config } = require("dotenv");
const { neon } = require("@neondatabase/serverless");
const { createCipheriv, randomBytes } = require("node:crypto");
config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  if (!/^[a-f\d]{64}$/i.test(process.env.HRMS_FIELD_ENCRYPTION_KEY ?? "")) throw new Error("Configure HRMS_FIELD_ENCRYPTION_KEY before migrating sensitive records.");
  const apply = process.argv.includes("--apply");
  const key = Buffer.from(process.env.HRMS_FIELD_ENCRYPTION_KEY, "hex");
  const sql = neon(process.env.MIGRATION_DATABASE_URL);
  for (const [resource, table] of [["bank", "bank_accounts"], ["tax", "tax_profiles"]]) {
    if (!apply) {
      const result = await sql.transaction([sql`select set_config('app.platform_admin','true',true)`, sql.query('select count(*)::int as count from "' + table + '" where attributes->>\'format\' is distinct from \'aes-256-gcm-v1\'')]);
      process.stdout.write(resource + ": " + result[1][0].count + " legacy records; dry run, no changes.\n");
      continue;
    }
    let count = 0;
    for (;;) {
      const results = await sql.transaction([
        sql`select set_config('app.platform_admin','true',true)`,
        sql.query('select id,tenant_id,version,attributes from "' + table + '" where attributes->>\'format\' is distinct from \'aes-256-gcm-v1\' order by id limit 100'),
      ]);
      const rows = results[1];
      if (!rows.length) break;
      const writes = rows.map(row => {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(Buffer.from(row.tenant_id + ":" + resource + ":" + row.id));
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(row.attributes)), cipher.final()]);
        const data = { encrypted: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), format: "aes-256-gcm-v1" };
        return sql.query('with changed as (update "' + table + '" set attributes=$1::jsonb,version=version+1,updated_at=now() where tenant_id=$2::uuid and id=$3::uuid and version=$4::int returning id) insert into audit_events(tenant_id,action,entity_type,entity_id,reason) select $2::uuid,\'dossier.storage_encrypted\',$5,id,\'Sensitive-field storage migration\' from changed returning entity_id', [JSON.stringify(data), row.tenant_id, row.id, row.version, resource]);
      });
      const changed = await sql.transaction([sql`select set_config('app.platform_admin','true',true)`, ...writes]);
      count += changed.slice(1).reduce((sum, result) => sum + result.length, 0);
    }
    process.stdout.write(resource + ": " + count + " records encrypted.\n");
  }
}
main().catch(error => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
