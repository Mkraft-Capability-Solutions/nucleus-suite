/**
 * Typed client helpers and response shapes for the admin screens (roles, member
 * access, audit, integrations, settings). Reads reuse the onboarding envelope
 * reader; writes send an Idempotency-Key and never throw.
 */

import { useCallback, useRef } from "react";
import { ApiError } from "../onboarding/api";
import type { EffectiveUiAccess, UiCardDefinition, UiPageDefinition } from "@/lib/access/ui-access-catalog";

export { ApiError, getData, newIdempotencyKey } from "../onboarding/api";
export { useResource, type ResourceState } from "../onboarding/useResource";

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

/** Single shape (the project compiles without strictNullChecks, so discriminated unions would not narrow). */
export type SendResult<T> = { ok: boolean; data: T | null; error: ApiError | null };

type Envelope<T> = { data?: T; error?: { code?: string; message?: string; details?: unknown } };

export async function send<T>(
  url: string,
  init: { method: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; idempotencyKey?: string; fallback: string },
): Promise<SendResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetch(url, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => null);
  if (!response) return { ok: false, data: null, error: new ApiError(init.fallback, 0, "NETWORK", []) };
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || payload.data === undefined) {
    const details = Array.isArray(payload?.error?.details)
      ? (payload.error.details as Array<{ field?: unknown; issue?: unknown }>).map((item) => ({ field: String(item.field ?? ""), issue: String(item.issue ?? "") }))
      : [];
    return { ok: false, data: null, error: new ApiError(payload?.error?.message || init.fallback, response.status, payload?.error?.code ?? null, details) };
  }
  return { ok: true, data: payload.data, error: null };
}

/**
 * One Idempotency-Key per logical submit: the same key is reused while the
 * user retries the same change, and dropped once the server accepted it.
 */
export function useSubmitKey(): { key: (fingerprint: string) => string; done: () => void } {
  const current = useRef<{ fingerprint: string; key: string } | null>(null);
  const key = useCallback((fingerprint: string) => {
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { fingerprint, key: crypto.randomUUID() };
    }
    return current.current.key;
  }, []);
  const done = useCallback(() => { current.current = null; }, []);
  return { key, done };
}

export type RoleView = {
  id: string; code: string; name: string; status: string; systemManaged: boolean; memberCount: number;
  permissionKeys: string[]; superAdmin: boolean; privileged: boolean;
  uiAccess: { pages: string[]; cards: string[]; updatedAt: string | null } | null;
};
export type PermissionEntry = { key: string; fieldDomain: string; risk: string };
export type AccessCatalog = { pages: UiPageDefinition[]; cards: UiCardDefinition[]; permissions: PermissionEntry[] };
export type RolePreview = { role: RoleView; permissions: string[]; access: EffectiveUiAccess };

export type MemberSummary = {
  id: string; status: string; name: string; email: string | null; employeeCode: string | null; department: string | null;
  roleCodes: string[]; roleNames: string[]; overrideCount: number;
};
export type MemberOverride = { id: string; type: "page" | "card"; key: string; effect: "allow" | "deny"; reason: string; expiresAt: string; createdAt: string };
export type MemberAccess = {
  member: MemberSummary; roles: Array<{ id: string; code: string; name: string }>; permissions: string[];
  superAdmin: boolean; overrides: MemberOverride[]; access: EffectiveUiAccess;
};

export type AuditEvent = {
  id: string; action: string; entityType: string; entityId: string; reason: string | null;
  actorName: string | null; actorEmail: string | null; createdAt: string;
};
export type AuditPage = { items: AuditEvent[]; nextCursor: string | null };

export function formatDateTime(iso: string | null | undefined, locale: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(iso: string | null | undefined, locale: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(date);
}

/** A date N days ahead in the viewer's calendar (YYYY-MM-DD). */
export function daysAhead(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
