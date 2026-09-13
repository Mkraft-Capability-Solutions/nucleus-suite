import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { buildExport } from "@/server/exports/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await buildExport(access, id);
    return ok({ type: "export-job", id, version: 1, attributes: result, requestId, self: `/api/v1/exports/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
