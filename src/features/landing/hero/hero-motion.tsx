'use client';

/**
 * Hero choreography (client island around the server-rendered hero). Everything is a pure function of the engine's
 * time t (s) and the hero's pinned scroll progress p (0…1); see hero-geometry.ts for the orbit maths.
 *
 * Entrance (ms after the engine starts, on every page load): kicker fades and rises at 120 · headline lines rise out
 * of their masks at 220 / 310 / 400 (90 ms stagger) · the gradient words shimmer once (a light band translates across
 * them, 1150 → 2250) · lead fades and rises at 560 · CTAs pop (scale .96 → 1 + opacity) at 680 / 750 · assurances
 * stagger at 820 / 890 / 960 · core 300→1200 · orbits draw 450→1150 · nodes glide 900→2000 · cards land
 * from 1000, 120 ms apart · ring and meter fill from 1300 / 1400.
 * Idle: levitation y = 8·sin(2πt/6) with glow and contact shadow linked to it; nodes orbit at Kepler speeds; cards bob.
 * Scroll (p over the pinned run): copy rises 140 px and fades (1 − 1.15×) over p ∈ [.05, .55]; the core travels to
 * the viewport centre and zooms 1 → 1.5 over [.1, .8] while orbits flatten (b × .62) and untilt by half; cards fly out
 * along the core→card vector × depth over [.15, .7]; the background grid moves at 0.3× scroll. The trust block (partner
 * marquee + module strip) fades with the copy (same opacity curve).
 * Chaos labels: scattered round the core at rest (CSS places them, so the first paint is already right) with a gentle
 * bob; label i is pulled into the core over hp ∈ [0.03·i, 0.03·i + 0.23] (all in by hp = 0.5): position lerps to the
 * core centre, scale 1 → 0.6 and opacity 1 → 0, eased E(x) = 1 − (1 − x)⁴. That pull is a pure function of hp, so
 * scrolling back reverses it exactly. At rest a label steps aside (smoothly) from any module node, status card, the core
 * or another label passing over it, staying inside the stage; the step-aside fades out as the pull takes over.
 */
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { formatNumber } from '../i18n/format.js';
import { selectModule } from '../motion/module-selection';
import { clamp, easeInOut, easeOut, lerp, pinProgress, range, scrollToElement, type Frame, type SceneBox } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { CARDS, CHAOS, NODES, ORBITS, REFERENCE_STAGE_WIDTH, angularSpeed, approach, ellipsePerimeter, ellipsePoint, overlaps, type NodeSpec, type OrbitSpec, type Rect } from './hero-geometry';
import { NODE_TARGETS } from './node-targets';

function isNodeId(value: string | undefined): value is NodeSpec['id'] {
  return value !== undefined && Object.hasOwn(NODE_TARGETS, value);
}

/** Height of the sticky header (the scroll target lands just below it). */
function headerOffset(): number {
  return document.querySelector('.lp-header')?.getBoundingClientRect().height ?? 0;
}

/** Pinned choreography only where the two-column hero and its trust row fit (matches the stacked-layout query in
 * styles/hero.css: max-width 1023px, max-height 759px). */
const PIN_QUERY = '(min-width: 1024px) and (min-height: 760px)';
const RAD_TO_DEG = 180 / Math.PI;
/** Node ring radius (px, 36 px circle inside a 40 px hit area): labels are positioned by their ring's centre. */
const NODE_DOT = 20;
/** Sphere radius at reference scale (px): 116 px sphere. */
const CORE_RADIUS = 58;
/** Contact shadow offset below the sphere centre (px), proportional to the sphere. */
const SHADOW_DROP = 102;
/** Hover ease time constant (ms): the node's orbit slows to a stop and its glow, scale and contrast rise. */
const HOVER_TAU = 140;
/** Hovered node scale. */
const HOVER_SCALE = 1.12;
/** Label fade time constant (ms) for collision hide/show. */
const LABEL_FADE_TAU = 80;
/** Chaos pull: per-label stagger and window length in hp (the last label is fully in at hp = 0.5). */
const CHAOS_STAGGER = 0.03;
const CHAOS_SPAN = 0.5 - CHAOS_STAGGER * (CHAOS.length - 1);
/** Chaos label scale once inside the core. */
const CHAOS_END_SCALE = 0.6;
/** Step-aside smoothing (ms) and clearance (px) round obstacles. */
const CHAOS_DODGE_TAU = 220;
const CHAOS_CLEARANCE = 6;
/** Sphere clearance radius at reference scale (px): the sphere plus its first halo. */
const CHAOS_CORE_RADIUS = 70;

