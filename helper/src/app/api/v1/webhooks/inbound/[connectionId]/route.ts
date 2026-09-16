import { NextResponse } from "next/server";
import { fail, requestIdFrom } from "@/server/platform/http";
import { receiveInbound } from "@/server/integrations/inbound";

export const dynamic = "force-dynamic";

/** Public provider intake: connection identity + HMAC prove authenticity. No session. */
export async function POST(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const { connectionId } = await params;
    const rawBody = await request.text();
    const result = await receiveInbound(connectionId, {
      timestamp: request.headers.get("x-webhook-timestamp"),
      nonce: request.headers.get("x-webhook-nonce"),
      signature: request.headers.get("x-webhook-signature"),
    }, rawBody);
    return NextResponse.json(
      { data: { type: "inbound-event", ...result }, meta: { requestId } },
      { status: 202, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
