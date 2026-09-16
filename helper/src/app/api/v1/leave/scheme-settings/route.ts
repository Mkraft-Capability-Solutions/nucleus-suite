import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { leaveSchemeGaps, loadLeaveScheme, saveLeaveSchemeSettings, saveLeaveSchemeSettingsSchema } from "@/server/leave/configuration";

export const dynamic = "force-dynamic";

/** FRM-LVE-01 header: the scheme-level rules the accrual and lapse runs read. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const scheme = await loadLeaveScheme(access);
    return ok({
      type: "leave-scheme-settings",
      id: "scheme",
      version: 1,
      attributes: {
        seniorGradeRank: scheme.seniorGradeRank,
        coffLapseDays: scheme.coffLapseDays,
        coffLapseDayBasis: scheme.coffLapseDayBasis,
        gaps: leaveSchemeGaps(scheme),
      },
      requestId,
      self: "/api/v1/leave/scheme-settings",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = saveLeaveSchemeSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The leave scheme settings payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await saveLeaveSchemeSettings(access, parsed.data, requestId);
    return ok({
      type: "leave-scheme-settings",
      id: "scheme",
      version: 1,
      attributes: {
        seniorGradeRank: result.scheme.seniorGradeRank,
        coffLapseDays: result.scheme.coffLapseDays,
        coffLapseDayBasis: result.scheme.coffLapseDayBasis,
        gaps: result.gaps,
      },
      requestId,
      self: "/api/v1/leave/scheme-settings",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