interface EnterItem {
  readonly element: HTMLElement;
  readonly delay: number;
  /** fade: opacity + 14 px rise · rise: line out of its mask · pop: scale .96 → 1 + opacity · shimmer: band sweep. */
  readonly kind: 'fade' | 'rise' | 'pop' | 'shimmer';
  done: boolean;
}

const ENTER_DURATION: Readonly<Record<EnterItem['kind'], number>> = { fade: 800, rise: 900, pop: 520, shimmer: 1100 };

interface CardItem {
  readonly element: HTMLElement;
  readonly index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface NodeItem {
  readonly element: HTMLElement;
  readonly id: string;
  readonly orbit: OrbitSpec;
  readonly theta: number;
  w: number;
  visibility: number;
  /** Integrated orbit angle (rad): advances at the Kepler speed × (1 − hover), so a hovered node eases to a pause. */
  travelled: number;
  hover: number;
  front: boolean | null;
  hidden: boolean | null;
}

interface ChaosItem {
  readonly element: HTMLElement;
  readonly index: number;
  /** Anchor (label centre) in stage px, as laid out by CSS. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Smoothed step-aside offset (px) and visibility. */
  dx: number;
  dy: number;
  visibility: number;
}

interface OrbitItem {
  readonly spec: OrbitSpec;
  readonly group: SVGGElement;
  readonly ellipse: SVGEllipseElement;
  drawn: boolean;
}

interface Parts {
  readonly copy: HTMLElement;
  readonly background: HTMLElement;
  readonly stage: HTMLElement;
  readonly svg: SVGSVGElement;
  readonly core: HTMLElement;
  readonly bloom: HTMLElement;
  readonly shadow: HTMLElement;
  readonly ring: SVGCircleElement | null;
  readonly percent: HTMLElement | null;
  readonly meter: HTMLElement | null;
  readonly enter: EnterItem[];
  readonly cards: CardItem[];
  readonly nodes: NodeItem[];
  readonly orbits: OrbitItem[];
  readonly chaos: ChaosItem[];
  readonly trust: HTMLElement | null;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  pinned: boolean;
  shownPercent: number;
}

function pick<T extends Element>(root: Element, selector: string, type: new () => T): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Hero: missing ${selector}`);
  return element;
}

function collect(root: HTMLElement): Parts {
  const enter: EnterItem[] = [];
  root.querySelectorAll<HTMLElement>('[data-enter], [data-rise], [data-pop], [data-shimmer]').forEach((element) => {
    const { rise, pop, shimmer } = element.dataset;
    if (rise !== undefined) enter.push({ element, delay: Number(rise), kind: 'rise', done: false });
    else if (pop !== undefined) enter.push({ element, delay: Number(pop), kind: 'pop', done: false });
    else if (shimmer !== undefined) enter.push({ element, delay: Number(shimmer), kind: 'shimmer', done: false });
    else enter.push({ element, delay: Number(element.dataset.enter), kind: 'fade', done: false });
  });
  const cards = CARDS.map((card, index) => ({ element: pick(root, `[data-hero-card="${card.id}"]`, HTMLElement), index, x: 0, y: 0, w: 0, h: 0 }));
  const nodes = NODES.map((node) => ({
    element: pick(root, `[data-hero-node="${node.id}"]`, HTMLElement),
    id: node.id,
    orbit: ORBITS[node.orbit],
    theta: node.theta,
    w: 0,
    visibility: 0,
    travelled: 0,
    hover: 0,
    front: null,
    hidden: null,
  }));
  const orbits = ORBITS.map((spec, index) => {
    const group = pick(root, `[data-hero-orbit="${index}"]`, SVGGElement);
    return { spec, group, ellipse: pick(group, 'ellipse', SVGEllipseElement), drawn: false };
  });
  const chaos = CHAOS.map((id, index) => ({
    element: pick(root, `[data-hero-chaos="${id}"]`, HTMLElement),
    index,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    dx: 0,
    dy: 0,
    visibility: 1,
  }));
  return {
    copy: pick(root, '[data-hero-copy]', HTMLElement),
    background: pick(root, '[data-hero-bg]', HTMLElement),
    stage: pick(root, '[data-hero-stage]', HTMLElement),
    svg: pick(root, '[data-hero-orbits]', SVGSVGElement),
    core: pick(root, '[data-hero-core]', HTMLElement),
    bloom: pick(root, '[data-hero-bloom]', HTMLElement),
    shadow: pick(root, '[data-hero-shadow]', HTMLElement),
    ring: root.querySelector<SVGCircleElement>('[data-hero-ring]'),
    percent: root.querySelector<HTMLElement>('[data-hero-percent]'),
    meter: root.querySelector<HTMLElement>('[data-hero-meter]'),
    enter,
    cards,
    nodes,
    orbits,
    chaos,
    trust: root.querySelector<HTMLElement>('[data-hero-trust]'),
    stageWidth: 0,
    stageHeight: 0,
    stageLeft: 0,
    pinned: false,
    shownPercent: -1,
  };
}

/** Layout reads (on mount, resize and document size changes only). */
function measure(parts: Parts): void {
  const { stage, svg } = parts;
  parts.stageWidth = stage.clientWidth;
  parts.stageHeight = stage.clientHeight;
  parts.stageLeft = stage.getBoundingClientRect().left;
  parts.pinned = window.matchMedia(PIN_QUERY).matches;
  svg.setAttribute('viewBox', `0 0 ${parts.stageWidth} ${parts.stageHeight}`);
  for (const card of parts.cards) {
    card.x = card.element.offsetLeft;
    card.y = card.element.offsetTop;
    card.w = card.element.offsetWidth;
    card.h = card.element.offsetHeight;
  }
  for (const node of parts.nodes) node.w = node.element.offsetWidth;
  // The chaos layer fills the stage; CSS centres each label on its anchor with `translate`, which offsetLeft/Top ignore.
  for (const label of parts.chaos) {
    label.x = label.element.offsetLeft;
    label.y = label.element.offsetTop;
    label.w = label.element.offsetWidth;
    label.h = label.element.offsetHeight;
  }
}

/** Does `rect` overlap any of `others` (with a clearance margin)? */
function hits(rect: Rect, others: readonly Rect[], pad = CHAOS_CLEARANCE): boolean {
  return others.some((other) => overlaps(rect, other, pad));
}

/**
 * Smallest step that moves `rect` clear of every obstacle while staying inside the stage (w × h), preferring the step
 * closest to `current` so a label keeps stepping the same way while something passes (no flip-flopping). Three
 * relaxation passes; `free` is false when no clear spot was found.
 */
function stepAside(rect: Rect, obstacles: readonly Rect[], current: { x: number; y: number }, w: number, h: number): { x: number; y: number; free: boolean } {
  const pad = CHAOS_CLEARANCE;
  const inside = (x: number, y: number): boolean => rect.x + x >= 0 && rect.y + y >= 0 && rect.x + x + rect.w <= w && rect.y + y + rect.h <= h;
  let x = 0;
  let y = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const other of obstacles) {
      const shifted: Rect = { x: rect.x + x, y: rect.y + y, w: rect.w, h: rect.h };
      if (!overlaps(shifted, other, pad)) continue;
      const options = [
        { x: x + other.x - pad - (shifted.x + shifted.w), y },
        { x: x + other.x + other.w + pad - shifted.x, y },
        { x, y: y + other.y - pad - (shifted.y + shifted.h) },
        { x, y: y + other.y + other.h + pad - shifted.y },
      ];
      const valid = options.filter((option) => inside(option.x, option.y));
      const pool = valid.length > 0 ? valid : options;
      let best = pool[0] ?? { x, y };
      let bestScore = Number.POSITIVE_INFINITY;
      for (const option of pool) {
        const score = Math.hypot(option.x - current.x, option.y - current.y) + 0.5 * Math.hypot(option.x, option.y);
        if (score < bestScore) {
          bestScore = score;
          best = option;
        }
      }
      x = best.x;
      y = best.y;
      moved = true;
    }
    if (!moved) break;
  }
  const final: Rect = { x: rect.x + x, y: rect.y + y, w: rect.w, h: rect.h };
  return { x, y, free: inside(x, y) && !hits(final, obstacles) };
}

function render(parts: Parts, frame: Frame, box: SceneBox, percentValue: number, locale: string, hovered: string | null): void {
  const { reduced } = frame;
  const t = reduced ? 1e4 : frame.time / 1000;
  const ms = t * 1000;
  const hp = parts.pinned ? pinProgress(box, frame) : 0;

  // Entrance timeline (quartic ease-out; the shimmer band uses ease-in-out so it accelerates through the words).
  for (const item of parts.enter) {
    if (item.done) continue;
    const linear = clamp((ms - item.delay) / ENTER_DURATION[item.kind]);
    const style = item.element.style;
    if (item.kind === 'rise') style.transform = `translateY(${110 * (1 - easeOut(linear))}%)`;
    else if (item.kind === 'pop') {
      const p = easeOut(linear);
      style.opacity = String(p);
      style.transform = `scale(${0.96 + 0.04 * p})`;
    } else if (item.kind === 'shimmer') {
      // From fully left of the words (−100% of the band) to fully right (the band is ⅓ of the words' width).
      style.transform = `translateX(${-100 + 400 * easeInOut(linear)}%)`;
      style.opacity = linear > 0 && linear < 1 ? '1' : '0';
    } else {
      const p = easeOut(linear);
      style.opacity = String(p);
      style.transform = `translateY(${14 * (1 - p)}px)`;
    }
    if (linear >= 1) {
      item.done = true;
      // Hand interactive elements back to their CSS hover/press transitions.
      if (item.kind === 'pop') style.removeProperty('transform');
    }
  }

  // Copy exits upward; the background grid drifts at 0.3× scroll within the pinned run.
  const copyOut = easeInOut(range(hp, 0.05, 0.55));
  parts.copy.style.transform = `translateY(${-140 * copyOut}px)`;
  const copyOpacity = String(clamp(1 - 1.15 * copyOut));
  parts.copy.style.opacity = copyOpacity;
  if (parts.trust) parts.trust.style.opacity = copyOpacity;
  const run = Math.max(0, box.height - frame.viewportHeight);
  parts.background.style.transform = `translateY(${-0.3 * clamp(frame.scroll - box.top, 0, run)}px)`;

  // Core: travels to the viewport centre, zooms, levitates.
  const w = parts.stageWidth;
  const h = parts.stageHeight;
  const k = clamp(w / REFERENCE_STAGE_WIDTH, 0.7, 1.2);
  const centerShift = parts.pinned ? easeInOut(range(hp, 0.1, 0.8)) : 0;
  const cx = lerp(w / 2, frame.viewportWidth / 2 - parts.stageLeft, centerShift);
  const cyBase = h / 2;
  const lev = reduced ? 0 : Math.sin((2 * Math.PI * t) / 6);
  const intro = easeOut(clamp((t - 0.3) / 0.9));
  const zoom = lerp(1, 1.5, centerShift);
  const cy = cyBase - 8 * lev;
  parts.core.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px) scale(${(0.6 + 0.4 * intro) * zoom * k})`;
  parts.core.style.opacity = String(intro);
  parts.bloom.style.opacity = String((0.75 + 0.25 * lev) * intro);
  parts.shadow.style.transform = `translate(${cx - w / 2}px, ${SHADOW_DROP * zoom * k}px) scale(${(1 - 0.12 * lev) * zoom * k})`;
  parts.shadow.style.opacity = String((0.8 - 0.25 * lev) * intro);

