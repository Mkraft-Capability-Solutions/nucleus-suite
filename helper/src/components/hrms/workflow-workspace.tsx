"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { operationalResources } from "@/lib/operational-catalog";
import { authorizedWorkflowGroups } from "@/lib/workflow-layout";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { picklistLabel } from "@/lib/picklists";
import { Field, WorkflowOperation, humanize, initialValue, normalizeValue, operationLabel, permitted, recordLabel, sectionLabel, unwrapRecords, workflowGuides, workflowOperations } from "@/lib/workflow-catalog";
import { useWorkspace } from "./workspace-provider";
import { PageIntro, SectionHeading, StatusPill, Surface } from "./page-primitives";
import {
  ModuleTabs,
  ModuleStat,
  RegisterNotice,
  RegisterStates,
  TabPanel,
  listFromEnvelope,
  listOf,
  postRegisterAction,
  recordFromEnvelope,
  useRegisterResource,
  type Notice,
} from "./register-primitives";

// `min-h-10` keeps every control a 40 px touch target on a phone; `max-w-full`
// stops a long placeholder or a date picker widening its parent past the viewport.
const control = "block w-full min-w-0 max-w-full min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-sm";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-center text-sm disabled:opacity-50 hover:bg-secondary";
type Row = Record<string, unknown>;
const lookups: Record<string, string> = {
  employmentId: "dossier-lookups/employments", jurisdictionId: "dossier-lookups/jurisdictions", legalEntityId: "dossier-lookups/legalEntities", workerCategoryId: "dossier-lookups/workerCategories", locationId: "dossier-lookups/locations", gradeId: "dossier-lookups/grades", costCenterId: "dossier-lookups/costCenters",
  batchId: "commands/create_gl_posting", offboardingCaseId: "offboarding/cases", generatedFormId: "commands/generate_statutory_form",
  projectId: "operations/projects", travelId: "operations/travel", ownerEmployeeId: "dossier-lookups/employees",
  agencyId: "contractors/agencies", contractId: "contractors/contracts", cycleCode: "review-cycles", objectiveId: "objectives", candidateId: "candidates",
  employeeId: "dossier-lookups/employees", managerEmployeeId: "dossier-lookups/employees", hiringManagerEmployeeId: "dossier-lookups/employees", recipientEmployeeId: "dossier-lookups/employees", guarantorEmployeeId: "dossier-lookups/employees", replacementEmployeeId: "dossier-lookups/employees", assigneeEmployeeId: "dossier-lookups/employees",
  departmentId: "organization/departments", positionId: "organization/positions", courseCode: "courses", applicationId: "applications", requisitionId: "requisitions", payrollRunId: "payroll-runs", loanId: "loans", roleId: "roles", membershipId: "identity/memberships", templateId: "onboarding/templates", documentId: "documents", reviewCycleId: "review-cycles", connectionId: "integrations/connections",
  calendarId: "dossier-lookups/holidayCalendars", proofDocumentId: "documents", receiptDocumentId: "documents",
};

