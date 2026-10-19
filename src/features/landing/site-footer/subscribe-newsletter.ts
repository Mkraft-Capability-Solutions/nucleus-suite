/**
 * Newsletter sign-up (the MultipliersKraft footer's "Field notes, monthly"): POST JSON { email } to
 * `${NEXT_PUBLIC_API_BASE_URL ?? '/api'}/newsletter` with a 10 s timeout. Resolves only on a 2xx response; any failure
 * rejects with NewsletterError and the form shows its own localized message (never a faked success).
 */

export class NewsletterError extends Error {
  readonly status: number | undefined;

  constructor(code: string, status?: number) {
    super(code);
    this.name = 'NewsletterError';
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

export async function subscribeNewsletter(email: string): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api'}/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    if (!response.ok) throw new NewsletterError('HTTP_ERROR', response.status);
  } catch (error) {
    if (error instanceof NewsletterError) throw error;
    throw new NewsletterError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    window.clearTimeout(timer);
  }
}
