"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** null stays null. An unconfigured amount is never coerced to 0. */
function minor(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Integer minor units rendered exactly, and only ever with the currency the
 * scheme configures. There is no fallback symbol: an amount with no configured
 * scheme behind it is not rendered at all.
 */
function money(amountMinor: number | null, currency: string | null): string | null {
  if (amountMinor === null || !currency) return null;
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100).toLocaleString("en-IN");
  return `${sign}${currency} ${whole}.${String(absolute % 100).padStart(2, "0")}`;
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function timeLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function auditLabel(action: string): string {
  return action.replace(/^engage\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** The referral's position in the hiring funnel, as the register's Status column states it. */
function statusTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "awarded") return "success";
  if (state === "hired") return "info";
  if (state === "interviewing") return "warning";
  if (state === "screening") return "neutral";
  return "neutral";
}

/** Where the two-part award has reached. Forfeited is the only failure tone. */
function maturationTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "fully_matured") return "success";
  if (state === "forfeited") return "danger";
  if (state === "part_paid_on_joining") return "info";
  if (state === "balance_pending_confirmation") return "warning";
  return "neutral";
}

type Milestone = {
  key: string;
  label: string;
  amountMinor: number | null;
  state: string;
  blockedBy: string | null;
};

type Maturation = {
  state: string;
  label: string;
  outstandingMilestone: string | null;
  blockedBy: string | null;
  eligibleMinor: number | null;
  disbursedMinor: number | null;
  currency: string | null;
};

type AwardAction = {
  enabled: boolean;
  reason: string | null;
  request: { milestone: string; tenureDays: number; requiredDays: number } | null;
};

type RegisterRow = {
  referralId: string;
  candidateName: string;
  candidateId: string;
  applicationId: string | null;
  roleTitle: string | null;
  positionCode: string | null;
  requisitionCode: string | null;
  referrerName: string | null;
  referrerCode: string | null;
  referredOn: string | null;
  pipelineStage: string | null;
  pipelineStageLabel: string | null;
  pipelineTerminal: boolean;
  trackingState: string;
  trackingStateLabel: string;
  maturation: Maturation;
  action: AwardAction;
  milestones: Milestone[];
};