function ReferenceInput({ field, value, onChange, endpoint }: { field: Field; value: unknown; onChange: (v: unknown) => void; endpoint: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const listId = useId();
  const text = String(value ?? "");
  const supportsSearch = endpoint.includes("/dossier-lookups/") || endpoint.includes("/operations/") || workflowOperations.some(op => op.method === "GET" && op.path === endpoint && op.query.includes("search"));
  const search = supportsSearch && !/^[a-f0-9-]{36}$/i.test(text) ? text : "";
  const url = endpoint + (endpoint.includes("?") ? "&" : "?") + "search=" + encodeURIComponent(search);
  const currentUrl = useRef(url);
  useEffect(() => {
    currentUrl.current = url;
    let live = true;
    const timer = setTimeout(() => {
      getJson(url).then(data => {
        if (live) { setRows(unwrapRecords(data)); setCursor(((data as {meta?:{nextCursor?:string}}).meta?.nextCursor) ?? null); setError(""); setLoading(false); }
      }).catch(e => { if (live) { setRows([]); setCursor(null); setError(e.message); setLoading(false); } });
    }, search ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [url, search]);
  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const data = await getJson(url + "&cursor=" + encodeURIComponent(cursor));
      if (currentUrl.current === url) { setRows(previous => [...previous, ...unwrapRecords(data)]); setCursor((data as {meta?:{nextCursor?:string}}).meta?.nextCursor ?? null); setError(""); }
    } catch (caught) { if(currentUrl.current === url) setError(caught instanceof Error ? caught.message : "Choices could not be loaded."); }
    finally { if(currentUrl.current === url) setLoading(false); }
  }
  return <>
    <input className={control} list={listId} value={text} onChange={e => onChange(e.target.value)} required={!field.optional} placeholder={loading ? "Loading available records…" : "Search by name or enter a reference"} />
    <datalist id={listId}>{rows.filter(r => r.id).map((r, index) => <option key={String(r.id) + "-" + index} value={String(field.name?.endsWith("Code") ? r.code : r.id)}>{recordLabel(r)}</option>)}</datalist>
    {cursor && <button className={button} type="button" disabled={loading} onClick={() => void more()}>Load more choices</button>}
    {error && <span className="block text-xs text-destructive">Could not load choices: {error}</span>}
  </>;
}

function FieldControl({ field, value, onChange, path = "form" }: { field: Field; value: unknown; onChange: (v: unknown) => void; path?: string }) {
  const name = field.name ?? "Value";
  const label = humanize(name);
  // Derived fields are reported, not collected: the server computes them on save, so an
  // editable control here would show a number the next write silently replaces.
  if (field.derived) return <label className="block min-w-0 space-y-1.5 text-sm"><span className="font-medium">{label} (derived)</span>
    <output className="block rounded-md border border-border bg-muted px-3 py-2 tabular-nums">{value === null || value === undefined || value === "" ? "Not yet computed" : String(value)}</output></label>;
  if (field.kind === "null") return <span className="text-sm">No value</span>;
  if (field.kind === "unknown") return <VariantField field={{ ...field, kind: "union", variants: [{ kind: "text" }, { kind: "number" }, { kind: "boolean" }] }} value={value} onChange={onChange} path={path} />;
  if (field.optional && ["object", "array", "record"].includes(field.kind) && value === undefined) return <button type="button" className={button} onClick={() => onChange(initialValue({ ...field, optional: false }))}>Add {label.toLowerCase()} (optional)</button>;
  if (field.kind === "object" && field.fields?.some(f => f.name === "contentBase64")) return <DocumentFields field={field} value={value} onChange={onChange} path={path} />;
  if (field.kind === "object") return <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">{field.name ? label : "Details"}</legend>{field.fields?.map(f => <FieldControl key={f.name} field={f} value={(value as Row)?.[f.name!]} onChange={v => onChange({ ...(value as Row), [f.name!]: v })} path={`${path}.${f.name}`} />)}</fieldset>;
  if (field.kind === "array") {
    const rows = Array.isArray(value) ? value : [];
    return <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">{label}{!field.optional && " *"}</legend>{rows.map((v, i) => <div key={i} className="min-w-0 space-y-2 rounded border border-border p-2"><FieldControl field={field.item!} value={v} onChange={next => onChange(rows.map((r, j) => j === i ? next : r))} path={`${path}.${i}`} /><button className={button} type="button" disabled={rows.length <= (field.min ?? 0)} onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove item {i + 1}</button></div>)}<button className={button} type="button" disabled={rows.length >= (field.max ?? 1000)} onClick={() => onChange([...rows, initialValue(field.item!)])}>Add item</button></fieldset>;
  }
  if (field.kind === "record") return <KeyValueFields field={field} value={value} onChange={onChange} path={path} />;
  if (field.kind === "union") return <VariantField field={field} value={value} onChange={onChange} path={path} />;
  const lookup = lookups[name];
  const type = field.kind === "number" ? "number" : field.format === "date" ? "date" : field.format === "month" ? "month" : field.format === "datetime" ? "datetime-local" : field.format === "email" ? "email" : field.format === "url" ? "url" : /password|secret|token/i.test(name) ? "password" : "text";
  return <label className="block min-w-0 space-y-1.5 text-sm"><span className="font-medium">{label}{field.optional ? " (optional)" : " *"}</span>
    {field.kind === "select" ? <select className={control} value={String(value ?? "")} required={!field.optional} onChange={e => onChange(field.options?.find(o => String(o) === e.target.value) ?? "")}><option value="">Select…</option>{field.options?.map(o => <option key={String(o)} value={String(o)}>{optionLabel(field, o)}</option>)}</select>
      : field.kind === "boolean" ? <input type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} className="ml-2 size-4" />
      : lookup ? <ReferenceInput field={field} value={value} onChange={onChange} endpoint={`/api/v1/${lookup}`} />
      : /reason|description|notes|message|resolution|summary|content/i.test(name) && type === "text" ? <textarea className={control} rows={3} value={String(value ?? "")} required={!field.optional} minLength={field.min} maxLength={field.max} onChange={e => onChange(e.target.value)} />
      : <input className={control} type={type} value={String(value ?? "")} required={!field.optional} min={type === "number" ? field.min : undefined} max={type === "number" ? field.max : undefined} step={field.integer ? 1 : "any"} minLength={type === "text" ? field.min : undefined} maxLength={type === "text" ? field.max : undefined} pattern={field.format === "uuid" ? "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" : undefined} onChange={e => onChange(e.target.value)} />}
    {/Minor$/.test(name) && <span className="block text-xs text-muted-foreground">Enter whole paise: ₹1 = 100 paise.</span>}
  </label>;
}
/** A picklist-backed option prints the workbook's own label; anything else is humanised. */
function optionLabel(field: Field, option: string | number | boolean) {
  return field.picklist ? picklistLabel(field.picklist, String(option)) : humanize(String(option));
}
function VariantField({ field, value, onChange, path }: { field: Field; value: unknown; onChange: (v: unknown) => void; path: string }) {
  const [variant, setVariant] = useState(0);
  return <div className="min-w-0 space-y-2"><label className="block min-w-0 text-sm">{humanize(field.name ?? "Value type")}<select className={control} value={variant} onChange={e => { const i = Number(e.target.value); setVariant(i); onChange(initialValue(field.variants![i])); }}>{field.variants?.map((v, i) => <option key={i} value={i}>{v.fields?.find(f => f.name === "action")?.options?.[0] ?? humanize(v.kind)}</option>)}</select></label><FieldControl field={field.variants![variant]} value={value} onChange={v => onChange(field.variants![variant].kind === "number" && v !== "" ? Number(v) : v)} path={path} /></div>;
}
function KeyValueFields({ field, value, onChange, path }: { field: Field; value: unknown; onChange: (v: unknown) => void; path: string }) {
  const [key, setKey] = useState(""); const entries = Object.entries((value ?? {}) as Row);
  return <fieldset className="min-w-0 space-y-2 rounded-lg border border-border p-3"><legend>{humanize(field.name ?? "Properties")}</legend>{entries.map(([k, v]) => <div key={k}><FieldControl field={{ ...(field.item ?? { kind: "text" }), name: k }} value={v} onChange={next => onChange({ ...(value as Row), [k]: next })} path={`${path}.${k}`} /><button type="button" className={button} onClick={() => onChange(Object.fromEntries(entries.filter(([name]) => name !== k)))}>Remove {k}</button></div>)}<label className="block min-w-0 text-sm">Property name<input className={control} value={key} onChange={e => setKey(e.target.value)} /></label><button type="button" className={button} disabled={!key.trim() || ["__proto__", "constructor", "prototype"].includes(key)} onClick={() => { onChange({ ...(value as Row), [key.trim()]: initialValue(field.item ?? { kind: "text" }) }); setKey(""); }}>Add property</button></fieldset>;
}

