import { hashPassword } from "better-auth/crypto";
import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain01(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 01: Identity, Tenants, Roles & Security...");

  // 1. Ensure platform_admin setting for RLS bypass during seeding
  await client`SELECT set_config('app.platform_admin', 'true', false)`;

  // 2. Tenants: ensure tenant exists
  const existingTenant = await client`SELECT id FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  if (existingTenant.length === 0) {
    console.log(`  [SEED] Tenant ${tenantId} does not exist. Creating tenant.`);
    await client`
      INSERT INTO tenants (id, name, slug, legal_name, default_currency, timezone, status)
      VALUES (${tenantId}, 'MKraft', 'mkraft', 'Mkraft Textiles Pvt Ltd', 'INR', 'Asia/Kolkata', 'active')
    `;
  } else {
    await client`
      UPDATE tenants 
      SET name = 'MKraft', legal_name = 'Mkraft Textiles Pvt Ltd', slug = 'mkraft', status = 'active'
      WHERE id = ${tenantId}
    `;
  }

  // 3. Tenant settings
  if (!(await hasData(client, "tenant_settings"))) {
    console.log("  [SEED] tenant_settings is empty. Inserting settings.");
    await client`
      INSERT INTO tenant_settings (tenant_id, locale, timezone, currency)
      VALUES (${tenantId}, 'en-IN', 'Asia/Kolkata', 'INR')
    `;
  } else {
    console.log("  [CHECK] tenant_settings already has data. Updating.");
    await client`
      UPDATE tenant_settings 
      SET locale = 'en-IN', timezone = 'Asia/Kolkata', currency = 'INR'
      WHERE tenant_id = ${tenantId}
    `;
  }

  // 4. Tenant domains
  if (!(await hasData(client, "tenant_domains"))) {
    console.log("  [SEED] tenant_domains is empty. Inserting domains.");
    for (const domain of ["brigtenz.tech", "brightenz.tech", "mkraft.demo", "hrms.mkraft.local", "portal.mkraft.com"]) {
      await client`
        INSERT INTO tenant_domains (id, tenant_id, domain, verification_status, verified_at)
        VALUES (${uuid()}, ${tenantId}, ${domain}, 'verified', now())
      `;
    }
  } else {
    console.log("  [CHECK] tenant_domains already has data. Skipping.");
  }

  // 5. Tenant features
  if (!(await hasData(client, "tenant_features"))) {
    console.log("  [SEED] tenant_features is empty. Inserting features.");
    const features = ["ai_copilot", "payroll_automation", "biometric_sync", "recruitment_portal", "performance_reviews", "compliance_calendar"];
    for (const key of features) {
      await client`
        INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, config)
        VALUES (${uuid()}, ${tenantId}, ${key}, true, ${JSON.stringify({ tier: "enterprise", activated_at: "2024-01-01" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] tenant_features already has data. Skipping.");
  }

  // 6. Global permissions if missing
  const allPermissions = [
    "tenant.read", "tenant.write",
    "employee.read", "employee.write",
    "attendance.read", "attendance.write",
    "leave.read", "leave.write", "leave.approve",
    "payroll.read", "payroll.write", "payroll.run", "payroll.rate.read",
    "role.manage", "membership.manage", "membership.read",
    "recruitment.read", "recruitment.write",
    "performance.read", "performance.write",
    "compliance.read", "compliance.write"
  ];
  for (const perm of allPermissions) {
    await client`
      INSERT INTO permissions (id, permission_key, field_domain, risk, status)
      VALUES (${uuid()}, ${perm}, 'ordinary', 'standard', 'active')
      ON CONFLICT (permission_key) DO NOTHING
    `;
  }

  // 7. Roles & Role Permissions
  const roles = [
    { code: "owner", name: "Workspace Owner" },
    { code: "hr-manager", name: "HR Manager" },
    { code: "payroll-admin", name: "Payroll Administrator" },
    { code: "manager", name: "People Manager" },
    { code: "employee", name: "Standard Employee" },
    { code: "auditor", name: "Internal Auditor" },
    { code: "compliance-officer", name: "Compliance Officer" }
  ];
  for (const r of roles) {
    const existing = await client`SELECT id FROM roles WHERE tenant_id = ${tenantId} AND code = ${r.code} LIMIT 1`;
    let roleId = existing[0]?.id;
    if (!roleId) {
      roleId = uuid();
      await client`
        INSERT INTO roles (id, tenant_id, code, name, system_managed)
        VALUES (${roleId}, ${tenantId}, ${r.code}, ${r.name}, true)
      `;
    }
    ctx.roleIds[r.code] = roleId;

    const permissionsByRole: Record<string, string[]> = {
      owner: allPermissions,
      "hr-manager": [
        "tenant.read", "employee.read", "employee.write",
        "attendance.read", "attendance.write",
        "leave.read", "leave.write", "leave.approve",
        "payroll.read", "payroll.write", "payroll.run", "payroll.rate.read",
        "role.manage", "membership.manage", "membership.read",
        "recruitment.read", "recruitment.write",
        "performance.read", "performance.write",
        "compliance.read", "compliance.write"
      ],
      "payroll-admin": [
        "tenant.read", "employee.read", "attendance.read",
        "payroll.read", "payroll.write", "payroll.run", "payroll.rate.read",
        "compliance.read"
      ],
      "manager": [
        "tenant.read", "employee.read",
        "attendance.read", "attendance.write",
        "leave.read", "leave.write", "leave.approve",
        "performance.read", "performance.write",
        "membership.read"
      ],
      "employee": [
        "tenant.read", "employee.read",
        "attendance.read",
        "leave.read", "leave.write",
        "performance.read"
      ],
      "auditor": [
        "tenant.read", "employee.read", "attendance.read", "leave.read", "payroll.read", "compliance.read"
      ],
      "compliance-officer": [
        "tenant.read", "employee.read", "compliance.read", "compliance.write"
      ]
    };

    const perms = permissionsByRole[r.code] || ["tenant.read", "employee.read"];
    await client`
      INSERT INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT ${tenantId}, ${roleId}, id FROM permissions 
      WHERE permission_key = ANY(${perms})
      ON CONFLICT DO NOTHING
    `;
  }

  // 7b. Provision 5 Brightenz Role Accounts & Admin/Demo Users with password Brightenz@2026!
  const defaultPasswordHash = await hashPassword("Brightenz@2026!");
  const coreAccounts = [
    { email: "superadmin@brigtenz.tech", name: "Brightenz Superadmin", role: "owner" },
    { email: "admin@brigtenz.tech", name: "Brightenz Administrator", role: "owner" },
    { email: "hr@brigtenz.tech", name: "Brightenz HR Manager", role: "hr-manager" },
    { email: "manager@brigtenz.tech", name: "Brightenz People Manager", role: "manager" },
    { email: "employee@brigtenz.tech", name: "Brightenz Employee", role: "employee" },
    { email: "admin@mkraft.local", name: "MKraft Administrator", role: "owner" },
    { email: "demo@mkraft.local", name: "Demo User", role: "owner" }
  ];

  for (const u of coreAccounts) {
    const existing = await client`SELECT id FROM "user" WHERE lower(email) = ${u.email.toLowerCase()} LIMIT 1`;
    let userId = existing[0]?.id;
    if (!userId) {
      userId = uuid();
      await client`
        INSERT INTO "user" (id, name, email, email_verified, status)
        VALUES (${userId}, ${u.name}, ${u.email.toLowerCase()}, true, 'active')
      `;
    }
    await client`
      INSERT INTO account (id, account_id, provider_id, user_id, password)
      VALUES (${uuid()}, ${userId}, 'credential', ${userId}, ${defaultPasswordHash})
      ON CONFLICT (provider_id, account_id) DO UPDATE SET password = ${defaultPasswordHash}
    `;

    // Ensure membership
    const existingMem = await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} AND user_id = ${userId} LIMIT 1`;
    let memId = existingMem[0]?.id;
    if (!memId) {
      memId = uuid();
      await client`
        INSERT INTO memberships (id, tenant_id, user_id, role, status)
        VALUES (${memId}, ${tenantId}, ${userId}, ${u.role === 'manager' || u.role === 'hr-manager' || u.role === 'owner' ? u.role : 'employee'}, 'active')
      `;
    } else {
      await client`
        UPDATE memberships 
        SET role = ${u.role === 'manager' || u.role === 'hr-manager' || u.role === 'owner' ? u.role : 'employee'}, status = 'active'
        WHERE id = ${memId}
      `;
    }
    const roleId = ctx.roleIds[u.role] || ctx.roleIds.owner;
    await client`
      INSERT INTO membership_roles (tenant_id, membership_id, role_id)
      VALUES (${tenantId}, ${memId}, ${roleId})
      ON CONFLICT DO NOTHING
    `;
  }

  // 8. API Clients & API Keys
  if (!(await hasData(client, "api_clients"))) {
    console.log("  [SEED] api_clients is empty. Inserting records.");
    const apiClientId = uuid();
    await client`
      INSERT INTO api_clients (id, tenant_id, attributes)
      VALUES (${apiClientId}, ${tenantId}, ${JSON.stringify({ name: "Biometric Device Gateway", client_code: "BIO-GW-01", trusted: true })}::jsonb)
    `;

    if (!(await hasData(client, "api_keys"))) {
      await client`
        INSERT INTO api_keys (id, tenant_id, api_client_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${apiClientId}, ${JSON.stringify({ name: "Primary Production Key", key_prefix: "mk_live_", expires_at: "2027-12-31" })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] api_clients already has data. Skipping.");
  }

  // 9. Verification table (Better-Auth legacy table)
  if (!(await hasData(client, "verification", false))) {
    console.log("  [SEED] verification table is empty. Inserting demo record.");
    await client`
      INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
      VALUES (${uuid()}, 'demo-verification', 'token_demo_123', now() + interval '1 year', now(), now())
    `;
  }

  // 10. Auth Security Events (legacy audit table)
  if (!(await hasData(client, "auth_security_events", false))) {
    console.log("  [SEED] auth_security_events is empty. Inserting demo event.");
    await client`
      INSERT INTO auth_security_events (id, event_type, metadata, created_at)
      VALUES (${uuid()}, 'login_success', ${JSON.stringify({ ip: '127.0.0.1', user_agent: 'Antigravity/2.0' })}::jsonb, now())
    `;
  }

  // 11. Session table (Better-Auth active session)
  if (!(await hasData(client, "session", false))) {
    console.log("  [SEED] session table is empty. Inserting active demo session.");
    const adminUser = await client`SELECT id FROM "user" WHERE email = 'superadmin@brigtenz.tech' LIMIT 1`;
    if (adminUser[0]) {
      await client`
        INSERT INTO "session" (id, token, user_id, expires_at, created_at, updated_at)
        VALUES (${uuid()}, 'demo_active_session_token_brightenz', ${adminUser[0].id}, now() + interval '30 days', now(), now())
      `;
    }
  }

  console.log("✓ Domain 01 seeded successfully.");
}

