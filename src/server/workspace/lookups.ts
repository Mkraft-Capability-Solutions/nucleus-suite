import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Reference lists the workspace action forms need and no other route exposes:
 * - `roles`: the tenant's active role codes, for the invitation form (membership.manage — the same
 *   permission `createInvite` enforces, so only people who can invite see the list).
 * - `document-types`: the tenant's document types, for the document upload form (employee.write — the
 *   permission `createDocument` enforces).
 * Both are tenant-scoped, read-only and bounded.
 */

export const LOOKUP_LISTS = ["roles", "document-types"] as const;
export type LookupList = (typeof LOOKUP_LISTS)[number];
export type LookupItem = { id: string; code: string; name: string };

export function isLookupList(value: string): value is LookupList {
  return (LOOKUP_LISTS as readonly string[]).includes(value);
}

export async function listLookup(access: Access, list: LookupList, search: string): Promise<LookupItem[]> {
  const needle = `%${search.trim().slice(0, 80)}%`;
  switch (list) {
    case "roles": {
      enforce(access.context, "membership.manage", { tenantId: access.tenantId });
      const [rows] = await tenantTx(access, [
        sqlClient`select id, code, name from roles
                   where tenant_id = ${access.tenantId} and status = 'active' and (name ilike ${needle} or code ilike ${needle})
                   order by name asc, id asc limit 200`,
      ]);
      return rows as LookupItem[];
    }
    case "document-types": {
      enforce(access.context, "employee.write", { tenantId: access.tenantId });
      const [rows] = await tenantTx(access, [
        sqlClient`select id, coalesce(attributes->>'code', '') as code,
                         coalesce(attributes->>'name', attributes->>'code', 'Unnamed type') as name
                    from document_types
                   where tenant_id = ${access.tenantId}
                     and coalesce(attributes->>'name', attributes->>'code', '') ilike ${needle}
                   order by 3 asc, id asc limit 200`,
      ]);
      return rows as LookupItem[];
    }
    default: {
      const unreachable: never = list;
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: `Unknown reference list ${String(unreachable)}.` });
    }
  }
}
