"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getJson, invalidateGetRequests } from "@/lib/client-api";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import { useWorkspace } from "./workspace-provider";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function dateLabel(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function stampLabel(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function humanize(value: string): string {
  return value ? value.replace(/_/g, " ") : "—";
}

/** The request's real workflow state, as the `mobility` resource records it. */
function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "approved") return "info";
  if (status === "submitted") return "warning";
  if (status === "returned" || status === "rejected" || status === "cancelled") return "danger";
  return "neutral";
}

function stageTone(state: string): "success" | "warning" | "danger" | "neutral" {
  if (state === "done") return "success";
  if (state === "current") return "warning";
  if (state === "halted") return "danger";
  return "neutral";
}

type ActionGate = { action: string; label: string; approval: boolean; allowed: boolean; reason: string };

type MobilityRow = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeStatus: string;
  currentRole: string;
  currentDepartment: string;
  currentLocation: string;
  targetRole: string;
  targetDepartment: string;
  targetLocation: string;
  effectiveDate: string;
  motivation: string;
  developmentPlan: string;
  isSelf: boolean;
  raisedByViewer: boolean;
  reportsToViewer: boolean;
  alreadyInTargetRole: boolean;
  actions: ActionGate[];
};

type HistoryRow = { id: string; action: string; reason: string; status: string; createdAt: string };

type PersonRow = { id: string; label: string };

function readRows(payload: unknown): MobilityRow[] {
  const data = asRecord(payload).data;
  return (Array.isArray(data) ? (data as UnknownRecord[]) : []).map((item) => ({
    id: str(item.id),
    version: int(item.version),
    status: str(item.status, "draft"),
    createdAt: str(item.createdAt),
    updatedAt: str(item.updatedAt),
    employeeId: str(item.employeeId),
    employeeCode: str(item.employeeCode),
    employeeName: str(item.employeeName),
    employeeStatus: str(item.employeeStatus),
    currentRole: str(item.currentRole),
    currentDepartment: str(item.currentDepartment),
    currentLocation: str(item.currentLocation),
    targetRole: str(item.targetRole),
    targetDepartment: str(item.targetDepartment),
    targetLocation: str(item.targetLocation),
    effectiveDate: str(item.effectiveDate),
    motivation: str(item.motivation),
    developmentPlan: str(item.developmentPlan),
    isSelf: item.isSelf === true,
    raisedByViewer: item.raisedByViewer === true,
    reportsToViewer: item.reportsToViewer === true,
    alreadyInTargetRole: item.alreadyInTargetRole === true,
    actions: (Array.isArray(item.actions) ? (item.actions as UnknownRecord[]) : []).map((entry) => ({
      action: str(entry.action),
      label: str(entry.label),
      approval: entry.approval === true,
      allowed: entry.allowed === true,
      reason: str(entry.reason),
    })),
  }));
}

function readHistory(payload: unknown): HistoryRow[] {
  const data = asRecord(payload).data;
  return (Array.isArray(data) ? (data as UnknownRecord[]) : []).map((item) => ({
    id: str(item.id),
    action: str(item.action, "—"),
    reason: str(item.reason),
    status: str(item.status),
    createdAt: str(item.created_at, str(item.createdAt)),
  }));
}

function readPeople(payload: unknown): PersonRow[] {
  const data = asRecord(payload).data;
  return (Array.isArray(data) ? (data as UnknownRecord[]) : []).flatMap((item) => {
    const id = str(item.id);
    if (!id) return [];
    const name = `${str(item.firstName)} ${str(item.lastName)}`.trim();
    const code = str(item.employeeCode);
    return [{ id, label: `${name || id.slice(0, 8)}${code ? ` · ${code}` : ""}` }];
  });
}

/** draft -> submitted -> approved/returned/rejected -> completed. */
const TIMELINE = [
  { id: "draft", label: "Draft", detail: "Raised and still editable by the requester.", statuses: ["draft", "returned"] },
  { id: "submitted", label: "Submitted", detail: "With an approver; the requester can no longer edit it.", statuses: ["submitted"] },
  { id: "decision", label: "Decision", detail: "Approved, returned for changes, or rejected.", statuses: ["approved", "returned", "rejected"] },
  { id: "completed", label: "Completed", detail: "Closed out. The employee record is unchanged.", statuses: ["completed"] },
];

