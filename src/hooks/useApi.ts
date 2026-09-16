"use client";
import useSWR, { type SWRConfiguration } from "swr";
import { getJson } from "@/lib/client-api";

export const fetcher = (url: string) => getJson(url) as Promise<{ data: unknown; meta?: unknown }>;

export function useApiGet<T>(path: string | null, config?: SWRConfiguration) {
    const { data, error, isLoading, mutate } = useSWR<{ data: T }>(path, fetcher as any, {
        revalidateOnFocus: false,
        ...config,
    });
    return { data: data?.data ?? null, error, isLoading, mutate };
}

export async function apiPost<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
    return json as T;
}
