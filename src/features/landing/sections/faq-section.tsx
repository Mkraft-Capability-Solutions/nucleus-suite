'use client';

/**
 * "Questions, answered." Two columns on desktop (questions split evenly, first half left), one column under 900 px.
 * Accessible accordion (WAI-ARIA): each question is a button in a heading with aria-expanded / aria-controls; the
 * answer region animates open with grid-template-rows 0fr → 1fr (no height measuring) and is inert while closed.
 * Keyboard: Enter / Space toggle; ArrowDown / ArrowUp move between questions (across both columns), Home / End jump.
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { useSectionMotion } from '../motion/use-section-motion';
import { SectionHeader } from '../section-kit/section-header';

const FAQ_IDS = ['payroll', 'isolation', 'ai', 'volt', 'onPrem', 'setup', 'migrate', 'roles'] as const;
type FaqId = (typeof FAQ_IDS)[number];
const HALF = Math.ceil(FAQ_IDS.length / 2);
const COLUMNS: readonly (readonly FaqId[])[] = [FAQ_IDS.slice(0, HALF), FAQ_IDS.slice(HALF)];

export function FaqSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<ReadonlySet<FaqId>>(() => new Set());
  useSectionMotion(sectionRef);

  const toggle = (id: FaqId): void =>
    {
      setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
};

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-faq-button]')];
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (index < 0) return;
    const targets: Readonly<Partial<Record<string, number>>> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    buttons[(target + buttons.length) % buttons.length]?.focus();
  };

  return (
    <section ref={sectionRef} className="lp-section faq lp-motion-root" id="faq" aria-labelledby="faq-title">
      <div className="lp-glow lp-glow-end" data-parallax-glow="0.32" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <SectionHeader kicker={t('faq.pill')} title={t('faq.title')} titleId="faq-title" />
          <div className="faq-cols" onKeyDown={onKeyDown}>
            {COLUMNS.map((column, columnIndex) => (
              <div className="faq-list" key={columnIndex}>
                {column.map((id) => {
                  const expanded = open.has(id);
                  return (
                    <div key={id} className="fq lp-lift" data-open={expanded ? '' : undefined} data-reveal-item="">
                      <h3>
                        <button type="button" id={`faq-q-${id}`} data-faq-button="" aria-expanded={expanded} aria-controls={`faq-a-${id}`} onClick={() => {
                          toggle(id);
                        }}>
                          <span>{t(`faq.items.${id}.q`)}</span>
                          <i aria-hidden="true">
                            <Plus />
                          </i>
                        </button>
                      </h3>
                      <div className="ans" id={`faq-a-${id}`} role="region" aria-labelledby={`faq-q-${id}`} inert={!expanded}>
                        <div className="ans-inner">
                          <p>{t(`faq.items.${id}.a`)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
