"use client";
import { useApiGet, apiPost } from "./useApi";

export function useLetters(employeeId?: string) {
    const path = employeeId ? `/api/v1/letters?employeeId=${employeeId}` : `/api/v1/letters`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { letters: data ?? [], error, isLoading, refresh: mutate };
}

export function useRecognition() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/recognition-events");
    return { recognitions: data ?? [], error, isLoading, refresh: mutate };
}

export function useAnnouncements() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/announcements");
    return { announcements: data ?? [], error, isLoading, refresh: mutate };
}

export function useHelpdesk() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/helpdesk");
    return { tickets: data ?? [], error, isLoading, refresh: mutate };
}
