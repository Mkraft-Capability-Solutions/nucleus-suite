import { requireAccess, tenantTx } from "@/server/platform/access";
import { retroArrears } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  amountMinor: z.number().int(),
  month: z.string().min(1),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireAccess(req);
  const query = db.select().from(retroArrears).where(eq(retroArrears.tenantId, access.tenantId)).toSQL();
  const [rows] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req);
  const body = await req.json().catch(() => ({}));
  
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const query = db.insert(retroArrears).values({
    tenantId: access.tenantId,
    employeeId: parsed.data.employeeId,
    amountMinor: parsed.data.amountMinor,
    month: parsed.data.month,
    reason: parsed.data.reason,
    status: "pending"
  }).returning().toSQL();
  
  const [inserted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
  return NextResponse.json({ data: inserted });
}
