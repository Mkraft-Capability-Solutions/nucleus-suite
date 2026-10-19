import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const res = await pool.query(
      "SELECT value FROM system_configuration_values WHERE key = $1",
      ["picklists.catalog"]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Picklists catalog not found in database" }, { status: 404 });
    }

    const catalog = JSON.parse(res.rows[0].value);

    if (category) {
      const filtered = catalog[category] || catalog.picklists?.[category];
      if (!filtered) {
        return NextResponse.json({ error: `Picklist category '${category}' not found` }, { status: 404 });
      }
      return NextResponse.json({ category, data: filtered });
    }

    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch picklists", details: error.message },
      { status: 500 }
    );
  }
}
