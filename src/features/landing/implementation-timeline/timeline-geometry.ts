/**
 * Timeline connector geometry (pure). The connector runs through the centres of the step badges, in DOM (reading)
 * order, extended by half a step spacing past the first and last badge so the travelling dot starts before step 1 and
 * leaves the last step behind at p = 1. Works for a row (desktop) or a column (stacked steps).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Connector {
  readonly d: string;
  /** Path length at each badge centre. */
  readonly stops: readonly number[];
  /** Half of the glow window around each stop (path length units). */
  readonly halfWindow: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export function connectorThrough(centres: readonly Point[]): Connector | null {
  if (centres.length < 2) return null;
  const first = centres[0];
  const second = centres[1];
  const last = centres[centres.length - 1];
  const beforeLast = centres[centres.length - 2];
  const extend = (from: Point, toward: Point): Point => ({ x: from.x + (from.x - toward.x) / 2, y: from.y + (from.y - toward.y) / 2 });
  const points = [extend(first, second), ...centres, extend(last, beforeLast)];
  const d = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const stops: number[] = [];
  let length = 0;
  for (let index = 1; index < points.length - 1; index++) {
    length += distance(points[index - 1], points[index]);
    stops.push(length);
  }
  return { d, stops, halfWindow: distance(first, second) * 0.32 };
}

/** Glow state of a step whose badge sits at `stop` when the dot is at `dot` (path length). */
export function stepState(dot: number, stop: number, halfWindow: number): 'active' | 'done' | 'idle' {
  if (Math.abs(dot - stop) <= halfWindow) return 'active';
  return dot > stop ? 'done' : 'idle';
}
