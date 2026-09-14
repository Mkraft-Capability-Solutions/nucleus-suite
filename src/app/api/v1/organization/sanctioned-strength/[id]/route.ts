import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { getSanctionedStrengthRecord } from "@/server/organization/sanctioned-strength";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const detail = await getSanctionedStrengthRecord(access, id);
    return NextResponse.json(
      {
        data: {
          type: "sanctioned-strength",
          ...detail.record,
          deployed: detail.deployed,
          auditTrail: detail.auditTrail,
        },
        meta: { requestId },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
