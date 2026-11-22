import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { readLibraryFile } from "@/server/documents/library";

export const dynamic = "force-dynamic";

/** The file itself: shown in the browser (?download=1 saves it instead). Only for those who may read it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid document reference." });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const file = await readLibraryFile(access, id, download ? "download" : "view", requestId);
    const name = file.fileName.replace(/["\\\r\n]/g, "");
    // Only these are shown in the browser; anything else (Word, Excel) is always saved.
    const inline = !download && ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(file.mime);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.mime === "text/plain" ? "text/plain; charset=utf-8" : file.mime,
        "content-length": String(file.bytes.length),
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
