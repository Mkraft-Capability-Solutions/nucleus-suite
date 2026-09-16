"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period || "—";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

function scopeLabel(scope: string): string {
  if (scope === "regular") return "Regular";
  if (scope === "ot") return "Off-cycle overtime";
  if (scope === "full_final") return "Full and final";
  if (scope === "correction") return "Correction";
  return scope || "—";
}

type DisplayStatus = "OPEN" | "ASSIGNED" | "RESOLVED" | "WAIVED" | "ESCALATED";

function displayStatus(status: string): DisplayStatus {
  const key = status.trim().toLowerCase();
  if (key === "acknowledged") return "ASSIGNED";
  if (key === "resolved") return "RESOLVED";
  if (key === "overridden") return "WAIVED";
  if (key === "escalated") return "ESCALATED";
  return "OPEN";
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function personLabel(first: string | null, last: string | null, code: string | null, id: string): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || code || shortId(id);
}

function statusTone(status: DisplayStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "RESOLVED") return "success";
  if (status === "OPEN") return "warning";
  if (status === "ASSIGNED") return "info";
  if (status === "ESCALATED") return "danger";
  return "neutral";
}

function severityTone(severity: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const key = severity.trim().toLowerCase();
  // PL_SEVERITY is the current vocabulary; high/medium/low are rows written before the switch.
  if (key === "critical" || key === "high") return "danger";
  if (key === "warning" || key === "medium") return "warning";
  if (key === "info" || key === "low") return "info";
  return "neutral";
}

function severityText(severity: string): string {
  const key = severity.trim().toLowerCase();
  const entry = picklists.PL_SEVERITY.values.find((option) => option.value === key);
  return entry ? entry.label : severity || "—";
}

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** Money crosses the wire in minor units; the audit queue only ever displays it. */
function formatMinor(minor: number | null): string {
  return minor === null ? "—" : MONEY.format(minor / 100);
}

function auditLabel(action: string): string {
  return action.replace(/^payroll\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))} min ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type FindingRow = {
  id: string;
  payrollRunId: string;
  employeeId: string;
  ruleCode: string;
  severity: string;
  status: string;
  resolution: string | null;
  period: string;
  scope: string;
  runStatus: string;
  firstName: string | null;
  lastName: string | null;
  employeeCode: string | null;
  entityCode: string | null;
  description: string | null;
  impactAmountMinor: number | null;
  suggestedResolution: string | null;
};

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