function RecordDetails({ record }: { record: unknown }) {
  if (Array.isArray(record)) return <div className="space-y-2">{record.map((v, i) => <RecordDetails key={i} record={v} />)}</div>;
  if (record && typeof record === "object" && "contentBase64" in record) return <DocumentDownload record={record as Row} />;
  if (record && typeof record === "object") return <dl className="grid min-w-0 gap-2 text-sm">{Object.entries(record).filter(([k]) => !/secret|token|password|tenant.?id/i.test(k)).map(([k, v]) => <div className="min-w-0 border-b border-border pb-2" key={k}><dt className="break-words font-medium text-muted-foreground">{humanize(k)}</dt><dd className="break-words">{v && typeof v === "object" ? <RecordDetails record={v} /> : String(v ?? "—")}</dd></div>)}</dl>;
  return <span>{String(record ?? "—")}</span>;
}

export function OperationForm({ operation, selected, onSaved, onClose }: { operation: WorkflowOperation; selected: Row | null; onSaved: (row: Row) => void; onClose: () => void }) {
  const [values, setValues] = useState<unknown>(() => {
    const defaults = initialValue(operation.body) as Row;
    if (operation.method !== "PATCH" || !selected) return defaults;
    return Object.fromEntries((operation.body.fields ?? []).map(f => [f.name!, selected[f.name!] ?? defaults?.[f.name!]]));
  });
  const [reference, setReference] = useState(String(selected?.id ?? ""));
  const [version, setVersion] = useState(String(selected?.version ?? ""));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState<unknown>(null);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const locked = useRef(false);
  const isRead = operation.method === "GET";
  const parent = operation.path.split("/[")[0];
  const hasParentList = workflowOperations.some(o => o.path === parent && o.method === "GET");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const path = operation.path.replace(/\[[^\]]+\]/g, encodeURIComponent(reference));
      const body = normalizeValue(operation.body, values);
      const fingerprint = JSON.stringify({ path, body, version });
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
      const headers: Record<string, string> = { "content-type": "application/json", "Idempotency-Key": attempt.current!.key };
      if (operation.version) headers["If-Match"] = `"${version}"`;
      const response = await fetch(path, { method: operation.method, headers, ...(isRead ? {} : { body: JSON.stringify(body) }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const details = payload?.error?.details?.map((d: { field: string; issue: string }) => `${humanize(d.field)}: ${d.issue}`).join("; ");
        throw new Error([payload?.error?.message ?? `Request failed (${response.status}).`, details].filter(Boolean).join(" "));
      }
      setResult(payload?.data ?? payload);
      if (!isRead) { invalidateGetRequests(); onSaved(unwrapRecords(payload)[0] ?? {}); attempt.current = null; }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The operation failed. Your form has been preserved."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section className="min-w-0 rounded-lg border border-border bg-card p-4" aria-label={`${operationLabel(operation)} form`}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold">{operationLabel(operation)} · {sectionLabel(operation.section)}</h3><button className={`${button} shrink-0`} type="button" onClick={onClose} disabled={busy}>Close</button></div>
    <form onSubmit={submit} className="min-w-0 space-y-4"><fieldset disabled={busy || (result !== null && !isRead)} className="min-w-0 space-y-4">
      {operation.path.includes("[") && <label className="block min-w-0 space-y-1 text-sm">Record *{selected?.id ? <input className={control} value={reference} readOnly /> : hasParentList ? <ReferenceInput field={{ name: "recordId", kind: "text" }} value={reference} onChange={v => setReference(String(v))} endpoint={parent} /> : <input className={control} required value={reference} onChange={e => setReference(e.target.value)} />}</label>}
      {operation.version && <label className="block min-w-0 space-y-1 text-sm">Current record version *<input className={control} required type="number" min={1} step={1} readOnly={selected?.version !== undefined} value={version} onChange={e => setVersion(e.target.value)} /><span className="text-xs text-muted-foreground">Use the version from the latest record details. Refresh the record if it has changed.</span></label>}
      <FieldControl field={operation.body} value={values} onChange={setValues} />
      {!isRead && operation.path.includes("[") && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" required className="size-4 shrink-0" />I have reviewed this record and the details of this action.</label>}
      <button className={`${button} bg-primary text-primary-foreground`} type="submit" disabled={busy}>{busy ? "Working…" : operationLabel(operation)}</button>
    </fieldset></form>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {result !== null && <div className="mt-4 space-y-3"><p role="status" className="text-sm font-medium">{isRead ? "Record loaded." : "Saved successfully."}</p><RecordDetails record={result} /></div>}
  </section>;
}

function actionAvailable(operation: WorkflowOperation, selected: Row | null, membershipId?: string, employeeId?: string | null) {
  if (!selected || !operation.section.startsWith("operations/")) return true;
  const definition=operationalResources[operation.section.slice("operations/".length)];
  if(!definition)return false;
  if(operation.method==="PATCH")return definition.editable.includes(String(selected.status));
  if(operation.method==="GET")return true;
  const transition=definition.transitions[operation.path.split("/").at(-1)!];
  if(transition?.approval && ((membershipId && selected.createdByMembershipId === membershipId) || (employeeId && selected.employeeId === employeeId)))return false;
  return transition?.from.includes(String(selected.status)) ?? false;
}

function SectionWorkspace({ module, section, record }: { module: string; section: string; record?: string }) {
  const { workspace } = useWorkspace();
  const permissions = workspace?.context?.permissions ?? [];
  const operations = workflowOperations.filter(o => o.module === module && o.section === section && permitted(o, permissions));
  const listing = operations.find(o => o.method === "GET" && !o.path.includes("["));
  const [rows, setRows] = useState<Row[]>([]); const [selected, setSelected] = useState<Row | null>(null);
  const [active, setActive] = useState<WorkflowOperation | null>(null); const [query, setQuery] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1); const [hasNext, setHasNext] = useState(false); const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(!!listing); const [error, setError] = useState(""); const [filter, setFilter] = useState("");
  const listingPath = listing?.path;
  const queryString = new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)), page: String(page) }).toString();
  useEffect(() => {
    if (!listingPath) return;
    let live = true;
    getJson(`${listingPath}?${queryString}`).then(payload => {
      if (!live) return;
      const nextRows = unwrapRecords(payload);
      setRows(nextRows); if (record) setSelected(nextRows.find(row => String(row.id) === record) ?? null); setHasNext(!!(payload as { meta?: { nextCursor?: string } })?.meta?.nextCursor); setLoading(false); setError("");
    }).catch(e => { if (live) { setLoading(false); setError(e.message); } });
    return () => { live = false; };
  }, [listingPath, queryString, record, refresh]);
  const visible = rows.filter(r => Object.values(r).some(v => typeof v !== "object" && String(v).toLowerCase().includes(filter.toLowerCase())));
  return <div className="min-w-0 space-y-4">
    <div className="min-w-0"><h2 className="break-words text-xl font-semibold">{sectionLabel(section)}</h2></div>
    <div className="flex min-w-0 flex-wrap gap-2">{operations.filter(o => o !== listing && !o.path.includes("[")).map(o => <button key={o.id} type="button" className={button} onClick={() => setActive(o)}>{operationLabel(o)}{operations.filter(x => operationLabel(x) === operationLabel(o)).length > 1 ? ` · ${humanize(o.path.split("/").at(-1)!)}` : ""}</button>)}</div>
    {active && <OperationForm key={`${active.id}:${selected?.id ?? "new"}`} operation={active} selected={selected} onClose={() => setActive(null)} onSaved={row => { setSelected(current => current && row.id === current.id ? { ...current, ...row } : current); setRefresh(n => n + 1); }} />}
    {listing && <>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); setQuery(Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)]))); setPage(1); setLoading(true); setSelected(null); }}>
        {listing.query.filter(q => !["page", "pageSize", "cursor"].includes(q)).map(q => <label className="block w-full min-w-0 text-sm sm:w-56" key={q}>Filter by {humanize(q).toLowerCase()}<input className={control} name={q} type={/^(from|to|date|asOf)$/.test(q) ? "date" : "text"} /></label>)}
        <button type="submit" className={`${button} w-full sm:w-auto`}>Apply filters</button><button type="button" className={`${button} w-full sm:w-auto`} onClick={() => { invalidateGetRequests(); setLoading(true); setSelected(null); setRefresh(n => n + 1); }}>Refresh</button>
      </form>
      <label className="block min-w-0 text-sm">Find in loaded records<input className={control} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Name, code or status" /></label>
      {loading ? <p role="status">Loading records…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <div className="w-full max-w-full overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="whitespace-nowrap"><th className="p-3">Record</th><th className="p-3">Status</th><th className="p-3">Reference</th><th className="p-3">Actions</th></tr></thead><tbody>{visible.map((r, index) => <tr key={`${String(r.id)}:${index}`} className="border-t border-border"><td className="p-3">{recordLabel(r)}</td><td className="p-3">{String(r.status ?? r.state ?? "—")}</td><td className="max-w-48 break-all p-3 text-xs">{String(r.id ?? r.code ?? "—")}</td><td className="p-3"><button className={`${button} whitespace-nowrap`} type="button" onClick={() => { setSelected(r); setActive(null); }}>Select / view</button></td></tr>)}</tbody></table>{!visible.length && <p className="p-4 text-sm">No records match. Create a record or adjust the filters.</p>}</div>}
      <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} disabled={page === 1} onClick={() => { setPage(p => p - 1); setSelected(null); }}>Previous</button><span className="text-sm">Page {page}</span><button type="button" className={button} disabled={!hasNext} onClick={() => { setPage(p => p + 1); setSelected(null); }}>Next</button></div>
    </>}
    {!listing && <div className="flex flex-wrap gap-2">{operations.filter(o => o.path.includes("[") && actionAvailable(o, selected, workspace?.context?.membershipId, workspace?.context?.employeeId)).map(o => <button key={o.id} type="button" className={button} onClick={() => setActive(o)}>{operationLabel(o)}</button>)}</div>}
    {!listing && <p className="text-sm text-muted-foreground">Use the actions above to submit or look up a record. Related records are available through Work with.</p>}
    {selected && !active && <section className="min-w-0 space-y-3 rounded-lg border border-border p-4"><h3 className="break-words font-semibold">Selected: {recordLabel(selected)}</h3><RecordDetails record={selected} /><div className="flex flex-wrap gap-2">{operations.filter(o => o.path.includes("[") && actionAvailable(o, selected, workspace?.context?.membershipId, workspace?.context?.employeeId)).map(o => <button key={o.id} type="button" className={button} onClick={() => setActive(o)}>{operationLabel(o)}</button>)}</div></section>}
  </div>;
}

