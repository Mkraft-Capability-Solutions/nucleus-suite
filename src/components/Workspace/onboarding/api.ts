/**
 * Small typed client for the legacy `/api/v1` envelope used by the onboarding workspace and
 * the employee wizard: `{ data, meta }` on success, `{ error: { code, message, details } }`
 * on failure. Reads throw an `ApiError` carrying the server's message; writes resolve to a
 * result object so callers can map field details back onto the form.
 */

export type FieldIssue = { field: string; issue: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: FieldIssue[];

  constructor(message: string, status: number, code: string | null, details: FieldIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Envelope<T> = { data?: T; meta?: { nextCursor?: string | null; total?: number }; error?: { code?: string; message?: string; details?: unknown } };

function issuesOf(details: unknown): FieldIssue[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((item) => {
    if (item && typeof item === "object" && "field" in item && "issue" in item) {
      return [{ field: String((item as FieldIssue).field), issue: String((item as FieldIssue).issue) }];
    }
    return [];
  });
}

async function parse<T>(response: Response | null, fallback: string): Promise<{ data: T; meta: Envelope<T>["meta"] }> {
  if (!response) throw new ApiError(fallback, 0, "NETWORK", []);
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || payload.data === undefined) {
    throw new ApiError(payload?.error?.message || fallback, response.status, payload?.error?.code ?? null, issuesOf(payload?.error?.details));
  }
  return { data: payload.data, meta: payload.meta };
}

/** GET a resource and return its `data`, or throw an `ApiError` with the server message. */
export async function getData<T>(url: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/json" } }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    return null;
  });
  return (await parse<T>(response, fallback)).data;
}

export type SendResult<T> = { ok: boolean; data: T | null; error: ApiError | null };

/** POST/PATCH JSON with an Idempotency-Key; never throws. */
export async function sendJson<T>(
  url: string,
  init: { method: "POST" | "PATCH"; body: unknown; idempotencyKey?: string; fallback: string },
): Promise<SendResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetch(url, { method: init.method, headers, body: JSON.stringify(init.body) }).catch(() => null);
  try {
    return { ok: true, data: (await parse<T>(response, init.fallback)).data, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof ApiError ? error : new ApiError(init.fallback, 0, null, []) };
  }
}

/** A fresh key per logical submit; keep it while retrying the same submit. */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Today's date (YYYY-MM-DD) in the viewer's own calendar, not UTC. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;
