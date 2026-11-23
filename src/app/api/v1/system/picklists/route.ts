import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** GET the master picklist catalog stored in system_configuration_values (authenticated). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    await requireAccess(request);
    const category = new URL(request.url).searchParams.get("category");
    const res = await pool.query("SELECT value FROM system_configuration_values WHERE key = $1", ["picklists.catalog"]);
    if (res.rows.length === 0) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The picklist catalog is not loaded in the database." });
    }
    const raw = res.rows[0].value as unknown;
    const catalog = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown> & { picklists?: unknown };
    if (category) {
      const list = Array.isArray(catalog.picklists) ? (catalog.picklists as Array<{ code?: string }>) : [];
      const match = list.find((entry) => entry.code === category) ?? catalog[category];
      if (!match) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The picklist was not found." });
      return NextResponse.json({ category, data: match }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    return NextResponse.json({ success: true, data: catalog }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
