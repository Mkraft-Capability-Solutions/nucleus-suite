import { nucleusActionsFor } from "@/lib/ai/nucleus-catalog";
import { buildLiveSetup, liveModel, liveSocketUrl, mintEphemeralToken } from "@/server/ai/nucleus/session";
import { startRun } from "@/server/ai/service";
import { enforce, requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/ai/nucleus/session
 *
 * Opens a Nucleus AI voice session: resolves what this caller may see and do,
 * binds that into a single-use Gemini token, and hands the browser the token
 * plus the exact setup message it must echo. The API key stays here.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });

    const today = new Date().toISOString().slice(0, 10);
    const setup = buildLiveSetup(access, {
      today,
      tenantId: access.tenantId,
      roles: access.context.roles,
      employeeId: access.context.employeeId ?? null,
    });
    const minted = await mintEphemeralToken(setup);

    // The run anchors the transcript. A reader-only caller cannot open one, and
    // that must not cost them the conversation — the session proceeds with no
    // stored transcript and the response says so, rather than failing.
    let runId: string | null = null;
    try {
      runId = (await startRun(access, { workflowCode: "nucleus-live" })).id;
    } catch {
      runId = null;
    }

    return ok({
      type: "nucleus-session",
      id: minted.token.slice(-12),
      version: 1,
      attributes: {
        token: minted.token,
        socketUrl: liveSocketUrl(minted.token),
        model: liveModel(),
        setup,
        runId,
        transcriptRecorded: runId !== null,
        expiresAt: minted.expiresAt,
        actions: nucleusActionsFor(access.context.permissions).map((action) => ({
          name: action.name,
          summary: action.summary,
          method: action.operation.method,
          path: action.operation.path,
        })),
      },
      requestId,
      self: "/api/v1/ai/nucleus/session",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
