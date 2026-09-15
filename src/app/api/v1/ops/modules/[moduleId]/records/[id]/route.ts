import { requireAccess, tenantTx, collection } from "@/server/platform/access";
import { ok, fail } from "@/server/platform/http";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";

// Helper to resolve moduleId to the corresponding Drizzle table
function resolveTable(moduleId: string) {
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  if (camelCase === 'reconciliation') return schema.reconciliationTable;
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function GET(req: NextRequest, { params }: { params: { moduleId: string, id: string } }) {
  const access = await requireAccess(req);
  const table = resolveTable(params.moduleId);
  if (!table) return fail(`Module ${params.moduleId} not found`, 404);

  const [rows] = await tenantTx(access, (tx) =>
    tx.select().from(table).where(and(eq(table.tenantId, access.tenantId), eq(table.id, params.id)))
  );
  if (!rows || rows.length === 0) return fail("Record not found", 404);
  return ok(rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { moduleId: string, id: string } }) {
  const access = await requireAccess(req);
  const table = resolveTable(params.moduleId);
  if (!table) return fail(`Module ${params.moduleId} not found`, 404);

  const body = await req.json().catch(() => ({}));
  
  const zodSchema = buildZodSchemaForModule(params.moduleId);
  const parseResult = zodSchema.safeParse(body);
  if (!parseResult.success) {
    return fail(`Validation Failed: ${parseResult.error.errors.map(e => e.message).join(", ")}`, 400);
  }
  
  const [updated] = await tenantTx(access, (tx) =>
    tx.update(table)
      .set({ attributes: parseResult.data, updatedAt: new Date() })
      .where(and(eq(table.tenantId, access.tenantId), eq(table.id, params.id)))
      .returning()
  );

  if (!updated) return fail("Record not found", 404);
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { moduleId: string, id: string } }) {
  const access = await requireAccess(req);
  const table = resolveTable(params.moduleId);
  if (!table) return fail(`Module ${params.moduleId} not found`, 404);

  const [deleted] = await tenantTx(access, (tx) =>
    tx.delete(table)
      .where(and(eq(table.tenantId, access.tenantId), eq(table.id, params.id)))
      .returning()
  );

  if (!deleted) return fail("Record not found", 404);
  return ok(deleted);
}
