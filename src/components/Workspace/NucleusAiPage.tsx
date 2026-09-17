"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Mic,
  MicOff,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useNucleusSession } from "@/context/NucleusSessionProvider";
import { NucleusOrb } from "./NucleusOrb";

/**
 * Nucleus AI — the spoken workspace assistant, full cockpit view.
 * Ported from helper/src/components/hrms/nucleus-ai-page.tsx
 *
 * Three things are on screen at once on purpose:
 * 1. The transcript shows what was said.
 * 2. The trace shows which tool produced each figure, so numbers are traceable.
 * 3. A drafted action appears as a card with every field visible and a confirm button.
 *
 * The session itself lives in NucleusSessionProvider, above the router,
 * so it survives module navigation.
 */

type SourceLike = { value: unknown; available: boolean; message?: string; origin?: string };

function isSourceLike(value: unknown): value is SourceLike {
  return typeof value === "object" && value !== null && "available" in value && "value" in value;
}

function humanKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
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
  const stylesByTone: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: "var(--status-ok-wash, rgba(16, 185, 129, 0.1))", border: "rgba(16, 185, 129, 0.3)", color: "var(--status-ok, #10b981)" },
    warning: { bg: "var(--pending-wash, rgba(245, 158, 11, 0.1))", border: "rgba(245, 158, 11, 0.3)", color: "var(--pending, #f59e0b)" },
    danger: { bg: "var(--flag-wash, rgba(239, 68, 68, 0.1))", border: "rgba(239, 68, 68, 0.3)", color: "var(--flag, #ef4444)" },
    info: { bg: "var(--info-wash, rgba(59, 130, 246, 0.1))", border: "rgba(59, 130, 246, 0.3)", color: "var(--info, #3b82f6)" },
    violet: { bg: "var(--signal-wash, rgba(147, 51, 234, 0.1))", border: "rgba(147, 51, 234, 0.3)", color: "var(--signal, #9333ea)" },
    neutral: { bg: "var(--card-2, rgba(0, 0, 0, 0.05))", border: "var(--line, rgba(0, 0, 0, 0.1))", color: "var(--text-2, #5A6B78)" },
  };
  const currentStyle = stylesByTone[tone] || stylesByTone.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        borderRadius: "6px",
        border: `1px solid ${currentStyle.border}`,
        background: currentStyle.bg,
        color: currentStyle.color,
        padding: "3px 8px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "currentColor",
          }}
        />
      )}
      <span>{children}</span>
    </span>
  );
}

