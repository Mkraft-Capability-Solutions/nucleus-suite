"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Filter,
  IndianRupee, MoreHorizontal, ShieldAlert, Sparkles, Target, UserPlus,
  UsersRound, WandSparkles, type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import SpotlightCard from "@/components/SpotlightCard";
import { getJson } from "@/lib/client-api";
import { isAdminPrincipal } from "@/lib/cockpit-catalog";
import { humanize } from "@/lib/workflow-catalog";
import { usePersona } from "./app-shell";
import { useWorkspace } from "./workspace-provider";
import { CapabilityBars, WorkforceChart, type CapabilityBar, type TrendPoint } from "./charts";
import { EmployeeHomeCockpit } from "./cockpits/employee-home-cockpit";
import { AdminWelcomeHero } from "./hero/admin-welcome-hero";
import { MetricCard, PageIntro, StatusPill, Surface } from "./page-primitives";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[Number(key.slice(5, 7)) - 1] ?? key;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatIst(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" }) + " IST";
}

type AttentionItem = { id: string; domain: string; title: string; detail: string; href: string; status: string };

type CommandCentre = {
  tenantName: string;
  headcount: number;
  openPositions: number;
  pendingLeave: number;
  payrollNetCr: number | null;
  payrollPeriod: string | null;
  unread: number;
  attendance: { date: string; present: number; halfDay: number; onLeave: number; absent: number; notRecorded: number; percentPresent: number | null };
  attention: AttentionItem[];
  funnel: Array<{ label: string; value: number; width: number }>;
  heatmap: number[];
  heatStart: string;
  momentum: TrendPoint[];
  departments: CapabilityBar[];
  capability: CapabilityBar[];
  obligations: Array<{ title: string; detail: string; tone: "success" | "warning" | "danger" }>;
  readiness: number | null;
  refreshedAt: string;
  unavailableSources: string[];
};

const FUNNEL_STAGES = ["applied", "screened", "interview", "offer", "joined"] as const;

