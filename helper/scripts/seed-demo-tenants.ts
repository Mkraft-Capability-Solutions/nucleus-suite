import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

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
  const client = neon(configuration.migrationDatabaseUrl!);
  const credentials: Array<{ email: string; password: string }> = [];

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
