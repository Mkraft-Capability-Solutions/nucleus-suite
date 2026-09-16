"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, Mic, MicOff, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNucleusSession } from "./nucleus-session-provider";
import { NucleusOrb } from "./nucleus-orb";
import { StateBlock, StatusPill, Surface } from "./page-primitives";

/**
 * Nucleus AI — the spoken workspace assistant, full view.
 *
 * Three things are on screen at once on purpose. The transcript shows what was
 * said, so a voice answer is not the only record of itself. The trace shows
 * which tool produced each figure, so a number can be traced to a feed rather
 * than taken on the assistant's word. And a drafted action appears as a card
 * with every field visible and a confirm button, because a spoken instruction
 * is the easiest thing in the product to mishear, and the person — not the
 * model — decides when something is written.
 *
 * The session itself lives in `nucleus-session-provider.tsx`, above the router,
 * so it survives the navigation `open_screen` performs. This file is one view of
 * it; `nucleus-dock.tsx` is the other, and both read the same conversation.
 *
 * The surface is sized to the viewport rather than to its content. A voice
 * conversation has no natural end, so a page that grows with the transcript
 * walks the composer and the sphere off the bottom of the screen and makes the
 * person scroll to reach the controls they are actively using. Here the shell
 * never scrolls: only the transcript does, and it stays pinned to the newest
 * turn unless the person has deliberately scrolled up to read something.
 */

type SourceLike = { value: unknown; available: boolean; message?: string; origin?: string };

function isSourceLike(value: unknown): value is SourceLike {
  return typeof value === "object" && value !== null && "available" in value && "value" in value;
}

function humanKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

