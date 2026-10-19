'use client';

/**
 * useDemoBooking: month view, date and slot, the details form with validation, and the real POST to the demo API
 * (submit-demo.ts) with success and error states. Dates follow the active locale; the message sent to the sales team
 * stays English whatever language the visitor reads.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react';
import { activeLocale, formatDate } from '../i18n/format.js';
import { landingText } from '../i18n/landing-text';
import { submitDemo } from './submit-demo';

export const CONTACT_EMAIL = 'consult@multiplierskraft.com';
export const CONTACT_PHONE = { display: '+91-9611058522', tel: '+919611058522' } as const;
export const DEMO_SLOTS = ['10:00 AM', '11:30 AM', '2:00 PM', '4:00 PM', '5:30 PM'] as const;
/** Must match the server's demo schema. */
export const TEAM_SIZES = ['1–50', '51–200', '201–500', '500+'] as const;
export const FOCUS_IDS = ['full', 'attendance', 'performance', 'volt'] as const;
export type FocusId = (typeof FOCUS_IDS)[number];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };

export interface DemoForm {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly teamSize: string;
  readonly focus: FocusId;
}
type Field = keyof DemoForm;
type Invalid = Partial<Record<'name' | 'email' | 'company', boolean>>;

const EMPTY_FORM: DemoForm = { name: '', email: '', company: '', teamSize: '201–500', focus: 'full' };

const longDate = (date: Date, code?: string): string => formatDate(date, LONG_DATE, code);

/** A slot ("2:00 PM", IST) in the active locale's time format; English keeps the slot as written. */
export function slotLabel(slot: string, code: string = activeLocale()): string {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(slot);
  if (code === 'en' || !match) return slot;
  const hour = (Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0);
  return formatDate(new Date(2026, 0, 1, hour, Number(match[2])), { hour: 'numeric', minute: '2-digit' }, code);
}

/** Narrow weekday names, Sunday first (4 January 2026 is a Sunday). */
export function weekdayNames(): readonly string[] {
  return Array.from({ length: 7 }, (entry, index) => formatDate(new Date(2026, 0, 4 + index), { weekday: 'narrow' }));
}

/** Slots offered on a date (varies by date so the picker reads like a live calendar). */
export function slotsFor(date: Date): readonly string[] {
  return DEMO_SLOTS.filter((entry, index) => (date.getDate() + index) % 4 !== 0);
}

/** Message for the sales team (always English). */
export function demoMessage(date: Date, slot: string, focus: FocusId): string {
  const english = landingText();
  return `Preferred slot: ${longDate(date, 'en')} ${String(date.getFullYear())} at ${slot} IST.\nFocus: ${english(`demo.focusAreas.${focus}`)}.`;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export interface DayCell {
  readonly day: number;
  readonly date: Date;
  readonly open: boolean;
  readonly chosen: boolean;
  readonly label: string;
}

export interface DemoBooking {
  readonly date: Date | null;
  readonly slot: string | null;
  readonly step: 0 | 1 | 2;
  readonly form: DemoForm;
  readonly invalid: Invalid;
  readonly busy: boolean;
  readonly error: string;
  readonly firstOfMonth: number;
  readonly days: readonly DayCell[];
  readonly atCurrentMonth: boolean;
  readonly monthLabel: string;
  readonly slots: readonly string[];
  readonly dateLabel: string;
  readonly summary: string;
  readonly firstName: string;
  readonly shiftMonth: (delta: number) => void;
  readonly pickDate: (date: Date) => void;
  readonly setSlot: (slot: string) => void;
  readonly next: () => void;
  readonly back: () => void;
  readonly field: (key: Field) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  readonly submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export interface DemoMessages {
  readonly invalid: string;
  readonly failed: string;
}

/** `firstField` receives focus when the details step opens. */
export function useDemoBooking(messages: DemoMessages, firstField: RefObject<HTMLInputElement | null>): DemoBooking {
  const today = useMemo(() => startOfToday(), []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<DemoForm>(EMPTY_FORM);
  const [invalid, setInvalid] = useState<Invalid>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (step === 1) firstField.current?.focus({ preventScroll: true });
  }, [step, firstField]);

  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const days: DayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = new Date(view.getFullYear(), view.getMonth(), day);
    days.push({ day, date: cell, open: cell > today && cell.getDay() % 6 !== 0, chosen: date !== null && +cell === +date, label: longDate(cell) });
  }

  const field =
    (key: Field) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const { value } = event.target;
      setForm((previous) => ({ ...previous, [key]: value }));
      setInvalid((previous) => ({ ...previous, [key]: false }));
    };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || !date || !slot) return;
    const problems: Invalid = { name: !form.name.trim(), email: !EMAIL.test(form.email.trim()), company: !form.company.trim() };
    setInvalid(problems);
    if (problems.name || problems.email || problems.company) {
      setError(messages.invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitDemo({ name: form.name.trim(), email: form.email.trim(), company: form.company.trim(), teamSize: form.teamSize, message: demoMessage(date, slot, form.focus) });
      if (alive.current) setStep(2);
    } catch {
      // One localized message for every failure (network, timeout, server); details stay out of the UI.
      if (alive.current) setError(messages.failed);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return {
    date,
    slot,
    step,
    form,
    invalid,
    busy,
    error,
    firstOfMonth: view.getDay(),
    days,
    atCurrentMonth: view <= new Date(today.getFullYear(), today.getMonth(), 1),
    monthLabel: formatDate(view, { month: 'long', year: 'numeric' }),
    slots: date ? slotsFor(date) : [],
    dateLabel: date ? longDate(date) : '',
    summary: date && slot ? `${formatDate(date, { day: 'numeric', month: 'short' })}, ${slotLabel(slot)}` : '',
    firstName: form.name.trim().split(' ')[0] ?? '',
    shiftMonth: (delta) => {
      setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
    },
    pickDate: (next) => {
      setDate(next);
      setSlot(null);
    },
    setSlot,
    next: () => {
      setStep(1);
    },
    back: () => {
      setError('');
      setStep(0);
    },
    field,
    submit,
  };
}