export function WorkflowWorkspace({ module, section, record, children }: { module: string; section?: string; record?: string; children: React.ReactNode }) {
  const { workspace, loading } = useWorkspace();
  const router = useRouter();
  const groups = authorizedWorkflowGroups(module, workspace?.context?.permissions ?? []);
  const group = groups.find(g => g.id === section || g.sections.includes(section ?? ""));
  const activeSection = group?.sections.includes(section ?? "") ? section! : group?.sections[0];
  return <div className="min-w-0 space-y-5">
    {groups.length > 0 && <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-border pb-1" aria-label="Module sections">
      <Link className={`${button} shrink-0 whitespace-nowrap`} href={"/" + module} aria-current={!section ? "page" : undefined}>Overview</Link>
      {groups.map(g => <Link key={g.id} className={button + " shrink-0 whitespace-nowrap " + (group?.id === g.id ? "bg-secondary font-semibold" : "")} href={"/" + module + "?section=" + g.id} aria-current={group?.id === g.id ? "page" : undefined}>{g.label}</Link>)}
    </nav>}
    {section ? loading ? <p role="status">Loading workspace…</p> : group && activeSection ? <>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0"><h1 className="break-words text-lg font-semibold">{group.label}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{workflowGuides[module]}</p></div>
        {group.sections.length > 1 && <label className="block w-full min-w-0 text-sm font-medium sm:w-64">Work with
          <select className={control} value={activeSection} onChange={event => router.push("/" + module + "?section=" + encodeURIComponent(event.target.value))}>
            {group.sections.map(resource => <option key={resource} value={resource}>{sectionLabel(resource)}</option>)}
          </select>
        </label>}
      </div>
      <SectionWorkspace key={workspace?.context?.tenantId + ":" + activeSection} module={module} section={activeSection} record={record} />
    </> : <p role="alert">This section is unavailable for your current access. Choose a workflow above.</p> : children}
  </div>;
}

