import { NextResponse } from 'next/server';
import { denyWithoutAccess } from '@/server/platform/route-guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/ai/nucleus/transcript
 * Persists a voice conversation turn (user, assistant, or action) to the database.
 * No-op stub: returns 200 without writing until the AI transcript table is created.
 */
export async function POST(request: Request) {
  const denied = await denyWithoutAccess(request);
  if (denied) return denied;
  // TODO: Persist to database once ai_runs / ai_transcripts tables are in schema.ts
  return NextResponse.json({ data: { ok: true } });
}