/** Renders a figure with its provenance, or the reason the platform has no figure. */
function FigureCard({ label, entry }: { label: string; entry: SourceLike }) {
  const scalar = typeof entry.value === "number" || typeof entry.value === "string";
  if (!entry.available || entry.value === null) {
    return (
      <div className="rounded-lg border border-warning/25 bg-warning/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-warning">Not recorded</p>
        {entry.message && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{entry.message}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border/80 bg-secondary/25 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-foreground">
        {scalar ? String(entry.value) : Array.isArray(entry.value) ? `${entry.value.length} row(s)` : "Recorded"}
      </p>
      {entry.origin && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{entry.origin}</p>}
    </div>
  );
}

export function NucleusAiPage() {
  const {
    status,
    listening,
    notice,
    turns,
    trace,
    draft,
    draftResult,
    analysis,
    screens,
    session,
    connect,
    disconnect,
    sendText,
    confirmDraft,
    cancelDraft,
    getLevels,
  } = useNucleusSession();

  const [typed, setTyped] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  // Follow the newest turn, but stop following the moment the person scrolls up
  // to re-read something — yanking them back to the bottom mid-sentence is the
  // other half of what makes a growing transcript unusable.
  useEffect(() => {
    const element = scroller.current;
    if (!element || !stickToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [turns, draft]);

  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottom.current = distanceFromBottom < 48;
  }, []);

  const sendTyped = useCallback(() => {
    if (!typed.trim()) return;
    stickToBottom.current = true;
    sendText(typed);
    setTyped("");
  }, [sendText, typed]);

  const figures = useMemo(
    () => (analysis ? Object.entries(analysis.result).filter(([, value]) => isSourceLike(value)) : []),
    [analysis],
  );

  return (
    <div className="mx-auto flex h-[calc(100svh-6rem)] w-full min-w-0 max-w-[1400px] flex-col gap-4 sm:h-[calc(100svh-6.5rem)] lg:h-[calc(100svh-7rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-ai/20 bg-ai/10 text-ai">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-base font-bold text-foreground">Nucleus AI</h1>
            <p className="truncate text-xs text-muted-foreground">
              {session
                ? `${session.model} · ${session.actions.length} action(s) available to you`
                : "Ask for an analysis and hear it back with its source. Nothing is written until you confirm it."}
            </p>
          </div>
        </div>
        <StatusPill tone={listening ? "success" : status === "error" ? "danger" : "neutral"} dot>
          {listening ? "Listening" : status === "connecting" ? "Connecting" : status === "error" ? "Error" : "Idle"}
        </StatusPill>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <Surface className="flex min-h-0 flex-col overflow-hidden p-0">
          {notice && (
            <p role="status" className="shrink-0 border-b border-warning/25 bg-warning/5 px-5 py-2.5 text-xs leading-relaxed text-warning">
              {notice}
            </p>
          )}
          {session && !session.transcriptRecorded && (
            <p className="shrink-0 border-b border-border/60 px-5 py-2 text-[11px] leading-relaxed text-muted-foreground">
              This conversation is not being written to an AI run, because your role cannot open one. Nothing said here will be kept.
            </p>
          )}

          <div
            ref={scroller}
            onScroll={onScroll}
            aria-live="polite"
            aria-label="Conversation transcript"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6"
          >
            {turns.length === 0 && (
              <StateBlock
                tone="empty"
                icon={Mic}
                title={listening ? "Go ahead, ask." : "Tap the sphere to talk"}
                description={
                  listening
                    ? "Try: give me the six month workforce analysis, or apply leave for me next week."
                    : "Nucleus AI reads only what your role may read, and writes nothing until you confirm it."
                }
              />
            )}
            {/*
              Plain text, not bubbles. A spoken transcript is a record of who said
              what, and the alignment already carries that — wrapping every line in
              a coloured capsule turns a readable column into a chat log and wastes
              the width the longer analytical answers actually need.
            */}
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={turn.role === "user" ? "flex flex-col items-end text-right" : "flex flex-col items-start text-left"}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {turn.role === "user" ? "You" : "Nucleus"}
                </span>
                <p
                  className={`mt-1 max-w-[62ch] whitespace-pre-wrap text-pretty text-sm leading-relaxed ${
                    turn.role === "user" ? "font-medium text-foreground" : "text-foreground/90"
                  }`}
                >
                  {turn.text}
                </p>
              </div>
            ))}
          </div>

          {draft && (
            <div className="shrink-0 border-t border-ai/25 bg-ai/5 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground">Confirm before this is written</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{draft.action.summary}</p>
                </div>
                <StatusPill tone="violet">Draft</StatusPill>
              </div>
              <dl className="mt-3 grid max-h-[26vh] gap-1.5 overflow-y-auto">
                {draft.fields.map((field) => (
                  <div key={field.name} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1.5 last:border-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.label}
                      {field.origin === "default" && <span className="ml-1.5 font-normal normal-case">(not supplied — form default)</span>}
                    </dt>
                    <dd className="min-w-0 truncate text-right font-mono text-xs text-foreground">
                      {typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void confirmDraft()} className="gap-1.5">
                  <Check className="size-4" /> Confirm and submit
                </Button>
                <Button type="button" variant="outline" onClick={cancelDraft} className="gap-1.5">
                  <X className="size-4" /> Cancel
                </Button>
                {listening && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Or say <span className="font-semibold text-foreground">“confirm”</span> — on its own, so it cannot be mistaken for part of a sentence.
                  </p>
                )}
              </div>
            </div>
          )}

          {draftResult && (
            <p role="status" className="shrink-0 border-t border-border/80 bg-secondary/30 px-5 py-2.5 text-xs text-foreground">
              {draftResult}
            </p>
          )}

          <div className="shrink-0 border-t border-border/80 px-5 py-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void (listening ? disconnect() : connect())}
                disabled={status === "connecting"}
                aria-label={listening ? "End voice session" : "Start voice session"}
                className="group relative grid shrink-0 place-items-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ai focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 enabled:hover:scale-[1.03] enabled:active:scale-95"
              >
                <NucleusOrb
                  getLevels={getLevels}
                  active={listening}
                  label={listening ? "Nucleus AI is listening" : "Nucleus AI is idle"}
                />
                <span className="pointer-events-none absolute grid size-9 place-items-center rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </span>
              </button>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {status === "connecting"
                    ? "Opening a session…"
                    : listening
                      ? "Listening. Speak, or type below."
                      : "Tap the sphere to start talking."}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Message Nucleus AI by typing"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        sendTyped();
                      }
                    }}
                    placeholder={listening ? "Or type instead of speaking…" : "Start a session to type or speak"}
                    disabled={!listening}
                    className="h-11 rounded-xl border-border bg-secondary/30 px-4 text-xs"
                  />
                  <Button
                    type="button"
                    aria-label="Send typed message"
                    onClick={sendTyped}
                    disabled={!listening || !typed.trim()}
                    className="size-11 shrink-0 rounded-xl"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <div className="min-h-0 space-y-4 overflow-y-auto lg:pr-0.5">
          {screens.length > 0 && (
            <Surface className="p-4">
              <p className="font-bold text-sm text-foreground">Screens the assistant opened</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Opening one navigates the workspace behind this conversation. The session stays live, so you can keep talking.
              </p>
              <ul className="mt-3 space-y-2">
                {screens.map((screen) => (
                  <li key={screen.moduleId}>
                    <Link
                      href={screen.href}
                      className="group flex items-center gap-3 rounded-lg border border-ai/25 bg-ai/5 p-3 transition-colors hover:border-ai/45 hover:bg-ai/10"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{screen.label}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-ai transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          <Surface className="p-4">
            <p className="font-bold text-sm text-foreground">Latest analysis</p>
            {!analysis && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Figures appear here as they are read, each labelled with the record it came from.
              </p>
            )}
            {analysis && (
              <>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{analysis.tool}</p>
                <div className="mt-3 grid gap-2">
                  {figures.map(([key, value]) => (
                    <FigureCard key={key} label={humanKey(key)} entry={value as SourceLike} />
                  ))}
                </div>
              </>
            )}
          </Surface>

          <Surface className="p-4">
            <p className="font-bold text-sm text-foreground">Tool trace</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Every tool the assistant called, in order. A figure with no entry here was not measured.
            </p>
            <ul className="mt-3 space-y-1.5">
              {trace.length === 0 && <li className="text-xs text-muted-foreground">Nothing called yet.</li>}
              {trace.map((entry) => (
                <li key={`${entry.tool}-${entry.at}`} className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-card px-2 py-1.5">
                  <span className="min-w-0 truncate font-mono text-[11px] text-foreground">{entry.tool}</span>
                  <StatusPill tone={entry.outcome === "error" ? "danger" : entry.outcome === "draft" ? "violet" : entry.outcome === "needs_more_info" ? "warning" : "success"}>
                    {entry.outcome === "needs_more_info" ? "asked" : entry.outcome}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="border-warning/20 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Nucleus AI reads only what your role may read and writes nothing on its own. A drafted action is submitted by you,
                through the same checks and audit trail as the form it stands in for.
              </p>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
