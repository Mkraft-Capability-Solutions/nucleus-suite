import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { getLetterRecord } from "@/server/letters/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const kind = new URL(request.url).searchParams.get("kind") === "template" ? "template" : "issue";
    const detail = await getLetterRecord(access, id, kind);
    return NextResponse.json(
      {
        // `snapshot` is the letter as it was sent. It is returned separately from the
        // record so a reader cannot mistake the live template joins for the issued text.
        data: {
          type: "letter",
          ...detail.record,
          issues: detail.issues,
          auditTrail: detail.auditTrail,
          snapshot: detail.snapshot,
        },
        meta: { requestId },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
