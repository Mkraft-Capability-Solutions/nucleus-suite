import { NextResponse } from 'next/server';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const deriveKey = promisify(scrypt);
import accounts from '@/data/demo-accounts.json';

export async function POST(request) {
    if (process.env.DEMO_AUTH_ENABLED !== 'true' || (process.env.APP_DATA_MODE || 'json') !== 'json') {
        return NextResponse.json({ error: 'Demo sign-in is disabled.' }, { status: 403 });
    }
    const trustedOrigins = [new URL(request.url).origin, process.env.BETTER_AUTH_URL, ...(process.env.ADDITIONAL_TRUSTED_ORIGINS?.split(',').map(origin => origin.trim()) || [])];
    if (request.headers.get('origin') && !trustedOrigins.includes(request.headers.get('origin'))) {
        return NextResponse.json({ error: 'Cross-origin sign-in is not allowed.' }, { status: 403 });
    }
    let body;
    try {
        const reader = request.body?.getReader();
        let size = 0;
        const chunks = [];
        if (reader) {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > 4096) { await reader.cancel(); return NextResponse.json({ error: 'Request too large.' }, { status: 413 }); }
                chunks.push(value);
            }
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    catch { return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 }); }
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.password.length > 128 || body.email.length > 254) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    const account = accounts.find((item) => item.email === body.email.trim().toLowerCase());
    const reference = account || accounts[0];
    const candidate = await deriveKey(body.password, reference.passwordSalt, 64);
    const matches = timingSafeEqual(candidate, Buffer.from(reference.passwordHash, 'hex'));
    if (!account || !matches) {
        return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    const { passwordSalt: _salt, passwordHash: _hash, ...user } = account;
    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'private, no-store' } });
}