type ReconciliationRow = {
  id: string; agencyName: string; agencyCode: string; site: string; period: string;
  billedHours: number; billedMinor: number; verifiedHours: number; verifiedMinor: number;
  deltaHours: number; variancePct: number; currency: string; workerCount: number;
  status: string; verdict: string;
};
type WorkerLogRow = { id: string; workerName: string; workerCode: string; trade: string; billedHours: number; verifiedHours: number; deltaHours: number };
type ContractWorkerRow = { id: string; workerName: string; workerCode: string; trade: string; category: string; agencyName: string; contractNumber: string; site: string; verified: boolean };
type AgencyRow = { id: string; name: string; code: string; pan: string; contactPerson: string; contactPhone: string; contractCount: number; workerCount: number; evidenceState: string; evidencePeriod: string };

const CONTRACTOR_TABS = [
  { id: "reconciliation", label: "Gate Punch vs Invoice Reconciliation" },
  { id: "registry", label: "Contract Worker Registry" },
  { id: "vendors", label: "Staffing Vendor Master" },
] as const;

/** Amounts are stored in minor units; nothing is ever printed at minor scale. */
function formatMinor(amountMinor: number, currency: string): string {
  const value = (Number(amountMinor) || 0) / 100;
  const code = currency || "INR";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function formatHours(hours: number): string {
  return `${(Number(hours) || 0).toFixed(2)} h`;
}

function verdictTone(verdict: string): "success" | "warning" | "danger" | "neutral" {
  if (verdict === "action_required") return "danger";
  if (verdict === "disputed") return "warning";
  if (verdict === "approved" || verdict === "within_tolerance") return "success";
  return "neutral";
}

function verdictLabel(verdict: string): string {
  if (verdict === "action_required") return "Action required";
  if (verdict === "disputed") return "Disputed";
  if (verdict === "approved") return "Approved";
  if (verdict === "within_tolerance") return "Within tolerance";
  return "Not assessed";
}

function ReconciliationCard({ row, onDisputed }: { row: ReconciliationRow; onDisputed: (notice: Notice) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const detailState = useRegisterResource(expanded ? `/api/v1/contractors/reconciliation/${encodeURIComponent(row.id)}` : "");
  const detail = useMemo(() => recordFromEnvelope(detailState.data), [detailState.data]);
  const workerLogs = useMemo(() => listOf(detail.workerLogs) as unknown as WorkerLogRow[], [detail]);
  const overBilledMinor = Math.max(0, row.billedMinor - row.verifiedMinor);

  async function dispute() {
    const reason = window.prompt(`Why is invoice for ${row.agencyName} (${row.period}) being disputed?`);
    if (reason === null) return;
    if (reason.trim().length < 3) {
      onDisputed({ text: "Record a reason of at least 3 characters to raise a dispute.", tone: "error" });
      return;
    }
    setBusy(true);
    const outcome = await postRegisterAction(`/api/v1/contractors/reconciliation/${encodeURIComponent(row.id)}/dispute`, { reason: reason.trim() });
    setBusy(false);
    onDisputed(outcome.ok
      ? { text: `Dispute raised against ${row.agencyName} for ${row.period}.`, tone: "success" }
      : { text: outcome.message, tone: "error" });
  }

  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{row.agencyName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.agencyCode || "No agency code"} · {row.site || "Site not recorded"} · Period {row.period || "—"} · {row.workerCount} worker(s) on contract
          </p>
        </div>
        <StatusPill tone={verdictTone(row.verdict)} dot>{verdictLabel(row.verdict)}</StatusPill>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vendor Billed</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatHours(row.billedHours)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatMinor(row.billedMinor, row.currency)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gate Verified</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatHours(row.verifiedHours)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatMinor(row.verifiedMinor, row.currency)}</p>
        </div>
      </div>

      {row.deltaHours > 0 ? (
        <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive tabular-nums">
          Over-billed by {formatHours(row.deltaHours)} ({row.variancePct.toFixed(2)}%) · {formatMinor(overBilledMinor, row.currency)}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {row.verifiedHours === 0
            ? "No gate-verified hours are tied to this contract's workers for this period, so no over-billing can be proven."
            : "No over-billing detected against the gate record for this period."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-3 text-xs font-semibold hover:border-primary/50"
        >
          {expanded ? "Hide worker logs" : `Inspect ${row.workerCount} worker logs`}
        </button>
        <button
          type="button"
          onClick={dispute}
          disabled={busy || row.verdict === "disputed"}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-3 text-xs font-bold hover:border-primary/50 disabled:opacity-60"
        >
          {busy ? "Saving…" : row.verdict === "disputed" ? "Dispute raised" : "Issue Dispute"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <RegisterStates
            loading={detailState.loading}
            error={detailState.error}
            empty={!detailState.loading && !detailState.error && workerLogs.length === 0}
            onRetry={detailState.refresh}
            loadingLabel="Loading the per-worker gate logs…"
            errorTitle="Worker logs unavailable"
            emptyTitle="No contract workers on this invoice"
            emptyHint="No worker is assigned to this contract, so there is no per-worker breakdown to show."
          />
          {!detailState.loading && !detailState.error && workerLogs.length > 0 && (
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Worker</th>
                    <th className="px-3 py-2">Trade</th>
                    <th className="px-3 py-2">Billed</th>
                    <th className="px-3 py-2">Gate verified</th>
                    <th className="px-3 py-2">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {workerLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-xs font-semibold text-foreground">
                        {log.workerName || "Unnamed worker"}
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">{log.workerCode}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{log.trade || "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{formatHours(log.billedHours)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{formatHours(log.verifiedHours)}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{formatHours(log.deltaHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

export function ContractorsOverview() {
  const [tab, setTab] = useState<string>("reconciliation");
  const [notice, setNotice] = useState<Notice | null>(null);

  const reconState = useRegisterResource("/api/v1/contractors/reconciliation");
  const workersState = useRegisterResource("/api/v1/contractors/reconciliation/registry");
  const agenciesState = useRegisterResource("/api/v1/contractors/reconciliation/vendors");

  const rows = useMemo(() => listFromEnvelope(reconState.data) as unknown as ReconciliationRow[], [reconState.data]);
  const workers = useMemo(() => listFromEnvelope(workersState.data) as unknown as ContractWorkerRow[], [workersState.data]);
  const agencies = useMemo(() => listFromEnvelope(agenciesState.data) as unknown as AgencyRow[], [agenciesState.data]);

  // The banner totals are summed from the rows on screen, never stored or guessed.
  const discrepancy = useMemo(() => {
    const currency = rows.find((row) => row.currency)?.currency ?? "INR";
    let deltaHours = 0;
    let overBilledMinor = 0;
    for (const row of rows) {
      if (row.deltaHours > 0) deltaHours += row.deltaHours;
      const gap = row.billedMinor - row.verifiedMinor;
      if (gap > 0 && row.deltaHours > 0) overBilledMinor += gap;
    }
    return { deltaHours: Math.round(deltaHours * 100) / 100, overBilledMinor, currency };
  }, [rows]);

  const verifiedHours = useMemo(() => rows.reduce((total, row) => total + (Number(row.verifiedHours) || 0), 0), [rows]);
  const disputedCount = useMemo(() => rows.filter((row) => row.verdict === "disputed").length, [rows]);

  const tabs = CONTRACTOR_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === "reconciliation" ? rows.length
      : entry.id === "registry" ? workers.length
      : agencies.length,
  }));

  function refreshAll() {
    reconState.refresh();
    workersState.refresh();
    agenciesState.refresh();
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="Workforce Management · Contract & Contingent"
        title="Contract & Contingent Workforce Management"
        description="Treating contractor personnel and gig associates as first-class workforce peers, with biometric gate attendance reconciliation to eliminate invoice overbilling and guarantee Principal Employer statutory compliance."
        action={
          <span className="flex flex-wrap gap-2">
            <Link
              href="/statutory-compliance"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold hover:border-primary/50"
            >
              Statutory Audit
            </Link>
            <Link
              href="/contractors?section=contractors/assignments"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              Register Contract Worker
            </Link>
          </span>
        }
      />
      <RegisterNotice notice={notice} />

      {rows.length > 0 && (discrepancy.deltaHours > 0 || discrepancy.overBilledMinor > 0) && (
        <div role="status" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-bold text-destructive">Invoice discrepancy detected</p>
          <p className="mt-1 text-xs leading-5 text-foreground tabular-nums">
            Across {rows.length} reconciled invoice(s), vendors billed {formatHours(discrepancy.deltaHours)} more than the
            gate verified, worth {formatMinor(discrepancy.overBilledMinor, discrepancy.currency)} in over-billing.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ModuleStat label="Invoices reconciled" value={reconState.loading ? null : rows.length} note="gate punch versus vendor bill" />
        <ModuleStat label="Gate-verified hours" value={reconState.loading ? null : formatHours(verifiedHours)} note="from biometric attendance days" />
        <ModuleStat label="Contract workers" value={workersState.loading ? null : workers.length} note="on active staffing contracts" />
        <ModuleStat label="Staffing vendors" value={agenciesState.loading ? null : agencies.length} note={`${disputedCount} invoice(s) under dispute`} />
      </div>

      <ModuleTabs tabs={tabs} active={tab} onSelect={setTab} label="Contract workforce sections" />

      <TabPanel id="reconciliation" active={tab}>
        <RegisterStates
          loading={reconState.loading}
          error={reconState.error}
          empty={!reconState.loading && !reconState.error && rows.length === 0}
          onRetry={reconState.refresh}
          loadingLabel="Reconciling gate punches against vendor invoices…"
          errorTitle="Reconciliation unavailable"
          emptyTitle="No contractor invoices to reconcile"
          emptyHint="Submit a contractor invoice against a staffing contract and it will be reconciled against the gate record here."
        />
        {!reconState.loading && !reconState.error && rows.length > 0 && (
          <div className="grid gap-4">
            {rows.map((row) => (
              <ReconciliationCard
                key={row.id}
                row={row}
                onDisputed={(next) => {
                  setNotice(next);
                  if (next.tone === "success") refreshAll();
                }}
              />
            ))}
          </div>
        )}
      </TabPanel>

      <TabPanel id="registry" active={tab}>
        <Surface className="mb-4">
          <SectionHeading
            title="Contract Worker Registry"
            description="Every contract worker deployed on site, with the agency that supplies them, their deployment site and worker category."
          />
        </Surface>
        <RegisterStates
          loading={workersState.loading}
          error={workersState.error}
          empty={!workersState.loading && !workersState.error && workers.length === 0}
          onRetry={workersState.refresh}
          loadingLabel="Loading the contract worker registry…"
          errorTitle="Contract worker registry unavailable"
          emptyTitle="No contract workers registered"
          emptyHint="Register a contract worker against a staffing contract to bring them onto the gate register."
        />
        {!workersState.loading && !workersState.error && workers.length > 0 && (
          <Surface className="max-w-full overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-3 py-3">Agency</th>
                  <th className="px-3 py-3">Site</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Contract</th>
                  <th className="px-4 py-3">Gate verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {workers.map((worker) => (
                  <tr key={worker.id}>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">
                      {worker.workerName || "Unnamed worker"}
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{worker.workerCode}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{worker.agencyName || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{worker.site || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{worker.category || worker.trade || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{worker.contractNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={worker.verified ? "success" : "neutral"}>{worker.verified ? "Verified" : "Unverified"}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        )}
      </TabPanel>

      <TabPanel id="vendors" active={tab}>
        <Surface className="mb-4">
          <SectionHeading
            title="Staffing Vendor Master"
            description="Registered staffing agencies, the contracts they hold and the statutory evidence filed against each as Principal Employer."
          />
        </Surface>
        <RegisterStates
          loading={agenciesState.loading}
          error={agenciesState.error}
          empty={!agenciesState.loading && !agenciesState.error && agencies.length === 0}
          onRetry={agenciesState.refresh}
          loadingLabel="Loading the staffing vendor master…"
          errorTitle="Staffing vendor master unavailable"
          emptyTitle="No staffing agencies registered"
          emptyHint="Register a staffing agency before raising a contract or a contractor invoice against it."
        />
        {!agenciesState.loading && !agenciesState.error && agencies.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {agencies.map((agency) => (
              <Surface key={agency.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{agency.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {agency.code || "No code"} · PAN {agency.pan || "not recorded"}
                    </p>
                  </div>
                  {agency.evidenceState ? (
                    <StatusPill tone={agency.evidenceState.toLowerCase() === "verified" ? "success" : "warning"}>
                      {agency.evidenceState} {agency.evidencePeriod && `· ${agency.evidencePeriod}`}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">No statutory evidence filed</StatusPill>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {agency.contractCount} contract(s) · {agency.workerCount} worker(s) deployed
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {agency.contactPerson || "No contact person"} · {agency.contactPhone || "no phone on file"}
                </p>
              </Surface>
            ))}
          </div>
        )}
      </TabPanel>
    </div>
  );
}

function DocumentFields({ field, value, onChange, path }: { field: Field; value: unknown; onChange: (v: unknown) => void; path: string }) {
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return <fieldset className="min-w-0 space-y-3"><label className="block min-w-0 text-sm">Document file *<input className={control} type="file" required onChange={async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Choose a file no larger than 5 MB."); e.target.value = ""; return; }
    setError(""); setReading(true);
    try {
      const content = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Could not read the file.")); reader.readAsDataURL(file); });
      onChange({ ...(value as Row), contentBase64: content, mimeType: file.type || "application/octet-stream", title: (value as Row)?.title || file.name });
    } catch { setError("Could not read the file. Please select it again."); } finally { setReading(false); }
  }} /></label>{reading && <p role="status">Reading file…</p>}{error && <p role="alert" className="text-destructive">{error}</p>}{field.fields?.filter(f => f.name !== "contentBase64").map(f => <FieldControl key={f.name} field={f} value={(value as Row)?.[f.name!]} onChange={v => onChange({ ...(value as Row), [f.name!]: v })} path={path + "." + f.name} />)}</fieldset>;
}

function DocumentDownload({ record }: { record: Row }) {
  return <button type="button" className={button} onClick={() => {
    const bytes = Uint8Array.from(atob(String(record.contentBase64)), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: String(record.mime ?? "application/octet-stream") }));
    const a = document.createElement("a"); a.href = url; a.download = String(record.title ?? "document"); a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }}>Download {String(record.title ?? "document")}</button>;
}
