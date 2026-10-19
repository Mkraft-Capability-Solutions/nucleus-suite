'use client';

/**
 * Story section choreography. With entry progress s (0 when the section's top enters the viewport, 1 at 35% from the
 * top): the video frame tilts rotateX 18° → 0° and scales .88 → 1 (ease-out); the four file chips settle from
 * alternating sides at staggered windows [.2 + .1i, .6 + .1i]; the text column (kicker, headline, lead, then each
 * bullet) rises 28 px and fades in over [.15 + .12i, .55 + .12i].
 */
import { useRef, type ReactNode } from 'react';
import { easeOut, enterProgress, lerp, range } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';

interface Parts {
  readonly frame: HTMLElement;
  readonly reveals: HTMLElement[];
}

export function StoryMotion({ children }: { readonly children: ReactNode }): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const partsRef = useRef<Parts | null>(null);
  // Headline lines rise from their masks and the background glow drifts (shared section choreography).
  useSectionMotion(sectionRef);

  useScene(sectionRef, (frame, box) => {
    const root = sectionRef.current;
    if (!root) return;
    const frameElement = partsRef.current?.frame ?? root.querySelector<HTMLElement>('[data-story-frame]');
    if (!frameElement) return;
    // Chips leave the DOM once the film plays, so they are re-queried each frame (cheap: four nodes).
    const parts: Parts = partsRef.current ?? {
      frame: frameElement,
      reveals: [...root.querySelectorAll<HTMLElement>('[data-story-reveal]')],
    };
    partsRef.current = parts;
    const chips = root.querySelectorAll<HTMLElement>('[data-story-chip]');
    const s = frame.reduced ? 1 : enterProgress(box, frame);
    const settle = easeOut(s);
    parts.frame.style.transform = `rotateX(${lerp(18, 0, settle)}deg) scale(${lerp(0.88, 1, settle)})`;
    chips.forEach((chip, i) => {
      const p = easeOut(range(s, 0.2 + 0.1 * i, 0.6 + 0.1 * i));
      const side = i % 2 ? 1 : -1;
      chip.style.transform = `translate(${side * 30 * (1 - p)}px, ${20 * (1 - p)}px) rotate(${side * 4 * (1 - p)}deg)`;
      chip.style.opacity = String(p);
    });
    parts.reveals.forEach((element, i) => {
      const p = easeOut(range(s, 0.15 + 0.12 * i, 0.55 + 0.12 * i));
      element.style.opacity = String(p);
      element.style.transform = `translateY(${28 * (1 - p)}px)`;
    });
  });

  return (
    <section ref={sectionRef} id="story" className="lp-section lp-story lp-motion-root" aria-labelledby="story-title">
      {children}
    </section>
  );
}
