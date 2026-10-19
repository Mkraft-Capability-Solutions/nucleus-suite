'use client';

/**
 * The copilot's answers for the three AI scenarios: the review checker reading (highlights, clarity meter, findings),
 * the pulse themes with their digest, and the weekly digest. Sample figures are illustrative (CONFIRM in the
 * reference build). Every row is a [data-result-item] so CSS can stagger the answer in.
 */
import { Fragment, type ReactNode } from 'react';
import { formatNumber } from '../i18n/format.js';
import type { LandingKey, LandingText, TagRenderer } from '../i18n/landing-text';
import { MeterFill } from '../section-kit/meter-fill';
import { scoreTone, type ReviewResult } from './review-rules';

export const PULSE_COMMENTS = 128;
const BOLD: Readonly<Record<string, TagRenderer>> = { b: (children, key) => <b key={key}>{children}</b> };

interface DigestRow {
  readonly id: string;
  readonly n: string;
  readonly tone?: 'up' | 'down';
  readonly key: LandingKey;
  readonly action?: LandingKey;
}

const PULSE_THEMES = [
  { id: 'workload', trend: 'down', level: 72 },
  { id: 'clarity', trend: 'flat', level: 48 },
  { id: 'recognition', trend: 'up', level: 64 },
] as const;

const PULSE_DIGEST: readonly DigestRow[] = [
  { id: 'themes', n: '3', key: 'ai.pulse.digest.themes' },
  { id: 'falling', n: '↓', tone: 'down', key: 'ai.pulse.digest.falling' },
  { id: 'working', n: '↑', tone: 'up', key: 'ai.pulse.digest.working' },
];
const WEEKLY_DIGEST: readonly DigestRow[] = [
  { id: 'goals', n: '9', key: 'ai.weekly.goals', action: 'ai.weekly.review' },
  { id: 'reviews', n: '4', key: 'ai.weekly.reviews', action: 'ai.weekly.nudge' },
  { id: 'dip', n: '1', tone: 'down', key: 'ai.weekly.dip', action: 'ai.weekly.open' },
];
const WEEKLY_HANDLED: readonly DigestRow[] = [
  { id: 'leave', n: '31', tone: 'up', key: 'ai.weekly.leave' },
  { id: 'punches', n: '12', tone: 'up', key: 'ai.weekly.punches' },
  { id: 'joiners', n: '3', tone: 'up', key: 'ai.weekly.joiners' },
];

function DigestList({ t, rows }: { readonly t: LandingText; readonly rows: readonly DigestRow[] }): ReactNode {
  return (
    <div className="digest">
      {rows.map((row) => (
        <div className="dg" key={row.id} data-result-item="">
          <div className={row.tone ? `n n-${row.tone}` : 'n'}>{/^\d+$/.test(row.n) ? formatNumber(Number(row.n)) : row.n}</div>
          <p>{t.rich(row.key, BOLD, { count: PULSE_COMMENTS })}</p>
          {row.action ? <span className="dg-action">{t(row.action)}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function ReviewReading({ t, result, text }: { readonly t: LandingText; readonly result: ReviewResult; readonly text: string }): ReactNode {
  const tone = scoreTone(result.score);
  return (
    <>
      <div className="lbl" data-result-item="">
        <span>{t('ai.review.reads')}</span>
      </div>
      <div className="read" data-result-item="">
        {text
          ? result.segments.map((segment, index) => (segment.mark ? <mark key={index}>{segment.text}</mark> : <Fragment key={index}>{segment.text}</Fragment>))
          : <span className="read-ph">{t('ai.review.placeholder')}</span>}
      </div>
      <div className={`score score-${tone}`} data-result-item="">
        <span className="score-l">{t('ai.review.clarity')}</span>
        <div className="meter">
          <MeterFill value={result.score} />
        </div>
        <b>{formatNumber(result.score)}</b>
      </div>
      <div className="flags" aria-live="polite">
        {result.flags.map((flag) => (
          <div className="flag" key={flag.id} data-result-item="">
            <b>{flag.name}</b> {flag.tip}
          </div>
        ))}
        {result.flags.length > 0 && !result.hasEvidence ? (
          <div className="flag" data-result-item="">
            {t.rich('ai.review.noEvidence', BOLD)}
          </div>
        ) : null}
        {result.flags.length === 0 && text.trim() ? (
          <div className="flag ok" data-result-item="">
            {t.rich('ai.review.clear', BOLD)}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function PulseAnswer({ t }: { readonly t: LandingText }): ReactNode {
  return (
    <>
      <div className="lbl" data-result-item="">
        <span>{t('ai.pulse.label')}</span>
        <em>{t('ai.pulse.count', { count: PULSE_COMMENTS })}</em>
      </div>
      <div className="themes">
        {PULSE_THEMES.map((theme) => (
          <div className="theme" key={theme.id} data-result-item="">
            <div className="top">
              {t(`ai.pulse.themes.${theme.id}.name`)}
              <span className={theme.trend}>{t(`ai.pulse.trends.${theme.trend}`)}</span>
            </div>
            <p className="q2">{t(`ai.pulse.themes.${theme.id}.quote`)}</p>
            <div className={`bar bar-${theme.trend}`}>
              <MeterFill value={theme.level} />
            </div>
          </div>
        ))}
      </div>
      <div className="lbl" data-result-item="">
        <span>{t('ai.pulse.tells')}</span>
      </div>
      <DigestList t={t} rows={PULSE_DIGEST} />
    </>
  );
}

export function WeeklyAnswer({ t }: { readonly t: LandingText }): ReactNode {
  return (
    <>
      <div className="lbl" data-result-item="">
        <span>{t('ai.weekly.label')}</span>
      </div>
      <DigestList t={t} rows={WEEKLY_DIGEST} />
      <div className="lbl" data-result-item="">
        <span>{t('ai.weekly.handled')}</span>
        <em>{t('ai.weekly.noAction')}</em>
      </div>
      <DigestList t={t} rows={WEEKLY_HANDLED} />
    </>
  );
}
