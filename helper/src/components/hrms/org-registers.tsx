"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Inbox, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiGetError, getJson } from "@/lib/client-api";
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
  ModuleStat,
  ModuleTabs,
  ProcessGuide,
  QueueRow,
  ReferencePicker,
  RegisterIntro,
  RegisterLayout,
  RegisterNotice,
  RegisterQueue,
  RegisterStates,
  ScopeBar,
  StateTimeline,
  TabPanel,
  actionInputClass,
  listOf,
  postRegisterAction,
  recordFromEnvelope,
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
  const [entry, setEntry] = useState<{ path: string; value: unknown } | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (!cancelled) {
          setEntry({ path, value });
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "This data could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  const data = entry && entry.path === path ? entry.value : null;
  return { data, loading: Boolean(path) && data === null && !error, error, refresh: () => setTick((current) => current + 1) };
}

/* ---------------- Position register ---------------- */

/* ---------------- Position register (SCR-012) ---------------- */

type RegisterPosition = {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  cost_centre: string;
  worker_class: string | null;
  fte: number | string | null;
  available_from: string | null;
  budget_cost_minor: number | string | null;
  effective_from: string | null;
  incumbent_code: string | null;
  incumbent_name: string | null;
  vacancy: "filled" | "vacant";
  status: "open" | "filled" | "frozen" | "abolished";
  record_status: string;
};

/** Minor units are the stored form; the register prints the major amount it came from. */
function majorAmount(minor: number | string): string {
  return (Number(minor) / 100).toFixed(2);
}

function positionTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "filled") return "success";
  if (status === "open") return "info";
  if (status === "frozen") return "warning";
  if (status === "abolished") return "neutral";
  return "neutral";
}

function positionLabel(status: string): string {
  if (!status) return "Unknown";
  return status[0]?.toUpperCase() + status.slice(1);
}

