import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");

    const res = await pool.query(
      "SELECT value FROM system_configuration_values WHERE key = $1",
      ["lib.operational-module-registry"]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Operational module registry not found in database" }, { status: 404 });
    }

    const registry = JSON.parse(res.rows[0].value);

    if (moduleId) {
      const match = registry.modules?.[moduleId] || registry[moduleId];
      if (!match) {
        return NextResponse.json({ error: `Operational module '${moduleId}' not found` }, { status: 404 });
      }
      return NextResponse.json({ moduleId, data: match });
    }

    return NextResponse.json({
      success: true,
      data: registry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch operational modules", details: error.message },
      { status: 500 }
    );
  }
}
