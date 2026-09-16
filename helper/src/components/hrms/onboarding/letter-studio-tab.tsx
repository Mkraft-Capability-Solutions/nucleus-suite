"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { AlertTriangle, FileText, Loader2, Printer, ScrollText } from "lucide-react";
import { picklistLabel } from "@/lib/picklists";
import { currencyLabel } from "@/components/hrms/workforce/records";
import {
  asRecord,
  listOf,
  num,
  recordFromEnvelope,
  str,
  useRegisterResource,
  type Notice,
  type UnknownRecord,
} from "../register-primitives";
import { DataTable, SectionHeading, StateBlock, StatusPill, Surface, type Column } from "../page-primitives";

/**
 * HR Letter Studio (SCR-067 sub-module).
 *
 * A merge studio, not a register: the left pane chooses a template and a recipient,
 * the right pane shows that template rendered with that person's real values on a
 * letterhead, and below it the provenance table — every token, the value it resolved
 * to, and the column that supplied it.
 *
 * Three things this surface deliberately does NOT do:
 *
 *   • It never prints a specimen letter. With no template configured it says so and
 *     points at where one is created.
 *   • It never prints a blank where a value is missing. An unresolved token renders
 *     as `[no value: token]`, which the server puts there and stores on the draft.
 *   • It shows no reference number until one is stored. The reference appears after
 *     "Save draft letter" has written it to `generated_letters`, never before.
 *
 * There is no PDF renderer in this system, so there is no "Export PDF" button; the
 * panel note says why rather than offering a control that would do nothing.
 */

const STUDIO_PATH = "/api/v1/letters/studio";
const DOCUMENT_ID = "letter-studio-document";

