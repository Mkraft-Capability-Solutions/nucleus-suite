import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { clearanceHoldSchema, HOLD_REASON_MIN_LENGTH, setClearanceHold } from "@/server/lifecycle/clearance-hold";

/**
 * POST /api/v1/offboarding/items/:id/hold — hold a no-dues item, or release that hold.
 *
 * Body: `{ action: "hold" | "release", reason }`. `If-Match` is honoured when supplied
 * and, being a precondition rather than a payload, is optional: the clearance board read
 * model does not project a row version for a screen to send.
 */
export const dynamic = "force-dynamic";

function claimedVersion(headers: Headers): number | null {
  const raw = headers.get("if-match")?.trim();
  if (!raw) return null;
  const version = Number(raw.replace(/^"|"$/g, ""));
  if (!Number.isInteger(version) || version < 1) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The If-Match version is invalid." });
  }
  return version;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const version = claimedVersion(request.headers);
    const parsed = clearanceHoldSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: `Holding or releasing a clearance item needs an action and a reason of at least ${HOLD_REASON_MIN_LENGTH} characters.`,
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", issue: issue.message })),
      });
    }
    const result = await setClearanceHold(access, id, parsed.data, version, requestId);
    return ok({
      type: "clearance-item",
      id: result.id,
      version: result.version,
      attributes: result,
      requestId,
      self: `/api/v1/offboarding/clearance-board/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
