/**
 * Sets a user's sign-in password to a value the operator chooses, without printing or storing it.
 *
 *   NEW_PASSWORD='…' npx tsx scripts/set-password.ts user@example.com
 *
 * Only the Better Auth hash is written; existing sessions are revoked and the change is recorded
 * in auth_security_events. The password comes from the environment, never from a file.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: NEW_PASSWORD='…' npx tsx scripts/set-password.ts user@example.com");
  const password = process.env.NEW_PASSWORD ?? "";
  if (password.length < 8 || password.length > 128) throw new Error("NEW_PASSWORD must be 8 to 128 characters.");

  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const client = neon(configuration.migrationDatabaseUrl!);
  const users = await client`select id, email from "user" where lower(email) = ${email} limit 1`;
  const user = users[0] as { id: string; email: string } | undefined;
  if (!user) throw new Error("No user exists with that email address.");

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
      values (${user.id}, 'admin_password_set', ${JSON.stringify({ delivery: "operator", sessionsRevoked: true })}::jsonb)
    `,
  ]);
  console.info(`Password set for ${user.email}. Existing sessions were revoked.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Setting the password failed");
  process.exitCode = 1;
});
