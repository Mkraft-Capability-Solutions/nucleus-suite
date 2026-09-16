"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CalendarCheck2, ClipboardCheck, Gauge, Scale, UsersRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersona } from "../app-shell";
import { AvatarMark, StatusPill, Surface } from "../page-primitives";
import { useWorkspace } from "../workspace-provider";

/**
 * The administrative welcome hero.
 *
 * The employee hero answers "what do I do today". This one answers "what needs
 * me today, and is anything on fire" — so it carries the operating scope (which
 * tenant this administrator is acting inside, the thing they can get wrong), a
 * compact pulse of live figures, and the decision queue.
 *
 * It issues NO request of its own. Every figure is handed down from the
 * `/api/v1/home` payload the command centre has already fetched, and every
 * figure is cross-checked against that payload's own `unavailableSources`
 * before it is printed. That check is the point of the component: the home
 * route coerces an unavailable feed to a fallback (`headcount: 0`,
 * `present: 0`), so printing the number alone would turn "we could not read
 * attendance" into "nobody is at work" on an executive surface where a
 * fabricated figure can drive a real decision (DESIGN_SYSTEM.md section 9).
 * A feed that did not resolve reads "Unavailable" with the payload's own
 * reason; a feed that resolved to nothing reads "0".
 */

/* ------------------------------------------------------------------ */
/* Pure helpers — unit-tested in admin-welcome-hero.test.ts            */
/* ------------------------------------------------------------------ */

/**
 * A feed as `/api/v1/home` reports it in `data.unavailableSources`.
 *
 * The route emits `{ name, message }`. The command centre currently narrows
 * that to the name alone before it reaches this component, so both shapes are
 * accepted and a name-only entry falls back to {@link UNREPORTED_REASON}
 * rather than inventing a cause.
 */
export type HeroFeed = string | { name: string; message?: string };

export const UNREPORTED_REASON =
  "The home payload reported this feed as unavailable without carrying a reason.";

/** Feed names, exactly as `/api/v1/home` keys them. */
export const FEED = {
  workforce: "workforce",
  attendance: "attendance",
  leave: "leave",
  compliance: "compliance",
  anomalies: "anomalies",
} as const;

/** The feeds the decision queue (`data.attention`) is assembled from. */
export const QUEUE_FEEDS = [FEED.leave, FEED.anomalies, FEED.compliance] as const;

/** The server caps `data.attention` at this many items. */
export const QUEUE_CAP = 8;

