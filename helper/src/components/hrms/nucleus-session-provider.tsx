"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { chunkLevel, MicrophoneCapture, SpeechPlayer } from "@/lib/ai/nucleus-audio";
import {
  analyzeViaApi,
  createDispatcher,
  submitDraft,
  type ActionDraft,
  type TraceEntry,
} from "@/lib/ai/nucleus-dispatch";
import { NucleusLiveSession } from "@/lib/ai/nucleus-live";
import { navigationCatalog } from "@/lib/navigation-catalog";
import type { OrbLevels } from "./nucleus-orb";

/**
 * The Nucleus AI voice session, held above the router.
 *
 * WHY THIS IS NOT IN THE PAGE
 * The session is a WebSocket and a live microphone. While it lived in the page
 * component, `open_screen` could not do what it says: navigating unmounted the
 * page, which closed the socket and released the microphone, so the assistant
 * was cut off mid-sentence naming the very screen it had just opened. The
 * workaround was to stop navigating and show a card instead, which is not what
 * the tool is for.
 *
 * This provider is mounted in `(workspace)/layout.tsx` via AppShell. A Next.js
 * layout persists across navigation inside its route group, and every workspace
 * module is one dynamic route in that group, so the session survives a
 * `router.push` and `open_screen` can genuinely redirect.
 *
 * Nothing is opened until someone asks: with no session there is no socket, no
 * microphone and no audio context, so mounting this for every page costs nothing.
 */

export type Status = "idle" | "connecting" | "live" | "error";
export type Turn = { role: "user" | "assistant"; text: string };
export type OpenedScreen = { moduleId: string; label: string; href: string; at: number };

export type SessionAttributes = {
  socketUrl: string;
  setup: Record<string, unknown>;
  runId: string | null;
  transcriptRecorded: boolean;
  model: string;
  actions: Array<{ name: string; summary: string }>;
};

function humanKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

/**
 * Spoken confirmation of a drafted action.
 *
 * Deliberately a WHOLE-utterance match, not a search for the word. "Confirm" is
 * a common word in a sentence that means the opposite — "don't confirm that
 * yet", "confirm it with HR first" — and a substring test would write a record
 * on either. Requiring the entire turn to be the confirmation, once punctuation
 * and a leading "ok"/"yes" are stripped, means the person has to say the word
 * and nothing else, which is the spoken equivalent of pressing one button.
 */
const SPOKEN_CONFIRM = /^(?:ok(?:ay)?|yes|yeah|yep)?[,\s]*(?:please\s+)?(?:go\s+ahead\s+and\s+)?confirm(?:\s+(?:it|that|this))?(?:\s+please)?$/i;
const SPOKEN_CANCEL = /^(?:no|nope)?[,\s]*(?:please\s+)?cancel(?:\s+(?:it|that|this))?(?:\s+please)?$/i;

export function spokenDraftIntent(utterance: string): "confirm" | "cancel" | null {
  const cleaned = utterance.trim().replace(/[.!?]+$/g, "").trim();
  if (!cleaned || cleaned.length > 40) return null;
  if (SPOKEN_CONFIRM.test(cleaned)) return "confirm";
  if (SPOKEN_CANCEL.test(cleaned)) return "cancel";
  return null;
}

export type NucleusSessionValue = {
  status: Status;
  listening: boolean;
  notice: string | null;
  turns: Turn[];
  trace: TraceEntry[];
  draft: ActionDraft | null;
  draftResult: string | null;
  analysis: { tool: string; result: Record<string, unknown> } | null;
  screens: OpenedScreen[];
  session: SessionAttributes | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendText: (text: string) => void;
  confirmDraft: () => Promise<void>;
  cancelDraft: () => void;
  /** Read once per animation frame by the orb. Never put through React. */
  getLevels: () => OrbLevels;
};

const NucleusSessionContext = createContext<NucleusSessionValue | null>(null);

export function useNucleusSession(): NucleusSessionValue {
  const value = useContext(NucleusSessionContext);
  if (!value) throw new Error("useNucleusSession must be used inside NucleusSessionProvider.");
  return value;
}

