"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { navigationCatalog } from "@/lib/navigation-catalog";
import { operationalResources } from "@/lib/operational-catalog";
import {
  humanize,
  permitted,
  recordLabel,
  unwrapRecords,
  workflowGuides,
  workflowOperations,
} from "@/lib/workflow-catalog";
import { useWorkspace } from "./workspace-provider";
import { PageIntro, StatusPill, Surface } from "./page-primitives";

type Row = Record<string, unknown> & { _resource: string };
type ResourceState = { resource: string; rows: Row[]; error?: string };

const pendingStates = new Set(["submitted", "pending", "open"]);
const activeStates = new Set(["active", "approved", "published", "allocated", "in_progress", "filed"]);
const attentionStates = new Set(["returned", "rejected", "maintenance", "on_hold", "overdue"]);

const primaryActions: Record<string, string> = {
  rosters: "Plan roster",
  projects: "Manage projects",
  assets: "Manage inventory",
  helpdesk: "Open HR requests",
  travel: "Manage travel",
  timesheets: "Review time entries",
  mobility: "Review career moves",
  accounting: "Configure ledger",
  statutory: "Manage filings",
  settlements: "Review settlements",
};

function tone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["approved", "active", "published", "completed", "resolved", "reimbursed", "accepted"].includes(status)) return "success";
  if (["submitted", "pending", "open", "in_progress", "filed"].includes(status)) return "warning";
  if (["rejected", "returned", "maintenance", "overdue"].includes(status)) return "danger";
  if (["allocated", "draft", "available", "finalized"].includes(status)) return "info";
  return "neutral";
}

