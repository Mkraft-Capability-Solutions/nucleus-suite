import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { convertFxQuote, latestFxRate, quoteFxRate, quoteFxSchema } from "@/server/fx/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const base = params.get("base");
    const quote = params.get("quote");
    const amount = params.get("amountMinor");
    if (!base || !quote) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "base and quote currency codes are required." });
    if (amount !== null) {
      const parsed = z.number().int().min(0).safeParse(Number(amount));
      if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "amountMinor must be a non-negative integer." });
      const result = await convertFxQuote(access, { baseCode: base, quoteCode: quote, amountMinor: parsed.data });
      return NextResponse.json({ data: { type: "fx-conversion", ...result }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const result = await latestFxRate(access, base, quote);
    return NextResponse.json({ data: { type: "fx-rate", ...result }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = quoteFxSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The FX quote is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await quoteFxRate(access, parsed.data, requestId);
    return ok({ type: "fx-rate", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/fx/rates` });
  } catch (error) {
    return fail(error, requestId);
  }
}
