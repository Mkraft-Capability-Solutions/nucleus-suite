"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MicrophoneCapture, SpeechPlayer, chunkLevel } from '@/lib/ai/nucleus-audio';
import { NucleusLiveSession } from '@/lib/ai/nucleus-live';
import { findAction, validateDraft, submitDraft, type ActionDraft, type TraceEntry } from '@/lib/ai/nucleus-catalog';
import type { LiveFunctionCall, LiveFunctionResponse } from '@/lib/ai/nucleus-live';
import { navigationCatalog } from '@/lib/navigation-catalog';

/**
 * Nucleus AI live voice session — held above the router in the workspace layout.
 * Ported from helper/src/components/hrms/nucleus-session-provider.tsx
 *
 * The session (WebSocket + microphone) lives here, not in the VoiceNavigator modal,
 * so navigating between modules does not close the socket mid-sentence.
 */

export type OrbLevels = { user: number; assistant: number };
export type Status = 'idle' | 'connecting' | 'live' | 'error';
export type Turn = { role: 'user' | 'assistant'; text: string };
export type OpenedScreen = { moduleId: string; label: string; href: string; at: number };

export type SessionAttributes = {
  socketUrl: string;
  setup: Record<string, unknown>;
  runId: string | null;
  transcriptRecorded: boolean;
  model: string;
  actions: Array<{ name: string; summary: string }>;
};

/** Whole-utterance spoken confirmation — not a substring search, to prevent "don't confirm" from confirming. */
const SPOKEN_CONFIRM = /^(?:ok(?:ay)?|yes|yeah|yep)?[,\s]*(?:please\s+)?(?:go\s+ahead\s+and\s+)?confirm(?:\s+(?:it|that|this))?(?:\s+please)?$/i;
const SPOKEN_CANCEL = /^(?:no|nope)?[,\s]*(?:please\s+)?cancel(?:\s+(?:it|that|this))?(?:\s+please)?$/i;

export function spokenDraftIntent(utterance: string): 'confirm' | 'cancel' | null {
  const cleaned = utterance.trim().replace(/[.!?]+$/g, '').trim();
  if (!cleaned || cleaned.length > 40) return null;
  if (SPOKEN_CONFIRM.test(cleaned)) return 'confirm';
  if (SPOKEN_CANCEL.test(cleaned)) return 'cancel';
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
  getLevels: () => OrbLevels;
};

const NucleusSessionContext = createContext<NucleusSessionValue | null>(null);

export function useNucleusSession(): NucleusSessionValue {
  const value = useContext(NucleusSessionContext);
  if (!value) throw new Error('useNucleusSession must be used inside NucleusSessionProvider.');
  return value;
}