export function Surface({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--card, #ffffff)",
        border: "1px solid var(--line, rgba(0, 0, 0, 0.1))",
        borderRadius: "var(--r-card, 12px)",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Renders a figure with its provenance, or the reason the platform has no figure. */
function FigureCard({ label, entry }: { label: string; entry: SourceLike }) {
  const scalar = typeof entry.value === "number" || typeof entry.value === "string";
  if (!entry.available || entry.value === null) {
    return (
      <div
        style={{
          borderRadius: "8px",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          background: "var(--pending-wash, rgba(245, 158, 11, 0.05))",
          padding: "12px",
        }}
      >
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3, #888)" }}>
          {label}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", fontWeight: 600, color: "var(--pending, #f59e0b)" }}>
          Not recorded
        </p>
        {entry.message && (
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
            {entry.message}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        borderRadius: "8px",
        border: "1px solid var(--line, rgba(0, 0, 0, 0.1))",
        background: "var(--card-2, rgba(0, 0, 0, 0.02))",
        padding: "12px",
      }}
    >
      <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3, #888)" }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: 700, color: "var(--text, #10222F)" }}>
        {scalar ? String(entry.value) : Array.isArray(entry.value) ? `${entry.value.length} row(s)` : "Recorded"}
      </p>
      {entry.origin && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
          {entry.origin}
        </p>
      )}
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        height: "calc(100vh - 100px)",
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "16px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "var(--signal-wash, rgba(147, 51, 234, 0.1))",
              border: "1px solid rgba(147, 51, 234, 0.3)",
              display: "grid",
              placeItems: "center",
              color: "var(--signal, #9333ea)",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text, #10222F)" }}>
              Nucleus AI
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-2, #5A6B78)" }}>
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

      {/* Main Grid: Transcript / Draft vs Sidebar Trace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Column: Transcript & Interaction */}
        <Surface
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: 0,
          }}
        >
          {notice && (
            <p
              role="status"
              style={{
                margin: 0,
                flexShrink: 0,
                borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
                background: "var(--pending-wash, rgba(245, 158, 11, 0.08))",
                padding: "10px 16px",
                fontSize: "12px",
                color: "var(--pending, #f59e0b)",
              }}
            >
              {notice}
            </p>
          )}

          {session && !session.transcriptRecorded && (
            <p
              style={{
                margin: 0,
                flexShrink: 0,
                borderBottom: "1px solid var(--line, rgba(0, 0, 0, 0.08))",
                padding: "8px 16px",
                fontSize: "11px",
                color: "var(--text-3, #888)",
              }}
            >
              This conversation is not being written to an AI run, because your role cannot open one. Nothing said here will be kept.
            </p>
          )}

          {/* Transcript scroller */}
          <div
            ref={scroller}
            onScroll={onScroll}
            aria-live="polite"
            aria-label="Conversation transcript"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {turns.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", padding: "32px 16px" }}>
                <Mic style={{ margin: "0 auto 12px", color: "var(--text-3, #888)", width: "32px", height: "32px" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text, #10222F)" }}>
                  {listening ? "Go ahead, ask." : "Tap the sphere to talk"}
                </h3>
                <p style={{ margin: "6px auto 0", maxWidth: "380px", fontSize: "13px", color: "var(--text-2, #5A6B78)" }}>
                  {listening
                    ? "Try: give me the six month workforce analysis, or apply leave for me next week."
                    : "Nucleus AI reads only what your role may read, and writes nothing until you confirm it."}
                </p>
              </div>
            )}

            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: turn.role === "user" ? "flex-end" : "flex-start",
                  textAlign: turn.role === "user" ? "right" : "left",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-3, #888)",
                  }}
                >
                  {turn.role === "user" ? "You" : "Nucleus"}
                </span>
                <p
                  style={{
                    margin: "4px 0 0",
                    maxWidth: "64ch",
                    whiteSpace: "pre-wrap",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    fontWeight: turn.role === "user" ? 600 : 400,
                    color: "var(--text, #10222F)",
                    background: turn.role === "user" ? "var(--signal-wash, rgba(147, 51, 234, 0.08))" : "var(--card-2, rgba(0, 0, 0, 0.03))",
                    padding: "8px 14px",
                    borderRadius: "10px",
                  }}
                >
                  {turn.text}
                </p>
              </div>
            ))}
          </div>

          {/* Action Draft Card */}
          {draft && (
            <div
              style={{
                flexShrink: 0,
                borderTop: "1px solid rgba(147, 51, 234, 0.3)",
                background: "var(--signal-wash, rgba(147, 51, 234, 0.06))",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text, #10222F)" }}>
                    Confirm before this is written
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-2, #5A6B78)" }}>
                    {draft.action.summary}
                  </p>
                </div>
                <StatusPill tone="violet">Draft</StatusPill>
              </div>

              <dl style={{ margin: "12px 0 0", display: "grid", gap: "6px", maxHeight: "24vh", overflowY: "auto" }}>
                {draft.fields.map((field) => (
                  <div
                    key={field.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      borderBottom: "1px solid var(--line, rgba(0, 0, 0, 0.08))",
                      paddingBottom: "4px",
                    }}
                  >
                    <dt style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3, #888)" }}>
                      {field.label}
                      {field.origin === "default" && (
                        <span style={{ marginLeft: "6px", fontWeight: 400, textTransform: "none" }}>
                          (not supplied — form default)
                        </span>
                      )}
                    </dt>
                    <dd style={{ margin: 0, fontFamily: "monospace", fontSize: "12px", fontWeight: 600, color: "var(--text, #10222F)" }}>
                      {typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => void confirmDraft()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "var(--status-ok, #10b981)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "12px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Check size={16} /> Confirm and submit
                </button>
                <button
                  type="button"
                  onClick={cancelDraft}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "var(--card-2, rgba(0, 0, 0, 0.05))",
                    color: "var(--text, #10222F)",
                    border: "1px solid var(--line, rgba(0, 0, 0, 0.1))",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} /> Cancel
                </button>
                {listening && (
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
                    Or say <span style={{ fontWeight: 700, color: "var(--text, #10222F)" }}>“confirm”</span> — on its own, so it cannot be mistaken for part of a sentence.
                  </p>
                )}
              </div>
            </div>
          )}

          {draftResult && (
            <p
              role="status"
              style={{
                margin: 0,
                flexShrink: 0,
                borderTop: "1px solid var(--line, rgba(0, 0, 0, 0.08))",
                background: "var(--card-2, rgba(0, 0, 0, 0.03))",
                padding: "10px 16px",
                fontSize: "12px",
                color: "var(--text, #10222F)",
              }}
            >
              {draftResult}
            </p>
          )}

          {/* Bottom input bar & voice sphere */}
          <div
            style={{
              flexShrink: 0,
              borderTop: "1px solid var(--line, rgba(0, 0, 0, 0.08))",
              padding: "14px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                type="button"
                onClick={() => void (listening ? disconnect() : connect())}
                disabled={status === "connecting"}
                aria-label={listening ? "End voice session" : "Start voice session"}
                style={{
                  position: "relative",
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <NucleusOrb
                  getLevels={getLevels}
                  active={listening}
                  size={56}
                  label={listening ? "Nucleus AI is listening" : "Nucleus AI is idle"}
                />
              </button>

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
                  {status === "connecting"
                    ? "Opening a session…"
                    : listening
                    ? "Listening. Speak, or type below."
                    : "Tap the sphere to start talking."}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
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
                    style={{
                      flex: 1,
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid var(--line, rgba(0, 0, 0, 0.1))",
                      background: "var(--card-2, rgba(0, 0, 0, 0.03))",
                      padding: "0 14px",
                      fontSize: "12px",
                      color: "var(--text, #10222F)",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Send typed message"
                    onClick={sendTyped}
                    disabled={!listening || !typed.trim()}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      border: "none",
                      background: "var(--signal, #9333ea)",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      opacity: !listening || !typed.trim() ? 0.5 : 1,
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        {/* Right Column: Opened Screens, Latest Analysis, Tool Trace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", minHeight: 0 }}>
          {screens.length > 0 && (
            <Surface>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text, #10222F)" }}>
                Screens the assistant opened
              </p>
              <p style={{ margin: "2px 0 10px", fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
                Opening one navigates the workspace behind this conversation. The session stays live, so you can keep talking.
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "8px" }}>
                {screens.map((screen) => (
                  <li key={screen.moduleId}>
                    <Link
                      href={screen.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(147, 51, 234, 0.3)",
                        background: "var(--signal-wash, rgba(147, 51, 234, 0.05))",
                        textDecoration: "none",
                        color: "var(--text, #10222F)",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{screen.label}</span>
                      <ArrowUpRight size={14} style={{ color: "var(--signal, #9333ea)", flexShrink: 0 }} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          <Surface>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text, #10222F)" }}>
              Latest analysis
            </p>
            {!analysis && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-2, #5A6B78)" }}>
                Figures appear here as they are read, each labelled with the record it came from.
              </p>
            )}
            {analysis && (
              <>
                <p style={{ margin: "4px 0 8px", fontFamily: "monospace", fontSize: "11px", color: "var(--text-3, #888)" }}>
                  {analysis.tool}
                </p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {figures.map(([key, value]) => (
                    <FigureCard key={key} label={humanKey(key)} entry={value as SourceLike} />
                  ))}
                </div>
              </>
            )}
          </Surface>

          <Surface>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text, #10222F)" }}>
              Tool trace
            </p>
            <p style={{ margin: "2px 0 10px", fontSize: "11px", color: "var(--text-2, #5A6B78)" }}>
              Every tool the assistant called, in order. A figure with no entry here was not measured.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "6px" }}>
              {trace.length === 0 && (
                <li style={{ fontSize: "12px", color: "var(--text-3, #888)" }}>Nothing called yet.</li>
              )}
              {trace.map((entry) => (
                <li
                  key={`${entry.tool}-${entry.at}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line, rgba(0, 0, 0, 0.08))",
                    background: "var(--card-2, rgba(0, 0, 0, 0.02))",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.tool}
                  </span>
                  <StatusPill tone={entry.outcome === "error" ? "danger" : entry.outcome === "draft" ? "violet" : entry.outcome === "needs_more_info" ? "warning" : "success"}>
                    {entry.outcome === "needs_more_info" ? "asked" : entry.outcome}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface style={{ border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertTriangle size={16} style={{ color: "var(--pending, #f59e0b)", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ margin: 0, fontSize: "11px", lineHeight: "1.4", color: "var(--text-2, #5A6B78)" }}>
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
