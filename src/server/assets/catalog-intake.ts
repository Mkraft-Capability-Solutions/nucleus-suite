import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * SCR-064 asset register intake: catalogue a new asset in `asset_catalog`, the table the
 * register read (`listAssetRegister`) and the allocate / return commands work on. A new
 * asset starts Available; allocating it is the separate, audited allocate command.
 */

const REGISTER_ACTION = "asset.register";

export const registerCatalogAssetSchema = z.object({
  assetCode: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Use letters, digits, dot, slash, underscore or hyphen."),
  assetType: z.enum(picklistValues("PL_ASSET_TYPE")),
  brand: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().min(1).max(50),
  condition: z.enum(picklistValues("PL_ASSET_CONDITION")).default("new"),
  /** Replacement value in integer minor units of `currency`. */
  replacementValueMinor: z.number().int().min(0).max(100_000_000_000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code.").optional(),
  clearanceItem: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.replacementValueMinor !== undefined && !value.currency) {
    ctx.addIssue({ code: "custom", path: ["currency"], message: "A replacement value needs its currency." });
  }
});

export type RegisterCatalogAssetInput = z.infer<typeof registerCatalogAssetSchema>;

export async function registerCatalogAsset(access: Access, input: RegisterCatalogAssetInput, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [codeRows, serialRows] = await tenantTx(access, [
    sqlClient`select id from asset_catalog where tenant_id = ${access.tenantId} and lower(attributes->>'asset_code') = ${input.assetCode.toLowerCase()} limit 1`,
    sqlClient`select attributes->>'asset_code' as asset_code from asset_catalog where tenant_id = ${access.tenantId} and lower(attributes->>'serial') = ${input.serialNumber.toLowerCase()} limit 1`,
  ]);
  if ((codeRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `Asset tag ${input.assetCode} is already registered.`, details: [{ field: "assetCode", issue: "duplicate" }] });
  }
  const serialHolder = (serialRows as Array<{ asset_code: string | null }>)[0];
  if (serialHolder) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: `Serial number ${input.serialNumber} is already registered as ${serialHolder.asset_code ?? "another asset"}.`, details: [{ field: "serialNumber", issue: "duplicate" }] });
  }
  const id = randomUUID();
  const attributes = {
    asset_code: input.assetCode,
    type: input.assetType,
    description: `${input.brand} ${input.model}`.trim(),
    brand: input.brand,
    model: input.model,
    serial: input.serialNumber,
    condition: input.condition,
    status: "Available",
    clearance_item: input.clearanceItem,
    replacement_value_minor: input.replacementValueMinor ?? null,
    currency: input.currency ?? null,
  };
  await tenantTx(access, [
    sqlClient`insert into asset_catalog (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${REGISTER_ACTION}, 'asset', ${id}, 'Asset registered', ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, assetCode: input.assetCode, status: "available" as const };
}
