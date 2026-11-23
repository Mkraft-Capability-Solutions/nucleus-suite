"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Activity, ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, Copy, CornerDownRight, ExternalLink, GripVertical, Maximize2, Mic, Minimize2,
  PanelRight, PictureInPicture2, ShieldCheck, Square, SquarePen, ThumbsDown, ThumbsUp, TriangleAlert, Volume2, VolumeX, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNucleusSession } from "@/context/NucleusSessionProvider";
import { ActionMenu, cx, theme } from "@/design/redesign/ui";
import styles from "./AssistantDock.module.css";

/**
 * Nucleus AI in the redesigned shell: the same assistant as the classic Neural Intelligence panel
 * (QuantumCopilot) and the full cockpit (NucleusAiPage), in three forms:
 *   pill      "Ask, create, analyze", bottom centre, movable by its grip;
 *   float     a card that grows out of the pill (and can be expanded to a large centred view);
 *   docked    a full-height panel on the right.
 *
 * What it does, all through the existing services:
 *   - typed questions → /api/assistant (policy answers with their sources);
 *   - live voice → NucleusSessionProvider (Gemini Live: speaks and listens, mute, live level meter);
 *     while live, typed text goes into the same session;
 *   - tools the voice assistant calls: figures from /api/v1/ai/nucleus/analyze (each with its origin),
 *     screens it opened, and the tool trace;
 *   - drafted actions (apply leave, …) shown field by field, written only when confirmed (or said "confirm");
 *   - context suggestions for the screen in use; read aloud, copy, feedback; Esc closes and ends the call.
 */

type Mode = "pill" | "float" | "docked";
type Turn = { id: string; role: "user" | "assistant"; text: string; sources?: string[] };
type Point = { x: number; y: number };
type SourceLike = { value: unknown; available: boolean; message?: string; origin?: string };

const POSITION_KEY = "nucleus_assistant_position";
const MODE_KEY = "nucleus_assistant_docked";

// Typed questions are answered from the policy register; figures and actions come through a voice call.
const SUGGESTIONS: Record<string, string[]> = {
  attendance: ["Explain the 15-minute shift grace rule", "How does overnight shift crossover work?", "Explain the compensatory off 60-day expiry rule"],
  leaves: ["Explain the compensatory off 60-day expiry rule", "How many late arrivals are allowed in a month?", "Explain the 15-minute attendance grace rule"],
  payroll: ["Explain employee loan borrowing limits", "Explain the 15-minute attendance grace rule", "How does overnight shift crossover work?"],
};
const DEFAULT_SUGGESTIONS = ["Explain the 15-minute attendance grace rule", "Explain employee loan borrowing limits", "Explain the compensatory off 60-day expiry rule", "How does overnight shift crossover work?"];

const isSourceLike = (value: unknown): value is SourceLike => typeof value === "object" && value !== null && "available" in value && "value" in value;
const humanKey = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (character) => character.toUpperCase());

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

/** A live level meter: the bars follow whoever is speaking (pink for you, green for the assistant). */
function LevelMeter({ getLevels, active }: { getLevels: () => { user: number; assistant: number }; active: boolean }) {
  const [levels, setLevels] = useState({ user: 0, assistant: 0 });
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const loop = () => { setLevels(getLevels()); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, getLevels]);
  const speaking = levels.assistant > 0.05;
  const level = active ? Math.max(levels.user, levels.assistant) : 0;
  const shape = [0.35, 0.55, 0.8, 1, 0.7, 0.45, 0.6, 0.9, 1, 0.75, 0.5, 0.3];
  return (
    <span className={cx(styles.meter, speaking ? styles.meterAssistant : styles.meterUser)} aria-hidden="true">
      {shape.map((weight, index) => <span key={index} style={{ height: `${Math.max(3, Math.min(20, 3 + level * 40 * weight))}px` }} />)}
    </span>
  );
}

