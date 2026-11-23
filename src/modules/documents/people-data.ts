"use client";

import useSWR from "swr";
import type { DocumentCategory, EmployeeDocument, EmployeeFolder, PersonFolder, UploadedDocument } from "@/server/documents/people";

/**
 * Client calls for People > Documents (the vault). Types mirror src/server/documents/people.ts
 * (type-only import, erased at build). Errors keep the server envelope's code and field details so
 * forms can map them onto fields.
 */

export type { DocumentCategory, EmployeeDocument, EmployeeFolder, PersonFolder, UploadedDocument };
export const CATEGORIES: readonly DocumentCategory[] = ["PASSPORT", "VISA", "WORK_PERMIT", "TRANSFER_ORDER", "CONTRACT", "OTHER"];
export const VAULT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
export const PEOPLE_CHANGED = "nucleus:people-changed";

export class VaultError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly details: Array<{ field: string; issue: string }>) { super(message); }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new VaultError(body?.error?.message ?? `Request failed (${response.status}).`, response.status, body?.error?.code ?? "ERROR", body?.error?.details ?? []);
  return body as T;
}
const get = async <T,>(url: string) => readJson<T>(await fetch(url, { cache: "no-store", credentials: "same-origin" }));

export type PeopleMeta = { page: number; pageSize: number; total: number; canUpload: boolean; scope: "all" | "self" };

export function usePeople(page: number, search: string, pageSize = 25) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set("search", search.trim());
  return useSWR(`/api/v1/documents/people?${query.toString()}`, (url: string) => get<{ data: PersonFolder[]; meta: PeopleMeta }>(url), { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true });
}

export function useEmployeeFolder(employeeId: string | null) {
  return useSWR(employeeId ? `/api/v1/employees/${employeeId}/documents` : null, async (url: string) => (await get<{ data: EmployeeFolder }>(url)).data, { revalidateOnFocus: false, shouldRetryOnError: false });
}

export type VaultUploadInput = { category: DocumentCategory; title?: string; expiryDate?: string; file: File };

export async function uploadToVault(employeeId: string, input: VaultUploadInput, idempotencyKey: string): Promise<UploadedDocument> {
  const buffer = new Uint8Array(await input.file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 0x8000) binary += String.fromCharCode(...buffer.subarray(index, index + 0x8000));
  const response = await fetch(`/api/v1/employees/${employeeId}/documents`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      category: input.category, fileName: input.file.name, contentBase64: btoa(binary),
      ...(input.title?.trim() ? { title: input.title.trim() } : {}), ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
    }),
  });
  const result = (await readJson<{ data: UploadedDocument }>(response)).data;
  window.dispatchEvent(new CustomEvent(PEOPLE_CHANGED, { detail: { employeeId, kind: "documents" } }));
  return result;
}

export async function accessLink(employeeId: string, documentId: string, mode: "view" | "download"): Promise<{ url: string; expiresAt: string }> {
  return (await get<{ data: { url: string; expiresAt: string } }>(`/api/v1/employees/${employeeId}/documents/${documentId}/access?mode=${mode}`)).data;
}
