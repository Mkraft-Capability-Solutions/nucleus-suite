import { describe, it, expect } from 'vitest';
import { parseVoiceCommand, speakAloud, getTimeGreeting } from '@/utils/voiceCommandEngine';

describe('Nucleus Talk Voice Navigator Action & Parsing Engine', () => {
  it('should parse punch in action and set speech narration', () => {
    const res = parseVoiceCommand('punch in');
    expect(res.type).toBe('ACTION');
    expect(res.action).toBe('PUNCH_IN');
    expect(res.speechText).toBe('Punching IN: Marking your attendance now');
  });

  it('should parse punch out action and set speech narration', () => {
    const res = parseVoiceCommand('clock out');
    expect(res.type).toBe('ACTION');
    expect(res.action).toBe('PUNCH_OUT');
    expect(res.speechText).toBe('Punching OUT: Attendance checkout recorded');
  });

  it('should parse apply leave action and set speech narration', () => {
    const res = parseVoiceCommand('apply for leave');
    expect(res.type).toBe('ACTION');
    expect(res.action).toBe('APPLY_LEAVE');
    expect(res.speechText).toBe('Opening Leave Application form');
  });

  it('should parse attendance tab and set speech narration', () => {
    const res = parseVoiceCommand('go to attendance');
    expect(res.type).toBe('TAB');
    expect(res.target).toBe('attendance');
    expect(res.speechText).toBe('Loading Attendance and Shift Rosters');
  });

  it('should parse payroll tab and set speech narration', () => {
    const res = parseVoiceCommand('open payroll control room');
    expect(res.type).toBe('TAB');
    expect(res.target).toBe('payroll');
    expect(res.speechText).toBe('Loading Payroll Control Room');
  });

  it('should parse executive consoles S1 through S10', () => {
    const res = parseVoiceCommand('switch to S1 console');
    expect(res.type).toBe('CONSOLE');
    expect(res.target).toBe('S1');
    expect(res.speechText).toBe('Loading S1 Executive Console');
  });

  it('should parse bulk upload modal', () => {
    const res = parseVoiceCommand('launch bulk data upload');
    expect(res.type).toBe('MODAL');
    expect(res.target).toBe('bulk_upload');
    expect(res.speechText).toBe('Launching Enterprise Bulk Data Import');
  });

  it('should parse AI copilot drawer', () => {
    const res = parseVoiceCommand('open ai copilot');
    expect(res.type).toBe('MODAL');
    expect(res.target).toBe('copilot');
    expect(res.speechText).toBe('Opening Nucleus AI Copilot');
  });

  it('should parse talent acquisition ATS', () => {
    const res = parseVoiceCommand('open talent ats');
    expect(res.type).toBe('TAB');
    expect(res.target).toBe('recruitment');
    expect(res.speechText).toBe('Loading Talent ATS');
  });

  it('should parse 9-box performance grid', () => {
    const res = parseVoiceCommand('show 9-box performance grid');
    expect(res.type).toBe('TAB');
    expect(res.target).toBe('performance');
    expect(res.speechText).toBe('Loading Performance and 9-Box Grid');
  });

  it('should parse statutory compliance command', () => {
    const res = parseVoiceCommand('statutory compliance');
    expect(res.type).toBe('TAB');
    expect(res.target).toBe('compliance');
    expect(res.speechText).toBe('Loading Statutory Compliance');
  });

  it('should parse dual pane modules command', () => {
    const res = parseVoiceCommand('open dual pane modules');
    expect(res.type).toBe('MODAL');
    expect(res.target).toBe('modules');
    expect(res.speechText).toBe('Opening Dual-Pane Navigation System');
  });

  it('should parse team messages command', () => {
    const res = parseVoiceCommand('open team chat messages');
    expect(res.type).toBe('MODAL');
    expect(res.target).toBe('chat');
    expect(res.speechText).toBe('Opening Team Messages');
  });

  it('should generate personalized time-aware greeting', () => {
    const greeting = getTimeGreeting('Superadmin');
    expect(greeting).toMatch(/(Good morning|Good afternoon|Good evening), Superadmin! How can I help you today\?/);
  });

  it('should generate greeting with fallback name if undefined', () => {
    const greeting = getTimeGreeting(undefined);
    expect(greeting).toMatch(/(Good morning|Good afternoon|Good evening), Superadmin! How can I help you today\?/);
  });
});
