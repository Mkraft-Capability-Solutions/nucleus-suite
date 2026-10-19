/**
 * Section 4 · Numbers (server-rendered): four figures on the 12-column grid (3 columns each) with gradient digits that
 * count up with the section's entry progress (NumbersMotion).
 */
import type { ReactNode } from 'react';
import { SectionHeading } from '../components/section-heading';
import { formatNumber } from '../i18n/format.js';
import type { LandingText } from '../i18n/landing-text';
import { NumbersMotion } from '../numbers/numbers-motion';

const FIGURES = [
  { id: 'modules', value: 8 },
  { id: 'zero', value: 0 },
  { id: 'minutes', value: 15 },
  { id: 'sentence', value: 1 },
] as const;

export function Numbers({ t }: { readonly t: LandingText }): ReactNode {
  return (
    <NumbersMotion>
      <div className="lp-glow lp-glow-end" data-parallax-glow="0.2" aria-hidden="true" />
      <div className="lp-wrap">
        <SectionHeading text={t('numbers.title')} id="numbers-title" className="lp-h2 visually-hidden" />
        <dl className="lp-grid lp-numbers-grid">
          {FIGURES.map((figure) => (
            <div key={figure.id} className="lp-figure" data-reveal-item="">
              <dt className="lp-figure-label">{t(`numbers.${figure.id}`)}</dt>
              <dd className="lp-figure-value">
                <span data-count={figure.value} data-unit={figure.id === 'minutes' ? 'minutes' : undefined}>
                  {figure.id === 'minutes' ? t('numbers.minutesValue', { count: figure.value }) : formatNumber(figure.value)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </NumbersMotion>
  );
}
