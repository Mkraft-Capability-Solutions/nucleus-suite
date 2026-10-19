import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key) {
      const res = await pool.query(
        "SELECT key, value, revision, updated_at FROM system_configuration_values WHERE key = $1",
        [key]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
      }
      let parsedValue;
      try {
        parsedValue = JSON.parse(res.rows[0].value);
      } catch {
        parsedValue = res.rows[0].value;
      }
      return NextResponse.json({
        key: res.rows[0].key,
        value: parsedValue,
        revision: res.rows[0].revision,
        updated_at: res.rows[0].updated_at,
      });
    }

    const res = await pool.query(
      "SELECT key, value, revision, updated_at FROM system_configuration_values ORDER BY key ASC"
    );

    const configMap: Record<string, any> = {};
    for (const row of res.rows) {
      try {
        configMap[row.key] = JSON.parse(row.value);
      } catch {
        configMap[row.key] = row.value;
      }
    }

    return NextResponse.json({
      success: true,
      count: res.rows.length,
      data: configMap,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch system configurations", details: error.message },
      { status: 500 }
    );
  }
}
