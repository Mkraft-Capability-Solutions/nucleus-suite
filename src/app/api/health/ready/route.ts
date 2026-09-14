import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { runtimeConfigurationProblems } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

const READY_HEADERS = { "cache-control": "no-store" };

export async function GET() {
  if (runtimeConfigurationProblems().length > 0) {
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: READY_HEADERS });
  }

  try {
    await sqlClient`select 1`;
    return NextResponse.json({ status: "ready" }, { headers: READY_HEADERS });

  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: READY_HEADERS });
  }
}
