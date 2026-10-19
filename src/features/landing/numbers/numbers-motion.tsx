'use client';

/**
 * Numbers: each figure counts from 0 to its value with the section's entry progress, n = round(value · easeOut(s)).
 * The server renders the final values (no-JS and crawlers see the real figures); the engine takes over on hydration.
 */
import { useRef, type ReactNode } from 'react';
import { formatNumber } from '../i18n/format.js';
import { useLandingText } from '../i18n/use-landing-text';
import { easeOut, enterProgress } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';

export function NumbersMotion({ children }: { readonly children: ReactNode }): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const shownRef = useRef(new Map<HTMLElement, number>());
  const countersRef = useRef<readonly HTMLElement[] | null>(null);
  useSectionMotion(sectionRef);

  useScene(sectionRef, (frame, box) => {
    const root = sectionRef.current;
    if (!root) return;
    const s = frame.reduced ? 1 : easeOut(enterProgress(box, frame));
    countersRef.current ??= [...root.querySelectorAll<HTMLElement>('[data-count]')];
    countersRef.current.forEach((element) => {
      const value = Math.round(Number(element.dataset.count) * s);
      if (shownRef.current.get(element) === value) return;
      shownRef.current.set(element, value);
      element.textContent = element.dataset.unit === 'minutes' ? t('numbers.minutesValue', { count: value }) : formatNumber(value, {}, t.locale);
    });
  });

  return (
    <section ref={sectionRef} className="lp-section lp-numbers lp-motion-root" aria-labelledby="numbers-title">
      {children}
    </section>
  );
}
