"use client";
import { useApiGet, apiPost } from "./useApi";

export function useUsers() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/identity/users");
    return { users: data ?? [], error, isLoading, refresh: mutate };
}
