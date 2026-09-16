"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lock, ShieldAlert, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workforcePolicyDefaults } from "@/lib/workforce-policy";
import { SectionHeading, StateBlock, StatusPill, StatTile, Surface } from "../page-primitives";
import { asRecord, currencyLabel, listFromEnvelope, num, str, useLive } from "../workforce/records";

/**
 * Company loans, the guarantor lock and the loans ledger.
 *
 * Policy numbers are read from `workforcePolicyDefaults.loan` — the ceiling
 * multiple, the required guarantor count, the concurrent-loan limit, the
 * guarantor lock and the interest rate. None of them is written into this file.
 *
 * The lock radar is not a re-reading of the rule: it is the same test the server
 * applies in `exposureFlags` (src/server/loans/service.ts) — an employee is
 * blocked from borrowing while they hold a guarantee in `pending` or `approved`
 * on a loan that has not reached a terminal state (repaid, closed, rejected,
 * cancelled). A PENDING guarantee counts: RL-21 attaches the block to standing as
 * guarantor, not to having consented. The outstanding balance is shown beside each
 * lock so the size of the exposure is visible, but the balance is not what creates
 * the block, and a row is never hidden because its balance happens to be zero.
 *
 * The database permits `sequence between 1 and 3` guarantors while policy requires
 * exactly `requiredGuarantors`. A loan whose standing guarantee count falls short
 * is surfaced as an exception rather than dropped from the ledger.
 */

const LOAN_POLICY = workforcePolicyDefaults.loan;

/** Mirrors `TERMINAL_LOAN` (src/server/loans/service.ts): the states that release every block. */
const TERMINAL_LOAN_STATUSES = ["repaid", "closed", "rejected", "cancelled"];

/** Mirrors `STANDING_GUARANTEE_STATUSES` (src/server/loans/service.ts). */
const STANDING_GUARANTEE_STATUSES = ["pending", "approved"];

type Guarantor = { id: string; employeeId: string; sequence: number; status: string };

type LoanDetail = {
  id: string;
  version: number;
  employeeId: string;
  status: string;
  purpose: string;
  currency: string;
  principalMinor: number;
  outstandingMinor: number;
  instalmentMinor: number | null;
  tenureMonths: number;
  recoveredMinor: number;
  directorOverride: boolean;
  rulesWaived: string[];
  guarantors: Guarantor[];
  ceilingMinor: number | null;
  ceilingMultiple: number | null;
  instalmentsPaid: number | null;
  instalmentsTotal: number | null;
  scheduleNote: string;
};

type ConfigurationGap = { setting: string; issue: string };

function envelopeData(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload).data);
}

function isTerminal(status: string): boolean {
  return TERMINAL_LOAN_STATUSES.includes(status.trim().toLowerCase());
}

function isStanding(status: string): boolean {
  return STANDING_GUARANTEE_STATUSES.includes((status || "pending").trim().toLowerCase());
}

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function loanStatusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "repaid" || status === "closed") return "success";
  if (status === "disbursed") return "info";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "approved") return "success";
  return "warning";
}

/** A fresh Idempotency-Key for one consequential write. Module scope: never called during render. */
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Parses a rupee amount with at most two decimals into minor units. Rejects anything else. */
function toMinorUnits(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [major, fraction = ""] = trimmed.split(".");
  return Number(major) * 100 + Number(fraction.padEnd(2, "0"));
}

