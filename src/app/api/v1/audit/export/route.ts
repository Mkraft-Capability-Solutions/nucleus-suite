import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { exportAuditCsv } from "@/server/access/audit-log";

export const dynamic = "force-dynamic";

/** GET the tenant audit trail as CSV (audit.read); cells are neutralised against formula injection. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const csv = await exportAuditCsv(access);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit_log_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
