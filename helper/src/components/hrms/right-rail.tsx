"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, Bot, Check, ChevronRight, CircleGauge, Clock3,
  FileChartColumn, MessageSquare, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";

const intelligenceLinks = [
  { label: "Executive dashboards", icon: BarChart3, href: "/" },
  { label: "People intelligence", icon: UsersRound, href: "/insights" },
  { label: "Workforce analytics", icon: CircleGauge, href: "/attendance" },
  { label: "Payroll analytics", icon: FileChartColumn, href: "/payroll" },
];

type AttentionItem = { id: string; title: string; detail: string };
type AuditItem = { id: string; action: string; created_at: string };

function timeAgo(iso: string): string {
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

export function RightRail({ className }: { className?: string }) {
  const [done, setDone] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [audit, setAudit] = useState<AuditItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const home = (await getJson("/api/v1/home")) as { data?: { attention?: Array<Record<string, unknown>> } };
        if (!cancelled) {
          setAttention(((home.data?.attention ?? []) as Array<Record<string, unknown>>).slice(0, 3).map((item) => ({
            id: String(item.id), title: String(item.title), detail: String(item.detail),
          })));
        }
      } catch {
        if (!cancelled) setAttention([]);
      }
      try {
        const events = (await getJson("/api/v1/ops/audit-events?page=1&pageSize=5")) as { data?: Array<Record<string, unknown>> };
        if (!cancelled) {
          setAudit(((events.data ?? []) as Array<Record<string, unknown>>).slice(0, 3).map((item) => ({
            id: String(item.id), action: String(item.action), created_at: String(item.created_at ?? item.createdAt ?? ""),
          })));
        }
      } catch {
        if (!cancelled) setAudit([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const approvals = attention ?? [];
  const openCount = approvals.filter((item) => !done.includes(item.id)).length;
  return (
    <aside className={cn("flex flex-col bg-rail text-rail-text", className)} aria-label="Workforce intelligence">
      <div className="border-b border-[var(--rail-line)] px-5 py-5">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-rail-active" /><h2 className="text-sm font-semibold text-rail-active">Intelligence & AI</h2></div>
        <p className="mt-1 text-[11px] text-rail-text">Insights, decisions and workforce signals</p>
      </div>

      <div className="px-3 py-4">
        <p className="px-2 font-mono text-[11px] tracking-[.16em] text-rail-text">DASHBOARDS & INTELLIGENCE</p>
        <div className="mt-2 space-y-1">
          {intelligenceLinks.map((item, index) => <Link key={item.label} href={item.href} className={cn("group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[11px] transition", index === 0 ? "bg-[var(--rail-line)] text-rail-active" : "text-rail-text hover:bg-[var(--rail-line)] hover:text-rail-active")}><item.icon className="size-4" /><span className="flex-1">{item.label}</span><ChevronRight className="size-3 opacity-0 transition group-hover:opacity-100" /></Link>)}
        </div>
      </div>

      <div className="mx-3 rounded-xl border border-ai/25 bg-ai/8 p-4">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[11px] font-semibold text-rail-active"><Bot className="size-4" />Workspace signal</span><span className="font-mono text-[11px] text-rail-text">LIVE</span></div>
        <p className="mt-3 text-[12px] font-medium leading-5 text-rail-active">{attention === null ? "Loading live signals…" : openCount > 0 ? `${openCount} item${openCount === 1 ? "" : "s"} waiting on you — oldest first below.` : "All clear. No pending approvals or anomalies right now."}</p>
        <p className="mt-2 text-[11px] leading-4 text-rail-text">Drawn from live approvals and anomalies — never modelled.</p>
        <Link href="/insights" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rail-active">Why this? <ArrowRight className="size-3" /></Link>
      </div>

      <div className="mt-4 border-y border-[var(--rail-line)] px-5 py-4">
        <div className="flex items-center justify-between"><p className="font-mono text-[11px] tracking-[.16em] text-rail-text">WAITING ON YOU</p><span className="rounded bg-[var(--rail-line)] px-1.5 py-0.5 font-mono text-[11px] text-rail-active">{attention === null ? "…" : `${openCount} DUE`}</span></div>
        <div className="mt-3 space-y-2">
          {attention === null ? <p className="py-4 text-center text-[11px] text-rail-text">Loading…</p> : approvals.length === 0 ? <p className="py-4 text-center text-[11px] text-rail-text">Nothing waiting.</p> : null}
          <AnimatePresence initial={false}>{approvals.map((item) => {
            const completed = done.includes(item.id);
            return <motion.button layout key={item.id} type="button" onClick={() => setDone((items) => completed ? items.filter((id) => id !== item.id) : [...items, item.id])} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition", completed ? "border-[var(--rail-line)] bg-[var(--rail-line)] opacity-55" : "border-[var(--rail-line)] bg-[var(--rail-line)] hover:border-[var(--rail-text)]")}>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border border-[var(--rail-line)] bg-[var(--rail-line)]", completed ? "text-rail-active" : "text-rail-text")}>{completed ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}</span>
              <span className="min-w-0 flex-1"><span className={cn("block truncate text-[11px] font-medium text-rail-active", completed && "line-through")}>{item.title}</span><span className="block truncate text-[11px] text-rail-text">{item.detail}</span></span>
            </motion.button>;
          })}</AnimatePresence>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] text-rail-text"><ShieldCheck className="size-3.5 text-rail-active" />AUDIT STREAM</span><span className="font-mono text-[11px] text-rail-text">LIVE</span></div>
        <div className="mt-3 space-y-3 border-l border-[var(--rail-line)] pl-3">
          {audit === null ? <p className="text-[11px] text-rail-text">Loading…</p> : audit.length === 0 ? <p className="text-[11px] text-rail-text">No audited events yet.</p> : audit.map((item) => <div key={item.id}><p className="text-[11px] font-medium text-rail-active">{item.action}</p><p className="mt-0.5 font-mono text-[11px] text-rail-text">{timeAgo(item.created_at)} · VERIFIED</p></div>)}
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--rail-line)] p-3">
        <form onSubmit={(event) => event.preventDefault()} className="relative">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Nucleus AI..." className="h-10 w-full rounded-lg border border-ai/30 bg-ai/8 pl-3 pr-10 text-[11px] text-rail-active placeholder:text-rail-text focus:border-[var(--rail-active)] focus:outline-none" />
          <button type="submit" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md bg-ai text-ai-foreground" aria-label="Ask AI"><Sparkles className="size-3.5" /></button>
        </form>
        <Link href="/inbox" className="mt-2 flex h-9 items-center justify-center gap-2 rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground"><MessageSquare className="size-3.5" />Messages <span className="rounded-full bg-destructive px-1.5 font-mono text-[11px] text-destructive-foreground">2</span></Link>
      </div>
    </aside>
  );
}
