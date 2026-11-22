"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { ArrowDownRight, ArrowRight, ArrowUpRight, LayoutGrid, Megaphone, RotateCw, SlidersHorizontal, Star, X } from "lucide-react";
import type { Board, BoardId, FilterOptions } from "@/server/dashboards/types";
import { Alert, Button, ErrorState, PageHeader, Panel, Scope, Select, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import PanelView from "./PanelView";
import SummaryBand from "./SummaryBand";
import { CustomiseQuickActions, QuickActionsBar, useQuickActions } from "@/modules/shell/QuickActions";
import { usePreference } from "@/modules/shell/quick-actions";
import { formatCompact, formatDate } from "./format";
import styles from "./Dashboards.module.css";

/** The consoles, in menu order. Who may open each is decided by the server (permissions) and the plan. */
export const CONSOLES: Array<{ id: BoardId; code: string; title: string; description: string }> = [
  { id: "s1", code: "S1", title: "People command centre", description: "Headcount, movement, attrition and workforce mix." },
  { id: "s2", code: "S2", title: "HR operations", description: "Today's attendance, joiners, exits and work waiting on HR." },
  { id: "s3", code: "S3", title: "Attendance & shifts", description: "Attendance rate, hours, overtime and exceptions." },
  { id: "s4", code: "S4", title: "Talent acquisition", description: "Requisitions, pipeline, interviews and offers." },
  { id: "s5", code: "S5", title: "Payroll control room", description: "Run totals, anomalies and statutory deadlines." },
  { id: "s6", code: "S6", title: "Performance & talent", description: "Reviews, ratings, goals, recognition and succession." },
  { id: "s7", code: "S7", title: "Manager cockpit", description: "Your direct reports today and what waits on you." },
  { id: "s8", code: "S8", title: "My home", description: "Your attendance, leave, learning and things to do." },
  { id: "s9", code: "S9", title: "Capability", description: "Skills coverage and learning completions." },
  { id: "s10", code: "S10", title: "Workspace governance", description: "Access, plan, audit activity and integrations." },
];

const BOARD_FILTERS: Record<BoardId, { workforce: boolean; period: boolean }> = {
  s1: { workforce: true, period: true }, s2: { workforce: true, period: false }, s3: { workforce: true, period: false },
  s4: { workforce: false, period: true }, s5: { workforce: false, period: false }, s6: { workforce: true, period: true },
  s7: { workforce: false, period: false }, s8: { workforce: false, period: false }, s9: { workforce: true, period: true },
  s10: { workforce: false, period: false },
};

type Announcement = { id: string | number; title?: string; content?: string; author?: string; date?: string; pinned?: boolean };

type Props = {
  activeConsole: string | null | undefined;
  permittedConsoles: string[];
  onSelectConsole?: (code: string) => void;
  onNavigate?: (tab: string) => void;
  userName?: string;
  announcements?: Announcement[];
  onOpenAnnouncements?: () => void;
  /** The classic customisable widget dashboard, offered as "My widgets" where it applies. */
  personal?: ReactNode;
  /** Opens a navigation item (quick actions). */
  onOpenNav?: (navId: string) => void;
};

type Scope = "all" | "location" | "department" | "custom";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? "The dashboard could not be loaded."), { status: response.status });
  return body.data as T;
}

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardWorkspace({ activeConsole, permittedConsoles, onSelectConsole, onNavigate, onOpenNav, userName, announcements = [], onOpenAnnouncements, personal }: Props) {
  const [now] = useState(() => new Date());
  const [filters, setFilters] = useState({ location: "", department: "", months: "12" });
  const [scopePreset, setScopePreset] = useState<Scope>("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const [view, setView] = useState<"console" | "widgets">("console");
  const [customising, setCustomising] = useState(false);
  const options = useSWR("/api/v1/dashboards/filters", (url: string) => getJson<FilterOptions & { boards: BoardId[]; mine?: { location: string | null; department: string | null } }>(url), { revalidateOnFocus: false });
  const quick = useQuickActions(onOpenNav ?? (() => {}));
  const defaultDashboard = usePreference<BoardId | null>("default_dashboard");

  // Consoles the shell allows (navigation, plan, persona) that the server also lets this role open.
  const allowed = useMemo(() => {
    const shell = new Set(permittedConsoles.map((code) => code.toLowerCase()));
    const server = options.data ? new Set(options.data.boards) : null;
    return CONSOLES.filter((console) => shell.has(console.id) && (!server || server.has(console.id)));
  }, [permittedConsoles, options.data]);

  const requested = String(activeConsole ?? "").toLowerCase();
  const current = allowed.find((console) => console.id === requested) ?? allowed[0] ?? null;
  const myDefault = defaultDashboard.value && allowed.some((console) => console.id === defaultDashboard.value) ? defaultDashboard.value : null;

  // Open the member's chosen default dashboard once per session (later choices in the picker win).
  useEffect(() => {
    if (!myDefault || !onSelectConsole) return;
    const key = "nucleus_default_dashboard_applied";
    try {
      if (sessionStorage.getItem(key) === myDefault) return;
      sessionStorage.setItem(key, myDefault);
    } catch { /* storage blocked: apply every time */ }
    if (current?.id !== myDefault) onSelectConsole(myDefault.toUpperCase());
  }, [myDefault, onSelectConsole, current?.id]);

  function chooseScope(next: Scope) {
    setScopePreset(next);
    const mine = options.data?.mine;
    if (next === "all") setFilters((value) => ({ ...value, location: "", department: "" }));
    if (next === "location") setFilters((value) => ({ ...value, location: mine?.location ?? "", department: "" }));
    if (next === "department") setFilters((value) => ({ ...value, location: "", department: mine?.department ?? "" }));
  }

  const query = new URLSearchParams();
  if (filters.location) query.set("location", filters.location);
  if (filters.department) query.set("department", filters.department);
  query.set("months", filters.months);
  const board = useSWR(current ? `/api/v1/dashboards/${current.id}?${query.toString()}` : null, (url: string) => getJson<Board>(url), {
    revalidateOnFocus: false, keepPreviousData: true,
  });

  // Previous figures stay on screen (dimmed) while the next ones load.
  const data = board.data;
  const currency = data?.scope.currency ?? "INR";
  // Only the filters a board actually applies are offered (attendance is always the last 30 days, payroll is per run).
  const filterSet = current ? BOARD_FILTERS[current.id] : { workforce: false, period: false };
  const usesFilters = filterSet.workforce || filterSet.period;
  const filtersActive = Boolean(filters.location || filters.department || filters.months !== "12");
  const firstName = (userName ?? "").split(" ")[0];

  const header = (
    <PageHeader
      eyebrow={[data?.scope.organisation, data?.scope.today ? formatDate(data.scope.today) : null].filter(Boolean).join(" · ") || "Dashboards"}
      title={<>{greeting(now.getHours())}{firstName ? <>, <span className={ui.gradientText}>{firstName}</span></> : null}</>}
      description={current ? `${current.code} · ${current.title}. ${current.description}` : "No dashboard is available for your role."}
      actions={
        <>
          {personal && (
            <div className={ui.pills} role="group" aria-label="Dashboard view">
              <button type="button" className={ui.pill} aria-pressed={view === "console"} onClick={() => setView("console")}>Console</button>
              <button type="button" className={ui.pill} aria-pressed={view === "widgets"} onClick={() => setView("widgets")}><LayoutGrid size={14} aria-hidden="true" />My widgets</button>
            </div>
          )}
          {allowed.length > 1 && view === "console" && (
            <label className={styles.consolePicker}>
              <span className={styles.srOnly}>Dashboard</span>
              <Select value={current?.id ?? ""} onChange={(event) => { const next = allowed.find((console) => console.id === event.target.value); if (next) onSelectConsole?.(next.code); }}>
                {allowed.map((console) => <option key={console.id} value={console.id}>{console.code} · {console.title}{console.id === myDefault ? " (my default)" : ""}</option>)}
              </Select>
            </label>
          )}
          {allowed.length > 1 && view === "console" && current && (
            <Button
              icon={Star}
              aria-pressed={current.id === myDefault}
              className={current.id === myDefault ? styles.isDefault : undefined}
              onClick={() => void defaultDashboard.save(current.id === myDefault ? null : current.id)}
              title={current.id === myDefault ? "This opens first when you sign in. Click to stop." : "Open this dashboard first when you sign in"}
            >
              {current.id === myDefault ? "My default" : "Make default"}
            </Button>
          )}
          {view === "console" && current && <Button icon={RotateCw} onClick={() => void board.mutate()} loading={board.isValidating && !board.isLoading} aria-label="Refresh the dashboard">Refresh</Button>}
        </>
      }
    />
  );

  return (
    <Scope module="dashboards">
      <div className={ui.page}>
        {header}

        {view === "widgets" && personal ? (
          <>
            <Alert tone="info">My widgets is the customisable layout from the classic interface. Its widgets have not been redesigned yet; some show illustrative examples rather than your organisation&apos;s records.</Alert>
            <div>{personal}</div>
          </>
        ) : !current ? (
          <Panel><p className={ui.pageDescription}>Your role has no dashboards in this organisation. Ask an administrator if you expected one.</p></Panel>
        ) : (
          <>
            {onOpenNav && <QuickActionsBar quick={quick} onCustomise={() => setCustomising(true)} />}

            {usesFilters && (
              <div className={styles.filterRow} role="group" aria-label="Dashboard filters">
                {filterSet.workforce && (
                  <div className={ui.pills} role="group" aria-label="Who to include">
                    <button type="button" className={ui.pill} aria-pressed={scopePreset === "all"} onClick={() => chooseScope("all")}>Whole organisation</button>
                    {options.data?.mine?.location && <button type="button" className={ui.pill} aria-pressed={scopePreset === "location"} onClick={() => chooseScope("location")}>My location</button>}
                    {options.data?.mine?.department && <button type="button" className={ui.pill} aria-pressed={scopePreset === "department"} onClick={() => chooseScope("department")}>My department</button>}
                  </div>
                )}
                {filterSet.period && (
                  <Select aria-label="Period" value={filters.months} onChange={(event) => setFilters({ ...filters, months: event.target.value })}>
                    <option value="1">Last month</option>
                    <option value="3">Last 3 months</option>
                    <option value="6">Last 6 months</option>
                    <option value="12">Last 12 months</option>
                  </Select>
                )}
                {filterSet.workforce && !moreFilters && (
                  <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setMoreFilters(true)}>More filters</Button>
                )}
                {filterSet.workforce && moreFilters && (
                  <>
                    <Select aria-label="Location" value={filters.location} onChange={(event) => { setScopePreset("custom"); setFilters({ ...filters, location: event.target.value }); }}>
                      <option value="">All locations</option>
                      {(options.data?.locations ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                    </Select>
                    <Select aria-label="Department" value={filters.department} onChange={(event) => { setScopePreset("custom"); setFilters({ ...filters, department: event.target.value }); }}>
                      <option value="">All departments</option>
                      {(options.data?.departments ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                    </Select>
                  </>
                )}
                {filtersActive && <Button variant="ghost" icon={X} onClick={() => { setFilters({ location: "", department: "", months: "12" }); setScopePreset("all"); setMoreFilters(false); }}>Clear</Button>}
                {data?.scope.employeesInScope !== null && data?.scope.employeesInScope !== undefined && (
                  <span className={styles.scopeNote} aria-live="polite">{data.scope.employeesInScope.toLocaleString("en-IN")} active {data.scope.employeesInScope === 1 ? "employee" : "employees"} in scope</span>
                )}
              </div>
            )}

            {board.error && !data ? (
              <ErrorState message={(board.error as Error).message} onRetry={() => void board.mutate()} />
            ) : !data ? (
              <div className={styles.loading}><Panel><SkeletonRows rows={2} columns={6} /></Panel><Panel><SkeletonRows rows={6} columns={4} /></Panel></div>
            ) : (
              <div className={cx(styles.board, board.isValidating && styles.refreshing)} aria-busy={board.isValidating}>
                {data.notice ? <Alert tone="info">{data.notice}</Alert> : null}
                {board.error && <Alert tone="warning">The latest figures could not be loaded; showing the previous ones. {(board.error as Error).message}</Alert>}

                {data.kpis.length > 0 && (
                  <ul className={styles.kpis} aria-label="Key figures">
                    {data.kpis.map((kpi) => {
                      const value = kpi.value === null ? "—" : kpi.format === "text" ? String(kpi.value) : formatCompact(kpi.value as number, kpi.format, currency);
                      const content = (
                        <>
                          <span className={styles.kpiLabel}>{kpi.label}</span>
                          <span className={styles.kpiValue}>{value}{kpi.of !== null && kpi.of !== undefined && kpi.value !== null && <span className={styles.kpiOf}> / {kpi.of.toLocaleString("en-IN")}</span>}</span>
                          {kpi.delta && kpi.value !== null && (() => {
                            const { value: change, better } = kpi.delta;
                            const good = better === "neutral" || change === 0 ? "neutral" : (change > 0) === (better === "up") ? "good" : "bad";
                            const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : ArrowRight;
                            const amount = `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatCompact(Math.abs(change), kpi.delta.format, currency)}${kpi.delta.unit ?? ""}`;
                            return (
                              <span className={cx(styles.kpiDelta, good === "good" ? styles.deltaGood : good === "bad" ? styles.deltaBad : styles.deltaNeutral)}>
                                <Icon size={13} aria-hidden="true" />{amount} <span className={styles.deltaLabel}>{kpi.delta.label}</span>
                              </span>
                            );
                          })()}
                          {kpi.hint && <span className={styles.kpiHint}>{kpi.hint}</span>}
                        </>
                      );
                      return (
                        <li key={kpi.id}>
                          {kpi.target && onNavigate ? <button type="button" className={cx(styles.kpi, styles.kpiButton)} onClick={() => onNavigate(kpi.target!)}>{content}</button> : <div className={styles.kpi}>{content}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {data.insights.length > 0 && <SummaryBand insights={data.insights} evidence={data.evidence} audience={data.scope.audience} generatedAt={data.generatedAt} />}

                <div className={styles.grid}>
                  {data.panels.map((panel) => <PanelView key={`${data.board}-${panel.id}`} panel={panel} currency={currency} onNavigate={onNavigate} />)}
                </div>
              </div>
            )}

            {announcements.length > 0 && (
              <Panel title="Announcements" subtitle="From the organisation's broadcasts" actions={onOpenAnnouncements ? <Button size="sm" icon={Megaphone} onClick={onOpenAnnouncements}>Manage</Button> : undefined} flush>
                <ul className={styles.list}>
                  {announcements.slice(0, 4).map((item) => (
                    <li key={String(item.id)}>
                      <div className={styles.listRow}>
                        <span className={styles.listText}><span className={styles.listLabel}>{item.title ?? "Announcement"}</span>{item.content && <span className={styles.listDetail}>{item.content}</span>}</span>
                        <span className={styles.listDetail}>{[item.author, item.date].filter(Boolean).join(" · ")}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        )}
      </div>
      {customising && <CustomiseQuickActions open={customising} onClose={() => setCustomising(false)} quick={quick} />}
    </Scope>
  );
}
