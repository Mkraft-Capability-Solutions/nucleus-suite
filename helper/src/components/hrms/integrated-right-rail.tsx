"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Sparkles,
  X,
} from "lucide-react";
import { authorizedCockpits, isAdminPrincipal } from "@/lib/cockpit-catalog";
import {
  activeEmployeeNavigationGroup,
  buildEmployeeNavigationGroups,
} from "@/lib/employee-navigation";
import {
  getAuthorizedNavigation,
  navigationDomains,
  type NavigationDomainId,
} from "@/lib/navigation-catalog";
import { cn } from "@/lib/utils";
import { getNavigationIcon } from "./navigation-icons";
import { useWorkspace } from "./workspace-provider";

export function RightRail({
  className,
  onClose,
  onNavigate,
  selectedDomain,
}: {
  className?: string;
  onClose?: () => void;
  onNavigate?: () => void;
  selectedDomain?: NavigationDomainId;
}) {
  const pathname = usePathname();
  const { workspace, markNotificationRead } = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  /**
   * `/api/assistant` answers `{ answer, sources }`, and this panel used to read
   * the answer and drop the sources on the floor. That is the one thing this
   * assistant must not do: it answers from approved policy passages, and an
   * answer whose passages are not shown cannot be checked against the policy it
   * claims to be quoting.
   */
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const tenant = workspace?.memberships.find(
    (item) => item.tenantId === workspace.context?.tenantId
  );
  const notifications = workspace?.notifications.items ?? [];
  const permissions = workspace?.context?.permissions ?? [];
  const roles = workspace?.context?.roles ?? [];
  const admin = isAdminPrincipal(permissions, roles);
  const authorised = getAuthorizedNavigation(permissions, roles);

  const activeItem = authorised.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const activeDomain = selectedDomain ?? activeItem?.domain ?? "workspace";
  // `authorised` is already persona-filtered: getAuthorizedNavigation applies the
  // catalogue's default-deny audience rule, so an employee standing on a Core HR
  // page gets their own Core HR items and not the thirty-one-entry admin list.
  const contextualItems = admin ? authorised.filter((item) => item.domain === activeDomain) : [];
  const contextualGroups = [...new Set(contextualItems.map((item) => item.group ?? "Features"))];
  const domainLabel =
    navigationDomains.find((domain) => domain.id === activeDomain)?.label ?? "Workspace";

  // The employee rail speaks "my", not "Core HR". Two sections, both read from
  // the same access rules the rest of the app uses — `authorizedCockpits` for
  // the consoles, `getAuthorizedNavigation` (already applied above) for the
  // modules — so the rail can never surface something the reader cannot open.
  const selfServiceGroups = admin ? [] : buildEmployeeNavigationGroups(authorised);
  const currentSelfServiceGroup = activeEmployeeNavigationGroup(selfServiceGroups, pathname);
  const myConsoles = admin ? [] : authorizedCockpits(permissions, roles);
  const railLabel = admin ? domainLabel : "My Consoles & Hub";

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || busy) return;

    setBusy(true);
    setAnswer("");
    setSources([]);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: prompt.trim() }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { answer?: string; text?: string; output?: string; sources?: unknown };
        setAnswer(
          payload.answer || payload.text || payload.output || "No answer was returned. Please try again."
        );
        const cited = Array.isArray(payload.sources)
          ? payload.sources
              .map((entry) =>
                typeof entry === "string"
                  ? entry
                  : typeof entry === "object" && entry !== null
                    ? String((entry as { title?: unknown; source?: unknown; id?: unknown }).title
                        ?? (entry as { source?: unknown }).source
                        ?? (entry as { id?: unknown }).id
                        ?? "")
                    : "",
              )
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [];
        setSources([...new Set(cited)]);
      } else {
        setAnswer(
          "Nucleus AI could not retrieve policy guidance. Please retry or contact your HR team."
        );
      }
    } catch {
      setAnswer(
        "Could not reach Nucleus AI. Please check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={cn(
        // Width is owned by the host: a 260px xl+ column in the shell, or a
        // `min(320px, 90vw)` sheet below xl. The rail itself never sets one.
        "flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-card text-card-foreground",
        className
      )}
      aria-label="Contextual navigation and workforce intelligence"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-ai" />
            <h2 className="min-w-0 truncate font-heading text-[14px] font-semibold text-foreground">
              {railLabel}
            </h2>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {tenant?.tenantName ?? "Workspace"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:size-7"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
        {/* A domain with nothing in it for this reader is dropped whole: no
            border, no heading, no empty shelf. */}
        {contextualGroups.length > 0 && <nav className="space-y-5 border-b border-border px-3 py-4" aria-label={domainLabel + " features"}>
          {contextualGroups.map(group => <section key={group}>
            <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</h3>
            <div className="space-y-1">{contextualItems.filter(item => (item.group ?? "Features") === group).map(item => {
              const Icon = getNavigationIcon(item.icon);
              const active = item.id === activeItem?.id;
              return <Link key={item.id} href={item.href} onClick={() => { onNavigate?.(); }} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-secondary xl:min-h-11", active && "bg-accent text-accent-foreground")}><Icon className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{active && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary">Now</span>}</Link>;
            })}</div>
          </section>)}
        </nav>}

        {/* Self-service rail. Each section is dropped whole when it has nothing
            in it, so an employee never meets an empty heading. */}
        {!admin && (myConsoles.length > 0 || currentSelfServiceGroup) && (
          <nav className="space-y-5 border-b border-border px-3 py-4" aria-label="My consoles and sections">
            {myConsoles.length > 0 && (
              <section>
                <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">My dashboard views</h3>
                <div className="space-y-1">
                  {myConsoles.map((cockpit) => {
                    const Icon = getNavigationIcon(cockpit.icon);
                    const href = `/${cockpit.id}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <Link
                        key={cockpit.id}
                        href={href}
                        onClick={() => { onNavigate?.(); }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-secondary xl:min-h-11",
                          active && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{cockpit.label}</span>
                        {active && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary">Now</span>}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {currentSelfServiceGroup && (
              <section>
                <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{currentSelfServiceGroup.label}</h3>
                <div className="space-y-1">
                  {currentSelfServiceGroup.items.map((item) => {
                    const Icon = getNavigationIcon(item.icon);
                    const active = item.id === activeItem?.id;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => { onNavigate?.(); }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-secondary xl:min-h-11",
                          active && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {active && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary">Now</span>}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </nav>
        )}

        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              My day
            </p>
            <span className="shrink-0 rounded bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">
              {workspace?.notifications.unread ?? 0} unread
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {notifications.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.attributes.read) void markNotificationRead(item.id);
                }}
                className={cn(
                  "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  item.attributes.read
                    ? "border-border/60 opacity-60"
                    : "border-primary/25 bg-primary/5 hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md border",
                    item.attributes.read
                      ? "border-success/30 text-success"
                      : "border-warning/30 text-warning"
                  )}
                >
                  {item.attributes.read ? (
                    <Check className="size-4" />
                  ) : (
                    <Clock3 className="size-4" />
                  )}
                  <span className="sr-only">{item.attributes.read ? "Read" : "Unread"}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-foreground/90">
                    {item.attributes.title ?? "Workspace update"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {item.attributes.body}
                  </span>
                </span>
              </button>
            ))}
            {notifications.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                Nothing is waiting on you.
              </p>
            )}
          </div>
          <Link
            href="/inbox"
            onClick={() => {
              onNavigate?.();
            }}
            className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[12px] font-bold text-primary hover:underline xl:min-h-0 xl:mt-3"
          >
            Open inbox <ArrowRight className="size-3.5 shrink-0" />
          </Link>
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="rounded-lg border border-ai/25 bg-ai/10 p-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-ai">
            <Bot className="size-4" />
            Ask Nucleus AI
          </div>
          {answer && (
            <div className="mt-2 min-w-0 border-t border-ai/20 pt-2">
              <p className="max-h-48 overflow-y-auto break-words text-[12px] leading-[18px] text-foreground">{answer}</p>
              {sources.length > 0 && (
                <div className="mt-2 border-t border-ai/15 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Answered from
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {sources.map((entry) => (
                      <li key={entry} className="truncate text-[11px] leading-4 text-muted-foreground" title={entry}>
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <form onSubmit={ask} className="relative mt-2.5">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask a policy question…"
              className="h-11 w-full min-w-0 rounded-lg border border-ai/30 bg-card pl-3 pr-12 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-ring xl:h-10 xl:pr-10"
            />
            <button
              type="submit"
              disabled={busy || !prompt.trim()}
              className="absolute right-1 top-1 grid size-9 shrink-0 place-items-center rounded-md bg-ai text-ai-foreground disabled:opacity-50 hover:bg-ai/90 xl:right-1.5 xl:top-1.5 xl:size-7"
              aria-label="Ask Nucleus AI"
            >
              <Sparkles className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
