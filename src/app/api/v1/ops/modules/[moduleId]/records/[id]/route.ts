import { requireAccess, tenantTx } from "@/server/platform/access";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";
import { db } from "@/lib/db";

// Helper to resolve moduleId to the corresponding Drizzle table
function resolveTable(moduleId: string) {
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelCase === 'reconciliation') return schema.reconciliationTable;
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  if (!table) return NextResponse.json({ error: `Module ${moduleId} not found` }, { status: 404 });

  const query = db.select().from(table).where(and(eq(table.tenantId, access.tenantId), eq(table.id, id))).toSQL();
  const rows = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
  if (!rows || rows.length === 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ data: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  if (!table) return NextResponse.json({ error: `Module ${moduleId} not found` }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  
  const zodSchema = buildZodSchemaForModule(moduleId);
  const parseResult = zodSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: `Validation Failed: ${parseResult.error.issues.map(e => e.message).join(", ")}` }, { status: 400 });
  }
  
  const query = db.update(table)
    .set({ attributes: parseResult.data, updatedAt: new Date() })
    .where(and(eq(table.tenantId, access.tenantId), eq(table.id, id)))
    .returning().toSQL();
    
  const [updated] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);

  if (!updated) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  if (!table) return NextResponse.json({ error: `Module ${moduleId} not found` }, { status: 404 });

  const query = db.delete(table)
    .where(and(eq(table.tenantId, access.tenantId), eq(table.id, id)))
    .returning().toSQL();
    
  const [deleted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);

  if (!deleted) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ data: deleted });
}
