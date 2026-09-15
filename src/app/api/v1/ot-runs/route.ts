import { requireAccess, tenantTx } from "@/server/platform/access";
import { otRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createSchema = z.object({
  period: z.string().min(1),
  attributes: z.record(z.string(), z.any()).optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireAccess(req);
  const query = db.select().from(otRuns).where(eq(otRuns.tenantId, access.tenantId)).toSQL();
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

  const query = db.insert(otRuns).values({
    tenantId: access.tenantId,
    period: parsed.data.period,
    attributes: parsed.data.attributes || {},
    status: "draft"
  }).returning().toSQL();
  
  const [inserted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);
  return NextResponse.json({ data: inserted });
}
