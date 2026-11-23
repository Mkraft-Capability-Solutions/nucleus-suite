/**
 * Client-side types and fetch helpers for the contract workforce console. Shapes mirror the route projections in
 * src/server/contractors/{workforce,agency-master,reconciliation}.ts. No business data lives here.
 */

export const NS = "components.Workspace.ContractWorkforceView";

export type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

export type ComplianceState = "verified" | "pending_verification" | "kyc_incomplete";
export const WORKER_CATEGORIES = ["contract", "third-party-employee", "third-party-helper"] as const;
export type WorkerCategory = (typeof WORKER_CATEGORIES)[number];

export type ContractWorker = {
  id: string; workerCode: string | null; name: string | null; agencyId: string | null; agencyName: string | null;
  contractId: string; contractCode: string | null; category: string | null; trade: string | null; uan: string | null;
  esicNumber: string | null; site: string | null; dailyWage: number | null; currency: string; hasRestDays: boolean;
  compliance: ComplianceState; status: string | null; startsOn: string | null;
};

export type Agency = {
  id: string; name: string | null; code: string | null; licenceNumber: string | null; pan: string | null;
  contactPerson: string | null; contactPhone: string | null; contractCount: number; workerCount: number;
  pfEvidence: { status: string | null; period: string | null }; esicEvidence: { status: string | null; period: string | null };
};

export type ContractOption = { id: string; code: string | null; agencyId: string; agencyName: string | null; status: string | null; startsOn: string | null; endsOn: string | null };
export type LocationOption = { id: string; code: string; name: string };

export type Verdict = "within_tolerance" | "action_required" | "disputed" | "approved";
export type Reconciliation = {
  id: string; agencyName: string; agencyCode: string; site: string; period: string; billedHours: number; billedMinor: number;
  verifiedHours: number; verifiedMinor: number; deltaHours: number; variancePct: number; currency: string; workerCount: number;
  status: string; verdict: Verdict;
};
export type WorkerLog = { id: string; workerName: string; workerCode: string; trade: string; billedHours: number; verifiedHours: number; deltaHours: number };
export type AuditEntry = { id: string; action: string; reason: string | null; created_at: string };
export type ReconciliationDetail = Reconciliation & { workerLogs: WorkerLog[]; auditTrail: AuditEntry[] };

export type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

type Envelope<T> = { data?: T; meta?: { total?: number }; error?: { message?: string; details?: Array<{ field: string; issue: string }> } };

/** GET a route and return its `data`; throws with the server's message when the response is not ok. */
export async function getData<T>(url: string, fallbackMessage: string, signal?: AbortSignal): Promise<{ data: T; total: number | null }> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || payload?.data === undefined) throw new Error(payload?.error?.message || fallbackMessage);
  return { data: payload.data, total: typeof payload.meta?.total === "number" ? payload.meta.total : null };
}

export type WriteResult<T> = { status: "ok"; data: T } | { status: "error"; message: string; fields: Record<string, string> };

/** POST with an Idempotency-Key. The caller reuses the same key when retrying the same submit. */
export async function postData<T>(url: string, body: unknown, idempotencyKey: string, fallbackMessage: string): Promise<WriteResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "error", message: fallbackMessage, fields: {} };
  }
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || payload?.data === undefined) {
    const fields: Record<string, string> = {};
    for (const detail of payload?.error?.details ?? []) if (detail.field && !fields[detail.field]) fields[detail.field] = detail.issue;
    return { status: "error", message: payload?.error?.message || fallbackMessage, fields };
  }
  return { status: "ok", data: payload.data };
}

export const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export function formatMoney(locale: string | undefined, amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale || undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 0 }).format(amount);
  }
}

export const formatMinor = (locale: string | undefined, minor: number, currency: string) => formatMoney(locale, minor / 100, currency);
export const formatNumber = (locale: string | undefined, value: number, digits = 1) =>
  new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: digits }).format(value);
