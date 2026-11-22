"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, CornerDownRight, GripVertical, Mic, PanelRight, PictureInPicture2, Plus, SquarePen, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNucleusSession } from "@/context/NucleusSessionProvider";
import { cx, theme } from "@/design/redesign/ui";
import styles from "./AssistantDock.module.css";

/**
 * The assistant in the redesigned shell. Three states:
 *   pill     a small "Ask, create, analyze" bar, bottom centre, draggable by its grip;
 *   float    the conversation as a card that grows out of the pill;
 *   docked   the same conversation as a full-height panel on the right.
 * Text questions go to /api/assistant; the mic starts the live voice session.
 */

type Mode = "pill" | "float" | "docked";
type Turn = { id: string; role: "user" | "assistant"; text: string; sources?: string[] };
type Point = { x: number; y: number };

const POSITION_KEY = "nucleus_assistant_position";
const MODE_KEY = "nucleus_assistant_docked";

const SUGGESTIONS = [
  "What needs my attention today?",
  "Show workforce attendance and overtime hours",
  "Explain the 15-minute attendance grace rule",
  "Explain employee loan borrowing limits",
];

function readPosition(): Point | null {
  try { const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null"); return value && typeof value.x === "number" && typeof value.y === "number" ? value : null; } catch { return null; }
}

function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.logo}>
      <defs>
        <linearGradient id="nucleus-ai-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" /><stop offset="0.5" stopColor="#a855f7" /><stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <path fill="url(#nucleus-ai-logo)" d="M12 1.5c.6 4.9 3.1 8.9 9.5 10.5-6.4 1.6-8.9 5.6-9.5 10.5-.6-4.9-3.1-8.9-9.5-10.5C8.9 10.4 11.4 6.4 12 1.5Z" />
    </svg>
  );
}

