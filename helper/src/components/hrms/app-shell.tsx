"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronDown,
  Command,
  LayoutGrid,
  Menu,
  Moon,
  PanelRight,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { isAdminPrincipal } from "@/lib/cockpit-catalog";
import {
  activeEmployeeNavigationGroup,
  buildEmployeeNavigationGroups,
  type EmployeeNavigationGroup,
} from "@/lib/employee-navigation";
import { getAuthorizedNavigation, navigationDomains } from "@/lib/navigation-catalog";
import type { Persona } from "@/lib/hrms-data";
import { cn } from "@/lib/utils";
import { RightRail } from "./integrated-right-rail";
import { ModuleLauncher } from "./module-launcher";
import { NucleusDock } from "./nucleus-dock";
import { NucleusSessionProvider } from "./nucleus-session-provider";
import { getNavigationIcon } from "./navigation-icons";
import { useWorkspace } from "./workspace-provider";

type PersonaContextValue = { persona: Persona; setPersona: (persona: Persona) => void };
const fallbackPersona: Persona = { id: "loading", name: "Workspace user", role: "Loading access", initials: "WU", accent: "var(--primary)" };
const PersonaContext = createContext<PersonaContextValue>({ persona: fallbackPersona, setPersona: () => undefined });
export function usePersona() { return useContext(PersonaContext); }

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Nucleus HRMS dashboard">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-heading text-base font-bold text-primary-foreground">N</span>
      {!compact && (
        <span className="min-w-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 whitespace-nowrap">
          <span className="block truncate font-heading text-[13px] font-bold tracking-[0.035em] text-foreground">NUCLEUS HRMS</span>
          <span className="block text-[11px] text-muted-foreground">WORKFORCE OS</span>
        </span>
      )}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" className="shrink-0 border border-border" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}

