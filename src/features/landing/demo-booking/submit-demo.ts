/**
 * Demo-booking submission (no client library): POST JSON to `${NEXT_PUBLIC_API_BASE_URL ?? '/api'}/demo` with an
 * Idempotency-Key that stays stable across retries of the same payload (30 min), a 10 s timeout, and de-duplication of
 * concurrent identical submissions. Any failure rejects with DemoRequestError; the form shows its own localized message.
 */

export interface DemoRequest {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly teamSize: string;
  readonly message: string;
}

export class DemoRequestError extends Error {
  readonly status: number | undefined;

  constructor(code: string, status?: number) {
    super(code);
    this.name = 'DemoRequestError';
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;
const KEY_TTL_MS = 30 * 60 * 1000;
const keys = new Map<string, { readonly key: string; readonly createdAt: number }>();
const inFlight = new Map<string, Promise<void>>();

function idempotencyKey(fingerprint: string): string {
  const now = Date.now();
  for (const [entry, value] of keys) if (now - value.createdAt > KEY_TTL_MS) keys.delete(entry);
  const existing = keys.get(fingerprint);
  if (existing) return existing.key;
  const key = crypto.randomUUID();
  keys.set(fingerprint, { key, createdAt: now });
  return key;
}

async function send(fingerprint: string, body: string): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api'}/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey(fingerprint) },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new DemoRequestError('HTTP_ERROR', response.status);
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || (data as { readonly success?: unknown }).success !== true) {
      throw new DemoRequestError('INVALID_RESPONSE', response.status);
    }
    keys.delete(fingerprint);
  } catch (error) {
    if (error instanceof DemoRequestError) throw error;
    throw new DemoRequestError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    window.clearTimeout(timer);
  }
}

export function submitDemo(request: DemoRequest): Promise<void> {
  const body = JSON.stringify(request);
  const pending = inFlight.get(body) ?? send(body, body).finally(() => inFlight.delete(body));
  inFlight.set(body, pending);
  return pending;
}
