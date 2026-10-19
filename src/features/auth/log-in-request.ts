/**
 * Log in request: POST /api/auth/login (nucleus-suite's password sign-in, same origin), then stores the signed-in
 * user exactly as AuthContext does so the workspace opens already signed in.
 *
 * Errors: an RFC 9457 problem body is shown as sent; anything else (the legacy route answers `{ error }`) is reported
 * by its real HTTP status, never as the raw server message.
 */
import { PASSWORD_LOGIN_PATH, storeSignedInUser } from '@/lib/auth/password-login';
import { JSON_ACCEPT, failureOf, type ApiOutcome } from './api-problem';

export const LOG_IN_PATH = PASSWORD_LOGIN_PATH;

export type LogInOutcome = ApiOutcome<null>;

interface LogInBody {
  readonly user?: unknown;
}

export async function logIn(email: string, password: string, locale: string, signal?: AbortSignal): Promise<LogInOutcome> {
  let response: Response;
  try {
    response = await fetch(LOG_IN_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: JSON_ACCEPT, 'Accept-Language': locale },
      body: JSON.stringify({ email, password }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { kind: 'network-error' };
  }
  if (!response.ok) return failureOf(response);
  const body = (await response.json().catch(() => null)) as LogInBody | null;
  if (typeof body?.user !== 'object' || body.user === null) return { kind: 'http-error', status: response.status };
  await storeSignedInUser(body.user, email, password);
  return { kind: 'success', data: null };
}