/**
 * Print scope. `window.print()` prints the page; this restricts what is inked to the
 * document block, so the selectors, the provenance table and the app chrome stay off
 * the paper. Local to this component so no global stylesheet is touched.
 */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #${DOCUMENT_ID}, #${DOCUMENT_ID} * { visibility: visible !important; }
  #${DOCUMENT_ID} {
    position: absolute; left: 0; top: 0; width: 100%;
    margin: 0; padding: 0; border: 0; box-shadow: none;
  }
}
`;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type TemplateOption = {
  id: string;
  name: string;
  code: string;
  letterType: string | null;
  version: string | null;
};

type RecipientOption = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  location: string;
};

type TokenRow = {
  token: string;
  label: string;
  scope: string;
  value: string | null;
  source: string;
  amountMinor: number | null;
  currency: string;
};

type PreviewModel = {
  templateName: string;
  templateCode: string;
  templateVersion: string | null;
  letterType: string | null;
  recipient: RecipientOption;
  subject: string;
  body: string;
  tokens: TokenRow[];
  unresolved: string[];
  referenceNote: string;
};

function readTemplate(row: UnknownRecord): TemplateOption | null {
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    name: str(row.name, "Letter template"),
    code: str(row.code, id.slice(0, 8)),
    letterType: str(row.letterType) || null,
    version: str(row.version) || null,
  };
}

function readRecipient(row: UnknownRecord): RecipientOption | null {
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    employeeCode: str(row.employeeCode, id.slice(0, 8)),
    name: str(row.name, "Unnamed employee"),
    designation: str(row.designation, "No designation on record"),
    department: str(row.department, "No department on record"),
    location: str(row.location, "No location on record"),
  };
}

function readTokenRow(row: UnknownRecord): TokenRow {
  const raw = row.value;
  return {
    token: str(row.token),
    label: str(row.label, str(row.token)),
    scope: str(row.scope, "merge"),
    value: typeof raw === "string" && raw !== "" ? raw : null,
    source: str(row.source, "Source not recorded."),
    amountMinor: typeof row.amountMinor === "number" ? num(row.amountMinor) : null,
    currency: str(row.currency, "INR"),
  };
}

function readPreview(payload: unknown): PreviewModel | null {
  const data = recordFromEnvelope(payload);
  const template = asRecord(data.template);
  const recipient = readRecipient(asRecord(data.recipient));
  if (!str(template.id) || !recipient) return null;
  return {
    templateName: str(template.name, "Letter template"),
    templateCode: str(template.code),
    templateVersion: str(template.version) || null,
    letterType: str(template.letterType) || null,
    recipient,
    subject: str(data.subject),
    body: str(data.body),
    tokens: listOf(data.tokens).map(readTokenRow),
    unresolved: Array.isArray(data.unresolved) ? data.unresolved.filter((value): value is string => typeof value === "string") : [],
    referenceNote: str(data.referenceNote),
  };
}

const SCOPE_LABEL: Record<string, string> = {
  merge: "Merge token",
  recipient: "Recipient",
  letterhead: "Letterhead",
};

/** The letter type label, or the raw code when the vocabulary has no entry for it. */
function letterTypeLabel(value: string | null): string {
  if (!value) return "Untyped";
  const label = picklistLabel("PL_LETTER_TYPE", value);
  return label || value;
}

export function LetterStudioTab() {
  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayISO);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** Set only once the server has stored it. Never shown before a draft exists. */
  const [savedReference, setSavedReference] = useState("");

  const catalogueState = useRegisterResource(STUDIO_PATH);
  const catalogue = useMemo(() => recordFromEnvelope(catalogueState.data), [catalogueState.data]);
  const templates = useMemo(
    () => listOf(catalogue.templates).map(readTemplate).filter((row): row is TemplateOption => row !== null),
    [catalogue.templates],
  );
  const recipients = useMemo(
    () => listOf(catalogue.recipients).map(readRecipient).filter((row): row is RecipientOption => row !== null),
    [catalogue.recipients],
  );
  const compensationReadable = catalogue.compensationReadable === true;

  const previewPath =
    templateId && employeeId && issuedOn
      ? `${STUDIO_PATH}/preview?templateId=${encodeURIComponent(templateId)}&employeeId=${encodeURIComponent(employeeId)}&issuedOn=${encodeURIComponent(issuedOn)}`
      : "";
  const previewState = useRegisterResource(previewPath);
  const preview = useMemo(() => readPreview(previewState.data), [previewState.data]);
  const unresolved = useMemo(() => preview?.tokens.filter((row) => row.scope === "merge" && row.value === null) ?? [], [preview]);

  const letterhead = useMemo(() => {
    const index = new Map(preview?.tokens.map((row) => [row.token, row]) ?? []);
    return {
      company: index.get("letterhead.company")?.value ?? null,
      entityCode: index.get("letterhead.entity_code")?.value ?? null,
      address: index.get("letterhead.address")?.value ?? null,
      issueDate: index.get("letterhead.issue_date")?.value ?? issuedOn,
    };
  }, [preview, issuedOn]);

  /** Selecting a different template or recipient invalidates the stored reference. */
  function chooseTemplate(value: string) {
    setTemplateId(value);
    setSavedReference("");
    setNotice(null);
  }

  function chooseRecipient(value: string) {
    setEmployeeId(value);
    setSavedReference("");
    setNotice(null);
  }

  async function saveDraft() {
    if (!preview) return;
    if (reason.trim().length < 3) {
      setNotice({ text: "A reason of at least 3 characters is required; it is written to the audit trail.", tone: "error" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(STUDIO_PATH, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": newIdempotencyKey() },
        cache: "no-store",
        body: JSON.stringify({ templateId, employeeId, issuedOn, reason: reason.trim() }),
      });
      const payload = asRecord(await response.json().catch(() => null));
      if (!response.ok) {
        setNotice({ text: str(asRecord(payload.error).message, `Request failed (${response.status}).`), tone: "error" });
        return;
      }
      const data = asRecord(payload.data);
      const reference = str(data.reference);
      setSavedReference(reference);
      const holes = Array.isArray(data.unresolved) ? data.unresolved.length : unresolved.length;
      setNotice({
        text: reference
          ? `Draft letter stored as ${reference}.${holes > 0 ? ` ${holes} token${holes === 1 ? "" : "s"} remain unresolved and are marked in the stored body.` : ""}`
          : "Draft letter stored.",
        tone: "success",
      });
    } catch {
      setNotice({ text: "Could not reach the server.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function printDocument() {
    if (typeof window !== "undefined") window.print();
  }

  const tokenColumns: Column<TokenRow>[] = [
    {
      key: "token",
      header: "Token",
      render: (row) => (
        <span className="font-mono text-[11px] tabular-nums text-foreground">
          {row.scope === "merge" ? `{{${row.token}}}` : row.token}
        </span>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      render: (row) => (
        <span className="text-[11px] text-muted-foreground">{SCOPE_LABEL[row.scope] ?? row.scope}</span>
      ),
    },
    {
      key: "value",
      header: "Resolved value",
      render: (row) =>
        row.value === null ? (
          <StatusPill tone="warning" dot>
            no value
          </StatusPill>
        ) : (
          <span className="whitespace-pre-line break-words text-xs text-foreground">
            {row.amountMinor === null ? row.value : currencyLabel(row.amountMinor, row.currency)}
          </span>
        ),
    },
    {
      key: "source",
      header: "Source field",
      render: (row) => <span className="break-words text-[11px] leading-5 text-muted-foreground">{row.source}</span>,
    },
  ];

  const selectClass =
    "mt-1.5 h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground";

  return (
    <div className="min-w-0">
      <style>{PRINT_CSS}</style>

      {notice && (
        <p
          role={notice.tone === "success" ? "status" : "alert"}
          className={`mb-4 rounded-lg border p-3 text-xs text-foreground ${
            notice.tone === "success" ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"
          }`}
        >
          {notice.text}
        </p>
      )}

      {catalogueState.loading && (
        <Surface>
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> Loading the letter studio…
          </p>
        </Surface>
      )}

      {!catalogueState.loading && catalogueState.error && (
        <Surface>
          <StateBlock
            tone="error"
            icon={AlertTriangle}
            title="The letter studio could not be loaded"
            description={catalogueState.error}
            action={
              <button
                type="button"
                onClick={catalogueState.refresh}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-xs font-semibold hover:border-primary/50"
              >
                Try again
              </button>
            }
          />
        </Surface>
      )}

      {!catalogueState.loading && !catalogueState.error && templates.length === 0 && (
        <Surface>
          <StateBlock
            icon={ScrollText}
            title="No letter template is configured"
            description="A letter can only be merged from a template this tenant has saved. Nothing is shown here until one exists — no specimen letter stands in for a real one."
            action={
              <Link
                href="/letters-issue-register"
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-xs font-semibold text-primary hover:border-primary/50"
              >
                Open the letters and issue register
              </Link>
            }
          />
        </Surface>
      )}

      {!catalogueState.loading && !catalogueState.error && templates.length > 0 && (
        // One column on phone and tablet; the two studio panes appear from `lg`.
        // `minmax(0,…)` keeps the preview's tables inside their track instead of
        // widening the page.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Surface>
            <SectionHeading
              title="Document parameters & recipient"
              description="Both lists are this tenant's own records. Changing either re-merges the preview against live data."
            />

            <label className="block text-xs font-semibold text-foreground">
              Letter template
              <select className={selectClass} value={templateId} onChange={(event) => chooseTemplate(event.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.code} · {template.name}
                    {template.version ? ` · ${template.version}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-semibold text-foreground">
              Recipient
              <select className={selectClass} value={employeeId} onChange={(event) => chooseRecipient(event.target.value)}>
                <option value="">Select an employee…</option>
                {recipients.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.employeeCode} · {person.name} · {person.designation} · {person.department}
                  </option>
                ))}
              </select>
            </label>
            {recipients.length === 0 && (
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                No employee records are visible to your role, so there is no one to address a letter to.
              </p>
            )}

            <label className="mt-3 block text-xs font-semibold text-foreground">
              Issue date
              <input
                type="date"
                className={selectClass}
                value={issuedOn}
                onChange={(event) => {
                  setIssuedOn(event.target.value);
                  setSavedReference("");
                }}
              />
            </label>

            <label className="mt-3 block text-xs font-semibold text-foreground">
              Reason for this draft
              <input
                type="text"
                className={selectClass}
                value={reason}
                placeholder="Recorded on the audit trail"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={busy || !preview}
                className="inline-flex h-10 max-w-full items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save draft letter"}
              </button>
              <button
                type="button"
                onClick={printDocument}
                disabled={!preview}
                className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-xs font-bold hover:border-primary/50 disabled:opacity-60"
              >
                <Printer className="size-3.5" aria-hidden /> Print document
              </button>
            </div>

            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
              Saving writes a real <span className="font-mono">generated_letters</span> draft — merged body, reference
              number, template, recipient and issue date — and records the reason on the audit trail. Printing inks the
              document block only.
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              There is no PDF export: this system has no PDF renderer, and a button that produced nothing would be worse
              than its absence. Print to PDF from the browser dialog if a file is needed.
            </p>
            {!compensationReadable && (
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                Pay figures are withheld from this preview: your role does not hold the payroll read permission, so those
                tokens resolve to no value rather than to a number you may not see.
              </p>
            )}
          </Surface>

          <Surface>
            <SectionHeading
              title="Formatted document preview"
              description="The selected template merged with this recipient's stored values."
              action={
                preview ? (
                  <StatusPill tone={unresolved.length === 0 ? "success" : "warning"} dot>
                    {unresolved.length === 0 ? "All tokens resolved" : `${unresolved.length} unresolved`}
                  </StatusPill>
                ) : undefined
              }
            />

            {!previewPath && (
              <StateBlock
                icon={FileText}
                title="Pick a template and a recipient"
                description="The preview merges live values from the chosen employee's record; nothing is rendered until both are chosen."
              />
            )}

            {previewPath && previewState.loading && (
              <p role="status" className="flex items-center gap-2 p-4 text-sm font-semibold text-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> Merging the document…
              </p>
            )}

            {previewPath && !previewState.loading && previewState.error && (
              <StateBlock
                tone="error"
                icon={AlertTriangle}
                title="This letter could not be merged"
                description={previewState.error}
                action={
                  <button
                    type="button"
                    onClick={previewState.refresh}
                    className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-xs font-semibold hover:border-primary/50"
                  >
                    Try again
                  </button>
                }
              />
            )}

            {previewPath && !previewState.loading && !previewState.error && preview && (
              <>
                <div id={DOCUMENT_ID} className="rounded-lg border border-border bg-background p-5 sm:p-6">
                  <header className="border-b border-border pb-4">
                    <p className="font-heading text-base font-semibold text-foreground">
                      {letterhead.company ?? "[no value: letterhead.company]"}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {letterhead.entityCode ? `Entity ${letterhead.entityCode}` : "[no value: letterhead.entity_code]"}
                      {" · "}
                      {letterhead.address ?? "[no value: letterhead.address]"}
                    </p>
                  </header>

                  <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      Reference:{" "}
                      {savedReference ? (
                        <span className="font-mono tabular-nums text-foreground">{savedReference}</span>
                      ) : (
                        "assigned when the draft is saved"
                      )}
                    </span>
                    <span>Date: {letterhead.issueDate}</span>
                  </div>

                  <div className="mt-4 text-xs leading-5 text-foreground">
                    <p className="font-semibold">{preview.recipient.name}</p>
                    <p className="text-muted-foreground">
                      {preview.recipient.employeeCode} · {preview.recipient.designation}
                    </p>
                    <p className="text-muted-foreground">
                      {preview.recipient.department} · {preview.recipient.location}
                    </p>
                  </div>

                  {preview.subject && (
                    <p className="mt-4 text-sm font-semibold text-foreground">Subject: {preview.subject}</p>
                  )}

                  <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {preview.body}
                  </div>

                  <p className="mt-6 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
                    {preview.templateName}
                    {preview.templateCode ? ` · ${preview.templateCode}` : ""}
                    {preview.templateVersion ? ` · version ${preview.templateVersion}` : ""} ·{" "}
                    {letterTypeLabel(preview.letterType)}
                  </p>
                </div>

                {unresolved.length > 0 && (
                  <p
                    role="status"
                    className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[11px] leading-5 text-foreground"
                  >
                    {unresolved.length} token{unresolved.length === 1 ? "" : "s"} could not be resolved from this
                    tenant&apos;s data and appear in the document as an explicit marker. The table below names the source
                    each one would have come from. A draft may be saved with them; issuing a letter still refuses while
                    any remain.
                  </p>
                )}

                <div className="mt-5">
                  <SectionHeading
                    title="Merge provenance"
                    description="Every token in this document, the value it resolved to, and the column that supplied it."
                  />
                  <div className="-mx-5">
                    <DataTable
                      columns={tokenColumns}
                      rows={preview.tokens}
                      rowKey={(row) => row.token}
                      minWidth={560}
                      caption="Merge tokens with their resolved values and source fields"
                      empty={
                        <StateBlock
                          icon={FileText}
                          title="This template carries no merge tokens"
                          description="Its text is the same for every recipient, so there is nothing to resolve."
                        />
                      }
                    />
                  </div>
                  <p className="mt-2 px-1 text-[11px] leading-5 text-muted-foreground">{preview.referenceNote}</p>
                </div>
              </>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}