export function NucleusSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ tool: string; result: Record<string, unknown> } | null>(null);
  const [screens, setScreens] = useState<OpenedScreen[]>([]);
  const [session, setSession] = useState<SessionAttributes | null>(null);

  const live = useRef<NucleusLiveSession | null>(null);
  const microphone = useRef<MicrophoneCapture | null>(null);
  const speaker = useRef<SpeechPlayer | null>(null);
  const runId = useRef<string | null>(null);
  // Audio levels for the sphere. Refs, not state: these change many times a
  // second and putting them through React would re-render every consumer on
  // every PCM chunk.
  const levels = useRef<OrbLevels>({ user: 0, assistant: 0 });
  const assistantDecay = useRef<number>(0);
  // Transcription arrives as fragments; they are folded into the open turn and
  // only committed when the model says the turn is done.
  const pending = useRef<{ user: string; assistant: string }>({ user: "", assistant: "" });

  // The draft the spoken-confirmation check reads. A ref because that check runs
  // inside a socket callback created once, which would otherwise close over the
  // draft as it was when the session opened.
  const draftRef = useRef<ActionDraft | null>(null);
  const confirmDraftRef = useRef<() => void>(() => {});
  const cancelDraftRef = useRef<() => void>(() => {});
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const getLevels = useCallback(() => {
    // Speech arrives in chunks scheduled slightly ahead of playback, so the
    // assistant level is held briefly and allowed to fall rather than read
    // straight from the newest chunk, which would flicker between words.
    if (assistantDecay.current > 0) {
      assistantDecay.current -= 1;
      if (assistantDecay.current === 0) levels.current.assistant = 0;
    }
    return levels.current;
  }, []);

  const appendFragment = useCallback((role: "user" | "assistant", text: string) => {
    pending.current[role] += text;
    setTurns((current) => {
      const last = current.at(-1);
      if (last && last.role === role) {
        return [...current.slice(0, -1), { role, text: pending.current[role] }];
      }
      return [...current, { role, text: pending.current[role] }];
    });
  }, []);

  const persistTurn = useCallback(async (role: "user" | "assistant" | "action", text: string) => {
    if (!runId.current || !text.trim()) return;
    try {
      await fetch("/api/v1/ai/nucleus/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: runId.current, role, text: text.slice(0, 8000) }),
      });
    } catch {
      /* the conversation matters more than its copy */
    }
  }, []);

  const teardown = useCallback(async () => {
    live.current?.close();
    live.current = null;
    await microphone.current?.stop();
    microphone.current = null;
    await speaker.current?.close();
    speaker.current = null;
    levels.current = { user: 0, assistant: 0 };
    assistantDecay.current = 0;
  }, []);

  // Only on unmount of the whole workspace layout — i.e. leaving the app, not
  // moving between modules. That is the point of holding the session here.
  useEffect(() => () => void teardown(), [teardown]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setNotice(null);
    setDraftResult(null);
    try {
      const response = await fetch("/api/v1/ai/nucleus/session", { method: "POST", headers: { "content-type": "application/json" } });
      const payload = (await response.json().catch(() => null)) as
        | { data?: SessionAttributes; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? `A voice session could not be opened (${response.status}).`);
      }
      const attributes = payload.data;
      setSession(attributes);
      runId.current = attributes.runId;

      const player = new SpeechPlayer();
      speaker.current = player;

      const dispatcher = createDispatcher({
        analyze: async (tool, args) => {
          const result = await analyzeViaApi(tool, args, runId.current);
          if (result && typeof result === "object") setAnalysis({ tool, result: result as Record<string, unknown> });
          return result;
        },
        onDraft: (prepared) => {
          setDraftResult(null);
          setDraft(prepared);
        },
        // A real redirect. The session is held above the router, so the page
        // underneath can change without touching the socket or the microphone.
        onNavigate: (moduleId) => {
          const item = navigationCatalog.find((candidate) => candidate.id === moduleId);
          const href = item?.href ?? `/${moduleId}`;
          setScreens((current) => [
            { moduleId, label: item?.label ?? humanKey(moduleId.replace(/-/g, " ")), href, at: Date.now() },
            ...current.filter((candidate) => candidate.moduleId !== moduleId),
          ].slice(0, 4));
          router.push(href);
        },
        onTrace: (entry) => setTrace((current) => [entry, ...current].slice(0, 25)),
      });

      const socket = new NucleusLiveSession(attributes.socketUrl, attributes.setup, {
        onReady: () => setStatus("live"),
        onUserText: (text) => appendFragment("user", text),
        onModelText: (text) => appendFragment("assistant", text),
        onAudio: (pcm) => {
          levels.current.assistant = Math.max(levels.current.assistant, chunkLevel(pcm));
          assistantDecay.current = 14;
          void player.enqueue(pcm);
        },
        onInterrupted: () => {
          player.flush();
          levels.current.assistant = 0;
          assistantDecay.current = 0;
        },
        onTurnComplete: () => {
          const spoken = pending.current.user;
          void persistTurn("user", spoken);
          void persistTurn("assistant", pending.current.assistant);
          pending.current = { user: "", assistant: "" };
          setTurns((current) => [...current]);
          // "Confirm" only means anything while a draft is actually on screen,
          // and only as a complete utterance. Anything else is left to the model.
          if (draftRef.current) {
            const intent = spokenDraftIntent(spoken);
            if (intent === "confirm") confirmDraftRef.current();
            if (intent === "cancel") cancelDraftRef.current();
          }
        },
        onToolCall: dispatcher,
        onNotice: (message) => setNotice(message),
        onError: (message) => {
          setNotice(message);
          setStatus("error");
        },
        onClose: (reason) => {
          setNotice(reason);
          setStatus("idle");
        },
      });
      live.current = socket;
      socket.connect();

      const capture = new MicrophoneCapture((pcm, level) => {
        levels.current.user = level;
        socket.sendAudio(pcm);
      });
      microphone.current = capture;
      await capture.start();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Nucleus AI could not be reached.");
      setStatus("error");
      await teardown();
    }
  }, [appendFragment, persistTurn, router, teardown]);

  const disconnect = useCallback(async () => {
    await teardown();
    setStatus("idle");
  }, [teardown]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !live.current?.isReady) return;
    appendFragment("user", trimmed);
    pending.current.user = "";
    void persistTurn("user", trimmed);
    live.current.sendText(trimmed);
  }, [appendFragment, persistTurn]);

  const confirmDraft = useCallback(async () => {
    const prepared = draftRef.current;
    if (!prepared) return;
    // Clear first: the submit is awaited, and a second confirmation arriving in
    // that window — a repeated word, or the button after the spoken form — must
    // not post the same action twice.
    draftRef.current = null;
    setDraft(null);
    const outcome = await submitDraft(prepared);
    setDraftResult(outcome.message);
    void persistTurn("action", `${prepared.action.name}: ${outcome.ok ? "confirmed" : "refused"} — ${outcome.message}`);
    // The model is waiting on a tool it was told is pending; telling it the
    // result as a plain turn lets it narrate the outcome truthfully.
    live.current?.sendText(
      outcome.ok
        ? `The person confirmed the ${prepared.action.name} draft and the system accepted it. ${outcome.message}`
        : `The person confirmed the ${prepared.action.name} draft but the system refused it: ${outcome.message}`,
    );
  }, [persistTurn]);

  const cancelDraft = useCallback(() => {
    const prepared = draftRef.current;
    if (!prepared) return;
    draftRef.current = null;
    setDraft(null);
    setDraftResult("Cancelled. Nothing was written.");
    live.current?.sendText(`The person cancelled the ${prepared.action.name} draft. Nothing was written. Ask what they would like to change.`);
  }, []);

  useEffect(() => {
    confirmDraftRef.current = () => void confirmDraft();
    cancelDraftRef.current = cancelDraft;
  }, [confirmDraft, cancelDraft]);

  const value: NucleusSessionValue = {
    status,
    listening: status === "live",
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
  };

  return <NucleusSessionContext.Provider value={value}>{children}</NucleusSessionContext.Provider>;
}
