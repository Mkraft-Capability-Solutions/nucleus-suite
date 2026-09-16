"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { LOAN_PURPOSE_LABELS, LOAN_PURPOSES } from "@/lib/loan-constants";
import { picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Backend money is integer minor units (paise). Rendered with en-IN grouping. */
function formatMinor(minor: unknown, currency = "INR"): string {
  const value = num(minor);
  if (value === null) return "—";
  const grouped = (value / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "INR" ? `₹${grouped}` : `₹${grouped} ${currency}`;
}

/** Rupees (major units) -> integer minor units. Null when not a positive amount. */
function rupeesToMinor(rupees: string): number | null {
  const parsed = Number(rupees);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/**
 * The loan statuses the server can actually produce. `submitted`, `rejected`,
 * `approved`, `disbursed` and `repaid` are written by the loan service;
 * `closed` and `cancelled` are recognised terminal states in the same
 * vocabulary. Nothing outside this list is invented for display.
 */
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  disbursed: "Disbursed",
  repaid: "Repaid",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status ?? "—";
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "repaid" || status === "closed") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "disbursed") return "info";
  if (status === "approved") return "warning";
  return "neutral";
}



const INTEREST_METHOD_LABELS: Record<string, string> = {
  reducing_balance: "Reducing balance",
  flat: "Flat rate",
};

/** FRM-CMB-01 "Disbursement mode" is PL_PAYMENT_MODE; the registry owns the vocabulary. */
/** FRM-CMB-01: medical and education applications cannot be submitted without their document. */
const DOCUMENT_REQUIRED_PURPOSES: readonly string[] = ["medical", "education"];

/** Mirrors LOAN_WAIVER_REASON_MIN_LENGTH on the server; the server is the enforcement point. */
const SPECIAL_TERMS_REASON_MIN_LENGTH = 20;

const DISBURSEMENT_MODES: Array<[string, string]> = picklists.PL_PAYMENT_MODE.values.map((entry) => [entry.value, entry.label]);

/**
 * Indicative instalment only, so the applicant sees the cost before submitting.
 * The binding table is generated server-side at approval by
 * src/server/loans/schedule.ts and is never taken from this function.
 */
function indicativeInstalmentMinor(
  principalMinor: number,
  annualRatePct: number,
  tenureMonths: number,
  method: string,
): number | null {
  if (principalMinor <= 0 || tenureMonths <= 0 || !Number.isFinite(annualRatePct) || annualRatePct < 0) return null;
  if (method === "flat") {
    const interest = Math.round((principalMinor * (annualRatePct / 100) * tenureMonths) / 12);
    return Math.round(principalMinor / tenureMonths) + Math.round(interest / tenureMonths);
  }
  if (method === "reducing_balance") {
    const rate = annualRatePct / 100 / 12;
    if (rate === 0) return Math.round(principalMinor / tenureMonths);
    const growth = Math.pow(1 + rate, tenureMonths);
    return Math.round((principalMinor * rate * growth) / (growth - 1));
  }
  return null;
}

