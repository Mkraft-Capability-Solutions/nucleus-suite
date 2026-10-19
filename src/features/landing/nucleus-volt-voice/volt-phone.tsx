'use client';

/**
 * VoltPhone: one Volt screen (the phone mock-up) for a scenario at a playback "beat": the spoken command appears word by
 * word (two characters at a time in scripts without spaces), then each step shows with a spinner and ticks, then the
 * result and its three numbers. The mic button replays the scenario. Pure: the same props render the inline screen and
 * the enlarged dialog copy.
 */
import type { ReactNode } from 'react';
import { Check, Mic, Zap } from 'lucide-react';
import { formatNumber } from '../i18n/format.js';
import type { LandingText } from '../i18n/landing-text';

export const VOLT_SCENARIOS = [
  { id: 'approve', numbers: [6, 4, 2] },
  { id: 'onboard', numbers: [5, 3, 0] },
  { id: 'attendance', numbers: [5, 2, 1] },
] as const;
export type VoltScenario = (typeof VOLT_SCENARIOS)[number];
const STEP_IDS = ['a', 'b', 'c', 'd', 'e'] as const;
const NUMBER_IDS = ['a', 'b', 'c'] as const;
export const WAVE_BARS = 28;

const WORD_MS = 115;
const STEP_MS = 600;
const TICK_MS = 520;
const RESULT_MS = 220;

/** Growing prefixes of the spoken command: word by word, or two characters at a time without spaces (zh, ja). */
export function typingSteps(text: string): readonly string[] {
  if (/\s/.test(text.trim())) {
    const words = text.split(' ');
    return words.map((entry, index) => words.slice(0, index + 1).join(' '));
  }
  const chars = Array.from(text);
  const steps: string[] = [];
  for (let index = 2; index < chars.length + 2; index += 2) steps.push(chars.slice(0, Math.min(index, chars.length)).join(''));
  return steps;
}

/** Event times (ms after the scenario starts) of every beat: words, then step shown / step done pairs, then result. */
export function beatTimes(said: string): readonly number[] {
  const words = typingSteps(said).length;
  const times: number[] = [];
  for (let index = 0; index < words; index++) times.push(index * WORD_MS);
  const sayEnd = words * WORD_MS;
  STEP_IDS.forEach((entry, index) => {
    times.push(sayEnd + index * STEP_MS, sayEnd + index * STEP_MS + TICK_MS);
  });
  times.push(sayEnd + STEP_IDS.length * STEP_MS + RESULT_MS);
  return times;
}

export interface VoltPhoneProps {
  readonly t: LandingText;
  readonly scenario: VoltScenario;
  /** Beats elapsed (0 … beatTimes(said).length). */
  readonly beat: number;
  readonly large?: boolean;
  /** The mic button: replay the current scenario from the start. */
  readonly onReplay: () => void;
}

export function VoltPhone({ t, scenario, beat, large = false, onReplay }: VoltPhoneProps): ReactNode {
  const said = t(`volt.scenarios.${scenario.id}.said`);
  const prefixes = typingSteps(said);
  const words = Math.min(beat, prefixes.length);
  const listening = words < prefixes.length;
  const stepBeats = Math.max(0, beat - prefixes.length);
  const shown = Math.min(STEP_IDS.length, Math.ceil(stepBeats / 2));
  const done = Math.min(STEP_IDS.length, Math.floor(stepBeats / 2));
  const result = stepBeats > STEP_IDS.length * 2;
  const phase = result ? 'done' : listening ? (words === 0 ? 'ready' : 'listening') : 'working';
  return (
    <div className={large ? 'phone phone-large' : 'phone'}>
      <div className="notch" aria-hidden="true" />
      <div className="ph-top">
        <b>
          <Zap aria-hidden="true" />
          {t('volt.brandName')}
        </b>
        <span>{t(`volt.phase.${phase}`)}</span>
      </div>
      <div className="ph-body">
        <p className="ph-said">
          {words > 0 ? prefixes[words - 1] : <span className="ph-idle">{t('volt.idle')}</span>}
          {listening && words > 0 ? <span className="cur" aria-hidden="true" /> : null}
        </p>
        <ul className="ph-steps">
          {STEP_IDS.map((id, index) => (
            <li key={id} className={index < done ? 'show done' : index < shown ? 'show' : undefined} aria-hidden={index < shown ? undefined : true}>
              <span className="sp">
                <Check aria-hidden="true" />
              </span>
              {t(`volt.scenarios.${scenario.id}.steps.${id}`)}
            </li>
          ))}
        </ul>
        <div className={result ? 'ph-res show' : 'ph-res'} aria-hidden={result ? undefined : true}>
          {
            <>
              <b>{t(`volt.scenarios.${scenario.id}.result`)}</b>
              <span>{t('volt.logged')}</span>
              <div className="nums">
                {NUMBER_IDS.map((id, index) => (
                  <div key={id}>
                    <b>{formatNumber(scenario.numbers[index] ?? 0)}</b>
                    <span>{t(`volt.scenarios.${scenario.id}.numbers.${id}`)}</span>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      </div>
      <div className="ph-bot">
        <div className={listening && words > 0 ? 'ph-wave live' : 'ph-wave'} aria-hidden="true">
          {Array.from({ length: WAVE_BARS }, (entry, index) => (
            <i key={index} />
          ))}
        </div>
        <button type="button" className={listening && words > 0 ? 'ph-mic on' : 'ph-mic'} aria-label={t('volt.run')} onClick={onReplay}>
          <Mic aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
