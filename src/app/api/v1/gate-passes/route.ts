import { requireAccess, tenantTx } from "@/server/platform/access";
import { NextResponse, NextRequest } from "next/server";
import { gatePasses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const access = await requireAccess(req);

  const query = db.select().from(gatePasses).where(eq(gatePasses.tenantId, access.tenantId)).toSQL();
  const [rows] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const access = await requireAccess(req);
  const body = await req.json().catch(() => ({}));

  if (!body.employeeId || !body.passType) {
    return NextResponse.json({ error: "employeeId and passType are required" }, { status: 400 });
  }

  const query = db.insert(gatePasses).values({
    tenantId: access.tenantId,
    employeeId: body.employeeId,
    purpose: body.purpose || body.passType,
    outTime: body.validFrom ? new Date(body.validFrom) : new Date(),
    expectedInTime: body.validUntil ? new Date(body.validUntil) : null,
    status: "active"
  }).returning().toSQL();
  
  const [inserted] = await tenantTx(access, [ { text: query.sql, values: query.params } ]);

  return NextResponse.json({ data: inserted });
}
