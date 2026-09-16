import "server-only";

import { sqlClient } from "@/lib/db";
import {
  erpOwnershipCoverage,
  erpSettingsSchema,
  type ErpOwnershipCoverage,
  type ErpSettings,
} from "@/lib/erp-field-ownership";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * FRM-FIN-02 storage. One settings envelope per ERP connection, kept under
 * `integration_connections.attributes.erp_settings`: the connection is the ERP
 * link, so the ownership map, match key and conflict policy belong to it and no
 * new table is needed. The sync (`erp-sync.ts`) reads the same key through
 * `resolveErpSettings`, so what the form saves is exactly what the sync obeys.
 */

const ERP_SETTINGS_KEY = "erp_settings";

type ConnectionRow = {
  id: string;
  version: number | string;
  attributes: Record<string, unknown>;
  catalog: Record<string, unknown> | null;
  updated_at: string;
};

export type ErpSettingsView = {
  connectionId: string;
  version: number;
  catalogCode: string | null;
  environment: string | null;
  /** Null until the form has been saved for this connection. */
  settings: ErpSettings | null;
  coverage: ErpOwnershipCoverage;
  updatedAt: string;
};

function parseStored(connectionId: string, raw: unknown): ErpSettings | null {
  if (raw === null || raw === undefined) return null;
  const parsed = erpSettingsSchema.safeParse({ ...(typeof raw === "object" ? raw : {}), connectionId });
  return parsed.success ? parsed.data : null;
}

function view(row: ConnectionRow): ErpSettingsView {
  const settings = parseStored(row.id, row.attributes[ERP_SETTINGS_KEY]);
  return {
    connectionId: row.id,
    version: Number(row.version ?? 1),
    catalogCode: typeof row.catalog?.code === "string" ? row.catalog.code : null,
    environment: typeof row.attributes.environment === "string" ? row.attributes.environment : null,
    settings,
    coverage: erpOwnershipCoverage(settings?.fieldOwners ?? {}),
    updatedAt: row.updated_at,
  };
}

async function loadConnections(access: Access): Promise<ConnectionRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select c.id, c.version, c.attributes, k.attributes as catalog, c.updated_at::text as updated_at
      from integration_connections c
      left join integration_catalog k on k.id = c.integration_catalog_id
      where c.tenant_id = ${access.tenantId}
      order by c.created_at desc limit 100
    `,
  ]);
  return rows as ConnectionRow[];
}

/** Every connection, with its ERP settings when they have been saved. */
export async function listErpSettings(access: Access): Promise<ErpSettingsView[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  return (await loadConnections(access)).map(view);
}

/** Save the form for one connection. The schema already blocks an incomplete mandatory map. */
export async function saveErpSettings(access: Access, input: ErpSettings, requestId: string): Promise<ErpSettingsView> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const { connectionId, ...stored } = input;
  const [updated] = await tenantTx(access, [
    sqlClient`
      update integration_connections
      set attributes = attributes || jsonb_build_object(${ERP_SETTINGS_KEY}::text, ${JSON.stringify(stored)}::jsonb),
          version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${connectionId}
      returning id
    `,
  ]);
  if ((updated as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.erp_settings_saved', 'integration_connection', ${connectionId}, 'ERP field ownership saved',
        ${JSON.stringify(stored)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  const row = (await loadConnections(access)).find((candidate) => candidate.id === connectionId);
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return view(row);
}

export type ErpSettingsChoice =
  | { action: "use"; settings: ErpSettings }
  | { action: "refuse"; code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED" | "ERP_CONNECTION_AMBIGUOUS" | "NOT_FOUND"; message: string };

/**
 * Which saved settings govern a sync. Pure: the Q-15 posture is a decision,
 * and it is asserted without a database.
 *
 * With a connection id the settings must be that connection's own. Without one
 * the tenant must have exactly one configured ERP connection — two would leave
 * the sync guessing which ownership map to obey, and none means nobody has yet
 * said which system owns which field, so nothing may be overwritten.
 */
export function chooseErpSettings(
  candidates: Array<{ connectionId: string; settings: ErpSettings | null }>,
  connectionId: string | null,
): ErpSettingsChoice {
  if (connectionId) {
    const match = candidates.find((candidate) => candidate.connectionId === connectionId);
    if (!match) return { action: "refuse", code: "NOT_FOUND", message: "The requested record was not found." };
    if (!match.settings) {
      return {
        action: "refuse",
        code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED",
        message: "This ERP connection has no field-ownership map. Which system owns which employee field (Q-15) must be recorded on the ERP integration form before a sync can write anything.",
      };
    }
    return { action: "use", settings: match.settings };
  }
  const configured = candidates.filter((candidate): candidate is { connectionId: string; settings: ErpSettings } => candidate.settings !== null);
  if (configured.length === 0) {
    return {
      action: "refuse",
      code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED",
      message: "No ERP connection has a field-ownership map. Which system owns which employee field (Q-15) must be recorded on the ERP integration form before a sync can write anything.",
    };
  }
  if (configured.length > 1) {
    return {
      action: "refuse",
      code: "ERP_CONNECTION_AMBIGUOUS",
      message: `${configured.length} ERP connections are configured; the sync must name its connectionId so the right ownership map is applied.`,
    };
  }
  return { action: "use", settings: configured[0].settings };
}

/** The settings a sync must obey, or a named refusal. */
export async function resolveErpSettings(access: Access, connectionId: string | null): Promise<ErpSettings> {
  const candidates = (await loadConnections(access)).map((row) => ({ connectionId: row.id, settings: parseStored(row.id, row.attributes[ERP_SETTINGS_KEY]) }));
  const choice = chooseErpSettings(candidates, connectionId);
  if (choice.action === "refuse") {
    throw new HttpError({ status: choice.code === "NOT_FOUND" ? 404 : 422, code: choice.code, message: choice.message });
  }
  return choice.settings;
}