async function postPosition(path: string, body: UnknownRecord): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: str(asRecord(payload.error).message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export function PositionRegisterPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  // Phones show the queue or the open record, never both squeezed side by side.
  // From `md` both columns render and this flag is ignored.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const queueState = useLive(`/api/v1/organization/positions/register?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as RegisterPosition[], [queueState.data]);
  const selected = (selectedId ? queue.find((row) => row.id === selectedId) : undefined) ?? queue[0] ?? null;
  const detailState = useLive(selected ? `/api/v1/organization/positions/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = asRecord(asRecord(detailState.data).data);
    if (!data.id) return null;
    const history = Array.isArray(data.history) ? (data.history as UnknownRecord[]) : [];
    const auditTrail = Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : [];
    return { record: data as unknown as RegisterPosition, history, auditTrail };
  }, [detailState.data]);

  async function transition(action: "freeze" | "unfreeze") {
    const minimum = action === "freeze" ? 10 : 3;
    if (!selected || reason.trim().length < minimum) {
      setNotice({ text: `A reason (min ${minimum} characters) is required.`, tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postPosition(`/api/v1/organization/positions/${encodeURIComponent(selected.id)}/${action}`, { reason: reason.trim() });
    setNotice(outcome.ok
      ? { text: action === "freeze" ? "Position frozen. The audit entry is visible in this record detail." : "Position reopened. The audit entry is visible in this record detail.", tone: "success" }
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
      <PageIntro
        eyebrow="People Core · SCR-012"
        title="Position register"
        description="Manage position register with a scoped work queue, record history and controlled actions."
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { queueState.refresh(); if (selected) detailState.refresh(); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">Refresh</button>
            <Link href="/organization" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">Create position</Link>
          </span>
        }
      />
      {notice && (
        <p role="status" className={`mb-4 rounded-lg border p-3 text-xs text-foreground ${notice.tone === "success" ? "border-success/30 bg-success/10" : "border-border bg-secondary/40"}`}>
          {notice.text}
        </p>
      )}
      <Surface className="mb-4">
        <SectionHeading title="Process guide · SCR-012" description="Pick a sanctioned post from the queue → inspect its incumbent, vacancy and audit trail → freeze or reopen it with a reason. Creation stays in Organization with approvals." />
      </Surface>
      <Surface className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
          <Link href="/people" className="text-xs font-semibold text-primary hover:underline">Open people core</Link>
        </div>
      </Surface>

      {queueState.loading ? (
        <Surface className="p-5"><p role="status" className="text-sm font-semibold text-foreground">Loading position register…</p></Surface>
      ) : queueState.error ? (
        <Surface className="p-5">
          <p role="alert" className="text-sm font-semibold text-foreground">Position register unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">{queueState.error}</p>
          <button type="button" onClick={queueState.refresh} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">Try again</button>
        </Surface>
      ) : queue.length === 0 ? (
        <Surface className="p-5 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold text-foreground">No positions yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">Create the first sanctioned post from Organization.</p>
        </Surface>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Surface className={`p-0 ${mobileDetail ? "hidden md:block" : ""}`}>
            <div className="border-b border-border p-4">
              <form
                className="relative w-full max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSelectedId("");
                  setSearch(searchInput.trim());
                }}
              >
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search code, title, department…" aria-label="Search positions" className="h-10 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
              </form>
            </div>
            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{queue.length} record(s) in the current scope</p>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Position</th>
                    <th className="px-3 py-3">Incumbent</th>
                    <th className="px-3 py-3">Vacancy</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {queue.map((row) => {
                    const current = selected && selected.id === row.id;
                    return (
                      <tr key={row.id} onClick={() => { setSelectedId(row.id); setMobileDetail(true); }} className={`cursor-pointer hover:bg-secondary/40 ${current ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3"><p className="text-xs font-semibold text-foreground">{row.code} · {row.title}</p></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{row.incumbent_code ?? "Vacant"}</td>
                        <td className="px-3 py-3 text-xs capitalize text-muted-foreground">{row.vacancy}</td>
                        <td className="px-3 py-3"><StatusPill tone={positionTone(row.status)} dot>{positionLabel(row.status)}</StatusPill></td>
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
            {!selected || !detail ? (
              <div>
                <p className="text-sm text-muted-foreground">{detailState.loading ? "Loading record detail…" : detailState.error ? detailState.error : "Select a record to view its controlled workflow, evidence and audit trail."}</p>
                {!detailState.loading && detailState.error && (
                  <button type="button" onClick={detailState.refresh} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">Try again</button>
                )}
              </div>
            ) : (
              <div>
                <SectionHeading
                  title="Record detail"
                  description={`${detail.record.code}`}
                  action={<StatusPill tone={positionTone(detail.record.status)} dot>{positionLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Position: {detail.record.code} · {detail.record.title} · Incumbent: {detail.record.incumbent_code ?? "Vacant"}{detail.record.incumbent_name ? ` (${detail.record.incumbent_name})` : ""} · Vacancy: {detail.record.vacancy} · Location: {detail.record.location}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {[
                    ["Worker class", detail.record.worker_class ? picklistLabel("PL_WORKER_CLASS", detail.record.worker_class) : "Not recorded"],
                    ["Cost centre", detail.record.cost_centre || "Unassigned"],
                    ["Full time equivalent", detail.record.fte === null ? "Not recorded" : Number(detail.record.fte).toFixed(2)],
                    ["Available for hire from", detail.record.available_from ?? "Not recorded"],
                    ["Budgeted annual cost", detail.record.budget_cost_minor === null ? "Not recorded" : majorAmount(detail.record.budget_cost_minor)],
                    ["Effective from", detail.record.effective_from ?? "Not recorded"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">State timeline</p>
                  <ol className="mt-2 space-y-1.5">
                    {(["open", "filled", "frozen", "abolished"] as const).map((state, index) => (
                      <li key={state} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${detail.record.status === state ? "border-primary/30 bg-primary/5 font-semibold text-foreground" : "border-border/60 text-muted-foreground"}`}>
                        <span className="grid size-5 place-items-center rounded-md bg-secondary font-mono text-[10px]">{index + 1}</span>
                        {positionLabel(state)}
                      </li>
                    ))}
                  </ol>
                </div>
                {detail.history.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Incumbency ({detail.history.length})</p>
                    <ol className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {detail.history.slice(0, 10).map((item) => (
                        <li key={str(item.id)} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <span className="font-semibold">{str(item.employee_code)} · {str(item.first_name)} {str(item.last_name)}</span>
                          <span className="mt-0.5 block text-muted-foreground">{str(item.effective_from)} → {str(item.effective_to) ?? "open"}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-xs font-bold text-foreground">Audit trail</p>
                  {detail.auditTrail.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No audited events for this record yet.</p> : (
                    <ol className="mt-2 space-y-1.5">
                      {detail.auditTrail.slice(0, 8).map((event) => (
                        <li key={str(event.id)} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                          <p className="font-semibold">{str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}</p>
                          <p className="mt-0.5 text-muted-foreground">{str(event.reason)} · {str(event.created_at).slice(0, 16).replace("T", " ")}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {(detail.record.status === "open" || detail.record.status === "filled") && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-bold text-foreground">Freeze position</p>
                    <label className="mt-2 block text-xs font-semibold">Reason (audited, min 10 characters)<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this post frozen?" minLength={10} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                    <button type="button" onClick={() => void transition("freeze")} disabled={busy} className="mt-2 h-10 rounded-xl border border-border px-4 text-xs font-bold hover:border-primary/50 disabled:opacity-60">{busy ? "Saving…" : "Freeze position"}</button>
                  </div>
                )}
                {detail.record.status === "frozen" && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-bold text-foreground">Reopen position</p>
                    <label className="mt-2 block text-xs font-semibold">Reason (audited)<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this post reopened?" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                    <button type="button" onClick={() => void transition("unfreeze")} disabled={busy} className="mt-2 h-10 rounded-xl border border-border px-4 text-xs font-bold hover:border-primary/50 disabled:opacity-60">{busy ? "Saving…" : "Reopen position"}</button>
                  </div>
                )}
                <p className="mt-4 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">Configuration · Rules and permissions are evaluated by the active module contract.</p>
              </div>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sanctioned strength board (SCR-013) ---------------- */

type SanctionedRow = {
  id: string;
  record_code: string;
  organisation: string;
  designation: string;
  location: string;
  worker_class: string | null;
  sanctioned: number;
  filled: number;
  open_requisitions: number;
  headroom: number;
  status: "within_headroom" | "at_limit" | "over_plan";
  effective_from: string | null;
  valid_to: string | null;
  approved_by: string | null;
  plan_title: string | null;
};

const SANCTIONED_STATES = [
  { value: "within_headroom", label: "Within headroom" },
  { value: "at_limit", label: "At limit" },
  { value: "over_plan", label: "Over plan" },
] as const;

function headroomTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "within_headroom") return "success";
  if (status === "at_limit") return "warning";
  if (status === "over_plan") return "danger";
  return "neutral";
}

export function SanctionedStrengthBoardPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sanctionedInput, setSanctionedInput] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [approvalReference, setApprovalReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const queueState = useRegisterResource(`/api/v1/organization/sanctioned-strength?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as SanctionedRow[], [queueState.data]);
  const selected = useSelection(queue, selectedId);
  const detailState = useRegisterResource(selected ? `/api/v1/organization/sanctioned-strength/${encodeURIComponent(selected.id)}` : "");
  const detail = useMemo(() => {
    const data = recordFromEnvelope(detailState.data);
    if (!data.id) return null;
    return {
      record: data as unknown as SanctionedRow,
      deployed: typeof data.deployed === "number" ? data.deployed : null,
      auditTrail: listOf(data.auditTrail),
    };
  }, [detailState.data]);

  async function revise() {
    if (!selected) return;
    const parsed = Number(sanctionedInput);
    if (sanctionedInput.trim() === "" || !Number.isInteger(parsed) || parsed < 0) {
      setNotice({ text: "Enter the sanctioned strength as a whole number of posts.", tone: "error" });
      return;
    }
    if (approvalReference.trim().length < 3 || reason.trim().length < 3) {
      setNotice({ text: "An approval reference and a reason (min 3 characters each) are required.", tone: "error" });
      return;
    }
    if (!validFrom || !validTo) {
      setNotice({ text: "A sanction is valid for a dated period; enter both dates.", tone: "error" });
      return;
    }
    if (validTo < validFrom) {
      setNotice({ text: "The sanction cannot end before it starts.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const outcome = await postRegisterAction(`/api/v1/organization/sanctioned-strength/${encodeURIComponent(selected.id)}/revise`, {
      sanctioned: parsed,
      validFrom,
      validTo,
      approvalReference: approvalReference.trim(),
      reason: reason.trim(),
    });
    setNotice(outcome.ok
      ? { text: "Sanctioned strength revised. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setSanctionedInput("");
      setValidFrom("");
      setValidTo("");
      setApprovalReference("");
      setReason("");
      queueState.refresh();
      detailState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <RegisterIntro
        eyebrow="People Core · SCR-013"
        title="Sanctioned strength board"
        description="Manage sanctioned strength board with a scoped work queue, record history and controlled actions."
        onRefresh={() => { queueState.refresh(); detailState.refresh(); }}
        action={
          <Link href="/organization" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Set sanctioned strength
          </Link>
        }
      />
      <RegisterNotice notice={notice} />
      <ProcessGuide
        screenId="SCR-013"
        description="Pick a sanctioned line from the queue → compare approved strength against filled posts and open requisitions → revise the sanctioned strength against an approval reference."
      />
      <ScopeBar href="/people" label="Open people core" />

      <RegisterStates
        loading={queueState.loading}
        error={queueState.error}
        empty={!queueState.loading && !queueState.error && queue.length === 0}
        onRetry={queueState.refresh}
        loadingLabel="Loading sanctioned strength…"
        errorTitle="Sanctioned strength unavailable"
        emptyTitle="No sanctioned lines yet"
        emptyHint="Approve a manpower plan in Organization. Each sanctioned line appears here with its filled posts and open requisitions."
      />
      {!queueState.loading && !queueState.error && queue.length > 0 && (
        <RegisterLayout
          queue={
            <RegisterQueue
              searchLabel="Search sanctioned strength"
              searchPlaceholder="Search organisation, location, record…"
              onSearch={(value) => { setSelectedId(""); setSearch(value); }}
              total={queue.length}
              columns={["Organisation", "Sanctioned", "Filled", "Open"]}
            >
              {queue.map((row) => (
                <QueueRow key={row.id} selected={selected?.id === row.id} onSelect={() => setSelectedId(row.id)}>
                  <Cell strong>{row.organisation}</Cell>
                  <Cell>{row.sanctioned}</Cell>
                  <Cell>{row.filled}</Cell>
                  <Cell>{row.open_requisitions}</Cell>
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
                  description={detail.record.record_code}
                  action={<StatusPill tone={headroomTone(detail.record.status)} dot>{stateLabel(detail.record.status)}</StatusPill>}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Organisation: {detail.record.organisation} · Designation: {detail.record.designation} · Location: {detail.record.location} · Worker class: {detail.record.worker_class ? picklistLabel("PL_WORKER_CLASS", detail.record.worker_class) : "—"} · Sanctioned: {detail.record.sanctioned} · Filled: {detail.record.filled} · Open: {detail.record.open_requisitions}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Headroom: {detail.record.headroom} · Valid: {detail.record.effective_from ?? "—"} → {detail.record.valid_to ?? "—"} · Approved by: {detail.record.approved_by ?? "—"}
                  {detail.deployed === null ? "" : ` · Deployed headcount today: ${detail.deployed}`}
                </p>
                <StateTimeline states={SANCTIONED_STATES} current={detail.record.status} />
                <AuditTrail events={detail.auditTrail} />
                <ActionPanel title="Revise sanctioned strength">
                  <ActionField label="Sanctioned posts">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={sanctionedInput}
                      onChange={(event) => setSanctionedInput(event.target.value)}
                      placeholder={String(detail.record.sanctioned)}
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionField label="Sanction valid from">
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(event) => setValidFrom(event.target.value)}
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionField label="Sanction valid to">
                    <input
                      type="date"
                      value={validTo}
                      onChange={(event) => setValidTo(event.target.value)}
                      min={validFrom || undefined}
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionField label="Approval reference">
                    <input
                      value={approvalReference}
                      onChange={(event) => setApprovalReference(event.target.value)}
                      placeholder="Board or management approval reference"
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionField label="Reason (audited)">
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is the sanctioned strength changing?"
                      className={actionInputClass}
                    />
                  </ActionField>
                  <ActionButton onClick={() => void revise()} busy={busy}>Set sanctioned strength</ActionButton>
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

/* ---------------- Assignment & policy attributes ---------------- */

/* ---------------- Assignment & policy attributes (SCR-011) ---------------- */

type QueueAssignment = {
  id: string | null;
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  location: string;
  effective_from: string;
  effective_to: string | null;
};

type HistoryAssignment = QueueAssignment & {
  version: number;
  employment_id: string;
  grade: string | null;
  reason: string | null;
  record_status: string;
  status: "effective" | "scheduled" | "superseded";
};

function assignmentTone(status: string): "success" | "info" | "neutral" {
  if (status === "effective") return "success";
  if (status === "scheduled") return "info";
  return "neutral";
}

function assignmentLabel(status: string): string {
  if (!status) return "Unknown";
  return status[0]?.toUpperCase() + status.slice(1);
}

async function postAssignment(path: string, body: UnknownRecord): Promise<{ ok: boolean; message: string }> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) headers["Idempotency-Key"] = crypto.randomUUID();
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: str(asRecord(payload.error).message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export function AssignmentPolicyAttributesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedRecord, setSelectedRecord] = useState("");
  // Phones show the queue or the open record, never both squeezed side by side.
  // From `md` both columns render and this flag is ignored.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeId: "", departmentId: "", positionId: "", locationId: "", effectiveFrom: "", effectiveTo: "",
    changeType: "new_hire", noticePeriodDays: "", payrollGroupId: "", workArea: "",
    attendanceModes: ["biometric_device"] as string[], reason: "",
    // RL-05's per-employee overrides. Empty means "inherit", which is not the same as a
    // value: the resolver reports which level answered, and an override entered here is
    // the only thing that outranks the worker category.
    overrideHasRestDays: "", overrideRestDayPattern: "", overrideWageType: "", overrideOtEligibility: "",
  });

  const queueState = useLive(`/api/v1/employee-assignments?search=${encodeURIComponent(search)}`);
  const queue = useMemo(() => listFromEnvelope(queueState.data) as unknown as QueueAssignment[], [queueState.data]);
  const activeEmployee = selectedEmployee || queue[0]?.employee_id || "";
  const historyState = useLive(activeEmployee ? `/api/v1/employee-assignments?employeeId=${encodeURIComponent(activeEmployee)}` : "");
  const history = useMemo(() => {
    const data = asRecord(asRecord(historyState.data).data);
    return (Array.isArray(data.assignments) ? (data.assignments as unknown as HistoryAssignment[]) : []);
  }, [historyState.data]);
  const historyAudit = useMemo(() => {
    const data = asRecord(asRecord(historyState.data).data);
    return (Array.isArray(data.auditTrail) ? (data.auditTrail as UnknownRecord[]) : []);
  }, [historyState.data]);
  const record = (selectedRecord ? history.find((row) => str(row.id) === selectedRecord) : undefined) ?? history[0] ?? null;

  const departmentsState = useLive("/api/v1/dossier-lookups/departments?pageSize=100");
  const positionsState = useLive("/api/v1/dossier-lookups/positions?pageSize=100");
  const locationsState = useLive("/api/v1/dossier-lookups/locations?pageSize=100");
  const payrollGroupsState = useLive("/api/v1/dossier-lookups/payGroups?pageSize=100");
  const lookupRows = (payload: unknown) => listFromEnvelope(payload).filter((row) => str(row.id));
  const formEmployeeState = useLive(form.employeeId ? `/api/v1/dossier/employments?employeeId=${encodeURIComponent(form.employeeId)}&pageSize=1` : "");
  const formEmploymentId = useMemo(() => str(listFromEnvelope(formEmployeeState.data)[0]?.id), [formEmployeeState.data]);
  const peopleState = useLive("/api/v1/people?search=&page=1&pageSize=100");
  const people = useMemo(() => listFromEnvelope(peopleState.data).filter((row) => str(row.id)), [peopleState.data]);

  async function addAssignment() {
    if (!formEmploymentId || !form.departmentId || !form.positionId || !form.locationId || !form.effectiveFrom || !form.reason.trim()) {
      setNotice({ text: "Employee, department, position, location, effective date and reason are required.", tone: "error" });
      return;
    }
    if (form.attendanceModes.length === 0) {
      setNotice({ text: "Pick at least one attendance capture mode.", tone: "error" });
      return;
    }
    const notice = form.noticePeriodDays.trim();
    if (notice && !/^\d{1,3}$/.test(notice)) {
      setNotice({ text: "Notice period is a whole number of days between 0 and 180.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    const body: UnknownRecord = {
      employmentId: formEmploymentId,
      departmentId: form.departmentId,
      positionId: form.positionId,
      locationId: form.locationId,
      effectiveFrom: form.effectiveFrom,
      changeType: form.changeType,
      attendanceModes: form.attendanceModes,
      reason: form.reason.trim(),
    };
    if (form.effectiveTo) body.effectiveTo = form.effectiveTo;
    if (notice) body.noticePeriodDays = Number(notice);
    if (form.payrollGroupId) body.payrollGroupId = form.payrollGroupId;
    if (form.workArea.trim()) body.workArea = form.workArea.trim();
    // Only a chosen override is sent. Sending an empty value would record "no rest days"
    // or "not OT eligible" as a decision, when what was meant was "take the category's".
    if (form.overrideHasRestDays) body.overrideHasRestDays = form.overrideHasRestDays === "yes";
    if (form.overrideRestDayPattern) body.overrideRestDayPattern = form.overrideRestDayPattern;
    if (form.overrideWageType) body.overrideWageType = form.overrideWageType;
    if (form.overrideOtEligibility) body.overrideOtEligibility = form.overrideOtEligibility;
    const outcome = await postAssignment("/api/v1/dossier/assignments", body);
    setNotice(outcome.ok
      ? { text: "Assignment recorded and effective. The audit entry is visible in this record detail.", tone: "success" }
      : { text: outcome.message, tone: "error" });
    if (outcome.ok) {
      setFormOpen(false);
      setForm({
        employeeId: "", departmentId: "", positionId: "", locationId: "", effectiveFrom: "", effectiveTo: "",
        changeType: "new_hire", noticePeriodDays: "", payrollGroupId: "", workArea: "",
        attendanceModes: ["biometric_device"], reason: "",
        overrideHasRestDays: "", overrideRestDayPattern: "", overrideWageType: "", overrideOtEligibility: "",
      });
      queueState.refresh();
      historyState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro
        eyebrow="People Core · SCR-011"
        title="Assignment and policy attributes"
        description="Manage assignment and policy attributes with a scoped work queue, record history and controlled actions."
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => queueState.refresh()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">Refresh</button>
            <button type="button" onClick={() => setFormOpen((open) => !open)} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">Add assignment</button>
          </span>
        }
      />
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-lg border p-3 text-xs text-foreground ${notice.tone === "success" ? "border-success/30 bg-success/10" : "border-border bg-secondary/40"}`}
        >
          {notice.text}
        </p>
      )}
      <Surface className="mb-4">
        <SectionHeading title="Process guide · SCR-011" description="Pick the current assignment from the queue → inspect its effective-dated history and audit trail → record a new assignment. Overlapping periods are rejected; the newest effective record supersedes the previous one." />
      </Surface>
      <Surface className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
          <Link href="/people" className="text-xs font-semibold text-primary hover:underline">Open people core</Link>
        </div>
      </Surface>

      {formOpen && (
        <Surface className="mb-6">
          <SectionHeading title="Add assignment" description={formEmploymentId ? "Employment resolved. Effective-dated; overlaps are rejected." : "Select an employee to resolve their employment record first."} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold">Employee
              <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment employee">
                <option value="">Select employee…</option>
                {people.map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.firstName)} {str(row.lastName)} · {str(row.employeeCode)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Department
              <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment department">
                <option value="">Select department…</option>
                {lookupRows(departmentsState.data).map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.name)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Position
              <select value={form.positionId} onChange={(event) => setForm((current) => ({ ...current, positionId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment position">
                <option value="">Select position…</option>
                {lookupRows(positionsState.data).map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.name)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Location
              <select value={form.locationId} onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment location">
                <option value="">Select location…</option>
                {lookupRows(locationsState.data).map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.name)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Effective from<input type="date" value={form.effectiveFrom} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Effective to (optional)<input type="date" value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Change type
              <select value={form.changeType} onChange={(event) => setForm((current) => ({ ...current, changeType: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment change type">
                {picklists.PL_ASSIGNMENT_CHANGE.values.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">Notice period (days)<input value={form.noticePeriodDays} onChange={(event) => setForm((current) => ({ ...current, noticePeriodDays: event.target.value }))} placeholder="From the worker class when blank" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Work site / plant area<input value={form.workArea} onChange={(event) => setForm((current) => ({ ...current, workArea: event.target.value }))} placeholder="Shop floor, bay 3…" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Payroll group
              <select value={form.payrollGroupId} onChange={(event) => setForm((current) => ({ ...current, payrollGroupId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Assignment payroll group">
                <option value="">Not set</option>
                {lookupRows(payrollGroupsState.data).map((row) => (
                  <option key={str(row.id)} value={str(row.id)}>{str(row.name, str(row.id).slice(0, 8))}</option>
                ))}
              </select>
            </label>
            <fieldset className="block text-xs font-semibold sm:col-span-2">
              <legend>Attendance capture mode</legend>
              <span className="mt-1.5 flex flex-wrap gap-3">
                {picklists.PL_ATTENDANCE_MODE.values.map((entry) => (
                  <label key={entry.value} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.attendanceModes.includes(entry.value)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        attendanceModes: event.target.checked
                          ? [...current.attendanceModes, entry.value]
                          : current.attendanceModes.filter((mode) => mode !== entry.value),
                      }))}
                      className="size-4"
                    />
                    {entry.label}
                  </label>
                ))}
              </span>
            </fieldset>
            <fieldset className="block text-xs font-semibold sm:col-span-2">
              <legend>Policy overrides for this person <span className="font-normal text-muted-foreground">— leave any unset to inherit the worker category</span></legend>
              <span className="mt-1.5 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold">Rest days
                  <select value={form.overrideHasRestDays} onChange={(event) => setForm((current) => ({ ...current, overrideHasRestDays: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Inherit from category</option>
                    <option value="yes">Has rest days</option>
                    <option value="no">No rest days</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">Rest day pattern
                  <select value={form.overrideRestDayPattern} onChange={(event) => setForm((current) => ({ ...current, overrideRestDayPattern: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Inherit from category</option>
                    {picklists.PL_REST_DAY_PATTERN.values.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold">Wage basis
                  <select value={form.overrideWageType} onChange={(event) => setForm((current) => ({ ...current, overrideWageType: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Inherit from category</option>
                    {picklists.PL_WAGE_TYPE.values.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold">Overtime eligibility
                  <select value={form.overrideOtEligibility} onChange={(event) => setForm((current) => ({ ...current, overrideOtEligibility: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">Inherit from category</option>
                    {picklists.PL_OT_ELIGIBILITY.values.map((entry) => (
                      <option key={entry.value} value={entry.value}>{entry.label}</option>
                    ))}
                  </select>
                </label>
              </span>
            </fieldset>
            <label className="block text-xs font-semibold sm:col-span-2">Reason (audited)<input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Transfer, promotion, correction…" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
          </div>
          <button type="button" onClick={() => void addAssignment()} disabled={busy} className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Saving…" : "Add assignment"}</button>
        </Surface>
      )}

      {queueState.loading ? (
        <Surface className="p-5"><p role="status" className="text-sm font-semibold text-foreground">Loading assignments…</p></Surface>
      ) : queueState.error ? (
        <Surface className="p-5">
          <p role="alert" className="text-sm font-semibold text-foreground">Assignments unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">{queueState.error}</p>
          <button type="button" onClick={queueState.refresh} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">Try again</button>
        </Surface>
      ) : queue.length === 0 ? (
        <Surface className="p-5 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold text-foreground">No assignments yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">Record the first assignment above. This queue reads the governed assignment register.</p>
        </Surface>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Surface className={`p-0 ${mobileDetail ? "hidden md:block" : ""}`}>
            <div className="border-b border-border p-4">
              <form
                className="relative w-full max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSelectedEmployee("");
                  setSelectedRecord("");
                  setSearch(searchInput.trim());
                }}
              >
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, code…" aria-label="Search assignments" className="h-10 w-full rounded-xl border border-border bg-secondary/50 px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
              </form>
            </div>
            <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{queue.length} record(s) in the current scope</p>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Effective from</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {queue.map((row) => {
                    const current = activeEmployee === row.employee_id;
                    return (
                      <tr key={row.employee_id} onClick={() => { setSelectedEmployee(row.employee_id); setSelectedRecord(str(row.id)); setMobileDetail(true); }} className={`cursor-pointer hover:bg-secondary/40 ${current ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{row.employee_code} · {row.first_name} {row.last_name}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{row.position}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{row.location}</td>
                        <td className="px-3 py-3 text-xs tabular-nums">{row.effective_from}</td>
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
            {historyState.loading ? <p role="status" className="text-sm text-muted-foreground">Loading record detail…</p>
              : historyState.error ? (
                <div>
                  <p role="alert" className="text-sm font-semibold text-foreground">Record detail unavailable</p>
                  <p className="mt-1 text-xs text-muted-foreground">{historyState.error}</p>
                  <button type="button" onClick={historyState.refresh} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50">Try again</button>
                </div>
              )
              : !record ? <p className="text-sm text-muted-foreground">Select a record to view its controlled workflow, evidence and audit trail.</p>
              : (
                <div>
                  <SectionHeading
                    title="Record detail"
                    description={`${record.employee_code}`}
                    action={<StatusPill tone={assignmentTone(record.status)} dot>{assignmentLabel(record.status)}</StatusPill>}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Employee {record.employee_code} · {record.first_name} {record.last_name} · Department: {record.department} · Assignment: {record.position} · {record.location} · Position: {record.position}
                  </p>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">State timeline</p>
                    <ol className="mt-2 space-y-1.5">
                      {(["effective", "scheduled", "superseded"] as const).map((state, index) => (
                        <li key={state} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${record.status === state ? "border-primary/30 bg-primary/5 font-semibold text-foreground" : "border-border/60 text-muted-foreground"}`}>
                          <span className="grid size-5 place-items-center rounded-md bg-secondary font-mono text-[10px]">{index + 1}</span>
                          {assignmentLabel(state)}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">History ({history.length})</p>
                    <ol className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                      {history.map((item) => (
                        <li key={str(item.id)}>
                          <button type="button" onClick={() => setSelectedRecord(str(item.id))} className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${str(item.id) === str(record.id) ? "border-primary/30 bg-primary/5" : "border-border/60"}`}>
                            <span className="font-semibold">{item.effective_from} → {item.effective_to ?? "open"} · {item.position}</span>
                            <span className="mt-0.5 block text-muted-foreground">{item.reason ?? "No reason"}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Audit trail</p>
                    {historyAudit.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No audited events for this record yet.</p> : (
                      <ol className="mt-2 space-y-1.5">
                        {historyAudit.slice(0, 8).map((event) => (
                          <li key={str(event.id)} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                            <p className="font-semibold">{str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}</p>
                            <p className="mt-0.5 text-muted-foreground">{str(event.reason)} · {str(event.created_at).slice(0, 16).replace("T", " ")}</p>
                          </li>
                        ))}
                      </ol>
                    )}
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

/* ---------------- Statutory compliance ---------------- */

async function postForm(path: string, body: UnknownRecord): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: str(asRecord(payload.error).message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

function obligationStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (["filed", "complete", "completed", "accepted"].includes(status)) return "success";
  if (status === "scheduled") return "warning";
  if (status === "evidence_attached") return "info";
  return "neutral";
}

/** Stored amounts are minor units; nothing is ever printed raw. */
const MINOR_UNITS_PER_MAJOR = 100;
const PERCENT_BASE = 100;

function formatMinor(value: unknown): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return (parsed / MINOR_UNITS_PER_MAJOR).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percentOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const STATUTORY_TABS = [
  { id: "simulator", label: "50% Wage Floor Simulator" },
  { id: "obligations", label: "Statutory Obligations" },
  { id: "registers", label: "Factory Act Registers" },
  { id: "erp", label: "ERP Master Sync & GL Queue" },
  { id: "packs", label: "Statutory Rule Packs" },
] as const;

type WageFloorInputs = {
  grossMinor: number;
  basicMinor: number;
  dearnessMinor: number;
  hraMinor: number;
  specialMinor: number;
};

/** Opening structure for the simulator. These are input amounts, not statutory figures. */
const DEFAULT_STRUCTURE: WageFloorInputs = {
  grossMinor: 10_000_000,
  basicMinor: 3_000_000,
  dearnessMinor: 300_000,
  hraMinor: 1_200_000,
  specialMinor: 5_500_000,
};

const STRUCTURE_FIELDS = [
  { key: "grossMinor", label: "Total Monthly Gross", max: 50_000_000 },
  { key: "basicMinor", label: "Basic", max: 50_000_000 },
  { key: "dearnessMinor", label: "Dearness Allowance", max: 20_000_000 },
  { key: "hraMinor", label: "HRA", max: 20_000_000 },
  { key: "specialMinor", label: "Special Allowance", max: 30_000_000 },
] as const;

const SLIDER_STEP_MINOR = 50_000;

function AmountSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-xs font-semibold text-foreground">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-mono tabular-nums text-muted-foreground">₹ {formatMinor(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={SLIDER_STEP_MINOR}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
    </label>
  );
}

export function StatutoryCompliancePage() {
  const [tab, setTab] = useState<string>("simulator");
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formCode, setFormCode] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceItem, setEvidenceItem] = useState("");
  const [evidenceDoc, setEvidenceDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [structure, setStructure] = useState<WageFloorInputs>(DEFAULT_STRUCTURE);
  const [simulation, setSimulation] = useState<UnknownRecord | null>(null);
  const [simulationError, setSimulationError] = useState("");
  const [simulating, setSimulating] = useState(false);

  const obligationsState = useLive(`/api/v1/compliance/obligations${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  const evidenceState = useLive("/api/v1/compliance/evidence?pageSize=100");
  const formsState = useLive("/api/v1/compliance/forms");
  const filingsState = useLive("/api/v1/operations/filings?pageSize=100");
  const rulePackState = useLive("/api/v1/compliance/wage-floor");
  const obligations = useMemo(() => listFromEnvelope(obligationsState.data), [obligationsState.data]);
  const evidence = useMemo(() => listFromEnvelope(evidenceState.data), [evidenceState.data]);
  const forms = useMemo(() => listFromEnvelope(formsState.data), [formsState.data]);
  const filings = useMemo(() => listFromEnvelope(filingsState.data), [filingsState.data]);

  const rulePack = useMemo(() => asRecord(asRecord(rulePackState.data).data), [rulePackState.data]);
  const packCode = str(rulePack.packCode);
  const packVersion = str(rulePack.packVersion);
  const packEffectiveFrom = str(rulePack.effectiveFrom);
  const floorPercent = percentOrNull(rulePack.floorPercent);
  const storedRates = useMemo(() => listOf(rulePack.rates), [rulePack]);

  const scheduled = obligations.filter((row) => str(asRecord(row.attributes).status, "scheduled") === "scheduled").length;
  const withEvidence = obligations.filter((row) => str(asRecord(row.attributes).status) === "evidence_attached").length;

  // Live indicator, derived from the entered structure alone.
  const declaredBaseMinor = structure.basicMinor + structure.dearnessMinor;
  const basicDaPercent = structure.grossMinor > 0 ? (declaredBaseMinor / structure.grossMinor) * PERCENT_BASE : 0;
  const belowFloor = floorPercent !== null && structure.grossMinor > 0 && basicDaPercent < floorPercent;

  // Debounced simulation. With no stored floor there is nothing to compute
  // against, so the request is never made and the engine renders its
  // unconfigured state instead.
  useEffect(() => {
    if (floorPercent === null) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setSimulating(true);
        try {
          const response = await fetch("/api/v1/compliance/wage-floor", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(structure),
            cache: "no-store",
          });
          const payload = asRecord(await response.json().catch(() => null));
          if (cancelled) return;
          if (!response.ok) {
            setSimulation(null);
            setSimulationError(str(asRecord(payload.error).message, `The simulation could not be run (${response.status}).`));
          } else {
            setSimulationError("");
            setSimulation(asRecord(payload.data));
          }
        } catch {
          if (!cancelled) {
            setSimulation(null);
            setSimulationError("Could not reach the server.");
          }
        } finally {
          if (!cancelled) setSimulating(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [structure, floorPercent]);

  const result = useMemo(() => asRecord(asRecord(simulation).result), [simulation]);
  const resultLines = useMemo(() => listOf(result.lines), [result]);
  const hasResult = Object.keys(result).length > 0;

  async function createObligation() {
    if (!title.trim() || !dueDate) {
      setNotice("Enter an obligation title and due date.");
      return;
    }
    setBusy(true);
    setNotice("");
    const body: UnknownRecord = { title: title.trim(), dueDate };
    if (formCode.trim()) body.formCode = formCode.trim();
    if (notes.trim()) body.notes = notes.trim();
    const outcome = await postForm("/api/v1/compliance/obligations", body);
    setNotice(outcome.ok ? "Obligation scheduled." : outcome.message);
    if (outcome.ok) {
      setTitle("");
      setDueDate("");
      setFormCode("");
      setNotes("");
      obligationsState.refresh();
    }
    setBusy(false);
  }

  async function attachEvidence() {
    if (!evidenceItem.trim() || !evidenceDoc.trim()) {
      setNotice("Enter both an obligation item id and a document id.");
      return;
    }
    setBusy(true);
    setNotice("");
    const outcome = await postForm("/api/v1/compliance/evidence", { calendarItemId: evidenceItem.trim(), documentId: evidenceDoc.trim() });
    setNotice(outcome.ok ? "Evidence attached; obligation moved to evidence_attached." : outcome.message);
    if (outcome.ok) {
      setEvidenceItem("");
      setEvidenceDoc("");
      evidenceState.refresh();
      obligationsState.refresh();
    }
    setBusy(false);
  }

  const tabs = STATUTORY_TABS.map((entry) => ({
    ...entry,
    count: entry.id === "obligations" ? obligations.length : null,
  }));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageIntro
        eyebrow="Compliance · Labour Codes"
        title="Statutory Compliance Engine & 2026 Labour Codes Simulator"
        description="Engineered for the four Indian Labour Codes (Code on Wages, Social Security, Industrial Relations, OSH). Versioned, state-scoped rules with 50% wage floor simulation and a statutory obligation calendar."
        action={
          <span className="flex flex-wrap gap-2">
            <Link href="/document-vault" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">
              Audit Dossier <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setTab("simulator")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Run Simulator
            </button>
          </span>
        }
      />
      {notice && <p role="status" className="mb-4 rounded-lg border border-border bg-secondary/40 p-3 text-xs">{notice}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {rulePackState.loading ? (
          <span className="text-[11px] text-muted-foreground">Loading the active rule pack…</span>
        ) : packCode || packVersion ? (
          <>
            <StatusPill tone="success">Rule pack {packCode || "unnamed"}</StatusPill>
            {packVersion && <StatusPill tone="info">Version {packVersion}</StatusPill>}
            {packEffectiveFrom && <StatusPill tone="neutral">Effective {packEffectiveFrom}</StatusPill>}
          </>
        ) : (
          <StatusPill tone="warning">No rule pack is assigned to this tenant</StatusPill>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ModuleStat label="Obligations in view" value={obligationsState.loading ? null : obligations.length} />
        <ModuleStat label="Scheduled" value={obligationsState.loading ? null : scheduled} />
        <ModuleStat label="With evidence" value={obligationsState.loading ? null : withEvidence} />
        <ModuleStat label="Evidence records" value={evidenceState.loading ? null : evidence.length} />
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Statutory compliance sections" />

      <TabPanel id="simulator" active={tab}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading
              title="Salary Structure Inputs (Monthly)"
              description="Move a slider to restate the structure. Amounts are entered in rupees and held in minor units."
            />
            <div className="space-y-4">
              {STRUCTURE_FIELDS.map((field) => (
                <AmountSlider
                  key={field.key}
                  label={field.label}
                  max={field.max}
                  value={structure[field.key]}
                  onChange={(next) => setStructure((current) => ({ ...current, [field.key]: next }))}
                />
              ))}
            </div>
            <p
              className={`mt-5 rounded-xl border px-4 py-3 text-xs font-semibold ${
                belowFloor ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-secondary/30 text-foreground"
              }`}
            >
              Basic + DA: {basicDaPercent.toFixed(2)}%
              {floorPercent === null
                ? " · no stored wage floor to compare against"
                : belowFloor
                  ? ` · below the stored ${floorPercent}% floor — an add-back applies`
                  : ` · at or above the stored ${floorPercent}% floor`}
            </p>
          </Surface>

          <Surface>
            <SectionHeading
              title="Statutory Floor Add-Back Engine"
              description="Declared wage base against the statutory base, with one variance row per stored rate."
            />
            {floorPercent === null ? (
              <div className="rounded-xl border border-border bg-secondary/20 px-4 py-5">
                <p className="text-sm font-semibold text-foreground">No statutory rate pack is configured</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The wage floor and every contribution rate are statutory policy and are read from an approved rule pack.
                  None is stored for this tenant, so nothing is computed here — no percentage is assumed on your behalf.
                </p>
              </div>
            ) : simulationError ? (
              <p role="alert" className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs text-foreground">{simulationError}</p>
            ) : !hasResult ? (
              <p role="status" className="text-xs text-muted-foreground">{simulating ? "Running the simulation…" : "Waiting for the simulation to run…"}</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Declared wage base</p>
                    <p className="mt-1 font-mono text-lg tabular-nums text-foreground">₹ {formatMinor(result.declaredBaseMinor)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Statutory wage base</p>
                    <p className="mt-1 font-mono text-lg tabular-nums text-foreground">₹ {formatMinor(result.statutoryBaseMinor)}</p>
                  </div>
                </div>
                <p className={`mt-3 rounded-xl border px-4 py-3 text-xs font-semibold ${result.floorTriggered === true ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-secondary/30 text-foreground"}`}>
                  {result.floorTriggered === true
                    ? `Floor triggered — add-back of ₹ ${formatMinor(result.addBackMinor)} at ${floorPercent}% of gross.`
                    : "Floor not triggered — the declared base already meets the stored floor."}
                </p>
                {resultLines.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    The configured pack stores no contribution rates, so no variance rows can be produced.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[440px] text-left">
                      <thead>
                        <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3">Component</th>
                          <th className="py-2 pr-3 text-right">Pre-code</th>
                          <th className="py-2 pr-3 text-right">Post-code</th>
                          <th className="py-2 text-right">Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {resultLines.map((line, index) => (
                          <tr key={`${str(line.component)}-${index}`} className="text-xs">
                            <td className="py-2 pr-3 font-semibold text-foreground">{str(line.component, "Component")}</td>
                            <td className="py-2 pr-3 text-right font-mono tabular-nums">₹ {formatMinor(line.preCodeMinor)}</td>
                            <td className="py-2 pr-3 text-right font-mono tabular-nums">₹ {formatMinor(line.postCodeMinor)}</td>
                            <td className="py-2 text-right font-mono tabular-nums text-foreground">₹ {formatMinor(line.deltaMinor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">Rates applied: {str(result.rateSource, "none stored")}</p>
              </>
            )}
          </Surface>
        </div>
      </TabPanel>

      <TabPanel id="obligations" active={tab}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading title="Statutory obligation calendar" description="Filter by status; creation requires employee.write and an approved form code when linked." />
            <label className="mb-3 block max-w-xs text-xs font-semibold">Status filter
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="evidence_attached">Evidence attached</option>
                <option value="filed">Filed</option>
              </select>
            </label>
            <RegisterStates
              loading={obligationsState.loading}
              error={obligationsState.error}
              empty={!obligationsState.loading && !obligationsState.error && obligations.length === 0}
              onRetry={obligationsState.refresh}
              loadingLabel="Loading obligations…"
              errorTitle="Obligations unavailable"
              emptyTitle="No obligations in this view"
              emptyHint="Schedule the first obligation below, or widen the status filter."
            />
            {!obligationsState.loading && !obligationsState.error && obligations.length > 0 && (
              <ul className="max-h-[360px] space-y-2 overflow-y-auto">
                {obligations.slice(0, 50).map((row) => {
                  const attributes = asRecord(row.attributes);
                  const itemStatus = str(attributes.status, "scheduled");
                  return (
                    <li key={str(row.id)} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{str(attributes.title, "Obligation")}</span>
                        <StatusPill tone={obligationStatusTone(itemStatus)}>{itemStatus.replace(/_/g, " ")}</StatusPill>
                      </span>
                      <span className="mt-1 block text-muted-foreground">Due {str(attributes.due_date, "—")}{str(attributes.form_code) ? ` · Form ${str(attributes.form_code)}` : ""}</span>
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{str(row.id)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <SectionHeading title="Schedule obligation" description="Unapproved form codes are rejected with RULE_PACK_NOT_APPROVED." />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold">Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="PF monthly return" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                <label className="block text-xs font-semibold">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                <label className="block text-xs font-semibold">Form code (optional)<input value={formCode} onChange={(event) => setFormCode(event.target.value)} placeholder="Approved rule-pack code" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                <label className="block text-xs font-semibold">Notes (optional)<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Owner, jurisdiction…" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
              </div>
              <button type="button" onClick={() => void createObligation()} disabled={busy} className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Saving…" : "Schedule obligation"}</button>
            </div>
          </Surface>
          <Surface>
            <SectionHeading title="Evidence" description={evidenceState.loading ? "Loading…" : `${evidence.length} record(s). Attaching moves the obligation to evidence_attached.`} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Obligation item
                <select value={evidenceItem} onChange={(event) => setEvidenceItem(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs">
                  <option value="">Choose an obligation</option>
                  {obligations.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>{str(asRecord(row.attributes).title, String(row.id))}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">Document
                <ReferencePicker endpoint="/api/v1/documents" value={evidenceDoc} onChange={setEvidenceDoc} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs" />
              </label>
            </div>
            <button type="button" onClick={() => void attachEvidence()} disabled={busy} className="mt-3 h-10 rounded-xl border border-border px-4 text-xs font-bold hover:border-primary/50 disabled:opacity-60">{busy ? "Saving…" : "Attach evidence"}</button>
            <div className="mt-3">
              <Link href="/document-vault" className="text-xs font-semibold text-primary hover:underline">Find document ids in the vault →</Link>
            </div>
          </Surface>
        </div>
      </TabPanel>

      <TabPanel id="registers" active={tab}>
        <Surface className="p-0">
          <div className="border-b border-border p-4">
            <SectionHeading title="Factory Act registers" description="Statutory form instances generated under the Factories Rules and allied acts." />
          </div>
          <RegisterStates
            loading={formsState.loading}
            error={formsState.error}
            empty={!formsState.loading && !formsState.error && forms.length === 0}
            onRetry={formsState.refresh}
            loadingLabel="Loading statutory forms…"
            errorTitle="Statutory forms unavailable"
            emptyTitle="No statutory forms are generated yet"
            emptyHint="Form instances appear once an approved rule pack generates them."
          />
          {!formsState.loading && !formsState.error && forms.length > 0 && (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Form</th>
                    <th className="px-3 py-3">Act / rules</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Generated</th>
                    <th className="px-3 py-3">Filed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {forms.slice(0, 100).map((row) => {
                    const attributes = asRecord(row.attributes);
                    return (
                      <tr key={str(row.id)} className="text-xs">
                        <td className="px-4 py-3 font-semibold text-foreground">{str(attributes.form_name, str(attributes.code, "Statutory form"))}</td>
                        <td className="px-3 py-3 text-muted-foreground">{str(attributes.act, "—")}</td>
                        <td className="px-3 py-3 text-muted-foreground">{str(attributes.state, "—")}</td>
                        <td className="px-3 py-3 text-muted-foreground">{str(attributes.period, "—")}</td>
                        <td className="px-3 py-3 text-muted-foreground">{str(attributes.generated_on, "—")}</td>
                        <td className="px-3 py-3">
                          {str(attributes.filed_on) ? <StatusPill tone="success">{str(attributes.filed_on)}</StatusPill> : <StatusPill tone="warning">Open</StatusPill>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="erp" active={tab}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading title="ERP master sync & GL queue" description="Statutory filings queued through the governed workflow before they reach the general ledger." />
            {filingsState.loading ? (
              <p role="status" className="text-sm text-muted-foreground">Loading filings…</p>
            ) : filingsState.error ? (
              <p role="alert" className="text-sm text-destructive">{filingsState.error}</p>
            ) : (
              <p className="text-sm text-foreground">{filings.length} filing record(s) in the statutory workflow.</p>
            )}
            <Link href="/statutory?section=operations%2Ffilings" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Open filing register →</Link>
          </Surface>
          <Surface>
            <SectionHeading title="Posting contract" description="What crosses into the ERP, and what stays here." />
            <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
              <li className="rounded-xl border border-border/60 px-3 py-2">Only filings that reached an approved state are eligible to post.</li>
              <li className="rounded-xl border border-border/60 px-3 py-2">Every posted line carries its acknowledgement reference back into the audit dossier.</li>
              <li className="rounded-xl border border-border/60 px-3 py-2">Simulated wage-floor figures are never posted; the simulator is an analysis surface.</li>
            </ul>
          </Surface>
        </div>
      </TabPanel>

      <TabPanel id="packs" active={tab}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Surface>
            <SectionHeading title="Active rule pack" description="Versioned, state-scoped statutory rules. Designer-provided formulas are never treated as legally approved." />
            {rulePackState.loading ? (
              <p role="status" className="text-sm text-muted-foreground">Loading the rule pack…</p>
            ) : rulePackState.error ? (
              <p role="alert" className="text-sm text-destructive">{rulePackState.error}</p>
            ) : (
              <dl className="grid gap-2 text-xs">
                <div className="flex justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><dt className="shrink-0 text-muted-foreground">Pack code</dt><dd className="min-w-0 break-words text-right font-semibold text-foreground">{packCode || "Not assigned"}</dd></div>
                <div className="flex justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><dt className="shrink-0 text-muted-foreground">Version</dt><dd className="min-w-0 break-words text-right font-semibold text-foreground">{packVersion || "Not assigned"}</dd></div>
                <div className="flex justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><dt className="shrink-0 text-muted-foreground">Effective from</dt><dd className="min-w-0 break-words text-right font-semibold text-foreground">{packEffectiveFrom || "Not recorded"}</dd></div>
                <div className="flex justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"><dt className="shrink-0 text-muted-foreground">Wage floor</dt><dd className="min-w-0 break-words text-right font-semibold text-foreground">{floorPercent === null ? "Not configured" : `${floorPercent}% of gross`}</dd></div>
              </dl>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-bold text-foreground">Stored contribution rates</p>
              {storedRates.length === 0 ? (
                <p className="mt-2 rounded-xl border border-border bg-secondary/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  No statutory rate pack is configured. Rates such as provident fund and gratuity are statutory policy and must be
                  loaded as approved rule-pack rows before the engine will compute anything.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {storedRates.map((rate, index) => (
                    <li key={`${str(rate.code)}-${index}`} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{str(rate.label, str(rate.code, "Rate"))}</span>
                        <StatusPill tone="info">{percentOrNull(rate.percent) === null ? "Formula" : `${numberOr(rate.percent, 0)}%`}</StatusPill>
                      </span>
                      <span className="mt-1 block text-muted-foreground">{str(rate.formula, "No formula recorded")}{str(rate.appliesTo) ? ` · applies to ${str(rate.appliesTo)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Surface>
          <Surface>
            <SectionHeading title="Approved form codes" description="Form codes come from the global statutory form pack; unapproved codes stay unavailable." />
            {formsState.loading ? <p role="status" className="text-sm text-muted-foreground">Loading forms…</p>
              : formsState.error ? <p role="alert" className="text-sm text-destructive">{formsState.error}</p>
              : forms.length === 0 ? <p className="text-sm text-muted-foreground">No approved rule packs yet — obligation form codes stay unavailable until approved.</p>
              : <div className="flex flex-wrap gap-1.5">{forms.slice(0, 20).map((row) => <StatusPill key={str(row.id)} tone="success">{str(asRecord(row.attributes).code, str(asRecord(row.attributes).form_instance, str(row.id).slice(0, 8)))}</StatusPill>)}</div>}
          </Surface>
        </div>
      </TabPanel>
    </div>
  );
}

/* ---------------- Access scope administration ---------------- */

type AccessGrant = {
  id: string;
  membership_id: string;
  member_name: string;
  member_email: string;
  employee_code: string | null;
  role_id: string;
  role_code: string;
  role_name: string;
  effective_from: string;
  effective_to: string | null;
  revoked_at: string | null;
  status: "active" | "scheduled" | "revoked";
};

function scopeTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "active") return "success";
  if (status === "scheduled") return "info";
  if (status === "revoked") return "neutral";
  return "neutral";
}

function useScopedLive(path: string) {
  const [entry, setEntry] = useState<{ path: string; value: unknown } | null>(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (!cancelled) {
          setEntry({ path, value });
          setError("");
          setForbidden(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "This data could not be loaded.");
          setForbidden(caught instanceof ApiGetError && caught.status === 403);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);
  const data = entry && entry.path === path ? entry.value : null;
  return {
    data,
    loading: Boolean(path) && data === null && !error,
    error,
    forbidden,
    refresh: () => setTick((current) => current + 1),
  };
}

async function postScope(path: string, body: UnknownRecord, method: "POST" | "PUT" = "POST"): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: str(asRecord(payload.error).message, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

/**
 * Role & Data Scope Setup (F-SEC-01), the configuration behind RL-24.
 *
 * A role's scope dimension and the values on it decide WHICH employees its salary and rate
 * permissions reach. The two structure flags can only take access away: a role with no scope
 * row here is unscoped and behaves exactly as its permissions alone say.
 */
type RoleDataScope = {
  roleCode: string;
  roleName: string | null;
  scopeDimension: string;
  scopeValues: string[];
  canViewSalaryStructure: boolean;
  canViewRateStructure: boolean;
  configured: boolean;
  availableValues: string[];
};

const SCOPE_DIMENSION_LABELS: Record<string, string> = {
  attendance_location: "Attendance location",
  payroll_location: "Payroll processing location",
};

function toRoleDataScopes(payload: unknown): RoleDataScope[] {
  return listFromEnvelope(payload)
    .map((row) => ({
      roleCode: str(row.roleCode),
      roleName: str(row.roleName) || null,
      scopeDimension: str(row.scopeDimension, "attendance_location"),
      scopeValues: Array.isArray(row.scopeValues) ? (row.scopeValues as unknown[]).map((value) => str(value)) : [],
      canViewSalaryStructure: row.canViewSalaryStructure === true,
      canViewRateStructure: row.canViewRateStructure === true,
      configured: row.configured === true,
      availableValues: Array.isArray(row.availableValues) ? (row.availableValues as unknown[]).map((value) => str(value)) : [],
    }))
    .filter((row) => row.roleCode);
}

function RoleDataScopePanel() {
  const scopesState = useScopedLive("/api/v1/organization/data-scopes");
  const scopes = useMemo(() => toRoleDataScopes(scopesState.data), [scopesState.data]);
  const [editing, setEditing] = useState("");
  const [dimension, setDimension] = useState("attendance_location");
  const [values, setValues] = useState<string[]>([]);
  const [salary, setSalary] = useState(false);
  const [rate, setRate] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const current = scopes.find((row) => row.roleCode === editing) ?? null;

  function open(scope: RoleDataScope) {
    setEditing(scope.roleCode);
    setDimension(scope.scopeDimension);
    setValues(scope.scopeValues);
    setSalary(scope.canViewSalaryStructure);
    setRate(scope.canViewRateStructure);
    setReason("");
    setNotice("");
  }

  async function save() {
    if (!editing || reason.trim().length < 3) {
      setNotice("Give a reason of at least 3 characters; every scope change is audited.");
      return;
    }
    setBusy(true);
    const outcome = await postScope("/api/v1/organization/data-scopes", {
      roleCode: editing,
      scopeDimension: dimension,
      scopeValues: values,
      canViewSalaryStructure: salary,
      canViewRateStructure: rate,
      reason: reason.trim(),
    }, "PUT");
    setNotice(outcome.ok ? "Scope saved. It applies on the role holder's next request." : outcome.message);
    if (outcome.ok) {
      setEditing("");
      scopesState.refresh();
    }
    setBusy(false);
  }

  if (scopesState.forbidden) return null;

  return (
    <Surface className="mt-6">
      <SectionHeading
        title="Role data scope · F-SEC-01"
        description="Which employees each role's salary and rate permissions reach. A role with no scope is unscoped; an empty value list scopes it to nothing."
      />
      {notice && <p role="status" className="mb-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs">{notice}</p>}
      {scopesState.loading ? <p role="status" className="text-sm text-muted-foreground">Loading role scopes…</p>
        : scopesState.error ? <p role="alert" className="text-sm text-destructive">{scopesState.error}</p>
        : scopes.length === 0 ? <p className="text-sm text-muted-foreground">No active roles to scope.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">Scope dimension</th><th className="px-3 py-2 font-medium">Values</th><th className="px-3 py-2 font-medium">Salary</th><th className="px-3 py-2 font-medium">Rate</th><th className="px-3 py-2" /></tr></thead>
              <tbody>
                {scopes.map((scope) => (
                  <tr key={scope.roleCode} className="border-t border-border/60">
                    <td className="px-3 py-2"><p className="font-semibold">{scope.roleCode}</p><p className="text-[11px] text-muted-foreground">{scope.roleName ?? ""}</p></td>
                    <td className="px-3 py-2 text-xs">{SCOPE_DIMENSION_LABELS[scope.scopeDimension] ?? scope.scopeDimension}</td>
                    <td className="px-3 py-2 text-xs">{scope.configured ? (scope.scopeValues.join(", ") || "None — sees no salary") : "Unscoped"}</td>
                    <td className="px-3 py-2 text-xs">{scope.canViewSalaryStructure ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-xs">{scope.canViewRateStructure ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => open(scope)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {current && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground">Scope for {current.roleCode}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold">Scope dimension
              <select value={dimension} onChange={(event) => { setDimension(event.target.value); setValues([]); }} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                {Object.entries(SCOPE_DIMENSION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Scope values (the sites this role may see)
              <select
                multiple
                value={values}
                onChange={(event) => setValues([...event.target.selectedOptions].map((option) => option.value))}
                className="mt-1.5 min-h-[88px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {current.availableValues.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={salary} onChange={(event) => setSalary(event.target.checked)} /> Can view salary structure</label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={rate} onChange={(event) => setRate(event.target.checked)} /> Can view rate structure</label>
            <label className="block text-xs font-semibold sm:col-span-2">Reason (audited)<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this role scoped this way?" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Saving…" : "Save scope"}</button>
            <button type="button" onClick={() => setEditing("")} className="h-10 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">Cancel</button>
          </div>
        </div>
      )}
    </Surface>
  );
}

export function AccessScopeAdministrationPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  // Phones show the queue or the open grant, never both squeezed side by side.
  // From `md` both columns render and this flag is ignored.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const scopesState = useScopedLive("/api/v1/access-scopes?pageSize=100");
  const membersState = useScopedLive("/api/v1/memberships");
  const rolesState = useScopedLive("/api/v1/roles");
  const grants = useMemo(() => listFromEnvelope(scopesState.data).filter((row) => str(row.id)) as unknown as AccessGrant[], [scopesState.data]);
  const members = useMemo(() => {
    const data = asRecord(membersState.data).data;
    return Array.isArray(data) ? (data as UnknownRecord[]) : [];
  }, [membersState.data]);
  const roles = useMemo(() => {
    const data = asRecord(rolesState.data).data;
    return Array.isArray(data) ? (data as UnknownRecord[]) : [];
  }, [rolesState.data]);
  const canGrant = !membersState.forbidden && !rolesState.forbidden;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return grants.filter((grant) => {
      if (statusFilter && grant.status !== statusFilter) return false;
      if (!needle) return true;
      return [grant.member_name, grant.member_email, grant.employee_code ?? "", grant.role_code, grant.role_name].join(" ").toLowerCase().includes(needle);
    });
  }, [grants, statusFilter, query]);

  const selected = (selectedId ? filtered.find((grant) => grant.id === selectedId) : undefined) ?? filtered[0] ?? null;
  const detailState = useScopedLive(selected ? `/api/v1/access-scopes/${encodeURIComponent(selected.id)}` : "");
  const detail = asRecord(asRecord(detailState.data).data);
  const auditTrail = useMemo(() => {
    const trail = detail.auditTrail;
    return Array.isArray(trail) ? (trail as UnknownRecord[]) : [];
  }, [detail]);

  const active = grants.filter((grant) => grant.status === "active").length;
  const scheduled = grants.filter((grant) => grant.status === "scheduled").length;
  const revoked = grants.filter((grant) => grant.status === "revoked").length;

  async function grantScope() {
    if (!memberId || !roleCode || !effectiveFrom || grantReason.trim().length < 3) {
      setNotice("Choose a principal and role, set the effective date, and give a reason (min 3 characters).");
      return;
    }
    setBusy(true);
    setNotice("");
    const body: UnknownRecord = { membershipId: memberId, roleCodes: [roleCode], effectiveFrom, reason: grantReason.trim() };
    if (effectiveTo) body.effectiveTo = effectiveTo;
    const outcome = await postScope("/api/v1/access-scopes", body);
    setNotice(outcome.ok ? "Scope granted. Scheduled grants activate on their effective date." : outcome.message);
    if (outcome.ok) {
      setGrantOpen(false);
      setMemberId("");
      setRoleCode("");
      setEffectiveTo("");
      setGrantReason("");
      scopesState.refresh();
    }
    setBusy(false);
  }

  async function revokeScope() {
    if (!selected || revokeReason.trim().length < 3) {
      setNotice("A reason (min 3 characters) is required to revoke a scope.");
      return;
    }
    setBusy(true);
    setNotice("");
    const outcome = await postScope(`/api/v1/access-scopes/${encodeURIComponent(selected.id)}/revoke`, { reason: revokeReason.trim() });
    setNotice(outcome.ok ? "Scope revoked. The principal loses this role immediately." : outcome.message);
    if (outcome.ok) {
      setRevokeReason("");
      scopesState.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageIntro
        eyebrow="People Core · SCR-005"
        title="Access scope administration"
        description="Manage access scope administration with a scoped work queue, record history and controlled actions."
        action={
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => scopesState.refresh()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50">Refresh</button>
            {canGrant && <button type="button" onClick={() => setGrantOpen((open) => !open)} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">Grant scope</button>}
          </span>
        }
      />
      {notice && <p role="status" className="mb-4 rounded-lg border border-border bg-secondary/40 p-3 text-xs">{notice}</p>}

      <Surface className="mb-4">
        <SectionHeading title="Process guide · SCR-005" description="Grant a role scope with an effective date → it activates automatically (Scheduled → Active) → revoke ends it immediately. Every step is audited." />
      </Surface>

      <RoleDataScopePanel />

      <Surface className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line. Without scope management rights you see only your own grants.</p>
          <Link href="/people" className="text-xs font-semibold text-primary hover:underline">Open people core</Link>
        </div>
      </Surface>

      {scopesState.forbidden ? (
        <Surface className="p-5 text-center">
          <p className="text-sm font-semibold text-foreground">No access to scope records</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">This role cannot list access scopes. Request membership management rights via Settings.</p>
        </Surface>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Active scopes", active], ["Scheduled", scheduled], ["Revoked", revoked]].map(([label, value]) => (
              <Surface key={label} className="p-4">
                <p className="text-2xl font-semibold tabular-nums">{scopesState.loading ? "—" : value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </Surface>
            ))}
          </div>

          {grantOpen && canGrant && (
            <Surface className="mt-6">
              <SectionHeading title="Grant scope" description="Overlapping active grants for the same member and role are rejected with SCOPE_OVERLAP." />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold">Principal (member)
                  <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Grant principal">
                    <option value="">Select member…</option>
                    {members.map((row) => <option key={str(row.id)} value={str(row.id)}>{str(row.name)} · {str(row.email)}{str(row.employee_code) ? ` · ${str(row.employee_code)}` : ""}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold">Role template
                  <select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Grant role">
                    <option value="">Select role…</option>
                    {roles.filter((row) => str(row.status) === "active").map((row) => <option key={str(row.id)} value={str(row.code)}>{str(row.code)} — {str(row.name)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold">Effective from<input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                <label className="block text-xs font-semibold">Effective to (optional)<input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                <label className="block text-xs font-semibold sm:col-span-2">Reason (audited)<input value={grantReason} onChange={(event) => setGrantReason(event.target.value)} placeholder="Why is this scope needed?" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
              </div>
              <button type="button" onClick={() => void grantScope()} disabled={busy} className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Granting…" : "Grant scope"}</button>
            </Surface>
          )}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Surface className={`p-0 ${mobileDetail ? "hidden md:block" : ""}`}>
              <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold">Status
                  <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedId(""); }} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold sm:col-span-2">Search
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Principal, email, role…" aria-label="Search scopes" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
                </label>
              </div>
              <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">{scopesState.loading ? "Loading…" : `${filtered.length} record(s) in the current scope`}</p>
              {scopesState.loading ? <p role="status" className="p-5 text-sm text-muted-foreground">Loading work queue…</p>
                : scopesState.error ? <p role="alert" className="p-5 text-sm text-destructive">{scopesState.error}</p>
                : filtered.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No scopes in this view. Grant the first scope above.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead><tr className="text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Principal</th><th className="px-3 py-3 font-medium">Scope</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Effective from</th><th className="px-4 py-3" /></tr></thead>
                      <tbody>
                        {filtered.map((grant) => {
                          const activeRow = selected && selected.id === grant.id;
                          return (
                            <tr key={grant.id} onClick={() => { setSelectedId(grant.id); setMobileDetail(true); }} className={`cursor-pointer border-t border-border/60 hover:bg-secondary/40 ${activeRow ? "bg-primary/5" : ""}`}>
                              <td className="px-4 py-3"><p className="font-semibold">{grant.member_name}</p><p className="text-[11px] text-muted-foreground">{grant.employee_code ?? grant.member_email}</p></td>
                              <td className="px-3 py-3 text-xs font-medium">{grant.role_code}</td>
                              <td className="px-3 py-3"><StatusPill tone={scopeTone(grant.status)} dot>{grant.status}</StatusPill></td>
                              <td className="px-3 py-3 text-xs tabular-nums">{grant.effective_from}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">›</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
              {!selected ? <p className="text-sm text-muted-foreground">Select a record to view its controlled workflow, evidence and audit trail.</p> : (
                <div>
                  <SectionHeading
                    title="Record detail"
                    description={`${selected.member_name} · ${selected.role_code}`}
                    action={<StatusPill tone={scopeTone(selected.status)} dot>{selected.status}</StatusPill>}
                  />
                  <dl className="grid gap-2 text-xs">
                    {[["Principal", `${selected.member_name} (${selected.member_email})`], ["Scope", `${selected.role_code} — ${selected.role_name}`], ["Effective", `${selected.effective_from} → ${selected.effective_to ?? "open"}`]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                        <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                        <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">State timeline</p>
                    <ol className="mt-2 space-y-1.5">
                      {(["active", "scheduled", "revoked"] as const).map((state, index) => (
                        <li key={state} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${selected.status === state ? "border-primary/30 bg-primary/5 font-semibold text-foreground" : "border-border/60 text-muted-foreground"}`}>
                          <span className="grid size-5 place-items-center rounded-md bg-secondary font-mono text-[10px]">{index + 1}</span>{state[0]?.toUpperCase()}{state.slice(1)}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-foreground">Audit trail</p>
                    {detailState.loading ? <p role="status" className="mt-1 text-xs text-muted-foreground">Loading audit trail…</p>
                      : auditTrail.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No audited events for this record yet.</p>
                      : (
                        <ol className="mt-2 space-y-1.5">
                          {auditTrail.slice(0, 8).map((event) => (
                            <li key={str(event.id)} className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                              <p className="font-semibold">{str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}</p>
                              <p className="mt-0.5 text-muted-foreground">{str(event.reason)} · {str(event.created_at).slice(0, 16).replace("T", " ")}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                  </div>
                  {canGrant && selected.status !== "revoked" && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-xs font-bold text-foreground">Revoke scope</p>
                      <label className="mt-2 block text-xs font-semibold">Reason (audited)<input value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Why is this scope ending?" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
                      <button type="button" onClick={() => void revokeScope()} disabled={busy} className="mt-2 h-10 rounded-xl border border-destructive/30 px-4 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-60">{busy ? "Revoking…" : "Revoke scope"}</button>
                    </div>
                  )}
                  <p className="mt-4 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">Configuration · Rules and permissions are evaluated by the active module contract.</p>
                </div>
              )}
            </Surface>
          </div>
        </>
      )}
    </div>
  );
}