function timelineFor(status: string, seen: string[]): Array<{ id: string; label: string; detail: string; state: string }> {
  const currentIndex = TIMELINE.findIndex((stage) => stage.statuses.includes(status));
  const halted = status === "rejected" || status === "cancelled";
  return TIMELINE.map((stage, index) => {
    const wasSeen = stage.statuses.some((candidate) => seen.includes(candidate));
    let state = "pending";
    if (index === currentIndex) state = "current";
    else if (index < currentIndex || wasSeen) state = "done";
    else if (halted || currentIndex === -1) state = "halted";
    return { id: stage.id, label: stage.label, detail: stage.detail, state };
  });
}

const STATUS_FILTERS = ["draft", "submitted", "approved", "returned", "rejected", "cancelled", "completed"];

const BLANK_FORM = { employeeId: "", targetRole: "", targetDepartment: "", targetLocation: "", effectiveDate: "", motivation: "", developmentPlan: "" };

const selectClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";
const inputClass = "h-10 w-full min-w-0 max-w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground";
const areaClass = "min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground";

async function postJson(path: string, body: unknown, version?: number): Promise<void> {
  const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() };
  if (version !== undefined) headers["If-Match"] = `"${version}"`;
  const response = await fetch(path, { method: "POST", headers, cache: "no-store", body: JSON.stringify(body) });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(payload, response.status, `The request failed (${response.status}).`));
  }
}

