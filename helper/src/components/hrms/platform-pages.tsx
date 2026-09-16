"use client";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Fingerprint,
  LockKeyhole,
  Moon,
  Plus,
  Send,
  Sparkles,
  Sun,
} from "lucide-react";
import { ApprovalInbox } from "./approval-inbox";
import { ErpFieldOwnershipPanel, ErpSyncQueuePanel } from "./erp-integration-page";
import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { getJson } from "@/lib/client-api";
import { picklists } from "@/lib/picklists";
import {
  AiLabel,
  AvatarMark,
  PageIntro,
  SectionHeading,
  StatusPill,
  Surface,
} from "./page-primitives";
import { ReferencePicker } from "./register-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function listOf(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is UnknownRecord => typeof item === "object" && item !== null);
}

function attrsOf(item: UnknownRecord): UnknownRecord {
  return asRecord(item.attributes);
}

function shortId(value: unknown): string {
  const raw = str(value);
  if (!raw) return "—";
  return raw.length > 8 ? `${raw.slice(0, 8)}…` : raw;
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatDateTime(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return "";
  const parsed = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

async function errorDetail(response: Response, path: string): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    const err = asRecord(body).error;
    if (typeof err === "string" && err) return err;
    const rec = asRecord(err);
    const message = str(rec.message);
    const code = str(rec.code);
    if (message) return code ? `${code}: ${message}` : message;
    return `Request failed (${response.status}): ${path}`;
  } catch {
    return `Request failed (${response.status}): ${path}`;
  }
}

async function postJson(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body === undefined ? null : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, path));
  }
  return (await response.json().catch(() => null)) as unknown;
}

async function patchJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, path));
  }
  return (await response.json().catch(() => null)) as unknown;
}

function LoadingNote() {
  return <p className="py-6 text-center font-mono text-xs text-muted-foreground">Loading…</p>;
}

function ErrorNote({ message }: { message: string }) {
  return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{message}</p>;
}

