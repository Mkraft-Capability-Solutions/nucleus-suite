import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { initialAdminSignupAvailable } from "@/server/identity/provision";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured || process.env.ALLOW_INITIAL_ADMIN_SIGNUP !== "true") {
    return NextResponse.json({ available: false });
  }

  try {
    return NextResponse.json({ available: await initialAdminSignupAvailable() });
  } catch {
    return NextResponse.json({ available: false }, { status: 503 });
  }
}