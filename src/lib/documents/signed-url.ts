import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed links to one employee document. The token is `<payload>.<signature>`: the
 * payload (base64url JSON) names the tenant, the vault document, the mode and the expiry; the
 * signature is an HMAC-SHA256 of the payload with DOCUMENT_URL_SIGNING_SECRET. Pure apart from the
 * environment read, so it is unit-tested directly.
 */

export const SIGNED_URL_TTL_SECONDS = 5 * 60;
export const SIGNING_SECRET_ENV = "DOCUMENT_URL_SIGNING_SECRET";

export type AccessMode = "view" | "download";
export type SignedPayload = { t: string; d: string; e: string; m: AccessMode; x: number };

/** The signing secret; fails fast when it is missing or too short. */
export function signingSecret(environment: Record<string, string | undefined> = process.env): string {
  const secret = environment[SIGNING_SECRET_ENV];
  if (!secret || secret.length < 32) throw new Error(`${SIGNING_SECRET_ENV} must be set to at least 32 characters.`);
  return secret;
}

const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signToken(payload: Omit<SignedPayload, "x">, secret: string, nowMs = Date.now(), ttlSeconds = SIGNED_URL_TTL_SECONDS): { token: string; expiresAt: string } {
  const x = Math.floor(nowMs / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, x })).toString("base64url");
  return { token: `${body}.${mac(body, secret)}`, expiresAt: new Date(x * 1000).toISOString() };
}

export type VerifyFailure = "malformed" | "signature" | "expired";
/** One shape (the project compiles without strict narrowing): payload is set exactly when ok. */
export type VerifyResult = { ok: boolean; reason: VerifyFailure | null; payload: SignedPayload | null };

export function verifyToken(token: string, secret: string, nowMs = Date.now()): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed", payload: null };
  const [body, signature] = parts as [string, string];
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "signature", payload: null };
  let payload: SignedPayload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedPayload; } catch { return { ok: false, reason: "malformed", payload: null }; }
  if (typeof payload.x !== "number" || (payload.m !== "view" && payload.m !== "download") || typeof payload.t !== "string" || typeof payload.d !== "string") return { ok: false, reason: "malformed", payload: null };
  if (payload.x * 1000 <= nowMs) return { ok: false, reason: "expired", payload: null };
  return { ok: true, reason: null, payload };
}
