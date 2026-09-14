import { randomBytes, randomUUID } from "node:crypto";
import { Client as PgClient } from "pg";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

type DemoUser = { name: string; email: string; role: keyof typeof rolePermissions };
type DemoTenant = { name: string; slug: string; users: DemoUser[] };

const rolePermissions = {
  owner: null,
  "hr-manager": ["tenant.read", "employee.read", "employee.write", "attendance.read", "leave.read", "leave.approve", "role.manage", "membership.manage"],
  "payroll-admin": ["tenant.read", "employee.read", "attendance.read", "payroll.read", "payroll.run"],
  employee: ["tenant.read", "employee.read", "attendance.read", "leave.read"],
} as const;

const demoTenants: DemoTenant[] = [
  {
    name: "Prism Fabrication Demo",
    slug: "prism-fabrication-demo",
    users: [
      { name: "Demo Platform Admin", email: "demo.admin@mkraft.test", role: "owner" },
      { name: "Ananya HR", email: "ananya.hr@mkraft.test", role: "hr-manager" },
      { name: "Vikram Payroll", email: "vikram.payroll@mkraft.test", role: "payroll-admin" },
      { name: "Maya Employee", email: "maya.employee@mkraft.test", role: "employee" },
    ],
  },
  {
    name: "Atlas Components Demo",
    slug: "atlas-components-demo",
    users: [
      { name: "Demo Platform Admin", email: "demo.admin@mkraft.test", role: "owner" },
      { name: "Rohan HR", email: "rohan.hr@mkraft.test", role: "hr-manager" },
      { name: "Sara Employee", email: "sara.employee@mkraft.test", role: "employee" },
    ],
  },
];

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

