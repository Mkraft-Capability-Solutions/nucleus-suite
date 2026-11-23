/**
 * Client write helper for the Next.js API routes. Every call carries the caller's Idempotency-Key (one key per
 * logical submit, reused on retry) and an optional If-Match version. The result is a discriminated union, so a
 * failed save can never be mistaken for success; the server's own error message and field details come back.
 */

export type FieldIssue = { field: string; issue: string };
/** Single shape (tsconfig is non-strict, so discriminated unions do not narrow). `data` is set only when ok. */
export type MutationResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number | null;
  data?: T;
  message: string | null;
  details: FieldIssue[];
};

export type MutationRequest = {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey: string;
  ifMatch?: number | string | null;
};

type Envelope = { data?: unknown; error?: { message?: string; details?: unknown }; message?: string };

function issues(value: unknown): FieldIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is { field?: unknown; issue?: unknown } => typeof entry === "object" && entry !== null)
    .map((entry) => ({ field: String(entry.field ?? ""), issue: String(entry.issue ?? "") }))
    .filter((entry) => entry.field !== "" || entry.issue !== "");
}

export async function sendJson<T = Record<string, unknown>>(path: string, request: MutationRequest): Promise<MutationResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": request.idempotencyKey };
  if (request.ifMatch !== undefined && request.ifMatch !== null) headers["If-Match"] = `"${request.ifMatch}"`;
  let response: Response;
  try {
    response = await fetch(path, {
      method: request.method ?? "POST",
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: null, message: null, details: [] };
  }
  const payload = (await response.json().catch(() => null)) as Envelope | null;
  if (!response.ok) {
    return { ok: false, status: response.status, message: payload?.error?.message ?? payload?.message ?? null, details: issues(payload?.error?.details) };
  }
  return { ok: true, status: response.status, data: (payload?.data ?? payload ?? {}) as T, message: null, details: [] };
}

/** A fresh key per logical submit. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
