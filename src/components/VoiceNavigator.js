"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Close from '@mui/icons-material/Close';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Send from '@mui/icons-material/Send';
import VolumeUpOutlined from '@mui/icons-material/VolumeUpOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { useAuth } from '@/context/AuthContext';
import { useNucleusSession } from '@/context/NucleusSessionProvider';
import styles from './VoiceNavigator.module.css';
import { parseVoiceCommand, speakAloud, getTimeGreeting, hasPlayedDailyGreeting, markDailyGreetingPlayed } from '@/utils/voiceCommandEngine';

/**
 * Nucleus Talk — unified intelligent voice assistant.
 *
 * Single mode: starts in instant command mode (offline Speech API),
 * automatically upgrades to Gemini Live AI session when the user speaks
 * a complex query or clicks an AI command chip.
 *
 * Mic permission: called directly from a user gesture (click on orb/button)
 * so the browser always shows its permission dialog — no retry wrapper.
 */

const INSTANT_COMMANDS = [
  'Apply for Leave', 'Punch In', 'Punch Out',
  'Go to Attendance', 'Open Payroll Control Room', 'Show People Directory',
  'Open Talent ATS', 'Show 9-Box Performance Grid', 'Launch Bulk Data Upload',
  'Open Statutory Compliance', 'Go to Platform Settings', 'Open AI Copilot',
];

const AI_COMMANDS = [
  'What is my leave balance?',
  'Apply leave Monday to Wednesday',
  'Show attendance summary this month',
  'Who is exempt from late deduction?',
  'Raise a hiring requisition for an Engineer',
  'Record recognition for an employee',
  'What are the OT rules?',
  'Request attendance correction for yesterday',
  'Publish an announcement to all employees',
  'Give feedback about a team member',
];

