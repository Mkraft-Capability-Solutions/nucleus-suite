"use client";

import Link from "next/link";
import { Inbox, Loader2, Search } from "lucide-react";
import React, { useEffect, useId, useMemo, useState } from "react";
import { apiErrorMessage, getJson, invalidateGetRequest } from "@/lib/client-api";
import { recordLabel, unwrapRecords } from "@/lib/workflow-catalog";
import { PageIntro, SectionHeading, Surface } from "./page-primitives";

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

export function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: unknown): boolean {
  return value === true || value === "true";
}

/** Reads the `data` array out of the standard collection envelope. */
export function listFromEnvelope(payload: unknown): UnknownRecord[] {
  const data = asRecord(payload).data;
  return Array.isArray(data) ? (data as UnknownRecord[]) : [];
}

/** Reads the `data` object out of the standard record envelope. */
export function recordFromEnvelope(payload: unknown): UnknownRecord {
  return asRecord(asRecord(payload).data);
}

export function listOf(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? (value as UnknownRecord[]) : [];
}

/** Human label for a snake_case workflow state. */
export function stateLabel(state: string): string {
  if (!state) return "Unknown";
  const spaced = state.replace(/_/g, " ");
  return spaced[0].toUpperCase() + spaced.slice(1);
}

export function shortTimestamp(value: unknown): string {
  return str(value).slice(0, 16).replace("T", " ");
}

/**
 * Live GET for one register endpoint. An empty path stays idle so a detail pane
 * can mount before a record is selected.
 */
type ResourceResult = { path: string; data: unknown; error: string };

const IDLE_RESULT: ResourceResult = { path: "", data: null, error: "" };

