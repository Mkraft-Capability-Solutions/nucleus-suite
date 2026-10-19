'use client';

/**
 * SectionDots: the fixed dot rail on the inline-end edge (tablet and laptop, ≥ 768 px) for jumping to any landing
 * section. One dot per section in page order; the dot of the section being read is current (aria-current) and shows
 * its label, other labels appear on hover or keyboard focus. Current = the last section whose top is at or above
 * 40 % of the viewport height, from the engine's smoothed scroll; section tops are cached on (re)measure, and lazy
 * sections resolve through the anchors their placeholders keep.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useScene } from '../motion/use-scene';
import { SECTION_DOTS, type SectionDot } from './section-dot-ids';
import '../styles/section-dots.css';

/** Fraction of the viewport height a section's top must pass to become current. */
const ACTIVE_LINE = 0.4;

export interface SectionDotsProps {
  readonly label: string;
  readonly items: readonly { readonly id: SectionDot; readonly label: string }[];
}

export function SectionDots({ label, items }: SectionDotsProps): ReactNode {
  const railRef = useRef<HTMLElement>(null);
  const topsRef = useRef<readonly { readonly id: SectionDot; readonly top: number }[]>([]);
  const [current, setCurrent] = useState<SectionDot>(SECTION_DOTS[0]);

  useScene(
    railRef,
    (frame) => {
      let next: SectionDot = SECTION_DOTS[0];
      for (const section of topsRef.current) if (section.top - frame.scroll <= frame.viewportHeight * ACTIVE_LINE) next = section.id;
      setCurrent((previous) => (previous === next ? previous : next));
    },
    {
      onMeasure: () => {
        const tops: { id: SectionDot; top: number }[] = [];
        for (const id of SECTION_DOTS) {
          const section = document.getElementById(id);
          if (section) tops.push({ id, top: section.getBoundingClientRect().top + window.scrollY });
        }
        topsRef.current = tops;
      },
    },
  );

  return (
    <nav ref={railRef} className="lp-dots" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={current === item.id ? 'location' : undefined}>
              <span className="lp-dots-label">{item.label}</span>
              <span className="lp-dots-dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
