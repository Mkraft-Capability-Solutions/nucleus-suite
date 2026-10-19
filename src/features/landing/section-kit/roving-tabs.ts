/**
 * Roving-focus keyboard handling for a tablist: ArrowRight / ArrowLeft (mirrored in RTL), ArrowDown / ArrowUp, Home
 * and End select a neighbouring tab and move focus to it (WAI-ARIA tabs pattern, automatic activation).
 */
import type { KeyboardEvent } from 'react';

export function handleTabKeys(event: KeyboardEvent<HTMLElement>, current: number, count: number, select: (index: number) => void): void {
  const step = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
  const targets: Readonly<Partial<Record<string, number>>> = {
    ArrowRight: current + step,
    ArrowLeft: current - step,
    ArrowDown: current + 1,
    ArrowUp: current - 1,
    Home: 0,
    End: count - 1,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  const next = (target + count) % count;
  select(next);
  const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  if (next < tabs.length) tabs[next].focus();
}
