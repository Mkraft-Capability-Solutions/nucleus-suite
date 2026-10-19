'use client';

/**
 * useSlidingIndicator: places a tab list's indicator ([data-indicator] inside the track) under the active tab
 * ([aria-selected="true"] or [aria-pressed="true"]) by writing --indicator-x / --indicator-y / --indicator-w /
 * --indicator-h; CSS turns them into a transform (offsets from the inline start, so RTL works). Re-measures when the
 * active index changes, on resize (ResizeObserver on the track) and after web fonts load.
 */
import { useEffect, useLayoutEffect, type RefObject } from 'react';

function place(track: HTMLElement): void {
  const indicator = track.querySelector<HTMLElement>('[data-indicator]');
  const active = track.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]');
  if (!indicator || !active) return;
  const rtl = getComputedStyle(track).direction === 'rtl';
  const x = rtl ? track.clientWidth - active.offsetLeft - active.offsetWidth : active.offsetLeft;
  indicator.style.setProperty('--indicator-x', `${String(x)}px`);
  indicator.style.setProperty('--indicator-y', `${String(active.offsetTop)}px`);
  indicator.style.setProperty('--indicator-w', `${String(active.offsetWidth)}px`);
  indicator.style.setProperty('--indicator-h', `${String(active.offsetHeight)}px`);
  track.setAttribute('data-indicator-ready', '');
}

export function useSlidingIndicator(ref: RefObject<HTMLElement | null>, active: number): void {
  useLayoutEffect(() => {
    if (ref.current) place(ref.current);
  }, [ref, active]);

  useEffect(() => {
    const track = ref.current;
    if (!track) return undefined;
    const observer = new ResizeObserver(() => {
      place(track);
    });
    observer.observe(track);
    void document.fonts.ready.then(() => {
      place(track);
    });
    return () => {
      observer.disconnect();
    };
  }, [ref]);
}
