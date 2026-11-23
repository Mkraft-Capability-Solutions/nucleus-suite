import { NextResponse } from "next/server";
import { correctEntry, correctEntrySchema } from "@/server/organization/job-history";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** Corrects a history entry by recording a new entry that supersedes it; the original is kept. */
export async function POST(request: Request, { params }: { params: Promise<{ employee: string; entryId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { employee, entryId } = await params;
    const input = await parseJsonBody(request, correctEntrySchema, "correction");
    const result = await correctEntry(access, decodeURIComponent(employee), entryId, input, requestId);
    return NextResponse.json({ data: result, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
