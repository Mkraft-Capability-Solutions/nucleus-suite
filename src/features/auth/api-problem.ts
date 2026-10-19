/**
 * RFC 9457 problem details as the Nucleus API sends them (`application/problem+json`: type, title, status, detail,
 * instance, code, trace_id, invalid_params). Parsed defensively from unknown JSON; never throws.
 * (Replaced by the generated API client in packages/api-client once it exists.)
 */
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  /** UPPER_SNAKE error code, e.g. INVALID_CREDENTIALS. */
  readonly code?: string;
  readonly traceId?: string;
}

/** Outcome of a call to the API: never throws for HTTP or network errors. */
export type ApiOutcome<T> =
  | { readonly kind: 'success'; readonly data: T }
  | { readonly kind: 'problem'; readonly status: number; readonly problem: ProblemDetails }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'network-error' };

/** A failed outcome (everything but success). */
export type ApiFailure = Exclude<ApiOutcome<unknown>, { readonly kind: 'success' }>;

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function toProblem(value: unknown): ProblemDetails | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const title = readString(record, 'title');
  const detail = readString(record, 'detail');
  if (!title && !detail) return null;
  const status = typeof record.status === 'number' ? record.status : undefined;
  const type = readString(record, 'type');
  const instance = readString(record, 'instance');
  const code = readString(record, 'code');
  const traceId = readString(record, 'trace_id') ?? readString(record, 'traceId');
  return {
    ...(type ? { type } : {}),
    ...(title ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(detail ? { detail } : {}),
    ...(instance ? { instance } : {}),
    ...(code ? { code } : {}),
    ...(traceId ? { traceId } : {}),
  };
}

/** Turn a non-2xx response into a problem (when the body is one) or an http-error with the real status. */
export async function failureOf(response: Response): Promise<ApiFailure> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      const problem = toProblem(await response.json());
      if (problem) return { kind: 'problem', status: response.status, problem };
    } catch {
      return { kind: 'http-error', status: response.status };
    }
  }
  return { kind: 'http-error', status: response.status };
}

export const JSON_ACCEPT = 'application/json, application/problem+json';
