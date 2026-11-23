import { NextResponse } from "next/server";
import { z } from "zod";
import { askMira } from "@/lib/ai/policy-graph";
import { denyWithoutAccess } from "@/server/platform/route-guard";
import { databaseConfigured } from "@/lib/db";

const requestSchema = z.object({ message: z.string().trim().min(2).max(1_000) });

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  if (databaseConfigured) {
    const denied = await denyWithoutAccess(request);
    if (denied) return denied;
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Database configuration required" }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a question between 2 and 1,000 characters." }, { status: 400 });

  const result = await askMira(parsed.data.message);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
