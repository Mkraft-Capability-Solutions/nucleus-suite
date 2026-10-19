/**
 * Flow board geometry and timing (pure). The hub is a circle of radius R (the centre line of its outer gradient ring)
 * centred at C. Six ports sit on the ring on the task side and six on the result side, at angles fanned ±35° around
 * the horizontal (step s = 14°), top to bottom in row order:
 *   task side (π when tasks are on the left):   φᵢ = π + (2.5 − i)·s        port Pᵢ = C + R·(cos φᵢ, sin φᵢ)
 *   result side (0 when results are on the right): ψᵢ = −(2.5 − i)·s
 * Connectors are cubic Béziers that leave the card edge horizontally and arrive at the port radially:
 *   in:  M(card edge) C(card edge ± 60, y) (Pᵢ + 56·n̂ᵢ) (Pᵢ)          n̂ᵢ = outward unit normal at the port
 *   out: M(Pᵢ) C(Pᵢ + 56·n̂ᵢ) (card edge ∓ 60, y) (card edge)
 * and the pulse crosses the hub on a quadratic bent toward the centre: M(Pᵢ) Q(C) (Qᵢ), Qᵢ the matching result port.
 */

export const FLOW_PAIRS = [
  { id: 'applications', icon: 'doc' },
  { id: 'documents', icon: 'doc' },
  { id: 'attendance', icon: 'clock' },
  { id: 'leave', icon: 'calendar' },
  { id: 'payroll', icon: 'wallet' },
  { id: 'reviews', icon: 'target' },
] as const;

export type FlowPairId = (typeof FLOW_PAIRS)[number]['id'];

/** Pulse timeline (ms from the run's start). */
export const PULSE = {
  /** Card → task-side port along the amber connector. */
  inEnd: 650,
  /** Through the hub, port to port (the ring spins up, the disc glows). */
  coreEnd: 1250,
  /** Result-side port → result card along the teal connector. */
  outEnd: 1900,
  /** The run stays highlighted until here, then the board returns to idle. */
  settleEnd: 2500,
} as const;

/** Auto-cycle interval between run starts (ms). */
export const AUTO_INTERVAL = 2600;

/** Angular step between neighbouring ports (rad). */
const PORT_STEP = (14 * Math.PI) / 180;
/** Radial handle length of the connector at its port (px). */
const PORT_HANDLE = 56;
/** Horizontal handle length of the connector at its card (px). */
const CARD_HANDLE = 60;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Port extends Point {
  /** Outward unit normal. */
  readonly nx: number;
  readonly ny: number;
}

/** Layout box of `element` relative to `ancestor` from offset* values (ignores transforms, so reveals don't skew it). */
export function boxWithin(element: HTMLElement, ancestor: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return { x, y, w: element.offsetWidth, h: element.offsetHeight };
}

/** Port i on the given side of the hub. `side` −1 = left half, +1 = right half (physical). */
export function portAt(center: Point, radius: number, index: number, side: -1 | 1): Port {
  const offset = (2.5 - index) * PORT_STEP;
  const angle = side < 0 ? Math.PI + offset : -offset;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  return { x: center.x + radius * nx, y: center.y + radius * ny, nx, ny };
}

/** Connector from a card (its edge facing the hub) to a port. */
export function cardToPort(card: Box, port: Port): string {
  const towardHub = port.x > card.x + card.w / 2 ? 1 : -1;
  const x1 = towardHub > 0 ? card.x + card.w : card.x;
  const y1 = card.y + card.h / 2;
  return `M${x1},${y1} C${x1 + CARD_HANDLE * towardHub},${y1} ${port.x + PORT_HANDLE * port.nx},${port.y + PORT_HANDLE * port.ny} ${port.x},${port.y}`;
}

/** Connector from a port to a card (reverse direction of travel). */
export function portToCard(port: Port, card: Box): string {
  const awayFromHub = card.x + card.w / 2 > port.x ? 1 : -1;
  const x2 = awayFromHub > 0 ? card.x : card.x + card.w;
  const y2 = card.y + card.h / 2;
  return `M${port.x},${port.y} C${port.x + PORT_HANDLE * port.nx},${port.y + PORT_HANDLE * port.ny} ${x2 - CARD_HANDLE * awayFromHub},${y2} ${x2},${y2}`;
}

/** The pulse's crossing through the hub, port to port via the centre. */
export function throughHub(from: Point, center: Point, to: Point): string {
  return `M${from.x},${from.y} Q${center.x},${center.y} ${to.x},${to.y}`;
}
