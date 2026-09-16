import { createHash } from "node:crypto";
import { z } from "zod";
import { resolveWorkforcePolicy } from "@/lib/workforce-policy";
import { advanceContext, requestAdvance, requestAdvanceSchema } from "@/server/advances/service";
import { checkIdempotency, enforce, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";

/**
 * Earned wage access — the earned-to-date position and the draw that is measured
 * against it.
 *
 * Why this route exists rather than a flag on `/api/v1/salary-advances`:
 * `requestAdvance` caps a draw at `min(monthly basic, earned to date)`, i.e. the
 * WHOLE earned wage. `workforcePolicy.earnedWage.maxEarnedPercent` (50 by default,
 * tenant-overridable) is the earned-wage-access rule, and nothing on the server
 * read it — the cap existed only as screen copy, which is not a control. This
 * route applies it before delegating, so the ceiling is enforced on the server and
 * cannot be bypassed by calling the API directly.
 *
 * The ceiling is only computable when the rule pack supplies an earned-wage
 * proration basis (`advances.earnedWageProrationBasis`). While that is unapproved
 * `advanceContext` returns `earnedToDateMinor: null`, and a percentage of an
 * unknown figure is not a number anybody may draw against: the draw is refused and
 * the reason is named, rather than silently falling back to the looser ceiling.
 *
 *   GET  ?employeeId=<uuid>  -> { maxEarnedPercent, earnedToDateMinor, ceilingMinor, ... }
 *   POST (Idempotency-Key)   -> validates the draw against ceilingMinor, then files
 *                               it through the existing salary-advance workflow.
 */
export const dynamic = "force-dynamic";

const employeeIdSchema = z.string().uuid();

/** The share of earned wage a draw may not exceed, and the ceiling it produces. */
function earnedWageCeiling(earnedToDateMinor: number | null): { maxEarnedPercent: number; ceilingMinor: number | null } {
  const { maxEarnedPercent } = resolveWorkforcePolicy().earnedWage;
  return {
    maxEarnedPercent,
    // Floor, never round: rounding up would hand out a rupee above the policy ceiling.
    ceilingMinor: earnedToDateMinor === null ? null : Math.floor((earnedToDateMinor * maxEarnedPercent) / 100),
  };
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "payroll.read", { tenantId: access.tenantId });
    const employeeId = employeeIdSchema.safeParse(new URL(request.url).searchParams.get("employeeId"));
    if (!employeeId.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An employeeId is required." });
    }
    const context = await advanceContext(access, employeeId.data);
    const { maxEarnedPercent, ceilingMinor } = earnedWageCeiling(context.earnedToDateMinor);
    return ok({
      type: "earned-wage-access",
      id: employeeId.data,
      version: 1,
      attributes: {
        employeeId: employeeId.data,
        maxEarnedPercent,
        earnedToDateMinor: context.earnedToDateMinor,
        ceilingMinor,
        /** Null `ceilingMinor` always carries the reason; the screen prints it verbatim. */
        unavailableReason:
          ceilingMinor === null
            ? "The earned-wage proration basis (rule pack: advances.earnedWageProrationBasis) has no approved value, so wage earned to date cannot be derived and the cap cannot be applied."
            : null,
        advancesYtd: context.advancesYtd,
        annualCap: context.annualCap,
      },
      requestId,
      self: `/api/v1/earned-wage-access?employeeId=${employeeId.data}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = requestAdvanceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "An employee, amount, recovery period and reason are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }

    // The cap is applied here, before anything is written. `requestAdvance` then
    // applies its own (looser) ceiling, the recovery-period rule, the annual
    // instance cap and the open-exposure interlock on top.
    const context = await advanceContext(access, parsed.data.employeeId);
    const { maxEarnedPercent, ceilingMinor } = earnedWageCeiling(context.earnedToDateMinor);
    if (ceilingMinor === null) {
      throw new HttpError({
        status: 422,
        code: "RULE_PACK_INCOMPLETE",
        message:
          "Wage earned to date cannot be derived until the rule pack's earned-wage proration basis is approved, so the earned-wage cap cannot be applied. No draw can be issued.",
      });
    }
    if (parsed.data.amountMinor > ceilingMinor) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: `An earned-wage draw may not exceed ${maxEarnedPercent}% of wage earned to date.`,
        details: [{ field: "amountMinor", issue: `The ceiling for this employee this period is ${ceilingMinor} minor units.` }],
      });
    }

    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "earned_wage.draw", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await requestAdvance(access, parsed.data, requestId);
    await storeIdempotency(access, "earned_wage.draw", key, fingerprint, 201, result.id);
    return ok({
      type: "earned-wage-access",
      id: result.id,
      version: 1,
      attributes: { ...result, ceilingMinor, maxEarnedPercent, earnedToDateMinor: context.earnedToDateMinor },
      requestId,
      self: `/api/v1/salary-advances/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