  // Orbits: unit ellipses transformed (non-scaling stroke); the solid orbit draws in with a Ramanujan-perimeter dash.
  const flatten = lerp(1, 0.62, centerShift);
  const scale = zoom * 0.95 * k;
  for (const item of parts.orbits) {
    const orbit = item.spec;
    const tilt = orbit.tilt * (1 - 0.5 * centerShift);
    item.group.setAttribute('transform', `translate(${cx} ${cy}) rotate(${tilt * RAD_TO_DEG}) scale(${scale} ${scale * flatten})`);
    if (orbit.dashed) {
      item.group.style.opacity = String(easeOut(clamp((t - 0.6) / 0.6)));
      continue;
    }
    if (item.drawn) continue;
    const p = easeOut(clamp((t - 0.45) / 0.7));
    if (p >= 1) {
      item.ellipse.style.strokeDasharray = 'none';
      item.ellipse.style.strokeDashoffset = '0';
      item.drawn = true;
      continue;
    }
    const length = ellipsePerimeter(orbit.a * scale, orbit.b * scale * flatten);
    item.ellipse.style.strokeDasharray = `${length}`;
    item.ellipse.style.strokeDashoffset = `${length * (1 - p)}`;
  }

  // Cards: land, bob, then fly outward along the core→card vector with a per-card depth factor.
  const cardRects: Rect[] = [];
  const out = parts.pinned ? easeInOut(range(hp, 0.15, 0.7)) : 0;
  for (const card of parts.cards) {
    const i = card.index;
    const land = easeOut(clamp((t - 1 - 0.12 * i) / 0.7));
    const bob = reduced ? 0 : 6 * Math.sin((2 * Math.PI * t) / (7 + 0.5 * i) + i * 1.3);
    const ex = card.x + card.w / 2 - w / 2;
    const ey = card.y + card.h / 2 - h / 2;
    const length = Math.hypot(ex, ey) || 1;
    const depth = 1 + 0.2 * i;
    const dx = (ex / length) * 420 * out * depth;
    const dy = (1 - land) * 24 + bob + (ey / length) * 320 * out * depth;
    card.element.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + 0.08 * out * depth})`;
    card.element.style.opacity = String(land * (1 - out));
    if (land * (1 - out) > 0.05) cardRects.push({ x: card.x + dx, y: card.y + dy, w: card.w, h: card.h });
  }

  // Ring (92%) and meter fill with the card landing.
  const fill = easeOut(clamp((t - 1.3) / 1.2));
  parts.ring?.style.setProperty('stroke-dashoffset', String(100 - 100 * percentValue * fill));
  const shown = Math.round(100 * percentValue * fill);
  if (parts.percent && shown !== parts.shownPercent) {
    parts.shownPercent = shown;
    parts.percent.textContent = formatNumber(shown / 100, { style: 'percent' }, locale);
  }
  if (parts.meter) parts.meter.style.transform = `scaleX(${easeOut(clamp((t - 1.4) / 1.1))})`;

  // Nodes on Kepler orbits; depth z = sinθ; labels fade out where they would collide with a card, the core or a label.
  const travel = easeOut(clamp((t - 0.9) / 1.1));
  const placed: Rect[] = [];
  const nodeRects: Rect[] = [];
  for (const node of parts.nodes) {
    const orbit = node.orbit;
    const target = hovered === node.id ? 1 : 0;
    node.hover = frame.reduced ? target : approach(node.hover, target, frame.delta, HOVER_TAU);
    if (!reduced) node.travelled += angularSpeed(orbit) * (1 - node.hover) * (frame.delta / 1000);
    const theta = node.theta + node.travelled - (1 - travel) * 1.2 + hp * 1.6;
    const tilt = orbit.tilt * (1 - 0.5 * centerShift);
    const point = ellipsePoint({ x: cx, y: cy }, orbit.a * scale, orbit.b * scale * flatten, tilt, theta);
    const z = Math.sin(theta);
    const rect: Rect = { x: point.x - NODE_DOT, y: point.y - NODE_DOT, w: node.w, h: 2 * NODE_DOT };
    const behindCore = z < 0 && Math.hypot(point.x - cx, point.y - cy) < CORE_RADIUS * zoom * k + 12;
    // A hovered or focused node is always shown; the others keep the collision rules.
    const free = node.hover > 0.01 || (!behindCore && !cardRects.some((card) => overlaps(rect, card)) && !placed.some((other) => overlaps(rect, other, 4)));
    if (free) placed.push(rect);
    node.visibility = reduced ? Number(free) : approach(node.visibility, Number(free), frame.delta, LABEL_FADE_TAU);
    const near = (z + 1) / 2;
    const depthScale = 0.8 + 0.2 * near;
    const depthOpacity = 0.4 + 0.6 * near;
    node.element.style.transform = `translate(${rect.x}px, ${rect.y}px) scale(${lerp(depthScale, HOVER_SCALE, node.hover)})`;
    const nodeOpacity = node.visibility * lerp(depthOpacity, 1, node.hover) * travel;
    node.element.style.opacity = String(nodeOpacity);
    if (nodeOpacity > 0.05) nodeRects.push(rect);
    const front = z >= 0 || node.hover > 0.01;
    if (front !== node.front) {
      node.front = front;
      node.element.classList.toggle('lp-node-behind', !front);
    }
    // Labels faded out by a collision cannot be clicked (keyboard focus still reveals them).
    const hidden = node.visibility * travel < 0.3;
    if (hidden !== node.hidden) {
      node.hidden = hidden;
      node.element.classList.toggle('lp-node-hidden', hidden);
    }
  }

  // Chaos labels: rest + bob, step aside from whatever passes over them, then the hp-driven pull into the core.
  const seconds = frame.time / 1000;
  const coreReach = CHAOS_CORE_RADIUS * (0.6 + 0.4 * intro) * zoom * k;
  const coreRect: Rect = { x: cx - coreReach, y: cy - coreReach, w: 2 * coreReach, h: 2 * coreReach };
  const obstacles: Rect[] = [...nodeRects, ...cardRects];
  if (intro > 0.05) obstacles.push(coreRect);
  for (const label of parts.chaos) {
    const i = label.index;
    const start = CHAOS_STAGGER * i;
    const pull = easeOut(range(hp, start, start + CHAOS_SPAN));
    const bobX = 3 * Math.sin((2 * Math.PI * seconds) / (6.2 + 0.37 * i) + 1.7 * i);
    const bobY = 5 * Math.sin((2 * Math.PI * seconds) / (4.8 + 0.29 * i) + 2.3 * i);
    const rest: Rect = { x: label.x - label.w / 2 + bobX, y: label.y - label.h / 2 + bobY, w: label.w, h: label.h };
    const step = stepAside(rest, obstacles, { x: label.dx, y: label.dy }, w, h);
    label.dx = approach(label.dx, step.x, frame.delta, CHAOS_DODGE_TAU);
    label.dy = approach(label.dy, step.y, frame.delta, CHAOS_DODGE_TAU);
    const restX = label.x + bobX + label.dx * (1 - pull);
    const restY = label.y + bobY + label.dy * (1 - pull);
    // Shown only where the label actually is clear (the smoothed step may still be catching up with a passing node).
    const clear = step.free && !hits({ x: restX - label.w / 2, y: restY - label.h / 2, w: label.w, h: label.h }, obstacles, 0);
    label.visibility = approach(label.visibility, Number(clear), frame.delta, LABEL_FADE_TAU);
    const x = lerp(restX, cx, pull);
    const y = lerp(restY, cy, pull);
    label.element.style.transform = `translate(${x - label.x}px, ${y - label.y}px) scale(${lerp(1, CHAOS_END_SCALE, pull)})`;
    label.element.style.opacity = String(label.visibility * (1 - pull));
    // Later labels keep clear of the ones already placed this frame.
    if (pull < 0.5) obstacles.push({ x: restX - label.w / 2, y: restY - label.h / 2, w: label.w, h: label.h });
  }
}

export interface HeroMotionProps {
  readonly percentValue: number;
  readonly children: ReactNode;
}

export function HeroMotion({ percentValue, children }: HeroMotionProps): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const partsRef = useRef<Parts | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const focusedRef = useRef<string | null>(null);

  const ensureParts = (): Parts | null => {
    const root = sectionRef.current;
    if (!root) return null;
    if (!partsRef.current) {
      partsRef.current = collect(root);
      measure(partsRef.current);
    }
    return partsRef.current;
  };

  useScene(
    sectionRef,
    (frame, box) => {
      const parts = ensureParts();
      if (parts) render(parts, frame, box, percentValue, document.documentElement.dataset.locale ?? 'en', hoveredRef.current ?? focusedRef.current);
    },
    {
      onMeasure: () => {
        const parts = ensureParts();
        if (parts) measure(parts);
      },
    },
  );

  const nodeOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>('[data-hero-node]') : null;

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    const node = nodeOf(event.target);
    const id = node?.dataset.heroNode;
    if (!node || !isNodeId(id)) return;
    const target = NODE_TARGETS[id];
    const section = document.getElementById(target.section);
    if (!section) return;
    event.preventDefault();
    selectModule(target.module);
    history.replaceState(null, '', `#${target.section}`);
    scrollToElement(section, headerOffset());
  };

  return (
    <section
      ref={sectionRef}
      className="lp-hero"
      aria-labelledby="hero-title"
      onClick={onClick}
      onPointerOver={(event) => {
        hoveredRef.current = nodeOf(event.target)?.dataset.heroNode ?? null;
      }}
      onPointerLeave={() => {
        hoveredRef.current = null;
      }}
      onFocus={(event) => {
        focusedRef.current = nodeOf(event.target)?.dataset.heroNode ?? null;
      }}
      onBlur={() => {
        focusedRef.current = null;
      }}
    >
      {children}
    </section>
  );
}
