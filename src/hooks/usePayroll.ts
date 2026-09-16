"use client";
import { useApiGet, apiPost } from "./useApi";

export function usePayComponents() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/payroll/components");
    return { components: data ?? [], error, isLoading, refresh: mutate };
}

export function useSalaryStructures(employeeId?: string) {
    const path = employeeId ? `/api/v1/payroll/structures?employeeId=${employeeId}` : `/api/v1/payroll/structures`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { structures: data ?? [], error, isLoading, refresh: mutate };
}

export function usePayrollRuns(period?: string) {
    const path = period ? `/api/v1/payroll-runs?period=${period}` : `/api/v1/payroll-runs`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { runs: data ?? [], error, isLoading, refresh: mutate };
}

export function usePayrollAudit(runId: string) {
    const { data, error, isLoading, mutate } = useApiGet<any[]>(runId ? `/api/v1/payroll-runs/${runId}/audit` : null);
    return { anomalies: data ?? [], error, isLoading, refresh: mutate };
}

export function useTaxProfiles(employeeId?: string) {
    const path = employeeId ? `/api/v1/payroll/tax?employeeId=${employeeId}` : `/api/v1/payroll/tax`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { profiles: data ?? [], error, isLoading, refresh: mutate };
}

export function useDisbursements(batchId?: string) {
    const path = batchId ? `/api/v1/payroll/disbursements?batchId=${batchId}` : `/api/v1/payroll/disbursements`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { batches: data ?? [], error, isLoading, refresh: mutate };
}

export function useFnF(employeeId?: string) {
    const path = employeeId ? `/api/v1/fnf?employeeId=${employeeId}` : `/api/v1/fnf`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { settlements: data ?? [], error, isLoading, refresh: mutate };
}
