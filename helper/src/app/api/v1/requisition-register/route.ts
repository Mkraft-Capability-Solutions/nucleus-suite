import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, ok, requestIdFrom } from "@/server/platform/http";
import {
  loadRequisitionRegisterScreen,
  previewRequisition,
  requisitionRegisterQuerySchema,
  wantsPreview,
} from "@/server/talent/requisition-register";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/requisition-register - SCR-090 "Recruitment requisitions".
 *
 * Read-only. It serves the register (requisition, position, LIVE headroom and
 * derived status), each row's state timeline and audit trail, and - when the
 * raise form carries enough fields - the verdict the establishment gate would
 * return for a requisition that has not been raised yet.
 *
 * The preview is a GET because it writes nothing. Raising and approving stay on
 * POST /api/v1/requisitions and POST /api/v1/requisitions/:id/approve, which
 * carry the Idempotency-Key and the real RL-462 gate; this route never
 * duplicates those writes, and the rule itself is never sent to the browser.
 */
export { requisitionRegisterQuerySchema };

function queryObject(params: URLSearchParams): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value !== "") entries[key] = value;
  }
  return entries;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = requisitionRegisterQuerySchema.safeParse(queryObject(new URL(request.url).searchParams));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The requisition register query is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const query = parsed.data;

    const screen = await loadRequisitionRegisterScreen(access, { planYear: query.planYear });

    const preview = wantsPreview(query)
      ? await previewRequisition(access, {
          requisitionType: query.previewRequisitionType ?? "addition",
          departmentId: query.previewDepartmentId ?? "",
          designation: query.previewDesignation ?? null,
          positions: query.previewPositions ?? 1,
          againstPositionCode: query.previewAgainstPositionCode ?? null,
          override: query.previewOverride === "true",
          overrideReason: query.previewOverrideReason ?? null,
          planYear: query.planYear,
        })
      : null;

    // Filtering is applied after the counts are taken, so the state chips keep
    // reporting the whole register rather than the slice already on screen.
    const rows = query.state ? screen.rows.filter((row) => row.displayState === query.state) : screen.rows;

    return ok({
      type: "requisition-register",
      id: String(screen.planYear),
      version: 1,
      attributes: {
        ...screen,
        rows,
        filteredState: query.state ?? null,
        total: screen.rows.length,
        preview,
      },
      requestId,
      self: "/api/v1/requisition-register",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
