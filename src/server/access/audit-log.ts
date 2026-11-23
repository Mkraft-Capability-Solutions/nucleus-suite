import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { decodeCursor, encodeCursor, HttpError } from "@/server/platform/http";

/** Read side of audit_events for the settings and access-control screens (audit.read). */

export type AuditScope = "all" | "access" | "security" | "settings" | "integrations";

const SCOPE_PREFIXES: Record<AuditScope, string[]> = {
  all: [],
  access: ["access.", "admin.role", "admin.membership", "admin.invite"],
  security: ["auth.", "access.", "admin.invite"],
  settings: ["admin.settings", "tenant."],
  integrations: ["integration."],
};

export type AuditEventView = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export function parseAuditScope(value: string | null): AuditScope {
  return value && value in SCOPE_PREFIXES ? (value as AuditScope) : "all";
}

export async function listAuditEvents(
  access: Access,
  args: { scope: AuditScope; search: string; cursor: string | null; limit: number },
): Promise<{ items: AuditEventView[]; nextCursor: string | null }> {
  enforce(access.context, "audit.read", { tenantId: access.tenantId });
  const limit = Math.min(Math.max(Math.trunc(args.limit) || 25, 1), 100);
  const cursor = decodeCursor(args.cursor);
  const cursorAt = cursor && typeof cursor.at === "string" ? cursor.at : null;
  const cursorId = cursor && typeof cursor.id === "string" ? cursor.id : null;
  if (args.cursor && (!cursorAt || !cursorId)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The pagination cursor is invalid." });
  }
  const patterns = SCOPE_PREFIXES[args.scope].map((prefix) => `${prefix}%`);
  const like = `%${args.search.replace(/[%_\\]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.action, a.entity_type, a.entity_id, a.reason, a.created_at::text as created_at,
        u.name as actor_name, u.email as actor_email
      from audit_events a
      left join "user" u on u.id = a.actor_user_id
      where a.tenant_id = ${access.tenantId}
        and (cardinality(${patterns}::text[]) = 0 or a.action like any(${patterns}::text[]))
        and (${like} = '%%' or (a.action || ' ' || a.entity_type || ' ' || coalesce(a.reason, '') || ' ' || coalesce(u.name, '')) ilike ${like})
        and (${cursorAt}::timestamptz is null or (a.created_at, a.id) < (${cursorAt}::timestamptz, ${cursorId}::uuid))
      order by a.created_at desc, a.id desc
      limit ${limit + 1}
    `,
  ]);
  const list = rows as Array<{
    id: string; action: string; entity_type: string; entity_id: string; reason: string | null;
    created_at: string; actor_name: string | null; actor_email: string | null;
  }>;
  const page = list.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: row.reason,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      createdAt: row.created_at,
    })),
    nextCursor: list.length > limit && last ? encodeCursor({ at: last.created_at, id: last.id }) : null,
  };
}

/** Quote a CSV cell and neutralise spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportAuditCsv(access: Access): Promise<string> {
  enforce(access.context, "audit.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.created_at::text as created_at, coalesce(u.email, a.actor_user_id) as actor, a.action, a.entity_type, a.entity_id, a.reason
      from audit_events a left join "user" u on u.id = a.actor_user_id
      where a.tenant_id = ${access.tenantId}
      order by a.created_at desc, a.id desc
      limit 5000
    `,
  ]);
  const header = ["ID", "Timestamp", "Actor", "Action", "Entity Type", "Entity ID", "Reason"].map(csvCell).join(",");
  const body = (rows as Array<Record<string, unknown>>).map((row) =>
    [row.id, row.created_at, row.actor, row.action, row.entity_type, row.entity_id, row.reason].map(csvCell).join(","),
  );
  return [header, ...body].join("\n");
}
