"use client";

import { getJson } from "@/lib/client-api";
import type { PayslipDetail } from "./payroll-types";

/** Endpoints read by the payroll workspace (all tenant-scoped, authenticated, never cached). */
export const PAYROLL_ENDPOINTS = {
  overview: "/api/v1/payroll-overview",
  runs: "/api/v1/payroll-runs?pageSize=50",
  loanRegister: "/api/v1/loans/register?pageSize=50",
  fnf: "/api/v1/fnf-settlements?pageSize=50",
  obligations: "/api/v1/compliance/obligations",
  legalEntities: "/api/v1/organization/legal-entities",
  people: "/api/v1/people?pageSize=100",
} as const;

export type ReadResult<T> = { ok: boolean; data: T | null; message: string };

async function read<T>(path: string): Promise<ReadResult<T>> {
  try {
    const body = (await getJson(path)) as { data?: T } | null;
    if (!body || body.data === undefined) return { ok: false, data: null, message: "The response was empty." };
    return { ok: true, data: body.data, message: "" };
  } catch (error) {
    return { ok: false, data: null, message: error instanceof Error ? error.message : String(error) };
  }
}

export function getPayslipDetail(id: string): Promise<ReadResult<PayslipDetail>> {
  return read<PayslipDetail>(`/api/v1/payslips/${encodeURIComponent(id)}/detail`);
}

export function readJson<T>(path: string): Promise<ReadResult<T>> {
  return read<T>(path);
}