function PersonaSwitcher() {
  const { persona } = usePersona();
  const { workspace, switchTenant } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-10 min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-secondary" aria-expanded={open} aria-label="Open account and workspace menu">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-warning/35 bg-warning/10 text-[11px] font-bold text-warning">{persona.initials}</span>
        <span className="hidden min-w-0 xl:block"><span className="block max-w-36 truncate text-[12px] font-bold leading-tight text-foreground">{persona.name}</span><span className="block max-w-36 truncate text-[11px] text-muted-foreground">{persona.role}</span></span>
        <ChevronDown className="hidden size-3.5 shrink-0 text-muted-foreground xl:block" />
      </button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-[10px] border border-border bg-popover p-2 shadow-[var(--shadow-overlay)]">
          <div className="rounded-lg bg-secondary px-3 py-3"><p className="truncate text-sm font-bold">{workspace?.user.name ?? persona.name}</p><p className="mt-0.5 truncate text-[12px] text-muted-foreground">{workspace?.user.email}</p></div>
          <p className="px-2 pb-1 pt-3 text-[11px] font-bold text-muted-foreground">Authorised workspaces</p>
          {workspace?.memberships.map((membership) => (
            <button key={membership.tenantId} type="button" onClick={() => { void switchTenant(membership.tenantId); setOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary", workspace.context?.tenantId === membership.tenantId && "bg-accent")}>
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-primary/10 text-[11px] font-bold text-primary">{membership.tenantName.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold">{membership.tenantName}</span><span className="block truncate text-[11px] text-muted-foreground">{membership.tenantSlug}</span></span>
              {workspace.context?.tenantId === membership.tenantId && <Check className="size-4 text-primary" />}
            </button>
          ))}
          <div className="mt-2 border-t border-border pt-2">
            {workspace?.platformAdmin && <Link href="/platform" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2 rounded-lg px-3 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground"><ShieldCheck className="size-4" />Platform administration</Link>}
            <Link href="/settings/security" onClick={() => setOpen(false)} className="flex h-10 items-center rounded-lg px-3 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground">Password & sessions</Link>
            <button type="button" onClick={() => { void authClient.signOut().then(() => { router.replace("/login"); router.refresh(); }); }} className="flex h-10 w-full items-center rounded-lg px-3 text-left text-[12px] text-destructive hover:bg-destructive/10">Sign out</button>
          </div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function GlobalSearch({ permissions, roles }: { permissions: string[]; roles: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; type: string; title: string; subtitle?: string; href: string }>>([]);
  const [searching, setSearching] = useState(false);
  const authorised = useMemo(() => getAuthorizedNavigation(permissions, roles), [permissions, roles]);
  const moduleMatches = useMemo(() => authorised
    .filter((item) => [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(query.toLowerCase())))
    .map((item) => ({ id: item.id, type: item.icon, title: item.label, subtitle: item.description, href: item.href })), [authorised, query]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-global-search]")?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<{ data?: typeof results }> : { data: [] })
        .then((payload) => setResults(payload.data ?? []))
        .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setResults([]); })
        .finally(() => setSearching(false));
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query]);

  const matches = [...results, ...moduleMatches].slice(0, 8);
  return (
    <div className="relative hidden min-w-0 shrink md:block md:w-[clamp(240px,28vw,440px)]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input data-global-search value={query} onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) { setResults([]); setSearching(false); } }} placeholder="Search employees, documents, tasks..." className="h-9 w-full rounded-lg border border-border bg-secondary/80 pl-10 pr-14 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-ring" />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"><Command className="mr-0.5 inline size-3" />K</span>
      <AnimatePresence>{query && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-12 z-50 rounded-[10px] border border-border bg-popover p-2 shadow-[var(--shadow-overlay)]">
        {searching ? <p className="px-3 py-5 text-center text-[12px] text-muted-foreground">Searching authorised records…</p> : matches.length ? matches.map((item) => { const Icon = getNavigationIcon(item.type); return <Link key={`${item.type}-${item.id}`} href={item.href} onClick={() => setQuery("")} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] hover:bg-secondary"><Icon className="size-4 shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate font-bold text-foreground">{item.title}</span>{item.subtitle && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.subtitle}</span>}</span></Link>; }) : <p className="px-3 py-5 text-center text-[12px] text-muted-foreground">No authorised records found</p>}
      </motion.div>}</AnimatePresence>
    </div>
  );
}

function NotificationButton() {
  const { workspace, markNotificationRead } = useWorkspace();
  const [open, setOpen] = useState(false);
  const notifications = workspace?.notifications.items ?? [];
  const unread = workspace?.notifications.unread ?? 0;
  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((value) => !value)} className="relative grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground lg:size-9" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell className="size-[17px]" />{unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full border border-card bg-destructive" />}
      </button>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[10px] border border-border bg-popover shadow-[var(--shadow-overlay)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="font-heading text-sm font-semibold">Notifications</p><p className="mt-0.5 text-[11px] text-muted-foreground">{unread} unread</p></div><Link href="/settings" onClick={() => setOpen(false)} className="text-[12px] font-bold text-primary">Preferences</Link></div>
        <div className="max-h-96 overflow-y-auto p-2">{notifications.length === 0 ? <p className="px-3 py-8 text-center text-[12px] text-muted-foreground">You are all caught up.</p> : notifications.map((notification) => <button key={notification.id} type="button" onClick={() => { if (!notification.attributes.read) void markNotificationRead(notification.id); }} className={cn("mb-1 block w-full rounded-lg border px-3 py-3 text-left", notification.attributes.read ? "border-transparent text-muted-foreground" : "border-primary/25 bg-primary/5")}><span className="block text-[12px] font-bold text-foreground">{notification.attributes.title ?? "Workspace update"}</span><span className="mt-1 block text-[11px] leading-4">{notification.attributes.body ?? "A record in your workspace changed."}</span><span className="mt-1.5 block text-[11px] text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</span></button>)}</div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}

// Both sheets are hidden by a breakpoint utility once their desktop equivalent
// takes over. Close them when the viewport crosses that breakpoint, otherwise
// the popup goes display:none while the backdrop and scroll lock survive.
function useCloseAtBreakpoint(query: string, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const media = window.matchMedia(query);
    if (media.matches) {
      close();
      return;
    }
    const onChange = () => { if (media.matches) close(); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [close, open, query]);
}

type DockDomain = (typeof navigationDomains)[number] & { href: string };

// Shared between the desktop hover dock and the mobile navigation sheet so both
// surfaces always expose exactly the same destinations.
//
// Two shapes come out of here, chosen by principal, never by viewport:
//
// - ADMINISTRATIVE: the enterprise domain dock, unchanged. An administrator
//   navigates by business function, so "Core HR" and "Payroll & Finance" are
//   the right words.
// - EVERYONE ELSE: the flat self-service groups from lib/employee-navigation —
//   "My Leaves", "My Attendance" — built from the SAME authorised set. This
//   regroups what the reader could already open; it never adds a destination.
//
// `isAdminPrincipal` decides, and it is the only thing that decides. There is
// no toggle between the two docks: an employee cannot switch themselves into
// the administrative navigation, which is the whole point of the split.
function useDockNavigation() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const permissions = workspace?.context?.permissions ?? [];
  const roles = workspace?.context?.roles ?? [];
  const admin = isAdminPrincipal(permissions, roles);
  const authorized = getAuthorizedNavigation(permissions, roles);
  const groups = admin ? [] : buildEmployeeNavigationGroups(authorized);
  const activeGroupId = activeEmployeeNavigationGroup(groups, pathname)?.id;
  const activeDomain = authorized.find(item => item.href === "/" ? pathname === "/" : pathname === item.href)?.domain;
  const allDomains: DockDomain[] = navigationDomains.flatMap(domain => {
    const first = authorized.find(item => item.domain === domain.id);
    return first ? [{ ...domain, href: first.href }] : [];
  });
  const domains = [
    ...allDomains.filter(domain => domain.id === "workspace"),
    ...allDomains.filter(domain => !["workspace", "platform"].includes(domain.id)),
  ];
  const platformDomain = navigationDomains.find(domain => domain.id === "platform");
  const platformLabel = platformDomain?.label ?? "Platform Settings";
  const platformHref = allDomains.find(d => d.id === "platform")?.href ?? (workspace?.platformAdmin ? "/platform" : "/settings");
  const isPlatformActive = pathname.startsWith("/platform") || pathname.startsWith("/settings") || pathname.startsWith("/integrations") || pathname.startsWith("/readiness") || activeDomain === "platform";

  return { admin, domains, activeDomain, groups, activeGroupId, platformLabel, platformHref, isPlatformActive };
}

function HoverLeftDock() {
  const { admin, domains, activeDomain, groups, activeGroupId, platformLabel, platformHref, isPlatformActive } = useDockNavigation();

  function dockLink({ key, href, label, icon, active }: { key: string; href: string; label: string; icon: string; active: boolean }) {
    const Icon = getNavigationIcon(icon);
    return <Link key={key} href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-muted-foreground hover:bg-sidebar-accent", active && "bg-sidebar-accent text-primary")}><Icon className="size-5 shrink-0" /><span className="whitespace-nowrap text-[13px] font-bold opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">{label}</span></Link>;
  }

  const links = admin
    ? domains.map((domain: DockDomain) => dockLink({ key: domain.id, href: domain.href, label: domain.label, icon: domain.icon, active: domain.id === activeDomain }))
    : groups.map((group: EmployeeNavigationGroup) => dockLink({ key: group.id, href: group.href, label: group.label, icon: group.icon, active: group.id === activeGroupId }));

  // Hidden below `md`: on phones the same destinations live in MobileNavSheet,
  // so the 64px gutter never eats into a 375px viewport.
  // Expands on hover, and on KEYBOARD focus only. Plain `focus-within` kept it
  // open after a click, because the clicked link keeps focus once the pointer has
  // moved away — so the dock stayed at 240px over the page until something else
  // was clicked. `:has(:focus-visible)` is the same affordance for keyboard users
  // without that stuck state.
  return <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[64px] flex-col border-r border-sidebar-border bg-sidebar transition-all hover:w-[240px] hover:shadow-2xl has-[:focus-visible]:w-[240px] has-[:focus-visible]:shadow-2xl md:flex" aria-label={admin ? "Primary modules" : "My workspace"}>
    <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-sidebar-border px-3.5"><Brand /></div>
    <nav className="flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto px-2 py-4">
      {links}
    </nav>
    {/* Platform Settings is an administrative destination. It used to fall back
        to /settings for everyone, which handed a non-admin a link into a
        surface they cannot open, so it is now rendered only for the principal
        it belongs to. */}
    {admin && <div className="shrink-0 overflow-hidden border-t border-sidebar-border p-2">
      <Link
        href={platformHref}
        title={platformLabel}
        aria-label={platformLabel}
        aria-current={isPlatformActive ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-muted-foreground hover:bg-sidebar-accent",
          isPlatformActive && "bg-sidebar-accent text-primary"
        )}
      >
        <Settings2 className="size-5 shrink-0" />
        <span className="whitespace-nowrap text-[13px] font-bold opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
          {platformLabel}
        </span>
      </Link>
    </div>}
  </aside>;
}

function MobileNavSheet({
  open,
  onOpenChange,
  onOpenLauncher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLauncher: () => void;
}) {
  const { admin, domains, activeDomain, groups, activeGroupId, platformLabel, platformHref, isPlatformActive } = useDockNavigation();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useCloseAtBreakpoint("(min-width: 768px)", open, close);

  function sheetLink({ key, href, label, description, icon, active }: { key: string; href: string; label: string; description: string; icon: string; active: boolean }) {
    const Icon = getNavigationIcon(icon);
    return (
      <Link
        key={key}
        href={href}
        onClick={close}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground",
          active && "bg-accent text-accent-foreground"
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
        </span>
        {active && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary">Current</span>}
      </Link>
    );
  }

  // The phone sheet is the same navigation as the desktop dock, not a second
  // one: an employee gets their self-service groups here too.
  const links = admin
    ? domains.map((domain: DockDomain) => sheetLink({ key: domain.id, href: domain.href, label: domain.label, description: domain.description, icon: domain.icon, active: domain.id === activeDomain }))
    : groups.map((group: EmployeeNavigationGroup) => sheetLink({ key: group.id, href: group.href, label: group.label, description: group.description, icon: group.icon, active: group.id === activeGroupId }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(320px,90vw)] gap-0 border-border bg-card p-0 sm:max-w-[320px] md:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3.5">
          <SheetTitle className="font-heading text-[14px] font-semibold">{admin ? "Navigation" : "My workspace"}</SheetTitle>
          <SheetDescription className="text-[11px]">{admin ? "Every authorised module group." : "Your self-service sections."}</SheetDescription>
        </SheetHeader>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3" aria-label={admin ? "Primary modules" : "My workspace"}>
          {links}
        </nav>
        <div className="shrink-0 space-y-1 border-t border-border p-3">
          {admin && <Link
            href={platformHref}
            onClick={close}
            aria-current={isPlatformActive ? "page" : undefined}
            className={cn(
              "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground",
              isPlatformActive && "bg-accent text-accent-foreground"
            )}
          >
            <Settings2 className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{platformLabel}</span>
          </Link>}
          <button
            type="button"
            onClick={() => { close(); onOpenLauncher(); }}
            className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LayoutGrid className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">All modules</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const RAIL_PREFERENCE_KEY = "nucleus:right-rail-open";
const railPreferenceListeners = new Set<() => void>();

function subscribeToRailPreference(onChange: () => void): () => void {
  railPreferenceListeners.add(onChange);
  // Another tab writing the preference must move this one too.
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    railPreferenceListeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

function readRailPreference(): string | null {
  try {
    return localStorage.getItem(RAIL_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

function writeRailPreference(open: boolean): void {
  try {
    localStorage.setItem(RAIL_PREFERENCE_KEY, String(open));
  } catch {}
  for (const listener of railPreferenceListeners) listener();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { workspace, loading, error, refresh } = useWorkspace();
  const [launcherOpen, setLauncherOpen] = useState(false);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const permissions = workspace?.context?.permissions ?? [];
  const roles = workspace?.context?.roles ?? [];

  const storedRailPreference = useSyncExternalStore(subscribeToRailPreference, readRailPreference, () => null);
  const rightRailOpen = storedRailPreference === null ? true : storedRailPreference === "true";

  const toggleRightRail = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
      writeRailPreference(!rightRailOpen);
    } else {
      setMobileDrawerOpen((prev) => !prev);
    }
  };

  const handleCloseRightRail = () => {
    writeRailPreference(false);
  };

  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  useCloseAtBreakpoint("(min-width: 1280px)", mobileDrawerOpen, closeMobileDrawer);

  const persona = useMemo<Persona>(() => {
    if (!workspace?.user) return fallbackPersona;
    const parts = workspace.user.name.trim().split(/\s+/).filter(Boolean);
    return { id: workspace.user.id, name: workspace.user.name, role: workspace.context?.roles.join(", ") || "Member", initials: `${parts[0]?.[0] ?? "U"}${parts[1]?.[0] ?? ""}`.toUpperCase(), accent: "var(--primary)" };
  }, [workspace]);
  const contextValue = useMemo(() => ({ persona, setPersona: () => undefined }), [persona]);

  return (
    <PersonaContext.Provider value={contextValue}>
      {/*
        The Nucleus AI session is held here, above the router. This component is
        rendered by (workspace)/layout.tsx, and a Next.js layout persists across
        navigation inside its route group, so a voice session survives the
        `router.push` that `open_screen` performs. Held in the page instead, the
        socket and the microphone died the moment the assistant opened a screen.
      */}
      <NucleusSessionProvider>
      <MotionConfig reducedMotion="user">
        {/*
          `overflow-x-clip`, not `overflow-x-hidden`. Both stop sideways overflow, but
          `hidden` on one axis forces the other to compute to `auto`, which makes this
          element a scroll container — and a sticky descendant anchors to its nearest
          scroll container. This box is `min-h-svh` with auto height, so it grows with the
          content and never actually scrolls; the page scrolls instead. Every `sticky`
          inside it was therefore anchored to a box that never moves, which is why the
          right rail scrolled away with the page. `clip` establishes no scroll container,
          so sticky resolves against the viewport again.
        */}
        <div className="min-h-svh w-full max-w-full overflow-x-clip bg-background text-foreground">
          {(loading || error) && (
            <div role={error ? "alert" : "status"} className={cn("fixed inset-x-0 top-0 z-[80] px-4 py-2 text-center text-[12px] font-bold", error ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>
              {error || "Loading your secure workspace…"}
            </div>
          )}

          <HoverLeftDock />

          <div className="min-w-0 transition-all duration-300 md:pl-[64px]">
            <header className="sticky top-0 z-30 flex min-h-14 w-full min-w-0 flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-lg sm:min-h-[60px] sm:gap-2 sm:px-4 sm:py-0 lg:min-h-16 lg:px-5">
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open primary navigation">
                <Menu className="size-5" />
              </Button>

              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setLauncherOpen(true)} aria-label="Open modules">
                <LayoutGrid className="size-5" />
              </Button>

              <GlobalSearch permissions={permissions} roles={roles} />

              <Button variant="outline" className="hidden shrink-0 gap-2 lg:inline-flex" onClick={() => setLauncherOpen(true)}>
                <LayoutGrid className="size-4" />Modules <span className="ml-1 text-[11px] font-normal text-muted-foreground">⌘M</span>
              </Button>

              <span className="flex-1" />

              <Link href="/people" className="hidden h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 font-heading text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 sm:flex lg:h-9" aria-label="Add person">
                <Plus className="size-4" />Quick add
              </Link>

              <ThemeToggle />

              <NotificationButton />

              <PersonaSwitcher />

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRightRail}
                aria-label="Toggle navigation panel"
                aria-expanded={rightRailOpen || mobileDrawerOpen}
                className={cn("shrink-0 sm:ml-1", (rightRailOpen || mobileDrawerOpen) && "bg-secondary text-foreground")}
              >
                <PanelRight className="size-[18px]" />
              </Button>
            </header>

            <div className="flex min-h-[calc(100svh-64px)] w-full min-w-0">
              <main className="min-w-0 max-w-full flex-1 p-4 sm:p-5 lg:p-6">
                {loading ? (
                  <div role="status" className="grid min-h-[50svh] place-items-center">
                    <p className="text-sm text-muted-foreground">Loading your secure workspace…</p>
                  </div>
                ) : workspace ? (
                  children
                ) : (
                  <div role="alert" className="grid min-h-[50svh] place-items-center text-center">
                    <div>
                      <p className="text-sm text-foreground">{error || "Workspace data is unavailable."}</p>
                      <button type="button" onClick={() => { void refresh(); }} className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground">
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </main>

              {rightRailOpen && (
                <div className="sticky top-16 hidden h-[calc(100svh-64px)] shrink-0 overflow-hidden border-l border-border bg-card xl:block xl:w-[260px]">
                  <RightRail onClose={handleCloseRightRail} />
                </div>
              )}
            </div>
          </div>


          <ModuleLauncher open={launcherOpen} onOpenChange={setLauncherOpen} permissions={permissions} roles={roles} />

          <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} onOpenLauncher={() => setLauncherOpen(true)} />

          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetContent showCloseButton={false} className="w-[min(320px,90vw)] gap-0 border-border bg-card p-0 sm:max-w-[320px] xl:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Contextual sub-navigation.</SheetDescription>
              </SheetHeader>
              <RightRail onClose={() => setMobileDrawerOpen(false)} onNavigate={() => setMobileDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        {/* The live session, visible wherever the person has navigated to. */}
        <NucleusDock />
      </MotionConfig>
      </NucleusSessionProvider>
    </PersonaContext.Provider>
  );
}