async function main() {
  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const isPostgres = process.env.MIGRATION_DATABASE_DRIVER === 'postgres' || configuration.migrationDatabaseUrl?.startsWith('postgres://') || configuration.migrationDatabaseUrl?.startsWith('postgresql://');
  const credentials: Array<{ email: string; password: string }> = [];

  if (isPostgres) {
    const pg = new PgClient({ connectionString: configuration.migrationDatabaseUrl });
    await pg.connect();
    try {
      for (const tenant of demoTenants) {
        const existingTenant = await pg.query("select id from tenants where slug = $1 limit 1", [tenant.slug]);
        if (existingTenant.rows.length > 0) {
          console.info(`Skipped ${tenant.name}: demo company already exists.`);
          continue;
        }

        const tenantId = randomUUID();
        const memberships = [];
        for (const member of tenant.users) {
          const existingUserRes = await pg.query('select id from "user" where lower(email) = $1 limit 1', [member.email.toLowerCase()]);
          const existingUser = existingUserRes.rows[0] as { id: string } | undefined;
          const password = existingUser ? null : temporaryPassword();
          memberships.push({
            ...member,
            userId: existingUser?.id ?? randomUUID(),
            membershipId: randomUUID(),
            password,
            passwordHash: password ? await hashPassword(password) : null,
          });
        }

        const owner = memberships.find((member) => member.role === "owner");
        if (!owner) throw new Error(`Demo tenant ${tenant.slug} has no owner.`);
        const roleIds = Object.fromEntries(Object.keys(rolePermissions).map((role) => [role, randomUUID()])) as Record<keyof typeof rolePermissions, string>;

        await pg.query("BEGIN");
        try {
          await pg.query("select set_config('app.user_id', $1, true)", [owner.userId]);
          await pg.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
          await pg.query("select set_config('app.membership_id', $1, true)", [owner.membershipId]);

          for (const member of memberships) {
            if (member.password) {
              await pg.query('insert into "user" (id, name, email, email_verified, status) values ($1, $2, $3, true, $4)', [member.userId, member.name, member.email, 'active']);
              await pg.query('insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, $3, $4, $5)', [randomUUID(), member.userId, 'credential', member.userId, member.passwordHash]);
            }
          }

          await pg.query("insert into tenants (id, name, slug, legal_name, default_currency, timezone, status) values ($1, $2, $3, $4, 'INR', 'Asia/Kolkata', 'active')", [tenantId, tenant.name, tenant.slug, tenant.name]);
          await pg.query("insert into tenant_settings (tenant_id, locale, timezone, currency) values ($1, 'en-IN', 'Asia/Kolkata', 'INR')", [tenantId]);

          for (const member of memberships) {
            await pg.query("insert into memberships (id, tenant_id, user_id, role, status) values ($1, $2, $3, $4, 'active')", [member.membershipId, tenantId, member.userId, member.role === 'owner' ? 'owner' : 'employee']);
          }

          for (const [code] of Object.entries(rolePermissions)) {
            const roleName = code === 'owner' ? 'Workspace Owner' : code.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
            await pg.query("insert into roles (id, tenant_id, code, name, system_managed) values ($1, $2, $3, $4, true)", [roleIds[code as keyof typeof rolePermissions], tenantId, code, roleName]);
          }

          await pg.query("insert into role_permissions (tenant_id, role_id, permission_id) select $1, $2, id from permissions where status = 'active'", [tenantId, roleIds.owner]);

          for (const [code, permissions] of Object.entries(rolePermissions)) {
            if (code !== "owner" && permissions) {
              await pg.query("insert into role_permissions (tenant_id, role_id, permission_id) select $1, $2, id from permissions where permission_key = ANY($3) and status = 'active'", [tenantId, roleIds[code as keyof typeof rolePermissions], permissions]);
            }
          }

          for (const member of memberships) {
            await pg.query("insert into membership_roles (tenant_id, membership_id, role_id) values ($1, $2, $3)", [tenantId, member.membershipId, roleIds[member.role]]);
          }

          await pg.query("insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, after) values ($1, $2, 'demo.tenant_seed', 'tenant', $3, 'Local test tenant provisioning', $4::jsonb)", [tenantId, owner.userId, tenantId, JSON.stringify({ slug: tenant.slug, users: memberships.map((m) => m.email) })]);

          await pg.query("COMMIT");
        } catch (e) {
          await pg.query("ROLLBACK");
          throw e;
        }

        memberships.forEach((member) => { if (member.password) credentials.push({ email: member.email, password: member.password }); });
        console.info(`Created ${tenant.name} (${tenant.slug}) with ${memberships.length} memberships.`);
      }
    } finally {
      await pg.end();
    }
  } else {
    const client = neon(configuration.migrationDatabaseUrl!);
    for (const tenant of demoTenants) {
      const existingTenant = await client`select id from tenants where slug = ${tenant.slug} limit 1`;
      if (existingTenant.length > 0) {
        console.info(`Skipped ${tenant.name}: demo company already exists.`);
        continue;
      }

      const tenantId = randomUUID();
      const memberships = await Promise.all(tenant.users.map(async (member) => {
        const existingUserRows = await client`select id from "user" where lower(email) = ${member.email} limit 1`;
        const existingUser = existingUserRows[0] as { id: string } | undefined;
        const password = existingUser ? null : temporaryPassword();
        return { ...member, userId: existingUser?.id ?? randomUUID(), membershipId: randomUUID(), password, passwordHash: password ? await hashPassword(password) : null };
      }));
      const owner = memberships.find((member) => member.role === "owner");
      if (!owner) throw new Error(`Demo tenant ${tenant.slug} has no owner.`);
      const roleIds = Object.fromEntries(Object.keys(rolePermissions).map((role) => [role, randomUUID()])) as Record<keyof typeof rolePermissions, string>;

      await client.transaction([
        client`select set_config('app.user_id', ${owner.userId}, true)`,
        client`select set_config('app.tenant_id', ${tenantId}, true)`,
        client`select set_config('app.membership_id', ${owner.membershipId}, true)`,
        ...memberships.flatMap((member) => member.password ? [
          client`insert into "user" (id, name, email, email_verified, status) values (${member.userId}, ${member.name}, ${member.email}, true, 'active')`,
          client`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${member.userId}, 'credential', ${member.userId}, ${member.passwordHash})`,
        ] : []),
        client`insert into tenants (id, name, slug, legal_name, default_currency, timezone, status) values (${tenantId}, ${tenant.name}, ${tenant.slug}, ${tenant.name}, 'INR', 'Asia/Kolkata', 'active')`,
        client`insert into tenant_settings (tenant_id, locale, timezone, currency) values (${tenantId}, 'en-IN', 'Asia/Kolkata', 'INR')`,
        ...memberships.map((member) => client`insert into memberships (id, tenant_id, user_id, role, status) values (${member.membershipId}, ${tenantId}, ${member.userId}, ${member.role === 'owner' ? 'owner' : 'employee'}, 'active')`),
        ...Object.entries(rolePermissions).map(([code]) => client`insert into roles (id, tenant_id, code, name, system_managed) values (${roleIds[code as keyof typeof rolePermissions]}, ${tenantId}, ${code}, ${code === 'owner' ? 'Workspace Owner' : code.replaceAll('-', ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase())}, true)`),
        client`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${roleIds.owner}, id from permissions where status = 'active'`,
        ...Object.entries(rolePermissions).filter(([code]) => code !== "owner").map(([code, permissions]) => client`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${roleIds[code as keyof typeof rolePermissions]}, id from permissions where permission_key = any(${permissions}) and status = 'active'`),
        ...memberships.map((member) => client`insert into membership_roles (tenant_id, membership_id, role_id) values (${tenantId}, ${member.membershipId}, ${roleIds[member.role]})`),
        client`insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, after) values (${tenantId}, ${owner.userId}, 'demo.tenant_seed', 'tenant', ${tenantId}, 'Local test tenant provisioning', ${JSON.stringify({ slug: tenant.slug, users: memberships.map((member) => member.email) })}::jsonb)`,
      ]);

      memberships.forEach((member) => { if (member.password) credentials.push({ email: member.email, password: member.password }); });
      console.info(`Created ${tenant.name} (${tenant.slug}) with ${memberships.length} memberships.`);
    }
  }

  if (credentials.length === 0) {
    console.info("No new demo credentials were generated.");
    return;
  }
  console.info("New one-time demo credentials (store securely; they are not written to disk):");
  credentials.forEach(({ email, password }) => console.info(`${email}\t${password}`));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo tenant provisioning failed");
  process.exitCode = 1;
});