function detailFrom(loanId: string, version: number, payload: unknown, schedule: unknown, scheduleNote: string): LoanDetail | null {
  const data = envelopeData(payload);
  const loan = asRecord(data.loan);
  if (!loan.id) return null;
  const eligibility = asRecord(data.eligibility);
  const ceiling = asRecord(eligibility.ceiling);
  const scheduleData = schedule === null ? {} : envelopeData(schedule);
  const summary = asRecord(scheduleData.summary);
  const instalmentsTotal = typeof summary.instalmentCount === "number" ? summary.instalmentCount : null;
  const instalmentsRemaining = typeof summary.instalmentsRemaining === "number" ? summary.instalmentsRemaining : null;
  return {
    id: loanId,
    version,
    employeeId: str(loan.employee_id),
    status: str(loan.status, "submitted"),
    purpose: str(loan.purpose, "Not recorded"),
    currency: "INR",
    principalMinor: num(loan.principal_minor),
    outstandingMinor: num(loan.outstanding_minor),
    instalmentMinor: typeof loan.instalment_minor === "number" ? loan.instalment_minor : null,
    tenureMonths: num(loan.tenure_months),
    recoveredMinor: num(data.recoveredMinor),
    directorOverride: loan.director_override === true,
    rulesWaived: Array.isArray(loan.rules_waived) ? loan.rules_waived.filter((entry): entry is string => typeof entry === "string") : [],
    guarantors: Array.isArray(data.guarantors)
      ? data.guarantors.map((entry) => {
          const row = asRecord(entry);
          return {
            id: str(row.id),
            employeeId: str(row.guarantor_employee_id),
            sequence: num(row.sequence),
            status: str(row.status, "pending"),
          };
        })
      : [],
    ceilingMinor: typeof ceiling.maximumMinor === "number" ? ceiling.maximumMinor : null,
    ceilingMultiple: typeof ceiling.multiple === "number" ? ceiling.multiple : null,
    instalmentsTotal,
    instalmentsPaid: instalmentsTotal !== null && instalmentsRemaining !== null ? instalmentsTotal - instalmentsRemaining : null,
    scheduleNote,
  };
}