type FindingDetail = {
  finding: FindingRow;
  displayStatus: DisplayStatus;
  timeline: TimelineStep[];
  runDisplayCode: string;
  runPeriodLabel: string;
  runScopeLabel: string;
  affectedCount: number;
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

type RunOption = { id: string; period: string; scope: string; status: string };
type PersonOption = { id: string; label: string };

const selectClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

const KNOWN_RULES = ["missing-salary", "negative-net", "ot-outlier"];

/** FRM-PAY-04 disposition (PL_FLAG_DISPOSITION) plus Nucleus's own assign step. */
type Disposition = "resolve" | "waive" | "escalate" | "assign";

const DISPOSITION_BUSY: Record<Disposition, string> = {
  assign: "Assigning…",
  resolve: "Resolving…",
  waive: "Waiving…",
  escalate: "Escalating…",
};

const DISPOSITION_DONE: Record<Disposition, string> = {
  assign: "Finding assigned.",
  resolve: "Finding resolved.",
  waive: "Finding waived with a recorded reason.",
  escalate: "Finding escalated; it stays open until the escalation is answered.",
};

/** The workbook's minimum waiver-reason length, enforced again on the server. */
const WAIVER_REASON_MIN_LENGTH = 20;

export function PrePayrollAuditPage() {
  // Deep-link preselect (?record=<findingId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<FindingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  // Transition form: assign (acknowledge) / resolve / waive (override) via the shared resolve endpoint.
  const [actionNote, setActionNote] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");
  // Log-finding modal state.
  const [logOpen, setLogOpen] = useState(false);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [logRunId, setLogRunId] = useState("");
  const [logEmployeeId, setLogEmployeeId] = useState("");
  const [logRule, setLogRule] = useState("");
  const [logSeverity, setLogSeverity] = useState("warning");
  const [logNote, setLogNote] = useState("");
  const [logImpact, setLogImpact] = useState("");
  const [logSuggested, setLogSuggested] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState("");
  const [logOk, setLogOk] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((n) => n + 1);
  }, []);

  function selectFinding(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setActionNote("");
    setActionError("");
    setActionOk("");
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson("/api/v1/payroll-anomalies?page=1&pageSize=100");
        const items = asRecord(raw).data;
        const rows = (Array.isArray(items) ? (items as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id),
          payrollRunId: str(item.payrollRunId),
          employeeId: str(item.employeeId),
          ruleCode: str(item.ruleCode, "—"),
          severity: str(item.severity, "—"),
          status: str(item.status, "—"),
          resolution: typeof item.resolution === "string" ? item.resolution : null,
          period: str(item.period, "—"),
          scope: str(item.scope, "—"),
          runStatus: str(item.runStatus, "—"),
          firstName: typeof item.firstName === "string" ? item.firstName : null,
          lastName: typeof item.lastName === "string" ? item.lastName : null,
          employeeCode: typeof item.employeeCode === "string" ? item.employeeCode : null,
          entityCode: typeof item.entityCode === "string" ? item.entityCode : null,
          description: typeof item.description === "string" ? item.description : null,
          impactAmountMinor: typeof item.impactAmountMinor === "number" ? item.impactAmountMinor : null,
          suggestedResolution: typeof item.suggestedResolution === "string" ? item.suggestedResolution : null,
        }));
        if (live) setFindings(rows);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Audit findings could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  // Runs + people for the log-finding form (loaded once per revision).
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [runsRaw, peopleRaw] = await Promise.all([
          getJson("/api/v1/payroll-runs?page=1&pageSize=100"),
          getJson("/api/v1/people?search=&page=1&pageSize=100"),
        ]);
        if (!live) return;
        const runItems = asRecord(runsRaw).data;
        setRuns(
          (Array.isArray(runItems) ? (runItems as UnknownRecord[]) : []).map((item) => ({
            id: str(item.id),
            period: str(item.period, "—"),
            scope: str(item.scope, "—"),
            status: str(item.status, "—"),
          })),
        );
        const personItems = asRecord(peopleRaw).data;
        setPeople(
          (Array.isArray(personItems) ? (personItems as UnknownRecord[]) : []).map((person) => {
            const first = str(person.firstName);
            const last = str(person.lastName);
            const name = `${first} ${last}`.trim() || str(person.employeeCode, shortId(str(person.id)));
            return { id: str(person.id), label: `${name} · ${str(person.employeeCode, "—")}` };
          }),
        );
      } catch {
        if (live) {
          setRuns([]);
          setPeople([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    return findings.filter((finding) => {
      if (statusFilter !== "all" && displayStatus(finding.status) !== statusFilter) return false;
      if (severityFilter !== "all" && finding.severity.trim().toLowerCase() !== severityFilter) return false;
      return true;
    });
  }, [findings, statusFilter, severityFilter]);

  const activeFinding = useMemo(
    () => findings.find((finding) => finding.id === selectedId) ?? filtered[0] ?? null,
    [findings, selectedId, filtered],
  );
  const activeId = activeFinding?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/payroll-anomalies/${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(raw).data);
        const finding = asRecord(data.finding);
        const timeline = Array.isArray(data.timeline) ? (data.timeline as TimelineStep[]) : [];
        const auditTrail = Array.isArray(data.auditTrail)
          ? (data.auditTrail as Array<{ action: string; reason: string | null; createdAt: string | null }>)
          : [];
        if (live) {
          setDetail({
            finding: {
              id: activeId,
              payrollRunId: str(finding.payrollRunId),
              employeeId: str(finding.employeeId),
              ruleCode: str(finding.ruleCode, "—"),
              severity: str(finding.severity, "—"),
              status: str(finding.status, "—"),
              resolution: typeof finding.resolution === "string" ? finding.resolution : null,
              period: str(finding.period, "—"),
              scope: str(finding.scope, "—"),
              runStatus: str(finding.runStatus, "—"),
              firstName: typeof finding.firstName === "string" ? finding.firstName : null,
              lastName: typeof finding.lastName === "string" ? finding.lastName : null,
              employeeCode: typeof finding.employeeCode === "string" ? finding.employeeCode : null,
              entityCode: typeof finding.entityCode === "string" ? finding.entityCode : null,
              description: typeof finding.description === "string" ? finding.description : null,
              impactAmountMinor: typeof finding.impactAmountMinor === "number" ? finding.impactAmountMinor : null,
              suggestedResolution: typeof finding.suggestedResolution === "string" ? finding.suggestedResolution : null,
            },
            displayStatus: (str(data.displayStatus, "OPEN") as DisplayStatus) || "OPEN",
            timeline,
            runDisplayCode: str(data.runDisplayCode, ""),
            runPeriodLabel: str(data.runPeriodLabel, ""),
            runScopeLabel: str(data.runScopeLabel, ""),
            affectedCount: typeof data.affectedCount === "number" ? data.affectedCount : 1,
            auditTrail,
          });
        }
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "Record detail could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  async function transitionFinding(disposition: Disposition): Promise<void> {
    setActionError("");
    setActionOk("");
    const note = actionNote.trim();
    if (!note) {
      setActionError(disposition === "assign" ? "An assignee note is required (e.g. Assigned to payroll reviewer)." : "A resolution note is required.");
      return;
    }
    // Mirrors the server rule so the reviewer is told before the round trip, not after it.
    if (disposition === "waive" && note.length < WAIVER_REASON_MIN_LENGTH) {
      setActionError(`A waiver reason must be at least ${WAIVER_REASON_MIN_LENGTH} characters; this one is ${note.length}.`);
      return;
    }
    if (!activeId) return;
    setActionBusy(disposition);
    try {
      const response = await fetch(`/api/v1/payroll-anomalies/${encodeURIComponent(activeId)}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ disposition, resolution: note }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err = asRecord(payload).error;
        throw new Error(typeof err === "object" && err !== null ? str(asRecord(err).message, `Request failed (${response.status})`) : `Request failed (${response.status})`);
      }
      setActionOk(DISPOSITION_DONE[disposition]);
      setActionNote("");
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The transition could not be recorded.");
    } finally {
      setActionBusy("");
    }
  }

  async function logNewFinding(): Promise<void> {
    setLogError("");
    setLogOk("");
    if (!logRunId) {
      setLogError("Select the payroll run this finding belongs to.");
      return;
    }
    if (!logEmployeeId) {
      setLogError("Select the affected employee.");
      return;
    }
    if (!logRule.trim()) {
      setLogError("A rule code is required (e.g. missing-salary).");
      return;
    }
    // Rupees on screen, minor units on the wire; a non-numeric entry is rejected, never coerced to zero.
    const impact = logImpact.trim();
    if (impact !== "" && !Number.isFinite(Number(impact))) {
      setLogError("The financial impact must be an amount in rupees.");
      return;
    }
    setLogBusy(true);
    try {
      const response = await fetch("/api/v1/payroll-anomalies", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          payrollRunId: logRunId,
          employeeId: logEmployeeId,
          ruleCode: logRule.trim(),
          severity: logSeverity,
          ...(logNote.trim() ? { note: logNote.trim() } : {}),
          ...(impact !== "" ? { impactAmountMinor: Math.round(Number(impact) * 100) } : {}),
          ...(logSuggested.trim() ? { suggestedResolution: logSuggested.trim() } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err = asRecord(payload).error;
        throw new Error(typeof err === "object" && err !== null ? str(asRecord(err).message, `Request failed (${response.status})`) : `Request failed (${response.status})`);
      }
      const data = asRecord(asRecord(payload).data);
      const id = str(data.id);
      setLogOk("Finding logged and queued below.");
      setLogRule("");
      setLogNote("");
      setLogImpact("");
      setLogSuggested("");
      if (id) selectFinding(id);
      setLogOpen(false);
      refresh();
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "The finding could not be logged.");
    } finally {
      setLogBusy(false);
    }
  }

  const openCount = findings.filter((finding) => finding.status.trim().toLowerCase() === "open").length;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageIntro
        eyebrow="Payroll · SCR-031"
        title="Pre-payroll audit"
        description="Manage pre-payroll audit with a scoped work queue, record history and controlled actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90" onClick={() => { setLogError(""); setLogOk(""); setLogOpen((v) => !v); }}>
              <Plus className="mr-1.5 size-4" /> Log audit finding
            </Button>
          </div>
        }
      />

      {logOpen ? (
        <Surface className="mb-6">
          <SectionHeading title="Log audit finding" description="Raise a manual finding against a mutable run. System findings are raised automatically at calculation." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payroll run</span>
              <select aria-label="Finding run" className={selectClass} value={logRunId} onChange={(e) => setLogRunId(e.target.value)}>
                <option value="">Select…</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatPeriod(run.period)} · {scopeLabel(run.scope)} · {run.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee</span>
              <select aria-label="Finding employee" className={selectClass} value={logEmployeeId} onChange={(e) => setLogEmployeeId(e.target.value)}>
                <option value="">Select…</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Severity</span>
              <select aria-label="Finding severity" className={selectClass} value={logSeverity} onChange={(e) => setLogSeverity(e.target.value)}>
                {picklists.PL_SEVERITY.values.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rule code</span>
              <input aria-label="Finding rule code" list="audit-rule-codes" type="text" placeholder="missing-salary" className={inputClass} value={logRule} onChange={(e) => setLogRule(e.target.value)} />
              <datalist id="audit-rule-codes">
                {KNOWN_RULES.map((rule) => (
                  <option key={rule} value={rule} />
                ))}
              </datalist>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description (optional)</span>
              <input aria-label="Finding description" type="text" maxLength={200} placeholder="Bank account change unverified" className={`${inputClass} w-full`} value={logNote} onChange={(e) => setLogNote(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Financial impact (optional)</span>
              <input aria-label="Finding financial impact" type="number" step="0.01" placeholder="0.00" className={`${inputClass} w-full`} value={logImpact} onChange={(e) => setLogImpact(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drafted resolution (optional)</span>
              <input aria-label="Finding suggested resolution" type="text" maxLength={400} placeholder="Re-verify the account against the cancelled cheque before release" className={`${inputClass} w-full`} value={logSuggested} onChange={(e) => setLogSuggested(e.target.value)} />
            </label>
          </div>
          <Button className="mt-4 h-10 rounded-xl px-4 text-xs font-bold" disabled={logBusy} onClick={() => void logNewFinding()}>
            {logBusy ? "Logging…" : "Log finding"}
          </Button>
          {logError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{logError}</p> : null}
          {logOk ? <p className="mt-3 text-xs leading-relaxed text-success">{logOk}</p> : null}
        </Surface>
      ) : null}

      <Surface className="mb-6">
        <SectionHeading title="Process guide · SCR-051" description="Findings open at calculation or manual logging → assign an owner → resolve with evidence or waive with a recorded reason. No blanket clearing: every finding closes individually and stays audited." />
      </Surface>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Scoped to your permitted entity, location and reporting line.{openCount > 0 ? ` ${openCount} open finding${openCount === 1 ? "" : "s"} need${openCount === 1 ? "s" : ""} an owner.` : ""}
        </p>
        <Link href={activeFinding ? `/payroll?record=${encodeURIComponent(activeFinding.payrollRunId)}` : "/payroll"} className="text-xs font-bold text-primary hover:underline">
          Open payroll
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} record${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select aria-label="Severity filter" className={`${selectClass} sm:w-auto`} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                  <option value="all">All severities</option>
                  {picklists.PL_SEVERITY.values.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select aria-label="Status filter" className={`${selectClass} sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="WAIVED">Waived</option>
                </select>
              </div>
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
              {findings.length === 0 ? "No audit findings in scope. Findings appear here once a run is calculated or manually logged." : "No findings match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Finding</th>
                    <th className="px-3 py-2 font-bold">Severity</th>
                    <th className="px-3 py-2 font-bold">Owner</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((finding) => {
                    const selected = finding.id === activeId;
                    const status = displayStatus(finding.status);
                    return (
                      <tr key={finding.id}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectFinding(finding.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{finding.ruleCode}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {personLabel(finding.firstName, finding.lastName, finding.employeeCode, finding.employeeId)} · {formatPeriod(finding.period)}
                              </span>
                            </span>
                            <span><StatusPill tone={severityTone(finding.severity)}>{severityText(finding.severity)}</StatusPill></span>
                            <span className="truncate text-xs tabular-nums text-muted-foreground">{finding.entityCode ?? "—"}</span>
                            <span><StatusPill tone={statusTone(status)}>{status.replace("_", " ")}</StatusPill></span>
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
            description={
              detail
                ? `Period: ${detail.runPeriodLabel} · Run type: ${detail.runScopeLabel} · Run: ${detail.runDisplayCode}`
                : activeFinding
                  ? "Loading finding…"
                  : "Select a finding to inspect its timeline"
            }
            action={detail ? <StatusPill tone={statusTone(detail.displayStatus)}>{detail.displayStatus.replace("_", " ")}</StatusPill> : undefined}
          />
          {!activeFinding ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No finding selected.</p>
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
              <p className="text-sm font-bold text-foreground">{detail.finding.ruleCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {personLabel(detail.finding.firstName, detail.finding.lastName, detail.finding.employeeCode, detail.finding.employeeId)}
                {detail.finding.entityCode ? ` · Owner ${detail.finding.entityCode}` : ""} · Severity {severityText(detail.finding.severity)}
              </p>
              {detail.finding.description ? (
                <p className="mt-2 text-xs leading-relaxed text-foreground">{detail.finding.description}</p>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Affected employees</dt>
                  <dd className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{detail.affectedCount}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Financial impact</dt>
                  <dd className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{formatMinor(detail.finding.impactAmountMinor)}</dd>
                </div>
              </dl>
              {detail.finding.suggestedResolution ? (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-secondary/20 px-3.5 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drafted resolution</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail.finding.suggestedResolution}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">A draft only. Copy it into the decision note if you agree with it.</p>
                </div>
              ) : null}
              {detail.finding.resolution ? (
                <p className="mt-3 rounded-xl border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground">{detail.finding.resolution}</p>
              ) : null}
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-0">
                {detail.timeline.map((step, index) => (
                  <li key={step.key} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className={`mt-1 grid size-5 place-items-center rounded-full border text-[10px] font-bold ${step.state === "done" ? "border-primary bg-primary text-primary-foreground" : step.state === "current" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                        {step.state === "done" ? "✓" : index + 1}
                      </span>
                      {index < detail.timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </span>
                    <span className={`pb-3 text-xs ${step.state === "todo" ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {index + 1}. {step.label}
                      {step.state === "current" ? <span className="ml-2 font-normal text-muted-foreground">current</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
              {detail.displayStatus === "OPEN" || detail.displayStatus === "ASSIGNED" || detail.displayStatus === "ESCALATED" ? (
                <div className="mt-2 rounded-2xl border border-border/80 bg-secondary/30 p-4">
                  <p className="text-xs font-bold text-foreground">Record decision</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {detail.displayStatus === "OPEN"
                      ? "Assign an owner, resolve with evidence, waive with a recorded reason, or escalate."
                      : "Resolve with evidence, waive with a recorded reason, or escalate."}
                    {` A waiver reason must be at least ${WAIVER_REASON_MIN_LENGTH} characters.`}
                  </p>
                  <input
                    aria-label="Decision note"
                    type="text"
                    maxLength={500}
                    placeholder={detail.displayStatus === "OPEN" ? "Assigned to payroll reviewer — verifying bank change" : "Verified against bank statement"}
                    className={`${inputClass} mt-3 w-full`}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.displayStatus === "OPEN" ? (
                      <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={actionBusy !== ""} onClick={() => void transitionFinding("assign")}>
                        {actionBusy === "assign" ? DISPOSITION_BUSY.assign : "Assign"}
                      </Button>
                    ) : null}
                    <Button size="sm" className="h-8 rounded-lg text-xs" disabled={actionBusy !== ""} onClick={() => void transitionFinding("resolve")}>
                      {actionBusy === "resolve" ? DISPOSITION_BUSY.resolve : picklistLabel("PL_FLAG_DISPOSITION", "resolve")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={actionBusy !== ""} onClick={() => void transitionFinding("waive")}>
                      {actionBusy === "waive" ? DISPOSITION_BUSY.waive : picklistLabel("PL_FLAG_DISPOSITION", "waive")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={actionBusy !== ""} onClick={() => void transitionFinding("escalate")}>
                      {actionBusy === "escalate" ? DISPOSITION_BUSY.escalate : picklistLabel("PL_FLAG_DISPOSITION", "escalate")}
                    </Button>
                  </div>
                  {actionError ? <p className="mt-2 text-[11px] leading-relaxed text-destructive">{actionError}</p> : null}
                  {actionOk ? <p className="mt-2 text-[11px] leading-relaxed text-success">{actionOk}</p> : null}
                </div>
              ) : null}
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">No audited transitions yet for this finding. Decisions above are recorded here.</p>
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
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Configuration: rules and permissions are evaluated by the active module contract.</p>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
