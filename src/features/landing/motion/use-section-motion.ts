'use client';

/**
 * useSectionMotion: the shared scroll-scrubbed choreography for a section (maths in scroll-reveal.ts). Every value is a
 * pure function of the (engine-smoothed) scroll position, so it plays forward on scroll down and in reverse on scroll
 * up; there are no timers and no "done" latch. Per element, p = clamp((vh − (top − scroll)) / (0.5 · vh)):
 *   - heading words ([data-split-heading] .lp-split-word, line i): translateY 110% → 0 in their masks (no opacity);
 *   - kicker ([data-heading-kicker]): opacity 0 → 1, rise 12 px; intro ([data-heading-intro]): same, 16 px, after the
 *     heading's lines; gradient words shimmer once across p .5 → 1 ([data-em-shimmer]);
 *   - items ([data-reveal-item]): opacity 0 → 1, rise 24 px, 0.05 stagger by order within their parent;
 *   - counters ([data-count-to]): value · E(p); progress fills ([data-progress-to]): scaleX value · E(p);
 *   - glows ([data-parallax-glow]) at 0.2–0.35 × scroll; heading blocks ([data-heading-block], or a heading outside
 *     one) −0.06 × clamp(scroll − top, 0, range) (range: section height, at most one viewport), except inside a pinned
 *     stage, whose heading never moves (it must stay below the sticky header for the whole run).
 * Element tops are measured from layout offsets (transform-free) on mount and on layout changes, never per frame.
 * Inside a pinned stage ([data-pin-stage]) tops are taken at the pin's start (the stage's natural position), so a
 * pinned section's heading is final before the pin begins and stays put for the whole run.
 * The state is applied synchronously on mount (before the first paint), and nothing is hidden by CSS beforehand.
 * Final values clear their inline styles (CSS hover lifts apply); a part mid-scrub carries data-scrubbing so CSS
 * transitions never smooth it (the engine's lerp is the only smoothing).
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { elementProgress, fadeRise, headingParallax, ITEM_STEP, LINE_STEP, lineOffset, shimmerOffset, staggered } from './scroll-reveal';
import { clamp, type Frame, type SceneBox } from './scroll-engine';
import { useScene } from './use-scene';

interface Measured {
  readonly element: HTMLElement;
  /** Top relative to the section root, at the pin's start for pinned stages. */
  offset: number;
}

interface Word extends Measured {
  /** Offset of the word's heading (all words of a heading share its progress). */
  headingOffset: number;
  line: number;
}

interface Item extends Measured {
  index: number;
}

interface Intro extends Measured {
  lines: number;
}

interface Parts {
  readonly words: Word[];
  readonly kickers: Measured[];
  readonly intros: Intro[];
  readonly shimmers: Measured[];
  readonly blocks: HTMLElement[];
  readonly items: Item[];
  readonly counters: Measured[];
  readonly fills: Measured[];
  readonly glows: { readonly element: HTMLElement; readonly factor: number }[];
  readonly written: Map<HTMLElement, string>;
  /** Inputs of the last render (scroll, viewport, box): an idle frame with the same inputs does no work at all. */
  lastInputs: string;
}

/** Offset of `element` from `root`, through layout offsets (transforms ignored); a pinned stage counts as 0. */
function offsetWithin(element: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    if (node.hasAttribute('data-pin-stage')) return top;
    top += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement && root.contains(parent) ? parent : null;
  }
  return top;
}

const measured = (element: HTMLElement): Measured => ({ element, offset: 0 });

