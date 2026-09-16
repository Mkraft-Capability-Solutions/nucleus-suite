import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HttpError } from "@/server/platform/http";

function key() {
  const value = process.env.HRMS_FIELD_ENCRYPTION_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw new HttpError({ status: 503, code: "ENCRYPTION_NOT_CONFIGURED", message: "Secure employee-field storage has not been configured." });
  return Buffer.from(value, "hex");
}
export function encryptFields(data: Record<string, unknown>, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return { encrypted: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), format: "aes-256-gcm-v1" };
}
export function decryptFields(data: Record<string, unknown>, context: string): Record<string, unknown> {
  if (data.format !== "aes-256-gcm-v1") throw new HttpError({ status: 409, code: "LEGACY_SENSITIVE_RECORD", message: "This sensitive record requires a controlled storage migration before it can be viewed." });
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(String(data.iv), "base64"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(String(data.tag), "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(String(data.encrypted), "base64")), decipher.final()]).toString("utf8"));
}
