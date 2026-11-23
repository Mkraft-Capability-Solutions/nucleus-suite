/**
 * Empties the database for a fresh start and creates the platform super admin.
 *
 *   npm run demo:reset -- --confirm superadmin@example.com "Full Name"
 *
 * Deletes every row of every application table, including users, sessions and organisations.
 * Keeps only the reference data the migrations install and the application cannot run without:
 * the permission catalogue, countries, currencies and jurisdictions; and the migration history.
 *
 * Safety: refuses to run against anything but a local database (127.0.0.1 / localhost) unless
 * --allow-remote is given, and refuses without --confirm. The super admin's password is taken from
 * DEMO_PASSWORD; the email must also be listed in PLATFORM_ADMIN_EMAILS to reach /platform.
 * Connects with MIGRATION_DATABASE_URL (owner role). Take a backup first (pg_dump).
 */
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

/** Reference tables installed by migrations; every other table in `public` is emptied. */
export const KEEP_TABLES = ["permissions", "countries", "currencies", "jurisdictions"] as const;

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const [emailArg, ...nameParts] = args.filter((arg) => !arg.startsWith("--"));
  const email = emailArg?.trim().toLowerCase();
  const name = nameParts.join(" ").trim() || "Platform Super Admin";
  const password = process.env.DEMO_PASSWORD;
  const url = process.env.MIGRATION_DATABASE_URL;

  if (!flags.has("--confirm")) throw new Error("This deletes all data. Re-run with --confirm.");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Usage: npm run demo:reset -- --confirm superadmin@example.com "Full Name"');
  if (!password) throw new Error("Set DEMO_PASSWORD to the password for the super admin.");
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required (owner role, direct endpoint).");
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host) && !flags.has("--allow-remote")) {
    throw new Error(`Refusing to wipe a non-local database (${host}). Pass --allow-remote only if you are certain.`);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      `select tablename as name from pg_tables where schemaname = 'public' and tablename <> all($1::text[]) order by tablename`,
      [KEEP_TABLES],
    );
    await client.query("begin");
    await client.query(`truncate table ${rows.map((row) => `public."${row.name}"`).join(", ")} restart identity cascade`);
    const userId = randomUUID();
    await client.query(`insert into "user" (id, name, email, email_verified, status) values ($1, $2, $3, true, 'active')`, [userId, name, email]);
    await client.query(
      `insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, await hashPassword(password)],
    );
    await client.query("commit");
    console.info(`Emptied ${rows.length} tables; kept ${KEEP_TABLES.join(", ")}.`);
    console.info(`Created the platform super admin ${email}. Make sure it is in PLATFORM_ADMIN_EMAILS.`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Reset failed:", (error as Error).message);
  process.exitCode = 1;
});