type Detail = {
  note: string | null;
  relationship: string | null;
  referralStatus: string;
  candidate: { id: string; name: string; email: string | null; source: string | null };
  application: { id: string; stage: string | null; stageLabel: string | null; terminal: boolean } | null;
  employment: {
    employeeId: string;
    joiningDate: string | null;
    confirmationDate: string | null;
    status: string | null;
    tenureDays: number | null;
  } | null;
  milestones: Milestone[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  row: RegisterRow;
};

function readMilestones(value: unknown): Milestone[] {
  return (Array.isArray(value) ? (value as UnknownRecord[]) : []).map((entry) => ({
    key: str(entry.key),
    label: str(entry.label, "—"),
    amountMinor: minor(entry.amountMinor),
    state: str(entry.state, "pending"),
    blockedBy: typeof entry.blockedBy === "string" ? entry.blockedBy : null,
  }));
}

function readMaturation(value: unknown): Maturation {
  const record = asRecord(value);
  return {
    state: str(record.state, "not_due"),
    label: str(record.label, "Not yet due"),
    outstandingMilestone: typeof record.outstandingMilestone === "string" ? record.outstandingMilestone : null,
    blockedBy: typeof record.blockedBy === "string" ? record.blockedBy : null,
    eligibleMinor: minor(record.eligibleMinor),
    disbursedMinor: minor(record.disbursedMinor),
    currency: typeof record.currency === "string" ? record.currency : null,
  };
}

function readRow(value: unknown): RegisterRow {
  const item = asRecord(value);
  const action = asRecord(item.action);
  const request = asRecord(action.request);
  return {
    referralId: str(item.referralId),
    candidateName: str(item.candidateName, "Unnamed candidate"),
    candidateId: str(item.candidateId),
    applicationId: typeof item.applicationId === "string" ? item.applicationId : null,
    roleTitle: typeof item.roleTitle === "string" ? item.roleTitle : null,
    positionCode: typeof item.positionCode === "string" ? item.positionCode : null,
    requisitionCode: typeof item.requisitionCode === "string" ? item.requisitionCode : null,
    referrerName: typeof item.referrerName === "string" ? item.referrerName : null,
    referrerCode: typeof item.referrerCode === "string" ? item.referrerCode : null,
    referredOn: typeof item.referredOn === "string" ? item.referredOn : null,
    pipelineStage: typeof item.pipelineStage === "string" ? item.pipelineStage : null,
    pipelineStageLabel: typeof item.pipelineStageLabel === "string" ? item.pipelineStageLabel : null,
    pipelineTerminal: bool(item.pipelineTerminal),
    trackingState: str(item.trackingState, "referred"),
    trackingStateLabel: str(item.trackingStateLabel, "Referred"),
    maturation: readMaturation(item.maturation),
    action: {
      enabled: bool(action.enabled),
      reason: typeof action.reason === "string" ? action.reason : null,
      request:
        typeof request.milestone === "string"
          ? {
              milestone: str(request.milestone),
              tenureDays: Number(request.tenureDays ?? 0),
              requiredDays: Number(request.requiredDays ?? 0),
            }
          : null,
    },
    milestones: readMilestones(asRecord(item.award).milestones),
  };
}

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const REFERRAL_RELATIONS = picklists.PL_REFERRAL_RELATION.values;
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";

export function ReferralTrackingPage() {
  // Deep-link preselect (?record=<referralId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [schemeConfigured, setSchemeConfigured] = useState(true);
  const [schemeCode, setSchemeCode] = useState("");
  const [currency, setCurrency] = useState<string | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [stateFilter, setStateFilter] = useState("all");
  const [maturationFilter, setMaturationFilter] = useState("all");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [referOpen, setReferOpen] = useState(false);
  const [requisitionId, setRequisitionId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [relationship, setRelationship] = useState<string>(REFERRAL_RELATIONS[0].value);
  const [note, setNote] = useState("");
  const [referBusy, setReferBusy] = useState(false);
  const [referError, setReferError] = useState("");
  const [referOk, setReferOk] = useState("");
  const [awardBusy, setAwardBusy] = useState(false);
  const [awardError, setAwardError] = useState("");
  const [awardOk, setAwardOk] = useState("");

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
        const raw = await getJson("/api/v1/referral-tracking");
        const data = asRecord(asRecord(raw).data);
        const items = Array.isArray(data.rows) ? data.rows : [];
        if (live) {
          setRows(items.map(readRow));
          setSchemeConfigured(bool(data.schemeConfigured));
          setSchemeCode(str(data.schemeCode));
          setCurrency(typeof data.currency === "string" ? data.currency : null);
          setGaps(strList(data.configurationGaps));
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "The referral register could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (stateFilter !== "all" && row.trackingState !== stateFilter) return false;
      if (maturationFilter !== "all" && row.maturation.state !== maturationFilter) return false;
      return true;
    });
  }, [rows, stateFilter, maturationFilter]);

  const activeRow = useMemo(
    () => rows.find((row) => row.referralId === selectedId) ?? filtered[0] ?? null,
    [rows, selectedId, filtered],
  );
  const activeId = activeRow?.referralId ?? "";

  function selectReferral(id: string): void {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setAwardError("");
    setAwardOk("");
  }

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const raw = await getJson(`/api/v1/referral-tracking?referralId=${encodeURIComponent(activeId)}`);
        const data = asRecord(asRecord(asRecord(raw).data).detail);
        const candidate = asRecord(data.candidate);
        const application = asRecord(data.application);
        const employment = asRecord(data.employment);
        if (live) {
          setDetail({
            note: typeof data.note === "string" ? data.note : null,
            relationship: typeof data.relationship === "string" ? data.relationship : null,
            referralStatus: str(data.referralStatus, "referred"),
            candidate: {
              id: str(candidate.id),
              name: str(candidate.name, "Unnamed candidate"),
              email: typeof candidate.email === "string" ? candidate.email : null,
              source: typeof candidate.source === "string" ? candidate.source : null,
            },
            application:
              typeof application.id === "string"
                ? {
                    id: str(application.id),
                    stage: typeof application.stage === "string" ? application.stage : null,
                    stageLabel: typeof application.stageLabel === "string" ? application.stageLabel : null,
                    terminal: bool(application.terminal),
                  }
                : null,
            employment:
              typeof employment.employeeId === "string"
                ? {
                    employeeId: str(employment.employeeId),
                    joiningDate: typeof employment.joiningDate === "string" ? employment.joiningDate : null,
                    confirmationDate:
                      typeof employment.confirmationDate === "string" ? employment.confirmationDate : null,
                    status: typeof employment.status === "string" ? employment.status : null,
                    tenureDays: minor(employment.tenureDays),
                  }
                : null,
            milestones: readMilestones(data.milestones),
            auditTrail: (Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : []).map((entry) => ({
              action: str(entry.action, "—"),
              reason: typeof entry.reason === "string" ? entry.reason : null,
              createdAt: typeof entry.createdAt === "string" ? entry.createdAt : null,
            })),
            row: readRow(data.row),
          });
        }
      } catch (err) {
        if (live) {
          setDetail(null);
          setDetailError(err instanceof Error ? err.message : "Referral detail could not be loaded.");
        }
      } finally {
        if (live) setDetailLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  async function postJson(path: string, body: UnknownRecord): Promise<UnknownRecord> {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, `Request failed (${response.status})`));
    return asRecord(asRecord(payload).data);
  }

  async function referCandidate(): Promise<void> {
    setReferError("");
    setReferOk("");
    if (!requisitionId.trim()) {
      setReferError("A requisition is required: the award matures against the opening referred to.");
      return;
    }
    if (!candidateId.trim()) {
      setReferError("A candidate is required.");
      return;
    }
    setReferBusy(true);
    try {
      const data = await postJson("/api/v1/referrals", {
        requisitionId: requisitionId.trim(),
        candidateId: candidateId.trim(),
        relationship,
        ...(applicationId.trim() ? { applicationId: applicationId.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setReferOk("Referral recorded against your employee record.");
      setReferOpen(false);
      setRequisitionId("");
      setCandidateId("");
      setApplicationId("");
      setRelationship(REFERRAL_RELATIONS[0].value);
      setNote("");
      const id = str(data.id);
      if (id) selectReferral(id);
      refresh();
    } catch (err) {
      setReferError(err instanceof Error ? err.message : "The referral could not be recorded.");
    } finally {
      setReferBusy(false);
    }
  }

  async function awardReferral(): Promise<void> {
    const request = activeRow?.action.request;
    if (!activeId || !request) return;
    setAwardError("");
    setAwardOk("");
    setAwardBusy(true);
    try {
      await postJson(`/api/v1/referrals/${encodeURIComponent(activeId)}/award`, {
        milestone: request.milestone,
        tenureDays: request.tenureDays,
      });
      setAwardOk(
        request.milestone === "confirmation"
          ? "Balance leg raised as a payroll input for the referrer."
          : "Joining leg raised as a payroll input for the referrer.",
      );
      refresh();
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : "The award could not be raised.");
    } finally {
      setAwardBusy(false);
    }
  }

  const awardDisabledReason = activeRow?.action.reason ?? null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Talent · SCR-091"
        title="Referral tracking"
        description="Every employee referral, the candidate's real pipeline stage and where the two-part award has reached. Recognition is a separate register and is not shown here."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button
              className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setReferError("");
                setReferOk("");
                setReferOpen((v) => !v);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Refer candidate
            </Button>
          </div>
        }
      />

      {referOpen ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Refer a candidate"
            description="The referrer is your own linked employee record; the endpoint refuses a referral from a login with no employee profile."
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Requisition ID</span>
              <ReferencePicker
                endpoint="/api/v1/requisitions"
                ariaLabel="Requisition"
                className={inputClass}
                value={requisitionId}
                onChange={setRequisitionId}
                placeholder="Search an approved requisition…"
              />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Candidate ID</span>
              <ReferencePicker
                endpoint="/api/v1/candidates"
                ariaLabel="Candidate"
                className={inputClass}
                value={candidateId}
                onChange={setCandidateId}
                placeholder="Search the candidate record…"
              />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Relationship</span>
              <select
                aria-label="Relationship to the candidate"
                className={selectClass}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                {REFERRAL_RELATIONS.map((relation) => (
                  <option key={relation.value} value={relation.value}>{relation.label}</option>
                ))}
              </select>
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Application ID (optional)
              </span>
              <ReferencePicker
                endpoint="/api/v1/applications"
                ariaLabel="Application"
                className={inputClass}
                value={applicationId}
                onChange={setApplicationId}
                placeholder="Links the stage column…"
              />
            </label>
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1.5 sm:w-auto">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</span>
              <input aria-label="Referral note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <Button className="h-10 rounded-xl px-4 text-xs font-bold" disabled={referBusy} onClick={() => void referCandidate()}>
              {referBusy ? "Recording…" : "Refer candidate"}
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Without an application the stage column stays empty: the stage is read from the linked application, never copied onto the referral.
          </p>
          {referError ? <p className="mt-3 text-xs leading-relaxed text-destructive">{referError}</p> : null}
          {referOk ? <p className="mt-3 text-xs leading-relaxed text-success">{referOk}</p> : null}
        </Surface>
      ) : null}

      <Surface className="mb-6">
        <SectionHeading
          title="Award scheme"
          description={
            schemeConfigured
              ? `Scheme ${schemeCode || "—"}${currency ? ` · ${currency}` : ""}. The award matures in two parts: a part on joining and the balance on confirmation (RL-471).`
              : "No award scheme is configured for this tenant, so no amount and no confirmation tenure can be stated."
          }
        />
        {gaps.length === 0 ? null : (
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={gap} className="flex gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span className="text-[11px] leading-relaxed text-muted-foreground">{gap}</span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Referral register"
            description={loading ? "Loading…" : `${filtered.length} referral${filtered.length === 1 ? "" : "s"} in the current scope`}
            action={
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Status filter"
                  className={selectClass}
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="referred">Referred</option>
                  <option value="screening">Screening</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="hired">Hired</option>
                  <option value="awarded">Awarded</option>
                </select>
                <select
                  aria-label="Award maturation filter"
                  className={selectClass}
                  value={maturationFilter}
                  onChange={(e) => setMaturationFilter(e.target.value)}
                >
                  <option value="all">All award states</option>
                  <option value="not_due">Not yet due</option>
                  <option value="part_paid_on_joining">Part paid on joining</option>
                  <option value="balance_pending_confirmation">Balance pending confirmation</option>
                  <option value="fully_matured">Fully matured</option>
                  <option value="forfeited">Forfeited</option>
                </select>
              </div>
            }
          />
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {rows.length === 0
                ? "No referrals have been recorded yet. Refer a candidate to open the register."
                : "No referrals match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Candidate</th>
                    <th className="px-3 py-2 font-bold">Referrer</th>
                    <th className="px-3 py-2 font-bold">Stage</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.referralId === activeId;
                    return (
                      <tr key={row.referralId}>
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => selectReferral(row.referralId)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[1.2fr_1fr_1fr_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{row.candidateName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {row.roleTitle ?? "No linked requisition"}
                                {row.positionCode ? ` · ${row.positionCode}` : ""}
                                {row.requisitionCode ? ` · ${row.requisitionCode}` : ""}
                              </span>
                            </span>
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {row.referrerName ? `${row.referrerName}${row.referrerCode ? ` (${row.referrerCode})` : ""}` : "—"}
                            </span>
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {row.pipelineStageLabel ?? "No application linked"}
                              {row.pipelineTerminal ? " · ended" : ""}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <StatusPill tone={statusTone(row.trackingState)}>{row.trackingStateLabel}</StatusPill>
                              <StatusPill tone={maturationTone(row.maturation.state)}>{row.maturation.label}</StatusPill>
                            </span>
                            <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
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
            title="Referral detail"
            description={activeRow ? `${activeRow.candidateName} · referred ${dateLabel(activeRow.referredOn)}` : "Select a referral to inspect it"}
            action={activeRow ? <StatusPill tone={statusTone(activeRow.trackingState)}>{activeRow.trackingStateLabel}</StatusPill> : undefined}
          />
          {!activeRow ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No referral selected.</p>
          ) : detailLoading && !detail ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : detailError && !detail ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{detailError}</p>
              <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : detail ? (
            <div>
              <p className="text-sm font-bold text-foreground">{detail.candidate.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Referred by {activeRow.referrerName ?? "—"}
                {activeRow.referrerCode ? ` (${activeRow.referrerCode})` : ""} on {dateLabel(activeRow.referredOn)} · Referral
                status: {detail.referralStatus}
                {detail.relationship ? ` · ${picklistLabel("PL_REFERRAL_RELATION", detail.relationship)}` : ""}
              </p>
              {detail.note ? <p className="mt-2 text-xs leading-relaxed text-foreground">“{detail.note}”</p> : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate and application</h3>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Candidate email</dt>
                  <dd className="text-right text-foreground">{detail.candidate.email ?? "Not captured"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Application stage</dt>
                  <dd className="text-right text-foreground">
                    {detail.application ? detail.application.stageLabel ?? "Not set" : "No application linked"}
                    {detail.application?.terminal ? " · ended" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Joined as employee</dt>
                  <dd className="text-right text-foreground">
                    {detail.employment ? dateLabel(detail.employment.joiningDate) : "Not joined"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Confirmation recorded</dt>
                  <dd className="text-right text-foreground">
                    {detail.employment?.confirmationDate ? dateLabel(detail.employment.confirmationDate) : "Not recorded"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Completed tenure</dt>
                  <dd className="text-right tabular-nums text-foreground">
                    {detail.employment?.tenureDays === null || detail.employment === null
                      ? "—"
                      : `${detail.employment.tenureDays} days`}
                  </dd>
                </div>
              </dl>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Award position · {detail.row.maturation.label}
              </h3>
              <ol className="mt-2 space-y-2">
                {detail.milestones.map((milestone) => {
                  const amount = money(milestone.amountMinor, detail.row.maturation.currency);
                  return (
                    <li key={milestone.key} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold text-foreground">{milestone.label}</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {amount ?? "Amount not configured"}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {milestone.state === "disbursed"
                          ? "Paid."
                          : milestone.blockedBy ?? "Payable now; raise the payroll input for this leg."}
                      </p>
                    </li>
                  );
                })}
              </ol>
              {money(detail.row.maturation.disbursedMinor, detail.row.maturation.currency) ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Disbursed so far: {money(detail.row.maturation.disbursedMinor, detail.row.maturation.currency)} · Earned:{" "}
                  {money(detail.row.maturation.eligibleMinor, detail.row.maturation.currency)}
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  No amount is shown because no award scheme is configured for this tenant.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  className="h-10 sm:h-9 rounded-lg px-3 text-xs font-bold"
                  disabled={!activeRow.action.enabled || awardBusy}
                  title={awardDisabledReason ?? undefined}
                  onClick={() => void awardReferral()}
                >
                  {awardBusy ? "Raising…" : "Award referral"}
                </Button>
                {activeRow.applicationId ? (
                  <Link
                    href={`/talent-acquisition?record=${encodeURIComponent(activeRow.applicationId)}`}
                    className="inline-flex h-10 sm:h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary"
                  >
                    Open application <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                ) : null}
              </div>
              {awardDisabledReason ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{awardDisabledReason}</p>
              ) : null}
              {awardError ? <p className="mt-2 text-xs leading-relaxed text-destructive">{awardError}</p> : null}
              {awardOk ? <p className="mt-2 text-xs leading-relaxed text-success">{awardOk}</p> : null}

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit trail</h3>
              {detail.auditTrail.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  No audited events for this referral yet. Creating a referral records no audit event today; the award endpoint does.
                </p>
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
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  );
}
