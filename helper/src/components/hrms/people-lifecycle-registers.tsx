"use client";

import Link from "next/link";
import { ArrowLeft, Inbox, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import { picklistLabel, picklists } from "@/lib/picklists";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import {
  ActionButton,
  ActionField,
  ActionPanel,
  AuditTrail,
  Cell,
  ConfigFooter,
  DetailPlaceholder,
  ProcessGuide,
  QueueRow,
  RegisterIntro,
  RegisterLayout,
  RegisterNotice,
  RegisterQueue,
  RegisterStates,
  ScopeBar,
  StateTimeline,
  actionInputClass,
  listOf,
  postRegisterAction,
  recordFromEnvelope,
  shortTimestamp,
  stateLabel,
  useRegisterResource,
  useSelection,
  type Notice,
} from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

function useLive(path: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "This data could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  return {
    data,
    loading,
    error,
    refresh: () => {
      invalidateGetRequest(path);
      setLoading(true);
      setTick((current) => current + 1);
    },
  };
}

function StateBlock({ loading, error, empty, onRetry, loadingLabel, errorTitle, emptyTitle, emptyHint }: {
  loading: boolean;
  error: string;
  empty: boolean;
  onRetry: () => void;
  loadingLabel: string;
  errorTitle: string;
  emptyTitle: string;
  emptyHint: string;
}) {
  if (loading) {
    return (
      <Surface className="p-5">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {loadingLabel}
        </p>
      </Surface>
    );
  }
  if (error) {
    return (
      <Surface className="p-5">
        <p role="alert" className="text-sm font-semibold text-foreground">{errorTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
          Try again
        </button>
      </Surface>
    );
  }
  if (empty) {
    return (
      <Surface className="p-5 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{emptyHint}</p>
      </Surface>
    );
  }
  return null;
}

function personName(row: UnknownRecord): string {
  const first = str(row.firstName ?? row.first_name);
  const last = str(row.lastName ?? row.last_name);
  return `${first} ${last}`.trim() || str(row.employeeCode ?? row.employee_code, "Unnamed");
}

/* ---------------- Employee record (SCR-010) ---------------- */

function lifecycleTone(state: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (state === "active") return "success";
  if (state === "on_leave") return "warning";
  if (state === "separated") return "danger";
  if (state === "archived") return "neutral";
  return "neutral";
}

function lifecycleLabel(state: string): string {
  if (state === "on_leave") return "On leave";
  if (!state) return "Unknown";
  return state[0]?.toUpperCase() + state.slice(1);
}

export function EmployeeRecordPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  // Phones show the queue or the open record, never both squeezed side by side.
  // From `md` both columns render and this flag is ignored.
  const [mobileDetail, setMobileDetail] = useState(false);
  const peopleState = useLive(`/api/v1/people?search=${encodeURIComponent(submittedQuery)}&page=1&pageSize=100`);
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);
  const total = useMemo(() => {
    const meta = asRecord(asRecord(peopleState.data).meta);
    const value = Number(meta.total);
    return Number.isFinite(value) ? value : people.length;
  }, [peopleState.data, people.length]);
  const selected = (selectedId ? people.find((row) => str(row.id) === selectedId) : undefined) ?? people[0] ?? null;
  const timelineState = useLive(selected ? `/api/v1/people/${encodeURIComponent(str(selected.id))}/timeline` : "");
  const timeline = useMemo(() => {
    const data = asRecord(asRecord(timelineState.data).data);
    if (!data.employee) return null;
    const employee = asRecord(data.employee);
    const auditTrail = Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : [];
    return { employee, state: str(data.state, "active"), onLeave: (data.onLeave ?? null) as boolean | null, auditTrail };
  }, [timelineState.data]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro
        eyebrow="People Core · SCR-010"
        title="Employee record"
        description="Manage employee record with a scoped work queue, record history and controlled actions."
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { peopleState.refresh(); if (selected) timelineState.refresh(); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">Refresh</button>
            <Link href="/people" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">Create employee</Link>
          </span>
        }
      />
      <Surface className="mb-4">
        <SectionHeading title="Process guide · SCR-010" description="Search the governed directory → select a record → inspect its lifecycle timeline and audit trail. Creation and edits stay in People Core with approvals and audit." />
      </Surface>
      <Surface className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
          <Link href="/people" className="text-xs font-semibold text-primary hover:underline">Open people core</Link>
        </div>
      </Surface>

      <StateBlock
        loading={peopleState.loading}
        error={peopleState.error}
        empty={!peopleState.loading && !peopleState.error && people.length === 0}
        onRetry={peopleState.refresh}
        loadingLabel="Loading employee records…"
        errorTitle="Employee records unavailable"
        emptyTitle="No employees yet"
        emptyHint="Create the first record from People Core. This queue reads the same governed endpoint."
      />
      {!peopleState.loading && !peopleState.error && people.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Surface className={`p-0 ${mobileDetail ? "hidden md:block" : ""}`}>
            <div className="border-b border-border p-4">
              <form
                className="relative w-full max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSelectedId("");
                  setSubmittedQuery(query.trim());
                }}
              >
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, code, department…"
                  aria-label="Search employee records"
                  className="h-10 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </form>
            </div>
            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{total} record(s) in the current scope</p>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Assignment</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {people.map((row) => {
                    const id = str(row.id);
                    const current = selected && str(selected.id) === id;
                    return (
                      <tr key={id} onClick={() => { setSelectedId(id); setMobileDetail(true); }} className={`cursor-pointer hover:bg-secondary/40 ${current ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-foreground">{str(row.employeeCode)} · {personName(row)}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.department) || "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{str(row.designation) || "Unassigned"} · {str(row.location) || "—"}</td>
                        <td className="px-3 py-3"><StatusPill tone={lifecycleTone(str(row.status))} dot>{lifecycleLabel(str(row.status))}</StatusPill></td>
                        <td className="px-4 py-3 text-right text-muted-foreground">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface className={mobileDetail ? "" : "hidden md:block"}>
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:border-primary/50 md:hidden"
            >
              <ArrowLeft className="size-4" /> Back to the queue
            </button>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a record to view its controlled workflow, evidence and audit trail.</p>
            ) : !timeline ? (
              <div>
                <p className="text-sm text-muted-foreground">{timelineState.loading ? "Loading record detail…" : timelineState.error ? timelineState.error : "Select a record to view its controlled workflow, evidence and audit trail."}</p>
                {!timelineState.loading && timelineState.error && (
                  <button type="button" onClick={timelineState.refresh} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
                    Try again
                  </button>
                )}
              </div>
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={`${str(timeline.employee.employeeCode)}`}
                  action={<StatusPill tone={lifecycleTone(timeline.state)} dot>{lifecycleLabel(timeline.state)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Employee {str(timeline.employee.employeeCode)} · {str(timeline.employee.firstName)} {str(timeline.employee.lastName)} · Department: {str(timeline.employee.department) || "—"} · Assignment: {str(timeline.employee.designation) || "Unassigned"} · {str(timeline.employee.location) || "—"} · Position: {str(timeline.employee.designation) || "—"}
                </p>
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">State timeline</p>
                  <ol className="mt-2 space-y-1.5">
                    {(["active", "on_leave", "separated", "archived"] as const).map((state, index) => (
                      <li key={state} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${timeline.state === state ? "border-primary/30 bg-primary/5 font-semibold text-foreground" : "border-border/60 text-muted-foreground"}`}>
                        <span className="grid size-5 place-items-center rounded-md bg-secondary font-mono text-[10px]">{index + 1}</span>
                        {lifecycleLabel(state)}
                        {state === "on_leave" && timeline.onLeave === null && <span className="text-[11px]">(leave visibility restricted)</span>}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Audit trail</p>
                  {timeline.auditTrail.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No audited events for this record yet.</p> : (
                    <ol className="mt-2 space-y-1.5">
                      {timeline.auditTrail.slice(0, 8).map((event) => (
                        <li key={str(event.id)} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <p className="font-semibold">{str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}</p>
                          <p className="mt-0.5 text-muted-foreground">{str(event.reason)} · {str(event.created_at).slice(0, 16).replace("T", " ")}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/document-vault" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 sm:min-h-0">Document vault</Link>
                  <Link href="/assignment-policy-attributes" className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 sm:min-h-0">Assignments</Link>
                </div>
                <p className="mt-4 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">Configuration · Rules and permissions are evaluated by the active module contract.</p>
              </div>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}

/* ---------------- Document vault (SCR-014) ---------------- */

type DocumentVaultRow = {
  id: string;
  title: string;
  code: string;
  document_type: string;
  classification: string | null;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  expires_on: string | null;
  replaces_document_id: string | null;
  verification: string;
  rejection_reason: string | null;
  status: "pending_verification" | "verified" | "rejected" | "expired" | "replaced";
};

const DOCUMENT_STATES = [
  { value: "pending_verification", label: "Pending verification" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "replaced", label: "Replaced" },
] as const;

/** A rejection the employee must act on reads the same as an expiry: blocking. */
function documentTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "verified") return "success";
  if (status === "pending_verification") return "warning";
  if (status === "expired" || status === "rejected") return "danger";
  return "neutral";
}

export function DocumentVaultPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState("verified");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/documents/vault?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as DocumentVaultRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/documents/vault/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as DocumentVaultRow,
      versions: listOf(data.versions),
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function verify() {
    if (!selected) return;
    // A rejection is returned to the employee, so it carries the longer minimum.
    const minimum = decision === "rejected" ? 10 : 3;
    if (reason.trim().length < minimum) {
      setNotice({ text: `A reason (min ${minimum} characters) is required.`, tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/documents/${encodeURIComponent(selected.id)}/verify`, {
      decision,
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Verification recorded. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="People Core · SCR-014"
        title="Document vault"
        description="Manage document vault with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/people" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Upload document
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-014"
        description="Pick a document from the queue → inspect its versions, expiry and audit trail → record a verification decision. Uploads stay in People Core with approvals."
      />
      <ScopeBar href="/people" label="Open people core" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading document vault…"
        errorTitle="Document vault unavailable"
        emptyTitle="No documents yet"
        emptyHint="Upload the first document from People Core with a document type and employee reference. New uploads appear here pending verification."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search documents"
              searchPlaceholder="Search document, type, employee…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Document", "Employee", "Expiry", "Verification"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.title}</Cell>
                  <Cell>{row.employee_code ? `${row.employee_code} · ${row.employee_name ?? ""}`.trim() : "Template library"}</Cell>
                  <Cell>{row.expires_on ?? "—"}</Cell>
                  <Cell><StatusPill tone={documentTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.code}
                  action={<StatusPill tone={documentTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Document: {detail.record.title} · Type: {detail.record.document_type} · Class: {detail.record.classification ? picklistLabel("PL_DOCUMENT_CLASS", detail.record.classification) : "Not recorded"} · Employee: {detail.record.employee_code ? `${detail.record.employee_code} · ${detail.record.employee_name ?? ""}`.trim() : "Template library"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Issued on: {detail.record.issued_on ?? "—"} · Expires on: {detail.record.expires_on ?? "—"} · Replaces: {detail.record.replaces_document_id ?? "—"}
                </p>
                {detail.record.status === "rejected" && detail.record.rejection_reason && (
                  <p role="alert" className="mt-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs leading-5 text-foreground">
                    Returned to the employee: {detail.record.rejection_reason}
                  </p>
                )}
                <StateTimeline states={DOCUMENT_STATES} current={detail.record.status} />
                {detail.versions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Versions ({detail.versions.length})</p>
                    <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {detail.versions.slice(0, 10).map((version, index) => (
                        <li key={str(version.id, String(index))} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">Version {detail.versions.length - index}</span>
                          <span className="mt-0.5 block text-muted-foreground">{shortTimestamp(version.created_at)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <AuditTrail events={detail.auditTrail} />
                <ActionPanel title="Verify document">
                  <ActionField label="Decision">
                    <select value={decision} onChange={(event) => setDecision(event.target.value)} className={actionInputClass}>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="replaced">Replaced</option>
                      <option value="pending">Return to pending</option>
                    </select>
                  </ActionField>
                  <ActionField label={decision === "rejected" ? "Rejection reason (returned to the employee, min 10 characters)" : "Reason (audited)"}>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={decision === "rejected" ? "Why is this document being sent back?" : "What evidence supports this decision?"}
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionButton onClick={() => void verify()} busy={busy}>Verify document</ActionButton>
                </ActionPanel>
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Joining chain console (SCR-060) ---------------- */

type JoiningChainRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  location: string;
  template_name: string;
  joining_date: string | null;
  joining_deviation_reason: string | null;
  candidate_id: string | null;
  offer_id: string | null;
  owner: string;
  total: number;
  done: number;
  required_pending: number;
  readiness: string;
  status: "not_started" | "in_progress" | "blocked" | "ready";
};

type JoiningChainTask = {
  id: string;
  title: string;
  owner: string;
  required: boolean;
  done: boolean;
  item_status: string;
  due_date: string | null;
  waiver_reason: string | null;
  completed_at: string | null;
};

const JOINING_STATES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "ready", label: "Ready" },
] as const;

function joiningTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "ready") return "success";
  if (status === "in_progress") return "info";
  if (status === "blocked") return "danger";
  return "neutral";
}

export function JoiningChainConsolePage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busyTaskId, setBusyTaskId] = useState("");
  const [waiveTaskId, setWaiveTaskId] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [confirmationDate, setConfirmationDate] = useState(today);
  const [confirmationReason, setConfirmationReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/onboarding/joining-chain?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as JoiningChainRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/onboarding/joining-chain/${encodeURIComponent(selected.id)}` : "");
  // R-24: which items hold up confirmation is the server's call, so the panel reads the
  // readiness endpoint rather than re-deciding it from the checklist here.
  const readinessState = useRegisterResource(selected ? `/api/v1/onboarding/instances/${encodeURIComponent(selected.id)}/readiness` : "");
  const readiness = useMemo(() => recordFromEnvelope(readinessState.data), [readinessState.data]);
  const pendingConfirmation = useMemo(
    () => listOf(readiness.pendingConfirmation).map((row) => str(asRecord(row).title)).filter(Boolean),
    [readiness],
  );
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as JoiningChainRow,
      tasks: listOf(data.tasks) as unknown as JoiningChainTask[],
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  /**
   * One route records every outcome a chain item can have. Waiving releases a blocking
   * step without it being done, so the workbook holds its reason to twenty characters.
   */
  async function recordTask(taskId: string, status: "done" | "waived") {
    if (status === "waived" && waiveReason.trim().length < 20) {
      setNotice({ text: "A waiver reason (min 20 characters) is required.", tone: "error" });
      return;
    }
    setBusyTaskId(taskId);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/onboarding/tasks/${encodeURIComponent(taskId)}/complete`, {
      status,
      ...(status === "waived" ? { note: waiveReason.trim() } : {}),
    });
    setNotice(outcome.ok
      ? { text: status === "waived" ? "Step waived. Readiness recalculated from the governed checklist." : "Step completed. Readiness recalculated from the governed checklist.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setWaiveTaskId("");
      setWaiveReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusyTaskId("");
    readinessState.refresh();
  }

  /**
   * Confirmation is a transition, not a date somebody types: the server refuses it while an
   * item the template marks as blocking confirmation is still outstanding, and this panel
   * shows that refusal rather than restating the rule.
   */
  async function confirmEmployment() {
    if (!detail) return;
    if (confirmationReason.trim().length < 10) {
      setNotice({ text: "A confirmation reason (min 10 characters) is required.", tone: "error" });
      return;
    }
    setConfirming(true);
    setNotice(null);
    const outcome = await postRegisterAction("/api/v1/onboarding/confirmations", {
      employeeId: detail.record.employee_id,
      confirmationDate,
      reason: confirmationReason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Employment confirmed. The transition is recorded on the employment record.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setConfirmationReason("");
      detailState.refresh();
      readinessState.refresh();
    }
    setConfirming(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="Onboarding · SCR-060"
        title="Joining chain console"
        description="Manage joining chain console with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/onboarding" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Create joining chain
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-060"
        description="Pick a joiner from the queue → work the required Day-1 steps with their owners → readiness turns ready only when every required step is complete."
      />
      <ScopeBar href="/onboarding" label="Open onboarding" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading joining chains…"
        errorTitle="Joining chains unavailable"
        emptyTitle="No joining cases yet"
        emptyHint="Start onboarding from Onboarding & Lifecycle. New joiners appear here with their Day-1 checklist and owners."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search joining chains"
              searchPlaceholder="Search joiner, code, template…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Joiner", "Readiness", "Owner", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.employee_code} · {row.employee_name}</Cell>
                  <Cell>{row.readiness}</Cell>
                  <Cell>{row.owner}</Cell>
                  <Cell><StatusPill tone={joiningTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.employee_code}
                  action={<StatusPill tone={joiningTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Joiner: {detail.record.employee_code} · {detail.record.employee_name} · Department: {detail.record.department} · Location: {detail.record.location} · Template: {detail.record.template_name}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Actual joining date: {detail.record.joining_date ?? "—"} · Progress: {detail.record.done}/{detail.record.total} · Required steps outstanding: {detail.record.required_pending}
                  {detail.record.candidate_id ? ` · Candidate ${detail.record.candidate_id}` : ""}
                  {detail.record.offer_id ? ` · Offer ${detail.record.offer_id}` : ""}
                </p>
                {detail.record.joining_deviation_reason && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Joining date deviation: {detail.record.joining_deviation_reason}</p>
                )}
                <StateTimeline states={JOINING_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Day-1 checklist ({detail.tasks.length})</p>
                  {detail.tasks.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">This joining chain has no checklist steps yet.</p>
                  ) : (
                    <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto">
                      {detail.tasks.map((task) => (
                        <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2">
                          <span>
                            <span className={`block text-xs font-semibold ${task.done ? "text-muted-foreground" : "text-foreground"}`}>{task.title}</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              Owned by {task.owner}{task.required ? " · Blocking" : ""}{task.due_date ? ` · Due ${task.due_date}` : ""}{task.completed_at ? ` · ${task.completed_at.slice(0, 10)}` : ""}
                            </span>
                            {task.waiver_reason && <span className="mt-0.5 block text-[11px] text-muted-foreground">Waived: {task.waiver_reason}</span>}
                          </span>
                          {task.done ? (
                            <StatusPill tone={task.item_status === "waived" ? "info" : "success"}>{picklistLabel("PL_TASK_STATUS", task.item_status)}</StatusPill>
                          ) : (
                            <span className="flex flex-wrap items-center gap-2">
                              {task.item_status === "overdue" && <StatusPill tone="danger">{picklistLabel("PL_TASK_STATUS", "overdue")}</StatusPill>}
                              <button
                                type="button"
                                disabled={busyTaskId === task.id}
                                onClick={() => void recordTask(task.id, "done")}
                                className="min-h-10 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 sm:min-h-0"
                              >
                                {busyTaskId === task.id ? "Saving…" : "Mark complete"}
                              </button>
                              <button
                                type="button"
                                disabled={busyTaskId === task.id}
                                onClick={() => setWaiveTaskId(waiveTaskId === task.id ? "" : task.id)}
                                className="min-h-10 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary/50 disabled:opacity-60 sm:min-h-0"
                              >
                                Waive
                              </button>
                            </span>
                          )}
                          {waiveTaskId === task.id && !task.done && (
                            <span className="flex w-full flex-wrap items-center gap-2">
                              <input
                                value={waiveReason}
                                onChange={(event) => setWaiveReason(event.target.value)}
                                placeholder="Why is this step waived? (min 20 characters)"
                                className={actionInputClass}
                              />
                              <button
                                type="button"
                                disabled={busyTaskId === task.id}
                                onClick={() => void recordTask(task.id, "waived")}
                                className="min-h-10 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-primary/50 disabled:opacity-60 sm:min-h-0"
                              >
                                Confirm waiver
                              </button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-bold text-foreground">Confirm employment</p>
                  {pendingConfirmation.length > 0 ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Blocked until these are complete or waived: {pendingConfirmation.join(", ")}.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Every item that gates confirmation is settled. Confirming moves the employment out of probation.
                    </p>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <ActionField label="Confirmation date">
                      <input type="date" value={confirmationDate} onChange={(event) => setConfirmationDate(event.target.value)} className={actionInputClass} />
                    </ActionField>
                    <ActionField label="Reason (audited)">
                      <input value={confirmationReason} onChange={(event) => setConfirmationReason(event.target.value)} placeholder="Why is this employment being confirmed?" className={actionInputClass} />
                    </ActionField>
                  </div>
                  {/* The button stays live even when items are outstanding: the refusal comes
                      from the server with the reason, which is what an HR user needs to see. */}
                  <ActionButton onClick={() => void confirmEmployment()} busy={confirming}>Confirm employment</ActionButton>
                </div>
                <AuditTrail events={detail.auditTrail} />
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Clearance board (SCR-061) ---------------- */

type ClearanceRow = {
  id: string;
  case_id: string;
  leaver_code: string | null;
  leaver_name: string | null;
  owner_code: string | null;
  owner_name: string | null;
  item_name: string;
  blocking: boolean;
  cleared_on: string | null;
  recovery_amount_minor: number | string | null;
  recovery_description: string | null;
  waive_reason: string | null;
  status: "open" | "cleared" | "waived" | "held";
  last_working_day: string | null;
  resigned_on: string | null;
  ff_state: string | null;
};

const CLEARANCE_STATES = [
  { value: "open", label: "Open" },
  { value: "cleared", label: "Cleared" },
  { value: "waived", label: "Waived" },
  { value: "held", label: "Held" },
] as const;

function clearanceTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "cleared") return "success";
  if (status === "waived") return "info";
  if (status === "held") return "danger";
  return "warning";
}

export function ClearanceBoardPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/offboarding/clearance-board?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as ClearanceRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/offboarding/clearance-board/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    const readiness = asRecord(data.readiness);
    return {
      record: data as unknown as ClearanceRow,
      caseItems: listOf(data.caseItems) as unknown as ClearanceRow[],
      blockingOpen: Number(readiness.blockingOpen) || 0,
      settleable: readiness.settleable === true,
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function settle(action: "clear" | "waive") {
    if (!selected) return;
    // A waiver lets full and final proceed without the clearance, so it carries the
    // longer minimum; a recovery has to say what is being recovered.
    if (action === "waive" && reason.trim().length < 20) {
      setNotice({ text: "A waiver reason (min 20 characters) is required.", tone: "error" });
      return;
    }
    const amount = recoveryAmount.trim();
    if (action === "clear" && amount) {
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        setNotice({ text: "Enter the recovery as an amount, for example 1500.00.", tone: "error" });
        return;
      }
      if (Number(amount) > 0 && reason.trim().length < 10) {
        setNotice({ text: "A recovery needs a description of at least 10 characters.", tone: "error" });
        return;
      }
    }
    setBusy(true);
    setNotice(null);
    const body = action === "waive"
      ? { reason: reason.trim() }
      : {
          note: reason.trim() || undefined,
          recoveryAmountMinor: amount ? Math.round(Number(amount) * 100) : 0,
          ...(amount && Number(amount) > 0 ? { recoveryDescription: reason.trim() } : {}),
        };
    const outcome = await postRegisterAction(`/api/v1/offboarding/items/${encodeURIComponent(selected.id)}/${action}`, body);
    setNotice(outcome.ok
      ? { text: action === "clear" ? "Clearance recorded. Settlement readiness recalculated." : "Item waived. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      setRecoveryAmount("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="Onboarding · SCR-061"
        title="Clearance board"
        description="Manage clearance board with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/onboarding" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Clear item
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-061"
        description="Pick a no-dues item from the queue → clear or waive it against a reason → full and final settlement stays blocked while any blocking item is open."
      />
      <ScopeBar href="/onboarding" label="Open onboarding" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading clearance board…"
        errorTitle="Clearance board unavailable"
        emptyTitle="No clearance items yet"
        emptyHint="Start an exit case from Onboarding & Lifecycle. Each no-dues item appears here with its department owner."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search clearance items"
              searchPlaceholder="Search leaver, item, owner…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Leaver", "Owner", "Blocking", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.leaver_code ?? "—"} · {row.leaver_name ?? "Unnamed"}</Cell>
                  <Cell>{row.owner_code ?? "—"}</Cell>
                  <Cell>{row.item_name}</Cell>
                  <Cell><StatusPill tone={clearanceTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.leaver_code ?? detail.record.id}
                  action={<StatusPill tone={clearanceTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Leaver: {detail.record.leaver_code ?? "—"} · {detail.record.leaver_name ?? "Unnamed"} · Blocking: {detail.record.item_name} · Owner: {detail.record.owner_code ?? "—"}{detail.record.owner_name ? ` · ${detail.record.owner_name}` : ""}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Resigned on: {detail.record.resigned_on ?? "—"} · Last working day: {detail.record.last_working_day ?? "—"} · Net settlement: {detail.record.ff_state ?? "Not recorded"} · Cleared on: {detail.record.cleared_on ?? "—"}
                </p>
                {Number(detail.record.recovery_amount_minor ?? 0) > 0 && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Recovery raised on full and final: {(Number(detail.record.recovery_amount_minor) / 100).toFixed(2)}{detail.record.recovery_description ? ` · ${detail.record.recovery_description}` : ""}
                  </p>
                )}
                {detail.record.waive_reason && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Waived: {detail.record.waive_reason}</p>
                )}
                <StateTimeline states={CLEARANCE_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Settlement readiness</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detail.settleable
                      ? "Every blocking item on this exit case is settled. Full and final can proceed."
                      : `${detail.blockingOpen} blocking item(s) still open on this exit case. Settlement stays held.`}
                  </p>
                  {detail.caseItems.length > 0 && (
                    <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                      {detail.caseItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span>
                            <span className="font-semibold">{item.item_name}</span>
                            <span className="mt-0.5 block text-muted-foreground">{item.blocking ? "Blocking" : "Non-blocking"} · Owner {item.owner_code ?? "—"}</span>
                          </span>
                          <StatusPill tone={clearanceTone(item.status)}>{stateLabel(item.status)}</StatusPill>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                {(detail.record.status === "open" || detail.record.status === "held") && (
                  <ActionPanel title="Settle clearance item">
                    <ActionField label="Recovery amount (optional; raises a payroll input on full and final)">
                      <input
                        value={recoveryAmount}
                        onChange={(event) => setRecoveryAmount(event.target.value)}
                        placeholder="0.00"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionField label="Reason (audited; min 20 characters to waive, min 10 to describe a recovery)">
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Why is this item cleared or waived?"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <span className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => void settle("clear")} busy={busy}>Clear item</ActionButton>
                      <ActionButton onClick={() => void settle("waive")} busy={busy}>Waive item</ActionButton>
                    </span>
                  </ActionPanel>
                )}
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Asset register (SCR-064) ---------------- */

type AssetRow = {
  id: string;
  asset_code: string;
  asset_type: string;
  description: string;
  serial: string;
  holder_code: string | null;
  holder_name: string | null;
  condition: string | null;
  issued_on: string | null;
  returned_on: string | null;
  condition_at_issue: string | null;
  expected_return: string | null;
  acknowledged_by_employee: boolean;
  condition_at_return: string | null;
  recovery_amount_minor: number | string | null;
  return_remarks: string | null;
  clearance_item: boolean;
  status: "available" | "allocated" | "returned" | "written_off";
};

type AssetCustodyRow = {
  id: string;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  returned_on: string | null;
  status: string | null;
};

const ASSET_STATES = [
  { value: "available", label: "Available" },
  { value: "allocated", label: "Allocated" },
  { value: "returned", label: "Returned" },
  { value: "written_off", label: "Written off" },
] as const;

function assetTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "available") return "success";
  if (status === "allocated") return "info";
  if (status === "written_off") return "danger";
  return "neutral";
}

const today = () => new Date().toISOString().slice(0, 10);

export function AssetRegisterPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [conditionAtIssue, setConditionAtIssue] = useState("new");
  const [acknowledged, setAcknowledged] = useState(false);
  const [expectedReturn, setExpectedReturn] = useState("");
  // R-24: what full and final would recover if this asset never came back.
  const [issueRecoveryAmount, setIssueRecoveryAmount] = useState("");
  const [condition, setCondition] = useState("good");
  const [returnedOn, setReturnedOn] = useState(today);
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/assets/register?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as AssetRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/assets/register/${encodeURIComponent(selected.id)}` : "");
  const peopleState = useRegisterResource("/api/v1/people?search=&page=1&pageSize=100");
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as AssetRow,
      custody: listOf(data.custody) as unknown as AssetCustodyRow[],
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function allocate() {
    if (!selected) return;
    if (!employeeId) {
      setNotice({ text: "Select the employee receiving this asset.", tone: "error" });
      return;
    }
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason (min 3 characters) is required.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/assets/register/${encodeURIComponent(selected.id)}/allocate`, {
      employeeId,
      issuedOn,
      conditionAtIssue,
      acknowledgedByEmployee: acknowledged,
      ...(expectedReturn ? { expectedReturn } : {}),
      ...(issueRecoveryAmount.trim() ? { recoveryAmountMinor: Math.round(Number(issueRecoveryAmount) * 100) } : {}),
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Asset allocated. Custody is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setEmployeeId("");
      setAcknowledged(false);
      setExpectedReturn("");
      setIssueRecoveryAmount("");
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  async function recordReturn() {
    if (!selected) return;
    // A damaged or lost asset raises a recovery on full and final, so both the amount and
    // longer remarks are mandatory in exactly that case.
    const recoverable = condition === "damaged" || condition === "lost";
    const minimum = recoverable ? 10 : 3;
    if (!condition || reason.trim().length < minimum) {
      setNotice({ text: `Record the condition and remarks (min ${minimum} characters) before returning this asset.`, tone: "error" });
      return;
    }
    const amount = recoveryAmount.trim();
    if (recoverable && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setNotice({ text: "Enter the recovery amount for a damaged or lost asset; enter 0 if nothing is recovered.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/assets/register/${encodeURIComponent(selected.id)}/return`, {
      condition,
      returnedOn,
      ...(amount ? { recoveryAmountMinor: Math.round(Number(amount) * 100) } : {}),
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Return recorded. The asset is back in the pool.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setCondition("good");
      setRecoveryAmount("");
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="Onboarding · SCR-064"
        title="Asset register"
        description="Manage asset register with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/assets" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Allocate asset
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-064"
        description="Pick an asset from the queue → inspect its custody history → allocate it to an employee or record its return with a condition. Outstanding assets block exit settlement."
      />
      <ScopeBar href="/onboarding" label="Open onboarding" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading asset register…"
        errorTitle="Asset register unavailable"
        emptyTitle="No assets yet"
        emptyHint="Register the first asset in the asset catalogue. Allocated assets reappear as blocking clearance items at exit."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search assets"
              searchPlaceholder="Search asset, type, serial, holder…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Asset", "Holder", "Condition", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.asset_code}</Cell>
                  <Cell>{row.holder_code ? `${row.holder_code} · ${row.holder_name ?? ""}`.trim() : "Unallocated"}</Cell>
                  <Cell>{row.condition ?? "—"}</Cell>
                  <Cell><StatusPill tone={assetTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.asset_code}
                  action={<StatusPill tone={assetTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Asset: {detail.record.asset_code} · Type: {detail.record.asset_type} · {detail.record.description} · Serial: {detail.record.serial}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Holder: {detail.record.holder_code ? `${detail.record.holder_code} · ${detail.record.holder_name ?? ""}`.trim() : "Unallocated"} · Condition: {detail.record.condition ?? "—"} · Issued on: {detail.record.issued_on ?? "—"}{detail.record.clearance_item ? " · Blocking clearance item at exit" : ""}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Condition at issue: {detail.record.condition_at_issue ? picklistLabel("PL_ASSET_CONDITION", detail.record.condition_at_issue) : "—"} · Expected return: {detail.record.expected_return ?? "—"} · Employee acknowledgement: {detail.record.acknowledged_by_employee ? "Acknowledged" : "Outstanding"}
                </p>
                {detail.record.condition_at_return && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Condition at return: {picklistLabel("PL_ASSET_RETURN_CONDITION", detail.record.condition_at_return)}
                    {detail.record.recovery_amount_minor === null ? "" : ` · Recovery: ${(Number(detail.record.recovery_amount_minor) / 100).toFixed(2)}`}
                    {detail.record.return_remarks ? ` · ${detail.record.return_remarks}` : ""}
                  </p>
                )}
                <StateTimeline states={ASSET_STATES} current={detail.record.status} />
                {detail.custody.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Custody history ({detail.custody.length})</p>
                    <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {detail.custody.map((item) => (
                        <li key={item.id} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">{item.employee_code ?? "—"} · {item.employee_name ?? "Unnamed"}</span>
                          <span className="mt-0.5 block text-muted-foreground">{item.issued_on ?? "—"} → {item.returned_on ?? "open"}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <AuditTrail events={detail.auditTrail} />
                {detail.record.status === "allocated" ? (
                  <ActionPanel title="Record return">
                    <ActionField label="Condition on return">
                      <select value={condition} onChange={(event) => setCondition(event.target.value)} className={actionInputClass}>
                        {picklists.PL_ASSET_RETURN_CONDITION.values.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Returned on">
                      <input type="date" value={returnedOn} onChange={(event) => setReturnedOn(event.target.value)} min={detail.record.issued_on ?? undefined} className={actionInputClass} />
                    </ActionField>
                    {(condition === "damaged" || condition === "lost") && (
                      <ActionField label="Recovery amount">
                        <input value={recoveryAmount} onChange={(event) => setRecoveryAmount(event.target.value)} placeholder="0.00" className={actionInputClass} />
                      </ActionField>
                    )}
                    <ActionField label={condition === "damaged" || condition === "lost" ? "Remarks (audited, min 10 characters)" : "Remarks (audited)"}>
                      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this asset being returned?" className={actionInputClass} />
                    </ActionField>
                    <ActionButton onClick={() => void recordReturn()} busy={busy}>Record return</ActionButton>
                  </ActionPanel>
                ) : detail.record.status === "written_off" ? null : (
                  <ActionPanel title="Allocate asset">
                    <ActionField label="Employee">
                      <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={actionInputClass}>
                        <option value="">Select an employee…</option>
                        {people.map((person) => (
                          <option key={str(person.id)} value={str(person.id)}>
                            {str(person.employeeCode)} · {personName(person)}
                          </option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Issued on">
                      <input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className={actionInputClass} />
                    </ActionField>
                    <ActionField label="Condition at issue">
                      <select value={conditionAtIssue} onChange={(event) => setConditionAtIssue(event.target.value)} className={actionInputClass}>
                        {picklists.PL_ASSET_CONDITION.values.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Expected return date">
                      <input type="date" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} min={issuedOn} className={actionInputClass} />
                    </ActionField>
                    <ActionField label="Recovery value if not returned (INR)">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={issueRecoveryAmount}
                        onChange={(event) => setIssueRecoveryAmount(event.target.value)}
                        placeholder="Leave blank to keep the value already on the asset"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionField label="Acknowledged by the employee">
                      <label className="flex h-10 items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="size-4" />
                        Employees normally acknowledge on self-service; tick only when they have signed for it here.
                      </label>
                    </ActionField>
                    <ActionField label="Reason (audited)">
                      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this asset being issued?" className={actionInputClass} />
                    </ActionField>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      An issued asset is held against the employee until it is returned: it appears on their full
                      and final for return at this value and blocks settlement until it is closed.
                    </p>
                    <ActionButton onClick={() => void allocate()} busy={busy}>Allocate asset</ActionButton>
                  </ActionPanel>
                )}
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Letters and issue register (SCR-067) ---------------- */

type LetterRow = {
  id: string;
  kind: "template" | "issue";
  letter: string;
  reference: string;
  employee_code: string | null;
  employee_name: string | null;
  version: string | null;
  effective_date: string | null;
  approver: string | null;
  letter_type: string | null;
  delivery_channels: string[] | null;
  acknowledgement_required: boolean;
  reprint_reason: string | null;
  status: "template_active" | "draft" | "pending_approval" | "issued" | "reissued";
};

type LetterIssueRow = {
  id: string;
  reference: string;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  status: string;
};

const LETTER_STATES = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "issued", label: "Issued" },
  { value: "reissued", label: "Reissued" },
] as const;

function letterTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "issued") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "template_active" || status === "reissued") return "info";
  return "neutral";
}

/**
 * FRM-DOC-01 template authoring.
 *
 * The issue register could only ever issue from a template somebody had already created
 * through the API; this is where one is written. Merge fields are validated server-side on
 * save, so an unknown field is refused at authoring rather than at issue — the catalogue is
 * listed beside the editor so the author can see what exists instead of guessing.
 */
function LetterTemplateEditor({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    templateCode: "", templateName: "", letterType: "", version: "v1",
    subject: "", body: "", approvalRequired: true, reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const catalogue = useRegisterResource(open ? "/api/v1/letters/templates" : "");
  const mergeFields = useMemo(() => listOf(asRecord(catalogue.data).data), [catalogue.data]);

  async function save() {
    if (!form.templateCode.trim() || !form.templateName.trim() || !form.letterType) {
      setNotice({ text: "A code, a name and a letter type are required.", tone: "error" });
      return;
    }
    if (form.subject.trim().length < 3 || form.body.trim().length < 20) {
      setNotice({ text: "The subject needs at least 3 characters and the body 20.", tone: "error" });
      return;
    }
    if (form.reason.trim().length < 3) {
      setNotice({ text: "A reason (min 3 characters) is recorded against the save.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction("/api/v1/letters/templates", {
      templateCode: form.templateCode.trim(),
      templateName: form.templateName.trim(),
      letterType: form.letterType,
      version: form.version.trim() || "v1",
      subject: form.subject.trim(),
      body: form.body,
      approvalRequired: form.approvalRequired,
      reason: form.reason.trim(),
    });
    setBusy(false);
    setNotice(outcome.ok
      ? { text: "Template saved. It is now offered on the issue form.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setForm((current) => ({ ...current, templateCode: "", templateName: "", subject: "", body: "", reason: "" }));
      onSaved();
    }
  }

  return (
    <ActionPanel title="Letter templates">
      {open ? null : (
        <ActionButton onClick={() => setOpen(true)} busy={false}>New letter template</ActionButton>
      )}
      {open ? (
        <>
          <ActionField label="Template code">
            <input value={form.templateCode} onChange={(event) => setForm((c) => ({ ...c, templateCode: event.target.value }))} className={actionInputClass} placeholder="APPOINTMENT-STD" />
          </ActionField>
          <ActionField label="Template name">
            <input value={form.templateName} onChange={(event) => setForm((c) => ({ ...c, templateName: event.target.value }))} className={actionInputClass} placeholder="Standard appointment letter" />
          </ActionField>
          <ActionField label="Letter type">
            <select value={form.letterType} onChange={(event) => setForm((c) => ({ ...c, letterType: event.target.value }))} className={actionInputClass}>
              <option value="">Select a type</option>
              {picklists.PL_LETTER_TYPE.values.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </ActionField>
          <ActionField label="Version">
            <input value={form.version} onChange={(event) => setForm((c) => ({ ...c, version: event.target.value }))} className={actionInputClass} placeholder="v2.1 effective 2026-04-01" />
          </ActionField>
          <ActionField label="Subject">
            <input value={form.subject} onChange={(event) => setForm((c) => ({ ...c, subject: event.target.value }))} className={actionInputClass} />
          </ActionField>
          <ActionField label="Body">
            <textarea value={form.body} onChange={(event) => setForm((c) => ({ ...c, body: event.target.value }))} rows={8} className={`${actionInputClass} h-auto py-2 font-mono text-[11px]`} placeholder="Dear {{employee_name}}, ..." />
          </ActionField>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={form.approvalRequired} onChange={(event) => setForm((c) => ({ ...c, approvalRequired: event.target.checked }))} className="size-4" />
            Issues from this template need approval
          </label>
          <ActionField label="Reason (audited)">
            <input value={form.reason} onChange={(event) => setForm((c) => ({ ...c, reason: event.target.value }))} className={actionInputClass} />
          </ActionField>
          <details className="mt-3 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold">Available merge fields ({mergeFields.length})</summary>
            <ul className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              {mergeFields.map((entry, index) => (
                <li key={index}><code className="font-mono">{`{{${str(entry.field)}}}`}</code> — {str(entry.description)}</li>
              ))}
            </ul>
          </details>
          <RegisterNotice notice={notice} />
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton onClick={save} busy={busy}>Save template</ActionButton>
            <ActionButton onClick={() => setOpen(false)} busy={false}>Close</ActionButton>
          </div>
        </>
      ) : null}
    </ActionPanel>
  );
}

export function LettersIssueRegisterPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [letterType, setLetterType] = useState("");
  const [approver, setApprover] = useState("");
  // The workbook's default is email plus the employee portal.
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(["email", "employee_portal"]);
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/letters/register?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as LetterRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(
    selected ? `/api/v1/letters/register/${encodeURIComponent(selected.id)}?kind=${selected.kind}` : "",
  );
  const peopleState = useRegisterResource("/api/v1/people?search=&page=1&pageSize=100");
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as LetterRow,
      issues: listOf(data.issues) as unknown as LetterIssueRow[],
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function issue() {
    if (!selected || selected.kind !== "template") return;
    if (!employeeId) {
      setNotice({ text: "Select the employee receiving this letter.", tone: "error" });
      return;
    }
    if (!letterType) {
      setNotice({ text: "Select the type of letter being issued.", tone: "error" });
      return;
    }
    if (approver.trim().length < 2 || reason.trim().length < 3) {
      setNotice({ text: "A signatory and a reason (min 3 characters) are required.", tone: "error" });
      return;
    }
    if (deliveryChannels.length === 0) {
      setNotice({ text: "Pick at least one delivery channel.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction("/api/v1/letters/register", {
      letterType,
      templateId: selected.id,
      employeeId,
      effectiveDate,
      approver: approver.trim(),
      deliveryChannels,
      acknowledgementRequired: acknowledgementRequired,
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Letter issued against the template version. It now appears in the register.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setEmployeeId("");
      setLetterType("");
      setApprover("");
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="Onboarding · SCR-067"
        title="Letters and issue register"
        description="Manage letters and issue register with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/document-vault" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Draft letter
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-067"
        description="Pick a template or an issued letter from the queue → inspect its version and issue history → issue the active template version to an employee against an approver."
      />
      <ScopeBar href="/document-vault" label="Open document vault" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading letters register…"
        errorTitle="Letters register unavailable"
        emptyTitle="No letter templates yet"
        emptyHint="Add a letter template to the library. Issued letters are tracked here against the template version that produced them."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search letters"
              searchPlaceholder="Search letter, reference, employee…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Letter", "Employee", "Version", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.letter}</Cell>
                  <Cell>{row.employee_code ? `${row.employee_code} · ${row.employee_name ?? ""}`.trim() : "Template library"}</Cell>
                  <Cell>{row.kind === "template" ? (row.version ?? "—") : row.reference}</Cell>
                  <Cell><StatusPill tone={letterTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.reference}
                  action={<StatusPill tone={letterTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Letter: {detail.record.letter} · Employee: {detail.record.employee_code ? `${detail.record.employee_code} · ${detail.record.employee_name ?? ""}`.trim() : "Template library"} · Version: {detail.record.version ?? "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Effective date: {detail.record.effective_date ?? "—"} · Signatory: {detail.record.approver ?? "—"} · Type: {detail.record.letter_type ? picklistLabel("PL_LETTER_TYPE", detail.record.letter_type) : "—"}
                </p>
                {detail.record.kind === "issue" && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Delivered by: {(detail.record.delivery_channels ?? []).map((channel) => picklistLabel("PL_RELEASE_CHANNEL", channel)).join(", ") || "—"} · Acknowledgement: {detail.record.acknowledgement_required ? "Required" : "Not required"}
                    {detail.record.reprint_reason ? ` · Reprinted: ${detail.record.reprint_reason}` : ""}
                  </p>
                )}
                <StateTimeline states={LETTER_STATES} current={detail.record.status} />
                {detail.record.kind === "template" && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Issued from this template ({detail.issues.length})</p>
                    {detail.issues.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">No letters have been issued from this template version yet.</p>
                    ) : (
                      <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                        {detail.issues.map((item) => (
                          <li key={item.id} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                            <span className="font-semibold">{item.reference}</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              {item.employee_code ?? "—"} · {item.employee_name ?? "Unnamed"} · {item.issued_on ?? "—"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
                <AuditTrail events={detail.auditTrail} />
                {detail.record.kind === "template" && (
                  <ActionPanel title="Issue letter">
                    <ActionField label="Employee">
                      <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={actionInputClass}>
                        <option value="">Select an employee…</option>
                        {people.map((person) => (
                          <option key={str(person.id)} value={str(person.id)}>
                            {str(person.employeeCode)} · {personName(person)}
                          </option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Letter type">
                      <select value={letterType} onChange={(event) => setLetterType(event.target.value)} className={actionInputClass}>
                        <option value="">Select a letter type…</option>
                        {picklists.PL_LETTER_TYPE.values.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </ActionField>
                    <ActionField label="Effective date">
                      <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className={actionInputClass} />
                    </ActionField>
                    <ActionField label="Signatory">
                      <input value={approver} onChange={(event) => setApprover(event.target.value)} placeholder="Who signs this letter?" className={actionInputClass} />
                    </ActionField>
                    <ActionField label="Delivery channels">
                      <span className="flex flex-wrap gap-3">
                        {picklists.PL_RELEASE_CHANNEL.values.map((entry) => (
                          <label key={entry.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={deliveryChannels.includes(entry.value)}
                              onChange={(event) => setDeliveryChannels((current) => (
                                event.target.checked ? [...current, entry.value] : current.filter((channel) => channel !== entry.value)
                              ))}
                              className="size-4"
                            />
                            {entry.label}
                          </label>
                        ))}
                      </span>
                    </ActionField>
                    <ActionField label="Acknowledgement required">
                      <label className="flex h-10 items-center gap-2 text-[11px] text-muted-foreground">
                        <input type="checkbox" checked={acknowledgementRequired} onChange={(event) => setAcknowledgementRequired(event.target.checked)} className="size-4" />
                        The employee must acknowledge the version they were issued.
                      </label>
                    </ActionField>
                    <ActionField label="Reason (audited)">
                      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this letter being issued?" className={actionInputClass} />
                    </ActionField>
                    <ActionButton onClick={() => void issue()} busy={busy}>Issue letter</ActionButton>
                  </ActionPanel>
                )}
                <LetterTemplateEditor onSaved={() => invalidateGetRequest("/api/v1/letters/register")} />
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Policy acknowledgements (SCR-062) ---------------- */

type PolicyAckRow = {
  id: string;
  policy: string;
  policy_code: string;
  version: string | null;
  audience: string;
  published_from: string | null;
  due_on: string | null;
  audience_count: number;
  acknowledged_count: number;
  acknowledged_on: string | null;
  status: "published" | "pending_acknowledgement" | "acknowledged" | "overdue";
};

type PolicyAckEntry = {
  employee_code: string | null;
  employee_name: string | null;
  acknowledged_on: string | null;
  comment: string | null;
};

const POLICY_STATES = [
  { value: "published", label: "Published" },
  { value: "pending_acknowledgement", label: "Pending acknowledgement" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "overdue", label: "Overdue" },
] as const;

function policyTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "acknowledged") return "success";
  if (status === "pending_acknowledgement") return "warning";
  if (status === "overdue") return "danger";
  return "info";
}

export function PolicyAcknowledgementsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/policy-acknowledgements?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as PolicyAckRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/policy-acknowledgements/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as PolicyAckRow,
      acknowledgements: listOf(data.acknowledgements) as unknown as PolicyAckEntry[],
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function acknowledge() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/policy-acknowledgements/${encodeURIComponent(selected.id)}/acknowledge`, {
      comment: comment.trim() || undefined,
    });
    setNotice(outcome.ok
      ? { text: "Acknowledgement recorded against your employee record.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setComment("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="Onboarding · SCR-062"
        title="Policy acknowledgements"
        description="Manage policy acknowledgements with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/engagement" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Publish acknowledgement
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-062"
        description="Pick a published policy version from the queue → review who has acknowledged it → record your own acknowledgement with an optional comment. Nothing completes silently."
      />
      <ScopeBar href="/onboarding" label="Open onboarding" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading policy acknowledgements…"
        errorTitle="Policy acknowledgements unavailable"
        emptyTitle="No published policies"
        emptyHint="Publish a policy document from Engagement. Each policy version is tracked here with its audience and acknowledgements."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search policies"
              searchPlaceholder="Search policy, code…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Policy", "Audience", "Acknowledged", "Status"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.policy}</Cell>
                  <Cell>{row.audience}</Cell>
                  <Cell>{row.acknowledged_count} of {row.audience_count}</Cell>
                  <Cell><StatusPill tone={policyTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                </QueueRow>
              ))}
            </RegisterQueue>
          }
          detail={
            !selected || !detail ? (
              <DetailPlaceholder loading={detailState.loading} error={detailState.error} onRetry={detailState.refresh} />
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={detail.record.policy_code}
                  action={<StatusPill tone={policyTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Policy: {detail.record.policy} · Version: {detail.record.version ?? "—"} · Audience: {detail.record.audience}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Published from: {detail.record.published_from ?? "—"} · Due on: {detail.record.due_on ?? "—"} · Acknowledged: {detail.record.acknowledged_count} of {detail.record.audience_count}
                  {detail.record.acknowledged_on ? ` · You acknowledged on ${detail.record.acknowledged_on}` : ""}
                </p>
                <StateTimeline states={POLICY_STATES} current={detail.record.status} />
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Acknowledgements ({detail.acknowledgements.length})</p>
                  {detail.acknowledgements.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No employee has acknowledged this policy version yet.</p>
                  ) : (
                    <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                      {detail.acknowledgements.map((entry, index) => (
                        <li key={`${entry.employee_code ?? "unknown"}-${index}`} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">{entry.employee_code ?? "—"} · {entry.employee_name ?? "Unnamed"}</span>
                          <span className="mt-0.5 block text-muted-foreground">{entry.acknowledged_on ?? "—"}{entry.comment ? ` · ${entry.comment}` : ""}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <AuditTrail events={detail.auditTrail} />
                {!detail.record.acknowledged_on && (
                  <ActionPanel title="Record acknowledgement">
                    <ActionField label="Employee comment (optional)">
                      <input
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Anything to note with your acknowledgement?"
                        className={actionInputClass}
                      />
                    </ActionField>
                    <ActionButton onClick={() => void acknowledge()} busy={busy}>Record acknowledgement</ActionButton>
                  </ActionPanel>
                )}
                <ConfigFooter />
              </div>
            )
          }
        />
      )}
    </div>
  );
}

/* ---------------- Employee home actions (SCR-042) ---------------- */

type HomeActionRow = {
  id: string;
  action: string;
  context: string;
  source: "onboarding" | "clearance" | "policy" | "document" | "leave";
  updated_at: string | null;
  due_on: string | null;
  status: "available" | "queued_offline" | "completed" | "needs_attention";
  href: string;
};

const HOME_ACTION_STATES = [
  { value: "available", label: "Available" },
  { value: "queued_offline", label: "Queued offline" },
  { value: "completed", label: "Completed" },
  { value: "needs_attention", label: "Needs attention" },
] as const;

function homeActionTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "needs_attention") return "warning";
  if (status === "available") return "info";
  return "neutral";
}

export function EmployeeHomeActionsPage() {
  const [selectedId, setSelectedId] = useState("");
  const queueState = useRegisterResource("/api/v1/home/actions");
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as HomeActionRow[], [queueState.data]);
  const meta = useMemo(() => asRecord(asRecord(queueState.data).meta), [queueState.data]);
  const employee = useMemo(() => {
    const value = meta.employee;
    return value === null || value === undefined ? null : asRecord(value);
  }, [meta]);
  const auditTrail = useMemo(() => listOf(meta.auditTrail), [meta]);
  const selected = useSelection(queue, selectedId);

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="People Core · SCR-042"
        title="Employee home actions"
        description="Manage employee home actions with a scoped work queue, record history and controlled actions."
        onRefresh={queueState.refresh}
        action={
          <Link href="/people" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Start employee action
          </Link>
        }
      />
      <ProcessGuide
        screenId="SCR-042"
        description="Every outstanding self-service action for the signed-in employee, gathered from the governed onboarding, clearance, policy, document and leave records. Each target re-checks permissions on the server."
      />
      <ScopeBar href="/people" label="Open people core" />

      {!queueState.loading && !queueState.error && employee === null ? (
        <Surface className="p-5 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold text-foreground">No employee record is linked to your account</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Self-service actions are scoped to an employee record. Ask People Core to link your membership to your employee record.
          </p>
        </Surface>
      ) : (
        <>
          <RegisterStates
            loading={queueState.loading}
            error={queueState.error}
            empty={!queueState.loading && !queueState.error && queue.length === 0}
            onRetry={queueState.refresh}
            loadingLabel="Loading employee actions…"
            errorTitle="Employee actions unavailable"
            emptyTitle="Nothing needs your attention"
            emptyHint="Joining steps, clearance items, policy acknowledgements, document reviews and leave decisions appear here as they arise."
          />
          {!queueState.loading && !queueState.error && queue.length > 0 && (
            <RegisterLayout
              queue={
                <RegisterQueue
                  searchLabel="Search employee actions"
                  searchPlaceholder="Search is scoped to your own actions"
                  onSearch={() => setSelectedId("")}
                  total={queue.length}
                  columns={["Action", "Context", "Updated", "Status"]}
                >
                  {queue.map((row) => (
                    <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                      <Cell strong>{row.action}</Cell>
                      <Cell>{row.context}</Cell>
                      <Cell>{row.updated_at ? row.updated_at.slice(0, 10) : "—"}</Cell>
                      <Cell><StatusPill tone={homeActionTone(row.status)} dot>{stateLabel(row.status)}</StatusPill></Cell>
                    </QueueRow>
                  ))}
                </RegisterQueue>
              }
              detail={
                !selected ? (
                  <DetailPlaceholder loading={queueState.loading} error={queueState.error} onRetry={queueState.refresh} />
                ) : (
                  <div>
                    <SectionHeading
                      title="Record detail"
                      description={str(employee?.employeeCode, "Your record")}
                      action={<StatusPill tone={homeActionTone(selected.status)} dot>{stateLabel(selected.status)}</StatusPill>}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      Employee: {str(employee?.employeeCode, "—")} · {str(employee?.firstName)} {str(employee?.lastName)} · Department: {str(employee?.department, "—")} · Location: {str(employee?.location, "—")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Action: {selected.action} · Context: {selected.context} · Source: {selected.source} · Due on: {selected.due_on ?? "—"}
                    </p>
                    <StateTimeline states={HOME_ACTION_STATES} current={selected.status} />
                    <AuditTrail events={auditTrail} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={selected.href} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">
                        Open action
                      </Link>
                    </div>
                    <ConfigFooter />
                  </div>
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}
