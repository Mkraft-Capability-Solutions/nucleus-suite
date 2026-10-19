'use client';

/**
 * FooterMotion: the <footer> as a small client island around server-rendered content. Shared section motion (reveal
 * items stagger in, the background glow drifts) plus the big wordmark: with the footer's entry progress k it rises
 * 0.22em → 0 and fades .35 → 1 while a soft sheen sweeps across its gradient fill (--k, CSS), and it drifts at 0.25×
 * scroll (parallax, transform only). All scroll-driven, so it reverses on the way back up.
 */
import { useRef, type ReactNode } from 'react';
import { clamp, enterProgress } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';

export interface FooterMotionProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function FooterMotion({ label, children }: FooterMotionProps): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const lastK = useRef(-1);
  const lastScroll = useRef(Number.NaN);
  useSectionMotion(ref);
  useScene(ref, (frame, box) => {
    const word = ref.current?.querySelector<HTMLElement>('[data-bigword]');
    if (!word || frame.scroll === lastScroll.current) return;
    lastScroll.current = frame.scroll;
    const k = clamp(enterProgress(box, frame) / 0.85);
    if (Math.abs(k - lastK.current) > 0.001) {
      lastK.current = k;
      word.style.setProperty('--k', k.toFixed(3));
    }
    const bottom = box.top + box.height - frame.viewportHeight;
    word.style.transform = `translateY(${String(Math.min(96, Math.max(0, bottom - frame.scroll) * 0.25))}px)`;
  });
  return (
    <footer ref={ref} className="ft lp-motion-root" aria-label={label}>
      {children}
    </footer>
  );
}