export function greetingFor(hour: number): string {
  if (!Number.isFinite(hour)) return "Welcome back";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** The payload's reason this feed is unavailable, or `null` when it resolved. */
export function feedReason(feeds: HeroFeed[] | null | undefined, source: string): string | null {
  for (const feed of feeds ?? []) {
    if (typeof feed === "string") {
      if (feed === source) return UNREPORTED_REASON;
      continue;
    }
    if (feed && feed.name === source) {
      const message = typeof feed.message === "string" ? feed.message.trim() : "";
      return message === "" ? UNREPORTED_REASON : message;
    }
  }
  return null;
}

export type FigureState = "loading" | "value" | "empty" | "unavailable";

export type Figure = { state: FigureState; display: string; note: string };

/**
 * Resolves one pulse figure.
 *
 * The order matters: a feed that did not resolve is reported as unavailable
 * BEFORE its coerced numeric fallback is ever formatted, which is what keeps
 * "0 pending approvals" and "approvals unavailable" from collapsing into the
 * same tile.
 */
export function resolveFigure(input: {
  value: number | null;
  source: string;
  feeds: HeroFeed[] | null | undefined;
  /** What the figure means when it IS a number — printed under the value. */
  valueNote: string;
  /** Why the platform has produced no figure at all (a genuine null). */
  emptyNote?: string;
  loading?: boolean;
  error?: string;
  format?: (value: number) => string;
}): Figure {
  if (input.loading) return { state: "loading", display: "…", note: "Reading the live figure." };
  if (input.error) return { state: "unavailable", display: "Unavailable", note: input.error };

  const reason = feedReason(input.feeds, input.source);
  if (reason !== null) return { state: "unavailable", display: "Unavailable", note: reason };

  if (input.value === null || !Number.isFinite(input.value)) {
    return {
      state: "empty",
      display: "—",
      note: input.emptyNote ?? "The platform has not produced this figure yet.",
    };
  }

  const format = input.format ?? ((value: number) => value.toLocaleString("en-IN"));
  return { state: "value", display: format(input.value), note: input.valueNote };
}

/** `8+` at the server's cap, because the true total is not in the payload. */
export function queueCountLabel(count: number, cap: number = QUEUE_CAP): string {
  return count >= cap ? `${cap}+` : String(Math.max(0, count));
}

export type QueueState = {
  tone: "success" | "warning" | "danger" | "neutral";
  /** The state as a word, so colour is never the only carrier. */
  word: string;
  headline: string;
  note: string;
};

/**
 * The attention row.
 *
 * `data.attention` is assembled from three feeds, so if any of them did not
 * resolve the count is not a count — it is a floor, and it is reported as
 * incomplete rather than printed. No item is singled out as "most urgent":
 * the payload carries insertion order, not a severity ranking.
 */
export function resolveQueue(input: {
  count: number;
  feeds: HeroFeed[] | null | undefined;
  loading?: boolean;
  error?: string;
}): QueueState {
  if (input.loading) {
    return { tone: "neutral", word: "Loading", headline: "Reading the decision queue.", note: "" };
  }
  if (input.error) {
    return {
      tone: "warning",
      word: "Unavailable",
      headline: "The decision queue could not be read.",
      note: input.error,
    };
  }

  const missing = QUEUE_FEEDS.map((name) => ({ name, reason: feedReason(input.feeds, name) })).filter(
    (entry) => entry.reason !== null,
  );
  if (missing.length > 0) {
    return {
      tone: "warning",
      word: "Incomplete",
      headline: `The ${missing.map((entry) => entry.name).join(", ")} feed did not resolve, so this is not a complete count.`,
      note: missing[0].reason ?? UNREPORTED_REASON,
    };
  }

  if (input.count <= 0) {
    return {
      tone: "success",
      word: "All clear",
      headline: "Nothing is waiting on a decision from you.",
      note: "Leave requests, payroll anomalies and unfiled obligations appear here as they are raised.",
    };
  }

  const label = queueCountLabel(input.count);
  return {
    tone: "danger",
    word: "Needs a decision",
    headline: `${label} item${input.count === 1 ? "" : "s"} waiting on you across leave, payroll and compliance.`,
    note:
      input.count >= QUEUE_CAP
        ? `The payload lists at most ${QUEUE_CAP}, so the real total may be higher. Listed in payload order — it carries no severity ranking.`
        : "Listed in payload order — the payload carries no severity ranking, so none is claimed here.",
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * The slice of the command centre's already-fetched `/api/v1/home` data this
 * hero reads. Structural, so the caller passes its own object straight in.
 */
export type AdminHeroData = {
  tenantName: string;
  headcount: number;
  pendingLeave: number;
  readiness: number | null;
  attendance: { date: string; present: number; percentPresent: number | null };
  attention: Array<{ id: string; domain: string }>;
  refreshedAt: string;
  unavailableSources: HeroFeed[];
};

const QUICK_ACTIONS: Array<{ href: string; label: string; icon: LucideIcon; primary?: boolean }> = [
  // Each route is an entry in src/lib/navigation-catalog.ts with status "ready"
  // and a module of the same id in module-view.tsx.
  { href: "/approval-inbox", label: "Approvals inbox", icon: ClipboardCheck, primary: true },
  { href: "/payroll-run-cockpit", label: "Payroll run cockpit", icon: Gauge },
  { href: "/people", label: "People directory", icon: UsersRound },
];

const ACTION_BASE =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3.5 font-heading text-[13px] font-semibold transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none";

/**
 * The wall clock, as an external store.
 *
 * One interval, ticking once a minute and cleared when the last subscriber
 * unmounts. The snapshot is the minute — a stable value between ticks, so the
 * render is not re-entered on every frame — and the server snapshot is `null`,
 * which keeps the greeting out of the server-rendered markup rather than
 * hydrating a different hour than the one the browser is in.
 */
const MINUTE_MS = 60_000;

function subscribeToMinute(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, MINUTE_MS);
  return () => window.clearInterval(timer);
}

function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

function serverMinute(): number | null {
  return null;
}

function clockLabel(now: Date | null, timeZone: string | null): string {
  if (!now) return "";
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(undefined, timeZone ? { ...options, timeZone } : options).format(now);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(now);
  }
}

function stampLabel(iso: string): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

export function AdminWelcomeHero({
  data,
  loading = false,
  error = "",
}: {
  data: AdminHeroData | null;
  loading?: boolean;
  error?: string;
}) {
  const { persona } = usePersona();
  const { workspace } = useWorkspace();

  // Client-only, one tick a minute, subscription torn down on unmount. Nothing
  // animates anywhere in this hero, so prefers-reduced-motion has nothing to
  // suppress beyond the colour transitions, which opt out explicitly.
  const minute = useSyncExternalStore(subscribeToMinute, currentMinute, serverMinute);
  const now = minute === null ? null : new Date(minute * MINUTE_MS);

  const firstName = persona.name.trim().split(/\s+/)[0] || persona.name;
  const membership =
    workspace?.memberships.find((item) => item.tenantId === workspace.context?.tenantId) ?? null;
  const tenantName = membership?.tenantName ?? data?.tenantName ?? "Workspace";
  const tenantSlug = membership?.tenantSlug ?? null;
  const timeZone = workspace?.settings?.timezone ?? null;
  const feeds = data?.unavailableSources ?? [];
  const shared = { feeds, loading: loading || !data, error };

  const figures: Array<{ label: string; icon: LucideIcon; figure: Figure }> = [
    {
      label: "Present today",
      icon: CalendarCheck2,
      figure: resolveFigure({
        ...shared,
        source: FEED.attendance,
        value: data?.attendance.present ?? null,
        valueNote:
          data?.attendance.percentPresent === null || data?.attendance.percentPresent === undefined
            ? "No attendance percentage was produced for today."
            : `${data.attendance.percentPresent.toFixed(1)}% of the roll${data.attendance.date ? ` · ${data.attendance.date}` : ""}`,
      }),
    },
    {
      label: "On the roll",
      icon: UsersRound,
      figure: resolveFigure({
        ...shared,
        source: FEED.workforce,
        value: data?.headcount ?? null,
        valueNote: "Active employees in this tenant.",
      }),
    },
    {
      label: "Leave awaiting you",
      icon: ClipboardCheck,
      figure: resolveFigure({
        ...shared,
        source: FEED.leave,
        value: data?.pendingLeave ?? null,
        valueNote: "Requests with no decision recorded.",
      }),
    },
    {
      label: "Compliance filed",
      icon: Scale,
      figure: resolveFigure({
        ...shared,
        source: FEED.compliance,
        value: data?.readiness ?? null,
        format: (value) => `${value}%`,
        valueNote: "Of registered obligations marked filed.",
        emptyNote: "No obligation is registered, so there is no ratio to report.",
      }),
    },
  ];

  const queue = resolveQueue({
    count: data?.attention.length ?? 0,
    feeds,
    loading: loading || !data,
    error,
  });
  const stamp = stampLabel(data?.refreshedAt ?? "");

  return (
    <Surface className="mb-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        {/* Greeting, identity and the scope being operated in. */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarMark initials={persona.initials} color={persona.accent} size="lg" />
            <div className="min-w-0">
              <h2 className="min-w-0 font-heading text-xl font-semibold text-foreground sm:text-2xl">
                {now ? greetingFor(now.getHours()) : "Welcome back"}, {firstName}.
              </h2>
              <p className="mt-1 min-w-0 truncate text-[13px] text-muted-foreground">
                <span className="text-foreground">{persona.name}</span> · {persona.role}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-border p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Operating in
              </dt>
              <dd className="mt-1 min-w-0 truncate text-[13px] font-semibold text-foreground">{tenantName}</dd>
              {tenantSlug && (
                <dd className="mt-0.5 min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                  {tenantSlug}
                </dd>
              )}
            </div>
            <div className="min-w-0 rounded-lg border border-border p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Local time
              </dt>
              <dd className="mt-1 min-w-0 truncate font-mono text-[13px] font-semibold text-foreground tabular-nums">
                {clockLabel(now, timeZone) || "—"}
              </dd>
              <dd className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
                {timeZone ?? "Device time zone"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Today's operational pulse. */}
        <div className="min-w-0">
          <dl className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-4">
            {figures.map(({ label, icon: Icon, figure }) => (
              <div key={label} className="min-w-0 rounded-lg border border-border p-3">
                <dt className="flex min-w-0 items-center gap-1.5">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                  <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                </dt>
                <dd
                  className={cn(
                    "mt-2 min-w-0 break-words font-mono font-bold leading-7 tabular-nums",
                    figure.state === "value" ? "text-[22px] text-foreground" : "text-[15px] text-muted-foreground",
                  )}
                >
                  {figure.display}
                </dd>
                <dd className="mt-1 text-[11px] leading-4 text-muted-foreground">{figure.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Live from /api/v1/home{stamp ? ` · read at ${stamp}` : ""}. A feed that did not resolve reads
            “Unavailable” rather than zero.
          </p>
        </div>
      </div>

      {/* What needs attention, stated in words as well as tone. */}
      <div
        role="status"
        className="mt-5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-secondary/50 p-3"
      >
        <StatusPill tone={queue.tone} dot>
          {queue.word}
        </StatusPill>
        <p className="min-w-0 flex-1 basis-64 text-[13px] leading-5 text-foreground">
          {queue.headline}
          {queue.note && <span className="text-muted-foreground"> {queue.note}</span>}
        </p>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              ACTION_BASE,
              action.primary
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-background text-foreground hover:bg-muted focus-visible:border-ring",
            )}
          >
            <action.icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {action.label}
          </Link>
        ))}
      </div>
    </Surface>
  );
}