export function NucleusSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
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
  // Audio levels stay in refs — never put through React (changes 60×/s during audio)
  const levels = useRef<OrbLevels>({ user: 0, assistant: 0 });
  const assistantDecay = useRef<number>(0);
  const pending = useRef<{ user: string; assistant: string }>({ user: '', assistant: '' });
  const draftRef = useRef<ActionDraft | null>(null);
  const confirmDraftRef = useRef<() => void>(() => {});
  const cancelDraftRef = useRef<() => void>(() => {});

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const getLevels = useCallback((): OrbLevels => {
    if (assistantDecay.current > 0) {
      assistantDecay.current -= 1;
      if (assistantDecay.current === 0) levels.current.assistant = 0;
    }
    return levels.current;
  }, []);

  const appendFragment = useCallback((role: 'user' | 'assistant', text: string) => {
    pending.current[role] += text;
    setTurns((current) => {
      const last = current.at(-1);
      if (last && last.role === role) {
        return [...current.slice(0, -1), { role, text: pending.current[role] }];
      }
      return [...current, { role, text: pending.current[role] }];
    });
  }, []);

  const persistTurn = useCallback(async (role: string, text: string) => {
    if (!runId.current || !text.trim()) return;
    try {
      await fetch('/api/v1/ai/nucleus/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId: runId.current, role, text: text.slice(0, 8000) }),
      });
    } catch { /* conversation matters more than its copy */ }
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

  useEffect(() => () => void teardown(), [teardown]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setNotice(null);
    setDraftResult(null);
    try {
      const response = await fetch('/api/v1/ai/nucleus/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const payload = await response.json().catch(() => null) as { data?: SessionAttributes; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? `A voice session could not be opened (${response.status}).`);
      }
      const attributes = payload.data;
      setSession(attributes);
      runId.current = attributes.runId;

      const player = new SpeechPlayer();
      speaker.current = player;

      // Tool dispatcher: read tools → server analyze endpoint; navigation → router.push; write tools → draft card
      const dispatch = async (calls: LiveFunctionCall[]): Promise<LiveFunctionResponse[]> => {
        const responses: LiveFunctionResponse[] = [];
        for (const call of calls) {
          const args = (call.args ?? {}) as Record<string, unknown>;

          if (call.name === 'open_screen' || call.name.startsWith('navigate_')) {
            const moduleId = String(args.moduleId ?? args.screen ?? args.id ?? call.name.replace('navigate_', ''));
            const item = navigationCatalog.find((c) => c.id === moduleId);
            const href = item?.href ?? `/${moduleId}`;
            const label = item?.label ?? moduleId;
            setScreens((current) => [
              { moduleId, label, href, at: Date.now() },
              ...current.filter((c) => c.moduleId !== moduleId),
            ].slice(0, 4));
            router.push(href);
            setTrace((t) => ([{ tool: call.name, outcome: 'ok' as const, at: Date.now() }, ...t] as TraceEntry[]).slice(0, 25));
            responses.push({ id: call.id, name: call.name, response: { ok: true, screen: label, href } });
            continue;
          }

          try {
            // Read/analysis tools go to server
            const response = await analyzeViaApi(call.name, args, runId.current);
            if (response && typeof response === 'object') {
              setAnalysis({ tool: call.name, result: response as Record<string, unknown> });
            }
            setTrace((t) => ([{ tool: call.name, outcome: 'ok' as const, at: Date.now() }, ...t] as TraceEntry[]).slice(0, 25));
            responses.push({ id: call.id, name: call.name, response: { result: response } });
          } catch {
            // Try as an action draft
            const action = findAction(call.name);
            if (action) {
              const validation = validateDraft(action, args);
              if (validation.missing.length > 0) {
                setTrace((t) => ([{ tool: call.name, outcome: 'needs_more_info' as const, detail: validation.missing.map(f => f.label).join(', '), at: Date.now() }, ...t] as TraceEntry[]).slice(0, 25));
                responses.push({ id: call.id, name: call.name, response: { status: 'needs_more_info', missing: validation.missing, instruction: 'Ask the person for these values.' } });
              } else {
                setDraftResult(null);
                setDraft({ action, fields: validation.fields, body: validation.body });
                setTrace((t) => ([{ tool: call.name, outcome: 'draft' as const, at: Date.now() }, ...t] as TraceEntry[]).slice(0, 25));
                responses.push({ id: call.id, name: call.name, response: { status: 'awaiting_confirmation', instruction: 'The draft is on screen. Tell the person what it says and ask them to confirm or cancel.' } });
              }
            } else {
              setTrace((t) => ([{ tool: call.name, outcome: 'error' as const, at: Date.now() }, ...t] as TraceEntry[]).slice(0, 25));
              responses.push({ id: call.id, name: call.name, response: { error: `No tool called ${call.name} exists.` } });
            }
          }
        }
        return responses;
      };

      const socket = new NucleusLiveSession(attributes.socketUrl, attributes.setup, {
        onReady: () => setStatus('live'),
        onUserText: (text) => appendFragment('user', text),
        onModelText: (text) => appendFragment('assistant', text),
        onAudio: (pcm) => {
          levels.current.assistant = Math.max(levels.current.assistant, chunkLevel(pcm));
          assistantDecay.current = 14;
          void player.enqueue(pcm);
        },
        onInterrupted: () => { player.flush(); levels.current.assistant = 0; assistantDecay.current = 0; },
        onTurnComplete: () => {
          const spoken = pending.current.user;
          void persistTurn('user', spoken);
          void persistTurn('assistant', pending.current.assistant);
          pending.current = { user: '', assistant: '' };
          setTurns((t) => [...t]);
          if (draftRef.current) {
            const intent = spokenDraftIntent(spoken);
            if (intent === 'confirm') confirmDraftRef.current();
            if (intent === 'cancel') cancelDraftRef.current();
          }
        },
        onToolCall: dispatch,
        onNotice: (message) => setNotice(message),
        onError: (message) => { setNotice(message); setStatus('error'); },
        onClose: (reason) => { setNotice(reason); setStatus('idle'); },
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
      setNotice(caught instanceof Error ? caught.message : 'Nucleus AI could not be reached.');
      setStatus('error');
      await teardown();
    }
  }, [appendFragment, persistTurn, teardown]);

  const disconnect = useCallback(async () => {
    await teardown();
    setStatus('idle');
  }, [teardown]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !live.current?.isReady) return;
    appendFragment('user', trimmed);
    pending.current.user = '';
    void persistTurn('user', trimmed);
    live.current.sendText(trimmed);
  }, [appendFragment, persistTurn]);

  const confirmDraft = useCallback(async () => {
    const prepared = draftRef.current;
    if (!prepared) return;
    draftRef.current = null;
    setDraft(null);
    const outcome = await submitDraft(prepared);
    setDraftResult(outcome.message);
    void persistTurn('action', `${prepared.action.name}: ${outcome.ok ? 'confirmed' : 'refused'} — ${outcome.message}`);
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
    setDraftResult('Cancelled. Nothing was written.');
    live.current?.sendText(`The person cancelled the ${prepared.action.name} draft. Ask what they would like to change.`);
  }, []);

  useEffect(() => {
    confirmDraftRef.current = () => void confirmDraft();
    cancelDraftRef.current = cancelDraft;
  }, [confirmDraft, cancelDraft]);

  const value: NucleusSessionValue = {
    status, listening: status === 'live', notice, turns, trace,
    draft, draftResult, analysis, screens, session,
    connect, disconnect, sendText, confirmDraft, cancelDraft, getLevels,
  };

  return (
    <NucleusSessionContext.Provider value={value}>
      {children}
    </NucleusSessionContext.Provider>
  );
}

async function analyzeViaApi(tool: string, args: Record<string, unknown>, runId: string | null): Promise<unknown> {
  const response = await fetch('/api/v1/ai/nucleus/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, args, ...(runId ? { runId } : {}) }),
  });
  const payload = await response.json().catch(() => null) as { data?: { result?: unknown }; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? `The ${tool} tool failed (${response.status}).`);
  return payload?.data?.result ?? null;
}
