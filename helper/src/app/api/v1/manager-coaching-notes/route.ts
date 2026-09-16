import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { HttpError, collection, fail, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listCoachingNotes, recordCoachingNote, recordCoachingNoteSchema } from "@/server/performance/calibration";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    parsePagination(params);
    const notes = await listCoachingNotes(access, params.get("subjectEmployeeId"));
    const items = notes.map((note) => ({ ...note, version: 1 }));
    return collection({ type: "manager-coaching-note", items, requestId, self: "/api/v1/manager-coaching-notes", nextCursor: null, total: items.length });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = recordCoachingNoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400, code: "BAD_REQUEST", message: "Check the highlighted fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "performance.coaching_note", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This idempotency key was used with a different payload." });
    }
    const result = await recordCoachingNote(access, parsed.data, requestId);
    await storeIdempotency(access, "performance.coaching_note", key, fingerprint, 201, result.id);
    return ok({ type: "manager-coaching-note", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/manager-coaching-notes/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
