"use client";

import useSWR from "swr";
import type { LibraryDocument, LibraryTree } from "@/server/documents/library";

/**
 * Reads and writes for the document library. Every call goes to /api/v1/documents/library, which
 * decides what the caller may see: everyone's documents for HR and administrators, one's own
 * otherwise. A failed request surfaces its message, never empty data.
 */

export type { LibraryDocument, LibraryTree };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const details: Array<{ field: string; issue: string }> = body?.error?.details ?? [];
    const message = body?.error?.message ?? (response.status === 403 ? "You do not have access to these documents." : fallback);
    throw new ApiError(details.length ? `${message} ${details.map((detail) => detail.issue).join(" ")}` : message, response.status);
  }
  return body as T;
}

const get = async <T,>(url: string) => (await readJson<{ data: T; meta?: { truncated?: boolean } }>(await fetch(url, { cache: "no-store", credentials: "same-origin" }), "The documents could not be loaded."));

export function useTree() {
  return useSWR("/api/v1/documents/library/tree", async (url: string) => (await get<LibraryTree>(url)).data, { revalidateOnFocus: false, shouldRetryOnError: false });
}

export type Filters = { company?: string; department?: string; employee?: string; type?: string; search?: string };

export function listUrl(filters: Filters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return `/api/v1/documents/library?${query.toString()}`;
}

export function useDocuments(filters: Filters | null) {
  return useSWR(filters ? listUrl(filters) : null, async (url: string) => {
    const body = await get<LibraryDocument[]>(url);
    return { documents: body.data, truncated: Boolean(body.meta?.truncated) };
  }, { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true });
}

export type UploadInput = {
  employeeId: string; documentTypeId: string; title: string; documentNumber?: string; issuedOn?: string; expiresOn?: string; file: File;
};

/** Reads the file in the browser and sends it as base64 (the server checks its bytes). */
export async function uploadDocument(input: UploadInput): Promise<{ id: string; verification: string }> {
  const buffer = new Uint8Array(await input.file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 0x8000) binary += String.fromCharCode(...buffer.subarray(index, index + 0x8000));
  const response = await fetch("/api/v1/documents/library", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      employeeId: input.employeeId, documentTypeId: input.documentTypeId, title: input.title.trim(), fileName: input.file.name, contentBase64: btoa(binary),
      ...(input.documentNumber?.trim() ? { documentNumber: input.documentNumber.trim() } : {}),
      ...(input.issuedOn ? { issuedOn: input.issuedOn } : {}), ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
    }),
  });
  return (await readJson<{ data: { id: string; verification: string } }>(response, "The document could not be uploaded.")).data;
}

export async function deleteDocument(id: string, reason: string): Promise<void> {
  const response = await fetch(`/api/v1/documents/library/${id}`, {
    method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
  });
  await readJson(response, "The document could not be deleted.");
}

export const fileUrl = (id: string, download = false) => `/api/v1/documents/library/${id}/file${download ? "?download=1" : ""}`;

/** What the person sees as the document's state (expiry first, then verification). */
export function documentState(document: Pick<LibraryDocument, "expiresOn" | "verification">, today = new Date().toISOString().slice(0, 10)): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  const expiry = document.expiresOn?.slice(0, 10);
  if (expiry && expiry < today) return { label: "Expired", tone: "danger" };
  const value = document.verification.toLowerCase();
  if (value === "rejected") return { label: "Rejected", tone: "danger" };
  if (value === "verified" || value === "available") {
    if (expiry && expiry <= addDays(today, 60)) return { label: "Expires soon", tone: "warning" };
    return { label: "Verified", tone: "success" };
  }
  return { label: "Awaiting verification", tone: "warning" };
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
