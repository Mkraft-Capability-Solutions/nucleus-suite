import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const [adminEmailArg, userEmailArg, ...nameParts] = process.argv.slice(2);
  const adminEmail = adminEmailArg?.trim().toLowerCase();
  const userEmail = userEmailArg?.trim().toLowerCase();
  const name = nameParts.join(" ").trim();
  if (!adminEmail || !userEmail || !name || !adminEmail.includes("@") || !userEmail.includes("@")) {
    throw new Error("Usage: npm run auth:provision-user -- admin@example.com user@example.com Full Name");
  }

  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const client = neon(configuration.migrationDatabaseUrl!);

  const admins = await client`select id from "user" where lower(email) = ${adminEmail} and status = 'active' limit 1`;
  const admin = admins[0] as { id: string } | undefined;
  if (!admin) throw new Error("The provisioning administrator was not found.");

  const [, memberships] = await client.transaction([
    client`select set_config('app.user_id', ${admin.id}, true)`,
    client`select m.id as membership_id, m.tenant_id from memberships m where m.user_id = ${admin.id} and m.role = 'owner' and m.status = 'active' order by m.created_at limit 1`,
  ]);
  const owner = (memberships as { membership_id: string; tenant_id: string }[])[0];
  if (!owner) throw new Error("The administrator has no active owner membership.");

  const existing = await client`select 1 from "user" where lower(email) = ${userEmail} limit 1`;
  if (existing.length > 0) throw new Error("A user with that email already exists.");

  const userId = randomUUID();
  const membershipId = randomUUID();
  const roleId = randomUUID();
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const passwordHash = await hashPassword(password);
  const invitationTokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");

  await client.transaction([
    client`select set_config('app.user_id', ${admin.id}, true)`,
    client`select set_config('app.tenant_id', ${owner.tenant_id}, true)`,
    client`select set_config('app.membership_id', ${owner.membership_id}, true)`,
    client`insert into "user" (id, name, email, email_verified, status) values (${userId}, ${name}, ${userEmail}, true, 'active')`,
    client`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})`,
    client`insert into invitations (tenant_id, email, token_hash, status, invited_by_user_id, accepted_user_id, expires_at, accepted_at) values (${owner.tenant_id}, ${userEmail}, ${invitationTokenHash}, 'accepted', ${admin.id}, ${userId}, now() + interval '1 day', now())`,
    client`insert into memberships (id, tenant_id, user_id, role, status) values (${membershipId}, ${owner.tenant_id}, ${userId}, 'employee', 'active')`,
    client`insert into roles (id, tenant_id, code, name, system_managed) values (${roleId}, ${owner.tenant_id}, 'employee', 'Employee', true) on conflict (tenant_id, code) do nothing`,
    client`insert into role_permissions (tenant_id, role_id, permission_id) select ${owner.tenant_id}, r.id, p.id from roles r cross join permissions p where r.tenant_id = ${owner.tenant_id} and r.code = 'employee' and p.permission_key in ('tenant.read','employee.read','attendance.read','leave.read') on conflict do nothing`,
    client`insert into membership_roles (tenant_id, membership_id, role_id) select ${owner.tenant_id}, ${membershipId}, id from roles where tenant_id = ${owner.tenant_id} and code = 'employee'`,
    client`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, purpose, after) values (${owner.tenant_id}, ${admin.id}, ${owner.membership_id}, 'membership.provision', 'user', ${userId}, 'Provider-free admin provisioning', 'administration', ${JSON.stringify({ email: userEmail, role: "employee" })}::jsonb)`,
  ]);

  console.info(`Provisioned ${userEmail} in the administrator's tenant.`);
  console.info(`One-time temporary password: ${password}`);
  console.info("The user should change it at /settings/security immediately.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "User provisioning failed");
  process.exitCode = 1;
});