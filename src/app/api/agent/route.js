import { NextResponse } from 'next/server';
import catalog from '@/data/assistant.json';

export async function POST(request) {
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 }); }
    if (typeof body?.message !== 'string' || body.message.length > 4000) {
        return NextResponse.json({ error: 'A message of at most 4000 characters is required.' }, { status: 400 });
    }
    const message = body.message.trim().toLowerCase();
    const route = catalog.routes.find((item) => item.keywords.some((keyword) => message.includes(keyword)));
    return NextResponse.json({ reply: route?.reply ?? (message ? catalog.fallback : catalog.greeting), action: route?.action ?? null });
}
