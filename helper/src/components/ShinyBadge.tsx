"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ShinyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: "brand" | "cyan" | "amber" | "rose" | "neutral";
  dot?: boolean;
}

export function ShinyBadge({
  children,
  className,
  variant = "brand",
  dot = false,
  ...props
}: ShinyBadgeProps) {
  // Each fill is a /10 wash rather than a solid, so the paired `text-*` token
  // (not `*-foreground`) is the legible ink on it in both themes.
  const variantStyles = {
    brand: "border-primary/25 bg-primary/10 text-primary",
    cyan: "border-info/25 bg-info/10 text-info",
    amber: "border-warning/25 bg-warning/10 text-warning",
    rose: "border-destructive/25 bg-destructive/10 text-destructive",
    neutral: "border-border bg-secondary text-secondary-foreground",
  };

  const dotColors = {
    brand: "bg-primary",
    cyan: "bg-info",
    amber: "bg-warning",
    rose: "bg-destructive",
    neutral: "bg-foreground/60",
  };

  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-md transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {/* Animated Sheen Overlay — theme-paired stops, so the sweep reads as a
          light shine on the light theme and a signal glow on the dark one. */}
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.8s_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--card-raised) 50%, transparent) 35%, var(--line-glow) 47%, color-mix(in srgb, var(--signal) 22%, transparent) 50%, var(--line-glow) 53%, color-mix(in srgb, var(--card-raised) 50%, transparent) 65%, transparent 100%)",
        }}
      />
      {dot && (
        <span className="relative flex size-2">
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", dotColors[variant])} />
          <span className={cn("relative inline-flex size-2 rounded-full", dotColors[variant])} />
        </span>
      )}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
