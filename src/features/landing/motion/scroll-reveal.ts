/**
 * Scroll-scrubbed reveal maps (pure functions, unit-tested in scroll-reveal.test.ts). Every landing section animation
 * is a function of scroll position only, so it plays forward on scroll down and in reverse on scroll up, and the same
 * scroll position always renders the same state.
 *
 *   p(element) = clamp((vh − (top − scroll)) / (0.5 · vh))   0 with the element's top at the viewport bottom,
 *                                                            1 once it has risen half a viewport (final state).
 *   staggered(p, i, step) = E(clamp((p − step · i) / 0.6)),   E(x) = 1 − (1 − x)⁴ (easeOutQuart).
 * The stagger index is capped (i ≤ 0.4 / step) so every element is final at p = 1. Heading lines use step 0.08 and
 * move 110% → 0 inside their masks (no opacity change); kickers, intros and items fade 0 → 1 and rise 12–24 px.
 * Nothing animates out at the top edge: above 0.5 · vh from the bottom everything is final.
 */

export const LINE_STEP = 0.08;
export const ITEM_STEP = 0.05;
export const WINDOW = 0.6;
export const LINE_RISE = 110;
export const PARALLAX = 0.06;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** easeOutQuart: E(x) = 1 − (1 − x)⁴ on [0, 1]. */
export function easeOutQuart(x: number): number {
  return 1 - (1 - clamp01(x)) ** 4;
}

/** Scroll progress of an element whose document top is `top`. */
export function elementProgress(top: number, scroll: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 1;
  return clamp01((viewportHeight - (top - scroll)) / (0.5 * viewportHeight));
}

/** Eased progress of the i-th staggered part (index capped so the part is final at p = 1). */
export function staggered(p: number, index: number, step: number): number {
  const capped = Math.min(Math.max(index, 0), Math.floor((1 - WINDOW) / step + 1e-9));
  return easeOutQuart((p - step * capped) / WINDOW);
}

/** translateY (% of the word height) of a heading word on line `line`. */
export function lineOffset(p: number, line: number): number {
  return LINE_RISE * (1 - staggered(p, line, LINE_STEP));
}

export interface Fade {
  readonly opacity: number;
  /** translateY in px. */
  readonly y: number;
}

/** Fade-and-rise of the i-th part (kicker: 0, intro: after the lines, items: their order). */
export function fadeRise(p: number, index: number, step: number, rise: number): Fade {
  const e = staggered(p, index, step);
  return { opacity: e, y: rise * (1 - e) };
}

/** Shimmer band across the gradient words: translateX −100% → 100% over p 0.5 → 1. */
export function shimmerOffset(p: number): number {
  return -100 + 200 * easeOutQuart((p - 0.5) / 0.5);
}

/** Heading block parallax (px, ≤ 0): −0.06 · clamp(scroll − sectionTop, 0, range). */
export function headingParallax(scroll: number, sectionTop: number, range: number): number {
  return -PARALLAX * Math.min(Math.max(scroll - sectionTop, 0), Math.max(range, 0));
}
