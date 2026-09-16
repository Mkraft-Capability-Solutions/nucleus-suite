import "server-only";

import { sqlClient } from "@/lib/db";

export type BootstrapUser = { id: string; name: string; email: string };

export async function initialAdminSignupAvailable() {
  const rows = await sqlClient`select not exists (select 1 from "user") as available`;
  return Boolean((rows[0] as { available?: boolean } | undefined)?.available);
}

export async function bootstrapInitialTenant(user: BootstrapUser) {
  const tenantId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const ownerRoleId = crypto.randomUUID();
  const slug = `workspace-${user.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}`;
  const workspaceName = `${user.name.trim() || "MKraft"}'s Workspace`;

  await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${user.id}, true)`,
    sqlClient`select set_config('app.tenant_id', ${tenantId}, true)`,
    sqlClient`
      insert into tenants (id, name, slug)
      values (${tenantId}, ${workspaceName}, ${slug})
    `,
    sqlClient`
      insert into memberships (id, tenant_id, user_id, role, status)
      values (${membershipId}, ${tenantId}, ${user.id}, 'owner', 'active')
    `,
    sqlClient`select set_config('app.membership_id', ${membershipId}, true)`,
    sqlClient`
      insert into tenant_settings (tenant_id)
      values (${tenantId})
    `,
    sqlClient`
      insert into roles (id, tenant_id, code, name, system_managed)
      values (${ownerRoleId}, ${tenantId}, 'owner', 'Workspace Owner', true)
    `,
    sqlClient`
      insert into role_permissions (tenant_id, role_id, permission_id)
      select ${tenantId}, ${ownerRoleId}, id from permissions where status = 'active'
    `,
    sqlClient`
      insert into membership_roles (tenant_id, membership_id, role_id)
      values (${tenantId}, ${membershipId}, ${ownerRoleId})
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, after)
      values (
        ${tenantId}, ${user.id}, 'tenant.bootstrap', 'tenant', ${tenantId},
        'Initial administrator provisioning',
        ${JSON.stringify({ email: user.email, role: "owner" })}::jsonb
      )
    `,
    sqlClient`
      insert into auth_security_events (actor_user_id, target_user_id, event_type, metadata)
      values (${user.id}, ${user.id}, 'initial_admin_created', ${JSON.stringify({ tenantId })}::jsonb)
    `,
  ]);
}