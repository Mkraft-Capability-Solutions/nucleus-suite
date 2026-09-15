import { requireAccess, tenantTx, collection } from "@/server/platform/access";
import { ok, fail } from "@/server/platform/http";
import { retroArrears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  amountMinor: z.number().int(),
  month: z.string().min(1),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireAccess(req);
  const [rows] = await tenantTx(access, (tx) =>
    tx.select().from(retroArrears).where(eq(retroArrears.tenantId, access.tenantId))
  );
  return collection(rows);
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req);
  const body = await req.json().catch(() => ({}));
  
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 400);

  const [inserted] = await tenantTx(access, (tx) =>
    tx.insert(retroArrears).values({
      tenantId: access.tenantId,
      employeeId: parsed.data.employeeId,
      amountMinor: parsed.data.amountMinor,
      month: parsed.data.month,
      reason: parsed.data.reason || null,
      status: "pending"
    }).returning()
  );

  return ok(inserted);
}
