import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { readSignedFile } from "@/server/documents/people";

export const dynamic = "force-dynamic";

/** Serves a vault file behind a short-lived signed link (signature, expiry and tenant verified). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const token = new URL(request.url).searchParams.get("token");
    if (!token || token.length > 2048) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The link is incomplete." });
    const file = await readSignedFile(access, token);
    const name = file.fileName.replace(/["\\\r\n]/g, "");
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.mime,
        "content-length": String(file.bytes.length),
        "content-disposition": `${file.mode === "download" ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
