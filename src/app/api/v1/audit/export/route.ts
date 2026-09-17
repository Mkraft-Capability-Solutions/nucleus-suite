import { requireAccess, tenantTx } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);

    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, actor_user_id, action, entity_type, entity_id, reason, created_at
        from audit_events
        where tenant_id = ${access.tenantId}
        order by created_at desc
        limit 500
      `,
    ]);

    const header = "ID,Timestamp,Actor,Action,Entity Type,Entity ID,Reason\n";
    const csvRows = (rows as Array<Record<string, unknown>>).map((r) => {
      const escape = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
      return [
        escape(r.id),
        escape(r.created_at),
        escape(r.actor_user_id),
        escape(r.action),
        escape(r.entity_type),
        escape(r.entity_id),
        escape(r.reason),
      ].join(",");
    });

    const csvContent = header + csvRows.join("\n");

    return new Response(csvContent, {
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
