/**
 * Nucleus Talk — Voice Command Parsing & Speech Synthesis Engine
 * Parses natural language input and voice utterances into structured action objects
 * with corresponding audio speech narrations.
 */

import navigationCatalog from '@/config/ui/navigation.catalog.json';

export interface VoiceCommandResult {
  type: 'ACTION' | 'CONSOLE' | 'TAB' | 'MODAL' | 'UNKNOWN';
  action?: 'PUNCH_IN' | 'PUNCH_OUT' | 'APPLY_LEAVE';
  target?: string;
  domain?: string;
  sub?: string;
  speechText: string;
}

export function parseVoiceCommand(text: string): VoiceCommandResult {
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
    query.includes('bulk data upload') ||
    (query.includes('bulk') && query.includes('upload')) ||
    query.includes('import data') ||
    query.includes('upload employee') ||
    query.includes('excel upload') ||
    query.includes('csv upload') ||
    query.includes('import')
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
    query.includes('ai drawer') ||
    query.includes('nucleus ai')
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
    query.includes('dual pane') ||
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

// Global speech synthesis runner (optimized for Chrome/Safari/Edge with natural voice fallback)
export function speakAloud(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    // 1. Immediately cancel any stale utterance and resume synthesis
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // 2. Schedule speaking with clean AudioContext tick
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
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
                v.name.includes('Karen') ||
                v.name.includes('Premium') ||
                v.name.includes('US English') ||
                v.name.includes('en-US'))
          );
          if (naturalVoice) {
            utterance.voice = naturalVoice;
          } else {
            const enVoice = voices.find((v) => v.lang.startsWith('en'));
            if (enVoice) utterance.voice = enVoice;
          }
        }

        // Store reference to prevent GC from killing audio mid-sentence
        (window as any).__nucleusSpeech = utterance;
        utterance.onend = () => {
          (window as any).__nucleusSpeech = null;
        };
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis utterance error:', e);
          (window as any).__nucleusSpeech = null;
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('SpeechSynthesis inner error:', e);
      }
    }, 50);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
  }
}
