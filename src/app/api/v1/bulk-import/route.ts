import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { bulkImportSchema, runBulkImport } from "@/server/organization/bulk-import";
import { entitlementConfig, requireEntitlement } from "@/server/entitlements/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/bulk-import — employees, attendance punches, leave credits or candidates.
 * Signed-in, tenant scoped, per-type permission; Idempotency-Key required; `dryRun: true` validates only.
 * Returns a per-row report (created / valid / rejected with reason).
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = bulkImportSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The import is not valid." });
    }
    // The organisation must have the matching module switched on, and its own row limit applies.
    const kind = parsed.data.importType;
    await requireEntitlement(access, kind === "employee" ? "people.records.bulk_import"
      : kind === "biometric" || kind === "attendance" ? "attendance.punches"
      : kind === "leave" ? "leave.balances" : "recruitment.candidates");
    const maxRows = Number((await entitlementConfig(access, "people.records")).bulkImportMaxRows ?? 500);
    if (parsed.data.records.length > maxRows) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `This organisation imports at most ${maxRows} rows per file.` });
    }
    if (parsed.data.dryRun) {
      const preview = await runBulkImport(access, parsed.data, requestId);
      return ok({ type: "bulk-import", id: requestId, version: 1, attributes: preview, requestId, self: "/api/v1/bulk-import" });
    }
    const key = requireIdempotencyKey(request.headers);
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "bulk_import", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different file." });
    }
    if (prior.outcome === "replay") {
      throw new HttpError({ status: 409, code: "ALREADY_IMPORTED", message: "This file was already imported." });
    }
    const result = await runBulkImport(access, parsed.data, requestId);
    await storeIdempotency(access, "bulk_import", key, fingerprint, 200, requestId);
    return ok({ type: "bulk-import", id: requestId, version: 1, attributes: result, requestId, self: "/api/v1/bulk-import" });
  } catch (error) {
    return fail(error, requestId);
  }
}
