"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import CountUp from "@/components/CountUp";
import SpotlightCard from "@/components/SpotlightCard";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-end">
      <div className="min-w-0 max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-4 w-0.5 rounded-full bg-primary" />
          <p className="text-[11px] font-bold text-muted-foreground">
            {eyebrow}
          </p>
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-[28px] sm:leading-9">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-[21px] text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-[15px] font-semibold text-foreground sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-[21px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nucleus-panel min-w-0 rounded-lg p-5 text-card-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  prefix,
  delta,
  deltaDirection = "up",
  icon: Icon,
  tint,
  decimals,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  delta: string;
  deltaDirection?: "up" | "down";
  icon: LucideIcon;
  tint?: string;
  decimals?: number;
}) {
  const displayValue = decimals ? Number(value.toFixed(decimals)) : value;
  const positive = deltaDirection === "up";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
      <SpotlightCard
        className="nucleus-panel rounded-lg p-4"
        spotlightColor={tint || "color-mix(in srgb, var(--primary) 8%, transparent)"}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
              <Icon className="size-4 text-primary" strokeWidth={2} />
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold",
                positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {delta}
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-1">
            {prefix && (
              <span className="text-lg font-bold text-foreground tabular-nums">
                {prefix}
              </span>
            )}
            <CountUp
              to={displayValue}
              from={0}
              duration={1.2}
              separator=","
              className="text-[28px] font-bold leading-[34px] text-foreground tabular-nums"
            />
            {suffix && (
              <span className="text-sm font-bold text-muted-foreground tabular-nums">
                {suffix}
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {label}
          </p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "violet" | "neutral";
  dot?: boolean;
}) {
  const tones = {
    success:
      "border-success/25 bg-success/10 text-success",
    warning:
      "border-warning/25 bg-warning/10 text-warning",
    danger:
      "border-destructive/25 bg-destructive/10 text-destructive",
    info:
      "border-info/25 bg-info/10 text-info",
    violet:
      "border-ai/25 bg-ai/10 text-ai",
    neutral: "bg-secondary text-secondary-foreground border-border",
  };

  return (
    <span
      className={cn(
        // `max-w-full` + `min-w-0` keep the pill inside its grid/flex track. Without
        // them a long status (e.g. "pending_hod") overflows a narrow column and
        // paints over the neighbouring cell.
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone]
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function AvatarMark({
  initials,
  color,
  size = "md",
}: {
  initials: string;
  /** Any CSS colour — prefer a theme token such as `var(--chart-1)`. It is mixed
   *  down to a faint wash so `text-foreground` stays legible in both themes. */
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-mono font-bold text-foreground ring-1 ring-border/50",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-xs",
        size === "lg" && "size-14 rounded-2xl text-base"
      )}
      style={{ background: color ? `color-mix(in srgb, ${color} 15%, transparent)` : undefined }}
    >
      {initials}
    </span>
  );
}

export function AiLabel({
  children = "Nucleus AI intelligence",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-ai/30 bg-ai/10 px-2.5 py-1 text-[11px] font-bold text-ai",
        className
      )}
    >
      <Sparkles className="size-3.5" />
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const tones = {
    primary: "border-primary/15 bg-primary/8 text-primary",
    success: "border-success/25 bg-success/10 text-success",
    warning: "border-warning/25 bg-warning/10 text-warning",
    danger: "border-destructive/25 bg-destructive/10 text-destructive",
    info: "border-info/25 bg-info/10 text-info",
    neutral: "border-border bg-secondary text-muted-foreground",
  };

  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", tones[tone])}>
            <Icon className="size-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-[26px] font-bold leading-8 text-foreground tabular-nums">
        {value}
      </p>
      {hint && <div className="mt-1.5 text-[12px] text-muted-foreground">{hint}</div>}
    </Surface>
  );
}

export function ProgressMeter({
  value,
  max = 100,
  label,
  tone = "primary",
}: {
  value: number;
  max?: number;
  label?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const tones = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
  };

  return (
    <div>
      {label && <div className="mb-1.5 text-[12px] text-muted-foreground">{label}</div>}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])}
          style={{ width: percent + "%" }}
        />
      </div>
    </div>
  );
}

export type TabDefinition = {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: React.ReactNode;
};

export function TabStrip({
  tabs,
  active,
  onSelect,
  ariaLabel,
}: {
  tabs: TabDefinition[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;
    const last = tabs.length - 1;
    let next = index;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onSelect(tabs[next].id);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={"tab-" + tab.id}
            aria-selected={selected}
            aria-controls={"panel-" + tab.id}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3.5 text-sm font-semibold transition-colors duration-150",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {tab.icon && <tab.icon className="size-4" strokeWidth={2} />}
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: React.ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div
      role="tabpanel"
      id={"panel-" + id}
      aria-labelledby={"tab-" + id}
      tabIndex={0}
      className="outline-none"
    >
      {children}
    </div>
  );
}

export function StateBlock({
  tone = "empty",
  icon: Icon,
  title,
  description,
  action,
}: {
  tone?: "empty" | "loading" | "error";
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="p-8 text-center"
      role={tone === "error" ? "alert" : tone === "loading" ? "status" : undefined}
    >
      {Icon && (
        <Icon
          className={cn(
            "mx-auto size-8",
            tone === "error" ? "text-destructive" : "text-muted-foreground"
          )}
          strokeWidth={1.75}
        />
      )}
      <h3 className={cn("mt-3 font-heading font-semibold", tone === "error" && "text-destructive")}>
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-[21px] text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export type Column<Row> = {
  key: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  minWidth = 640,
  onRowClick,
  selectedKey,
  empty,
  caption,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  minWidth?: number;
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  empty?: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "px-3 py-3 font-medium first:pl-5 last:pr-5",
                  column.align === "right" && "text-right"
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={onRowClick ? selected : undefined}
                className={cn(
                  "border-t border-border",
                  onRowClick && "cursor-pointer transition-colors duration-150 hover:bg-secondary/60",
                  selected && "bg-secondary"
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-3 first:pl-5 last:pr-5",
                      column.align === "right" && "text-right"
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