function collect(root: HTMLElement): Parts {
  const headings = [...root.querySelectorAll<HTMLElement>('[data-split-heading]')];
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-heading-block]')];
  for (const heading of headings) if (!heading.closest('[data-heading-block]')) blocks.push(heading);
  // No parallax inside a pinned stage: the heading must stay clear of the sticky header for the whole pinned run.
  const parallaxBlocks = blocks.filter((block) => !block.closest('[data-pin-stage]'));
  return {
    words: [...root.querySelectorAll<HTMLElement>('[data-split-heading] .lp-split-word')].map((element) => ({ element, offset: 0, headingOffset: 0, line: 0 })),
    kickers: [...root.querySelectorAll<HTMLElement>('[data-heading-kicker]')].map(measured),
    intros: [...root.querySelectorAll<HTMLElement>('[data-heading-intro]')].map((element) => ({ element, offset: 0, lines: 1 })),
    shimmers: [...root.querySelectorAll<HTMLElement>('[data-em-shimmer]')].map(measured),
    blocks: parallaxBlocks,
    items: [...root.querySelectorAll<HTMLElement>('[data-reveal-item]')].map((element) => ({ element, offset: 0, index: 0 })),
    counters: [...root.querySelectorAll<HTMLElement>('[data-count-to]')].map(measured),
    fills: [...root.querySelectorAll<HTMLElement>('[data-progress-to]')].map(measured),
    glows: [...root.querySelectorAll<HTMLElement>('[data-parallax-glow]')].map((element) => ({
      element,
      factor: clamp(Number(element.dataset.parallaxGlow) || 0.25, 0.2, 0.35),
    })),
    written: new Map(),
    lastInputs: '',
  };
}

