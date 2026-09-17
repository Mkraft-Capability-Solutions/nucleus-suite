import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, sqlClient } from "@/lib/db";
import { requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

function resolveTable(moduleId: string) {
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelCase === "reconciliation") return schema.reconciliationTable;
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string; id: string }> }
) {
  const requestId = requestIdFrom(req.headers);
  try {
    const { moduleId, id } = await params;
    const access = await requireAccess(req);
    const body = await req.json().catch(() => ({}));
    const targetState = body.state || body.status;

    if (!targetState || typeof targetState !== "string") {
      return NextResponse.json({ error: "A valid 'state' or 'status' string is required." }, { status: 400 });
    }

    const table = resolveTable(moduleId);
    if (!table) {
      return NextResponse.json({ error: `Module '${moduleId}' table not found.` }, { status: 404 });
    }

    // Query existing record
    const selectQuery = db.select().from(table).where(and(eq(table.tenantId, access.tenantId), eq(table.id, id))).toSQL();
    const existingRows = await tenantTx(access, [{ text: selectQuery.sql, values: selectQuery.params }]);
    const existing = (existingRows as any[])?.[0];
    if (!existing) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    // Merge state into attributes and set status if column exists
    const currentAttrs = existing.attributes || {};
    const updatedAttrs = { ...currentAttrs, status: targetState, state: targetState };

    const updateSet: Record<string, any> = {
      attributes: updatedAttrs,
      updatedAt: new Date(),
    };
    if ("status" in table) {
      updateSet.status = targetState;
    }

    const updateQuery = db.update(table)
      .set(updateSet)
      .where(and(eq(table.tenantId, access.tenantId), eq(table.id, id)))
      .returning()
      .toSQL();

    const [updated] = await tenantTx(access, [
      { text: updateQuery.sql, values: updateQuery.params },
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'ops.state_transition', ${moduleId}, ${id}, ${'State transitioned to ' + targetState},
          ${JSON.stringify({ state: targetState, moduleId })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `
    ]);

    return NextResponse.json({
      data: updated,
      meta: {
        requestId,
        moduleId,
        state: targetState,
      }
    });
  } catch (error: any) {
    console.error("Failed to transition operational state:", error);
    return NextResponse.json({ error: error.message || "Failed to transition state." }, { status: 500 });
  }
}
