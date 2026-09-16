"use client";
import { useApiGet, apiPost } from "./useApi";

export function useCompliance() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/compliance/calendar");
    return { calendarItems: data ?? [], error, isLoading, refresh: mutate };
}

export function useContracts() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/contractors/contracts");
    return { contracts: data ?? [], error, isLoading, refresh: mutate };
}

export function useInvoices() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/contractors/invoices");
    return { invoices: data ?? [], error, isLoading, refresh: mutate };
}