export function useRegisterResource(path: string) {
  const [result, setResult] = useState<ResourceResult>(IDLE_RESULT);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJson(path)
      .then((value) => {
        if (!cancelled) setResult({ path, data: value, error: "" });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult({
          path,
          data: null,
          error: caught instanceof Error ? caught.message : "This data could not be loaded.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  // The result is only this path's once it has settled; until then the queue reads as loading.
  const settled = result.path === path;
  return {
    data: settled ? result.data : null,
    loading: Boolean(path) && !settled,
    error: settled ? result.error : "",
    refresh: () => {
      if (!path) return;
      invalidateGetRequest(path);
      setResult(IDLE_RESULT);
      setTick((current) => current + 1);
    },
  };
}

export type ActionOutcome = { ok: boolean; message: string };

/** POSTs a controlled action and surfaces the server's own error message. */
/**
 * One register action. `method` is settable because a few endpoints are a full replacement
 * rather than an event — a configuration screen that saves the whole record is a PUT, and
 * posting to it would read as raising something new.
 */
export async function postRegisterAction(path: string, body: UnknownRecord, method: "POST" | "PUT" | "PATCH" = "POST"): Promise<ActionOutcome> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = asRecord(await response.json().catch(() => null));
    if (response.ok) return { ok: true, message: "Saved." };
    return { ok: false, message: apiErrorMessage(payload, response.status, `Request failed (${response.status}).`) };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export function RegisterIntro({
  eyebrow,
  title,
  description,
  onRefresh,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onRefresh: () => void;
  action?: React.ReactNode;
}) {
  return (
    <PageIntro
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={
        // The page may pass one, two or three buttons here. `flex-wrap` lets them
        // stack onto a second line on a phone instead of pushing the intro wider
        // than the viewport.
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
          >
            Refresh
          </button>
          {action}
        </span>
      }
    />
  );
}

export function ProcessGuide({ screenId, description }: { screenId: string; description: string }) {
  return (
    <Surface className="mb-4">
      <SectionHeading title={`Process guide · ${screenId}`} description={description} />
    </Surface>
  );
}

export function ScopeBar({ href, label }: { href: string; label: string }) {
  return (
    <Surface className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted-foreground">Scoped to your permitted entity, location and reporting line.</p>
        <Link
          href={href}
          className="inline-flex min-h-10 shrink-0 items-center text-xs font-semibold text-primary hover:underline"
        >
          {label}
        </Link>
      </div>
    </Surface>
  );
}

export type Notice = { text: string; tone: "success" | "error" };

export function RegisterNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === "success" ? "status" : "alert"}
      className={`mb-4 rounded-lg border p-3 text-xs text-foreground ${
        notice.tone === "success" ? "border-success/30 bg-success/10" : "border-border bg-secondary/40"
      }`}
    >
      {notice.text}
    </p>
  );
}

/** Loading, error and empty states for a queue. Returns null once rows are ready. */
export function RegisterStates({
  loading,
  error,
  empty,
  onRetry,
  loadingLabel,
  errorTitle,
  emptyTitle,
  emptyHint,
}: {
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
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> {loadingLabel}
        </p>
      </Surface>
    );
  }
  if (error) {
    return (
      <Surface className="p-5">
        <p role="alert" className="text-sm font-semibold text-foreground">{errorTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50"
        >
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

/** Queue and record-detail columns, matching the register layout used across People Core. */
export function RegisterLayout({ queue, detail }: { queue: React.ReactNode; detail: React.ReactNode }) {
  return (
    // One column on phone and tablet; the two register columns only appear at
    // `lg`. `minmax(0,…)` is required — a bare `fr` track takes its min-content
    // from the scrolling queue table and would push the page wider than the
    // viewport.
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
      <Surface className="p-0">{queue}</Surface>
      <Surface>{detail}</Surface>
    </div>
  );
}

export function RegisterQueue({
  searchLabel,
  searchPlaceholder,
  onSearch,
  total,
  columns,
  children,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  onSearch: (value: string) => void;
  total: number;
  columns: readonly string[];
  children: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  return (
    <>
      <div className="border-b border-border p-4">
        <form
          className="relative w-full max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(input.trim());
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="h-10 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </form>
      </div>
      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
        {total} record(s) in the current scope
      </p>
      {/* The only element allowed to scroll sideways: the queue table keeps its
          620 px minimum so operational values stay on one line, and this wrapper
          — not the page — absorbs the overflow on a phone. */}
      <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {columns.map((column) => (
                <th key={column} className="px-3 py-3 first:px-4">{column}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">{children}</tbody>
        </table>
      </div>
    </>
  );
}

/** One selectable queue row. Cells are supplied by the page. */
export function QueueRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer hover:bg-secondary/40 ${selected ? "bg-primary/5" : ""}`}
    >
      {children}
      <td className="px-4 py-3 text-right text-muted-foreground">›</td>
    </tr>
  );
}

export function Cell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-3 py-3 text-xs first:px-4 ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      {children}
    </td>
  );
}

export type TimelineState = { value: string; label: string; note?: string };

export function StateTimeline({ states, current }: { states: readonly TimelineState[]; current: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-foreground">State timeline</p>
      <ol className="mt-2 space-y-1.5">
        {states.map((state, index) => (
          <li
            key={state.value}
            className={`flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border px-3 py-2 text-xs ${
              current === state.value
                ? "border-primary/30 bg-primary/5 font-semibold text-foreground"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary font-mono text-[10px]">{index + 1}</span>
            <span className="min-w-0 break-words">{state.label}</span>
            {state.note && <span className="min-w-0 break-words text-[11px]">({state.note})</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AuditTrail({ events }: { events: UnknownRecord[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-foreground">Audit trail</p>
      {events.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No audited events for this record yet.</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {events.slice(0, 8).map((event, index) => (
            <li key={str(event.id, String(index))} className="min-w-0 rounded-xl border border-border/60 px-3 py-2 text-xs">
              <p className="break-words font-semibold">{str(event.action).replace(/\./g, " · ").replace(/_/g, " ")}</p>
              <p className="mt-0.5 break-words text-muted-foreground">
                {str(event.reason, "No reason recorded")} · {shortTimestamp(event.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ConfigFooter() {
  return (
    <p className="mt-4 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
      Configuration · Rules and permissions are evaluated by the active module contract.
    </p>
  );
}

/** Placeholder shown in the detail column before a record resolves. */
export function DetailPlaceholder({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {loading
          ? "Loading record detail…"
          : error
            ? error
            : "Select a record to view its controlled workflow, evidence and audit trail."}
      </p>
      {!loading && error && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function ActionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-bold text-foreground">{title}</p>
      {children}
    </div>
  );
}

export function ActionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-2 block text-xs font-semibold">
      {label}
      {children}
    </label>
  );
}

export const actionInputClass = "mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";

/**
 * A search-as-you-type reference field: type a name or code, pick a match, and the
 * underlying value is the record's id — never a UUID the user has to find and paste
 * themselves. Same `/api/v1/dossier-lookups/...`-style endpoints and record shape
 * (`unwrapRecords`/`recordLabel`) the catalog-driven forms already use in
 * `workflow-workspace.tsx`'s `ReferenceInput`, so a person picking "an employee" gets
 * the identical experience whether the screen is catalog-generated or hand-built.
 */
export function ReferencePicker({
  endpoint,
  value,
  onChange,
  ariaLabel,
  placeholder = "Search by name or code…",
  className = actionInputClass,
}: {
  endpoint: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [rows, setRows] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listId = useId();
  // Once a real id is picked, stop searching on it — the field shows the picked
  // record's own value, not a further query for a UUID-shaped string.
  const search = /^[a-f0-9-]{36}$/i.test(value) ? "" : value;

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      getJson(`${endpoint}${endpoint.includes("?") ? "&" : "?"}search=${encodeURIComponent(search)}`)
        .then((data) => {
          if (!live) return;
          setRows(unwrapRecords(data));
          setError("");
          setLoading(false);
        })
        .catch((caught) => {
          if (!live) return;
          setRows([]);
          setError(caught instanceof Error ? caught.message : "Choices could not be loaded.");
          setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [endpoint, search]);

  return (
    <>
      <input
        list={listId}
        aria-label={ariaLabel}
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={loading ? "Loading…" : placeholder}
      />
      <datalist id={listId}>
        {rows
          .filter((row) => row.id)
          .map((row, index) => (
            <option key={String(row.id) + "-" + index} value={String(row.id)}>
              {recordLabel(row)}
            </option>
          ))}
      </datalist>
      {error ? <span className="mt-1 block text-xs text-destructive">Could not load choices: {error}</span> : null}
    </>
  );
}

export function ActionButton({
  onClick,
  busy,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-2 inline-flex h-10 max-w-full shrink-0 items-center justify-center rounded-xl border border-border px-4 text-xs font-bold hover:border-primary/50 disabled:opacity-60"
    >
      {busy ? "Saving…" : children}
    </button>
  );
}

/** Selects the current record from a queue, falling back to the first row. */
export function useSelection<T extends { id: string }>(rows: T[], selectedId: string): T | null {
  return useMemo(() => {
    if (rows.length === 0) return null;
    return (selectedId ? rows.find((row) => row.id === selectedId) : undefined) ?? rows[0];
  }, [rows, selectedId]);
}

export type ModuleTab = { id: string; label: string; count?: number | null };

/**
 * Tab shell used by the module consoles. Roving focus and aria-selected keep it
 * usable from the keyboard; panels stay in the page so a tab switch never
 * re-fetches what is already loaded.
 */
export function ModuleTabs({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: readonly ModuleTab[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  function move(direction: 1 | -1) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    onSelect(next.id);
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-2"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={`inline-flex min-h-10 max-w-full shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              selected
                ? "border border-primary/30 bg-primary/10 text-primary"
                : "border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: React.ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

/** Headline figure for a module console. Renders "—" rather than a fake zero. */
export function ModuleStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number | null;
  note?: string;
}) {
  return (
    <Surface className="p-4">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value === null ? "—" : value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </Surface>
  );
}

/** Downloads exactly the rows on screen as CSV. Nothing is fetched or invented. */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string {
  const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

export function downloadCsv(filename: string, contents: string): boolean {
  try {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
