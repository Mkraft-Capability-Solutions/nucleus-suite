"use client";

import { picklistLabel, picklistValues } from "@/lib/picklists";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import {
  ModuleStat,
  ModuleTabs,
  RegisterNotice,
  RegisterStates,
  TabPanel,
  asRecord,
  listFromEnvelope,
  shortTimestamp,
  str,
  useRegisterResource,
  type Notice,
  type UnknownRecord,
} from "./register-primitives";

/* ---------------- SLA arithmetic (pure, unit-tested) ---------------- */

/** Minutes in an hour / hours in a day, used only to format a real interval. */
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * How close to the due instant a live ticket has to be before the desk treats
 * it as escalated. This is a service-desk presentation rule, not a statutory
 * one, and it is the only threshold this module owns.
 */
const ESCALATION_WINDOW_MINUTES = MINUTES_PER_HOUR;

export type SlaStanding = { label: string; breached: boolean; escalated: boolean };

const NO_SLA: SlaStanding = { label: "No SLA target", breached: false, escalated: false };

/**
 * A date-only due value is read as the end of that day, which matches how the
 * queue already decides a ticket is overdue. A value carrying a time is used
 * exactly as stored.
 */
function parseSlaInstant(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59` : raw;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "2h 15m", "45m", "3d 4h" — never a rounded-away zero. */
function spanLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

/**
 * The SLA standing of one ticket, derived only from values the record already
 * carries. With no stored due date there is no target to report — the label
 * says so rather than inventing one. `resolvedAt`, when known, stops the clock
 * at the audited resolution instead of measuring against now.
 */
export function slaRemaining(
  dueDate: string | null,
  now: Date = new Date(),
  resolvedAt?: string | null,
): SlaStanding {
  const due = parseSlaInstant(dueDate);
  if (!due) return NO_SLA;
  const settled = parseSlaInstant(resolvedAt);
  const reference = settled ?? now;
  const remainingMinutes = (due.getTime() - reference.getTime()) / (MINUTES_PER_HOUR * 1000);

  if (remainingMinutes < 0) {
    return { label: `Breached ${spanLabel(-remainingMinutes)} ago`, breached: true, escalated: true };
  }
  if (settled) return { label: "Resolved on-time", breached: false, escalated: false };
  return {
    label: `${spanLabel(remainingMinutes)} remaining`,
    breached: false,
    escalated: remainingMinutes <= ESCALATION_WINDOW_MINUTES,
  };
}

/* ---------------- Ticket helpers ---------------- */

const SETTLED_STATUSES = ["resolved", "closed", "cancelled"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(row: UnknownRecord): boolean {
  const status = str(row.status);
  if (SETTLED_STATUSES.includes(status)) return false;
  const due = str(row.dueDate);
  return Boolean(due) && due < todayISO();
}

/** The audited resolution instant, when the record carries one. */
function resolutionInstant(row: UnknownRecord): string | null {
  return str(row.resolvedAt) || str(row.closedAt) || null;
}

function versionOf(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function tone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["resolved", "closed"].includes(status)) return "success";
  if (status === "open") return "warning";
  if (status === "in_progress") return "info";
  if (["returned", "rejected"].includes(status)) return "danger";
  return "neutral";
}

function priorityTone(priority: string): "danger" | "warning" | "info" | "neutral" {
  if (priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "NORMAL") return "info";
  return "neutral";
}

let fallbackKeyCounter = 0;
function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackKeyCounter += 1;
  return `${Date.now()}-${fallbackKeyCounter}`;
}

async function mutateTicket(path: string, body: UnknownRecord, version?: number): Promise<{ ok: boolean; message: string }> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": idempotencyKey() };
    if (version !== undefined) headers["If-Match"] = `"${version}"`;
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: str(asRecord(payload.error).message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

const CATEGORIES = picklistValues("PL_TICKET_CATEGORY");
const PRIORITIES = picklistValues("PL_PRIORITY");
// A grievance is routed away from the reporting line, so it defaults to confidential.
const CONFIDENTIAL_BY_DEFAULT = "grievance";

const HELPDESK_TABS = [
  { id: "tickets", label: "Support Tickets" },
  { id: "assistant", label: "Grounded Policy Assistant" },
] as const;

/* ---------------- Page ---------------- */

export function HelpdeskPage() {
  const [tab, setTab] = useState<string>("tickets");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryChip, setCategoryChip] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  // Phones show one pane at a time: the queue, or the open ticket. From `md`
  // both panes are always visible and this flag is ignored.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [reason, setReason] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", category: "payroll", subCategory: "", priority: "normal", subject: "", description: "", isConfidential: false, dueDate: "" });
  const [clauseInput, setClauseInput] = useState("");
  const [clauseQuery, setClauseQuery] = useState("");

  const listPath = `/api/v1/operations/tickets?pageSize=100${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}`;
  const ticketsState = useRegisterResource(listPath);
  const peopleState = useRegisterResource("/api/v1/people?search=&page=1&pageSize=100");
  const tickets = useMemo(() => listFromEnvelope(ticketsState.data).filter((row) => str(row.id)), [ticketsState.data]);
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);

  const peopleById = useMemo(() => {
    const index = new Map<string, string>();
    for (const row of people) {
      const name = `${str(row.firstName)} ${str(row.lastName)}`.trim() || str(row.employeeCode);
      if (name) index.set(str(row.id), name);
    }
    return index;
  }, [people]);

  // Chips come from the categories actually present in the queue, never a fixed list.
  const categoryChips = useMemo(
    () => ["ALL", ...[...new Set(tickets.map((row) => str(row.category)).filter(Boolean))].sort().map((value) => value.toUpperCase())],
    [tickets],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((row) => {
      if (categoryChip !== "ALL" && str(row.category).toUpperCase() !== categoryChip) return false;
      if (!needle) return true;
      return [str(row.subject), str(row.description), str(row.employeeId), str(row.id)].join(" ").toLowerCase().includes(needle);
    });
  }, [tickets, categoryChip, query]);

  const selected = (selectedId ? filtered.find((row) => str(row.id) === selectedId) : undefined) ?? filtered[0] ?? null;
  const historyState = useRegisterResource(selected ? `/api/v1/operations/tickets/${encodeURIComponent(str(selected.id))}/history?pageSize=100` : "");
  const history = useMemo(() => listFromEnvelope(historyState.data), [historyState.data]);

  // The resolution instant for the open record comes from its audited thread.
  const selectedResolvedAt = useMemo(() => {
    const event = [...history].reverse().find((entry) => ["resolve", "close"].includes(str(entry.action)));
    return event ? str(event.created_at) || null : null;
  }, [history]);

  const open = tickets.filter((row) => str(row.status) === "open").length;
  const inProgress = tickets.filter((row) => str(row.status) === "in_progress").length;
  const resolved = tickets.filter((row) => ["resolved", "closed"].includes(str(row.status))).length;
  const overdue = tickets.filter(isOverdue).length;

  /** The SLA line for one queue card. A settled ticket with no audited closure
   *  timestamp on the record reports that, rather than claiming a breach. */
  function slaFor(row: UnknownRecord, resolvedAt: string | null): SlaStanding {
    const settledStatus = SETTLED_STATUSES.includes(str(row.status));
    if (settledStatus && !resolvedAt) {
      return { label: "SLA closed with the ticket", breached: false, escalated: false };
    }
    return slaRemaining(str(row.dueDate) || null, new Date(), resolvedAt);
  }

  async function runAction(action: string, extra: UnknownRecord = {}) {
    if (!selected) return;
    if (!reason.trim()) {
      setNotice({ text: "Enter a reason — every ticket action is audited with it.", tone: "error" });
      return;
    }
    if (action === "assign" && !ownerId.trim()) {
      setNotice({ text: "Choose the ticket owner.", tone: "error" });
      return;
    }
    setBusyAction(action);
    setNotice(null);
    const outcome = await mutateTicket(
      `/api/v1/operations/tickets/${encodeURIComponent(str(selected.id))}/${action}`,
      { reason: reason.trim(), ...extra },
      versionOf(selected.version),
    );
    setNotice(outcome.ok ? { text: `Action ${action} recorded.`, tone: "success" } : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setReason("");
      setOwnerId("");
      ticketsState.refresh();
      historyState.refresh();
    }
    setBusyAction("");
  }

  async function createTicket() {
    if (!form.employeeId || !form.subject.trim() || !form.description.trim() || !form.subCategory.trim()) {
      setNotice({ text: "Employee, category detail, subject and description are required.", tone: "error" });
      return;
    }
    setBusyAction("create");
    setNotice(null);
    const body: UnknownRecord = {
      employeeId: form.employeeId,
      category: form.category,
      subCategory: form.subCategory.trim(),
      priority: form.priority,
      subject: form.subject.trim(),
      description: form.description.trim(),
      isConfidential: form.isConfidential,
    };
    if (form.dueDate) body.dueDate = form.dueDate;
    const outcome = await mutateTicket("/api/v1/operations/tickets", body);
    setNotice(outcome.ok ? { text: "Ticket raised with status open.", tone: "success" } : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setCreateOpen(false);
      setForm({ employeeId: "", category: "payroll", subCategory: "", priority: "normal", subject: "", description: "", isConfidential: false, dueDate: "" });
      ticketsState.refresh();
    }
    setBusyAction("");
  }

  const selectedStatus = selected ? str(selected.status) : "";
  const canAssign = ["open", "in_progress"].includes(selectedStatus);
  const canResolve = ["open", "in_progress"].includes(selectedStatus);
  const canClose = selectedStatus === "resolved";
  const canReopen = ["resolved", "closed"].includes(selectedStatus);

  const tabs = HELPDESK_TABS.map((entry) => ({
    ...entry,
    count: entry.id === "tickets" ? tickets.length : null,
  }));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageIntro
        eyebrow="Employee service · Helpdesk"
        title="Helpdesk & Grounded Policy Assistant"
        description="Unified employee service desk with SLA-governed ticket routing, multi-tier escalation, and an AI policy assistant that answers queries with verifiable source clause citations."
        action={
          <span className="flex flex-wrap gap-2">
            <Link href="/inbox" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">
              Open inbox <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => { setTab("tickets"); setCreateOpen((current) => !current); }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Raise Support Ticket
            </button>
          </span>
        }
      />
      <RegisterNotice notice={notice} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ModuleStat label="Open" value={ticketsState.loading ? null : open} />
        <ModuleStat label="In progress" value={ticketsState.loading ? null : inProgress} />
        <ModuleStat label="Resolved / closed" value={ticketsState.loading ? null : resolved} />
        <ModuleStat label="Overdue (past due date)" value={ticketsState.loading ? null : overdue} note="Derived from the stored due date only" />
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Helpdesk sections" />

      <TabPanel id="tickets" active={tab}>
        {createOpen && (
          <Surface className="mb-6">
            <SectionHeading title="Raise support ticket" description="Creates with status open. Assignment and resolution are separate audited approvals." />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Employee
                <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Ticket employee">
                  <option value="">Select employee…</option>
                  {people.map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.firstName)} {str(row.lastName)} · {str(row.employeeCode)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Due date (optional, drives the SLA clock)
                <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold">Category
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, isConfidential: event.target.value === CONFIDENTIAL_BY_DEFAULT }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                  {CATEGORIES.map((option) => <option key={option} value={option}>{picklistLabel("PL_TICKET_CATEGORY", option)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">What it is about
                <input value={form.subCategory} onChange={(event) => setForm((current) => ({ ...current, subCategory: event.target.value }))} maxLength={40} placeholder="Deduction query" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold">Priority
                <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                  {PRIORITIES.map((option) => <option key={option} value={option}>{picklistLabel("PL_PRIORITY", option)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-2">
                <input type="checkbox" checked={form.isConfidential} onChange={(event) => setForm((current) => ({ ...current, isConfidential: event.target.checked }))} className="size-4" />
                Confidential — keep this ticket off the reporting line
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">Subject
                <input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Payslip correction for September" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">Description
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="What happened, what was expected…" className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              </label>
            </div>
            <button type="button" onClick={() => void createTicket()} disabled={busyAction === "create"} className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busyAction === "create" ? "Raising…" : "Raise ticket"}
            </button>
          </Surface>
        )}

        <RegisterStates
          loading={ticketsState.loading}
          error={ticketsState.error}
          empty={!ticketsState.loading && !ticketsState.error && tickets.length === 0}
          onRetry={ticketsState.refresh}
          loadingLabel="Loading tickets…"
          errorTitle="Support tickets unavailable"
          emptyTitle="No tickets in this view"
          emptyHint="Raise the first support ticket, or widen the status filter."
        />

        {!ticketsState.loading && !ticketsState.error && tickets.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Surface className={`p-0 ${mobileDetail ? "hidden md:block" : ""}`}>
              <div className="space-y-3 border-b border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {categoryChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      aria-pressed={categoryChip === chip}
                      onClick={() => { setCategoryChip(chip); setSelectedId(""); }}
                      className={`min-h-10 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide transition sm:min-h-0 ${
                        categoryChip === chip
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-semibold">Status
                    <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedId(""); }} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                      <option value="">All</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold">Search
                    <span className="relative mt-1.5 block">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Subject, description, id…" aria-label="Search tickets" className="h-10 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
                    </span>
                  </label>
                </div>
              </div>
              <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                {filtered.length} of {tickets.length} ticket(s) in the current scope
              </p>
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">No tickets match these chips. Clear the filters to see the whole queue.</p>
              ) : (
                <ul className="max-h-[620px] space-y-3 overflow-y-auto p-4">
                  {filtered.map((row) => {
                    const id = str(row.id);
                    const active = selected !== null && str(selected.id) === id;
                    const status = str(row.status);
                    const priority = str(row.priority).toUpperCase();
                    const sla = slaFor(row, resolutionInstant(row));
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedId(id); setReason(""); setMobileDetail(true); }}
                          aria-current={active ? "true" : undefined}
                          className={`w-full rounded-2xl border p-4 text-left transition hover:border-primary/40 ${
                            active ? "border-primary/40 bg-primary/5" : "border-border/70"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">{id.slice(0, 8)}</span>
                            <StatusPill tone={priorityTone(priority)}>{priority || "—"}</StatusPill>
                          </span>
                          <span className="mt-1.5 block truncate text-sm font-semibold text-foreground">{str(row.subject, "Untitled ticket")}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            <StatusPill tone="neutral">{str(row.category, "uncategorised").toUpperCase()}</StatusPill>
                            <StatusPill tone={isOverdue(row) ? "danger" : tone(status)} dot>{status || "unknown"}</StatusPill>
                          </span>
                          <span className="mt-2 block text-[11px] text-muted-foreground">
                            Requester {peopleById.get(str(row.employeeId)) ?? "Not on the directory"} · Assignee {peopleById.get(str(row.ownerEmployeeId)) ?? "Unassigned"}
                          </span>
                          <span className={`mt-1 block text-[11px] font-semibold ${sla.breached ? "text-destructive" : sla.escalated ? "text-warning" : "text-muted-foreground"}`}>
                            SLA · {sla.label}{sla.escalated && !sla.breached ? " · escalated" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                <p className="text-sm text-muted-foreground">Select a ticket to inspect its thread and act.</p>
              ) : (
                <div>
                  <SectionHeading
                    title={str(selected.subject, "Untitled ticket")}
                    description={`${str(selected.category)} · ${str(selected.priority)} · due ${str(selected.dueDate, "no due date")}`}
                    action={<StatusPill tone={isOverdue(selected) ? "danger" : tone(str(selected.status))} dot>{str(selected.status)}</StatusPill>}
                  />
                  {(() => {
                    const sla = slaFor(selected, selectedResolvedAt ?? resolutionInstant(selected));
                    return (
                      <p className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${sla.breached ? "border-destructive/25 bg-destructive/10 text-destructive" : sla.escalated ? "border-warning/25 bg-warning/10 text-warning" : "border-border bg-secondary/30 text-muted-foreground"}`}>
                        SLA standing · {sla.label}
                        {sla.escalated && !sla.breached ? " · inside the escalation window" : ""}
                      </p>
                    );
                  })()}
                  {str(selected.category) === "grievance" && (
                    <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-[11px] leading-5 text-foreground">
                      Grievance — visible only to the requester and HR roles. Team scopes never see it.
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-xs leading-5 text-foreground">{str(selected.description, "No description.")}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">Version {str(selected.version, "1")} · {str(selected.id)}</p>

                  <div className="mt-4 border-t border-border pt-4">
                    <SectionHeading title="Audited thread" description={historyState.loading ? "Loading…" : `${history.length} event(s), newest last`} />
                    {historyState.loading ? <p role="status" className="text-xs text-muted-foreground">Loading thread…</p>
                      : historyState.error ? <p role="alert" className="text-xs text-destructive">{historyState.error}</p>
                      : history.length === 0 ? <p className="text-xs text-muted-foreground">No audited events yet.</p>
                      : (
                        <ol className="space-y-2">
                          {history.map((event) => (
                            <li key={str(event.id)} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{str(event.action).replace(/_/g, " ")}</span>
                                <StatusPill tone="neutral">{str(event.status, "—")}</StatusPill>
                              </span>
                              <span className="mt-1 block text-muted-foreground">{str(event.reason)}</span>
                              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{shortTimestamp(event.created_at)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <SectionHeading title="Act" description="Approvals need a different requester and approver; the server rejects self-approval." />
                    <label className="block text-xs font-semibold">Reason (audited, required)
                      <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Context for this action…" className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
                    </label>
                    {canAssign && (
                      <label className="mt-2 block text-xs font-semibold">Ticket owner (for assign)
                        <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 font-mono text-xs" aria-label="Ticket owner">
                          <option value="">Select owner…</option>
                          {people.map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.firstName)} {str(row.lastName)} · {str(row.employeeCode)}</option>)}
                        </select>
                      </label>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canAssign && <button type="button" disabled={busyAction === "assign"} onClick={() => void runAction("assign", { ownerEmployeeId: ownerId.trim() })} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60 sm:min-h-0">Assign</button>}
                      <button type="button" disabled={busyAction === "reply" || !["open", "in_progress", "resolved"].includes(selectedStatus)} onClick={() => void runAction("reply")} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60 sm:min-h-0">Reply</button>
                      {canResolve && <button type="button" disabled={busyAction === "resolve"} onClick={() => void runAction("resolve")} className="min-h-10 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 sm:min-h-0">Resolve</button>}
                      {canClose && <button type="button" disabled={busyAction === "close"} onClick={() => void runAction("close")} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60 sm:min-h-0">Close</button>}
                      {canReopen && <button type="button" disabled={busyAction === "reopen"} onClick={() => void runAction("reopen")} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60 sm:min-h-0">Reopen</button>}
                    </div>
                    {busyAction && <p role="status" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Working…</p>}
                  </div>
                </div>
              )}
            </Surface>
          </div>
        )}
      </TabPanel>

      <TabPanel id="assistant" active={tab}>
        <PolicyAssistantPanel
          input={clauseInput}
          onInput={setClauseInput}
          query={clauseQuery}
          onSearch={setClauseQuery}
        />
      </TabPanel>
    </div>
  );
}

/* ---------------- Grounded policy assistant ---------------- */

/**
 * Clause search over the indexed policy corpus. Every answer is one stored
 * passage shown with its own citation — the panel never composes prose of its
 * own, so nothing can be asserted that the corpus does not say.
 */
function PolicyAssistantPanel({
  input,
  onInput,
  query,
  onSearch,
}: {
  input: string;
  onInput: (value: string) => void;
  query: string;
  onSearch: (value: string) => void;
}) {
  const path = query ? `/api/v1/ai/knowledge?q=${encodeURIComponent(query)}&limit=10` : "";
  const clausesState = useRegisterResource(path);
  const clauses = useMemo(() => listFromEnvelope(clausesState.data), [clausesState.data]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.6fr]">
      <Surface>
        <SectionHeading
          title="Ask the policy corpus"
          description="Answers are stored policy clauses returned with their source citation. Nothing is generated beyond what the indexed corpus holds."
        />
        <form
          className="relative max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(input.trim());
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder="How many casual leave days do plant employees get?"
            aria-label="Search the policy corpus"
            className="h-11 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </form>

        <div className="mt-4">
          {!query ? (
            <p className="text-xs text-muted-foreground">Enter a policy question to retrieve the governing clauses.</p>
          ) : (
            <>
              <RegisterStates
                loading={clausesState.loading}
                error={clausesState.error}
                empty={!clausesState.loading && !clausesState.error && clauses.length === 0}
                onRetry={clausesState.refresh}
                loadingLabel="Retrieving policy clauses…"
                errorTitle="The policy corpus could not be searched"
                emptyTitle="No policy clause matched this question"
                emptyHint="Nothing in the indexed corpus answers it, so the assistant returns no answer rather than composing one."
              />
              {!clausesState.loading && !clausesState.error && clauses.length > 0 && (
                <ol className="space-y-3">
                  {clauses.map((clause, index) => {
                    const title = str(clause.title, "Untitled policy");
                    const section = str(clause.section);
                    const checksum = str(clause.checksum);
                    return (
                      <li key={`${title}-${section}-${index}`} className="rounded-2xl border border-border/70 p-4">
                        <p className="text-xs leading-5 text-foreground">{str(clause.text, "This clause carries no text.")}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <StatusPill tone="violet">Source citation</StatusPill>
                          <span className="font-semibold text-foreground">{title}</span>
                          {section && <span>· clause {section}</span>}
                          {checksum && <span className="font-mono">· {checksum.slice(0, 12)}</span>}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </div>
      </Surface>

      <Surface>
        <SectionHeading title="How grounding works" description="Retrieval only — no clause, no answer." />
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          <li className="rounded-xl border border-border/60 px-3 py-2">Each result is one indexed passage from the tenant&rsquo;s own policy corpus.</li>
          <li className="rounded-xl border border-border/60 px-3 py-2">The citation names the source document and clause so the answer can be verified against the original.</li>
          <li className="rounded-xl border border-border/60 px-3 py-2">When retrieval returns nothing, the assistant says so instead of drafting an answer.</li>
        </ul>
        <p className="mt-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
          Corpus indexing is governed separately; clauses appear here only once they are ingested and indexed.
        </p>
      </Surface>
    </div>
  );
}
