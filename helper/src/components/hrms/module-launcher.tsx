"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Command, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  getAuthorizedNavigation,
  navigationDomains,
  type NavigationDomainId,
  type NavigationItem,
} from "@/lib/navigation-catalog";
import { cn } from "@/lib/utils";
import { getNavigationIcon } from "./navigation-icons";

type ModuleLauncherProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: string[];
  roles?: string[];
  unread?: number;
};

function itemMatches(item: NavigationItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(normalized));
}

export function ModuleLauncher({ open, onOpenChange, permissions, roles = [], unread = 0 }: ModuleLauncherProps) {
  const pathname = usePathname();
  const authorized = useMemo(() => getAuthorizedNavigation(permissions, roles), [permissions, roles]);
  const routeDomain = authorized.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))?.domain;
  const firstDomain = navigationDomains.find((domain) => authorized.some((item) => item.domain === domain.id))?.id ?? "workspace";
  const [selectedDomain, setSelectedDomain] = useState<NavigationDomainId>(routeDomain ?? firstDomain);
  const [query, setQuery] = useState("");
  // Below `lg` the two panes are stacked and shown one at a time: pick a module
  // group ("domains"), drill into its modules ("destinations"), back out again.
  // From `lg` up both panes render side by side and this step is ignored.
  const [mobileStep, setMobileStep] = useState<"domains" | "destinations">("domains");
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLauncherOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedDomain(routeDomain ?? firstDomain);
      setQuery("");
      setMobileStep("domains");
    }
    onOpenChange(nextOpen);
  }, [firstDomain, onOpenChange, routeDomain]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setLauncherOpen(!open);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [open, setLauncherOpen]);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const availableDomains = navigationDomains.filter((domain) => authorized.some((item) => item.domain === domain.id));
  const destinations = authorized.filter((item) => query.trim() ? itemMatches(item, query) : item.domain === selectedDomain);
  const selected = navigationDomains.find((domain) => domain.id === selectedDomain);

  function selectDomain(domain: NavigationDomainId) {
    setSelectedDomain(domain);
    setMobileStep("destinations");
  }

  function previewDomain(domain: NavigationDomainId) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setSelectedDomain(domain), 100);
  }

  function moveDomainFocus(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.closest('nav')?.querySelectorAll<HTMLButtonElement>('[data-launcher-domain]') ?? []);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    buttons[(index + offset + buttons.length) % buttons.length]?.focus();
  }

  function moveDestinationFocus(event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const links = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLAnchorElement>('[data-launcher-destination]') ?? []);
    const next = Math.max(0, Math.min(links.length - 1, index + offset));
    links[next]?.focus();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setLauncherOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-[var(--shadow-overlay)] transition duration-150 data-ending-style:scale-[.98] data-ending-style:opacity-0 data-starting-style:scale-[.98] data-starting-style:opacity-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(640px,calc(100vh-64px))] sm:w-[min(900px,calc(100vw-64px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-border">
          <header className="flex min-h-14 w-full min-w-0 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-5">
            {mobileStep === "destinations" && (
              <button type="button" onClick={() => { setMobileStep("domains"); setQuery(""); }} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden" aria-label="Back to module groups">
                <ArrowLeft className="size-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-heading text-[15px] font-semibold">
                {mobileStep === "destinations" && !query ? (
                  <>
                    <span className="lg:hidden">{selected?.label ?? "Modules"}</span>
                    <span className="hidden lg:inline">Modules</span>
                  </>
                ) : (
                  "Modules"
                )}
              </Dialog.Title>
              <Dialog.Description className="sr-only">Choose an authorised Nucleus HRMS destination.</Dialog.Description>
            </div>
            <label className="relative hidden min-w-0 lg:block lg:w-[min(360px,30vw)]">
              <span className="sr-only">Search modules</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules" className="h-10 w-full rounded-lg border border-border bg-secondary pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring" />
            </label>
            <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close modules">
              <X className="size-5" />
            </Dialog.Close>
          </header>

          <div className="w-full shrink-0 border-b border-border p-3 lg:hidden">
            <label className="relative block min-w-0">
              <span className="sr-only">Search modules</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onFocus={() => setMobileStep("destinations")} onChange={(event) => { setQuery(event.target.value); setMobileStep("destinations"); }} placeholder="Search modules" className="h-11 w-full rounded-lg border border-border bg-secondary pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring" />
            </label>
          </div>

          <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <nav className={cn("min-h-0 min-w-0 overflow-y-auto bg-secondary/55 p-3 lg:border-r lg:border-border", mobileStep !== "domains" && "hidden lg:block")} aria-label="Module groups">
              {availableDomains.map((domain, index) => {
                const Icon = getNavigationIcon(domain.icon);
                const active = domain.id === selectedDomain;
                const count = authorized.filter((item) => item.domain === domain.id).length;
                return (
                  <button data-launcher-domain key={domain.id} type="button" onClick={() => selectDomain(domain.id)} onKeyDown={(event) => moveDomainFocus(event, index)} onMouseEnter={() => previewDomain(domain.id)} onMouseLeave={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }} onFocus={() => setSelectedDomain(domain.id)} className={cn("mb-1 flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground")} aria-current={active ? "true" : undefined}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}><Icon className="size-[18px]" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-heading text-[13px] font-semibold">{domain.label}</span><span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">{count} {count === 1 ? "module" : "modules"}</span></span>
                    <ChevronRight className="size-4 shrink-0" />
                  </button>
                );
              })}
            </nav>

            <section className={cn("min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5", mobileStep !== "destinations" && "hidden lg:block")} aria-label={query ? "Module search results" : `${selected?.label ?? "Module"} destinations`}>
              <div className="mb-4 min-w-0">
                <h2 className="font-heading text-lg font-semibold">{query ? "Search results" : selected?.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{query ? `${destinations.length} authorised ${destinations.length === 1 ? "destination" : "destinations"}` : selected?.description}</p>
              </div>
              {destinations.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {destinations.map((item, index) => {
                    const Icon = getNavigationIcon(item.icon);
                    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <Link data-launcher-destination key={item.id} href={item.href} onClick={() => setLauncherOpen(false)} onKeyDown={(event) => moveDestinationFocus(event, index)} className={cn("group flex min-h-24 items-start gap-3 rounded-lg border p-4 transition-colors", active ? "border-primary/40 bg-accent" : "border-border bg-card hover:border-primary/35 hover:bg-secondary/70")} aria-current={active ? "page" : undefined}>
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-primary"><Icon className="size-5" /></span>
                        <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2 font-heading text-[13px] font-semibold text-foreground"><span className="min-w-0 truncate">{item.label}</span>{item.badge === "notifications" && unread > 0 && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-sans text-[11px] font-bold text-primary-foreground">{unread}</span>}</span><span className="mt-1.5 block text-[12px] leading-[18px] text-muted-foreground">{item.description}</span></span>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center"><p className="font-heading text-sm font-semibold">No authorised modules found</p><p className="mt-1 text-sm text-muted-foreground">Try a different name or keyword.</p></div>
              )}
            </section>
          </div>

          <footer className="hidden min-h-10 shrink-0 items-center justify-between border-t border-border px-5 text-[11px] text-muted-foreground lg:flex">
            <span>{authorized.length} authorised destinations</span>
            <span className="inline-flex items-center gap-1.5"><Command className="size-3" />M open · Esc close</span>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
