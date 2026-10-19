'use client';

/**
 * usePinnedSteps: a pinned (sticky) section whose scroll progress p (0…1 through the pinned run, pinProgress) selects
 * one of `count` steps, step = min(count − 1, ⌊p · count⌋). The section element is tall (n × 100vh, set in CSS) and its
 * stage ([data-pin-stage]) is position: sticky; when CSS un-pins the stage (narrow or short viewports), the steps
 * become plain tabs: `goTo` selects directly instead of scrolling.
 *
 * - React state changes only when the step changes (never per frame); `onFrame` receives the raw progress and the
 *   progress within the current step (`local`) for scroll-scrubbed step content (typing, ticks, rails), which the
 *   caller writes straight to the DOM or quantises into state. Everything reverses when scrolling back up.
 * - `goTo(i)` scrolls to the middle of step i's window with the engine's eased scroll (focus stays on the control).
 */
import { useCallback, useRef, useState, type RefObject } from 'react';
import { pinProgress, scrollToTarget, type Frame } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';

export interface PinnedFrame {
  /** Progress through the pinned run (0…1); 0 while un-pinned. */
  readonly progress: number;
  /** Progress within the current step's window (0…1); 1 while un-pinned (steps show their finished state). */
  readonly local: number;
  /** The step `local` belongs to (may run one render ahead of the `step` state). */
  readonly step: number;
  readonly pinned: boolean;
  readonly frame: Frame;
}

export interface PinnedSteps {
  readonly step: number;
  readonly pinned: boolean;
  readonly goTo: (index: number) => void;
}

function isPinned(element: HTMLElement): boolean {
  const stage = element.querySelector<HTMLElement>('[data-pin-stage]');
  return stage !== null && getComputedStyle(stage).position === 'sticky';
}

/** Document Y at which step `index` of `count` sits in the middle of its window. */
export function stepScrollY(element: HTMLElement, index: number, count: number): number {
  const top = element.getBoundingClientRect().top + window.scrollY;
  const run = Math.max(0, element.offsetHeight - window.innerHeight);
  return top + ((index + 0.5) / count) * run;
}

/**
 * `needsFrame` (optional) asks for `onFrame` on every engine frame (e.g. a real-time replay); otherwise `onFrame` runs
 * only when the progress, the step or the pinned state changed (idle frames cost nothing).
 */
export function usePinnedSteps<T extends HTMLElement>(
  ref: RefObject<T | null>,
  count: number,
  onFrame?: (state: PinnedFrame) => void,
  needsFrame?: () => boolean,
): PinnedSteps {
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState(true);
  const stepRef = useRef(0);
  const pinnedRef = useRef(true);
  const lastRef = useRef('');

  useScene(
    ref,
    (frame, box) => {
      const progress = pinnedRef.current ? pinProgress(box, frame) : 0;
      if (pinnedRef.current) {
        const next = Math.min(count - 1, Math.floor(progress * count));
        if (next !== stepRef.current) {
          stepRef.current = next;
          setStep(next);
        }
      }
      const local = pinnedRef.current ? Math.min(1, Math.max(0, progress * count - stepRef.current)) : 1;
      const key = `${progress.toFixed(5)}|${String(stepRef.current)}|${String(pinnedRef.current)}`;
      if (key === lastRef.current && !needsFrame?.()) return;
      lastRef.current = key;
      onFrame?.({ progress, local, step: stepRef.current, pinned: pinnedRef.current, frame });
    },
    {
      onMeasure: () => {
        const element = ref.current;
        if (!element) return;
        const now = isPinned(element);
        lastRef.current = '';
        if (now !== pinnedRef.current) {
          pinnedRef.current = now;
          setPinned(now);
        }
      },
    },
  );

  const goTo = useCallback(
    (index: number) => {
      const element = ref.current;
      if (!element) return;
      if (!pinnedRef.current) {
        stepRef.current = index;
        setStep(index);
        return;
      }
      scrollToTarget(() => stepScrollY(element, index, count));
    },
    [ref, count],
  );

  return { step, pinned, goTo };
}
