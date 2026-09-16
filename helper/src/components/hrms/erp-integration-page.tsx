"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import {
  defaultOwnersForMode,
  ERP_MANDATORY_SYNC_FIELDS,
  ERP_MATCH_KEY_LABELS,
  ERP_MATCH_KEYS,
  ERP_SETTINGS_DEFAULTS,
  ERP_SYNC_FIELD_LABELS,
  ERP_SYNC_FIELDS,
  erpOwnershipCoverage,
  type ErpConflictPolicy,
  type ErpFieldOwner,
  type ErpFieldOwners,
  type ErpMasterMode,
  type ErpMatchKey,
  type ErpSyncField,
  type ErpUnmatchedAction,
} from "@/lib/erp-field-ownership";
import { picklists, type PicklistCode, type PicklistValue } from "@/lib/picklists";
import { SectionHeading, StatusPill, Surface } from "./page-primitives";

/**
 * FRM-FIN-02 — ERP Integration and Field Ownership. Rendered inside the
 * integrations screen; one settings envelope per connection, saved through
 * `PUT /api/v1/integrations/erp-settings` and obeyed by the inbound sync.
 */

const SETTINGS_PATH = "/api/v1/integrations/erp-settings";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function inSet<C extends PicklistCode>(code: C, value: unknown): PicklistValue<C> | null {
  return typeof value === "string" && picklists[code].values.some((entry) => entry.value === value) ? (value as PicklistValue<C>) : null;
}

type FormState = {
  masterMode: ErpMasterMode;
  erpSystem: PicklistValue<"PL_ERP_SYSTEM"> | "";
  syncFrequency: PicklistValue<"PL_SYNC_FREQUENCY">;
  fieldOwners: ErpFieldOwners;
  conflictPolicy: ErpConflictPolicy;
  matchKey: ErpMatchKey;
  unmatchedAction: ErpUnmatchedAction;
};

type ConnectionView = {
  connectionId: string;
  catalogCode: string;
  environment: string;
  saved: FormState | null;
  updatedAt: string;
};

function emptyForm(): FormState {
  return {
    masterMode: ERP_SETTINGS_DEFAULTS.masterMode,
    erpSystem: "",
    syncFrequency: ERP_SETTINGS_DEFAULTS.syncFrequency,
    fieldOwners: defaultOwnersForMode(ERP_SETTINGS_DEFAULTS.masterMode),
    conflictPolicy: ERP_SETTINGS_DEFAULTS.conflictPolicy,
    matchKey: ERP_SETTINGS_DEFAULTS.matchKey,
    unmatchedAction: ERP_SETTINGS_DEFAULTS.unmatchedAction,
  };
}

function parseSaved(raw: unknown): FormState | null {
  const settings = asRecord(raw);
  const masterMode = inSet("PL_MASTER_MODE", settings.masterMode);
  const erpSystem = inSet("PL_ERP_SYSTEM", settings.erpSystem);
  const syncFrequency = inSet("PL_SYNC_FREQUENCY", settings.syncFrequency);
  const conflictPolicy = inSet("PL_CONFLICT_POLICY", settings.conflictPolicy);
  const unmatchedAction = inSet("PL_UNMATCHED_ACTION", settings.unmatchedAction);
  const matchKey = ERP_MATCH_KEYS.find((key) => key === settings.matchKey) ?? null;
  if (!masterMode || !erpSystem || !syncFrequency || !conflictPolicy || !unmatchedAction || !matchKey) return null;
  const owners: ErpFieldOwners = {};
  const rawOwners = asRecord(settings.fieldOwners);
  for (const field of ERP_SYNC_FIELDS) {
    const owner = inSet("PL_FIELD_OWNER", rawOwners[field]);
    if (owner) owners[field] = owner;
  }
  return { masterMode, erpSystem, syncFrequency, fieldOwners: owners, conflictPolicy, matchKey, unmatchedAction };
}

function parseConnections(body: unknown): ConnectionView[] {
  const data = asRecord(body).data;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => asRecord(item))
    .map((item) => ({
      connectionId: str(item.connectionId, str(item.id)),
      catalogCode: str(item.catalogCode, "—"),
      environment: str(item.environment, "—"),
      saved: item.settings ? parseSaved(item.settings) : null,
      updatedAt: str(item.updatedAt),
    }))
    .filter((item) => item.connectionId);
}