export default function AssistantDock({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth() as unknown as { user?: { name?: string } | null };
  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  const session = useNucleusSession();
  const [docked, setDocked] = useState(() => { try { return localStorage.getItem(MODE_KEY) === "1"; } catch { return false; } });
  const [position, setPosition] = useState<Point | null>(() => (typeof window === "undefined" ? null : readPosition()));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const drag = useRef<{ start: Point; origin: Point; moved: boolean } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mode: Mode = !open ? "pill" : docked ? "docked" : "float";

  useEffect(() => { try { localStorage.setItem(MODE_KEY, docked ? "1" : "0"); } catch { /* storage blocked */ } }, [docked]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 220); }, [open, docked]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && open) onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);

  /* ---------- dragging the pill ---------- */
  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: { x: event.clientX, y: event.clientY }, origin: { x: rect.left, y: rect.top }, moved: false };
  }
  function onGripMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    const rect = pillRef.current?.getBoundingClientRect();
    if (!state || !rect) return;
    const dx = event.clientX - state.start.x, dy = event.clientY - state.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
    const x = Math.min(Math.max(8, state.origin.x + dx), window.innerWidth - rect.width - 8);
    const y = Math.min(Math.max(8, state.origin.y + dy), window.innerHeight - rect.height - 8);
    setPosition({ x, y });
  }
  function onGripUp() {
    if (drag.current?.moved && position) { try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* storage blocked */ } }
    drag.current = null;
  }

  /* ---------- talking ---------- */
  async function send(text?: string) {
    const query = (text ?? input).trim();
    if (!query || busy) return;
    setInput("");
    if (!open) onOpenChange(true);
    if (session.status === "live") { session.sendText(query); setTurns((list) => [...list, { id: crypto.randomUUID(), role: "user", text: query }]); return; }
    setTurns((list) => [...list, { id: crypto.randomUUID(), role: "user", text: query }]);
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ message: query }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `The assistant could not answer (${response.status}).`);
      setTurns((list) => [...list, { id: crypto.randomUUID(), role: "assistant", text: data?.answer || "I could not find an answer to that.", sources: Array.isArray(data?.sources) ? data.sources : undefined }]);
    } catch (error) {
      setTurns((list) => [...list, { id: crypto.randomUUID(), role: "assistant", text: (error as Error).message }]);
    } finally {
      setBusy(false);
    }
  }
  const live = session.status === "live" || session.status === "connecting";
  const toggleMic = async () => { try { if (live) await session.disconnect(); else await session.connect(); } catch { /* the session reports its own errors */ } };
  const voiceTurns = session.turns ?? [];

  // Where the floating card sits: above the pill's spot, kept on screen.
  const floatStyle = position && mode === "float"
    ? { left: Math.min(Math.max(12, position.x + 150 - 210), window.innerWidth - 432), top: Math.max(12, Math.min(position.y + 52 - 640, window.innerHeight - 652)), bottom: "auto", transform: "none" }
    : undefined;
  const pillStyle = position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined;

  const conversation = (
    <>
      <header className={styles.head}>
        <button type="button" className={styles.brand}><Logo size={20} /><span>Nucleus AI</span><ChevronDown size={14} aria-hidden="true" /></button>
        <div className={styles.headTools}>
          <button type="button" className={styles.tool} title="New chat" aria-label="New chat" onClick={() => setTurns([])}><SquarePen size={17} /></button>
          <button type="button" className={styles.tool} title={docked ? "Float" : "Dock to the right"} aria-label={docked ? "Float the assistant" : "Dock the assistant to the right"} aria-pressed={docked} onClick={() => setDocked(!docked)}>
            {docked ? <PictureInPicture2 size={17} /> : <PanelRight size={17} />}
          </button>
          <button type="button" className={styles.tool} title="Close" aria-label="Close the assistant" onClick={() => onOpenChange(false)}><X size={18} /></button>
        </div>
      </header>
      <div className={styles.body} ref={listRef} onScroll={(event) => { const el = event.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }}>
        <div className={styles.greeting}>
          <p><strong>Hi {firstName},</strong></p>
          <p>I&apos;m your Nucleus assistant. I work inside your organisation&apos;s records, so I can answer from your people, policies, attendance and payroll.</p>
          <p>Here&apos;s where I can save you the most time right now:</p>
        </div>
        <ul className={styles.suggestions}>
          {SUGGESTIONS.map((suggestion, index) => (
            <li key={suggestion} style={{ animationDelay: `${120 + index * 60}ms` }}>
              <button type="button" className={styles.suggestion} onClick={() => void send(suggestion)}><CornerDownRight size={16} aria-hidden="true" /><span>{suggestion}</span></button>
            </li>
          ))}
        </ul>
        {turns.map((turn) => (
          <div key={turn.id} className={cx(styles.turn, turn.role === "user" ? styles.user : styles.assistant)}>
            <div className={styles.bubble}>{turn.text}</div>
            {turn.role === "assistant" && (
              <div className={styles.reactions}>
                <button type="button" aria-label="Helpful"><ThumbsUp size={14} /></button>
                <button type="button" aria-label="Not helpful"><ThumbsDown size={14} /></button>
                <button type="button" aria-label="Copy" onClick={() => void navigator.clipboard?.writeText(turn.text)}><Copy size={14} /></button>
                {turn.sources?.length ? <span className={styles.sources}>{turn.sources.slice(0, 2).join(" · ")}</span> : null}
              </div>
            )}
          </div>
        ))}
        {voiceTurns.map((turn, index) => (
          <div key={`voice-${index}`} className={cx(styles.turn, turn.role === "user" ? styles.user : styles.assistant)}><div className={styles.bubble}>{turn.text}</div></div>
        ))}
        {busy && <div className={cx(styles.turn, styles.assistant)}><div className={styles.thinking}><Logo size={16} /><span /><span /><span /></div></div>}
      </div>
      {!atBottom && <button type="button" className={styles.jump} aria-label="Scroll to the latest" onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })}><ArrowDown size={16} /></button>}
      <div className={styles.composerWrap}>
        <div className={styles.composer}>
          <textarea ref={inputRef} rows={2} value={input} placeholder="Message Nucleus AI…" aria-label="Message Nucleus AI" onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
          <div className={styles.composerBar}>
            <button type="button" className={styles.tool} aria-label="Attach"><Plus size={18} /></button>
            <span className={styles.status}>{session.status === "live" ? "Listening…" : session.status === "connecting" ? "Connecting…" : ""}</span>
            <button type="button" className={cx(styles.tool, live && styles.micLive)} aria-label={live ? "Stop talking" : "Talk"} aria-pressed={live} onClick={() => void toggleMic()}><Mic size={17} /></button>
            <button type="button" className={styles.sendButton} aria-label="Send" disabled={!input.trim() || busy} onClick={() => void send()}><ArrowUp size={16} /></button>
          </div>
        </div>
        <p className={styles.disclaimer}>AI can be inaccurate; check important answers against the records.</p>
      </div>
    </>
  );

  return (
    <div className={theme.scope}>
      {/* The pill: always on the page when the assistant is closed */}
      <div ref={pillRef} className={cx(styles.pill, mode !== "pill" && styles.pillHidden)} style={pillStyle}>
        <button type="button" className={styles.grip} aria-label="Move the assistant" title="Drag to move" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}><GripVertical size={16} /></button>
        <button type="button" className={styles.pillBody} onClick={() => onOpenChange(true)} aria-label="Open the assistant">
          <span className={styles.pillGlow} aria-hidden="true" />
          <Logo size={18} /><span className={styles.pillText}>Ask, create, analyze</span>
        </button>
      </div>

      {/* Floating card */}
      <section className={cx(styles.panel, styles.float, mode === "float" && styles.open)} style={floatStyle} aria-label="Nucleus AI" aria-hidden={mode !== "float"} role="dialog">
        {mode === "float" && conversation}
      </section>

      {/* Docked to the right */}
      <aside className={cx(styles.panel, styles.dock, mode === "docked" && styles.open)} aria-label="Nucleus AI" aria-hidden={mode !== "docked"}>
        {mode === "docked" && conversation}
      </aside>
    </div>
  );
}
