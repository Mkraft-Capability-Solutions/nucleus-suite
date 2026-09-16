type ApiEnvelope = { error?: { message?: string; code?: string; retryable?: boolean } };

const inFlightGets = new Map<string, Promise<unknown>>();
let requestGeneration = 0;
const pathGenerations = new Map<string, number>();
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export class ApiGetError extends Error {
  constructor(message: string, readonly status: number | null, readonly retryable: boolean) {
    super(message);
  }
}

async function fetchJsonOnce(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, { cache: "no-store", signal: controller.signal });
    const body = await response.json().catch(() => null) as ApiEnvelope | null;
    if (!response.ok) {
      const serverMessage = body?.error?.message;
      throw new ApiGetError(serverMessage || "The requested data could not be loaded.", response.status, RETRYABLE_STATUS.has(response.status) || body?.error?.retryable === true);
    }
    return body;
  } catch (error) {
    if (error instanceof ApiGetError) throw error;
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "The request timed out. Please try again."
      : "Could not reach the server. Please try again.";
    throw new ApiGetError(message, null, true);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function fetchJsonWithRetry(path: string): Promise<unknown> {
  try {
    return await fetchJsonOnce(path);
  } catch (error) {
    if (!(error instanceof ApiGetError) || !error.retryable) throw error;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 200));
    return fetchJsonOnce(path);
  }
}

/** Coalesces identical GETs mounted in parallel and retries one transient failure. */
export function getJson(path: string): Promise<unknown> {
  const key = `${requestGeneration}:${pathGenerations.get(path) ?? 0}:${path}`;
  const existing = inFlightGets.get(key);
  if (existing) return existing;
  const request = fetchJsonWithRetry(path).finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, request);
  return request;
}

/** Ensures a refresh after a write cannot reuse an older in-flight response for this path. */
export function invalidateGetRequest(path: string): void {
  pathGenerations.set(path, (pathGenerations.get(path) ?? 0) + 1);
}

/** Prevents an in-flight response from the prior tenant being reused after a context switch. */
export function invalidateGetRequests(): void {
  requestGeneration += 1;
  inFlightGets.clear();
  pathGenerations.clear();
}

type ErrorDetail = { field?: unknown; issue?: unknown };

function detailLine(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (typeof entry !== "object" || entry === null) return "";
  const { field, issue } = entry as ErrorDetail;
  const name = typeof field === "string" ? field.trim() : "";
  const text = typeof issue === "string" ? issue.trim() : "";
  if (!text) return "";
  return name ? `${name}: ${text}` : text;
}

/**
 * Renders a server error envelope as something a person can act on.
 *
 * A 400 from a schema-validated route carries `{field, issue}` details alongside
 * the message. Dropping them leaves the caller staring at "The … payload is
 * invalid." with no way of knowing which field is wrong, so they are appended.
 */
export function apiErrorMessage(payload: unknown, status: number, fallback: string): string {
  const envelope = typeof payload === "object" && payload !== null ? (payload as { error?: unknown }).error : null;
  if (typeof envelope === "string" && envelope.trim()) return envelope.trim();
  const error = typeof envelope === "object" && envelope !== null ? (envelope as { message?: unknown; details?: unknown }) : {};
  const message = typeof error.message === "string" && error.message.trim() ? error.message.trim() : "";
  const details = Array.isArray(error.details) ? error.details.map(detailLine).filter(Boolean) : [];
  const head = message || fallback || `The request failed (${status}).`;
  return details.length > 0 ? `${head} ${details.join(" ")}` : head;
}