export default function AssistantDock({ open, onOpenChange, activeTab, onNavigate }: {
  open: boolean; onOpenChange: (open: boolean) => void; activeTab?: string; onNavigate?: (tab: string) => void;
}) {
  const { user } = useAuth() as unknown as { user?: { name?: string } | null };
  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  const session = useNucleusSession();
  const [docked, setDocked] = useState(() => { try { return localStorage.getItem(MODE_KEY) === "1"; } catch { return false; } });
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<Point | null>(() => (typeof window === "undefined" ? null : readPosition()));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  // Voice turns already in this conversation (the session keeps its own list).
  const voiceBase = useRef(0);
  const drag = useRef<{ start: Point; origin: Point; moved: boolean } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mode: Mode = !open ? "pill" : docked ? "docked" : "float";
  const live = session.status === "live";
  const connecting = session.status === "connecting";

  useEffect(() => { try { localStorage.setItem(MODE_KEY, docked ? "1" : "0"); } catch { /* storage blocked */ } }, [docked]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 240); }, [open, docked]);

  // Other parts of the app open or toggle the assistant with these events.
  useEffect(() => {
    const show = () => onOpenChange(true);
    const toggle = () => onOpenChange(!open);
    window.addEventListener("nucleus:open_copilot", show);
    window.addEventListener("nucleus:toggle_copilot", toggle);
    return () => { window.removeEventListener("nucleus:open_copilot", show); window.removeEventListener("nucleus:toggle_copilot", toggle); };
  }, [open, onOpenChange]);

  // Closing ends a live call, so the microphone is never left open.
  async function close() {
    onOpenChange(false);
    setExpanded(false);
    if (live || connecting) await session.disconnect();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && open) void close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Follow the conversation unless the person has scrolled up.
  const voiceTurns = (session.turns ?? []).slice(voiceBase.current);
  useEffect(() => {
    if (atBottom) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, voiceTurns.length, session.draft, session.analysis]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPosition({ x: Math.min(Math.max(8, state.origin.x + dx), window.innerWidth - rect.width - 8), y: Math.min(Math.max(8, state.origin.y + dy), window.innerHeight - rect.height - 8) });
  }
  function onGripUp() {
    if (drag.current?.moved && position) { try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* storage blocked */ } }
    drag.current = null;
  }
  function onGripKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 40 : 12;
    const moves: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const move = moves[event.key];
    const rect = pillRef.current?.getBoundingClientRect();
    if (!move || !rect) return;
    event.preventDefault();
    const next = { x: Math.min(Math.max(8, rect.left + move.x), window.innerWidth - rect.width - 8), y: Math.min(Math.max(8, rect.top + move.y), window.innerHeight - rect.height - 8) };
    setPosition(next);
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }

  /* ---------- talking ---------- */
  async function send(text?: string) {
    const query = (text ?? input).trim();
    if (!query || busy) return;
    setInput("");
    setAtBottom(true);
    if (!open) onOpenChange(true);
    // In a live call, typed text goes into the same conversation the voice assistant is having.
    if (live) { session.sendText(query); return; }
    setTurns((list) => [...list, { id: crypto.randomUUID(), role: "user", text: query }]);
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ message: query }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `The assistant could not answer (${response.status}).`);
      setTurns((list) => [...list, { id: crypto.randomUUID(), role: "assistant", text: data?.answer || "I could not find an answer to that in the policies I can read.", sources: Array.isArray(data?.sources) ? data.sources : undefined }]);
    } catch (error) {
      setTurns((list) => [...list, { id: crypto.randomUUID(), role: "assistant", text: (error as Error).message }]);
    } finally {
      setBusy(false);
    }
  }
  async function toggleCall() {
    try {
      if (live || connecting) await session.disconnect();
      else { voiceBase.current = session.turns.length; await session.connect(); }
    } catch { /* the session shows its own notice */ }
  }
  function newChat() {
    setTurns([]);
    setFeedback({});
    voiceBase.current = session.turns.length;
  }
  function readAloud(turn: Turn) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (reading === turn.id) { synth.cancel(); setReading(null); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(turn.text);
    utterance.onend = () => setReading(null);
    setReading(turn.id);
    synth.speak(utterance);
  }
  async function copy(turn: Turn) {
    try { await navigator.clipboard.writeText(turn.text); setCopied(turn.id); window.setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }

  const suggestions = SUGGESTIONS[activeTab ?? ""] ?? DEFAULT_SUGGESTIONS;
  const figures = session.analysis ? Object.entries(session.analysis.result).filter(([, value]) => isSourceLike(value)) as Array<[string, SourceLike]> : [];
  const statusLine = connecting ? "Connecting the voice session…" : live ? "Live · speak or type" : session.status === "error" ? "Voice unavailable" : null;
  const empty = turns.length === 0 && voiceTurns.length === 0;

  // Where the floating card sits: above the pill's spot, kept on screen.
  const floatStyle = position && mode === "float" && !expanded
    ? { left: Math.min(Math.max(12, position.x + 150 - 210), window.innerWidth - 432), top: Math.max(12, Math.min(position.y + 52 - 640, window.innerHeight - 652)), bottom: "auto", transform: "none" }
    : undefined;
  const pillStyle = position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined;

  const assistantTools = (turn: Turn) => (
    <div className={styles.reactions}>
      <button type="button" aria-label="Helpful" aria-pressed={feedback[turn.id] === "up"} onClick={() => setFeedback((value) => ({ ...value, [turn.id]: "up" }))}><ThumbsUp size={14} /></button>
      <button type="button" aria-label="Not helpful" aria-pressed={feedback[turn.id] === "down"} onClick={() => setFeedback((value) => ({ ...value, [turn.id]: "down" }))}><ThumbsDown size={14} /></button>
      <button type="button" aria-label={copied === turn.id ? "Copied" : "Copy"} onClick={() => void copy(turn)}>{copied === turn.id ? <Check size={14} /> : <Copy size={14} />}</button>
      <button type="button" aria-label={reading === turn.id ? "Stop reading" : "Read aloud"} aria-pressed={reading === turn.id} onClick={() => readAloud(turn)}><Volume2 size={14} /></button>
      {feedback[turn.id] && <span className={styles.thanks}>Thanks for the feedback</span>}
    </div>
  );

  const conversation = (
    <>
      {live && <div className={styles.liveSeam} aria-hidden="true" />}
      <header className={styles.head}>
        <ActionMenu label="Nucleus AI options" align="start" trigger={<span className={styles.brand}><Logo size={20} /><span>Nucleus AI</span><ChevronDown size={14} aria-hidden="true" /></span>} actions={[
          { label: "New chat", icon: SquarePen, onSelect: newChat },
          { label: live || connecting ? "End the voice call" : "Start a voice call", icon: Mic, onSelect: () => void toggleCall() },
          ...(onNavigate ? [{ label: "Open the full Nucleus AI page", icon: ExternalLink, onSelect: () => { onNavigate("nucleus_ai"); void close(); } }] : []),
        ]} />
        <div className={styles.headTools}>
          <button type="button" className={styles.tool} title="New chat" aria-label="New chat" onClick={newChat}><SquarePen size={17} /></button>
          {!docked && <button type="button" className={styles.tool} title={expanded ? "Smaller" : "Expand"} aria-label={expanded ? "Make the assistant smaller" : "Expand the assistant"} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
          <button type="button" className={styles.tool} title={docked ? "Float" : "Dock to the right"} aria-label={docked ? "Float the assistant" : "Dock the assistant to the right"} aria-pressed={docked} onClick={() => { setDocked(!docked); setExpanded(false); }}>
            {docked ? <PictureInPicture2 size={17} /> : <PanelRight size={17} />}
          </button>
          <button type="button" className={styles.tool} title="Close (Esc)" aria-label="Close the assistant" onClick={() => void close()}><X size={18} /></button>
        </div>
      </header>

      {(statusLine || session.session) && (
        <div className={cx(styles.callBar, live && styles.callBarLive)} role="status">
          <span className={cx(styles.callDot, live && styles.callDotLive, connecting && styles.callDotConnecting)} aria-hidden="true" />
          <span className={styles.callText}>{statusLine ?? "Voice session ended"}{session.session ? ` · ${session.session.model}` : ""}</span>
          {live && <LevelMeter getLevels={session.getLevels} active={live} />}
          {live && <button type="button" className={styles.callButton} aria-pressed={session.isMuted} onClick={session.toggleMute}>{session.isMuted ? <><VolumeX size={13} />Unmute voice</> : <><Volume2 size={13} />Mute voice</>}</button>}
          {(live || connecting) && <button type="button" className={cx(styles.callButton, styles.callEnd)} onClick={() => void toggleCall()}><Square size={11} />End</button>}
        </div>
      )}
      {session.notice && <p className={styles.notice} role="status"><TriangleAlert size={14} aria-hidden="true" />{session.notice}</p>}
      {session.session && !session.session.transcriptRecorded && live && <p className={styles.noticeQuiet}>This conversation is not written to an AI run (your role cannot open one), so nothing said here is kept.</p>}

      <div className={styles.body} ref={listRef} aria-live="polite" onScroll={(event) => { const el = event.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }}>
        <div className={styles.greeting}>
          <p><strong>Hi {firstName},</strong></p>
          <p>I&apos;m your Nucleus assistant. I answer from your organisation&apos;s policies and records, only what your role may read, and I write nothing until you confirm it.</p>
          {empty && <p>Here&apos;s where I can save you the most time right now:</p>}
        </div>
        {empty && (
          <ul className={styles.suggestions}>
            {suggestions.map((suggestion, index) => (
              <li key={suggestion} style={{ animationDelay: `${120 + index * 60}ms` }}>
                <button type="button" className={styles.suggestion} onClick={() => void send(suggestion)}><CornerDownRight size={16} aria-hidden="true" /><span>{suggestion}</span></button>
              </li>
            ))}
          </ul>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className={cx(styles.turn, turn.role === "user" ? styles.user : styles.assistant)}>
            <div className={styles.bubble}>{turn.text}</div>
            {turn.role === "assistant" && turn.sources?.length ? (
              <div className={styles.sources}>
                {turn.sources.map((source) => <span key={source} className={styles.source} title="Policy this answer is based on"><ShieldCheck size={12} aria-hidden="true" />{source}</span>)}
              </div>
            ) : null}
            {turn.role === "assistant" && assistantTools(turn)}
          </div>
        ))}

        {voiceTurns.map((turn, index) => (
          <div key={`voice-${index}`} className={cx(styles.turn, turn.role === "user" ? styles.user : styles.assistant)}>
            <span className={styles.voiceTag}><Volume2 size={10} aria-hidden="true" />Voice</span>
            <div className={styles.bubble}>{turn.text}</div>
            {turn.role === "assistant" && assistantTools({ id: `voice-${index}`, role: "assistant", text: turn.text })}
          </div>
        ))}

        {busy && <div className={cx(styles.turn, styles.assistant)}><div className={styles.thinking}><Logo size={16} /><span /><span /><span /><em>Checking the policies…</em></div></div>}

        {/* Figures from the latest analysis, each with the record it came from */}
        {session.analysis && figures.length > 0 && (
          <section className={styles.card} aria-label="Latest analysis">
            <header className={styles.cardHead}><Activity size={14} aria-hidden="true" /><span>Latest analysis</span><code>{session.analysis.tool}</code></header>
            <div className={styles.figures}>
              {figures.map(([key, entry]) => (
                <div key={key} className={cx(styles.figure, (!entry.available || entry.value === null) && styles.figureMissing)}>
                  <span className={styles.figureLabel}>{humanKey(key)}</span>
                  <span className={styles.figureValue}>{!entry.available || entry.value === null ? "Not recorded" : typeof entry.value === "number" || typeof entry.value === "string" ? String(entry.value) : Array.isArray(entry.value) ? `${entry.value.length} rows` : "Recorded"}</span>
                  {(entry.origin || entry.message) && <span className={styles.figureOrigin}>{entry.available ? entry.origin : entry.message}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Screens the assistant opened */}
        {session.screens.length > 0 && (
          <section className={styles.card} aria-label="Screens opened">
            <header className={styles.cardHead}><ExternalLink size={14} aria-hidden="true" /><span>Screens I opened</span></header>
            <ul className={styles.screens}>
              {session.screens.map((screen) => (
                <li key={screen.moduleId}>
                  <button type="button" className={styles.screen} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:navigate_tab", { detail: screen.moduleId }))}>
                    <span>{screen.label}</span><ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A drafted action: nothing is written until it is confirmed */}
        {session.draft && (
          <section className={cx(styles.card, styles.draft)} aria-label="Action awaiting confirmation">
            <header className={styles.cardHead}><ShieldCheck size={14} aria-hidden="true" /><span>Confirm before this is written</span><span className={styles.draftTag}>Draft</span></header>
            <p className={styles.draftSummary}>{session.draft.action.summary}</p>
            <dl className={styles.fields}>
              {session.draft.fields.map((field) => (
                <div key={field.name}>
                  <dt>{field.label}{field.origin === "default" && <em> (form default)</em>}</dt>
                  <dd>{typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value)}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.draftActions}>
              <button type="button" className={styles.confirm} onClick={() => void session.confirmDraft()}><Check size={15} />Confirm and submit</button>
              <button type="button" className={styles.cancel} onClick={session.cancelDraft}><X size={15} />Cancel</button>
              {live && <span className={styles.sayHint}>Or say “confirm” on its own.</span>}
            </div>
          </section>
        )}
        {session.draftResult && <p className={styles.result} role="status"><Check size={14} aria-hidden="true" />{session.draftResult}</p>}

        {/* What the assistant called, in order */}
        {session.trace.length > 0 && (
          <section className={styles.activity}>
            <button type="button" className={styles.activityToggle} aria-expanded={showActivity} onClick={() => setShowActivity(!showActivity)}>
              <Activity size={13} aria-hidden="true" />{session.trace.length} {session.trace.length === 1 ? "step" : "steps"} taken<ChevronDown size={13} className={cx(showActivity && styles.rotated)} aria-hidden="true" />
            </button>
            {showActivity && (
              <ul className={styles.trace}>
                {session.trace.map((entry) => (
                  <li key={`${entry.tool}-${entry.at}`}>
                    <code>{entry.tool}</code>
                    <span className={cx(styles.outcome, styles[`outcome_${entry.outcome}`])}>{entry.outcome === "needs_more_info" ? "asked" : entry.outcome}</span>
                    {entry.detail && <span className={styles.traceDetail}>{entry.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {!atBottom && <button type="button" className={styles.jump} aria-label="Scroll to the latest" onClick={() => { setAtBottom(true); listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }}><ArrowDown size={16} /></button>}

      <div className={styles.composerWrap}>
        {!empty && (
          <div className={styles.chips}>
            {suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" className={styles.chip} onClick={() => void send(suggestion)}>{suggestion}</button>)}
          </div>
        )}
        <div className={cx(styles.composer, live && styles.composerLive)}>
          <textarea ref={inputRef} rows={2} value={input} placeholder={live ? "Speak, or type into the call…" : "Message Nucleus AI…"} aria-label="Message Nucleus AI" onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
          <div className={styles.composerBar}>
            <span className={styles.status}>{live ? "Live call" : connecting ? "Connecting…" : "Enter to send · Shift+Enter for a new line"}</span>
            <button type="button" className={cx(styles.tool, (live || connecting) && styles.micLive)} aria-label={live || connecting ? "End the voice call" : "Start a voice call"} title={live || connecting ? "End the voice call" : "Talk to Nucleus AI"} aria-pressed={live} onClick={() => void toggleCall()}>
              {live ? <Square size={14} /> : <Mic size={17} />}
            </button>
            <button type="button" className={styles.sendButton} aria-label="Send" disabled={!input.trim() || busy} onClick={() => void send()}><ArrowUp size={16} /></button>
          </div>
        </div>
        <p className={styles.disclaimer}>Nucleus AI reads only what your role may read and writes nothing until you confirm.</p>
      </div>
    </>
  );

  return (
    <div className={theme.scope}>
      {/* Screen edge glow while a voice call is live */}
      {live && <div className={styles.aura} aria-hidden="true" />}

      {/* The pill: on the page while the assistant is closed */}
      <div ref={pillRef} className={cx(styles.pill, mode !== "pill" && styles.pillHidden)} style={pillStyle}>
        <button type="button" className={styles.grip} aria-label="Move the assistant (drag, or use the arrow keys)" title="Drag to move" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} onKeyDown={onGripKey}><GripVertical size={16} /></button>
        <button type="button" className={styles.pillBody} onClick={() => onOpenChange(true)} aria-label="Open the assistant">
          <span className={styles.pillGlow} aria-hidden="true" />
          <Logo size={18} /><span className={styles.pillText}>{live ? "Listening… tap to open" : "Ask, create, analyze"}</span>
          {live && <LevelMeter getLevels={session.getLevels} active={live} />}
        </button>
      </div>

      {/* Floating card (or expanded) */}
      {expanded && mode === "float" && <div className={styles.scrim} aria-hidden="true" onClick={() => setExpanded(false)} />}
      <section className={cx(styles.panel, styles.float, expanded && styles.expanded, mode === "float" && styles.open)} style={floatStyle} aria-label="Nucleus AI" aria-hidden={mode !== "float"} role="dialog">
        {mode === "float" && conversation}
      </section>

      {/* Docked to the right */}
      <aside className={cx(styles.panel, styles.dock, mode === "docked" && styles.open)} aria-label="Nucleus AI" aria-hidden={mode !== "docked"}>
        {mode === "docked" && conversation}
      </aside>
    </div>
  );
}
