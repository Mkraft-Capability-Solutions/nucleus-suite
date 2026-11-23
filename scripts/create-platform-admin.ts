/**
 * Creates (or resets) a platform operator's sign-in on a fresh database.
 *
 *   npm run platform:create-admin -- operator@example.com "Full Name"
 *
 * Connects with MIGRATION_DATABASE_URL (owner role). Prints a one-time password once; the operator
 * signs in at /login and lands on /platform. The email must also be listed in PLATFORM_ADMIN_EMAILS
 * in the deployment's environment, which is what grants platform access.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ").trim() || "Platform Operator";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Usage: npm run platform:create-admin -- operator@example.com "Full Name"');
  }
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required (owner role, direct endpoint).");

  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const passwordHash = await hashPassword(password);
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const existing = await client.query<{ id: string }>(`select id from "user" where lower(email) = $1`, [email]);
      const userId = existing.rows[0]?.id ?? randomUUID();
      if (!existing.rows[0]) {
        await client.query(`insert into "user" (id, name, email, email_verified, status) values ($1, $2, $3, true, 'active')`, [userId, name, email]);
      }
      await client.query(
        `insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)
         on conflict (provider_id, account_id) do update set password = excluded.password, updated_at = now()`,
        [randomUUID(), userId, passwordHash],
      );
      await client.query(`delete from session where user_id = $1`, [userId]);
      await client.query("commit");
      console.info(`${existing.rows[0] ? "Reset" : "Created"} ${email}.`);
      console.info(`One-time password (shown once): ${password}`);
      console.info("Make sure the email is in PLATFORM_ADMIN_EMAILS for the deployment, then sign in at /login.");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Could not create the platform operator:", (error as Error).message);
  process.exitCode = 1;
});
