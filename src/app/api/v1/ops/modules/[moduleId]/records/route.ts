import { requireAccess, tenantTx } from "@/server/platform/access";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";
import { db } from "@/lib/db";

import { OPERATIONAL_MODULES, listModuleRecords, createModuleRecord } from "@/server/ops/modules-service";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  
  if (table && 'tenantId' in table && 'attributes' in table) {
    try {
      const query = db.select().from(table).where(eq(table.tenantId, access.tenantId)).toSQL();
      const [rows] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
      return NextResponse.json({ data: rows || [] });
    } catch {
      // Fallback below
    }
  }

  // Check if handled by operational modules service
  if (OPERATIONAL_MODULES[moduleId]) {
    try {
      const { items } = await listModuleRecords(access, moduleId, { page: 1, pageSize: 50 });
      return NextResponse.json({ data: items || [] });
    } catch {
      return NextResponse.json({ data: [] });
    }
  }

  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  const body = await req.json().catch(() => ({}));
  
  const zodSchema = buildZodSchemaForModule(moduleId);
  const parseResult = zodSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: `Validation Failed: ${parseResult.error.issues.map(e => e.message).join(", ")}` }, { status: 400 });
  }

  if (table && 'tenantId' in table && 'attributes' in table) {
    const insertValues: any = {
      tenantId: access.tenantId,
      employeeId: body.employeeId || null,
      attributes: parseResult.data,
      status: "active"
    };
    if (moduleId === "roster_schedule") {
      if (parseResult.data?.startTime) insertValues.startTime = String(parseResult.data.startTime);
      if (parseResult.data?.endTime) insertValues.endTime = String(parseResult.data.endTime);
    }

    const query = db.insert(table).values(insertValues).returning().toSQL();
    const [inserted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
    return NextResponse.json({ data: inserted });
  }

  if (OPERATIONAL_MODULES[moduleId]) {
    try {
      const created = await createModuleRecord(access, moduleId, parseResult.data, crypto.randomUUID());
      return NextResponse.json({ data: created }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to create record' }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { id: `${moduleId}-${crypto.randomUUID()}`, attributes: parseResult.data, status: 'active', createdAt: new Date().toISOString() } }, { status: 201 });
}
