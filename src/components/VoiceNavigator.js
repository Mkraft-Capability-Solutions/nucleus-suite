"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import Close from '@mui/icons-material/Close';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Send from '@mui/icons-material/Send';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import VolumeUpOutlined from '@mui/icons-material/VolumeUpOutlined';
import styles from './VoiceNavigator.module.css';

import { parseVoiceCommand, speakAloud } from '@/utils/voiceCommandEngine';

export default function VoiceNavigator({ isOpen, onClose, onNavigate, onSelectConsole, onOpenModal }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('Click the microphone or speak any command below.');
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

    // Announce action aloud immediately
    speakAloud(result.speechText);

    // Stop recognition when executing command
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);

    setTimeout(() => {
      if (result.type === 'ACTION') {
        if (result.action === 'PUNCH_IN') {
          window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'IN' } }));
        } else if (result.action === 'PUNCH_OUT') {
          window.dispatchEvent(new CustomEvent('nucleus:trigger_punch', { detail: { type: 'OUT' } }));
        } else if (result.action === 'APPLY_LEAVE') {
          if (onNavigate) onNavigate('leaves', 'core_hr');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('nucleus:open_leave_apply'));
          }, 350);
        }
        onClose();
      } else if (result.type === 'CONSOLE' && onSelectConsole) {
        onSelectConsole(result.target);
        onClose();
      } else if (result.type === 'TAB' && onNavigate) {
        onNavigate(result.target, result.domain, result.sub);
        onClose();
      } else if (result.type === 'MODAL' && onOpenModal) {
        onOpenModal(result.target);
        onClose();
      } else {
        if (onNavigate) onNavigate('people_core', 'core_hr');
        onClose();
      }
    }, 900);
  }, [onClose, onNavigate, onSelectConsole, onOpenModal]);

  const startListening = () => {
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
        setFeedback('🎙️ Nucleus Voice Assist is listening... Speak now into your microphone.');
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

          // Clear any previous debounce timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Auto-execute if final or after 1.2s of silence
          if (isFinal) {
            executeCommand(clean);
          } else {
            silenceTimerRef.current = setTimeout(() => {
              executeCommand(clean);
            }, 1200);
          }
        }
      };

      recognition.onspeechend = () => {
        // Speech ended
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          setFeedback('Nucleus Voice Assist: No speech detected. Click the mic and speak clearly.');
        } else {
          setIsListening(false);
          setFeedback('Nucleus Voice Assist: Ready. Click the microphone, speak, or type below.');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      setFeedback('Click the microphone to activate Nucleus Voice Assist, or type any command.');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      if (inputText.trim()) {
        executeCommand(inputText.trim());
      } else {
        setFeedback('Nucleus Voice Assist paused. Click the microphone to speak again.');
      }
    } else {
      startListening();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      setTranscript('');
      setInputText('');
      setFeedback('Click the microphone or speak any command below.');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      return;
    }

    setFeedback('Click the microphone or speak any command below.');

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [isOpen]);

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
        <button className={styles.closeVoiceBtn} onClick={onClose} title="Close Nucleus Voice Assist">
          <Close sx={{ fontSize: 18 }} />
        </button>

        {/* Pulsating Interactive Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`${styles.micActionBtn} ${isListening ? styles.micPulsing : ''}`}
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: isListening ? 'var(--signal, #7c3aed)' : 'var(--card-2, #f8fafc)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isListening ? 'var(--on-signal, #ffffff)' : 'var(--signal, #7c3aed)',
            border: '2px solid var(--signal, #7c3aed)',
            cursor: 'pointer',
            boxShadow: isListening ? '0 0 24px var(--signal, #7c3aed)' : 'var(--shadow-subtle)',
            transition: 'all 0.25s ease',
            margin: '0.25rem auto 0'
          }}
          title={isListening ? "Nucleus Voice Assist listening... Click to Stop" : "Click to Speak"}
        >
          {isListening ? <Mic sx={{ fontSize: 34 }} /> : <Mic sx={{ fontSize: 34 }} />}
        </button>

        <h3 style={{ margin: '0.85rem 0 0.25rem', fontSize: '1.35rem', color: 'var(--text, #0f172a)', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Nucleus Talk
        </h3>
        
        <p style={{ 
          margin: '0 0 0.75rem', 
          fontSize: '0.84rem', 
          color: 'var(--text-2, #64748b)', 
          maxWidth: '440px', 
          lineHeight: 1.45
        }}>
          {feedback}
        </p>

        {isListening && (
          <div className={styles.voiceWaveform}>
            <div className={styles.waveBar}></div>
            <div className={styles.waveBar}></div>
            <div className={styles.waveBar}></div>
            <div className={styles.waveBar}></div>
            <div className={styles.waveBar}></div>
          </div>
        )}

        {/* Action / Natural Language Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (inputText.trim()) executeCommand(inputText.trim());
          }}
          style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '1rem' }}
        >
          <input
            type="text"
            className={styles.commandInput}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Nucleus Voice Assist: Speak or type any action...'
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
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-2, #64748b)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                <VolumeUpOutlined sx={{ fontSize: 13, marginRight: '4px', color: 'var(--signal)' }} />
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

