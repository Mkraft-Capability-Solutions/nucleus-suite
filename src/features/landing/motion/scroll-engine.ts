/**
 * The landing page's single motion engine: one requestAnimationFrame loop shared by every animated section.
 *
 * - Smoothed scroll: the rendered scroll value s eases toward the real one with s += (y − s) · 0.09 per frame and snaps
 *   when |y − s| < 0.1 px (critically damped feel, no overshoot). Under reduced motion s = y (no smoothing).
 * - Scenes register an element and an update callback. An IntersectionObserver (±25% viewport margin) marks scenes
 *   active only while they are near the viewport; offscreen scenes are not updated. The loop stops when no scene is
 *   active and the smoothed scroll has settled, and while the tab is hidden.
 * - Scenes write transform and opacity only (plus SVG geometry attributes that never trigger layout).
 * - Layout reads are cached: each scene's document top and height are measured on registration, resize and when the
 *   document's size changes (ResizeObserver), never inside the frame loop.
 */

/** Per-frame values handed to every active scene. */
export interface Frame {
  /** Smoothed scroll position (px). */
  readonly scroll: number;
  /** Milliseconds since the engine started (the entrance timeline's t = 0). */
  readonly time: number;
  /** Milliseconds since the previous frame (capped at 64 ms so a stalled tab never jumps). */
  readonly delta: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** prefers-reduced-motion: render the static final layout. */
  readonly reduced: boolean;
}

/** Cached geometry of a scene element in document coordinates. */
export interface SceneBox {
  readonly top: number;
  readonly height: number;
}

export type SceneUpdate = (frame: Frame, box: SceneBox) => void;

interface Scene {
  readonly element: HTMLElement;
  readonly update: SceneUpdate;
  readonly onMeasure: (() => void) | undefined;
  box: SceneBox;
  active: boolean;
}

/* ── Math helpers (pure) ─────────────────────────────────────────────────────────────────────────────────────── */

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Local progress of p inside [start, end], clamped to 0…1. */
export const range = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
/** Quartic ease-out 1 − (1 − x)⁴ (≈ cubic-bezier(.22, 1, .36, 1), token --ease-out-quart). */
export const easeOut = (x: number): number => 1 - (1 - x) ** 4;
/** Quartic ease-in-out. */
export const easeInOut = (x: number): number => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);

/** Progress through a pinned (sticky) section: 0 when its top reaches the viewport top, 1 when its pinned run ends. */
export function pinProgress(box: SceneBox, frame: Frame): number {
  const run = box.height - frame.viewportHeight;
  return run <= 0 ? 0 : clamp((frame.scroll - box.top) / run);
}

/** Entry progress: 0 when the element's top enters at the viewport bottom, 1 when it reaches 35% from the top. */
export function enterProgress(box: SceneBox, frame: Frame): number {
  const top = box.top - frame.scroll;
  return clamp((frame.viewportHeight - top) / (frame.viewportHeight * 0.65));
}

/* ── Engine (browser singleton) ──────────────────────────────────────────────────────────────────────────────── */

const LERP = 0.09;
const SNAP = 0.1;
const MAX_DELTA = 64;
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const scenes = new Set<Scene>();
let observer: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let reducedQuery: MediaQueryList | null = null;
let rafId = 0;
let startTime = -1;
let lastTime = 0;
let target = 0;
let smooth = 0;
let reduced = false;
let measurePending = false;

function measure(scene: Scene): void {
  const rect = scene.element.getBoundingClientRect();
  scene.box = { top: rect.top + window.scrollY, height: rect.height };
  scene.onMeasure?.();
}

function measureAll(): void {
  measurePending = false;
  for (const scene of scenes) measure(scene);
  wake();
}

function scheduleMeasure(): void {
  if (measurePending) return;
  measurePending = true;
  requestAnimationFrame(measureAll);
}

function tick(now: number): void {
  rafId = 0;
  if (document.hidden) return;
  if (startTime < 0) {
    startTime = now;
    lastTime = now;
  }
  const delta = Math.min(MAX_DELTA, now - lastTime);
  lastTime = now;
  target = window.scrollY;
  // Frame-rate independent form of s += (y − s) · 0.09 per 60 fps frame.
  smooth = reduced ? target : lerp(smooth, target, 1 - (1 - LERP) ** (delta / (1000 / 60)));
  if (Math.abs(target - smooth) < SNAP) smooth = target;
  const frame: Frame = {
    scroll: smooth,
    time: now - startTime,
    delta,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    reduced,
  };
  let anyActive = false;
  for (const scene of scenes) {
    if (!scene.active) continue;
    anyActive = true;
    scene.update(frame, scene.box);
  }
  if (anyActive || smooth !== target) rafId = requestAnimationFrame(tick);
}

/** Start the loop if it is idle (on scroll, visibility, activation). */
function wake(): void {
  if (rafId || document.hidden || scenes.size === 0) return;
  rafId = requestAnimationFrame(tick);
}

function onVisibility(): void {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    return;
  }
  // Resume without a time jump: the next frame's delta is capped, and the scroll snaps to its current value.
  lastTime = performance.now();
  wake();
}

function onReducedChange(): void {
  // Landing motion ignores the preference (owner decision); keep the loop awake for a fresh frame.
  reduced = false;
  wake();
}

