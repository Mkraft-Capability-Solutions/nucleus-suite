import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { memberships, tenants, user } from "@/lib/db/schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const tenantSettings = pgTable("tenant_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  locale: text("locale").default("en-IN").notNull(),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  currency: text("currency").default("INR").notNull(),
  policySchemaVersion: integer("policy_schema_version").default(1).notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("tenant_settings_tenant_uq").on(table.tenantId)]);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  permissionKey: text("permission_key").notNull(),
  fieldDomain: text("field_domain").default("ordinary").notNull(),
  risk: text("risk").default("standard").notNull(),
  status: text("status").default("active").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("permissions_permission_key_uq").on(table.permissionKey),
  check("permissions_status_check", sql`${table.status} in ('active', 'retired')`),
]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  systemManaged: boolean("system_managed").default(false).notNull(),
  status: text("status").default("active").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("roles_tenant_code_uq").on(table.tenantId, table.code),
  index("roles_tenant_status_idx").on(table.tenantId, table.status),
]);

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("role_permissions_tenant_role_permission_uq").on(table.tenantId, table.roleId, table.permissionId),
  index("role_permissions_tenant_role_idx").on(table.tenantId, table.roleId),
]);

export const membershipRoles = pgTable("membership_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  membershipId: uuid("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("membership_roles_tenant_membership_idx").on(table.tenantId, table.membershipId)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").default("pending").notNull(),
  invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
  acceptedUserId: text("accepted_user_id").references(() => user.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("invitations_token_hash_uq").on(table.tokenHash),
  index("invitations_tenant_status_idx").on(table.tenantId, table.status),
]);


export const authSecurityEvents = pgTable("auth_security_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("auth_security_events_target_time_idx").on(table.targetUserId, table.createdAt)]);
export const identitySchema = { tenantSettings, permissions, roles, rolePermissions, membershipRoles, invitations, authSecurityEvents };