/** Tops (relative to the root), heading lines and item stagger indices, from transform-free layout offsets. */
function measure(parts: Parts, root: HTMLElement): void {
  const lineTops = new Map<Element, number[]>();
  const headingLines = new Map<Element, number>();
  const headingOffsets = new Map<Element, number>();
  for (const word of parts.words) {
    const heading = word.element.closest<HTMLElement>('[data-split-heading]');
    const mask = word.element.parentElement;
    if (!heading || !mask) continue;
    let headingOffset = headingOffsets.get(heading);
    if (headingOffset === undefined) {
      headingOffset = offsetWithin(heading, root);
      headingOffsets.set(heading, headingOffset);
    }
    word.headingOffset = headingOffset;
    word.offset = word.headingOffset;
    const known = lineTops.get(heading) ?? [];
    let line = known.findIndex((value) => Math.abs(value - mask.offsetTop) < 4);
    if (line < 0) {
      known.push(mask.offsetTop);
      known.sort((a, b) => a - b);
      line = known.indexOf(mask.offsetTop);
    }
    lineTops.set(heading, known);
  }
  for (const word of parts.words) {
    const heading = word.element.closest('[data-split-heading]');
    const mask = word.element.parentElement;
    const known = heading ? lineTops.get(heading) : undefined;
    if (!heading || !mask || !known) continue;
    word.line = Math.max(0, known.findIndex((value) => Math.abs(value - mask.offsetTop) < 4));
    headingLines.set(heading, known.length);
  }
  for (const part of [...parts.kickers, ...parts.shimmers, ...parts.counters, ...parts.fills]) part.offset = offsetWithin(part.element, root);
  for (const shimmer of parts.shimmers) {
    const heading = shimmer.element.closest<HTMLElement>('[data-split-heading]');
    if (heading) shimmer.offset = offsetWithin(heading, root);
  }
  for (const intro of parts.intros) {
    intro.offset = offsetWithin(intro.element, root);
    const heading = intro.element.parentElement?.querySelector('[data-split-heading]');
    intro.lines = heading ? (headingLines.get(heading) ?? 1) : 1;
    // The intro follows its heading's lines: measure it from the heading so the block reads as one unit.
    if (heading instanceof HTMLElement) intro.offset = offsetWithin(heading, root);
  }
  const perParent = new Map<Element | null, number>();
  for (const item of parts.items) {
    item.offset = offsetWithin(item.element, root);
    const parent = item.element.parentElement;
    const index = perParent.get(parent) ?? 0;
    item.index = index;
    perParent.set(parent, index + 1);
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatCount(element: HTMLElement, value: number): string {
  const digits = Number(element.dataset.countDigits) || 1;
  const locale = document.documentElement.lang || 'en';
  const key = `${locale}|${String(digits)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { minimumIntegerDigits: digits });
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** Write a style only when it changed (cheap frames while the scroll settles). */
function write(parts: Parts, element: HTMLElement, transform: string, opacity: string): void {
  const key = `${transform}|${opacity}`;
  if (parts.written.get(element) === key) return;
  parts.written.set(element, key);
  if (transform) element.style.transform = transform;
  else element.style.removeProperty('transform');
  if (opacity) element.style.opacity = opacity;
  else element.style.removeProperty('opacity');
  if (transform || opacity) element.setAttribute('data-scrubbing', '');
  else element.removeAttribute('data-scrubbing');
}

function fade(parts: Parts, element: HTMLElement, opacity: number, y: number): void {
  const final = opacity >= 0.999;
  write(parts, element, final ? '' : `translateY(${y.toFixed(2)}px)`, final ? '' : opacity.toFixed(3));
}

function render(parts: Parts, frame: Frame, box: SceneBox): void {
  const { scroll, viewportHeight: vh } = frame;
  // The state is a pure function of these inputs: skip frames where none changed (the loop also runs for other scenes).
  const inputs = `${scroll.toFixed(2)}|${String(vh)}|${box.top.toFixed(1)}|${box.height.toFixed(1)}`;
  if (inputs === parts.lastInputs) return;
  parts.lastInputs = inputs;
  const progress = (offset: number): number => elementProgress(box.top + offset, scroll, vh);
  const relative = scroll - box.top;
  for (const glow of parts.glows) glow.element.style.transform = `translateY(${(-glow.factor * relative).toFixed(2)}px)`;
  const range = Math.min(box.height, vh);
  for (const block of parts.blocks) block.style.transform = `translateY(${headingParallax(scroll, box.top, range).toFixed(2)}px)`;

  for (const word of parts.words) {
    const offset = lineOffset(progress(word.headingOffset), word.line);
    write(parts, word.element, offset > 0.01 ? `translateY(${offset.toFixed(2)}%)` : '', '');
  }
  for (const kicker of parts.kickers) {
    const state = fadeRise(progress(kicker.offset), 0, LINE_STEP, 12);
    fade(parts, kicker.element, state.opacity, state.y);
  }
  for (const intro of parts.intros) {
    const state = fadeRise(progress(intro.offset), intro.lines + 1, LINE_STEP, 16);
    fade(parts, intro.element, state.opacity, state.y);
  }
  for (const shimmer of parts.shimmers) {
    const x = shimmerOffset(progress(shimmer.offset));
    write(parts, shimmer.element, x >= 100 ? '' : `translateX(${x.toFixed(2)}%)`, '');
  }
  for (const item of parts.items) {
    const state = fadeRise(progress(item.offset), item.index, ITEM_STEP, 24);
    fade(parts, item.element, state.opacity, state.y);
  }
  for (const counter of parts.counters) {
    const value = Math.round(Number(counter.element.dataset.countTo) * staggered(progress(counter.offset), 0, ITEM_STEP));
    const text = formatCount(counter.element, value);
    if (counter.element.textContent !== text) counter.element.textContent = text;
  }
  for (const fill of parts.fills) {
    const scale = clamp(Number(fill.element.dataset.progressTo)) * staggered(progress(fill.offset), 0, ITEM_STEP);
    fill.element.style.transform = `scaleX(${scale.toFixed(4)})`;
  }
}

/** Current frame values outside the engine loop (mount, before the first paint). */
function frameNow(): Frame {
  return { scroll: window.scrollY, time: performance.now(), delta: 0, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, reduced: false };
}

export function useSectionMotion<T extends HTMLElement>(ref: RefObject<T | null>): void {
  const partsRef = useRef<Parts | null>(null);
  const ensure = (): Parts | null => {
    const root = ref.current;
    if (!root) return null;
    if (!partsRef.current) {
      partsRef.current = collect(root);
      measure(partsRef.current, root);
    }
    return partsRef.current;
  };

  // First paint already shows the state for the current scroll position.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    partsRef.current ??= collect(root);
    measure(partsRef.current, root);
    const rect = root.getBoundingClientRect();
    render(partsRef.current, frameNow(), { top: rect.top + window.scrollY, height: rect.height });
  }, [ref]);

  useScene(
    ref,
    (frame, box) => {
      const parts = ensure();
      if (parts) render(parts, frame, box);
    },
    {
      onMeasure: () => {
        const root = ref.current;
        const parts = ensure();
        if (root && parts) {
          measure(parts, root);
          parts.lastInputs = '';
        }
      },
    },
  );
}
