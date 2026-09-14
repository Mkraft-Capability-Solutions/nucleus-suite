"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import Close from '@mui/icons-material/Close';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Send from '@mui/icons-material/Send';
import VolumeUpOutlined from '@mui/icons-material/VolumeUpOutlined';
import AnimatedNucleusLogo from '@/components/AnimatedNucleusLogo';
import { useAuth } from '@/context/AuthContext';
import styles from './VoiceNavigator.module.css';

import { parseVoiceCommand, speakAloud, getTimeGreeting } from '@/utils/voiceCommandEngine';

export default function VoiceNavigator({ isOpen, onClose, onNavigate, onSelectConsole, onOpenModal }) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('');
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Preload voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
  }, []);

  const executeCommand = useCallback((cmdText) => {
    if (!cmdText || !cmdText.trim()) return;
    const cleanCmd = cmdText.trim();
    const result = parseVoiceCommand(cleanCmd);
    setTranscript(cleanCmd);
    setInputText(cleanCmd);
    setFeedback(result.speechText);
    setIsSpeaking(true);

    // Stop recognition during command execution
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);

    // 1. Announce action aloud with voice narration
    speakAloud(result.speechText, () => {
      setIsSpeaking(false);
    });

    // 2. Execute Action IMMEDIATELY
    if (result.type === 'ACTION') {
      if (result.action === 'PUNCH_IN') {
        window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'IN' } }));
      } else if (result.action === 'PUNCH_OUT') {
        window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'OUT' } }));
      } else if (result.action === 'APPLY_LEAVE') {
        try { sessionStorage.setItem('nucleus:auto_open_leave_apply', 'true'); } catch {}
        if (onNavigate) onNavigate('leaves', 'core_hr');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply'));
        }, 150);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply'));
        }, 500);
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

    // 3. Smooth visual confirmation before closing modal
    setTimeout(() => {
      onClose();
    }, 650);
  }, [onClose, onNavigate, onSelectConsole, onOpenModal]);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setFeedback('Speech recognition is not supported in this browser. You can type any command or click shortcuts below.');
      return;
    }

    try {
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
      };

      recognition.onresult = (event) => {
        let textResult = '';
        let isFinal = false;

        for (let i = 0; i < event.results.length; i++) {
          textResult += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }

        const clean = textResult.trim();
        if (clean) {
          setTranscript(clean);
          setInputText(clean);
          setFeedback(`Heard: "${clean}"`);

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Exact 1.0 second (1000ms) pause triggers action execution
          if (isFinal) {
            executeCommand(clean);
          } else {
            silenceTimerRef.current = setTimeout(() => {
              executeCommand(clean);
            }, 1000);
          }
        }
      };

      recognition.onspeechend = () => {};

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          // Keep waiting for user speech
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
    }
  }, [executeCommand]);

  const toggleListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      if (inputText.trim()) {
        executeCommand(inputText.trim());
      }
    } else {
      startListening();
    }
  };

  // On modal open: Greet user personalized with local time and name
  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      setIsSpeaking(false);
      setTranscript('');
      setInputText('');
      setFeedback('');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      return;
    }

    const greeting = getTimeGreeting(user?.name);
    setFeedback(greeting);
    setIsSpeaking(true);

    // Speak greeting aloud
    speakAloud(greeting, () => {
      setIsSpeaking(false);
    });

    // Start microphone listening
    const startMicTimer = setTimeout(() => {
      startListening();
    }, 350);

    return () => {
      clearTimeout(startMicTimer);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [isOpen, user?.name, startListening]);

  if (!isOpen) return null;

  const exampleCommands = [
    'Apply for Leave',
    'Punch In',
    'Punch Out',
    'Go to Attendance',
    'Open Payroll Control Room',
    'Show People Directory',
    'Switch to S1 Console',
    'Open Talent ATS',
    'Show 9-Box Performance Grid',
    'Launch Bulk Data Upload',
    'CTC Exception Approval',
    'Open AI Copilot',
    'Open Statutory Compliance',
    'Go to Platform Settings'
  ];

  return (
    <div className={styles.voiceModalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.voiceModalContainer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeVoiceBtn} onClick={onClose} title="Close Nucleus Talk">
          <Close sx={{ fontSize: 16 }} />
        </button>

        {/* Exact Pure CSS/SVG Animated Circular Nucleus Logo */}
        <div className={styles.logoWrapper}>
          <AnimatedNucleusLogo 
            size={96} 
            isListening={isListening} 
            isSpeaking={isSpeaking} 
            onClick={toggleListening} 
          />
        </div>

        <h3 style={{ 
          margin: '0.1rem 0 0.35rem', 
          fontSize: '1.35rem', 
          color: 'var(--text, #0f172a)', 
          fontWeight: 800, 
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          Nucleus Talk
          <AutoAwesome sx={{ fontSize: 18, color: '#8b5cf6' }} />
        </h3>
        
        <p style={{ 
          margin: '0 0 0.65rem', 
          fontSize: '0.9rem', 
          color: 'var(--text-2, #64748b)', 
          maxWidth: '440px', 
          lineHeight: 1.4,
          fontWeight: 500
        }}>
          {feedback || 'Click logo or speak any command below.'}
        </p>

        {/* Real-Time User Speech Live Command Bubble */}
        <div className={styles.liveCommandBubble}>
          {transcript ? (
            <span>🗣️ "{transcript}"</span>
          ) : isListening ? (
            <span className={styles.listeningText}>🎙️ Listening... Speak now (e.g. "Apply for Leave", "Punch In")</span>
          ) : (
            <span className={styles.listeningText}>Tap microphone or select a command below</span>
          )}
        </div>

        {/* Action / Natural Language Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (inputText.trim()) executeCommand(inputText.trim());
          }}
          style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '1.1rem' }}
        >
          <input
            type="text"
            className={styles.commandInput}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Speak or type any action...'
            aria-label="Nucleus Voice Assist command input"
          />
          <button 
            type="submit" 
            className={styles.submitCommandBtn}
            disabled={!inputText.trim()}
            title="Execute Action with Nucleus Talk"
          >
            <Send sx={{ fontSize: 16 }} />
          </button>
        </form>

        <div style={{ width: '100%' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2, #64748b)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Instant Action Shortcuts (Click to Announce & Execute)
          </div>
          <div className={styles.commandExamples}>
            {exampleCommands.map((cmd, i) => (
              <button
                key={i}
                type="button"
                className={styles.exampleChip}
                onClick={() => executeCommand(cmd)}
              >
                <VolumeUpOutlined sx={{ fontSize: 13, marginRight: '5px', color: 'var(--signal, #7c3aed)' }} />
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
