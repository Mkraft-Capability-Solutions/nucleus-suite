import { NextResponse } from "next/server";
import { isAuthorizedCron, listWorkerTenants, runTick } from "@/server/jobs/worker";
import { runDailyAlertScans } from "@/server/alerts/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron entry point. Authenticates with CRON_SECRET (fail-closed when
 * unset), claims due tasks/outbox events across tenants and executes them
 * with bounded leases, backoff and dead-lettering.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!isAuthorizedCron(request.headers, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const owner = `cron-${new Date().toISOString().slice(0, 16)}`;
  const summary = await runTick(owner);
  // Compliance alerts (visa, work permit, documents, date custom fields): once per tenant per local day.
  const alertScans = await runDailyAlertScans(await listWorkerTenants());
  return NextResponse.json({ data: { type: "cron-tick", ...summary, alertScans }, meta: { owner } }, { headers: { "cache-control": "no-store" } });
}

/** Vercel Cron Jobs call the path with GET and `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  return POST(request);
}
