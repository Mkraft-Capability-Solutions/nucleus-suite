import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { getPreference, setPreference } from "@/server/preferences/service";

/**
 * Multi-entity scope. Companies (legal_entities, db/migrations/0031 + 0038) form trees under a
 * root group company. A caller may work in:
 *   - every company of the organisation, when they are a group administrator (tenant.manage);
 *   - otherwise the companies they are assigned to today (employee_entity_assignments, falling back
 *     to employees.legal_entity_id) and every company below those.
 * The chosen company is stored server-side as the member preference "active_entity" and is
 * re-validated on every read, so a stale or forged value never widens access.
 */

export const ALL_GROUP_ENTITIES = "ALL_GROUP_ENTITIES" as const;

export type CompanyScope = { companyIds: string[] | "ALL" };

export type HierarchyNode = {
  id: string;
  parentId: string | null;
  rootGroupId: string;
  legalName: string;
  code: string | null;
  industryVertical: string | null;
  defaultCurrency: string;
  status: string;
  /** False for an ancestor shown only to place an accessible company in its tree. */
  selectable: boolean;
  children: HierarchyNode[];
};

export type ActiveEntity = {
  selection: { companyId: string } | typeof ALL_GROUP_ENTITIES | null;
  scope: CompanyScope;
  canSelectAll: boolean;
};

export const activeEntitySchema = z.object({
  companyId: z.union([z.literal(ALL_GROUP_ENTITIES), z.string().uuid()]),
}).strict();

type RawEntity = {
  id: string; parent_legal_entity_id: string | null; root_group_id: string | null; legal_name: string; code: string | null;
  industry_vertical: string | null; currency_code: string; status: string;
};

export function isGroupAdmin(access: Access): boolean {
  return authorize(access.context, { action: "tenant.manage", resource: { tenantId: access.tenantId } }).allowed;
}

