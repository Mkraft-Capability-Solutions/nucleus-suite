import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { ESTABLISHMENT_STATE_LABELS, OVERRIDE_REASON_MIN_LENGTH, REQUISITION_TYPES, listEstablishment } from "@/server/talent/establishment";
import { loadRequisitionRegister, previewRequisitionDecision } from "@/server/talent/pipeline";

export const dynamic = "force-dynamic";

/**
 * SCR-090 tab two: approved manpower, the requisition register, and the live
 * headroom preview behind the create-requisition form.
 *
 * The preview is a GET, not a POST, because it writes nothing: it resolves the
 * sanction key and runs the same `decideRequisition` the approval path runs, so
 * the browser is told the block reason before submitting without ever holding a
 * copy of the rule. Raising and approving a requisition remain POSTs on
 * /api/v1/requisitions and /api/v1/requisitions/:id/approve, which carry the
 * Idempotency-Key and the real establishment gate.
 */
export const establishmentQuerySchema = z.object({
  planYear: z.coerce.number().int().min(2000).max(2200).optional(),
  /** Present only while the form is being filled in. */
  previewRequisitionType: z.enum(REQUISITION_TYPES).optional(),
  previewDepartmentId: z.string().uuid().optional(),
  previewDesignation: z.string().trim().min(1).max(120).optional(),
  previewPositions: z.coerce.number().int().min(1).max(99).optional(),
  previewAgainstPositionCode: z.string().trim().max(40).optional(),
  previewOverride: z.enum(["true", "false"]).optional(),
  previewOverrideReason: z.string().trim().max(1000).optional(),
});

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
    const params = new URL(request.url).searchParams;
    const parsed = establishmentQuerySchema.safeParse(queryObject(params));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The establishment query is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const query = parsed.data;

    const [lines, requisitions] = await Promise.all([
      listEstablishment(access, { planYear: query.planYear }),
      loadRequisitionRegister(access),
    ]);

    // A replacement never needs a designation; an addition always does.
    const wantsPreview =
      query.previewRequisitionType === "replacement"
        ? Boolean(query.previewAgainstPositionCode)
        : Boolean(query.previewRequisitionType && query.previewDepartmentId && query.previewDesignation);

    const preview = wantsPreview
      ? await previewRequisitionDecision(access, {
          requisitionType: query.previewRequisitionType ?? "addition",
          departmentId: query.previewDepartmentId ?? "",
          designation: query.previewDesignation ?? "",
          positions: query.previewPositions ?? 1,
          againstPositionCode: query.previewAgainstPositionCode ?? null,
          override: query.previewOverride === "true",
          overrideReason: query.previewOverrideReason ?? null,
          planYear: query.planYear,
        })
      : null;

    return ok({
      type: "establishment",
      id: String(query.planYear ?? new Date().getUTCFullYear()),
      version: 1,
      attributes: {
        planYear: query.planYear ?? new Date().getUTCFullYear(),
        // Empty means establishment control has not been adopted; the screen says
        // so rather than drawing a board full of zeroes.
        configured: lines.length > 0,
        stateLabels: ESTABLISHMENT_STATE_LABELS,
        overrideReasonMinLength: OVERRIDE_REASON_MIN_LENGTH,
        overrideRequiredPermission: "workforce.manpower.approve",
        lines,
        requisitions,
        preview,
      },
      requestId,
      self: "/api/v1/establishment",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