export function InternalMobilityPage() {
  // Deep-link preselect (?record=<requestId>); lazy initializer keeps SSR output stable.
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("record") ?? "";
  });
  const { workspace } = useWorkspace();
  const permissions = workspace?.context?.permissions ?? [];
  const canRaise = permissions.includes("talent.mobility.write") || permissions.includes("talent.mobility.self.write");
  const raiseForSelfOnly = !permissions.includes("talent.mobility.write");
  const viewerEmployeeId = workspace?.context?.employeeId ?? "";

  const [rows, setRows] = useState<MobilityRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [peopleError, setPeopleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // History, the reason box and the last action error all belong to ONE request.
  // Keyed state resets them when the selection moves without an effect that
  // writes state back into React on every render.
  const [historyState, setHistoryState] = useState<{ recordId: string; rows: HistoryRow[]; error: string }>({ recordId: "", rows: [], error: "" });
  const [reasonState, setReasonState] = useState({ recordId: "", text: "" });
  const [actionErrorState, setActionErrorState] = useState({ recordId: "", message: "" });
  const [actionBusy, setActionBusy] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(() => {
    invalidateGetRequests();
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getJson("/api/v1/mobility-register?pageSize=100");
        if (live) setRows(readRows(payload));
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "The mobility register could not be loaded.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [revision]);

  // The employee picker is a separate permission (employee.read). A requester
  // who cannot list people can still raise a request for themselves.
  useEffect(() => {
    if (!canRaise) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson("/api/v1/people?search=&page=1&pageSize=100");
        if (live) {
          setPeople(readPeople(payload));
          setPeopleError("");
        }
      } catch {
        if (live) {
          setPeople([]);
          setPeopleError("The employee directory is not readable with your access, so a request can only be raised for yourself.");
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [canRaise, revision]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (needle && !`${row.employeeName} ${row.employeeCode} ${row.targetRole} ${row.targetDepartment} ${row.targetLocation}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const active = useMemo(() => rows.find((row) => row.id === selectedId) ?? filtered[0] ?? null, [rows, selectedId, filtered]);
  const activeId = active?.id ?? "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    void (async () => {
      try {
        const payload = await getJson(`/api/v1/operations/mobility/${encodeURIComponent(activeId)}/history?pageSize=100`);
        if (live) setHistoryState({ recordId: activeId, rows: readHistory(payload), error: "" });
      } catch (caught) {
        if (live) setHistoryState({ recordId: activeId, rows: [], error: caught instanceof Error ? caught.message : "The history trail could not be loaded." });
      }
    })();
    return () => {
      live = false;
    };
  }, [activeId, revision]);

  const historyReady = activeId !== "" && historyState.recordId === activeId;
  const history = useMemo(() => (historyReady ? historyState.rows : []), [historyReady, historyState.rows]);
  const historyError = historyReady ? historyState.error : "";
  const historyLoading = activeId !== "" && !historyReady;
  const reason = reasonState.recordId === activeId ? reasonState.text : "";
  const actionError = actionErrorState.recordId === activeId ? actionErrorState.message : "";

  const timeline = useMemo(() => timelineFor(active?.status ?? "", history.map((entry) => entry.status)), [active?.status, history]);

  const pending = rows.filter((row) => row.status === "submitted").length;
  const approvedNotCompleted = rows.filter((row) => row.status === "approved").length;
  const needsRequester = rows.filter((row) => row.status === "returned").length;

  async function runAction(gate: ActionGate): Promise<void> {
    if (!active || !gate.allowed) return;
    if (reason.trim().length < 3) {
      setActionErrorState({ recordId: active.id, message: "Enter a reason of at least three characters. The workflow records it against the request." });
      return;
    }
    setActionBusy(gate.action);
    setActionErrorState({ recordId: active.id, message: "" });
    try {
      await postJson(`/api/v1/operations/mobility/${encodeURIComponent(active.id)}/${gate.action}`, { reason: reason.trim() }, active.version);
      setReasonState({ recordId: active.id, text: "" });
      refresh();
    } catch (caught) {
      setActionErrorState({ recordId: active.id, message: caught instanceof Error ? caught.message : "The action could not be completed." });
    } finally {
      setActionBusy("");
    }
  }

  async function raiseRequest(): Promise<void> {
    const missing = Object.entries(form).filter(([, value]) => value.trim().length === 0).map(([field]) => field);
    if (missing.length > 0) {
      setFormError(`Every field is required by the mobility workflow. Still empty: ${missing.join(", ")}.`);
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      await postJson("/api/v1/operations/mobility", {
        employeeId: form.employeeId.trim(),
        targetRole: form.targetRole.trim(),
        targetDepartment: form.targetDepartment.trim(),
        targetLocation: form.targetLocation.trim(),
        effectiveDate: form.effectiveDate,
        motivation: form.motivation.trim(),
        developmentPlan: form.developmentPlan.trim(),
      });
      setForm(BLANK_FORM);
      setFormOpen(false);
      refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The request could not be raised.");
    } finally {
      setFormBusy(false);
    }
  }

  const pickerOptions = raiseForSelfOnly || people.length === 0
    ? viewerEmployeeId
      ? [{ id: viewerEmployeeId, label: "Myself" }]
      : []
    : people;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="TALENT · INTERNAL MOBILITY"
        title="Career & internal mobility"
        description="The register of internal career-move requests: who wants to move, from which role to which, on what date, and where each request stands. Approval decides the request; it does not move anybody."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-4" /> Refresh
            </Button>
            {canRaise ? (
              <Button className="h-10 rounded-xl px-4 text-xs font-bold" onClick={() => setFormOpen((open) => !open)}>
                {formOpen ? "Close form" : "Raise a request"}
              </Button>
            ) : null}
          </div>
        }
      />

      <Surface className="mb-6 border-warning/40">
        <SectionHeading
          title="What approval and completion actually do"
          description="Read this before using the decision buttons. It is the difference between this register and the employee master."
          action={<StatusPill tone="warning">Record-keeping only</StatusPill>}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
            <p className="text-xs font-bold text-foreground">Completing a request does</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Mark the approved request as done: the record moves to completed, and the action is written to this request&apos;s history and to the tenant audit trail.
            </p>
          </div>
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <AlertTriangle className="size-3.5 text-destructive" /> Completing a request does not
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Move the employee. The employee master, the assignment record, the reporting line, the department, the location and the pay structure are all left exactly as they were. The effective-dated assignment change is a separate, explicit act in People Core, and nothing on this screen performs it.
            </p>
          </div>
        </div>
      </Surface>

      <Surface className="mb-6">
        <SectionHeading
          title="Internal job postings (IJP)"
          description="The navigation calls this module Internal Mobility (IJP). The data does not carry an IJP."
          action={<StatusPill tone="neutral">Not available</StatusPill>}
        />
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          A mobility request here is a direct, named request for one target role. It is not an application against a posting: job postings carry no internal-or-external flag, and nothing links a mobility request to a requisition or a posting. Internal applications, internal shortlists and IJP reporting cannot be produced from this data, so this screen does not offer them.
        </p>
      </Surface>

      {formOpen && canRaise ? (
        <Surface className="mb-6">
          <SectionHeading
            title="Raise a mobility request"
            description="Every field is required by the workflow. The request starts as a draft and is only visible to an approver once it is submitted."
          />
          {peopleError ? <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{peopleError}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Employee
              <select className={selectClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select an employee</option>
                {pickerOptions.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))}
              </select>
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Effective date
              <input type="date" className={inputClass} value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Target role
              <input className={inputClass} value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Target department
              <input className={inputClass} value={form.targetDepartment} onChange={(e) => setForm({ ...form, targetDepartment: e.target.value })} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Target location
              <input className={inputClass} value={form.targetLocation} onChange={(e) => setForm({ ...form, targetLocation: e.target.value })} />
            </label>
            <div />
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Motivation
              <textarea className={areaClass} value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
              Development plan
              <textarea className={areaClass} value={form.developmentPlan} onChange={(e) => setForm({ ...form, developmentPlan: e.target.value })} />
            </label>
          </div>
          {formError ? <p role="alert" className="mt-3 text-xs text-destructive">{formError}</p> : null}
          <div className="mt-4 flex gap-2">
            <Button className="h-10 sm:h-9 rounded-lg text-xs" disabled={formBusy} onClick={() => void raiseRequest()}>
              {formBusy ? "Raising…" : "Raise request"}
            </Button>
            <Button variant="outline" className="h-10 sm:h-9 rounded-lg text-xs" disabled={formBusy} onClick={() => { setForm(BLANK_FORM); setFormError(""); setFormOpen(false); }}>
              Cancel
            </Button>
          </div>
        </Surface>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Waiting for a decision", value: pending, hint: "Submitted and with an approver." },
          { label: "Approved, not yet completed", value: approvedNotCompleted, hint: "The move is agreed; the assignment change is still a People Core act." },
          { label: "Returned to the requester", value: needsRequester, hint: "Editable again and awaiting resubmission." },
        ].map((metric) => (
          <Surface key={metric.label} className="p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{loading ? "—" : metric.value}</p>
            <p className="mt-2 text-xs font-bold text-foreground">{metric.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{metric.hint}</p>
          </Surface>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Surface>
          <SectionHeading
            title="Work queue"
            description={loading ? "Loading…" : `${filtered.length} request${filtered.length === 1 ? "" : "s"} in your scope`}
            action={
              <div className="flex flex-wrap gap-2">
                <input aria-label="Search mobility requests" className={inputClass} placeholder="Employee or target role" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Request status filter" className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>{humanize(status)}</option>
                  ))}
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
                ? "No mobility requests are visible in your scope yet. Raise the first one, then submit it for approval."
                : "No requests match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">Employee</th>
                    <th className="px-3 py-2 font-bold">Current role</th>
                    <th className="px-3 py-2 font-bold">Requested move</th>
                    <th className="px-3 py-2 font-bold">Effective</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="w-10 px-3 py-2"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const selected = row.id === activeId;
                    return (
                      <tr key={row.id}>
                        <td colSpan={6} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            aria-current={selected ? "true" : undefined}
                            className={`mb-2 grid w-full grid-cols-[1.1fr_1fr_1.4fr_auto_auto_2rem] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"}`}
                          >
                            <span className="block min-w-0 truncate text-xs font-semibold text-foreground">
                              {row.employeeName || "Employee not resolved"}
                              {row.employeeCode ? <span className="ml-1 font-normal text-muted-foreground">({row.employeeCode})</span> : null}
                              {row.isSelf ? <span className="ml-1 font-normal text-primary">· you</span> : null}
                            </span>
                            <span className="block min-w-0 truncate text-xs text-muted-foreground">
                              {row.currentRole || "Role not on the employee record"}
                              {row.currentDepartment ? <span className="block truncate">{row.currentDepartment}</span> : null}
                            </span>
                            <span className="block min-w-0 truncate text-xs text-foreground">
                              {row.targetRole || "—"}
                              <span className="block truncate text-muted-foreground">
                                {[row.targetDepartment, row.targetLocation].filter(Boolean).join(" · ") || "No target department or location"}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dateLabel(row.effectiveDate)}</span>
                            <span className="min-w-0"><StatusPill tone={statusTone(row.status)}>{humanize(row.status)}</StatusPill></span>
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
            title="Request detail"
            description={active ? `${active.employeeName || "Employee not resolved"} · raised ${stampLabel(active.createdAt)}` : "Select a request to inspect it"}
            action={active ? <StatusPill tone={statusTone(active.status)}>{humanize(active.status)}</StatusPill> : undefined}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No request selected.</p>
          ) : (
            <div>
              <dl className="space-y-2 text-xs">
                {[
                  ["Employee", `${active.employeeName || "Not resolved"}${active.employeeCode ? ` (${active.employeeCode})` : ""}`],
                  ["Employee status", humanize(active.employeeStatus)],
                  ["Current role", active.currentRole || "Not on the employee record"],
                  ["Current department", active.currentDepartment || "—"],
                  ["Current location", active.currentLocation || "—"],
                  ["Target role", active.targetRole || "—"],
                  ["Target department", active.targetDepartment || "—"],
                  ["Target location", active.targetLocation || "—"],
                  ["Requested effective date", dateLabel(active.effectiveDate)],
                  ["Record version", String(active.version)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {active.alreadyInTargetRole ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  The employee master already shows this target role. Either the move was recorded separately in People Core, or the request restates the current position.
                </p>
              ) : null}

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivation</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground">{active.motivation || "Not recorded."}</p>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Development plan</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground">{active.developmentPlan || "Not recorded."}</p>

              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">State timeline</h3>
              <ol className="mt-2 space-y-1.5">
                {timeline.map((stage) => (
                  <li key={stage.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
                    <span className="min-w-0">
                      <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{stage.detail}</span>
                    </span>
                    <StatusPill tone={stageTone(stage.state)}>{stage.state}</StatusPill>
                  </li>
                ))}
              </ol>

              <Link href="/mobility?section=operations/mobility" className="mt-4 inline-flex h-10 sm:h-9 items-center rounded-lg border border-border px-3 text-xs font-bold hover:bg-secondary">
                Edit this request in the mobility workflow <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </div>
          )}
        </Surface>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Surface>
          <SectionHeading
            title="Actions"
            description={active ? "Every action is recorded with your reason. An action you cannot take says why, rather than disappearing." : "Select a request first."}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No request selected.</p>
          ) : (
            <div>
              <label className="flex w-full min-w-0 flex-col gap-1.5 text-xs font-bold text-muted-foreground sm:w-auto">
                Reason (recorded against the request)
                <textarea className={areaClass} value={reason} onChange={(e) => setReasonState({ recordId: activeId, text: e.target.value })} placeholder="Why are you taking this action?" />
              </label>
              {actionError ? <p role="alert" className="mt-2 text-xs text-destructive">{actionError}</p> : null}
              <ul className="mt-3 space-y-2">
                {active.actions.map((gate) => (
                  <li key={gate.action} className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {gate.label}
                        {gate.approval ? <span className="ml-1.5 font-normal text-muted-foreground">· approver action</span> : null}
                      </span>
                      <Button
                        size="sm"
                        variant={gate.allowed ? "default" : "outline"}
                        className="h-10 sm:h-8 rounded-lg text-xs"
                        disabled={!gate.allowed || actionBusy !== ""}
                        onClick={() => void runAction(gate)}
                      >
                        {actionBusy === gate.action ? "Working…" : gate.label}
                      </Button>
                    </div>
                    <p className={`mt-1.5 text-[11px] leading-relaxed ${gate.allowed ? "text-muted-foreground" : "text-destructive"}`}>{gate.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="History and audit trail"
            description={active ? "Every recorded action on this request, oldest first, exactly as the workflow stored it." : "Select a request first."}
          />
          {!active ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">No request selected.</p>
          ) : historyLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : historyError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-xs leading-relaxed text-muted-foreground">{historyError}</p>
              <Button variant="outline" size="sm" className="h-10 sm:h-8 rounded-lg text-xs" onClick={refresh}>
                <RefreshCcw className="mr-1.5 size-3.5" /> Retry
              </Button>
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              No actions have been recorded against this request yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-bold">When</th>
                    <th className="px-3 py-2 font-bold">Action</th>
                    <th className="px-3 py-2 font-bold">Resulting status</th>
                    <th className="px-3 py-2 font-bold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-t border-border/60 align-top">
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{stampLabel(entry.createdAt)}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-foreground">{humanize(entry.action)}</td>
                      <td className="px-3 py-2 text-xs"><StatusPill tone={statusTone(entry.status)}>{humanize(entry.status)}</StatusPill></td>
                      <td className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{entry.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