/** Ids of `seeds` plus every descendant, given the full flat list. */
export function withDescendants(entities: ReadonlyArray<Pick<RawEntity, "id" | "parent_legal_entity_id">>, seeds: Iterable<string>): Set<string> {
  const children = new Map<string, string[]>();
  for (const entity of entities) {
    if (!entity.parent_legal_entity_id) continue;
    const list = children.get(entity.parent_legal_entity_id) ?? [];
    list.push(entity.id);
    children.set(entity.parent_legal_entity_id, list);
  }
  const known = new Set(entities.map((entity) => entity.id));
  const out = new Set<string>();
  const stack = [...seeds].filter((id) => known.has(id));
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/** Nested tree of the accessible companies plus the ancestors needed to place them. */
export function buildHierarchy(entities: readonly RawEntity[], accessible: Set<string> | "ALL"): HierarchyNode[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const visible = new Set<string>();
  for (const entity of entities) {
    if (accessible !== "ALL" && !accessible.has(entity.id)) continue;
    let cursor: RawEntity | undefined = entity;
    let steps = 0;
    while (cursor && !visible.has(cursor.id) && steps++ < 60) {
      visible.add(cursor.id);
      cursor = cursor.parent_legal_entity_id ? byId.get(cursor.parent_legal_entity_id) : undefined;
    }
  }
  const nodes = new Map<string, HierarchyNode>();
  for (const entity of entities) {
    if (!visible.has(entity.id)) continue;
    nodes.set(entity.id, {
      id: entity.id, parentId: entity.parent_legal_entity_id, rootGroupId: entity.root_group_id ?? entity.id,
      legalName: entity.legal_name, code: entity.code, industryVertical: entity.industry_vertical,
      defaultCurrency: entity.currency_code, status: entity.status,
      selectable: accessible === "ALL" || accessible.has(entity.id), children: [],
    });
  }
  const roots: HierarchyNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: HierarchyNode[]) => {
    list.sort((a, b) => a.legalName.localeCompare(b.legalName));
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

async function loadEntities(access: Access): Promise<{ entities: RawEntity[]; assigned: string[] }> {
  const employeeId = uuidOrNull(access.context.employeeId ?? null);
  const [entityRows, assignedRows] = await tenantTx(access, [
    sqlClient`
      select le.id, le.parent_legal_entity_id, le.root_group_id, le.legal_name, le.code, le.industry_vertical, le.currency_code, le.status
      from legal_entities le where le.tenant_id = ${access.tenantId} order by le.legal_name`,
    sqlClient`
      select a.legal_entity_id as id from employee_entity_assignments a
      where a.tenant_id = ${access.tenantId} and a.employee_id = ${employeeId}::uuid
        and a.effective_from <= current_date and (a.effective_to is null or a.effective_to >= current_date)
      union
      select e.legal_entity_id from employees e
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId}::uuid and e.legal_entity_id is not null`,
  ]);
  return {
    entities: entityRows as RawEntity[],
    assigned: (assignedRows as Array<{ id: string | null }>).flatMap((row) => (row.id ? [row.id] : [])),
  };
}

/** Companies the caller may scope the workspace to. */
async function accessibleCompanies(access: Access): Promise<{ entities: RawEntity[]; accessible: Set<string> | "ALL" }> {
  const { entities, assigned } = await loadEntities(access);
  return { entities, accessible: isGroupAdmin(access) ? "ALL" : withDescendants(entities, assigned) };
}

export async function getHierarchy(access: Access): Promise<{ tree: HierarchyNode[]; canSelectAll: boolean }> {
  const { entities, accessible } = await accessibleCompanies(access);
  return { tree: buildHierarchy(entities, accessible), canSelectAll: accessible === "ALL" };
}

function parseStored(value: unknown): ActiveEntity["selection"] {
  if (value === ALL_GROUP_ENTITIES) return ALL_GROUP_ENTITIES;
  const parsed = z.object({ companyId: z.string().uuid() }).safeParse(value);
  return parsed.success ? { companyId: parsed.data.companyId } : null;
}

/** Resolve a selection against what the caller may access now. */
export function resolveScope(
  entities: ReadonlyArray<Pick<RawEntity, "id" | "parent_legal_entity_id">>,
  accessible: Set<string> | "ALL",
  selection: ActiveEntity["selection"],
): CompanyScope {
  if (selection && selection !== ALL_GROUP_ENTITIES && (accessible === "ALL" || accessible.has(selection.companyId))) {
    return { companyIds: [...withDescendants(entities, [selection.companyId])] };
  }
  return { companyIds: accessible === "ALL" ? "ALL" : [...accessible] };
}

/**
 * The company scope other services filter by: `"ALL"` (no company filter) or the list of company ids.
 * An empty list means the caller has no company in scope (filter everything out).
 */
export async function activeCompanyScope(access: Access): Promise<CompanyScope> {
  return (await getActiveEntity(access)).scope;
}

export async function getActiveEntity(access: Access): Promise<ActiveEntity> {
  const [{ entities, accessible }, stored] = await Promise.all([accessibleCompanies(access), getPreference(access, "active_entity")]);
  const selection = parseStored(stored);
  return { selection, scope: resolveScope(entities, accessible, selection), canSelectAll: accessible === "ALL" };
}

export async function setActiveEntity(access: Access, input: z.infer<typeof activeEntitySchema>): Promise<ActiveEntity> {
  const { entities, accessible } = await accessibleCompanies(access);
  let selection: NonNullable<ActiveEntity["selection"]>;
  if (input.companyId === ALL_GROUP_ENTITIES) {
    if (accessible !== "ALL") {
      throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only group administrators can work across all companies of the group." });
    }
    selection = ALL_GROUP_ENTITIES;
  } else {
    // Unknown and inaccessible companies answer the same, so ids of other companies are not revealed.
    if (accessible !== "ALL" ? !accessible.has(input.companyId) : !entities.some((entity) => entity.id === input.companyId)) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The company was not found.", details: [{ field: "companyId", issue: "Not available to you." }] });
    }
    selection = { companyId: input.companyId };
  }
  await setPreference(access, "active_entity", selection);
  return { selection, scope: resolveScope(entities, accessible, selection), canSelectAll: accessible === "ALL" };
}
