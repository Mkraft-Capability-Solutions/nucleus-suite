import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    const res = await pool.query(
      "SELECT value FROM system_configuration_values WHERE key = $1",
      ["navigation.catalog"]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Navigation catalog not found in database" }, { status: 404 });
    }

    const catalog = JSON.parse(res.rows[0].value);

    if (domain) {
      const match = catalog.domains?.find((d: any) => d.id === domain);
      if (!match) {
        return NextResponse.json({ error: `Navigation domain '${domain}' not found` }, { status: 404 });
      }
      return NextResponse.json({ domain: match });
    }

    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch navigation catalog", details: error.message },
      { status: 500 }
    );
  }
}
