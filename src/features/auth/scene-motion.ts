/**
 * Nucleus scene motion model (pure functions, no DOM), shared by the log in screen, the workspace loading state and
 * the workspace page. Geometry comes from the landing hero (hero-geometry.ts); this file adds the "busy" behaviour.
 *
 * Units: SVG user units in a fixed 600 × 460 viewBox centred on the core, radians, milliseconds.
 *
 * Orbit phase φ integrates the speed multiplier m over time (φ += Δt·m), so every node sits at
 *   θ = θ₀ + ω_Kepler · φ
 * and changing m never makes a node jump. Busy: m eases 1 → 6 over 600 ms (easeInOutCubic); idle eases back to 1.
 * The busy amount b = (m − 1) / 5 weights the core pulse (scale 1 → 1.06, 0.8 s sine) and the node streams
 * (ghost dots trailing each node at angular spacing ∝ m − 1).
 * Levitation (idle and busy): y = −8·sin(2πt/6), glow and contact shadow linked to it, as in the hero.
 */
import { NODES, ORBITS, angularSpeed, ellipsePoint, type NodeSpec } from '@/features/landing/hero/hero-geometry';

export const VIEW_WIDTH = 600;
export const VIEW_HEIGHT = 460;
export const VIEW_BOX = [-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT].join(' ');

/** Orbit radii scale inside the viewBox (the hero draws them at 0.95 of the reference stage). */
export const ORBIT_SCALE = 0.95;
export const IDLE_MULTIPLIER = 1;
export const BUSY_MULTIPLIER = 6;
export const RAMP_MS = 600;
const PULSE_PERIOD_MS = 800;
const PULSE_SCALE = 0.06;
const LEVITATION_PERIOD_MS = 6000;
const LEVITATION_PX = 8;
/** Contact shadow centre below the core (user units). */
export const SHADOW_DROP = 102;
/** Ghost dots per node stream and their angular spacing per unit of extra speed (rad). */
export const STREAM_LENGTH = 5;
const STREAM_SPACING = 0.03;
/** A stored phase older than this is stale (another visit, not a hand-off). */
const HANDOFF_MAX_AGE_MS = 4000;

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Speed ramp: m eases from `from` to `to`, starting at `start` (performance.now() ms). */
export interface Ramp {
  readonly from: number;
  readonly to: number;
  readonly start: number;
}

export const IDLE_RAMP: Ramp = { from: IDLE_MULTIPLIER, to: IDLE_MULTIPLIER, start: 0 };

export function multiplierAt(ramp: Ramp, now: number): number {
  return ramp.from + (ramp.to - ramp.from) * easeInOutCubic(clamp01((now - ramp.start) / RAMP_MS));
}

/** A new ramp towards the busy or idle speed, starting from the current speed (no jump). */
export function rampTowards(current: Ramp, busy: boolean, now: number): Ramp {
  const to = busy ? BUSY_MULTIPLIER : IDLE_MULTIPLIER;
  if (current.to === to) return current;
  return { from: multiplierAt(current, now), to, start: now };
}

/** Motion state carried from frame to frame (and across a route change). */
export interface ScenePhase {
  /** Integrated orbit phase φ (s at 1×). */
  readonly phase: number;
  readonly ramp: Ramp;
  /** performance.now() of the frame that produced this phase. */
  readonly at: number;
  /** performance.now() when the first scene of this visit mounted: levitation and pulse time is relative to it. */
  readonly origin: number;
}

export function advance(state: ScenePhase, now: number): ScenePhase {
  const deltaMs = Math.min(Math.max(0, now - state.at), 100);
  // Midpoint speed keeps the integration smooth through the ramp.
  const speed = multiplierAt(state.ramp, now - deltaMs / 2);
  return { ...state, phase: state.phase + (deltaMs / 1000) * speed, at: now };
}

