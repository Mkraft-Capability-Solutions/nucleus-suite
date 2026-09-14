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

import navigationCatalog from '@/config/ui/navigation.catalog.json';

export function parseVoiceCommand(text) {
  const query = text.toLowerCase().trim();

  // 1. Actions: Punch IN / Attendance Marking
  if (
    query.includes('punch in') ||
    query.includes('clock in') ||
    query.includes('start shift') ||
    query.includes('mark attendance') ||
    query.includes('check in') ||
    query === 'in'
  ) {
    return { type: 'ACTION', action: 'PUNCH_IN', speechText: 'Punching IN: Marking your attendance now' };
  }
  if (
    query.includes('punch out') ||
    query.includes('clock out') ||
    query.includes('end shift') ||
    query.includes('check out') ||
    query === 'out'
  ) {
    return { type: 'ACTION', action: 'PUNCH_OUT', speechText: 'Punching OUT: Attendance checkout recorded' };
  }

  // 2. Actions: Apply for Leave
  if (
    query.includes('apply for leave') ||
    query.includes('apply leave') ||
    query.includes('book leave') ||
    query.includes('request time off') ||
    query.includes('take leave') ||
    query.includes('book vacation') ||
    query.includes('sick leave') ||
    query.includes('casual leave') ||
    query.includes('earned leave') ||
    query.includes('maternity leave')
  ) {
    return { type: 'ACTION', action: 'APPLY_LEAVE', speechText: 'Opening Leave Application form' };
  }

  // 3. Consoles S1 through S10
  const consoleMatch = query.match(/\b(s10|s[1-9]|console\s*(10|[1-9]))\b/i);
  if (consoleMatch) {
    const raw = consoleMatch[1].replace(/\s+/g, '').replace('console', 's').toUpperCase();
    return { type: 'CONSOLE', target: raw, speechText: `Loading ${raw} Executive Console` };
  }

  // 4. Modals & Enterprise Workflows
  if (
    query.includes('bulk upload') ||
    query.includes('import') ||
    query.includes('upload employee') ||
    query.includes('import data') ||
    query.includes('excel upload')
  ) {
    return { type: 'MODAL', target: 'bulk_upload', speechText: 'Launching Enterprise Bulk Data Import' };
  }
  if (
    query.includes('ctc exception') ||
    query.includes('salary exception') ||
    query.includes('hike approval') ||
    query.includes('ctc approval') ||
    query.includes('offer approval')
  ) {
    return { type: 'MODAL', target: 'ctc_exception', speechText: 'Launching Talent CTC Exception Approval' };
  }
  if (
    query.includes('copilot') ||
    query.includes('ask ai') ||
    query.includes('ai assistant') ||
    query.includes('open ai') ||
    query.includes('ai drawer')
  ) {
    return { type: 'MODAL', target: 'copilot', speechText: 'Opening Nucleus AI Copilot' };
  }
  if (
    query.includes('chat') ||
    query.includes('messages') ||
    query.includes('team chat') ||
    query.includes('message drawer')
  ) {
    return { type: 'MODAL', target: 'chat', speechText: 'Opening Team Messages' };
  }
  if (
    query.includes('module') ||
    query.includes('all modules') ||
    query.includes('navigation dual') ||
    query.includes('site map')
  ) {
    return { type: 'MODAL', target: 'modules', speechText: 'Opening Dual-Pane Navigation System' };
  }

  // 5. Dynamic lookup against catalog items
  for (const domain of navigationCatalog.domains) {
    for (const group of domain.groups) {
      for (const item of group.items) {
        const itemLabel = item.label.toLowerCase();
        const itemId = item.id.toLowerCase().replace(/_/g, ' ');
        if (
          query.includes(itemLabel) ||
          query.includes(itemId) ||
          itemLabel.split(' ').every(word => word.length > 2 && query.includes(word))
        ) {
          const target = item.targetTab || item.id;
          return {
            type: 'TAB',
            target,
            domain: domain.id,
            sub: item.id,
            speechText: `Loading ${item.label}`
          };
        }
      }
    }
  }

  // 6. Keyword Fallback Mappings with Natural Voice Narrations
  if (query.includes('employee') || query.includes('people') || query.includes('directory') || query.includes('staff')) {
    return { type: 'TAB', target: 'people_core', domain: 'core_hr', speechText: 'Loading People Core Directory' };
  }
  if (query.includes('attendance') || query.includes('punch') || query.includes('shift') || query.includes('roster') || query.includes('biometric') || query.includes('regularize')) {
    return { type: 'TAB', target: 'attendance', domain: 'workforce_ops', speechText: 'Loading Attendance and Shift Rosters' };
  }
  if (query.includes('payroll') || query.includes('salary') || query.includes('payslip') || query.includes('wage') || query.includes('pay slip')) {
    return { type: 'TAB', target: 'payroll', domain: 'payroll_finance', speechText: 'Loading Payroll Control Room' };
  }
  if (query.includes('leave') || query.includes('holiday') || query.includes('vacation') || query.includes('time off')) {
    return { type: 'TAB', target: 'leaves', domain: 'core_hr', speechText: 'Loading Leave Management' };
  }
  if (query.includes('onboard') || query.includes('preboard') || query.includes('probation') || query.includes('exit') || query.includes('lifecycle')) {
    return { type: 'TAB', target: 'onboarding', domain: 'core_hr', speechText: 'Loading Onboarding and Lifecycle Portal' };
  }
  if (query.includes('talent') || query.includes('recruit') || query.includes('hiring') || query.includes('job') || query.includes('candidate') || query.includes('applicant') || query.includes('ats')) {
    return { type: 'TAB', target: 'recruitment', domain: 'talent', speechText: 'Loading Talent Acquisition and ATS' };
  }
  if (query.includes('performance') || query.includes('appraisal') || query.includes('9 box') || query.includes('nine box') || query.includes('okr') || query.includes('goal')) {
    return { type: 'TAB', target: 'performance', domain: 'talent', speechText: 'Loading Performance and 9-Box Grid' };
  }
  if (query.includes('learn') || query.includes('course') || query.includes('training') || query.includes('upskill') || query.includes('lms')) {
    return { type: 'TAB', target: 'learning', domain: 'talent', speechText: 'Loading Learning and Development Catalog' };
  }
  if (query.includes('compensation') || query.includes('benefit') || query.includes('fbp') || query.includes('tax') || query.includes('structure') || query.includes('claim')) {
    return { type: 'TAB', target: 'compensation', domain: 'payroll_finance', speechText: 'Loading Compensation and Benefits Planner' };
  }
  if (query.includes('experience') || query.includes('reward') || query.includes('recognition') || query.includes('kudos') || query.includes('badge')) {
    return { type: 'TAB', target: 'experience', domain: 'talent', speechText: 'Loading Employee Experience and Rewards' };
  }
  if (query.includes('compliance') || query.includes('statutory') || query.includes('form f') || query.includes('challan') || query.includes('pf') || query.includes('esic')) {
    return { type: 'TAB', target: 'compliance', domain: 'core_hr', speechText: 'Loading Statutory Compliance Hub' };
  }
  if (query.includes('helpdesk') || query.includes('ticket') || query.includes('grievance') || query.includes('support')) {
    return { type: 'TAB', target: 'helpdesk', domain: 'core_hr', speechText: 'Loading HR Helpdesk and Service Desk' };
  }
  if (query.includes('contract') || query.includes('vendor') || query.includes('agency') || query.includes('contractor') || query.includes('gig')) {
    return { type: 'TAB', target: 'contract_workforce', domain: 'workforce_ops', speechText: 'Loading Contract Workforce Management' };
  }
  if (query.includes('project') || query.includes('pod') || query.includes('timesheet') || query.includes('velocity')) {
    return { type: 'TAB', target: 'projects', domain: 'workforce_ops', speechText: 'Loading Projects and Pod Allocation' };
  }
  if (query.includes('organization') || query.includes('org chart') || query.includes('team') || query.includes('department')) {
    return { type: 'TAB', target: 'team', domain: 'core_hr', speechText: 'Loading Organization and Team Hierarchy' };
  }
  if (query.includes('analytics') || query.includes('metric') || query.includes('report') || query.includes('dashboard') || query.includes('kpi') || query.includes('radar')) {
    return { type: 'TAB', target: 'analytics', domain: 'analytics_ai', speechText: 'Loading People Analytics and Executive Radar' };
  }
  if (query.includes('access control') || query.includes('permission') || query.includes('security') || query.includes('role') || query.includes('rbac')) {
    return { type: 'TAB', target: 'access_control', domain: 'platform', speechText: 'Loading Security and Access Control' };
  }
  if (query.includes('setting') || query.includes('integration') || query.includes('configure') || query.includes('workflow')) {
    return { type: 'TAB', target: 'settings', domain: 'platform', speechText: 'Loading Platform Settings' };
  }

  return { type: 'UNKNOWN', speechText: `Opening ${text}` };
}

// Global speech synthesis runner (optimized for Chrome/Safari with natural voice fallback)
export function speakAloud(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    // Unlock and resume speech synthesis
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const naturalVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Daniel') ||
                v.name.includes('Premium'))
          );
          if (naturalVoice) {
            utterance.voice = naturalVoice;
          } else {
            const enVoice = voices.find((v) => v.lang.startsWith('en'));
            if (enVoice) utterance.voice = enVoice;
          }
        }

        // Store reference to prevent GC from killing audio mid-sentence
        window.__nucleusSpeech = utterance;
        utterance.onend = () => {
          window.__nucleusSpeech = null;
        };
        utterance.onerror = () => {
          window.__nucleusSpeech = null;
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('SpeechSynthesis inner error:', e);
      }
    }, 40);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
  }
}

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

