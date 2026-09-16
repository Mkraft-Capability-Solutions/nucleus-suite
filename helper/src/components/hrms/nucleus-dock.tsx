"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Maximize2, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNucleusSession } from "./nucleus-session-provider";
import { NucleusOrb } from "./nucleus-orb";
import { StatusPill } from "./page-primitives";

/**
 * The live session, wherever you are standing.
 *
 * `open_screen` genuinely navigates now, which means the conversation carries on
 * while the page underneath changes. Without something persistent the session
 * would be live and invisible: the microphone open, the assistant mid-answer,
 * and no sign of it anywhere on screen. This is that sign.
 *
 * It is deliberately NOT a second assistant. It renders the same session the
 * full page renders — last exchange, the sphere, and any draft awaiting
 * confirmation — and links back to the page for the transcript, the trace and
 * the figures. A draft is shown here in full, because a write must never be
 * confirmable on a surface that does not show what is being written.
 *
 * Nothing renders while the session is idle, so this costs a closed component on
 * every page until someone actually starts talking.
 */
export function NucleusDock() {
  const { status, listening, turns, draft, draftResult, confirmDraft, cancelDraft, disconnect, getLevels } = useNucleusSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const previousDraft = useRef<string | null>(null);

  // A draft that arrives while the dock is collapsed must open it. Confirming a
  // write is the one thing that may not happen out of sight.
  useEffect(() => {
    const key = draft ? draft.action.name : null;
    if (key && key !== previousDraft.current) setCollapsed(false);
    previousDraft.current = key;
  }, [draft]);

  // The full page already shows all of this, so the dock stays out of its way.
  const onNucleusPage = pathname === "/nucleus-ai";
  if (onNucleusPage || (status !== "live" && status !== "connecting")) return null;

  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const lastUser = [...turns].reverse().find((turn) => turn.role === "user");

  return (
    <aside
      aria-label="Nucleus AI session"
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ai/30 bg-card/95 shadow-[var(--shadow-overlay)] backdrop-blur-lg"
    >
      <div className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
        <NucleusOrb
          getLevels={getLevels}
          active={listening}
          size={44}
          label={listening ? "Nucleus AI is listening" : "Nucleus AI is connecting"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-foreground">Nucleus AI</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {status === "connecting" ? "Opening a session…" : draft ? "Waiting on your confirmation" : "Listening"}
          </p>
        </div>
        <StatusPill tone={draft ? "violet" : listening ? "success" : "neutral"} dot>
          {draft ? "Draft" : listening ? "Live" : "…"}
        </StatusPill>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand Nucleus AI" : "Collapse Nucleus AI"}
          aria-expanded={!collapsed}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronDown className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div aria-live="polite" className="max-h-52 space-y-3 overflow-y-auto px-3 py-3">
            {lastUser && (
              <div className="flex flex-col items-end text-right">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">You</span>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-foreground">{lastUser.text}</p>
              </div>
            )}
            {lastAssistant && (
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nucleus</span>
                <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/90">{lastAssistant.text}</p>
              </div>
            )}
            {!lastUser && !lastAssistant && (
              <p className="py-2 text-center text-[11px] text-muted-foreground">Listening. Say what you need.</p>
            )}
          </div>

          {draft && (
            <div className="border-t border-ai/25 bg-ai/5 px-3 py-3">
              <p className="text-[12px] font-bold text-foreground">Confirm before this is written</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{draft.action.summary}</p>
              <dl className="mt-2 grid max-h-36 gap-1 overflow-y-auto">
                {draft.fields.map((field) => (
                  <div key={field.name} className="flex items-baseline justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.label}
                      {field.origin === "default" && <span className="ml-1 font-normal normal-case">(not supplied — form default)</span>}
                    </dt>
                    <dd className="min-w-0 truncate text-right font-mono text-[11px] text-foreground">
                      {typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={() => void confirmDraft()} className="gap-1.5">
                  <Check className="size-3.5" /> Confirm
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={cancelDraft} className="gap-1.5">
                  <X className="size-3.5" /> Cancel
                </Button>
              </div>
            </div>
          )}

          {draftResult && (
            <p role="status" className="border-t border-border/70 bg-secondary/30 px-3 py-2 text-[11px] text-foreground">
              {draftResult}
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-border/70 px-3 py-2">
            <Link
              href="/nucleus-ai"
              className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] font-bold text-ai hover:underline"
            >
              <Maximize2 className="size-3.5 shrink-0" /> Open the full conversation
            </Link>
            <button
              type="button"
              onClick={() => void disconnect()}
              aria-label="End voice session"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MicOff className="size-3.5" /> End
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
