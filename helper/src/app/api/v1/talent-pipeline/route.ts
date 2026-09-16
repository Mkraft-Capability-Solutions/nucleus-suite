import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import {
  ADVERSE_IMPACT_AVAILABLE_INPUTS,
  ADVERSE_IMPACT_INPUTS,
  BOARD_COLUMNS,
  TALENT_PIPELINE_VIEWS,
  adverseImpactReadiness,
  loadInterviewOverview,
  loadPipelineBoard,
  loadReferralLedger,
} from "@/server/talent/pipeline";

export const dynamic = "force-dynamic";

/**
 * SCR-090 read model. One screen, four read views, no writes.
 *
 * Every state change the screen can make already has an endpoint that owns its
 * rule: POST /api/v1/applications/:id/advance (one step forward only),
 * POST /api/v1/requisitions and :id/approve (the establishment gate),
 * POST /api/v1/applications/:id/score (exactly one integer, with findings),
 * POST /api/v1/referrals. Nothing here duplicates any of them.
 */
export const talentPipelineQuerySchema = z.object({
  view: z.enum(TALENT_PIPELINE_VIEWS).default("board"),
  requisitionId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = talentPipelineQuerySchema.safeParse({
      view: params.get("view") ?? undefined,
      requisitionId: params.get("requisitionId") || undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: `The talent pipeline query is invalid. Known views: ${TALENT_PIPELINE_VIEWS.join(", ")}.`,
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const { view, requisitionId } = parsed.data;
    const self = `/api/v1/talent-pipeline?view=${view}`;

    if (view === "referrals") {
      const ledger = await loadReferralLedger(access);
      return ok({ type: "talent-pipeline", id: view, version: 1, attributes: { view, ...ledger }, requestId, self });
    }

    if (view === "interviews") {
      const overview = await loadInterviewOverview(access);
      return ok({
        type: "talent-pipeline",
        id: view,
        version: 1,
        attributes: {
          view,
          ...overview,
          // Panel cards stay sealed until debrief; the loader already withholds
          // other members' ratings, and the screen states the rule.
          sealUntilDebrief: true,
        },
        requestId,
        self,
      });
    }

    if (view === "fairness") {
      // No protected attribute is captured anywhere in this product, so there is
      // nothing to compute a selection-rate ratio from. The endpoint returns the
      // requirements and the gap, and deliberately returns no figure.
      const readiness = adverseImpactReadiness(ADVERSE_IMPACT_AVAILABLE_INPUTS);
      return ok({
        type: "talent-pipeline",
        id: view,
        version: 1,
        attributes: {
          view,
          requirements: ADVERSE_IMPACT_INPUTS,
          readiness,
          demographicColumnsPresent: false,
          existingStance:
            "The only existing position this repository takes on adverse impact is a test named \"forbids adverse automated use\". No metric, threshold or report exists behind it.",
        },
        requestId,
        self,
      });
    }

    const board = await loadPipelineBoard(access, { requisitionId: requisitionId ?? null });
    return ok({
      type: "talent-pipeline",
      id: view,
      version: 1,
      attributes: {
        view,
        columnDefinitions: BOARD_COLUMNS,
        ...board,
        advisory:
          "The match score is assistive. It rejects nobody, it is never used to order candidates against one another, and every score can show the findings and evidence it rests on.",
      },
      requestId,
      self,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
