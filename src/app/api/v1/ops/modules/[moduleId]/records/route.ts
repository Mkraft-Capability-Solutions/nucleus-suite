import { requireAccess, tenantTx } from "@/server/platform/access";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";
import { db, sqlClient } from "@/lib/db";

// Helper to resolve moduleId to the corresponding Drizzle table
function resolveTable(moduleId: string) {
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelCase === 'reconciliation') return schema.reconciliationTable;
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);
  
  if (!table) return NextResponse.json({ error: `Module ${moduleId} not found or no DB schema mapped` }, { status: 404 });

  const query = db.select().from(table).where(eq(table.tenantId, access.tenantId)).toSQL();
  const rows = await tenantTx(access, [ sqlClient(query.sql, query.params) ]);
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const access = await requireAccess(req);
  const table = resolveTable(moduleId);

  if (!table) return NextResponse.json({ error: `Module ${moduleId} not found or no DB schema mapped` }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  
  const zodSchema = buildZodSchemaForModule(moduleId);
  const parseResult = zodSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: `Validation Failed: ${parseResult.error.issues.map(e => e.message).join(", ")}` }, { status: 400 });
  }

  const query = db.insert(table).values({
    tenantId: access.tenantId,
    employeeId: body.employeeId || null,
    attributes: parseResult.data,
    status: "active"
  }).returning().toSQL();

  const [inserted] = await tenantTx(access, [ sqlClient(query.sql, query.params) ]);
  return NextResponse.json({ data: inserted });
}
