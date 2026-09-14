import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

function connectionUrl(): string {
  const arg = process.argv.find((a) => a.startsWith("postgres"));
  if (arg) return arg;
  const configuration = readRuntimeConfiguration();
  return configuration.databaseUrl || "postgresql://postgres:H%40rH%40rMahad3v@localhost:5432/nucleus_hrms";
}

const SHARED_PASSWORD = "Nucl3u$123$ecure";

async function main() {
  const pool = new Pool({ connectionString: connectionUrl() });
  const client = await pool.connect();
  const passwordHash = await hashPassword(SHARED_PASSWORD);

  console.info("Starting company email domain migration...");

  try {
    await client.query("BEGIN");

    // 1. Get Tenants
    const tenantsRes = await client.query("SELECT id, slug, name FROM tenants");
    const tenantMap: Record<string, string> = {};
    for (const t of tenantsRes.rows) {
      tenantMap[t.slug] = t.id;
    }

    const atlasTenantId = tenantMap["atlas-components-demo"];
    const prismTenantId = tenantMap["prism-fabrication-demo"];
    const mkraftTenantId = tenantMap["mkraft"];

    // 2. Helper to upsert user and assign role
    async function upsertUser(
      email: string,
      name: string,
      tenantId: string,
      roleCode: string,
      employeeId?: string
    ) {
      email = email.toLowerCase().trim();
      let userRes = await client.query('SELECT id FROM "user" WHERE lower(email) = $1', [email]);
      let userId: string;
      if (userRes.rows.length === 0) {
        userId = randomUUID();
        await client.query(
          'INSERT INTO "user" (id, name, email, email_verified, status) VALUES ($1, $2, $3, true, \'active\')',
          [userId, name, email]
        );
        await client.query(
          'INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, \'credential\', $3, $4)',
          [randomUUID(), userId, userId, passwordHash]
        );
      } else {
        userId = userRes.rows[0].id;
        await client.query(
          'UPDATE "user" SET name = $1, status = \'active\' WHERE id = $2',
          [name, userId]
        );
        const accRes = await client.query('SELECT id FROM account WHERE user_id = $1', [userId]);
        if (accRes.rows.length === 0) {
          await client.query(
            'INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, \'credential\', $3, $4)',
            [randomUUID(), userId, userId, passwordHash]
          );
        } else {
          await client.query(
            'UPDATE account SET password = $1 WHERE user_id = $2',
            [passwordHash, userId]
          );
        }
      }

      // Membership
      let memRes = await client.query('SELECT id FROM memberships WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
      let membershipId: string;
      const memberRole = roleCode === 'owner' ? 'owner' : 'employee';
      if (memRes.rows.length === 0) {
        membershipId = randomUUID();
        await client.query(
          'INSERT INTO memberships (id, tenant_id, user_id, role, status, employee_id) VALUES ($1, $2, $3, $4, \'active\', $5)',
          [membershipId, tenantId, userId, memberRole, employeeId || null]
        );
      } else {
        membershipId = memRes.rows[0].id;
        if (employeeId) {
          await client.query('UPDATE memberships SET employee_id = $1 WHERE id = $2', [employeeId, membershipId]);
        }
      }

      // Membership Role
      const roleRes = await client.query('SELECT id FROM roles WHERE tenant_id = $1 AND code = $2', [tenantId, roleCode]);
      if (roleRes.rows.length > 0) {
        await client.query(
          'INSERT INTO membership_roles (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [tenantId, membershipId, roleRes.rows[0].id]
        );
      }

      return userId;
    }

    // --- A. ATLAS COMPONENTS DEMO (@atlas.com) ---
    if (atlasTenantId) {
      console.info("Configuring Atlas Components Demo (@atlas.com)...");
      
      // Update existing emails first
      await client.query(`
        UPDATE "user" u
        SET email = replace(replace(u.email, '@mkraft.test', '@atlas.com'), '@mkraft.demo', '@atlas.com')
        FROM memberships m
        WHERE m.user_id = u.id AND m.tenant_id = $1
      `, [atlasTenantId]);

      // Standard persona accounts
      await upsertUser("superadmin@atlas.com", "Atlas Super Administrator", atlasTenantId, "owner");
      await upsertUser("admin@atlas.com", "Atlas Workspace Owner", atlasTenantId, "owner");
      await upsertUser("hr@atlas.com", "Rohan HR", atlasTenantId, "hr-manager");
      await upsertUser("manager@atlas.com", "Atlas Plant Manager", atlasTenantId, "manager");
      await upsertUser("payroll@atlas.com", "Atlas Payroll Officer", atlasTenantId, "payroll-admin");
      await upsertUser("employee@atlas.com", "Sara Employee", atlasTenantId, "employee");
      await upsertUser("demo.admin@atlas.com", "Atlas Demo Admin", atlasTenantId, "owner");

      // Update employee work_emails for Atlas
      await client.query(`
        UPDATE employees
        SET work_email = lower(first_name || '.' || last_name || '@atlas.com')
        WHERE tenant_id = $1 AND (work_email IS NULL OR work_email NOT LIKE '%@atlas.com')
      `, [atlasTenantId]);
    }

    // --- B. PRISM FABRICATION DEMO (@prism.com) ---
    if (prismTenantId) {
      console.info("Configuring Prism Fabrication Demo (@prism.com)...");

      // Clean up demo.admin cross-tenant membership if it exists
      const oldDemoAdminRes = await client.query('SELECT id FROM "user" WHERE email = \'demo.admin@atlas.com\'');
      if (oldDemoAdminRes.rows.length > 0) {
        await client.query('DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2', [prismTenantId, oldDemoAdminRes.rows[0].id]);
      }

      // Update existing emails
      await client.query(`
        UPDATE "user" u
        SET email = replace(replace(u.email, '@mkraft.test', '@prism.com'), '@mkraft.demo', '@prism.com')
        FROM memberships m
        WHERE m.user_id = u.id AND m.tenant_id = $1
      `, [prismTenantId]);

      // Standard persona accounts
      await upsertUser("superadmin@prism.com", "Prism Super Administrator", prismTenantId, "owner");
      await upsertUser("admin@prism.com", "Prism Workspace Owner", prismTenantId, "owner");
      await upsertUser("hr@prism.com", "Ananya HR", prismTenantId, "hr-manager");
      await upsertUser("manager@prism.com", "Prism Plant Manager", prismTenantId, "manager");
      await upsertUser("payroll@prism.com", "Vikram Payroll", prismTenantId, "payroll-admin");
      await upsertUser("employee@prism.com", "Maya Employee", prismTenantId, "employee");
      await upsertUser("demo.admin@prism.com", "Prism Demo Admin", prismTenantId, "owner");

      // Update employee work_emails for Prism
      await client.query(`
        UPDATE employees
        SET work_email = lower(first_name || '.' || last_name || '@prism.com')
        WHERE tenant_id = $1 AND (work_email IS NULL OR work_email NOT LIKE '%@prism.com')
      `, [prismTenantId]);
    }

    // --- C. MKRAFT (@nucleus.com) ---
    if (mkraftTenantId) {
      console.info("Configuring Mkraft (@nucleus.com)...");
      
      // Update named employee emails
      const namedMap: Record<string, string> = {
        "superadmin@mkraft.demo": "arjun.mehta@nucleus.com",
        "hr@mkraft.demo": "priya.sharma@nucleus.com",
        "payroll@mkraft.demo": "rahul.v@nucleus.com",
        "plant.head@mkraft.demo": "suresh.kumar@nucleus.com",
        "weaving.sup@mkraft.demo": "kavita.rao@nucleus.com",
        "dyeing.sup@mkraft.demo": "mohan.das@nucleus.com",
      };

      for (const [oldE, newE] of Object.entries(namedMap)) {
        await client.query('UPDATE "user" SET email = $1 WHERE lower(email) = $2', [newE, oldE]);
      }

      // Update any remaining @mkraft.demo or @mkraft.test to @nucleus.com
      const mkraftUsers = await client.query(`
        SELECT u.id, u.email
        FROM "user" u
        JOIN memberships m ON m.user_id = u.id
        WHERE m.tenant_id = $1 AND (u.email LIKE '%@mkraft.demo' OR u.email LIKE '%@mkraft.test')
      `, [mkraftTenantId]);

      for (const u of mkraftUsers.rows) {
        const targetEmail = u.email.replace('@mkraft.demo', '@nucleus.com').replace('@mkraft.test', '@nucleus.com');
        const existing = await client.query('SELECT id FROM "user" WHERE lower(email) = $1', [targetEmail]);
        if (existing.rows.length === 0) {
          await client.query('UPDATE "user" SET email = $1 WHERE id = $2', [targetEmail, u.id]);
        }
      }

      // Standard persona accounts
      await upsertUser("superadmin@nucleus.com", "Super Administrator", mkraftTenantId, "owner");
      await upsertUser("admin@nucleus.com", "Workspace Owner", mkraftTenantId, "owner");
      await upsertUser("hr@nucleus.com", "Sunita Verma", mkraftTenantId, "hr-manager");
      await upsertUser("manager@nucleus.com", "Ramesh Nair", mkraftTenantId, "manager");
      await upsertUser("payroll@nucleus.com", "Rahul Verma", mkraftTenantId, "payroll-admin");
      await upsertUser("employee@nucleus.com", "Vikas Yadav", mkraftTenantId, "employee");
      await upsertUser("demo.admin@nucleus.com", "Nucleus Demo Admin", mkraftTenantId, "owner");

      // Populate any missing or non-matching work_email in employees table for Mkraft
      const nullEmps = await client.query(`
        SELECT id, first_name, last_name, employee_code
        FROM employees
        WHERE tenant_id = $1 AND (work_email IS NULL OR work_email NOT LIKE '%@nucleus.com')
      `, [mkraftTenantId]);

      for (const emp of nullEmps.rows) {
        const fn = (emp.first_name || "emp").toLowerCase().replace(/[^a-z0-9]/g, "");
        const ln = (emp.last_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const emailSlug = ln ? `${fn}.${ln}` : `${fn}.${emp.employee_code.toLowerCase()}`;
        const email = `${emailSlug}@nucleus.com`;
        await client.query('UPDATE employees SET work_email = $1 WHERE id = $2', [email, emp.id]);
      }

      // Ensure work_email with @mkraft.demo are updated to @nucleus.com
      await client.query(`
        UPDATE employees
        SET work_email = replace(work_email, '@mkraft.demo', '@nucleus.com')
        WHERE tenant_id = $1 AND work_email LIKE '%@mkraft.demo'
      `, [mkraftTenantId]);
    }

    // 4. Update all account passwords to SHARED_PASSWORD hash
    await client.query("UPDATE account SET password = $1", [passwordHash]);

    await client.query("COMMIT");
    console.info("Successfully normalized all company employee email domains!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