function dateLabel(value: unknown) {
  if (!value) return "No update time";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "No update time" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function overviewRecordLabel(row: Row) {
  const label = recordLabel(row);
  if (label !== String(row.id)) return label;
  if (row._resource === "rosters") return `${String(row.shiftCode ?? "Unassigned")} shift · ${String(row.startDate ?? "Dates pending")}`;
  if (row._resource === "allocations") return `${String(row.role ?? "Workforce")} allocation · ${String(row.startDate ?? "Dates pending")}`;
  if (row._resource === "expenses") return `${humanize(String(row.category ?? "Expense"))} · ${String(row.expenseDate ?? "Date pending")}`;
  if (row._resource === "settlements") return `Settlement · ${String(row.lastWorkingDate ?? "Date pending")}`;
  if (row._resource === "mobility") return `${String(row.targetRole ?? "Career move")} · ${String(row.effectiveDate ?? "Date pending")}`;
  return operationalResources[row._resource].label.replace(/s$/, "");
}

export function OperationalOverview({ module }: { module: string }) {
  const { workspace } = useWorkspace();
  const feature = navigationCatalog.find(item => item.id === module);
  const resources = useMemo(
    () => Object.entries(operationalResources).filter(([, definition]) => definition.module === module).map(([resource]) => resource),
    [module],
  );
  const listings = useMemo(() => resources.flatMap(resource => {
    const permissions = workspace?.context?.permissions ?? [];
    const section = "operations/" + resource;
    const operation = workflowOperations.find(item => item.section === section && item.method === "GET" && !item.path.includes("[") && permitted(item, permissions));
    return operation ? [{ resource, path: operation.path }] : [];
  }), [resources, workspace?.context?.permissions]);
  const [states, setStates] = useState<ResourceState[]>([]);
  const [revision, setRevision] = useState(0);
  const signature = listings.map(listing => listing.path).join("|") + ":" + revision;
  const [loadedSignature, setLoadedSignature] = useState("");
  const loading = signature !== loadedSignature;

  useEffect(() => {
    let live = true;
    Promise.all(listings.map(async listing => {
      try {
        const payload = await getJson(listing.path + "?pageSize=100");
        return { resource: listing.resource, rows: unwrapRecords(payload).map(row => ({ ...row, _resource: listing.resource })) };
      } catch (caught) {
        return { resource: listing.resource, rows: [], error: caught instanceof Error ? caught.message : "Records could not be loaded." };
      }
    })).then(result => { if (live) { setStates(result); setLoadedSignature(signature); } });
    return () => { live = false; };
  }, [listings, signature]);

  const rows = states.flatMap(state => state.rows);
  const submitted = rows.filter(row => pendingStates.has(String(row.status))).length;
  const active = rows.filter(row => activeStates.has(String(row.status))).length;
  const attention = rows.filter(row => attentionStates.has(String(row.status))).length;
  const recent = [...rows].sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))).slice(0, 8);
  const errors = states.filter(state => state.error);
  const primarySection = resources[0] ? "operations/" + resources[0] : "";

  return <div className="mx-auto w-full min-w-0 max-w-[1400px]">
    <PageIntro
      eyebrow="Operational control centre"
      title={feature?.label ?? humanize(module)}
      description={workflowGuides[module] ?? feature?.description ?? "Review records and complete the next available action."}
      action={primarySection ? <Link href={`/${module}?section=${encodeURIComponent(primarySection)}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">{primaryActions[module] ?? "Open workflow"}<ArrowRight className="size-4" /></Link> : undefined}
    />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Records in view", value: rows.length, icon: ClipboardList },
        { label: "Waiting for action", value: submitted, icon: Clock3 },
        { label: "Active or approved", value: active, icon: CheckCircle2 },
        { label: "Needs attention", value: attention, icon: AlertCircle },
      ].map(metric => <Surface key={metric.label} className="p-4"><div className="flex items-center justify-between gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><metric.icon className="size-4" /></span><span className="min-w-0 truncate text-2xl font-semibold tabular-nums">{loading ? "—" : metric.value}</span></div><p className="mt-4 text-sm text-muted-foreground">{metric.label}</p></Surface>)}
    </div>

    {errors.length > 0 && <p role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">Some worklists could not be loaded. You can still open each workflow and retry. {errors.map(error => operationalResources[error.resource].label).join(", ")}.</p>}

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
      <Surface className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5"><div className="min-w-0"><h2 className="font-semibold">Work areas</h2><p className="mt-1 text-xs text-muted-foreground">Registers and actions available to your role</p></div><button type="button" className="grid size-10 shrink-0 place-items-center rounded-lg border border-border hover:bg-secondary" aria-label="Refresh overview" onClick={() => { invalidateGetRequests(); setRevision(value => value + 1); }}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button></div>
        <div className="divide-y divide-border">{resources.map(resource => {
          const state = states.find(item => item.resource === resource);
          const definition = operationalResources[resource];
          const counts = Object.entries((state?.rows ?? []).reduce<Record<string, number>>((result, row) => { const status = String(row.status ?? "unknown"); result[status] = (result[status] ?? 0) + 1; return result; }, {}));
          const available = listings.some(listing => listing.resource === resource);
          return <div key={resource} className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-5"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{definition.label}</h3><div className="mt-2 flex flex-wrap gap-1.5">{loading && available ? <span className="text-xs text-muted-foreground">Loading…</span> : counts.length ? counts.slice(0, 4).map(([status, count]) => <StatusPill key={status} tone={tone(status)}>{count} {humanize(status)}</StatusPill>) : <span className="text-xs text-muted-foreground">{available ? "No records yet" : "No access for this role"}</span>}</div></div>{available && <Link className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-border px-3 text-sm hover:bg-secondary" href={`/${module}?section=${encodeURIComponent("operations/" + resource)}`}>Open</Link>}</div>;
        })}</div>
      </Surface>

      <Surface className="p-0">
        <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="font-semibold">Recent records</h2><p className="mt-1 text-xs text-muted-foreground">Latest activity across this feature</p></div>
        {loading ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">Loading operational records…</p> : recent.length ? <div className="w-full max-w-full overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="px-5 py-3 font-medium">Record</th><th className="px-3 py-3 font-medium">Work area</th><th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Updated</th></tr></thead><tbody>{recent.map(row => <tr key={`${row._resource}:${String(row.id)}`} className="border-t border-border"><td className="px-5 py-3"><Link className="font-medium hover:text-primary" href={`/${module}?section=${encodeURIComponent("operations/" + row._resource)}&record=${encodeURIComponent(String(row.id))}`}>{overviewRecordLabel(row)}</Link><p className="mt-1 max-w-52 truncate font-mono text-[10px] text-muted-foreground">{String(row.id)}</p></td><td className="px-3 py-3 text-muted-foreground">{operationalResources[row._resource].label}</td><td className="px-3 py-3"><StatusPill tone={tone(String(row.status))}>{humanize(String(row.status ?? "unknown"))}</StatusPill></td><td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{dateLabel(row.updatedAt ?? row.createdAt)}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center"><ClipboardList className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">No records yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Start with the primary action above. New records will appear here with their status and next step.</p></div>}
      </Surface>
    </div>
  </div>;
}
