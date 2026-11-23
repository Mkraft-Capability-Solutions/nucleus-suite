import { z } from "zod";
import { exportGlBatch, GL_EXPORT_FORMATS } from "@/server/compliance/erp-ledger";
import { parseOrThrow } from "@/server/compliance/route-support";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** Downloads one GL batch as SAP IDoc XML, NetSuite CSV or Tally XML, built from stored lines and audited. */
export async function GET(request: Request, context: { params: Promise<{ batchId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const batchId = parseOrThrow(z.string().uuid(), (await context.params).batchId, "Invalid batch reference.");
    const format = parseOrThrow(z.enum(GL_EXPORT_FORMATS), new URL(request.url).searchParams.get("format") ?? "", "Choose an export format.");
    const file = await exportGlBatch(access, batchId, format, requestId);
    return new Response(file.body, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${file.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