export default function VoiceNavigator({ isOpen, onClose, onNavigate, onSelectConsole, onOpenModal, initialDetail }) {
  const { user } = useAuth();
  const nucleusSession = useNucleusSession();

  // Offline speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('');

  // AI session state
  const [aiMode, setAiMode] = useState(false);
  const [aiTyped, setAiTyped] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const [activeTab, setActiveTab] = useState('instant'); // 'instant' | 'ai'

  const mediaStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const executeCommandRef = useRef(null);
  const scrollRef = useRef(null);

  // Offline synthetic audio levels for the orb
  const offlineLevels = useRef({ user: 0, assistant: 0 });
  const getOfflineLevels = useCallback(() => offlineLevels.current, []);

  // Use real PCM levels in AI mode, synthetic in offline mode
  const getActiveLevels = useCallback(() => {
    if (aiMode) return nucleusSession.getLevels();
    return offlineLevels.current;
  }, [aiMode, nucleusSession]);

  const orbActive = aiMode
    ? (nucleusSession.status === 'live' || nucleusSession.status === 'connecting')
    : (isListening || isSpeaking);

  // Drive orb synthetic levels from offline state
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    offlineLevels.current.assistant = isSpeaking ? 0.65 : 0;
  }, [isSpeaking]);
  useEffect(() => {
    offlineLevels.current.user = isListening ? 0.45 : 0;
  }, [isListening]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [nucleusSession.turns]);

  // Preload browser speech voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onChange = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', onChange);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onChange);
    }
  }, []);

  // ─── Offline instant command execution ───────────────────────────────────────
  const executeCommand = useCallback((cmdText) => {
    if (!cmdText?.trim()) return;
    const cleanCmd = cmdText.trim();
    const result = parseVoiceCommand(cleanCmd);
    setTranscript(cleanCmd);
    setInputText(cleanCmd);
    setFeedback(result.speechText);
    setIsSpeaking(true);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    setIsListening(false);
    speakAloud(result.speechText, () => setIsSpeaking(false));

    if (result.type === 'ACTION') {
      if (result.action === 'PUNCH_IN') window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'IN' } }));
      else if (result.action === 'PUNCH_OUT') window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'OUT' } }));
      else if (result.action === 'APPLY_LEAVE') {
        try { sessionStorage.setItem('nucleus:auto_open_leave_apply', 'true'); } catch {}
        if (onNavigate) onNavigate('leaves', 'core_hr');
        setTimeout(() => window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply')), 150);
        setTimeout(() => window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply')), 500);
      }
    } else if (result.type === 'CONSOLE') {
      if (onSelectConsole) onSelectConsole(result.target);
      else if (onNavigate) onNavigate('dashboard', 'dashboard', result.target);
    } else if (result.type === 'TAB') {
      if (onNavigate) onNavigate(result.target, result.domain, result.sub);
    } else if (result.type === 'MODAL') {
      if (onOpenModal) onOpenModal(result.target);
      if (result.target === 'bulk_upload') window.dispatchEvent(new CustomEvent('nucleus:open_bulk_upload'));
      if (result.target === 'ctc_exception') window.dispatchEvent(new CustomEvent('nucleus:open_ctc_exception'));
      if (result.target === 'modules') window.dispatchEvent(new CustomEvent('nucleus:open_modules'));
    } else {
      if (onNavigate) onNavigate('people_core', 'core_hr');
    }
    setTimeout(() => onClose(), 650);
  }, [onClose, onNavigate, onSelectConsole, onOpenModal]);

  useEffect(() => { executeCommandRef.current = executeCommand; }, [executeCommand]);

  // ─── Mic permission + speech recognition ─────────────────────────────────────
  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Trigger browser native permission prompt via getUserMedia (matching helper)
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        mediaStreamRef.current = stream;
      } catch {
        // Native prompt handled by browser
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback('Speech recognition is not supported in this browser. Type your command below.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setFeedback('🎙️ Listening… Speak your command now');
    };

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript + ' ';
      const clean = text.trim();
      if (clean) {
        setTranscript(clean);
        setInputText(clean);
        setFeedback(`Heard: "${clean}"`);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (executeCommandRef.current) executeCommandRef.current(clean);
        }, 1200);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // normal silence, keep going
      setIsListening(false);
      setFeedback('🎙️ Click the logo to speak, or type commands below');
    };

    recognition.onend = () => {
      // Auto-restart only if we're still supposed to be listening and not mid-command
      if (recognitionRef.current && !isSpeakingRef.current) {
        try { recognition.start(); }
        catch { setIsListening(false); }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (mediaStreamRef.current) {
        try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        mediaStreamRef.current = null;
      }
      recognitionRef.current = null;
      setIsListening(false);
      if (inputText.trim()) executeCommand(inputText.trim());
    } else {
      startListening();
    }
  }, [isListening, inputText, startListening, executeCommand]);

  // ─── AI session toggle ────────────────────────────────────────────────────────
  const handleOrbClick = useCallback(() => {
    if (aiMode) {
      // In AI mode: orb click toggles the live session
      if (nucleusSession.status === 'live') nucleusSession.disconnect();
      else if (nucleusSession.status === 'idle' || nucleusSession.status === 'error') nucleusSession.connect();
    } else {
      // In instant mode: orb click toggles offline mic
      toggleListening();
    }
  }, [aiMode, nucleusSession, toggleListening]);

  // ─── Switch to AI mode ───────────────────────────────────────────────────────
  const switchToAI = useCallback(async (initialMessage) => {
    // Stop offline mode first
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    recognitionRef.current = null;
    setIsListening(false);
    setAiMode(true);
    setActiveTab('ai');
    await nucleusSession.connect();
    if (initialMessage) {
      // Small delay to ensure session is live before sending
      setTimeout(() => nucleusSession.sendText(initialMessage), 800);
    }
  }, [nucleusSession]);

  // ─── On modal open/close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Clean up everything on close
      setIsListening(false); setIsSpeaking(false); setTranscript(''); setInputText(''); setFeedback('');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (mediaStreamRef.current) {
        try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        mediaStreamRef.current = null;
      }
      recognitionRef.current = null;
      if (aiMode) { nucleusSession.disconnect(); setAiMode(false); }
      return;
    }

    // Greet on open
    const greeting = initialDetail?.greeting || getTimeGreeting(user?.name);
    setFeedback(greeting);
    const userKey = user?.id || user?.email || 'user';
    if (!hasPlayedDailyGreeting(userKey)) {
      markDailyGreetingPlayed(userKey);
      setIsSpeaking(true);
      speakAloud(greeting, () => setIsSpeaking(false));
    }

    if (initialDetail?.startLiveAi) {
      switchToAI(initialDetail?.initialMessage);
    } else {
      startListening();
    }
  }, [isOpen, initialDetail, startListening, switchToAI, user]);

  if (!isOpen) return null;

  const { status: aiStatus, turns, trace, draft, draftResult, notice } = nucleusSession;
  const hasAIContent = turns.length > 0 || draft || draftResult;

  return (
    <div
      className={styles.voiceModalOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Nucleus Talk"
    >
      <div
        className={styles.voiceModalContainer}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: hasAIContent ? '600px' : '500px', transition: 'max-width 0.3s ease' }}
      >
        {/* Close button */}
        <button className={styles.closeVoiceBtn} onClick={onClose} title="Close Nucleus Talk" aria-label="Close">
          <Close sx={{ fontSize: 16 }} />
        </button>

        {/* ── Header: Layered Images Exactly Centered Above Nucleus Talk ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div
            onClick={handleOrbClick}
            style={{
              position: 'relative',
              width: '130px',
              height: '130px',
              margin: '0 auto 0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title={isListening ? "Listening... (Click to stop)" : "Click to speak"}
          >
            {/* voice.gif layer */}
            <img
              src="/images/voice.gif"
              alt="Voice waves"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: isListening ? 1 : 0.75,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              }}
            />
            {/* logo-sqr.png layer on top in exact center */}
            <img
              src="/images/logo-sqr.png"
              alt="Nucleus Logo"
              style={{
                position: 'relative',
                width: '68px',
                height: '68px',
                objectFit: 'contain',
                zIndex: 2,
                borderRadius: '16px',
                filter: isListening
                  ? 'drop-shadow(0 0 16px rgba(147, 51, 234, 0.7))'
                  : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))',
                transition: 'all 0.3s ease',
                transform: isListening ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          </div>

          <h3 style={{
            margin: '0.4rem 0 0.15rem', fontSize: '1.3rem', fontWeight: 800,
            color: 'var(--text)', letterSpacing: '-0.02em',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            Nucleus Talk
            <AutoAwesome sx={{ fontSize: 16, color: '#8b5cf6' }} />
          </h3>

          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 500, lineHeight: 1.4 }}>
            {aiMode
              ? (aiStatus === 'connecting'
                ? '⏳ Opening AI session…'
                : aiStatus === 'live'
                  ? '🟢 AI session live — speak or type'
                  : aiStatus === 'error'
                    ? `🔴 ${notice || 'Session error — tap to retry'}`
                    : '💬 Tap the logo to start AI session')
              : isSpeaking
                ? '💬 Speaking…'
                : isListening
                  ? '🎙️ Listening — speak now'
                  : feedback || '🎙️ Listening — speak now'
            }
          </p>
        </div>

        {/* ── Notice banner (AI mode only) ── */}
        {aiMode && notice && notice !== (aiStatus === 'error' ? notice : '') && (
          <div style={{
            background: aiStatus === 'error' ? 'var(--flag-wash)' : 'var(--pending-wash)',
            border: `1px solid ${aiStatus === 'error' ? 'var(--flag)' : 'var(--pending)'}`,
            borderRadius: '8px', padding: '0.45rem 0.75rem',
            fontSize: '0.77rem', color: aiStatus === 'error' ? 'var(--flag)' : 'var(--pending)',
            marginBottom: '0.65rem', width: '100%', boxSizing: 'border-box',
          }}>
            {notice}
          </div>
        )}

        {/* ── AI MODE: Transcript + Draft + Trace ── */}
        {aiMode && hasAIContent && (
          <div style={{ width: '100%', marginBottom: '0.65rem' }}>
            {/* Transcript */}
            {turns.length > 0 && (
              <div
                ref={scrollRef}
                aria-live="polite"
                aria-label="Conversation transcript"
                style={{
                  maxHeight: '220px', overflowY: 'auto', padding: '0.75rem',
                  background: 'var(--card-2)', borderRadius: '10px',
                  border: '1px solid var(--line)', marginBottom: '0.6rem',
                  display: 'flex', flexDirection: 'column', gap: '0.6rem',
                }}
              >
                {turns.map((turn, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: turn.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.18rem' }}>
                      {turn.role === 'user' ? 'You' : 'Nucleus'}
                    </span>
                    <p style={{
                      margin: 0, maxWidth: '82%', fontSize: '0.81rem', lineHeight: 1.5,
                      color: turn.role === 'user' ? 'var(--text)' : 'var(--text-2)',
                      fontWeight: turn.role === 'user' ? 600 : 400,
                      background: turn.role === 'user' ? 'var(--signal-wash)' : 'transparent',
                      padding: turn.role === 'user' ? '0.3rem 0.55rem' : 0,
                      borderRadius: turn.role === 'user' ? '8px 8px 2px 8px' : 0,
                    }}>
                      {turn.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Draft confirmation card */}
            {draft && (
              <div style={{
                border: '1px solid var(--line-glow)', borderRadius: '10px',
                background: 'var(--signal-wash)', padding: '0.7rem',
                marginBottom: '0.6rem', width: '100%', boxSizing: 'border-box',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>Confirm before submitting</p>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, background: 'var(--signal)', color: '#fff', borderRadius: '4px', padding: '0.08rem 0.38rem', letterSpacing: '0.05em' }}>DRAFT</span>
                </div>
                <p style={{ margin: '0 0 0.45rem', fontSize: '0.74rem', color: 'var(--text-2)' }}>{draft.action.summary}</p>
                <dl style={{ margin: 0, display: 'grid', gap: '0.25rem' }}>
                  {draft.fields.map((field) => (
                    <div key={field.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: '0.22rem', gap: '0.5rem' }}>
                      <dt style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{field.label}</dt>
                      <dd style={{ margin: 0, fontSize: '0.76rem', fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right' }}>{String(field.value)}</dd>
                    </div>
                  ))}
                </dl>
                <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.6rem' }}>
                  <button
                    onClick={() => void nucleusSession.confirmDraft()}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.4rem', borderRadius: '7px', fontSize: '0.77rem', fontWeight: 700, background: 'var(--status-ok)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    <CheckCircleOutline sx={{ fontSize: 13 }} /> Confirm
                  </button>
                  <button
                    onClick={nucleusSession.cancelDraft}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.4rem', borderRadius: '7px', fontSize: '0.77rem', fontWeight: 700, background: 'var(--card-2)', color: 'var(--text-2)', border: '1px solid var(--line)', cursor: 'pointer' }}
                  >
                    <CancelOutlined sx={{ fontSize: 13 }} /> Cancel
                  </button>
                </div>
                {nucleusSession.listening && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.68rem', color: 'var(--text-2)', textAlign: 'center' }}>
                    Or say <strong style={{ color: 'var(--text)' }}>"confirm"</strong> on its own
                  </p>
                )}
              </div>
            )}

            {/* Draft result */}
            {draftResult && !draft && (
              <div style={{ padding: '0.45rem 0.7rem', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '0.77rem', color: 'var(--text-2)', marginBottom: '0.6rem' }}>
                {draftResult}
              </div>
            )}

            {/* Tool trace (collapsible) */}
            {trace.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-2)', padding: 0 }}
                >
                  {showTrace ? <ExpandLess sx={{ fontSize: 13 }} /> : <ExpandMore sx={{ fontSize: 13 }} />}
                  Tool trace ({trace.length})
                </button>
                {showTrace && (
                  <ul style={{ margin: '0.3rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
                    {trace.map((entry, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.55rem', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--card-2)' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text)' }}>{entry.tool}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.32rem', borderRadius: '4px', background: entry.outcome === 'error' ? 'var(--flag-wash)' : entry.outcome === 'draft' ? 'var(--signal-wash)' : entry.outcome === 'needs_more_info' ? 'var(--pending-wash)' : 'var(--status-ok-wash)', color: entry.outcome === 'error' ? 'var(--flag)' : entry.outcome === 'draft' ? 'var(--signal)' : entry.outcome === 'needs_more_info' ? 'var(--pending)' : 'var(--status-ok)' }}>
                          {entry.outcome === 'needs_more_info' ? 'asked' : entry.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── INSTANT MODE: Live transcript bubble ── */}
        {!aiMode && (
          <div className={styles.liveCommandBubble}>
            {transcript
              ? <span>🗣️ &quot;{transcript}&quot;</span>
              : isListening
                ? <span className={styles.listeningText}>🎙️ Listening… speak naturally (1.2s pause auto-executes)</span>
                : <span className={styles.listeningText}>Tap the logo above to start listening, or type below</span>
            }
          </div>
        )}

        {/* ── Input bar ── */}
        {aiMode ? (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', width: '100%' }}>
            <input
              type="text"
              className={styles.commandInput}
              value={aiTyped}
              onChange={(e) => setAiTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aiTyped.trim()) {
                  e.preventDefault();
                  nucleusSession.sendText(aiTyped.trim());
                  setAiTyped('');
                }
              }}
              placeholder={nucleusSession.status === 'live' ? 'Ask anything or type a command…' : 'Start AI session to type or speak'}
              disabled={nucleusSession.status !== 'live'}
              aria-label="Type a message to Nucleus AI"
            />
            <button
              type="button"
              className={styles.submitCommandBtn}
              onClick={() => { if (aiTyped.trim()) { nucleusSession.sendText(aiTyped.trim()); setAiTyped(''); } }}
              disabled={nucleusSession.status !== 'live' || !aiTyped.trim()}
            >
              <Send sx={{ fontSize: 16 }} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (inputText.trim()) executeCommand(inputText.trim()); }}
            style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '1rem' }}
          >
            <input
              type="text"
              className={styles.commandInput}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Speak or type any command…"
              aria-label="Nucleus Talk command input"
            />
            <button type="submit" className={styles.submitCommandBtn} disabled={!inputText.trim()}>
              <Send sx={{ fontSize: 16 }} />
            </button>
          </form>
        )}

        {/* ── Command chips ── */}
        <div style={{ width: '100%' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('instant')}
              style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '0.22rem 0.65rem', borderRadius: '5px',
                background: activeTab === 'instant' ? 'var(--signal-wash)' : 'transparent',
                color: activeTab === 'instant' ? 'var(--signal)' : 'var(--text-2)',
                border: activeTab === 'instant' ? '1px solid var(--line-glow)' : '1px solid transparent',
                cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              ⚡ Instant
            </button>
            <button
              onClick={() => { setActiveTab('ai'); if (!aiMode) switchToAI(); }}
              style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '0.22rem 0.65rem', borderRadius: '5px',
                background: activeTab === 'ai' ? 'var(--signal-wash)' : 'transparent',
                color: activeTab === 'ai' ? 'var(--signal)' : 'var(--text-2)',
                border: activeTab === 'ai' ? '1px solid var(--line-glow)' : '1px solid transparent',
                cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '3px',
              }}
            >
              <AutoAwesome sx={{ fontSize: 11 }} /> Nucleus AI
            </button>
          </div>

          <div className={styles.commandExamples}>
            {activeTab === 'instant'
              ? INSTANT_COMMANDS.map((cmd, i) => (
                  <button key={i} type="button" className={styles.exampleChip} onClick={() => executeCommand(cmd)}>
                    <VolumeUpOutlined sx={{ fontSize: 12, marginRight: '4px', color: 'var(--signal)' }} />
                    {cmd}
                  </button>
                ))
              : AI_COMMANDS.map((cmd, i) => (
                  <button key={i} type="button" className={styles.exampleChip} onClick={() => switchToAI(cmd)}
                    style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
                    <AutoAwesome sx={{ fontSize: 11, marginRight: '4px', color: '#8b5cf6' }} />
                    {cmd}
                  </button>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
