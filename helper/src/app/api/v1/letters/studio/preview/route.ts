import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { previewStudioLetter, studioPreviewSchema } from "@/server/letters/studio";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/letters/studio/preview — one template merged for one employee.
 *
 * Returns the merged subject and body together with every token's resolved value and
 * the column it came from, so the studio can show the provenance rather than ask the
 * reader to trust it. A token with no source is returned with `value: null`; the
 * body carries `[no value: token]` at that position.
 *
 * Read-only, and gated on the same `employee.read` the letters register enforces.
 * Compensation tokens are additionally checked against `payroll.read` inside the
 * service: a caller without it gets the letter with those tokens unresolved.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = studioPreviewSchema.safeParse({
      templateId: params.get("templateId") ?? "",
      employeeId: params.get("employeeId") ?? "",
      issuedOn: params.get("issuedOn") ?? "",
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A template, a recipient and an issue date (YYYY-MM-DD) are required to preview a letter.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const preview = await previewStudioLetter(access, parsed.data);
    return NextResponse.json(
      { data: preview, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