async function putJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status}): ${path}`;
    try {
      const err = asRecord(asRecord(await response.json()).error);
      const message = str(err.message);
      const issues = Array.isArray(err.details) ? err.details.map((issue) => str(asRecord(issue).issue)).filter(Boolean) : [];
      if (message) detail = issues.length ? `${message} ${issues.join(" ")}` : message;
    } catch {
      // The status line is the best available detail.
    }
    throw new Error(detail);
  }
  return (await response.json().catch(() => null)) as unknown;
}

const selectClass = "h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-xs text-foreground";

function PicklistSelect<C extends PicklistCode>({
  code,
  value,
  onChange,
  placeholder,
}: {
  code: C;
  value: string;
  onChange: (value: PicklistValue<C> | "") => void;
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as PicklistValue<C> | "")} className={selectClass}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {picklists[code].values.map((entry) => (
        <option key={entry.value} value={entry.value}>
          {entry.label}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-foreground">
      {label}
      <span className="mt-1.5 block font-normal">{children}</span>
      {hint ? <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

type QueueRecordView = {
  id: string;
  direction: string;
  externalKey: string | null;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
  retryable: boolean;
  createdAt: string | null;
};

/**
 * FRM-FIN-02's inbound queue.
 *
 * A sync that fails is recorded with the reason it failed and the number of attempts made,
 * and none of it was reachable: the listing had no route and retry existed only as a
 * command with no control, so the only way to see why an employee had not arrived from the
 * ERP was to query the database. Failures are listed first because they are the only rows
 * anybody needs to act on.
 *
 * Abandoning takes a reason and retry does not, which is the asymmetry that matters: a
 * retry re-runs work that is meant to succeed, while abandoning decides it never will.
 */
export function ErpSyncQueuePanel() {
  const [records, setRecords] = useState<QueueRecordView[]>([]);
  const [counts, setCounts] = useState({ failed: 0, retryable: 0, applied: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [onlyFailed, setOnlyFailed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getJson(`/api/v1/integrations/erp-queue${onlyFailed ? "?status=failed" : ""}`);
        if (cancelled) return;
        const attributes = (payload as { data?: { attributes?: Record<string, unknown> } })?.data?.attributes ?? {};
        const items = Array.isArray(attributes.items) ? (attributes.items as QueueRecordView[]) : [];
        setRecords(items);
        setCounts({
          failed: Number(attributes.failed ?? 0),
          retryable: Number(attributes.retryable ?? 0),
          applied: Number(attributes.applied ?? 0),
        });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "The ERP queue could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, onlyFailed]);

  async function act(id: string, action: "retry" | "abandon") {
    let reason = "";
    if (action === "abandon") {
      reason = window.prompt("Why is this record being abandoned? (at least 10 characters)")?.trim() ?? "";
      if (reason.length < 10) {
        setNotice("Abandoning a record needs a reason of at least 10 characters.");
        return;
      }
    }
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/integrations/erp-queue/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "abandon" ? { action, reason } : { action }),
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = (payload as { error?: { message?: string } })?.error?.message;
        setNotice(message ?? `The ${action} failed (${response.status}).`);
        return;
      }
      setNotice(action === "retry" ? "Retried. The record's new status is shown below." : "Record abandoned.");
      invalidateGetRequest("/api/v1/integrations/erp-queue");
      setRefreshKey((key) => key + 1);
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">ERP sync queue</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.failed} failed · {counts.retryable} retryable · {counts.applied} applied
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={onlyFailed} onChange={(event) => setOnlyFailed(event.target.checked)} className="size-4" />
          Failures only
        </label>
      </div>
      {notice ? <p className="mt-3 text-xs font-medium text-foreground">{notice}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
      {loading ? <p className="mt-3 text-xs text-muted-foreground">Loading the queue…</p> : null}
      {!loading && records.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {onlyFailed ? "No failed records. Clear the filter to see what has applied." : "The queue is empty."}
        </p>
      ) : null}
      {records.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="border-b border-border py-2 pr-3">Record</th>
                <th className="border-b border-border py-2 pr-3">Status</th>
                <th className="border-b border-border py-2 pr-3">Attempts</th>
                <th className="border-b border-border py-2 pr-3">Reason it failed</th>
                <th className="border-b border-border py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="align-baseline">
                  <td className="border-b border-border py-2 pr-3 font-mono">{record.externalKey ?? record.id.slice(0, 8)}</td>
                  <td className="border-b border-border py-2 pr-3">{record.status}</td>
                  <td className="border-b border-border py-2 pr-3 tabular-nums">{record.attemptCount}</td>
                  <td className="border-b border-border py-2 pr-3 text-muted-foreground">{record.errorMessage ?? "—"}</td>
                  <td className="border-b border-border py-2">
                    <span className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={!record.retryable || busyId === record.id} onClick={() => void act(record.id, "retry")}>
                        Retry
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={busyId === record.id} onClick={() => void act(record.id, "abandon")}>
                        Abandon
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function ErpFieldOwnershipPanel() {
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [connectionId, setConnectionId] = useState("");
  // Unsaved edits, per connection. The form shown is the draft if there is one,
  // else the saved map, else the workbook defaults — so an existing map reads
  // back as saved and switching connections never loses a half-edited grid.
  const [drafts, setDrafts] = useState<Record<string, FormState>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const parsed = parseConnections(await getJson(SETTINGS_PATH));
        if (cancelled) return;
        setConnections(parsed);
        setConnectionId((current) => current || parsed[0]?.connectionId || "");
        setLoading(false);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "ERP settings could not be loaded.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const selected = connections.find((item) => item.connectionId === connectionId) ?? null;
  const form = drafts[connectionId] ?? selected?.saved ?? emptyForm();
  const coverage = erpOwnershipCoverage(form.fieldOwners);
  const canSave = Boolean(connectionId) && form.erpSystem !== "" && coverage.complete && !saving;

  function updateForm(updater: (current: FormState) => FormState) {
    setDrafts((current) => ({ ...current, [connectionId]: updater(current[connectionId] ?? selected?.saved ?? emptyForm()) }));
  }

  function selectConnection(next: string) {
    setConnectionId(next);
    setFormError("");
    setFormSuccess("");
  }

  function setMode(mode: ErpMasterMode) {
    // "Nucleus owns" / "ERP owns" pre-fill every owner; "Co-owned" has no single
    // default, so the owners already chosen are left as they are.
    updateForm((current) => ({
      ...current,
      masterMode: mode,
      fieldOwners: mode === "co_owned" ? current.fieldOwners : defaultOwnersForMode(mode),
    }));
  }

  function setOwner(field: ErpSyncField, owner: ErpFieldOwner | "") {
    updateForm((current) => {
      const next = { ...current.fieldOwners };
      if (owner === "") delete next[field];
      else next[field] = owner;
      return { ...current, fieldOwners: next };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setFormError("");
    setFormSuccess("");
    try {
      await putJson(SETTINGS_PATH, { connectionId, ...form });
      invalidateGetRequest(SETTINGS_PATH);
      // The reload below reads the saved map back; the draft has nothing left to add.
      setDrafts((current) => {
        const next = { ...current };
        delete next[connectionId];
        return next;
      });
      setFormSuccess("ERP field ownership saved. Inbound syncs on this connection now obey it.");
      setRefreshKey((key) => key + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The ERP settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Surface className="mt-6 p-6">
      <SectionHeading
        title="ERP integration and field ownership"
        description="Which system owns which employee field, how an inbound record is matched, and what happens on a conflict. The inbound sync writes only ERP-owned fields and refuses to run on a connection with no saved map."
      />
      {loading ? (
        <p className="py-6 text-center font-mono text-xs text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">{error}</p>
      ) : connections.length === 0 ? (
        <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">Add a connection first; the ownership map is kept per ERP connection.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="ERP connection" hint={selected?.saved ? `Saved map on file (last change ${selected.updatedAt || "unknown"}).` : "No ownership map saved for this connection yet."}>
              <select value={connectionId} onChange={(event) => selectConnection(event.target.value)} className={selectClass}>
                {connections.map((item) => (
                  <option key={item.connectionId} value={item.connectionId}>
                    {item.catalogCode} · {item.environment} · {item.connectionId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="flex items-end">
              <StatusPill tone={selected?.saved ? "success" : "warning"} dot>
                {selected?.saved ? "Sync enabled" : "Sync refused until saved"}
              </StatusPill>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Mode</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldLabel label="Master data mode" hint="Determines which fields are read-only in Nucleus and pre-fills the owner of every field.">
                <PicklistSelect code="PL_MASTER_MODE" value={form.masterMode} onChange={(value) => value && setMode(value)} />
              </FieldLabel>
              <FieldLabel label="ERP system">
                <PicklistSelect code="PL_ERP_SYSTEM" value={form.erpSystem} placeholder="Choose the ERP" onChange={(value) => updateForm((current) => ({ ...current, erpSystem: value }))} />
              </FieldLabel>
              <FieldLabel label="Sync frequency">
                <PicklistSelect code="PL_SYNC_FREQUENCY" value={form.syncFrequency} onChange={(value) => value && updateForm((current) => ({ ...current, syncFrequency: value }))} />
              </FieldLabel>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Ownership</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Mandatory</th>
                    <th className="px-3 py-2">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {ERP_SYNC_FIELDS.map((field) => {
                    const mandatory = ERP_MANDATORY_SYNC_FIELDS.includes(field);
                    const owner = form.fieldOwners[field] ?? "";
                    return (
                      <tr key={field} className="border-t border-border/60">
                        <td className="px-3 py-2 font-bold text-foreground">
                          {ERP_SYNC_FIELD_LABELS[field]}
                          <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{field}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{mandatory ? "Yes" : "No"}</td>
                        <td className="px-3 py-2">
                          <select value={owner} onChange={(event) => setOwner(field, event.target.value as ErpFieldOwner | "")} className={`${selectClass} max-w-[220px]`}>
                            <option value="">{mandatory ? "Unowned — blocks save" : "Unowned — blocks sync if sent"}</option>
                            {picklists.PL_FIELD_OWNER.values.map((entry) => (
                              <option key={entry.value} value={entry.value}>
                                {entry.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Conflict policy" hint="Applies when the ERP sends a different value for a Nucleus-owned field. Held conflicts appear on the sync queue as Queued.">
                <PicklistSelect code="PL_CONFLICT_POLICY" value={form.conflictPolicy} onChange={(value) => value && updateForm((current) => ({ ...current, conflictPolicy: value }))} />
              </FieldLabel>
              {form.conflictPolicy === "latest_wins" ? (
                <p className="self-end rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground">
                  Latest wins needs the ERP&apos;s change time on each record (erpChangedAt). A record sent without it is refused with ERP_CHANGE_TIME_REQUIRED rather than guessed.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Matching</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Match key" hint="Must be unique in both systems; two matches refuse the record.">
                <select value={form.matchKey} onChange={(event) => updateForm((current) => ({ ...current, matchKey: event.target.value as ErpMatchKey }))} className={selectClass}>
                  {ERP_MATCH_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {ERP_MATCH_KEY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Unmatched record action" hint="Hold parks the record on the queue; Create adds the employee; Reject fails the record.">
                <PicklistSelect code="PL_UNMATCHED_ACTION" value={form.unmatchedAction} onChange={(value) => value && updateForm((current) => ({ ...current, unmatchedAction: value }))} />
              </FieldLabel>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Validation</p>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground">
              <span className="font-bold">Mandatory field coverage:</span> {coverage.owned.length} of {coverage.mandatory.length} owned.
              {coverage.complete ? (
                <span className="text-muted-foreground"> Every mandatory field has exactly one owner.</span>
              ) : (
                <span> Save is blocked until {coverage.unowned.map((field) => ERP_SYNC_FIELD_LABELS[field]).join(", ")} {coverage.unowned.length === 1 ? "has" : "have"} an owner.</span>
              )}
              {form.erpSystem === "" ? <span> An ERP system must be chosen.</span> : null}
            </div>
          </div>

          {formError ? <p className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground">{formError}</p> : null}
          {formSuccess ? <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">{formSuccess}</p> : null}
          <Button type="submit" disabled={!canSave} className="h-10 rounded-xl px-5 text-xs font-bold">
            {saving ? "Saving…" : "Save field ownership"}
          </Button>
        </form>
      )}
    </Surface>
  );
}
