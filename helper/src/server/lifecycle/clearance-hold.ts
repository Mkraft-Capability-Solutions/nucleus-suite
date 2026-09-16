import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { assertCurrentVersion, HttpError } from "@/server/platform/http";
import { deriveClearanceState } from "./clearance-board";

/**
 * Holding a no-dues item, and releasing that hold.
 *
 * `deriveClearanceState` and `clearanceBlockingSql` already recognise a `held` item and
 * already treat it as blocking, but nothing in the estate could put an item into that
 * state: `clearClearanceItem` clears and `waiveClearanceItem` waives, and there was no
 * third door. This module is that door, and nothing else.
 *
 * Release is part of the same module on purpose. `clearClearanceItem` will only clear an
 * item whose stored status is exactly `pending`, so a hold with no way back would be a
 * one-way trap that permanently blocks a settlement. Releasing writes `pending` back.
 */
export const HOLD_REASON_MIN_LENGTH = 20;

export const clearanceHoldSchema = z.object({
  action: z.enum(["hold", "release"]),
  reason: z.string().trim().min(HOLD_REASON_MIN_LENGTH).max(500),
});

export type ClearanceHoldInput = z.infer<typeof clearanceHoldSchema>;

type ItemRow = {
  id: string;
  offboarding_case_id: string;
  version: number | string | null;
  attributes: Record<string, unknown> | null;
};

/**
 * Put a blocking no-dues item on hold, or release one.
 *
 * `expectedVersion` is the If-Match precondition when the caller supplied one. It is
 * optional because the clearance board read model does not project a row version, so a
 * screen reading from it has no honest value to send; when a caller does send one it is
 * enforced.
 */
export async function setClearanceHold(
  access: Access,
  itemId: string,
  input: ClearanceHoldInput,
  expectedVersion: number | null,
  requestId: string,
): Promise<{ id: string; caseId: string; from: string; to: "held" | "pending"; version: number }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (!uuidOrNull(itemId)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, offboarding_case_id, version, attributes
      from clearance_items
      where tenant_id = ${access.tenantId} and id = ${itemId}
      limit 1
    `,
  ]);
  const item = (rows as ItemRow[])[0];
  if (!item) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  const currentVersion = Number(item.version ?? 1) || 1;
  if (expectedVersion !== null) assertCurrentVersion(expectedVersion, currentVersion);

  const from = deriveClearanceState(typeof item.attributes?.status === "string" ? (item.attributes.status as string) : null);
  if (input.action === "hold" && from !== "open") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message:
        from === "held"
          ? "This clearance item is already on hold."
          : "A settled clearance item cannot be put on hold. Only an item still open can be held.",
    });
  }
  if (input.action === "release" && from !== "held") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "Only an item that is on hold can be released.",
    });
  }

  const to = input.action === "hold" ? "held" : "pending";
  const today = new Date().toISOString().slice(0, 10);
  const patch =
    input.action === "hold"
      ? { status: "held", hold_reason: input.reason, held_on: today }
      : { status: "pending", hold_reason: null, released_on: today, release_reason: input.reason };

  await tenantTx(access, [
    sqlClient`
      update clearance_items
      set attributes = attributes || ${JSON.stringify(patch)}::jsonb,
          version = version + 1,
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${itemId} and version = ${currentVersion}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${input.action === "hold" ? "lifecycle.clearance_hold" : "lifecycle.clearance_release"},
        'clearance_item', ${itemId}, ${input.reason},
        ${JSON.stringify({ status: from })}::jsonb, ${JSON.stringify({ status: to })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id: itemId, caseId: item.offboarding_case_id, from, to, version: currentVersion + 1 };
}
