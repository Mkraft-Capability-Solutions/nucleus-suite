/**
 * Client-side shapes of the payroll workspace API responses. They mirror the
 * server read models (src/server/payroll/{overview,loan-register,wage-register}.ts,
 * payslips.ts, gl.ts, fnf/service.ts) without importing server-only modules.
 */

export type PayslipLine = { code: string; label: string; kind: string; amountMinor: number };

export type PayslipSummary = {
  id: string;
  displayCode: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  period: string;
  runId: string;
  runDisplayCode: string;
  scope: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: string;
  generatedAt: string | null;
};

export type PayslipDetail = PayslipSummary & {
  lines: {
    earnings: PayslipLine[];
    deductions: PayslipLine[];
    informational: PayslipLine[];
    earningsMinor: number;
    deductionsMinor: number;
    netMinor: number;
  };
};

export type AdvanceView = { id: string; amountMinor: number; period: string | null; reason: string | null; status: string; requestedAt: string | null };

export type AdvanceAllowance = { available: boolean; limitMinor?: number; currency?: string; reason?: "no_basic_salary" | "open_loan" | "open_advance" };

export type PayrollOverview = {
  employee: { id: string; code: string; name: string; currency: string } | null;
  employeeUnavailableReason: string | null;
  latestPayslip: PayslipDetail | null;
  payslips: PayslipSummary[];
  nextPayDate: string | null;
  advanceAllowance: AdvanceAllowance | null;
  advances: AdvanceView[];
  runAudit: { runId: string; period: string; status: string; openAnomalies: number; totalAnomalies: number } | null;
};

export type PayrollRun = {
  id: string;
  period: string;
  scope: string;
  status: string;
  employee_count: number;
  gross_minor: number | string;
  deductions_minor: number | string;
  net_minor: number | string;
  currency: string;
  finalized_at: string | null;
};

export type DisbursementBatch = { id: string; payrollRunId: string; fileName: string; fileReference: string; state: string; totalAmountMinor: number; currency: string };

export type LoanGuarantor = { employeeId: string; name: string; code: string; status: string; sequence: number };

export type LoanRegisterRow = {
  id: string;
  employeeId: string;
  borrowerName: string;
  borrowerCode: string;
  department: string | null;
  designation: string | null;
  status: string;
  currency: string;
  principalMinor: number;
  outstandingMinor: number;
  instalmentMinor: number | null;
  tenureMonths: number | null;
  recoveredInstalments: number;
  purpose: string | null;
  guarantors: LoanGuarantor[];
};

export type GuarantorLock = {
  guarantorEmployeeId: string;
  guarantorName: string;
  guarantorCode: string;
  loanId: string;
  borrowerName: string;
  outstandingMinor: number;
  currency: string;
};

export type LoanRegister = { items: LoanRegisterRow[]; locks: GuarantorLock[]; total: number; page: number; pageSize: number; hasMore: boolean };

export type LoanEligibility = {
  employeeId: string;
  eligible: boolean;
  requiresDirectorOverride: boolean;
  reasons: string[];
  ceilingMinor: number | null;
  currency: string;
  serviceYears: number;
};

export type PersonOption = { id: string; employeeCode: string; firstName: string; lastName: string; department: string | null; status: string };

export type FnfClearance = { status: string; remarks: string | null; verified_at: string | null; verified_by: string | null };

export type FnfSettlement = {
  id: string;
  employee_id: string;
  exit_date: string;
  status: string;
  attributes: Record<string, unknown>;
  department_clearances: Record<string, FnfClearance>;
  payment_ref: string | null;
  disbursed_at: string | null;
  first_name: string | null;
  last_name: string | null;
  employee_code: string | null;
  currency: string | null;
};

export type WageRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  department: string | null;
  location: string | null;
  category: string | null;
  shift: string | null;
  payableOtMinutes: number;
  attendedDays: number;
  attendanceRecorded: boolean;
  currency: string;
  basicMinor: number | null;
  grossMinor: number | null;
  netMinor: number | null;
  masked: boolean;
};

export type WageRegister = { items: WageRow[]; total: number; viewer: { roles: string[]; compensationVisible: boolean }; period: string; page: number; pageSize: number; hasMore: boolean };

export type JournalLine = {
  accountCode: string;
  accountName: string;
  accountType: string;
  componentCode: string | null;
  debitMinor: number;
  creditMinor: number;
  dimensions: Record<string, string | null | undefined>;
};

export type JournalView = {
  runId: string;
  period: string;
  runType: string;
  asOf: string;
  state: string;
  blocked: boolean;
  unmapped: Array<{ componentCode: string; componentName: string; reason: string }>;
  journals: Array<{ legalEntityId: string; lines: JournalLine[]; totalDebitMinor: number; totalCreditMinor: number; balanced: boolean }>;
  totalDebitMinor: number;
  totalCreditMinor: number;
  residualMinor: number;
  balanced: boolean;
};

export type ComplianceObligation = { id: string; attributes: { title?: string; form_code?: string | null; due_date?: string; status?: string } };

export type LegalEntity = { id: string; code: string; legal_name: string; currency_code: string; status: string };

export const FNF_DEPARTMENTS = ["hr", "it", "finance", "admin"] as const;
export type FnfDepartment = (typeof FNF_DEPARTMENTS)[number];
