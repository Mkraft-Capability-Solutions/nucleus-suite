import { createDecipheriv, createCipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Inbound webhook intake with HMAC verification and nonce replay protection.
 *
 * Provider secrets are sealed with AES-256-GCM under a key derived from
 * BETTER_AUTH_SECRET. This is demo-grade envelope protection behind the
 * replaceable secret port: production must back it with a KMS/vault handle
 * instead of a deployment secret. Secrets are never logged or returned.
 */

function secretKey(): Buffer {
  const raw = process.env.BETTER_AUTH_SECRET ?? "";
  if (raw.length < 32) {
    throw new HttpError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Secret storage is not configured." });
  }
  return createHmac("sha256", raw).update("mkraft-secret-port/v1").digest();
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `gcm1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function unsealSecret(sealed: string): string {
  const [version, iv, ciphertext, tag] = sealed.split(".");
  if (version !== "gcm1" || !iv || !ciphertext || !tag) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The stored secret reference is malformed." });
  }
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return decipher.update(Buffer.from(ciphertext, "base64url"), undefined, "utf8") + decipher.final("utf8");
}

export function signInboundPayload(secret: string, timestamp: string, nonce: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

export function verifyInboundSignature(args: {
  secret: string;
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  nowMs: number;
  seenNonces: Set<string>;
}): boolean {
  const skewMs = Math.abs(args.nowMs - Date.parse(args.timestamp));
  if (Number.isNaN(skewMs) || skewMs > 5 * 60 * 1000) return false;
  if (args.seenNonces.has(args.nonce)) return false;
  const expected = signInboundPayload(args.secret, args.timestamp, args.nonce, args.body);
  if (expected.length !== args.signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(args.signature));
}

export const provisionSecretSchema = z.object({
  connectionId: z.string().uuid(),
  secret: z.string().min(16).max(500),
  label: z.string().trim().min(1).max(120),
});

export async function provisionInboundSecret(access: Access, input: z.infer<typeof provisionSecretSchema>, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into integration_secrets (id, tenant_id, integration_connection_id, attributes)
      values (${id}, ${access.tenantId}, ${input.connectionId},
        ${JSON.stringify({ label: input.label, sealed: sealSecret(input.secret), port: "env-secret/v1" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.secret_provision', 'integration_secret', ${id}, 'Inbound secret sealed (never stored plaintext)', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function receiveInbound(
  connectionId: string,
  headers: { timestamp: string | null; nonce: string | null; signature: string | null },
  rawBody: string,
): Promise<{ id: string; event: string; tenantId: string }> {
  if (!headers.timestamp || !headers.nonce || !headers.signature) {
    throw new HttpError({ status: 401, code: "UNAUTHORIZED", message: "Missing webhook signature headers." });
  }
  let event = "unknown";
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed === "object" && parsed !== null && "event" in parsed && typeof (parsed as Record<string, unknown>).event === "string") {
      event = (parsed as Record<string, string>).event;
    }
  } catch {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Inbound bodies must be JSON." });
  }
  let intake: Array<{ tenant_id: string; sealed_secret: string; duplicate: boolean; delivery_id: string }>;
  try {
    intake = (await sqlClient`select * from app.inbound_intake(${connectionId}, ${headers.nonce}, ${event})`) as Array<{
      tenant_id: string; sealed_secret: string; duplicate: boolean; delivery_id: string;
    }>;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("unknown connection") || error.message.includes("no inbound secret"))) {
      throw new HttpError({ status: 401, code: "UNAUTHORIZED", message: "Unknown connection or missing provisioned secret." });
    }
    throw error;
  }
  const row = intake[0];
  if (!row) throw new HttpError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Inbound intake failed." });
  if (row.duplicate) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Replayed delivery already recorded." });
  }
  const secret = unsealSecret(row.sealed_secret);
  const valid = verifyInboundSignature({
    secret, timestamp: headers.timestamp, nonce: headers.nonce, body: rawBody,
    signature: headers.signature, nowMs: Date.now(), seenNonces: new Set<string>(),
  });
  if (!valid) {
    await sqlClient`delete from inbound_events where id = ${row.delivery_id}`;
    throw new HttpError({ status: 401, code: "UNAUTHORIZED", message: "Invalid webhook signature." });
  }
  return { id: row.delivery_id, event, tenantId: row.tenant_id };
}

export async function listInbound(access: Access, connectionId: string | null) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const filter = connectionId;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, integration_connection_id, attributes, created_at from inbound_events where tenant_id = ${access.tenantId}
        and (${filter}::uuid is null or integration_connection_id = ${connectionId})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}