function useCommandCentre(rangeMonths: number, tenantName: string) {
  const [data, setData] = useState<CommandCentre | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const homeRaw = await getJson("/api/v1/home");
        const home = asRecord(asRecord(homeRaw).data);
        const summary = asRecord(home.summary);
        const commandCentre = asRecord(home.commandCentre);
        const unavailableSources = (Array.isArray(home.unavailableSources) ? home.unavailableSources as UnknownRecord[] : [])
          .map((item) => str(item.name))
          .filter(Boolean);
        const leaveItems = Array.isArray(commandCentre.leaveCalendar) ? commandCentre.leaveCalendar as UnknownRecord[] : [];
        const obligations = Array.isArray(commandCentre.obligations) ? commandCentre.obligations as UnknownRecord[] : [];

        const attendance = asRecord(summary.attendanceToday);
        const hiringStages = asRecord(home.hiringStages);
        const funnelValues = FUNNEL_STAGES.map((stage) => {
          const hit = Object.entries(hiringStages).find(([key]) => key.toLowerCase().includes(stage));
          return hit ? num(hit[1]) : 0;
        });
        const funnelMax = Math.max(1, ...funnelValues);
        const funnelLabels = ["Applied", "Screened", "Interview", "Offer", "Joined"];
        const funnel = funnelValues.map((value, index) => ({ label: funnelLabels[index], value, width: Math.round((value / funnelMax) * 100) }));

        const today = new Date();
        const heatmap = Array.from({ length: 28 }, (_, offset) => {
          const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
          const key = dayKey(day);
          return leaveItems.filter((item) => {
            const status = str(item.status).toLowerCase();
            if (["rejected", "cancelled"].includes(status)) return false;
            const start = str(item.startsOn).slice(0, 10);
            const end = str(item.endsOn).slice(0, 10) || start;
            return start <= key && key <= end;
          }).length;
        });

        const joinerCounts = (Array.isArray(commandCentre.joinerCounts) ? commandCentre.joinerCounts as UnknownRecord[] : [])
          .map((item) => ({ month: str(item.month).slice(0, 7), count: num(item.count) }))
          .filter((item) => /^\d{4}-\d{2}$/.test(item.month));
        const buckets: string[] = [];
        for (let back = rangeMonths - 1; back >= 0; back -= 1) {
          const day = new Date(today.getFullYear(), today.getMonth() - back, 1);
          buckets.push(monthKey(day));
        }
        let running = num(summary.headcount) - joinerCounts
          .filter((item) => item.month >= buckets[0])
          .reduce((sum, item) => sum + item.count, 0);
        const momentum = buckets.map((key) => {
          running += joinerCounts.find((item) => item.month === key)?.count ?? 0;
          return { month: monthLabel(key), headcount: Math.max(0, running) };
        });

        const deptCounts = (Array.isArray(home.headcountByDepartment) ? (home.headcountByDepartment as UnknownRecord[]) : [])
          .map((row) => ({ name: str(row.name) || "Unassigned", value: num(row.headcount) }))
          .filter((row) => row.name !== "Unassigned" || row.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        const capability = (Array.isArray(home.capabilityByDepartment) ? home.capabilityByDepartment as UnknownRecord[] : [])
          .map((row) => ({ name: str(row.name) || "Unassigned", value: num(row.value) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        const obligCards = obligations.slice(0, 3).map((item) => {
          const status = str(item.status).toLowerCase();
          return {
            title: str(item.title, "Obligation"),
            detail: str(item.dueDate, "Evidence required"),
            tone: (["filed", "complete", "completed"].includes(status) ? "success" : /due|pending|overdue/.test(status) ? "warning" : "info") as "success" | "warning" | "danger",
          };
        });
        const filedCount = obligations.filter((item) => ["filed", "complete", "completed"].includes(str(item.status).toLowerCase())).length;
        const readiness = obligations.length > 0 ? Math.round((filedCount / obligations.length) * 100) : null;

        const attention = (Array.isArray(home.attention) ? (home.attention as UnknownRecord[]) : []).map((item) => ({
          id: str(item.id), domain: str(item.domain), title: str(item.title),
          detail: str(item.detail), href: str(item.href) || "/", status: str(item.status) || "open",
        }));

        const netMinor = num(summary.payrollNetMinor);
        if (!cancelled) {
          setData({
            tenantName,
            headcount: num(summary.headcount),
            openPositions: num(summary.openPositions),
            pendingLeave: num(summary.pendingLeave),
            payrollNetCr: summary.payrollPeriod ? Math.round((netMinor / 100 / 1e7) * 100) / 100 : null,
            payrollPeriod: summary.payrollPeriod ? str(summary.payrollPeriod) : null,
            unread: num(summary.unreadNotifications),
            attendance: {
              date: str(attendance.date),
              present: num(attendance.present),
              halfDay: num(attendance.halfDay),
              onLeave: num(attendance.onLeave),
              absent: num(attendance.absent),
              notRecorded: num(attendance.notRecorded),
              percentPresent: typeof attendance.percentPresent === "number" ? attendance.percentPresent : null,
            },
            attention,
            funnel,
            heatmap,
            heatStart: dayKey(today),
            momentum,
            departments: deptCounts,
            capability,
            obligations: obligCards,
            readiness,
            refreshedAt: str(asRecord(homeRaw).meta ? asRecord(asRecord(homeRaw).meta).generatedAt : ""),
            unavailableSources,
          });
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Command centre is unreachable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rangeMonths, tenantName]);

  return { data, error, loading };
}

function WidgetHeader({ title, period, ai = false }: { title: string; period?: string; ai?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-heading text-[15px] font-semibold text-foreground">{title}</h2>{ai && <Sparkles className="size-3.5 text-ai" />}</div>{period && <p className="mt-0.5 text-[11px] text-muted-foreground">{period}</p>}</div><button type="button" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`${title} options`}><MoreHorizontal className="size-4" /></button></div>;
}

/** Value-unknown sibling of MetricCard for genuinely missing data (never renders 0 as a value). */
function UnknownMetricCard({ label, hint, icon: Icon, tint }: { label: string; hint: string; icon: LucideIcon; tint?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
      <SpotlightCard className="nucleus-panel rounded-lg p-4" spotlightColor={tint || "color-mix(in srgb, var(--primary) 8%, transparent)"}>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
              <Icon className="size-4 text-primary" strokeWidth={2} />
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-bold text-muted-foreground">{hint}</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-[34px] text-muted-foreground tabular-nums">—</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

function AttendanceRing({ breakdown, headcount }: { breakdown: CommandCentre["attendance"]; headcount: number }) {
  const segments = [
    { label: "Present", value: breakdown.present, color: "var(--success)" },
    { label: "On leave", value: breakdown.onLeave, color: "var(--warning)" },
    { label: "Absent", value: breakdown.absent, color: "var(--destructive)" },
    { label: "Half day", value: breakdown.halfDay, color: "var(--info)" },
  ];
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0) + breakdown.notRecorded);
  let cursor = 0;
  const gradient = [...segments, { label: "Not recorded", value: breakdown.notRecorded, color: "color-mix(in srgb, var(--muted-foreground) 25%, transparent)" }]
    .map((segment) => {
      const start = (cursor / total) * 100;
      cursor += segment.value;
      const end = (cursor / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");
  return <div className="mt-5 flex items-center gap-5"><div className="relative grid size-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="grid size-[94px] place-items-center rounded-full bg-card text-center"><div><p className="text-2xl font-bold tabular-nums">{headcount.toLocaleString("en-IN")}</p><p className="text-[11px] text-muted-foreground">active</p></div></div></div><div className="min-w-0 flex-1 space-y-2.5">{[...segments, { label: "Not recorded", value: breakdown.notRecorded, color: "var(--muted-foreground)" }].map((segment) => <div key={segment.label} className="flex items-center text-[11px]"><span className="mr-2 size-1.5 rounded-sm" style={{ background: segment.color }} /><span className="flex-1 text-muted-foreground">{segment.label}</span><span className="font-bold text-foreground tabular-nums">{segment.value}</span></div>)}</div></div>;
}

function HiringFunnel({ stages }: { stages: Array<{ label: string; value: number; width: number }> }) {
  const colors = ["var(--chart-2)", "var(--chart-1)", "var(--chart-5)", "var(--chart-4)", "var(--chart-3)"];
  return <div className="mt-5 space-y-3">{stages.map((stage, index) => <div key={stage.label} className="grid grid-cols-[64px_1fr_32px] items-center gap-3"><span className="truncate text-[11px] text-muted-foreground">{stage.label}</span><div className="h-2 overflow-hidden rounded-sm bg-secondary"><motion.div initial={{ width: 0 }} animate={{ width: `${stage.width}%` }} transition={{ duration: .5 }} className="h-full rounded-sm" style={{ background: colors[index % colors.length] }} /></div><span className="text-right text-[11px] font-bold tabular-nums">{stage.value}</span></div>)}</div>;
}

function toneForDomain(domain: string): "success" | "warning" | "danger" | "info" | "violet" | "neutral" {
  if (domain === "leave") return "warning";
  if (domain === "payroll") return "danger";
  if (domain === "compliance") return "info";
  return "neutral";
}

/**
 * The root surface, resolved by principal.
 *
 * `/` used to render the command centre for everyone, so an ordinary employee
 * opening the app saw tenant headcount, every colleague's attendance for today,
 * the compliance register and the candidate pipeline. The same `isAdminPrincipal`
 * rule the cockpit catalogue already uses decides which surface renders, and
 * `/api/v1/home` enforces it again on the server — this component is the
 * presentation half of that decision, never the control.
 *
 * Until the workspace context has loaded, neither surface is rendered and no
 * request is issued, so the command centre cannot flash before the principal
 * is known.
 */
export function Dashboard() {
  const { workspace, loading } = useWorkspace();
  const context = workspace?.context ?? null;

  if (!context) {
    return (
      <div className="w-full">
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
          {loading || !workspace ? "Loading your workspace…" : "No tenant workspace is selected for this account."}
        </p>
      </div>
    );
  }

  return isAdminPrincipal(context.permissions, context.roles) ? <CommandCentre /> : <EmployeeHomeCockpit />;
}

function CommandCentre() {
  const { persona } = usePersona();
  const { workspace } = useWorkspace();
  const firstName = persona.name.split(" ")[0];
  const [range, setRange] = useState("6 months");
  const [resolved, setResolved] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const tenantName = workspace?.memberships.find((item) => item.tenantId === workspace.context?.tenantId)?.tenantName
    ?? workspace?.memberships[0]?.tenantName
    ?? "Workspace";
  const { data, error, loading } = useCommandCentre(range === "6 months" ? 6 : 12, tenantName);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const openAttention = (data?.attention ?? []).filter((item) => !resolved.includes(item.id));

  return (
    <div className="w-full">
      <PageIntro eyebrow={`Command centre · ${data?.tenantName ?? "…"}`} title={`${greeting}, ${firstName}.`} description={loading ? "Loading live workspace data…" : error ? "Live data is unreachable — showing nothing rather than stale figures." : data?.unavailableSources.length ? `Some live sources are unavailable: ${data.unavailableSources.join(", ")}. Affected figures are incomplete.` : openAttention.length > 0 ? `Workforce health is steady. ${openAttention.length} decision${openAttention.length === 1 ? "" : "s"} need${openAttention.length === 1 ? "s" : ""} attention${data && data.unread > 0 ? ` and ${data.unread} unread notification${data.unread === 1 ? "" : "s"}` : ""}.` : "Workforce is steady. Nothing needs attention right now."} action={<div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] text-muted-foreground hover:text-foreground"><Filter className="size-3.5" />All locations</button><button type="button" onClick={() => setRange((value) => value === "6 months" ? "12 months" : "6 months")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] text-muted-foreground hover:text-foreground">{range}<ChevronDown className="size-3.5" /></button></div>} />

      {/* The administrative hero: the same already-fetched /api/v1/home payload,
          read for scope and for what needs a decision. It issues no request. */}
      <AdminWelcomeHero data={data} loading={loading} error={error} />

      {error && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[12px] text-destructive">{error} <button type="button" onClick={() => window.location.reload()} className="ml-2 font-bold underline">Retry</button></p>}
      {!error && data && data.unavailableSources.length > 0 && <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-[12px] text-warning">Partial live data: {data.unavailableSources.join(", ")}. Refresh to retry those sources.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !data ? (
          <>
            <UnknownMetricCard label="Total headcount" hint="loading…" icon={UsersRound} />
            <UnknownMetricCard label="Annualised attrition" hint="loading…" icon={UserPlus} tint="color-mix(in srgb, var(--destructive) 13%, transparent)" />
            <UnknownMetricCard label="Attendance today" hint="loading…" icon={Clock3} tint="color-mix(in srgb, var(--info) 13%, transparent)" />
            <UnknownMetricCard label="Payroll cost" hint="loading…" icon={IndianRupee} tint="color-mix(in srgb, var(--warning) 13%, transparent)" />
          </>
        ) : (
          <>
            <MetricCard label="Total headcount" value={data.headcount} delta={`${data.openPositions} open roles`} icon={UsersRound} />
            <UnknownMetricCard label="Annualised attrition" hint="needs 12-mo history" icon={UserPlus} tint="color-mix(in srgb, var(--destructive) 13%, transparent)" />
            {data.attendance.percentPresent === null ? (
              <UnknownMetricCard label="Attendance today" hint={data.attendance.date ? "no records today" : "unavailable"} icon={Clock3} tint="color-mix(in srgb, var(--info) 13%, transparent)" />
            ) : (
              <MetricCard label="Attendance today" value={data.attendance.percentPresent} suffix="%" delta={data.attendance.date} icon={Clock3} decimals={1} tint="color-mix(in srgb, var(--info) 13%, transparent)" />
            )}
            {data.payrollNetCr === null ? (
              <UnknownMetricCard label="Payroll cost" hint="no finalized run" icon={IndianRupee} tint="color-mix(in srgb, var(--warning) 13%, transparent)" />
            ) : (
              <MetricCard label={`Payroll cost · ${data.payrollPeriod}`} value={data.payrollNetCr} suffix=" Cr" delta="latest finalized run" icon={IndianRupee} decimals={2} tint="color-mix(in srgb, var(--warning) 13%, transparent)" />
            )}
          </>
        )}
      </div>

      {!dismissed && data && !loading && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="relative mt-3 overflow-hidden rounded-lg border border-ai/30 bg-ai/10 p-4 sm:p-5">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-ai/30 bg-card text-ai"><WandSparkles className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ai">Workspace signals · live</span><span className="size-1.5 rounded-full bg-ai" /></div><p className="mt-1.5 text-sm font-bold leading-[21px] text-foreground">{openAttention.length > 0 ? `${openAttention.length} item${openAttention.length === 1 ? "" : "s"} need${openAttention.length === 1 ? "s" : ""} a decision: ${openAttention.slice(0, 2).map((item) => item.title).join("; ")}${openAttention.length > 2 ? `, plus ${openAttention.length - 2} more below.` : "."}` : "All clear. No pending approvals, anomalies, or overdue obligations right now."}</p><p className="mt-1 text-[12px] text-muted-foreground">Drawn from live approvals, anomalies and obligations — never modelled or guessed.</p></div><div className="flex shrink-0 gap-2"><Link href="/inbox" className="inline-flex h-10 items-center gap-2 rounded-lg bg-ai px-3.5 font-heading text-[13px] font-semibold text-ai-foreground">Open inbox <ArrowRight className="size-3.5" /></Link><button type="button" onClick={() => setDismissed(true)} className="h-10 rounded-lg border border-ai/30 px-3.5 font-heading text-[13px] font-semibold text-ai">Dismiss</button></div></div>
        </motion.section>
      )}

      <div className="mt-3 grid grid-cols-12 gap-3">
        <Surface className="col-span-12 min-h-[310px] p-4 lg:col-span-8"><WidgetHeader title="Workforce momentum" period={`HEADCOUNT FROM JOINING RECORDS · ${range.toUpperCase()}`} /><div className="mt-1">{loading || !data ? <div className="grid h-[240px] w-full place-items-center"><p className="text-[11px] text-muted-foreground">Loading…</p></div> : <WorkforceChart points={data.momentum} />}</div><div className="flex gap-4 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground"><span><i className="mr-1.5 inline-block size-1.5 rounded-sm bg-primary" />Actual headcount</span><span className="ml-auto text-primary">{data ? `${data.headcount.toLocaleString("en-IN")} active` : "…"}</span></div></Surface>
        <Surface className="col-span-12 min-h-[310px] p-4 sm:col-span-6 lg:col-span-4"><WidgetHeader title="Headcount by department" period="LIVE DIRECTORY" />{loading || !data ? <div className="grid h-[240px] w-full place-items-center"><p className="text-[11px] text-muted-foreground">Loading…</p></div> : <CapabilityBars bars={data.departments} emptyNote="No departments with headcount yet." />}<div className="flex items-center justify-between border-t border-border/60 pt-3"><span className="text-[11px] text-muted-foreground">Departments</span><span className="font-mono text-sm text-primary">{data?.departments.length ?? "…"}</span></div></Surface>

        <Surface className="col-span-12 p-4 sm:col-span-6 lg:col-span-4"><WidgetHeader title="Attendance today" period={data?.attendance.date ? `${data.attendance.date} · ALL SITES` : "TODAY"} />{data ? <AttendanceRing breakdown={data.attendance} headcount={data.headcount} /> : <p className="mt-5 text-[11px] text-muted-foreground">Loading…</p>}</Surface>
        <Surface className="col-span-12 p-4 lg:col-span-8"><WidgetHeader title="Approvals waiting on you" period="SORTED BY AGEING AND RISK" /><div className="mt-4 overflow-x-auto rounded-lg border border-border/70">{!data || loading ? <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">Loading live approvals…</p> : openAttention.length === 0 ? <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">Nothing waiting. Leave requests, payroll anomalies and overdue obligations will appear here.</p> : <div><div className="hidden gap-3 bg-secondary/70 px-3 py-2 font-mono text-[11px] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_88px_minmax(104px,128px)_34px]"><span>Request</span><span>Owner</span><span>Status</span><span className="sr-only">Action</span></div>{openAttention.map((item) => { const isDone = resolved.includes(item.id); return <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 px-3 py-2.5 first:border-0 sm:grid sm:grid-cols-[minmax(0,1fr)_88px_minmax(104px,128px)_34px]"><Link href={item.href} className="min-w-0 basis-full sm:basis-auto"><span className={isDone ? "block truncate text-[11px] text-muted-foreground line-through" : "block truncate text-[11px] font-medium text-foreground"}>{item.title}</span><span className="block truncate text-[11px] text-muted-foreground">{item.detail}</span></Link><span className="shrink-0 truncate text-[11px] text-muted-foreground">{item.domain}</span><StatusPill tone={isDone ? "success" : toneForDomain(item.domain)}>{isDone ? "Done" : humanize(item.status)}</StatusPill><button type="button" onClick={() => setResolved((items) => isDone ? items.filter((id) => id !== item.id) : [...items, item.id])} className="ml-auto grid size-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary sm:ml-0" aria-label={`Resolve ${item.title}`}>{isDone ? <Check className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}</button></div>; })}</div>}</div></Surface>

        <Surface className="col-span-12 p-4 lg:col-span-7"><WidgetHeader title="Capability by team" period="VERIFIED SKILL SIGNALS" /><div className="mt-1">{data && data.capability.length > 0 ? <CapabilityBars bars={data.capability} /> : <p className="px-1 py-10 text-center text-[11px] text-muted-foreground">{loading ? "Loading…" : "No verified skill signals yet. Verify skill evidence against employees to populate this view."}</p>}</div></Surface>
        <Surface className="col-span-12 p-4 sm:col-span-6 lg:col-span-5"><WidgetHeader title="Talent acquisition funnel" period="LIVE APPLICATIONS" /><HiringFunnel stages={data?.funnel ?? [{ label: "Applied", value: 0, width: 0 }, { label: "Screened", value: 0, width: 0 }, { label: "Interview", value: 0, width: 0 }, { label: "Offer", value: 0, width: 0 }, { label: "Joined", value: 0, width: 0 }]} /><div className="mt-5 grid grid-cols-3 border-t border-border/60 pt-3 text-center"><div><p className="font-mono text-sm text-primary">{data?.funnel.reduce((sum, stage) => sum + stage.value, 0) ?? "…"}</p><p className="text-[11px] text-muted-foreground">In pipeline</p></div><div className="border-x border-border"><p className="font-mono text-sm text-info">{data ? data.funnel[3].value : "…"}</p><p className="text-[11px] text-muted-foreground">At offer</p></div><div><p className="font-mono text-sm text-warning">{data?.openPositions ?? "…"}</p><p className="text-[11px] text-muted-foreground">Open roles</p></div></div></Surface>

        <Surface className="col-span-12 p-4 sm:col-span-6 lg:col-span-5"><WidgetHeader title="Leave demand heatmap" period={data ? `${data.heatStart} · NEXT 28 DAYS · DARKER MEANS HIGHER` : "NEXT 28 DAYS"} /><div className="mt-5 grid grid-cols-7 gap-1.5">{(data?.heatmap ?? Array.from({ length: 28 }, () => 0)).map((value, index) => { const max = Math.max(1, ...(data?.heatmap ?? [0])); const strength = Math.round(8 + (value / max) * 68); return <motion.button key={index} type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * .008 }} className="aspect-square rounded-[4px] border border-primary/10" style={{ background: `color-mix(in srgb, var(--primary) ${strength}%, var(--card))` }} aria-label={`${value} leave request${value === 1 ? "" : "s"} on day ${index + 1}`} />; })}</div><div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground"><span>{data?.heatStart ?? ""}</span><span className="flex items-center gap-1">Low <i className="h-2 w-12 rounded-sm bg-gradient-to-r from-primary/10 to-primary" /> High</span><span>{data ? `${data.pendingLeave} pending` : ""}</span></div></Surface>
        <Surface className="col-span-12 p-4 lg:col-span-7"><WidgetHeader title="Statutory control room" period="COMPLIANCE OBLIGATIONS" /><div className="mt-4 grid gap-2 sm:grid-cols-3">{data && data.obligations.length > 0 ? data.obligations.map((item, index) => <div key={`${item.title}-${index}`} className="nucleus-inset rounded-lg p-3"><div className="flex items-start justify-between"><ShieldAlert className={item.tone === "success" ? "size-4 text-primary" : item.tone === "warning" ? "size-4 text-warning" : "size-4 text-info"} /><span className="font-mono text-[11px] text-muted-foreground">{item.detail.slice(0, 12).toUpperCase()}</span></div><p className="mt-3 text-[11px] font-medium">{item.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p></div>) : <p className="px-1 py-4 text-[11px] text-muted-foreground sm:col-span-3">{loading ? "Loading…" : "No compliance obligations registered yet."}</p>}</div><div className="mt-3 flex items-center justify-between rounded-lg bg-primary/7 px-3 py-2.5"><div className="flex items-center gap-2"><Target className="size-4 text-primary" /><span className="text-[11px] text-muted-foreground">Compliance readiness</span></div><span className="font-mono text-sm text-primary">{data?.readiness === null || data?.readiness === undefined ? "—" : `${data.readiness}%`}</span></div></Surface>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-[11px] text-muted-foreground"><span>Last refreshed {data?.refreshedAt ? formatIst(data.refreshedAt) : "—"}</span><div className="flex gap-3"><Link href="/people" className="inline-flex items-center gap-1.5 hover:text-primary"><UsersRound className="size-3.5" />People</Link><Link href="/leave" className="inline-flex items-center gap-1.5 hover:text-primary"><CalendarDays className="size-3.5" />Leave</Link></div></div>
    </div>
  );
}
