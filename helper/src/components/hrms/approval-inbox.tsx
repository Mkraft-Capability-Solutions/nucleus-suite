"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { humanize } from "@/lib/workflow-catalog";

type Approval = { id:string; title:string; feature:string; status:string; href:string };
export function ApprovalInbox() {
  const [items,setItems] = useState<Approval[]>([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    let live=true;
    getJson("/api/v1/workspace/approvals").then(body => {if(live) {setItems((body as {data:Approval[]}).data);setError("");setLoading(false);}}).catch(caught => {if(live){setError(caught.message);setLoading(false);}});
    return () => {live=false;};
  },[revision]);
  return <section className="mb-6 rounded-xl border border-border bg-card p-5" aria-label="Workflow approvals">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Requests to review</h2><button className="rounded border border-border px-3 py-1 text-sm" onClick={() => {invalidateGetRequests();setLoading(true);setRevision(value => value+1);}}>Refresh approvals</button></div>
    <p className="my-2 text-sm text-muted-foreground">Operational requests and follow-on actions available to your role. Open the register and select the reference to review its details and history.</p>
    {loading ? <p role="status">Loading requests…</p> : error ? <p role="alert">{error}</p> : items.length ? <ul className="divide-y divide-border">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p>{item.title}</p><p className="text-xs text-muted-foreground">{item.feature} · {humanize(item.status)} · {item.id}</p></div><Link className="rounded border border-border px-3 py-2 text-sm" href={item.href}>Review request</Link></li>)}</ul> : <p className="text-sm">No operational requests currently need your review.</p>}
    {items.length===100 && <p className="mt-2 text-sm">Showing the oldest 100 requests. Open the module worklists to review more.</p>}
  </section>;
}