function install(): void {
  if (observer) return;
  reducedQuery = window.matchMedia(REDUCED_QUERY);
  // Owner decision: the landing page always animates (scroll-scrubbed motion), whatever the OS setting.
  reduced = false;
  target = window.scrollY;
  smooth = target;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        for (const scene of scenes) if (scene.element === entry.target) scene.active = entry.isIntersecting;
      }
      wake();
    },
    { rootMargin: '25% 0px 25% 0px' },
  );
  resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(document.body);
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', scheduleMeasure);
  document.addEventListener('visibilitychange', onVisibility);
  reducedQuery.addEventListener('change', onReducedChange);
}

function uninstall(): void {
  observer?.disconnect();
  resizeObserver?.disconnect();
  observer = null;
  resizeObserver = null;
  window.removeEventListener('scroll', wake);
  window.removeEventListener('resize', scheduleMeasure);
  document.removeEventListener('visibilitychange', onVisibility);
  reducedQuery?.removeEventListener('change', onReducedChange);
  reducedQuery = null;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

export interface RegisterOptions {
  /** Called after the scene's box is (re)measured, for scenes that cache their own layout (e.g. SVG paths). */
  readonly onMeasure?: () => void;
}

/** Register a scene. Returns the unregister function. Browser only (call from an effect). */
export function registerScene(element: HTMLElement, update: SceneUpdate, options: RegisterOptions = {}): () => void {
  install();
  const scene: Scene = { element, update, onMeasure: options.onMeasure, box: { top: 0, height: 0 }, active: false };
  scenes.add(scene);
  measure(scene);
  observer?.observe(element);
  wake();
  return () => {
    observer?.unobserve(element);
    scenes.delete(scene);
    if (scenes.size === 0) uninstall();
  };
}

/* ── Programmatic smooth scroll (driven by the same frame clock) ───────────────────────────────────────────── */

/** Scroll duration (ms) as a function of distance: 450 ms + 0.25 ms/px, capped at 1200 ms. */
function scrollDuration(distance: number): number {
  return Math.min(1200, 450 + Math.abs(distance) * 0.25);
}

let scrollAnimation = 0;

/**
 * Smoothly scroll so `element`'s top sits `offset` px below the viewport top (quartic ease-in-out). Reduced motion
 * jumps. Wheel or touch input cancels the animation. Focus moves to the target afterwards (keyboard users land there).
 */
export function scrollToElement(element: HTMLElement, offset: number): void {
  const from = window.scrollY;
  const to = Math.max(0, element.getBoundingClientRect().top + from - offset);
  const finish = (): void => {
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  };
  if (scrollAnimation) cancelAnimationFrame(scrollAnimation);
  const reducedNow = window.matchMedia(REDUCED_QUERY).matches;
  if (reducedNow || Math.abs(to - from) < 1) {
    window.scrollTo({ top: to, behavior: 'instant' });
    finish();
    return;
  }
  const duration = scrollDuration(to - from);
  const start = performance.now();
  let cancelled = false;
  const cancel = (): void => {
    cancelled = true;
  };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  const step = (now: number): void => {
    if (cancelled) {
      scrollAnimation = 0;
      return;
    }
    const p = clamp((now - start) / duration);
    // Re-aim every frame: sections that load on approach can change the target's offset mid-flight.
    const target = Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top: lerp(from, target, easeInOut(p)), behavior: 'instant' });
    if (p < 1) scrollAnimation = requestAnimationFrame(step);
    else {
      scrollAnimation = 0;
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      finish();
    }
  };
  scrollAnimation = requestAnimationFrame(step);
}

/** Re-measure every scene on the next frame (after content that changes the page height has rendered). */
export function requestMeasure(): void {
  scheduleMeasure();
}

/** Current smoothed scroll and engine time, for event handlers that start time-based animations. */
export function engineTime(): number {
  return startTime < 0 ? 0 : performance.now() - startTime;
}

/** Whether the visitor prefers reduced motion (engine's live value; false before the engine starts). */
export function isReducedMotion(): boolean {
  return reduced;
}

/**
 * Smoothly scroll to a document Y returned by `resolve` (re-read every frame, so targets inside sections that load or
 * resize mid-flight stay accurate). Same easing, duration and cancellation as scrollToElement, and it shares its
 * animation slot (a new request replaces one in flight), but it never moves focus: for in-section controls such as a
 * pinned section's tabs, where focus must stay on the control. Reduced motion jumps.
 */
export function scrollToTarget(resolve: () => number): void {
  const from = window.scrollY;
  const first = Math.max(0, resolve());
  if (scrollAnimation) cancelAnimationFrame(scrollAnimation);
  scrollAnimation = 0;
  if (Math.abs(first - from) < 1) {
    window.scrollTo({ top: first, behavior: 'instant' });
    return;
  }
  const duration = scrollDuration(first - from);
  const start = performance.now();
  let cancelled = false;
  const cancel = (): void => {
    cancelled = true;
  };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  const step = (now: number): void => {
    if (cancelled) {
      scrollAnimation = 0;
      return;
    }
    const p = clamp((now - start) / duration);
    window.scrollTo({ top: lerp(from, Math.max(0, resolve()), easeInOut(p)), behavior: 'instant' });
    if (p < 1) scrollAnimation = requestAnimationFrame(step);
    else {
      scrollAnimation = 0;
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    }
  };
  scrollAnimation = requestAnimationFrame(step);
}
