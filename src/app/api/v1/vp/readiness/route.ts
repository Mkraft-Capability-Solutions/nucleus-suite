import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { executeVpCommand, getVpReadiness, vpCommandSchema } from "@/server/vp/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const result = await getVpReadiness(access);
    return NextResponse.json({ data: result, meta: { requestId, generatedAt: new Date().toISOString() } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Idempotency-Key is required." });
    const raw = await request.json().catch(() => null);
    const parsed = vpCommandSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The VP readiness command is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const operation = `vp.${parsed.data.action}`;
    const prior = await checkIdempotency(access, operation, key, fingerprint);
    if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This idempotency key was used with a different command." });
    if (prior.outcome === "replay") return ok({ type: "vp-command", id: prior.responseLocator ?? key, version: 1, attributes: { replay: true, action: parsed.data.action }, requestId, self: "/api/v1/vp/readiness" });
    const result = await executeVpCommand(access, parsed.data, requestId);
    const resultId = typeof result === "object" && result !== null && "id" in result ? String(result.id) : key;
    await storeIdempotency(access, operation, key, fingerprint, 200, resultId);
    return ok({ type: "vp-command", id: resultId, version: 1, attributes: result, requestId, self: "/api/v1/vp/readiness" });
  } catch (error) {
    return fail(error, requestId);
  }
}
