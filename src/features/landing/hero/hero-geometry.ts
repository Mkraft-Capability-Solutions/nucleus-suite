/**
 * Hero scene geometry (pure functions, no DOM). Units: px in stage space, radians, seconds.
 *
 * Orbits are true ellipses (semi-axes a, b) rotated by a tilt in the screen plane. A node at parameter θ sits at
 *   x = cx + a·cosθ·cos(tilt) − b·sinθ·sin(tilt),  y = cy + a·cosθ·sin(tilt) + b·sinθ·cos(tilt)
 * and its depth is z = sinθ (−1 far … +1 near): near nodes are larger, more opaque and drawn in front of the core.
 * Angular speed follows Kepler's third law (T² ∝ a³ ⇒ ω ∝ a^−1.5), normalised so the outer orbit turns once in 70 s.
 * Orbit length for the draw-in dash uses Ramanujan's perimeter approximation
 *   P ≈ π·(3(a + b) − √((3a + b)(a + 3b))).
 */

export interface OrbitSpec {
  /** Semi-major axis at reference scale (px). */
  readonly a: number;
  /** Semi-minor axis at reference scale (px). */
  readonly b: number;
  /** Screen-plane rotation (rad). */
  readonly tilt: number;
  /** Dashed (secondary) orbit. */
  readonly dashed: boolean;
}

/** Reference stage width the radii are designed for (the approved mock-up's 6-column stage at 1440 px). */
export const REFERENCE_STAGE_WIDTH = 628;
/** Outer orbit period (s). */
const OUTER_PERIOD = 70;

export const ORBITS: readonly OrbitSpec[] = [
  { a: 262, b: 78, tilt: -0.34, dashed: false },
  { a: 204, b: 136, tilt: 0.52, dashed: true },
];

/** Kepler angular speed (rad/s) of an orbit. */
export function angularSpeed(orbit: OrbitSpec): number {
  const outer = ORBITS[0]?.a ?? orbit.a;
  return ((2 * Math.PI) / OUTER_PERIOD) * (outer / orbit.a) ** 1.5;
}

/** Ramanujan's approximation of an ellipse perimeter. */
export function ellipsePerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Position of parameter θ on a tilted ellipse centred at c. */
export function ellipsePoint(center: Point, a: number, b: number, tilt: number, theta: number): Point {
  const ex = a * Math.cos(theta);
  const ey = b * Math.sin(theta);
  return {
    x: center.x + ex * Math.cos(tilt) - ey * Math.sin(tilt),
    y: center.y + ex * Math.sin(tilt) + ey * Math.cos(tilt),
  };
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Axis-aligned overlap test with a clearance margin. */
export function overlaps(first: Rect, second: Rect, pad = 8): boolean {
  return (
    first.x < second.x + second.w + pad &&
    first.x + first.w + pad > second.x &&
    first.y < second.y + second.h + pad &&
    first.y + first.h + pad > second.y
  );
}

/** Module nodes: catalog module id, identity colour token, orbit index and starting angle (rad). */
export const NODES = [
  { id: 'hire', color: 'sky', orbit: 0, theta: 0 },
  { id: 'onboard', color: 'emerald', orbit: 0, theta: 1.26 },
  { id: 'pay', color: 'amber', orbit: 0, theta: 2.51 },
  { id: 'perform', color: 'violet', orbit: 0, theta: 3.77 },
  { id: 'manage', color: 'cyan', orbit: 0, theta: 5.03 },
  { id: 'engage', color: 'rose', orbit: 1, theta: 0.5 },
  { id: 'support', color: 'indigo', orbit: 1, theta: 2.6 },
  { id: 'grow', color: 'emerald', orbit: 1, theta: 4.7 },
] as const;

export type NodeSpec = (typeof NODES)[number];

/** Status cards: anchor as a fraction of the stage (inline-start, top). */
export const CARDS = [
  { id: 'hire', fx: 0.04, fy: 0.08 },
  { id: 'perform', fx: 0.6, fy: 0.2 },
  { id: 'pay', fx: 0.02, fy: 0.68 },
  { id: 'volt', fx: 0.58, fy: 0.82 },
] as const;

/** Chaos labels (catalog keys chaos.*): the loose requests the core pulls into order as the hero scrolls. */
export const CHAOS = ['leave', 'punch', 'offer', 'review', 'payslip', 'survey', 'expense', 'document', 'shift', 'policy'] as const;

export type ChaosId = (typeof CHAOS)[number];

export interface ChaosAnchor {
  readonly id: ChaosId;
  /** −1…1 of the stage's free half-width (inline axis, left → right). */
  readonly fx: number;
  /** −1…1 of the stage's free half-height. */
  readonly fy: number;
}

/** Golden angle (rad): successive labels turn by it, so no two neighbours in the list cluster together. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Seed rotation of the spiral (rad), chosen so the first labels clear the four status-card corners. */
const CHAOS_SEED = 0.42;
/** Inner and outer radius of the scatter ring as a share of the free half-extent (inner keeps clear of the core). */
const CHAOS_INNER = 0.5;
const CHAOS_OUTER = 0.96;

/**
 * Deterministic scatter (a Vogel / golden-angle spiral squeezed into a ring around the core; no randomness, so server
 * and client render the same layout). Label i sits at angle seed + i·φ (φ the golden angle) and radius
 * inner + (outer − inner)·√((i + ½)/n), which spreads the labels evenly over the ring's area.
 */
export function chaosLayout(): readonly ChaosAnchor[] {
  const count = CHAOS.length;
  return CHAOS.map((id, index) => {
    const angle = CHAOS_SEED + index * GOLDEN_ANGLE;
    const radius = CHAOS_INNER + (CHAOS_OUTER - CHAOS_INNER) * Math.sqrt((index + 0.5) / count);
    const round = (value: number): number => Math.round(value * 1e4) / 1e4;
    return { id, fx: round(radius * Math.cos(angle)), fy: round(radius * Math.sin(angle)) };
  });
}

/** Exponential approach of `value` to `target` with time constant tau (ms): frame-rate independent smoothing. */
export function approach(value: number, target: number, deltaMs: number, tauMs: number): number {
  return target + (value - target) * Math.exp(-deltaMs / tauMs);
}
