import { requireAccess, tenantTx, collection } from "@/server/platform/access";
import { ok, fail } from "@/server/platform/http";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { buildZodSchemaForModule } from "@/lib/validations/universal";

// Helper to resolve moduleId to the corresponding Drizzle table
function resolveTable(moduleId: string) {
  // Convert snake_case (e.g. document_vault) to camelCase (e.g. documentVault)
  const camelCase = moduleId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  // Handle special cases manually if needed
  if (camelCase === 'reconciliation') return schema.reconciliationTable;
  
  const table = (schema as any)[camelCase];
  return table || null;
}

export async function GET(req: NextRequest, { params }: { params: { moduleId: string } }) {
  const access = await requireAccess(req);
  const table = resolveTable(params.moduleId);
  
  if (!table) return fail(`Module ${params.moduleId} not found or no DB schema mapped`, 404);

  const [rows] = await tenantTx(access, (tx) =>
    tx.select().from(table).where(eq(table.tenantId, access.tenantId))
  );
  return collection(rows);
}

export async function POST(req: NextRequest, { params }: { params: { moduleId: string } }) {
  const access = await requireAccess(req);
  const table = resolveTable(params.moduleId);

  if (!table) return fail(`Module ${params.moduleId} not found or no DB schema mapped`, 404);

  const body = await req.json().catch(() => ({}));
  
  // Zod Server-Side Universal Validation
  const zodSchema = buildZodSchemaForModule(params.moduleId);
  const parseResult = zodSchema.safeParse(body);
  if (!parseResult.success) {
    return fail(`Validation Failed: ${parseResult.error.errors.map(e => e.message).join(", ")}`, 400);
  }

  const [inserted] = await tenantTx(access, (tx) =>
    tx.insert(table).values({
      tenantId: access.tenantId,
      employeeId: body.employeeId || null,
      attributes: parseResult.data,
      status: "active"
    }).returning()
  );

  return ok(inserted);
}