export function CompanyLoansTab() {
  const listState = useLive("/api/v1/loans?page=1&pageSize=50");
  const listRows = useMemo(
    () =>
      listFromEnvelope(listState.data)
        .map((row) => ({ id: str(row.id), version: num(row.version, 1) }))
        .filter((row) => row.id),
    [listState.data],
  );

  const peopleState = useLive("/api/v1/people?search=&page=1&pageSize=100");
  const nameFor = useMemo(() => {
    const index = new Map<string, string>();
    for (const person of listFromEnvelope(peopleState.data)) {
      const name = [str(person.firstName), str(person.lastName)].filter(Boolean).join(" ").trim();
      index.set(str(person.id), name || str(person.employeeCode, "Unnamed employee"));
    }
    return (employeeId: string) => index.get(employeeId) ?? `Employee ${employeeId.slice(0, 8)}`;
  }, [peopleState.data]);

  /**
   * One snapshot per (reload token, loan list) pair. Holding the key the rows were
   * loaded for lets loading, errors and the rows themselves be derived, so nothing
   * has to be written back into state while the effect body runs.
   */
  const [reloadToken, setReloadToken] = useState(0);
  const loanKeys = useMemo(() => listRows.map((row) => `${row.id}:${row.version}`).join(","), [listRows]);
  const loadKey = `${reloadToken}|${loanKeys}`;

  const [loaded, setLoaded] = useState<{ key: string; rows: LoanDetail[]; error: string; gaps: ConfigurationGap[] }>({
    key: "",
    rows: [],
    error: "",
    gaps: [],
  });

  const fresh = loaded.key === loadKey;
  const details = useMemo(() => (fresh ? loaded.rows : []), [fresh, loaded.rows]);
  const gaps = fresh ? loaded.gaps : [];
  const detailsError = fresh ? loaded.error : "";
  // The list itself is still in flight until its first response lands; until then an
  // empty ledger means "not read yet", never "no loans exist".
  const detailsLoading = !fresh || listState.loading;

  useEffect(() => {
    const keys = loanKeys ? loanKeys.split(",") : [];
    let cancelled = false;

    async function loadOne(key: string): Promise<LoanDetail | null> {
      const [id, rawVersion] = key.split(":");
      const response = await fetch(`/api/v1/loans/${id}`, { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      const status = str(asRecord(asRecord(envelopeData(payload).loan)).status, "submitted");
      // A schedule exists only from approval onwards; asking for one earlier is a
      // documented 404, not an error to report.
      let schedule: unknown = null;
      let scheduleNote = "No repayment schedule: one is generated when the loan is approved.";
      if (status === "approved" || status === "disbursed" || status === "repaid" || status === "closed") {
        const scheduleResponse = await fetch(`/api/v1/loans/${id}/schedule`, { cache: "no-store" });
        if (scheduleResponse.ok) {
          schedule = await scheduleResponse.json().catch(() => null);
          scheduleNote = "";
        } else {
          scheduleNote = "This loan has no stored repayment schedule.";
        }
      }
      return detailFrom(id, Number(rawVersion) || 1, payload, schedule, scheduleNote);
    }

    /** The configuration gaps are the same list on every loan; one read answers for all. */
    async function loadGaps(): Promise<ConfigurationGap[]> {
      if (keys.length === 0) return [];
      const response = await fetch(`/api/v1/loans/${keys[0].split(":")[0]}`, { cache: "no-store" });
      if (!response.ok) return [];
      const list = envelopeData(await response.json().catch(() => null)).configurationGaps;
      if (!Array.isArray(list)) return [];
      return list.map((entry) => {
        const row = asRecord(entry);
        return { setting: str(row.setting), issue: str(row.issue) };
      });
    }

    Promise.all([Promise.all(keys.map((key) => loadOne(key).catch(() => null))), loadGaps().catch(() => [])])
      .then(([results, gapList]) => {
        if (cancelled) return;
        const rows = results.filter((entry): entry is LoanDetail => entry !== null);
        setLoaded({
          key: loadKey,
          rows,
          gaps: gapList,
          error:
            rows.length < keys.length
              ? `${keys.length - rows.length} of ${keys.length} loans could not be read; they are omitted from the figures below.`
              : "",
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: loadKey, rows: [], gaps: [], error: "The loan details could not be loaded." });
      });

    return () => {
      cancelled = true;
    };
  }, [loadKey, loanKeys]);

  const refreshAll = useCallback(() => {
    listState.refresh();
    setReloadToken((current) => current + 1);
  }, [listState]);

  /** Every standing guarantee on a non-terminal loan — the exact server test. */
  const locks = useMemo(() => {
    const rows: Array<{ key: string; guarantorId: string; loan: LoanDetail; guarantor: Guarantor }> = [];
    for (const loan of details) {
      if (isTerminal(loan.status)) continue;
      for (const guarantor of loan.guarantors) {
        if (!isStanding(guarantor.status)) continue;
        rows.push({ key: `${loan.id}-${guarantor.id}`, guarantorId: guarantor.employeeId, loan, guarantor });
      }
    }
    return rows;
  }, [details]);

  const lockedEmployeeCount = useMemo(() => new Set(locks.map((row) => row.guarantorId)).size, [locks]);

  /** Loans whose standing guarantee count does not meet policy. */
  const guarantorExceptions = useMemo(
    () =>
      details
        .filter((loan) => !isTerminal(loan.status))
        .map((loan) => ({ loan, standing: loan.guarantors.filter((guarantor) => isStanding(guarantor.status)).length }))
        .filter((entry) => entry.standing !== LOAN_POLICY.requiredGuarantors),
    [details],
  );

  const outstandingTotalMinor = details.filter((loan) => !isTerminal(loan.status)).reduce((total, loan) => total + loan.outstandingMinor, 0);
  const activeLoans = details.filter((loan) => loan.status === "disbursed");

  const [selectedId, setSelectedId] = useState("");
  const selected = details.find((loan) => loan.id === selectedId) ?? null;
  const [amountInput, setAmountInput] = useState("");
  const [actionState, setActionState] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function recordRepayment() {
    if (!selected) return;
    const amountMinor = toMinorUnits(amountInput);
    if (amountMinor === null || amountMinor <= 0) {
      setActionState({ tone: "error", message: "Enter an amount in rupees, with at most two decimals." });
      return;
    }
    setSubmitting(true);
    setActionState(null);
    try {
      const response = await fetch(`/api/v1/loans/${selected.id}/repay`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          // The loans endpoints do not yet require either header — the service
          // guards on status and on the outstanding balance instead — but both are
          // sent so this call behaves like every other consequential write and
          // starts being protected the moment the route enforces them.
          "idempotency-key": idempotencyKey(),
          "if-match": `"${selected.version}"`,
        },
        body: JSON.stringify({ amountMinor }),
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        setActionState({ tone: "error", message: str(asRecord(payload.error).message, `The repayment was refused (${response.status}).`) });
        return;
      }
      const data = envelopeData(payload);
      setActionState({
        tone: "ok",
        message: `Recorded. Outstanding is now ${currencyLabel(num(data.outstandingMinor), selected.currency)} and the loan is ${humanise(str(data.status, selected.status))}.`,
      });
      setAmountInput("");
      refreshAll();
    } catch {
      setActionState({ tone: "error", message: "Could not reach the server." });
    } finally {
      setSubmitting(false);
    }
  }

  if (listState.error) {
    return (
      <Surface>
        <StateBlock tone="error" icon={AlertTriangle} title="Loans could not be loaded" description={listState.error} />
      </Surface>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ---------------------------------------------------------------- policy card */}
      <Surface>
        <SectionHeading
          title="Company loan policy"
          description="Read from the tenant's workforce policy. Changing a rule is a policy change, not a code change."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[12px] text-muted-foreground">Ceiling</p>
            <p className="mt-2 font-mono text-[22px] font-bold leading-7 text-foreground tabular-nums">{LOAN_POLICY.ceilingMultipleOfBasic}×</p>
            <p className="mt-1 text-[12px] text-muted-foreground">of monthly basic pay</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[12px] text-muted-foreground">Guarantors required</p>
            <p className="mt-2 font-mono text-[22px] font-bold leading-7 text-foreground tabular-nums">{LOAN_POLICY.requiredGuarantors}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">active employee guarantors per loan</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[12px] text-muted-foreground">Concurrent loans</p>
            <p className="mt-2 font-mono text-[22px] font-bold leading-7 text-foreground tabular-nums">{LOAN_POLICY.maxActiveLoansPerEmployee}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">per employee at any time</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[12px] text-muted-foreground">Guarantor lock</p>
            <p className="mt-2 font-heading text-[18px] font-bold leading-7 text-foreground">{LOAN_POLICY.guarantorLockWhileOutstanding ? "In force" : "Not in force"}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {LOAN_POLICY.guarantorLockWhileOutstanding
                ? "A guarantor cannot borrow while a loan they guarantee is live"
                : "Guaranteeing a loan does not block the guarantor from borrowing"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-[19px] text-muted-foreground">
          Interest is {LOAN_POLICY.annualInterestPercent}% a year on a company welfare loan. The sanctioning engine applies a banded ceiling from the statutory rule
          pack rather than the flat policy multiple above: the standard multiple matches the policy, and a higher multiple applies from a configured length of
          service. Each loan below shows the multiple that was actually applied to it.
        </p>
        {gaps.length > 0 && (
          <div className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3" role="status">
            <p className="text-[13px] font-semibold text-foreground">Controls that are declared but not enforced</p>
            <ul className="mt-1.5 space-y-1 text-[12px] text-muted-foreground">
              {gaps.map((gap) => (
                <li key={gap.setting}>
                  <span className="font-mono text-foreground">{gap.setting}</span> — {gap.issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Loans on record" value={String(details.length)} icon={Wallet} tone="neutral" hint={`${activeLoans.length} disbursed`} />
        <StatTile label="Outstanding principal" value={currencyLabel(outstandingTotalMinor)} icon={Wallet} tone="primary" hint="Across every non-terminal loan" />
        <StatTile label="Employees locked as guarantor" value={String(lockedEmployeeCount)} icon={Lock} tone="warning" hint={`${locks.length} standing guarantees`} />
        <StatTile label="Guarantor-count exceptions" value={String(guarantorExceptions.length)} icon={ShieldAlert} tone={guarantorExceptions.length > 0 ? "danger" : "neutral"} hint={`Policy requires ${LOAN_POLICY.requiredGuarantors}`} />
      </div>

      {detailsError && (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-[13px] text-foreground" role="status">
          {detailsError}
        </p>
      )}

      {/* ---------------------------------------------------------------- guarantor lock radar */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Guarantor lock radar"
            description="Employees who cannot borrow right now because they stand as guarantor on a loan that has not closed. A pending guarantee locks as firmly as an approved one."
            action={<Button variant="outline" size="sm" onClick={refreshAll}>Refresh</Button>}
          />
        </div>
        {!LOAN_POLICY.guarantorLockWhileOutstanding && (
          <p className="mx-5 mb-4 rounded-lg border border-border bg-secondary/40 p-3 text-[13px] text-foreground">
            This tenant has the guarantor lock switched off, so the rows below record standing guarantees but block nobody.
          </p>
        )}
        {detailsLoading && details.length === 0 && <StateBlock tone="loading" title="Reading the guarantee register…" />}
        {!detailsLoading && locks.length === 0 && (
          <StateBlock title="Nobody is locked" description="No employee currently stands as guarantor on a loan that is still live." />
        )}
        {locks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 860 }}>
              <caption className="sr-only">Employees blocked from borrowing by a standing guarantee</caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="px-3 py-3 pl-5 font-medium">Guarantor</th>
                  <th scope="col" className="px-3 py-3 font-medium">Standing</th>
                  <th scope="col" className="px-3 py-3 font-medium">Guarantee</th>
                  <th scope="col" className="px-3 py-3 font-medium">Guaranteed loan</th>
                  <th scope="col" className="px-3 py-3 font-medium">Borrower</th>
                  <th scope="col" className="px-3 py-3 pr-5 text-right font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {locks.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-3 pl-5 text-foreground">{nameFor(row.guarantorId)}</td>
                    <td className="px-3 py-3">
                      <StatusPill tone={LOAN_POLICY.guarantorLockWhileOutstanding ? "danger" : "neutral"} dot>
                        {LOAN_POLICY.guarantorLockWhileOutstanding ? "Locked" : "Recorded"}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {humanise(row.guarantor.status)} · guarantor {row.guarantor.sequence}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-foreground" title={row.loan.id}>
                      {row.loan.id.slice(0, 8)} <span className="text-muted-foreground">{humanise(row.loan.status)}</span>
                    </td>
                    <td className="px-3 py-3 text-foreground">{nameFor(row.loan.employeeId)}</td>
                    <td className="px-3 py-3 pr-5 text-right font-mono text-[13px] tabular-nums text-foreground">
                      {currencyLabel(row.loan.outstandingMinor, row.loan.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- guarantor exceptions */}
      {guarantorExceptions.length > 0 && (
        <Surface>
          <SectionHeading
            title="Guarantor-count exceptions"
            description={`Policy requires exactly ${LOAN_POLICY.requiredGuarantors} standing guarantors. The database constraint permits a sequence of 1 to 3, so a shortfall can be stored; these loans are shown rather than hidden.`}
          />
          <ul className="space-y-2">
            {guarantorExceptions.map(({ loan, standing }) => (
              <li key={loan.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px]">
                <StatusPill tone="danger" dot>
                  {standing < LOAN_POLICY.requiredGuarantors ? "Below policy" : "Above policy"}
                </StatusPill>
                <span className="font-mono text-[12px] text-foreground" title={loan.id}>
                  {loan.id.slice(0, 8)}
                </span>
                <span className="text-foreground">{nameFor(loan.employeeId)}</span>
                <span className="text-muted-foreground">
                  {standing} standing {standing === 1 ? "guarantee" : "guarantees"} against a required {LOAN_POLICY.requiredGuarantors} · loan is {humanise(loan.status)}
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {/* ---------------------------------------------------------------- loans ledger */}
      <Surface className="p-0">
        <div className="p-5 pb-0">
          <SectionHeading title="Loans ledger" description="Select a loan to record a repayment against it." />
        </div>
        {detailsLoading && details.length === 0 && <StateBlock tone="loading" title="Loading loans…" />}
        {!detailsLoading && details.length === 0 && <StateBlock title="No loans on record" description="A loan appears here once an application is filed." />}
        {details.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 1040 }}>
              <caption className="sr-only">Company loans with their balances, instalments and guarantors</caption>
              <thead>
                <tr className="text-[11px] text-muted-foreground">
                  <th scope="col" className="px-3 py-3 pl-5 font-medium">Loan</th>
                  <th scope="col" className="px-3 py-3 font-medium">Borrower</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Principal</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Outstanding</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Monthly EMI</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Tenure paid</th>
                  <th scope="col" className="px-3 py-3 font-medium">Guarantors</th>
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {details.map((loan) => {
                  const standing = loan.guarantors.filter((guarantor) => isStanding(guarantor.status));
                  return (
                    <tr
                      key={loan.id}
                      onClick={() => {
                        setSelectedId(loan.id);
                        setActionState(null);
                      }}
                      aria-selected={selectedId === loan.id}
                      className={`cursor-pointer border-t border-border transition-colors duration-150 hover:bg-secondary/60 ${selectedId === loan.id ? "bg-secondary" : ""}`}
                    >
                      <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground" title={loan.id}>
                        {loan.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {nameFor(loan.employeeId)}
                        <span className="ml-1.5 text-[11px] text-muted-foreground">{loan.purpose}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">{currencyLabel(loan.principalMinor, loan.currency)}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">{currencyLabel(loan.outstandingMinor, loan.currency)}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
                        {loan.instalmentMinor === null ? <span className="text-muted-foreground">Not sanctioned</span> : currencyLabel(loan.instalmentMinor, loan.currency)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-foreground">
                        {loan.instalmentsPaid === null || loan.instalmentsTotal === null ? (
                          <span className="text-muted-foreground">{loan.tenureMonths > 0 ? `— / ${loan.tenureMonths}` : "—"}</span>
                        ) : (
                          `${loan.instalmentsPaid} / ${loan.instalmentsTotal}`
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {standing.length === 0 ? "None standing" : standing.map((guarantor) => nameFor(guarantor.employeeId)).join(", ")}
                        <span className="ml-1.5 font-mono text-[11px]">
                          {standing.length}/{LOAN_POLICY.requiredGuarantors}
                        </span>
                      </td>
                      <td className="px-3 py-3 pr-5">
                        <StatusPill tone={loanStatusTone(loan.status)} dot>
                          {humanise(loan.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      {/* ---------------------------------------------------------------- actions */}
      {selected && (
        <Surface>
          <SectionHeading
            title={`Record a repayment · ${selected.id.slice(0, 8)}`}
            description={`${nameFor(selected.employeeId)} · outstanding ${currencyLabel(selected.outstandingMinor, selected.currency)} · recovered to date ${currencyLabel(selected.recoveredMinor, selected.currency)}.`}
          />
          {selected.status !== "disbursed" ? (
            <p className="rounded-lg border border-border bg-secondary/40 p-3 text-[13px] text-foreground">
              This loan is {humanise(selected.status)}. Repayments apply only to a disbursed loan, so no repayment control is offered here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[12px] text-muted-foreground">Amount (rupees)</span>
                  <input
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder="0.00"
                    aria-describedby="repayment-help"
                    className="h-10 w-44 rounded-lg border border-border bg-background px-3 font-mono text-sm tabular-nums text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  />
                </label>
                {selected.instalmentMinor !== null && (
                  <Button variant="outline" onClick={() => setAmountInput((selected.instalmentMinor! / 100).toFixed(2))}>
                    One instalment
                  </Button>
                )}
                <Button variant="outline" onClick={() => setAmountInput((selected.outstandingMinor / 100).toFixed(2))}>
                  Full outstanding
                </Button>
                <Button onClick={recordRepayment} disabled={submitting || amountInput.trim() === ""}>
                  {submitting ? "Recording…" : "Record repayment"}
                </Button>
              </div>
              <p id="repayment-help" className="mt-3 text-[12px] leading-[19px] text-muted-foreground">
                A part payment must be at least one instalment, or settle the balance in full; the server refuses anything in between because the amortisation table
                has no row for it. There is no separate settle endpoint: a repayment equal to the outstanding balance closes the loan and moves it to Repaid, which
                is also what releases its guarantors.
              </p>
            </>
          )}
          {actionState && (
            <p
              className={`mt-3 rounded-lg border p-3 text-[13px] ${actionState.tone === "ok" ? "border-success/25 bg-success/10 text-foreground" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
              role={actionState.tone === "ok" ? "status" : "alert"}
            >
              {actionState.message}
            </p>
          )}
          {selected.rulesWaived.length > 0 && (
            <p className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-[13px] text-foreground">
              <span className="font-semibold">Sanctioned with rules waived: </span>
              {selected.rulesWaived.map(humanise).join(", ")}
              {selected.directorOverride ? " (under a Director override)." : "."}
            </p>
          )}
          {selected.ceilingMinor !== null && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Ceiling applied at sanction: {currencyLabel(selected.ceilingMinor, selected.currency)}
              {selected.ceilingMultiple !== null ? ` (${selected.ceilingMultiple}× monthly basic)` : ""}.
            </p>
          )}
          {selected.scheduleNote && <p className="mt-1.5 text-[12px] text-muted-foreground">{selected.scheduleNote}</p>}
        </Surface>
      )}

      {peopleState.error && (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-[13px] text-foreground" role="status">
          Employee names could not be loaded ({peopleState.error}); rows show a short employee reference instead.
        </p>
      )}

      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Users className="size-3.5 shrink-0" aria-hidden />
        Loans, guarantees and schedules are read live from the loans service. Nothing on this tab is modelled or estimated.
      </p>
    </div>
  );
}
