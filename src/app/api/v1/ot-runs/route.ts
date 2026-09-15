import { requireAccess, tenantTx, collection } from "@/server/platform/access";
import { ok, fail } from "@/server/platform/http";
import { otRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  period: z.string().min(1),
  attributes: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireAccess(req);
  const [rows] = await tenantTx(access, (tx) =>
    tx.select().from(otRuns).where(eq(otRuns.tenantId, access.tenantId))
  );
  return collection(rows);
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req);
  const body = await req.json().catch(() => ({}));
  
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 400);

  const [inserted] = await tenantTx(access, (tx) =>
    tx.insert(otRuns).values({
      tenantId: access.tenantId,
      period: parsed.data.period,
      status: "pending",
      attributes: parsed.data.attributes || {}
    }).returning()
  );

  return ok(inserted);
}