/*
 * Hand-off store: the scene on the page being left writes its phase every frame; the scene on the next page (the
 * workspace loading state, then the workspace) resumes from it in a layout effect, before its first paint. Module
 * scope is per document, so this survives client-side navigation only, which is exactly the hand-off window.
 */
let handoff: ScenePhase | null = null;

export function saveScenePhase(state: ScenePhase): void {
  handoff = state;
}

export function resumeScenePhase(now: number): ScenePhase | null {
  if (!handoff || now - handoff.at > HANDOFF_MAX_AGE_MS) return null;
  return advance(handoff, now);
}

/* ── Frame model ─────────────────────────────────────────────────────────────────────────────────────────────── */

export interface StreamDot {
  readonly cx: string;
  readonly cy: string;
  readonly opacity: string;
}

export interface NodeFrame {
  readonly id: NodeSpec['id'];
  readonly color: NodeSpec['color'];
  readonly transform: string;
  readonly opacity: string;
  readonly front: boolean;
  readonly stream: readonly StreamDot[];
}

export interface SceneFrame {
  readonly core: string;
  readonly bloomOpacity: string;
  readonly shadow: string;
  readonly shadowOpacity: string;
  readonly nodes: readonly NodeFrame[];
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/**
 * Everything the scene draws `elapsed` ms after the scene's origin, for phase φ and speed m. `reduced`: no levitation, pulse or streams.
 * Deterministic (fixed decimals), so the server-rendered first frame hydrates without a mismatch.
 */
export function sceneFrame(phase: number, multiplier: number, elapsed: number, reduced: boolean): SceneFrame {
  const busy = clamp01((multiplier - IDLE_MULTIPLIER) / (BUSY_MULTIPLIER - IDLE_MULTIPLIER));
  const lev = reduced ? 0 : Math.sin((2 * Math.PI * elapsed) / LEVITATION_PERIOD_MS);
  const pulse = reduced ? 0 : busy * PULSE_SCALE * (0.5 - 0.5 * Math.cos((2 * Math.PI * elapsed) / PULSE_PERIOD_MS));
  const cy = -LEVITATION_PX * lev;
  const nodes = NODES.map((node): NodeFrame => {
    const orbit = ORBITS[node.orbit];
    const a = orbit.a * ORBIT_SCALE;
    const b = orbit.b * ORBIT_SCALE;
    const omega = angularSpeed(orbit);
    const theta = node.theta + omega * phase;
    const point = ellipsePoint({ x: 0, y: cy }, a, b, orbit.tilt, theta);
    const near = (Math.sin(theta) + 1) / 2;
    const spacing = reduced ? 0 : STREAM_SPACING * (multiplier - IDLE_MULTIPLIER);
    const stream = [...Array(STREAM_LENGTH).keys()].map((index): StreamDot => {
      const lag = ellipsePoint({ x: 0, y: cy }, a, b, orbit.tilt, theta - spacing * (index + 1));
      return { cx: fixed(lag.x), cy: fixed(lag.y), opacity: fixed(busy * 0.55 * (1 - index / STREAM_LENGTH) * (0.4 + 0.6 * near)) };
    });
    return {
      id: node.id,
      color: node.color,
      transform: `translate(${fixed(point.x)} ${fixed(point.y)}) scale(${fixed(0.8 + 0.2 * near)})`,
      opacity: fixed(0.4 + 0.6 * near),
      front: Math.sin(theta) >= 0,
      stream,
    };
  });
  return {
    core: `translate(0 ${fixed(cy)}) scale(${(1 + pulse).toFixed(4)})`,
    bloomOpacity: fixed(0.75 + 0.25 * lev + busy * 0.15),
    shadow: `translate(0 ${String(SHADOW_DROP)}) scale(${fixed(1 - 0.12 * lev)})`,
    shadowOpacity: fixed(0.8 - 0.25 * lev),
    nodes,
  };
}

/** The first frame (server render and no-JavaScript fallback). */
export const FIRST_FRAME = sceneFrame(0, IDLE_MULTIPLIER, 0, true);
