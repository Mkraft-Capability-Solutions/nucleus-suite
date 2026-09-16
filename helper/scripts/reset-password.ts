import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: npm run auth:reset-password -- user@example.com");
  }

  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const client = neon(configuration.migrationDatabaseUrl!);
  const users = await client`select id, email from "user" where lower(email) = ${email} limit 1`;
  const user = users[0] as { id: string; email: string } | undefined;
  if (!user) throw new Error("No user exists with that email address.");

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await client.transaction([
    client`
      insert into account (id, account_id, provider_id, user_id, password)
      values (${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${passwordHash})
      on conflict (provider_id, account_id)
      do update set password = excluded.password, updated_at = now()
    `,
    client`delete from session where user_id = ${user.id}`,
    client`
      insert into auth_security_events (target_user_id, event_type, metadata)
      values (${user.id}, 'admin_password_reset', ${JSON.stringify({ delivery: "manual", sessionsRevoked: true })}::jsonb)
    `,
  ]);

  console.info(`Password reset for ${user.email}. All sessions were revoked.`);
  console.info(`One-time temporary password: ${password}`);
  console.info("The user should sign in and change it immediately.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Password reset failed");
  process.exitCode = 1;
});