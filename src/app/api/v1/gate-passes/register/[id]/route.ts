import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { getGatePassRecord } from "@/server/attendance/gate-pass-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const detail = await getGatePassRecord(access, id);
    // The envelope owns `type`, so the pass's own kind travels as `pass_type`.
    const { type: passType, ...record } = detail.record;
    return NextResponse.json(
      {
        data: {
          type: "gate-pass",
          version: 1,
          ...record,
          pass_type: passType,
          quota: detail.quota,
          auditTrail: detail.auditTrail,
        },
        meta: { requestId },
        links: { self: `/api/v1/gate-passes/register/${id}` },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