function EmptyNote({ message }: { message: string }) {
  return <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{message}</p>;
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 shrink-0 rounded-lg text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-foreground">
      {label}
      <span className="mt-1.5 block font-normal">{children}</span>
      {hint ? <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function FormStatus({ error, success }: { error: string; success: string }) {
  if (error) return <p className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground">{error}</p>;
  if (success) return <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">{success}</p>;
  return null;
}

type InboxItem = { id: string; title: string; body: string; eventType: string; read: boolean; createdAt: string };

export function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const body = await getJson("/api/v1/notifications");
        const payload = asRecord(asRecord(body).data);
        const parsed: InboxItem[] = listOf(payload.items).map((item, index) => {
          const attrs = attrsOf(item);
          return {
            id: str(item.id, `notification-${index}`),
            title: str(attrs.title, "Notification"),
            body: str(attrs.body),
            eventType: str(attrs.event_type, "general"),
            read: attrs.read === true || str(attrs.read) === "true",
            createdAt: str(item.created_at),
          };
        });
        if (!cancelled) {
          setItems(parsed);
          setUnread(Number(asRecord(payload).unread) || parsed.filter((item) => !item.read).length);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markRead(id: string) {
    setActingId(id);
    setActionError("");
    try {
      await postJson(`/api/v1/notifications/${encodeURIComponent(id)}/read`);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnread((count) => Math.max(0, count - 1));
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not mark the notification as read.");
    } finally {
      setActingId("");
    }
  }

  const remaining = items.filter((item) => !item.read).length;
  const done = items.length - remaining;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Unified Work Queue"
        title="One inbox. Clear decisions."
        description="Review your workspace notifications and pending updates."
      />

      <ApprovalInbox />
      <div className="grid gap-6 lg:grid-cols-[1fr_.35fr]">
        <Surface>
          <SectionHeading
            title="Attention Queue"
            description={loading ? "Loading…" : error ? error : `${remaining} ${remaining === 1 ? "action remains" : "actions remain"}`}
            action={<StatusPill tone={unread > 0 ? "warning" : "success"}>{loading ? "Loading…" : `${unread} unread`}</StatusPill>}
          />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : items.length === 0 ? (
            <EmptyNote message="No notifications yet. Items appear here as activity is fanned out to your membership." />
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04 }}
                  className={`flex items-center gap-3.5 rounded-2xl border p-4 transition ${
                    item.read
                      ? "border-transparent bg-secondary/30 opacity-60"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <AvatarMark initials={initialsOf(item.title)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-sm text-foreground">{item.title}</p>
                      <StatusPill>{item.eventType}</StatusPill>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {item.body || `Notification ${shortId(item.id)}`}
                      {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={item.read ? "outline" : "default"}
                    className="h-10 sm:h-8 rounded-lg text-xs font-semibold"
                    disabled={item.read || actingId === item.id}
                    onClick={() => void markRead(item.id)}
                  >
                    {item.read ? <Check className="size-3.5 mr-1" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                    {actingId === item.id ? "Saving…" : item.read ? "Done" : "Complete"}
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
          {actionError ? <p className="mt-3 text-xs text-muted-foreground">{actionError}</p> : null}
        </Surface>

        <Surface className="h-fit border-primary/30 bg-card">
          <AiLabel>Focus Mode Active</AiLabel>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            {loading ? "Loading…" : `${done} of ${items.length} complete.`}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Progress is computed from live read states — completing an item calls POST
            Mark notifications as read after reviewing them.
          </p>
          <div className="mt-5 h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: items.length === 0 ? "0%" : `${(done / items.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-right font-mono text-xs text-muted-foreground">
            {done}/{items.length} complete
          </p>
        </Surface>
      </div>
    </div>
  );
}

type ChatMessage = { role: "assistant" | "user"; text: string; sources?: string[] };

const SUGGESTED_PROMPTS = [
  "What leave rules apply to my request?",
  "How are overtime anomalies verified?",
  "Which statutory registers must stay audit-ready?",
  "Draft manager guidance for quarterly check-ins",
];

export function AssistantPage() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Good day. I am Nucleus AI, your HR & policy copilot. I answer only from approved policy passages and never execute consequential actions. How can I assist you?",
    },
  ]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setBusy(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const result = (await response.json().catch(() => null)) as { answer?: string; sources?: string[]; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? `Assistant request failed (${response.status}).`);
      setMessages((current) => [...current, {
        role: "assistant",
        text: result?.answer ?? "The analysis completed without a publishable answer.",
        sources: Array.isArray(result?.sources) ? result.sources : undefined,
      }]);
    } catch (caught) {
      setMessages((current) => [...current, {
        role: "assistant",
        text: caught instanceof Error ? caught.message : "Nucleus AI is temporarily unavailable. No action was executed.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full min-w-0 min-h-[calc(100vh-84px)] max-w-[1400px] flex-col">
      <PageIntro
        eyebrow="Nucleus AI · Governed HR Copilot"
        title="Ask with confidence."
        description="Live answers grounded in approved company policies with citations."
      />

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_.34fr]">
        <Surface className="flex min-h-[580px] flex-col p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-foreground">Nucleus AI</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  LangGraph Agent · Evidence Grounded
                </p>
              </div>
            </div>
            <StatusPill tone={busy ? "warning" : "success"} dot>{busy ? "Working" : "Ready"}</StatusPill>
          </div>

          <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto py-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "border border-border/80 bg-secondary/40 text-foreground"
                  }`}
                >
                  <p>{message.text}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                      {message.sources.map((source) => (
                        <span
                          key={source}
                          className="rounded-md border border-border/70 bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          <FileText className="mr-1 inline size-3" />
                          {source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="w-fit rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 font-mono text-xs text-primary animate-pulse">
                Nucleus AI is retrieving policy traces & calculating invariants…
              </div>
            )}
          </div>

          <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border/80 pt-4">
            <Input
              aria-label="Message Nucleus AI"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about leave rules, overtime policy, or statutory registers…"
              className="h-11 rounded-xl border-border bg-secondary/30 px-4 text-xs focus:border-primary"
            />
            <Button
              type="submit"
              aria-label="Send message"
              disabled={busy || !input.trim()}
              className="size-11 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </Surface>

        <div className="space-y-4">
          <Surface className="border-primary/20 bg-card">
            <AiLabel>Suggested Queries</AiLabel>
            <div className="mt-4 space-y-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/30 p-3 text-left text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary/60"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </Surface>

          <Surface>
            <SectionHeading title="Trust & Safety Invariants" description="Applied to every response" />
            <div className="space-y-3 font-mono text-xs">
              {[
                [LockKeyhole, "Role-scoped RLS projection"],
                [FileCheck2, "Mandatory verifiable citations"],
                [Fingerprint, "Salary & PII masked by default"],
              ].map(([Icon, label]) => {
                const Glyph = Icon as typeof LockKeyhole;
                return (
                  <div key={String(label)} className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Glyph className="size-4" />
                    </div>
                    <p className="font-medium text-foreground">{String(label)}</p>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

type Obligation = { id: string; title: string; formCode: string; dueDate: string; status: string };

export function CompliancePage() {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"obligation" | "evidence" | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [oblTitle, setOblTitle] = useState("");
  const [oblAct, setOblAct] = useState("");
  const [oblAuthority, setOblAuthority] = useState("");
  const [oblEntityCode, setOblEntityCode] = useState("");
  const [oblLocationCode, setOblLocationCode] = useState("");
  const [oblFrequency, setOblFrequency] = useState<string>("monthly");
  const [oblOwnerId, setOblOwnerId] = useState("");
  const [oblForm, setOblForm] = useState("");
  const [oblDue, setOblDue] = useState("");
  const [oblNotes, setOblNotes] = useState("");
  const [evCalendarId, setEvCalendarId] = useState("");
  const [evDocumentId, setEvDocumentId] = useState("");
  const [evNote, setEvNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const body = await getJson("/api/v1/compliance/obligations");
        const parsed: Obligation[] = listOf(asRecord(body).data).map((item, index) => {
          const attrs = attrsOf(item);
          return {
            id: str(item.id, `obligation-${index}`),
            title: str(attrs.title, "Untitled obligation"),
            formCode: str(attrs.form_code, str(attrs.code)),
            dueDate: str(attrs.due_date, str(attrs.due_on, str(attrs.dueDate))),
            status: str(attrs.status, "unknown"),
          };
        });
        if (!cancelled) {
          setObligations(parsed);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Compliance data could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function openObligation() {
    setMode("obligation");
    setFormError("");
    setFormSuccess("");
  }

  function openEvidence(obligationId: string) {
    setMode("evidence");
    setEvidenceTarget(obligationId);
    setEvCalendarId(obligationId);
    setFormError("");
    setFormSuccess("");
  }

  async function submitObligation(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    if (!oblTitle.trim()) {
      setFormError("A title is required.");
      return;
    }
    if (!DATE_RE.test(oblDue.trim())) {
      setFormError("Due date must use YYYY-MM-DD.");
      return;
    }
    if (!oblAct.trim() || !oblAuthority.trim()) {
      setFormError("The act and the authority are required: applicability is derived from them.");
      return;
    }
    if (!oblEntityCode.trim() || !oblLocationCode.trim()) {
      setFormError("The legal entity and location are required; an obligation applies to one of each.");
      return;
    }
    if (!oblForm.trim()) {
      setFormError("A form reference is required: an obligation is filed on a form.");
      return;
    }
    if (!isUuid(oblOwnerId)) {
      setFormError("An owner is required, as the employee id of an active principal.");
      return;
    }
    setSaving(true);
    try {
      const body: UnknownRecord = {
        title: oblTitle.trim(),
        act: oblAct.trim(),
        authority: oblAuthority.trim(),
        entityCode: oblEntityCode.trim(),
        locationCode: oblLocationCode.trim(),
        frequency: oblFrequency,
        ownerEmployeeId: oblOwnerId.trim(),
        formCode: oblForm.trim(),
        dueDate: oblDue.trim(),
      };
      if (oblNotes.trim()) body.notes = oblNotes.trim();
      await postJson("/api/v1/compliance/obligations", body);
      setFormSuccess("Obligation scheduled. The register below has been refreshed.");
      setOblTitle("");
      setOblAct("");
      setOblAuthority("");
      setOblEntityCode("");
      setOblLocationCode("");
      setOblOwnerId("");
      setOblDue("");
      setOblNotes("");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The obligation could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    if (!isUuid(evCalendarId)) {
      setFormError("Calendar item id must be a valid UUID.");
      return;
    }
    if (!isUuid(evDocumentId)) {
      setFormError("Document id must be a valid UUID from an uploaded document.");
      return;
    }
    setSaving(true);
    try {
      const body: UnknownRecord = { calendarItemId: evCalendarId.trim(), documentId: evDocumentId.trim() };
      if (evNote.trim()) body.note = evNote.trim();
      await postJson("/api/v1/compliance/evidence", body);
      setFormSuccess("Evidence attached. The obligation now shows evidence_attached on refresh.");
      setEvDocumentId("");
      setEvNote("");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The evidence could not be attached.");
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  const dueSoon = obligations.filter((obligation) => {
    if (!obligation.dueDate) return false;
    const parsed = new Date(obligation.dueDate.length <= 10 ? `${obligation.dueDate}T00:00:00` : obligation.dueDate);
    return !Number.isNaN(parsed.getTime()) && parsed <= horizon;
  }).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Statutory Command Center · Live Obligations"
        title="Compliance, continuously ready."
        description="Track statutory obligations and attach evidence to each calendar item."
        action={
          <Button onClick={openObligation} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4 mr-1.5" /> New Obligation
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 font-mono">
        {[
          ["Tracked Obligations", loading ? "Loading…" : error ? "—" : String(obligations.length), "Current compliance calendar"],
          ["Due In 30 Days", loading ? "Loading…" : error ? "—" : String(dueSoon), "By live due dates"],
          ["Statutory Forms", "—", "No approved-rule-pack catalogue read state in v1"],
        ].map(([label, value, note]) => (
          <Surface key={label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          </Surface>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Surface>
          <SectionHeading
            title="Statutory Registers & Forms"
            description="Live calendar items backed by tenant legal entities"
            action={<StatusPill tone="success" dot>Live</StatusPill>}
          />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : obligations.length === 0 ? (
            <EmptyNote message="No compliance obligations have been scheduled yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {obligations.map((obligation) => (
                <div key={obligation.id} className="rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </div>
                    <StatusPill>{obligation.status}</StatusPill>
                  </div>
                  <p className="mt-4 font-bold text-sm text-foreground">{obligation.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {obligation.formCode ? `Form ${obligation.formCode} · ` : ""}
                    {obligation.dueDate ? `Due ${formatDate(obligation.dueDate)}` : "No due date recorded"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-10 sm:h-8 rounded-lg text-xs font-semibold"
                    disabled={!isUuid(obligation.id)}
                    title={isUuid(obligation.id) ? "Attach evidence to this obligation" : "Evidence needs a persisted obligation id"}
                    onClick={() => openEvidence(obligation.id)}
                  >
                    Attach evidence
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface className="border-primary/30 bg-card">
          <SectionHeading title="Obligation Status" description="Live status breakdown" />
          {loading ? (
            <LoadingNote />
          ) : error ? (
            <ErrorNote message={error} />
          ) : obligations.length === 0 ? (
            <EmptyNote message="No obligation statuses to summarize yet." />
          ) : (
            <div className="space-y-2.5 font-mono text-xs">
              {[...obligations
                .reduce((counts, obligation) => counts.set(obligation.status, (counts.get(obligation.status) ?? 0) + 1), new Map<string, number>())
                .entries()].map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
                >
                  <p className="min-w-0 truncate font-semibold text-foreground">{status}</p>
                  <p className="shrink-0 font-bold text-foreground">{count}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Each obligation links to a legal entity and, where applicable, an approved statutory form.
          </p>
        </Surface>
      </div>

      {mode === "obligation" ? (
        <Modal
          title="New compliance obligation"
          description="Schedule an obligation against an approved statutory form."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitObligation(event)} className="space-y-3">
            <Field label="Title">
              <Input value={oblTitle} onChange={(e) => setOblTitle(e.target.value)} placeholder="PF monthly return" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Act">
              <Input value={oblAct} onChange={(e) => setOblAct(e.target.value)} placeholder="Employees' Provident Funds Act, 1952" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Authority">
              <Input value={oblAuthority} onChange={(e) => setOblAuthority(e.target.value)} placeholder="EPFO" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Legal entity code">
              <Input value={oblEntityCode} onChange={(e) => setOblEntityCode(e.target.value)} placeholder="MKR-01" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Location code">
              <Input value={oblLocationCode} onChange={(e) => setOblLocationCode(e.target.value)} placeholder="Plant North" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Frequency">
              <select
                aria-label="Obligation frequency"
                value={oblFrequency}
                onChange={(e) => setOblFrequency(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground"
              >
                {picklists.PL_FREQUENCY.values.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner" hint="The principal accountable for the filing.">
              <ReferencePicker endpoint="/api/v1/dossier-lookups/employees" ariaLabel="Owner" value={oblOwnerId} onChange={setOblOwnerId} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs" />
            </Field>
            <Field label="Form code" hint="Must name a form with an approved rule pack.">
              <Input value={oblForm} onChange={(e) => setOblForm(e.target.value)} placeholder="PF-ECR" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Due date YYYY-MM-DD">
              <Input value={oblDue} onChange={(e) => setOblDue(e.target.value)} placeholder="2026-10-15" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Notes (optional)">
              <Input value={oblNotes} onChange={(e) => setOblNotes(e.target.value)} placeholder="File before the 15th" className="h-10 rounded-xl text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Schedule obligation"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {mode === "evidence" ? (
        <Modal
          title={`Attach evidence${evidenceTarget ? ` · ${shortId(evidenceTarget)}` : ""}`}
          description="Link an uploaded document to the compliance calendar item."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitEvidence(event)} className="space-y-3">
            {/* The calendar item is fixed to the obligation "Attach evidence" was opened from
                (shown in the modal title above) — nothing to edit here; re-exposing it as a
                free-text id would let it be pointed at a different obligation by accident. */}
            <Field label="Document" hint="The uploaded document this evidence points to.">
              <ReferencePicker endpoint="/api/v1/documents" value={evDocumentId} onChange={setEvDocumentId} className="h-10 rounded-xl border border-border bg-card px-3 text-xs" />
            </Field>
            <Field label="Note (optional)">
              <Input value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="Challan for September" className="h-10 rounded-xl text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Attach evidence"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

type IntegrationEntry = { key: string; code: string; name: string; detail: string; connected: boolean; environment: string };

export function IntegrationsPage() {
  const [entries, setEntries] = useState<IntegrationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"connection" | "webhook" | "secret" | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [catalogCode, setCatalogCode] = useState("");
  const [environment, setEnvironment] = useState("Sandbox");
  const [secretRef, setSecretRef] = useState("");
  const [verifiedRoundTrip, setVerifiedRoundTrip] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [inboundConnection, setInboundConnection] = useState("");
  const [inboundSecret, setInboundSecret] = useState("");
  const [inboundLabel, setInboundLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [catalogBody, connectionsBody] = await Promise.all([
          getJson("/api/v1/integrations/catalog"),
          getJson("/api/v1/integrations/connections"),
        ]);
        const catalog = listOf(asRecord(catalogBody).data);
        const connections = listOf(asRecord(connectionsBody).data);
        const connectedCodes = new Set<string>();
        const environments = new Map<string, string>();
        for (const connection of connections) {
          const catalogAttrs = asRecord(connection.catalog);
          const code = str(catalogAttrs.code, str(asRecord(catalogAttrs.attributes).code, str(connection.id)));
          if (code) {
            connectedCodes.add(code);
            environments.set(code, str(connection.environment));
          }
        }
        const parsed: IntegrationEntry[] = catalog.map((item, index) => {
          const attrs = attrsOf(item);
          const code = str(attrs.code, str(item.id, `connector-${index}`));
          return {
            key: str(item.id, code),
            code,
            name: str(attrs.name, code || "Unnamed connector"),
            detail: str(attrs.description, "No description published for this connector."),
            connected: connectedCodes.has(code),
            environment: environments.get(code) ?? "",
          };
        });
        if (!cancelled) {
          setEntries(parsed);
          if (parsed[0]?.code) setCatalogCode((current) => current || parsed[0].code);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Integration data could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function open(m: "connection" | "webhook" | "secret") {
    setMode(m);
    setFormError("");
    setFormSuccess("");
  }

  async function submitConnection(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    if (!catalogCode.trim()) {
      setFormError("A catalogue code is required.");
      return;
    }
    if (environment !== "Sandbox" && environment !== "Simulated" && environment !== "Live") {
      setFormError("Environment must be Sandbox, Simulated, or Live.");
      return;
    }
    if (environment === "Live" && !verifiedRoundTrip) {
      setFormError("Live connections need a verified round-trip before the label is claimed.");
      return;
    }
    setSaving(true);
    try {
      const body: UnknownRecord = {
        catalogCode: catalogCode.trim(),
        environment,
        config: {},
        verifiedRoundTrip,
      };
      if (secretRef.trim()) body.secretRef = secretRef.trim();
      await postJson("/api/v1/integrations/connections", body);
      setFormSuccess("Connection saved. The catalogue states below have been refreshed.");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The connection could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function submitWebhook(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    const events = webhookEvents.split(",").map((item) => item.trim()).filter(Boolean);
    if (!webhookUrl.trim()) {
      setFormError("An endpoint URL is required.");
      return;
    }
    if (events.length === 0) {
      setFormError("At least one event name is required (comma-separated).");
      return;
    }
    if (webhookSecret.length < 16) {
      setFormError("The endpoint secret must be at least 16 characters.");
      return;
    }
    setSaving(true);
    try {
      await postJson("/api/v1/webhooks/endpoints", { url: webhookUrl.trim(), events, secret: webhookSecret });
      setFormSuccess("Webhook endpoint registered. Only the id is stored; the secret stays hashed server-side.");
      setWebhookUrl("");
      setWebhookEvents("");
      setWebhookSecret("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The endpoint could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSecret(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    if (!isUuid(inboundConnection)) {
      setFormError("Connection id must be a valid UUID.");
      return;
    }
    if (inboundSecret.length < 16) {
      setFormError("The inbound secret must be at least 16 characters.");
      return;
    }
    if (!inboundLabel.trim()) {
      setFormError("A label is required.");
      return;
    }
    setSaving(true);
    try {
      await postJson("/api/v1/webhooks/secrets", {
        connectionId: inboundConnection.trim(),
        secret: inboundSecret,
        label: inboundLabel.trim(),
      });
      setFormSuccess("Inbound secret sealed. It is never returned or logged.");
      setInboundSecret("");
      setInboundLabel("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The secret could not be provisioned.");
    } finally {
      setSaving(false);
    }
  }

  const connectedCount = entries.filter((entry) => entry.connected).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Connected Subsystems · Live Integrations"
        title="One trusted flow of work."
        description="Manage connected systems while keeping credentials securely referenced."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open("webhook")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> New Webhook
            </Button>
            <Button onClick={() => open("secret")} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> Provision Secret
            </Button>
            <Button onClick={() => open("connection")} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4 mr-1.5" /> Add Connection
            </Button>
          </div>
        }
      />

      <p className="mb-4 font-mono text-xs text-muted-foreground">
        {loading ? "Loading…" : error ? error : `${connectedCount} of ${entries.length} ${entries.length === 1 ? "connector" : "connectors"} connected.`}
      </p>

      {loading ? (
        <Surface><LoadingNote /></Surface>
      ) : error ? (
        <Surface><ErrorNote message={error} /></Surface>
      ) : entries.length === 0 ? (
        <Surface><EmptyNote message="No connectors in the catalogue yet." /></Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <Surface key={entry.key} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <Fingerprint className="size-6" />
                </div>
                <StatusPill tone={entry.connected ? "success" : "neutral"} dot={entry.connected}>
                  {entry.connected ? `Connected${entry.environment ? ` · ${entry.environment}` : ""}` : "Available"}
                </StatusPill>
              </div>
              <p className="mt-5 text-base font-bold text-foreground">{entry.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">Code {entry.code || "—"}</p>
            </Surface>
          ))}
        </div>
      )}

      {/* FRM-FIN-02: per-connection field ownership, the map the inbound ERP sync obeys. */}
      {!loading && !error ? <ErpFieldOwnershipPanel /> : null}
      {!loading && !error ? <ErpSyncQueuePanel /> : null}

      {mode === "connection" ? (
        <Modal
          title="Add connection"
          description="Connect an integration using references to securely stored credentials."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitConnection(event)} className="space-y-3">
            <Field label="Catalogue code">
              <Input value={catalogCode} onChange={(e) => setCatalogCode(e.target.value)} placeholder="PAYROLL-BANK" list="integration-catalog-codes" className="h-10 rounded-xl font-mono text-xs" />
              <datalist id="integration-catalog-codes">
                {entries.map((entry) => (
                  <option key={entry.key} value={entry.code} />
                ))}
              </datalist>
            </Field>
            <Field label="Environment">
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-xs text-foreground"
              >
                <option value="Sandbox">Sandbox</option>
                <option value="Simulated">Simulated</option>
                <option value="Live">Live</option>
              </select>
            </Field>
            <Field label="Secret ref (optional)" hint="A vault reference such as vault://bank-token. Never paste raw secrets here.">
              <Input value={secretRef} onChange={(e) => setSecretRef(e.target.value)} placeholder="vault://connector/token" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <label className="flex items-center gap-2 text-xs font-bold text-foreground">
              <input type="checkbox" checked={verifiedRoundTrip} onChange={(e) => setVerifiedRoundTrip(e.target.checked)} className="size-4" />
              Verified round-trip (required for Live)
            </label>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Connect"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {mode === "webhook" ? (
        <Modal
          title="New webhook endpoint"
          description="Register a webhook destination; its secret is stored securely."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitWebhook(event)} className="space-y-3">
            <Field label="Endpoint URL">
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://receiver.example.test/hooks" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Events (comma-separated)" hint="For example payroll.run.finalized, talent.offer.accepted.">
              <Input value={webhookEvents} onChange={(e) => setWebhookEvents(e.target.value)} placeholder="payroll.run.finalized" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Signing secret (min 16 characters)">
              <Input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="At least 16 characters" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Register endpoint"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {mode === "secret" ? (
        <Modal
          title="Provision inbound secret"
          description="Store the signing secret used to verify inbound events."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitSecret(event)} className="space-y-3">
            <Field label="Connection id (UUID)">
              <Input value={inboundConnection} onChange={(e) => setInboundConnection(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Secret (min 16 characters)">
              <Input value={inboundSecret} onChange={(e) => setInboundSecret(e.target.value)} placeholder="At least 16 characters" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Label">
              <Input value={inboundLabel} onChange={(e) => setInboundLabel(e.target.value)} placeholder="Bank HMAC secret" className="h-10 rounded-xl text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Provision secret"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

type Membership = { tenantName: string; tenantSlug: string };

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UnknownRecord>({});
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"settings" | "invite" | null>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState("");
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [roleCodes, setRoleCodes] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [settingsBody, membershipsBody] = await Promise.all([
          getJson("/api/v1/tenant/settings"),
          getJson("/api/v1/identity/memberships"),
        ]);
        const memberships = listOf(asRecord(membershipsBody).memberships);
        const first = memberships[0];
        if (!cancelled) {
          setSettings(asRecord(asRecord(settingsBody).data));
          setMembership(
            first
              ? { tenantName: str(first.tenantName, "Workspace"), tenantSlug: str(first.tenantSlug) }
              : null
          );
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Settings could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function submitSettings(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    const body: UnknownRecord = {};
    if (locale.trim()) {
      if (!/^[a-z]{2}-[A-Z]{2}$/.test(locale.trim())) {
        setFormError("Locale must look like en-IN.");
        return;
      }
      body.locale = locale.trim();
    }
    if (timezone.trim()) body.timezone = timezone.trim();
    if (currency.trim()) {
      if (!/^[A-Z]{3}$/.test(currency.trim())) {
        setFormError("Currency must be a 3-letter code such as INR.");
        return;
      }
      body.currency = currency.trim();
    }
    if (Object.keys(body).length === 0) {
      setFormError("Set at least one of locale, timezone, or currency.");
      return;
    }
    setSaving(true);
    try {
      await patchJson("/api/v1/tenant/settings", body);
      setFormSuccess("Tenant settings saved. Live values below have been refreshed.");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setFormSuccess("");
    const codes = roleCodes.split(",").map((code) => code.trim()).filter(Boolean);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setFormError("A valid email address is required.");
      return;
    }
    if (codes.length === 0) {
      setFormError("At least one role code is required (comma-separated).");
      return;
    }
    setSaving(true);
    try {
      const result = await postJson("/api/v1/invitations", { email: inviteEmail.trim().toLowerCase(), roleCodes: codes });
      const attrs = asRecord(asRecord(result).data);
      const token = str(attrs.token, str(asRecord(attrs.attributes).token));
      setFormSuccess(
        token
          ? `Invitation issued for ${inviteEmail.trim().toLowerCase()}. Token (shown once): ${token}`
          : `Invitation issued for ${inviteEmail.trim().toLowerCase()}.`
      );
      setInviteEmail("");
      setRoleCodes("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The invitation could not be created.");
    } finally {
      setSaving(false);
    }
  }

  const tenantName = membership?.tenantName ?? (loading ? "Loading…" : "Workspace");
  const tenantSlug = membership?.tenantSlug ?? "";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="System Configuration · Live Workspace"
        title="Built for governed autonomy."
        description="Manage workspace identity, access, and regional defaults."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setFormError(""); setFormSuccess(""); setMode("invite"); }} variant="outline" className="h-10 rounded-xl px-4 text-xs font-bold">
              <Plus className="size-4 mr-1.5" /> Invite Member
            </Button>
            <Button onClick={() => { setFormError(""); setFormSuccess(""); setMode("settings"); }} className="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
              Edit Settings
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_.62fr]">
        <div className="space-y-6">
          <Surface>
            <SectionHeading
              title="Interface Appearance"
              description="Customize theme preferences; dark mode is active by default"
            />
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition ${
                  theme === "dark"
                    ? "border-primary bg-primary/15 text-primary shadow-sm"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Moon className="size-4" /> Dark Default
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition ${
                  theme === "light"
                    ? "border-primary bg-primary/15 text-primary shadow-sm"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Sun className="size-4" /> Executive Light
              </button>
            </div>
          </Surface>

          <Surface>
            <SectionHeading
              title="Legal Organisation"
              description={loading ? "Loading…" : error ? error : tenantName}
            />
            {loading ? (
              <LoadingNote />
            ) : error ? (
              <ErrorNote message={error} />
            ) : membership ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-foreground">
                  Legal Entity Name
                  <Input value={tenantName} readOnly className="mt-2 h-10 rounded-xl text-xs" />
                </label>
                <label className="text-xs font-bold text-foreground">
                  Workspace Domain Slug
                  <Input value={tenantSlug || "No slug assigned"} readOnly className="mt-2 h-10 rounded-xl text-xs" />
                </label>
              </div>
            ) : (
              <EmptyNote message="No membership found for this login, so no tenant identity can be shown." />
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Tenant rename is not exposed by the v1 settings API (PATCH supports locale, timezone,
              and currency only).
            </p>
          </Surface>

          <Surface>
            <SectionHeading
              title="Security Role Boundaries"
              description="Roles available in this workspace"
            />
            <EmptyNote message="No role catalogue is available yet." />
          </Surface>
        </div>

        <div className="space-y-6">
          <Surface className="border-primary/30 bg-card">
            <SectionHeading title="Tenant Settings" description="Current workspace defaults" />
            {loading ? (
              <LoadingNote />
            ) : error ? (
              <ErrorNote message={error} />
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {[
                  ["Locale", str(settings.locale, "—")],
                  ["Timezone", str(settings.timezone, "—")],
                  ["Currency", str(settings.currency, "—")],
                  ["Policy Schema", String(settings.policy_schema_version ?? "—")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
                    <p className="shrink-0 font-semibold text-foreground">{label}</p>
                    <p className="min-w-0 truncate text-right text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface>
            <SectionHeading title="Governance Notes" description="What v1 exposes today" />
            <div className="space-y-3 font-mono text-xs">
              {[
                "Tenant scope resolves from the session membership",
                "Updating workspace defaults requires tenant management access",
                "Audit and maker-checker flows run server-side per route",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>

      {mode === "settings" ? (
        <Modal
          title="Edit tenant settings"
          description="Update the workspace locale, timezone, and currency defaults."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitSettings(event)} className="space-y-3">
            <Field label="Locale (optional)" hint="Format ll-CC, for example en-IN.">
              <Input value={locale} onChange={(e) => setLocale(e.target.value)} placeholder={str(settings.locale, "en-IN")} className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Timezone (optional)" hint="IANA name, for example Asia/Kolkata.">
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={str(settings.timezone, "Asia/Kolkata")} className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <Field label="Currency (optional)" hint="3-letter code, for example INR.">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder={str(settings.currency, "INR")} className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {mode === "invite" ? (
        <Modal
          title="Invite member"
          description="Invite a user and assign their initial roles. Save the invitation token when it appears."
          onClose={() => setMode(null)}
        >
          <form onSubmit={(event) => void submitInvite(event)} className="space-y-3">
            <Field label="Email">
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.test" className="h-10 rounded-xl text-xs" />
            </Field>
            <Field label="Role codes (comma-separated)" hint="Must match active tenant roles, for example employee, payroll-runner.">
              <Input value={roleCodes} onChange={(e) => setRoleCodes(e.target.value)} placeholder="employee" className="h-10 rounded-xl font-mono text-xs" />
            </Field>
            <FormStatus error={formError} success={formSuccess} />
            <Button type="submit" disabled={saving} className="h-10 w-full rounded-xl text-xs font-bold">
              {saving ? "Saving…" : "Send invite"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
