'use client';

/**
 * "Flip the switch on your HR week" (pinned). Twelve scroll steps through the pinned run:
 *   p 0 → .5   "Without Nucleus" is the active tab; its six boxes highlight one by one (the active box glows and
 *              lifts, earlier boxes stay marked as seen);
 *   p .5 → 1   the switch slides to "With Nucleus" and its six boxes highlight one by one.
 * A tab click (or arrow keys on the tablist) scrolls to the start of that phase. Un-pinned (narrow or short viewports)
 * the switch is a plain toggle and every box shows as seen. Reduced motion: same steps, no transitions.
 */
import { useRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { useSectionMotion } from '../motion/use-section-motion';
import { handleTabKeys } from '../section-kit/roving-tabs';
import { SectionHeader } from '../section-kit/section-header';
import { usePinnedSteps } from '../section-kit/use-pinned-steps';
import { useSlidingIndicator } from '../section-kit/use-sliding-indicator';

const ITEM_IDS = ['balance', 'joiner', 'punches', 'reviews', 'payroll', 'pulse'] as const;
const PHASES = ['before', 'after'] as const;
const PER_PHASE = ITEM_IDS.length;

type CardState = 'active' | 'seen' | 'idle';

function cardState(index: number, active: number, pinned: boolean): CardState {
  if (!pinned) return 'seen';
  if (index === active) return 'active';
  return index < active ? 'seen' : 'idle';
}

export function BeforeAfterComparisonSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  useSectionMotion(sectionRef);
  const { step, pinned, goTo } = usePinnedSteps(sectionRef, PHASES.length * PER_PHASE);
  const phaseIndex = Math.floor(step / PER_PHASE);
  const phase = PHASES[phaseIndex] ?? 'before';
  const active = step % PER_PHASE;
  useSlidingIndicator(switchRef, phaseIndex);

  return (
    <section ref={sectionRef} className="lp-section ba lp-pin lp-pin-ba lp-motion-root" id="ba" data-m={phase} aria-labelledby="ba-title">
      <div className="lp-pin-stage" data-pin-stage="">
        <div className="lp-glow" data-parallax-glow="0.25" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-grid">
            <SectionHeader kicker={t('ba.pill')} title={t('ba.title')} titleId="ba-title" />
            <div className="ba-switch" data-reveal-item="">
              <div
                ref={switchRef}
                className="ba-sw"
                role="tablist"
                aria-label={t('ba.compare')}
                onKeyDown={(event) => {
                  handleTabKeys(event, phaseIndex, PHASES.length, (index) => {
                    goTo(index * PER_PHASE);
                  });
                }}
              >
                <span className="lp-indicator" data-indicator="" aria-hidden="true" />
                {PHASES.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    id={`ba-tab-${option}`}
                    aria-selected={phase === option}
                    aria-controls="ba-panel"
                    tabIndex={phase === option ? 0 : -1}
                    onClick={() => {
                      goTo(index * PER_PHASE);
                    }}
                  >
                    {t(`ba.${option}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="ba-grid" id="ba-panel" role="tabpanel" aria-labelledby={`ba-tab-${phase}`}>
              {ITEM_IDS.map((id, index) => (
                <article key={id} className="ba-card lp-lift" data-reveal-item="" data-state={cardState(index, active, pinned)}>
                  <span className="ba-seen" aria-hidden="true">
                    <Check />
                  </span>
                  <span className="st">{phase === 'before' ? t('ba.manual') : t('ba.automatic')}</span>
                  <span className="ago">{t(`ba.items.${id}.${phase === 'before' ? 'was' : 'now'}`)}</span>
                  <h3>{t(`ba.items.${id}.title`)}</h3>
                  <p>{t(`ba.items.${id}.${phase}`)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
