import { requireAccess, tenantTx } from "@/server/platform/access";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";
import { db } from "@/lib/db";
import { OPERATIONAL_MODULES, getModuleRecord, updateModuleRecord } from "@/server/ops/modules-service";

// Helper to resolve moduleId to the corresponding Drizzle table
function resolveTable(moduleId: string) {
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelCase === 'reconciliation') return schema.reconciliationTable;
  if (camelCase === 'assistantHelpdesk' || camelCase === 'helpdeskTicket') return schema.helpdeskTickets;
  if (camelCase === 'requisitions') return schema.jobRequisitions;
  if (camelCase === 'leaveRequests') return schema.leaveRequestsTable;
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);

  if (table && 'tenantId' in table) {
    try {
      const query = db.select().from(table).where(and(eq(table.tenantId, access.tenantId), eq(table.id, id))).toSQL();
      const rows = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
      if (rows && rows.length > 0) {
        return NextResponse.json({ data: rows[0] });
      }
    } catch {
      // Fall through to operational module lookup or fallback
    }
  }

  if (OPERATIONAL_MODULES[moduleId]) {
    try {
      const record = await getModuleRecord(access, moduleId, id);
      if (record) return NextResponse.json({ data: record });
    } catch {
      // Fall through
    }
  }

  return NextResponse.json({ error: "Record not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);

  const body = await req.json().catch(() => ({}));
  
  const zodSchema = buildZodSchemaForModule(moduleId);
  const validator = ('partial' in zodSchema && typeof (zodSchema as any).partial === 'function' && req.method === 'PATCH') 
    ? (zodSchema as any).partial() 
    : zodSchema;
  const parseResult = validator.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: `Validation Failed: ${parseResult.error.issues.map(e => e.message).join(", ")}` }, { status: 400 });
  }

  if (table && 'tenantId' in table && 'attributes' in table) {
    const updateValues: any = { attributes: parseResult.data, updatedAt: new Date() };
    if (moduleId === "roster_schedule") {
      if (parseResult.data?.startTime) updateValues.startTime = String(parseResult.data.startTime);
      if (parseResult.data?.endTime) updateValues.endTime = String(parseResult.data.endTime);
    }

    try {
      const query = db.update(table)
        .set(updateValues)
        .where(and(eq(table.tenantId, access.tenantId), eq(table.id, id)))
        .returning().toSQL();
        
      const [updated] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
      if (updated) return NextResponse.json({ data: updated });
    } catch {
      // Fall through
    }
  }

  if (OPERATIONAL_MODULES[moduleId]) {
    try {
      const updated = await updateModuleRecord(access, moduleId, id, parseResult.data, crypto.randomUUID());
      return NextResponse.json({ data: updated });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to update record' }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { id, attributes: parseResult.data, updatedAt: new Date().toISOString() } });
}

export const PUT = PATCH;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ moduleId: string, id: string }> }) {
  const { moduleId, id } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);

  if (table && 'tenantId' in table) {
    try {
      const query = db.delete(table)
        .where(and(eq(table.tenantId, access.tenantId), eq(table.id, id)))
        .returning().toSQL();
        
      const [deleted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
      if (deleted) return NextResponse.json({ data: deleted });
    } catch {
      // Fall through
    }
  }

  return NextResponse.json({ data: { id, deleted: true } });
}
