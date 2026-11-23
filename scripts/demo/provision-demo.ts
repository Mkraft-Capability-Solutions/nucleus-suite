/**
 * Provisions the demo organisations through the platform API, exactly as the super admin would
 * from /platform, then sets every user's password to DEMO_PASSWORD.
 *
 *   DEMO_PASSWORD=... npm run demo:provision            (dev server running on DEMO_BASE_URL)
 *
 * - Tata: every module; the owner admin@tata.com plus one user per system role
 *   (hr, payroll, manager) and three employees (emp1–emp3).
 * - Birla: the default modules and only its owner admin@birla.com, nothing else: a company that
 *   has just been signed up and has not started onboarding.
 *
 * Run after `npm run demo:reset`. The super admin must be in PLATFORM_ADMIN_EMAILS.
 */
import { config } from "dotenv";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { MODULE_CATALOG } from "../../src/lib/entitlements/catalog";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const SUPER_ADMIN = process.env.DEMO_SUPER_ADMIN ?? "superadmin@mkraft.com";

export const TATA_USERS = [
  { email: "hr@tata.com", name: "Priya Sharma", roleCodes: ["hr-manager"] },
  { email: "payroll@tata.com", name: "Rakesh Gupta", roleCodes: ["payroll-admin"] },
  { email: "manager@tata.com", name: "Vikram Rao", roleCodes: ["manager"] },
  { email: "emp1@tata.com", name: "Ananya Iyer", roleCodes: ["employee"] },
  { email: "emp2@tata.com", name: "Rohit Verma", roleCodes: ["employee"] },
  { email: "emp3@tata.com", name: "Sneha Kulkarni", roleCodes: ["employee"] },
] as const;

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Sign-in as ${email} failed: ${response.status} ${await response.text()}`);
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  if (!cookies) throw new Error(`Sign-in as ${email} returned no session.`);
  return cookies;
}

async function call<T>(cookie: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  return (JSON.parse(text) as { data: T }).data;
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!password) throw new Error("Set DEMO_PASSWORD.");
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required.");

  const cookie = await signIn(SUPER_ADMIN, password);
  const allModules = MODULE_CATALOG.map((module) => module.key);

  const tata = await call<{ id: string }>(cookie, "POST", "/api/v1/platform/tenants", {
    name: "Tata", legalName: "Tata Group Holdings Limited", slug: "tata", timezone: "Asia/Kolkata", currency: "INR",
    ownerName: "Arvind Menon", ownerEmail: "admin@tata.com", modules: allModules,
  });
  console.info(`Created Tata (${tata.id}) with ${allModules.length} modules.`);
  for (const user of TATA_USERS) {
    await call(cookie, "POST", `/api/v1/platform/tenants/${tata.id}/users`, user);
    console.info(`  ${user.email} (${user.roleCodes.join(", ")})`);
  }

  const birla = await call<{ id: string }>(cookie, "POST", "/api/v1/platform/tenants", {
    name: "Birla", slug: "birla", timezone: "Asia/Kolkata", currency: "INR", ownerName: "Birla Administrator", ownerEmail: "admin@birla.com",
  });
  console.info(`Created Birla (${birla.id}) with the default modules.`);

  // Provisioning issues one-time passwords; the demo uses one known password for everyone.
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const hash = await hashPassword(password);
    const result = await pool.query(`update account set password = $1, updated_at = now() where provider_id = 'credential'`, [hash]);
    console.info(`Set the demo password for ${result.rowCount} users.`);
  } finally {
    await pool.end();
  }
  console.info(JSON.stringify({ tata: tata.id, birla: birla.id }));
}

main().catch((error: unknown) => {
  console.error("Provisioning failed:", (error as Error).message);
  process.exitCode = 1;
});