function auditLabel(action: string): string {
  return action.replace(/^loan\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type LoanRow = {
  id: string;
  employeeId: string;
  principalMinor: number | null;
  outstandingMinor: number | null;
  currency: string;
  status: string;
  directorOverride: boolean;
  purpose: string;
};

type Guarantor = { id: string; employeeId: string; sequence: number; status: string };

type AuditEntry = { action: string; reason: string | null; createdAt: string | null };

type Eligibility = {
  eligible: boolean;
  reasons: string[];
  maximumAmount: number;
  requiresDirectorOverride: boolean;
  /** RL-22: the multiple the ceiling was struck at, and the service it was struck on. */
  ceilingMultiple: number | null;
  serviceYears: number | null;
};

type LoanDetail = {
  status: string;
  purpose: string;
  principalMinor: number | null;
  outstandingMinor: number | null;
  tenureMonths: number | null;
  annualRatePct: number | null;
  interestMethod: string;
  moratoriumMonths: number;
  moratoriumInterest: string;
  repaymentStartMonth: string;
  sanctionedAmountMinor: number | null;
  specialTerms: string;
  directorOverride: boolean;
  overrideReason: string;
  /** FRM-CMB-01 "Rules waived": named at sanction, so the override can be read back. */
  rulesWaived: string[];
  guarantors: Guarantor[];
  eligibility: Eligibility | null;
  auditTrail: AuditEntry[];
  configurationGaps: Array<{ setting: string; issue: string }>;
};

type Instalment = {
  seq: number;
  dueMonth: string;
  openingMinor: number;
  principalMinor: number;
  interestMinor: number;
  instalmentMinor: number;
  closingMinor: number;
};

type ScheduleView = {
  method: string;
  startMonth: string;
  startMonthSource: string;
  moratoriumMonths: number;
  moratoriumInterest: string;
  instalmentMinor: number;
  totalInterestMinor: number;
  totalPayableMinor: number;
  instalments: Instalment[];
  summary: {
    paidToDateMinor: number;
    outstandingMinor: number;
    instalmentsRemaining: number;
    ledgerOutstandingMinor: number;
    nextDue: Instalment | null;
  };
};

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

/** The WF-LOA state machine as the loan service implements it. */
function deriveTimeline(status: string, guarantors: Guarantor[]): TimelineStep[] {
  const order = ["submitted", "consent", "approved", "disbursed", "repaid"];
  const consentDone = guarantors.length > 0 && guarantors.filter((g) => g.status === "approved").length >= 2;
  const reached =
    status === "repaid" || status === "closed"
      ? 5
      : status === "disbursed"
        ? 4
        : status === "approved"
          ? 3
          : consentDone
            ? 2
            : 1;
  const labels = ["Application submitted", "Guarantor consent", "Approved", "Disbursed", "Repaid and closed"];
  if (status === "rejected" || status === "cancelled") {
    return [
      { key: "submitted", label: "Application submitted", state: "done" },
      { key: "terminal", label: statusLabel(status), state: "current" },
    ];
  }
  return order.map((key, index) => ({
    key,
    label: labels[index],
    state: index + 1 < reached ? "done" : index + 1 === reached ? "current" : "todo",
  }));
}

const selectClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function LoansAdvancesPage() {
  // Deep-link preselect (?record=<loanId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [people, setPeople] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyEmployeeId, setApplyEmployeeId] = useState("");
  const [applyPurpose, setApplyPurpose] = useState<string>(LOAN_PURPOSES[0]);
  const [applyPrincipal, setApplyPrincipal] = useState("");
  const [applyTenure, setApplyTenure] = useState("24");
  const [applyRate, setApplyRate] = useState("10");
  const [applyMethod, setApplyMethod] = useState("");
  const [applyMoratorium, setApplyMoratorium] = useState("0");
  const [applyMoratoriumInterest, setApplyMoratoriumInterest] = useState("");
  const [applyStartMonth, setApplyStartMonth] = useState("");
  const [applyDocument, setApplyDocument] = useState("");
  const [applyMode, setApplyMode] = useState("");
  const [applyDate, setApplyDate] = useState("");
  const [applyGuarantorA, setApplyGuarantorA] = useState("");
  const [applyGuarantorB, setApplyGuarantorB] = useState("");
  const [applyGuarantorC, setApplyGuarantorC] = useState("");
  // FRM-CMB-01 "Special terms applied". An application above the RL-22 ceiling is
  // refused outright unless it is raised as a special-terms request, which W-06
  // routes to a Director.
  const [applySpecialTerms, setApplySpecialTerms] = useState(false);
  const [applySpecialTermsReason, setApplySpecialTermsReason] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applyOk, setApplyOk] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [loansRaw, peopleRaw] = await Promise.all([
          getJson("/api/v1/loans?page=1&pageSize=100"),
          getJson("/api/v1/people?search=&page=1&pageSize=100"),
        ]);
        const items = asRecord(loansRaw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          employeeId: str(item.employee_id),
          principalMinor: num(item.principal_minor),
          outstandingMinor: num(item.outstanding_minor),
          currency: str(item.currency, "INR"),
          status: str(item.status, "submitted"),
          directorOverride: item.director_override === true,
          purpose: str(item.purpose),
        }));
        const peopleItems = asRecord(peopleRaw).data;
        if (live) {
          setLoans(rows);
          setPeople(Array.isArray(peopleItems) ? (peopleItems as UnknownRecord[]) : []);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Loans could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      const id = str(person.id);
      if (!id) continue;
      const name = `${str(person.firstName)} ${str(person.lastName)}`.trim();
      map.set(id, name || str(person.employeeCode, id));
    }
    return map;
  }, [people]);

  function employeeName(employeeId: string): string {
    return nameMap.get(employeeId) ?? (employeeId ? `${employeeId.slice(0, 8)}…` : "Unknown employee");
  }

  function selectLoan(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setSchedule(null);
    setScheduleNotice("");
    setDetailError("");
  }

  const filtered = useMemo(
    () => loans.filter((loan) => statusFilter === "all" || loan.status === statusFilter),
    [loans, statusFilter],
  );

  const activeLoan = useMemo(
    () => loans.find((loan) => loan.id === selectedId) ?? filtered[0] ?? null,
    [loans, selectedId, filtered],
  );
  const activeId = activeLoan?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      setScheduleNotice("");
      try {
        const raw = await getJson(`/api/v1/loans/${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(raw).data);
        const loan = asRecord(data.loan);
        const eligibilityRaw = asRecord(data.eligibility);
        const next: LoanDetail = {
          status: str(loan.status, "submitted"),
          purpose: str(loan.purpose),
          principalMinor: num(loan.principal_minor),
          outstandingMinor: num(loan.outstanding_minor),
          tenureMonths: num(loan.tenure_months),
          annualRatePct: num(loan.annual_rate_pct),
          interestMethod: str(loan.interest_method),
          moratoriumMonths: num(loan.moratorium_months) ?? 0,
          moratoriumInterest: str(loan.moratorium_interest),
          repaymentStartMonth: str(loan.repayment_start_month),
          sanctionedAmountMinor: num(loan.sanctioned_amount_minor),
          specialTerms: str(loan.special_terms),
          directorOverride: loan.director_override === true,
          overrideReason: str(loan.override_reason),
          rulesWaived: Array.isArray(loan.rules_waived) ? (loan.rules_waived as unknown[]).filter((v): v is string => typeof v === "string") : [],
          guarantors: (Array.isArray(data.guarantors) ? (data.guarantors as UnknownRecord[]) : []).map((row) => ({
            id: str(row.id),
            employeeId: str(row.guarantor_employee_id),
            sequence: num(row.sequence) ?? 0,
            status: str(row.status, "pending"),
          })),
          eligibility: {
            eligible: eligibilityRaw.eligible === true,
            requiresDirectorOverride: eligibilityRaw.requiresDirectorOverride === true,
            reasons: Array.isArray(eligibilityRaw.reasons) ? (eligibilityRaw.reasons as unknown[]).map((r) => str(r)) : [],
            maximumAmount: num(eligibilityRaw.maximumAmount) ?? 0,
            ceilingMultiple: num(asRecord(eligibilityRaw.ceiling).multiple),
            serviceYears: num(asRecord(eligibilityRaw.ceiling).serviceYears),
          },
          auditTrail: (Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : []).map((row) => ({
            action: str(row.action),
            reason: str(row.reason) || null,
            createdAt: str(row.created_at) || null,
          })),
          configurationGaps: (Array.isArray(data.configurationGaps) ? (data.configurationGaps as UnknownRecord[]) : []).map((row) => ({
            setting: str(row.setting),
            issue: str(row.issue),
          })),
        };
        if (live) setDetail(next);
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "Record detail could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }

      try {
        const raw = await getJson(`/api/v1/loans/${encodeURIComponent(activeId)}/schedule`);
        const data = asRecord(asRecord(raw).data);
        const summary = asRecord(data.summary);
        const nextDue = summary.nextDue ? (asRecord(summary.nextDue) as unknown as Instalment) : null;
        if (live) {
          setSchedule({
            method: str(data.method),
            startMonth: str(data.startMonth),
            startMonthSource: str(data.startMonthSource, "recorded"),
            moratoriumMonths: num(data.moratoriumMonths) ?? 0,
            moratoriumInterest: str(data.moratoriumInterest),
            instalmentMinor: num(data.instalmentMinor) ?? 0,
            totalInterestMinor: num(data.totalInterestMinor) ?? 0,
            totalPayableMinor: num(data.totalPayableMinor) ?? 0,
            instalments: Array.isArray(data.instalments) ? (data.instalments as Instalment[]) : [],
            summary: {
              paidToDateMinor: num(summary.paidToDateMinor) ?? 0,
              outstandingMinor: num(summary.outstandingMinor) ?? 0,
              instalmentsRemaining: num(summary.instalmentsRemaining) ?? 0,
              ledgerOutstandingMinor: num(summary.ledgerOutstandingMinor) ?? 0,
              nextDue,
            },
          });
        }
      } catch (err) {
        if (live) {
          setSchedule(null);
          setScheduleNotice(err instanceof Error ? err.message : "The repayment schedule could not be loaded.");
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  const previewMinor = useMemo(() => {
    const principalMinor = rupeesToMinor(applyPrincipal);
    if (principalMinor === null) return null;
    return indicativeInstalmentMinor(principalMinor, Number(applyRate), Number(applyTenure), applyMethod);
  }, [applyPrincipal, applyRate, applyTenure, applyMethod]);

  async function submitApplication(): Promise<void> {
    setApplyError("");
    setApplyOk("");
    const principalMinor = rupeesToMinor(applyPrincipal);
    if (!applyEmployeeId) {
      setApplyError("Select the borrower.");
      return;
    }
    if (principalMinor === null) {
      setApplyError("Enter a positive principal in rupees.");
      return;
    }
    if (!applyMethod) {
      setApplyError("Select an interest method. It is a term of the loan product and has no default.");
      return;
    }
    if (DOCUMENT_REQUIRED_PURPOSES.includes(applyPurpose) && !applyDocument.trim()) {
      setApplyError("A medical or education loan needs its supporting document attached.");
      return;
    }
    const moratoriumMonths = Number(applyMoratorium);
    if (!Number.isInteger(moratoriumMonths) || moratoriumMonths < 0 || moratoriumMonths > 6) {
      setApplyError("Moratorium months must be a whole number between 0 and 6.");
      return;
    }
    if (moratoriumMonths > 0 && !applyMoratoriumInterest) {
      setApplyError("State whether interest accrues or is waived during the moratorium. It has no default.");
      return;
    }
    const guarantors = [applyGuarantorA, applyGuarantorB, applyGuarantorC].filter((id) => id.length > 0);
    if (guarantors.length < 2) {
      setApplyError("Two guarantors are mandatory.");
      return;
    }
    if (applySpecialTerms && applySpecialTermsReason.trim().length < SPECIAL_TERMS_REASON_MIN_LENGTH) {
      setApplyError(`State why special terms are sought, in at least ${SPECIAL_TERMS_REASON_MIN_LENGTH} characters. A Director approves the reason, not the tick.`);
      return;
    }
    setApplyBusy(true);
    try {
      const body: UnknownRecord = {
        employeeId: applyEmployeeId,
        principalMinor,
        tenureMonths: Number(applyTenure),
        annualRatePct: Number(applyRate),
        purpose: applyPurpose,
        guarantorEmployeeIds: guarantors,
        interestMethod: applyMethod,
        moratoriumMonths,
      };
      if (moratoriumMonths > 0) body.moratoriumInterest = applyMoratoriumInterest;
      if (applyStartMonth) body.repaymentStartMonth = applyStartMonth;
      if (applyDocument) body.supportingDocumentId = applyDocument;
      if (applyMode) body.disbursementMode = applyMode;
      if (applyDate) body.disbursementDate = applyDate;
      if (applySpecialTerms) {
        body.specialTermsRequested = true;
        body.specialTermsReason = applySpecialTermsReason.trim();
      }
      const response = await fetch("/api/v1/loans", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err = asRecord(asRecord(payload).error);
        const details = Array.isArray(err.details)
          ? (err.details as UnknownRecord[]).map((entry) => `${str(entry.field, "?")}: ${str(entry.issue, "?")}`).join("; ")
          : "";
        const message = str(err.message, `Request failed (${response.status})`);
        throw new Error(details ? `${message} (${details})` : message);
      }
      const data = asRecord(asRecord(payload).data);
      const id = str(data.id);
      const instalment = num(data.indicativeInstalmentMinor);
      setApplyOk(
        instalment === null
          ? "Application submitted. It now awaits guarantor consent."
          : `Application submitted. Indicative instalment ${formatMinor(instalment)}. It now awaits guarantor consent.`,
      );
      if (id) selectLoan(id);
      setApplyOpen(false);
      setApplyPrincipal("");
      refresh();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "The application could not be submitted.");
    } finally {
      setApplyBusy(false);
    }
  }

  const timeline = detail ? deriveTimeline(detail.status, detail.guarantors) : [];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="PAYROLL · SCR-080"
        title="Loans and advances"
        description="Loan applications, guarantor consent, sanction and the amortisation schedule that payroll recovers against."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setApplyError("");
                setApplyOk("");
                setApplyOpen((v) => !v);
              }}
            >
              <Plus className="mr-1.5 size-4" /> New loan application
            </Button>
          </div>
        }
      />

      {applyOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Loan application · FRM-CMB-01"
            description="Two guarantor consents are mandatory before sanction. The interest method and the moratorium treatment are terms of the loan and have no default."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Borrower</span>
              <select aria-label="Borrower" className={`${selectClass} w-full`} value={applyEmployeeId} onChange={(e) => setApplyEmployeeId(e.target.value)}>
                <option value="">Select an employee</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {employeeName(str(person.id))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Purpose</span>
              <select aria-label="Purpose" className={`${selectClass} w-full`} value={applyPurpose} onChange={(e) => setApplyPurpose(e.target.value)}>
                {LOAN_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {LOAN_PURPOSE_LABELS[purpose] ?? purpose}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Principal requested (₹)</span>
              <input aria-label="Principal requested" type="number" min="1" step="0.01" className={`${inputClass} w-full`} value={applyPrincipal} onChange={(e) => setApplyPrincipal(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tenure (months)</span>
              <input aria-label="Tenure months" type="number" min="1" max="84" className={`${inputClass} w-full`} value={applyTenure} onChange={(e) => setApplyTenure(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Interest rate (% p.a.)</span>
              <input aria-label="Annual interest rate" type="number" min="0" max="36" step="0.01" className={`${inputClass} w-full`} value={applyRate} onChange={(e) => setApplyRate(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Interest method</span>
              <select aria-label="Interest method" className={`${selectClass} w-full`} value={applyMethod} onChange={(e) => setApplyMethod(e.target.value)}>
                <option value="">Select a method (no default)</option>
                <option value="reducing_balance">Reducing balance</option>
                <option value="flat">Flat rate</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Repayment start month</span>
              <input aria-label="Repayment start month" type="month" className={`${inputClass} w-full`} value={applyStartMonth} onChange={(e) => setApplyStartMonth(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Moratorium (months)</span>
              <input aria-label="Moratorium months" type="number" min="0" max="24" className={`${inputClass} w-full`} value={applyMoratorium} onChange={(e) => setApplyMoratorium(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Moratorium interest</span>
              <select
                aria-label="Moratorium interest treatment"
                className={`${selectClass} w-full`}
                value={applyMoratoriumInterest}
                disabled={Number(applyMoratorium) <= 0}
                onChange={(e) => setApplyMoratoriumInterest(e.target.value)}
              >
                <option value="">Select a treatment (no default)</option>
                <option value="accrue">Interest accrues</option>
                <option value="waive">Interest waived</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Guarantor 1 (mandatory)</span>
              <select aria-label="Guarantor 1" className={`${selectClass} w-full`} value={applyGuarantorA} onChange={(e) => setApplyGuarantorA(e.target.value)}>
                <option value="">Select an employee</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {employeeName(str(person.id))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Guarantor 2 (mandatory)</span>
              <select aria-label="Guarantor 2" className={`${selectClass} w-full`} value={applyGuarantorB} onChange={(e) => setApplyGuarantorB(e.target.value)}>
                <option value="">Select an employee</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {employeeName(str(person.id))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Guarantor 3 (optional)</span>
              <select aria-label="Guarantor 3" className={`${selectClass} w-full`} value={applyGuarantorC} onChange={(e) => setApplyGuarantorC(e.target.value)}>
                <option value="">Not named</option>
                {people.map((person) => (
                  <option key={str(person.id)} value={str(person.id)}>
                    {employeeName(str(person.id))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Supporting document{DOCUMENT_REQUIRED_PURPOSES.includes(applyPurpose) ? " (required)" : ""}
              </span>
              <ReferencePicker
                endpoint="/api/v1/documents"
                ariaLabel="Supporting document"
                className={`${inputClass} w-full`}
                placeholder={DOCUMENT_REQUIRED_PURPOSES.includes(applyPurpose) ? "Search a document (required for this purpose)…" : "Search a document (optional)…"}
                value={applyDocument}
                onChange={setApplyDocument}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disbursement mode</span>
              <select aria-label="Disbursement mode" className={`${selectClass} w-full`} value={applyMode} onChange={(e) => setApplyMode(e.target.value)}>
                <option value="">Not stated</option>
                {DISBURSEMENT_MODES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disbursement date</span>
              <input aria-label="Disbursement date" type="date" className={`${inputClass} w-full`} value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
            </label>
            <label className="flex min-w-0 items-start gap-2 sm:col-span-2">
              <input
                aria-label="Special terms applied"
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={applySpecialTerms}
                onChange={(e) => setApplySpecialTerms(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Special terms applied</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  Tick to record an application that exceeds the eligible ceiling. The sanction then requires a Director approval that names the ceiling among the rules it waives.
                </span>
              </span>
            </label>
            {applySpecialTerms ? (
              <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reason for special terms (min {SPECIAL_TERMS_REASON_MIN_LENGTH} characters)
                </span>
                <textarea
                  aria-label="Reason for special terms"
                  className={`${inputClass} min-h-[72px] w-full`}
                  value={applySpecialTermsReason}
                  onChange={(e) => setApplySpecialTermsReason(e.target.value)}
                />
              </label>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Derived instalment</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">
                {previewMinor === null ? "—" : formatMinor(previewMinor)}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {applyMethod
                  ? `Indicative, on ${INTEREST_METHOD_LABELS[applyMethod] ?? applyMethod}. The binding schedule is generated at sanction.`
                  : "Select an interest method to derive the instalment."}
              </p>
            </div>
            <Button className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-bold sm:w-auto" disabled={applyBusy} onClick={() => void submitApplication()}>
              {applyBusy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
          {applyError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{applyError}</p> : null}
        </Surface>
      ) : null}
      {applyOk ? <p className="mb-4 text-xs leading-relaxed text-success">{applyOk}</p> : null}

      <Surface className="mb-6">
        <SectionHeading
          title="Process guide · SCR-080"
          description="Apply → eligibility (4x basic, 6x at five years of service or more) → two guarantor consents → sanction (or an audited Director override with a recorded reason) → schedule generated → disburse → recover through payroll → repaid and closed."
        />
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
        <Link href={activeId ? `/payroll?record=${encodeURIComponent(activeId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} loan${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <select aria-label="Status filter" className={`${selectClass} w-full max-w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {loans.length === 0 ? "No loan applications exist yet. Submit the first application to begin." : "No loans match this filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 text-right font-bold">Principal</th>
                    <th className="px-3 py-2 text-right font-bold">Outstanding</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((loan) => {
                    const selected = loan.id === activeId;
                    return (
                      <tr key={loan.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectLoan(loan.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0 truncate text-xs font-semibold text-foreground">{employeeName(loan.employeeId)}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{formatMinor(loan.principalMinor, loan.currency)}</span>
                            <span className="whitespace-nowrap text-right text-xs tabular-nums text-foreground">{formatMinor(loan.outstandingMinor, loan.currency)}</span>
                            <span>
                              <StatusPill tone={statusTone(loan.status)}>{statusLabel(loan.status)}</StatusPill>
                            </span>
                            <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Record detail"
            description={activeLoan ? `${employeeName(activeLoan.employeeId)} · ${formatMinor(activeLoan.principalMinor, activeLoan.currency)} principal` : "Select a loan to inspect it"}
            action={detail ? <StatusPill tone={statusTone(detail.status)}>{statusLabel(detail.status)}</StatusPill> : undefined}
          />
          {!activeLoan ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No loan selected.</p>
          ) : detailLoading && !detail ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !detail ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : detail ? (
            <div>
              <p className="text-xs text-muted-foreground">
                {detail.purpose || "Purpose not recorded"} · {detail.tenureMonths ?? "—"} months · {detail.annualRatePct ?? "—"}% p.a. ·{" "}
                {detail.interestMethod ? (INTEREST_METHOD_LABELS[detail.interestMethod] ?? detail.interestMethod) : "No interest method recorded"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                {[
                  [formatMinor(detail.sanctionedAmountMinor ?? detail.principalMinor), "Sanctioned"],
                  [formatMinor(detail.outstandingMinor), "Outstanding"],
                  [detail.moratoriumMonths > 0 ? `${detail.moratoriumMonths} mo` : "None", "Moratorium"],
                ].map(([value, label]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5 last:col-span-2 sm:last:col-span-1">
                    <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Eligibility</h3>
              <div className="mt-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={detail.eligibility?.eligible ? "success" : "danger"}>
                    {detail.eligibility?.eligible ? "Eligible" : "Not eligible"}
                  </StatusPill>
                  <span className="text-[11px] text-muted-foreground">
                    Ceiling {detail.eligibility ? `₹${detail.eligibility.maximumAmount.toLocaleString("en-IN")}` : "—"}
                    {detail.eligibility?.ceilingMultiple === null || detail.eligibility?.ceilingMultiple === undefined
                      ? ""
                      : ` · ${detail.eligibility.ceilingMultiple}x basic at ${(detail.eligibility.serviceYears ?? 0).toFixed(1)} years of service`}
                  </span>
                  {detail.directorOverride ? <StatusPill tone="warning">Director override</StatusPill> : null}
                </div>
                {detail.eligibility && detail.eligibility.reasons.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {detail.eligibility.reasons.map((reason) => (
                      <li key={reason} className="text-[11px] leading-relaxed text-muted-foreground">
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">No eligibility blockers recorded.</p>
                )}
                {detail.rulesWaived.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-foreground">
                    Rules waived: {detail.rulesWaived.map((rule) => rule.replace(/_/g, " ")).join(", ")}
                  </p>
                ) : null}
                {detail.overrideReason ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-foreground">Override reason: {detail.overrideReason}</p>
                ) : null}
              </div>

              {detail.configurationGaps.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {detail.configurationGaps.map((gap) => (
                    <li key={gap.setting} className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
                      {gap.issue}
                    </li>
                  ))}
                </ul>
              ) : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Guarantors</h3>
              {detail.guarantors.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No guarantors are named on this application.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.guarantors.map((guarantor) => (
                    <li key={guarantor.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                        {guarantor.sequence}. {employeeName(guarantor.employeeId)}
                      </span>
                      <StatusPill tone={guarantor.status === "approved" ? "success" : guarantor.status === "rejected" ? "danger" : "neutral"}>
                        {guarantor.status === "approved" ? "Consented" : guarantor.status === "rejected" ? "Refused" : "Awaiting consent"}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Repayment schedule</h3>
              {!schedule ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {scheduleNotice || "No schedule yet. It is generated when the loan is sanctioned."}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {INTEREST_METHOD_LABELS[schedule.method] ?? schedule.method} · first instalment {formatMonth(schedule.startMonth)}
                    {schedule.startMonthSource === "derived_from_approval" ? " (derived from the sanction date; no start month was recorded)" : ""}
                    {schedule.moratoriumMonths > 0 ? ` · ${schedule.moratoriumMonths}-month moratorium, interest ${schedule.moratoriumInterest === "accrue" ? "accrued" : "waived"}` : ""}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                    {[
                      [formatMinor(schedule.summary.paidToDateMinor), "Paid to date"],
                      [formatMinor(schedule.summary.outstandingMinor), "Outstanding"],
                      [String(schedule.summary.instalmentsRemaining), "Instalments left"],
                    ].map(([value, label]) => (
                      <div key={label} className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 p-2.5 last:col-span-2 sm:last:col-span-1">
                        <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {schedule.summary.nextDue
                      ? `Next due: instalment ${schedule.summary.nextDue.seq} of ${schedule.instalments.length}, ${formatMinor(schedule.summary.nextDue.instalmentMinor)} in ${formatMonth(schedule.summary.nextDue.dueMonth)}.`
                      : "Every instalment is covered."}{" "}
                    Total interest {formatMinor(schedule.totalInterestMinor)} on {formatMinor(schedule.totalPayableMinor)} payable.
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-bold">#</th>
                          <th className="px-3 py-2 font-bold">Due</th>
                          <th className="px-3 py-2 text-right font-bold">Opening</th>
                          <th className="px-3 py-2 text-right font-bold">Principal</th>
                          <th className="px-3 py-2 text-right font-bold">Interest</th>
                          <th className="px-3 py-2 text-right font-bold">Instalment</th>
                          <th className="px-3 py-2 text-right font-bold">Closing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.instalments.map((row) => (
                          <tr key={row.seq} className="border-t border-border/60">
                            <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{row.seq}</td>
                            <td className="px-3 py-2 text-xs text-foreground">{formatMonth(row.dueMonth)}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{formatMinor(row.openingMinor)}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{formatMinor(row.principalMinor)}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{formatMinor(row.interestMinor)}</td>
                            <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground">{formatMinor(row.instalmentMinor)}</td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{formatMinor(row.closingMinor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {timeline.map((step, index) => (
                  <li key={step.key} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${step.state === "done" ? "border-primary bg-primary text-primary-foreground" : step.state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {step.state === "done" ? "✓" : index + 1}
                      </span>
                      {index < timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </span>
                    <span className={`pb-3 text-xs ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {index + 1}. {step.label}
                      {step.state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                    </span>
                  </li>
                ))}
              </ol>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this loan.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.auditTrail.map((entry, index) => (
                    <li key={`${entry.action}-${index}`} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{auditLabel(entry.action)}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {[timeLabel(entry.createdAt), entry.reason].filter(Boolean).join(" · ") || "Recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {detail.specialTerms ? (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Special terms: {detail.specialTerms}</p>
              ) : null}
              <Link href={`/payroll?record=${encodeURIComponent(activeId)}`} className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Open in Payroll <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
