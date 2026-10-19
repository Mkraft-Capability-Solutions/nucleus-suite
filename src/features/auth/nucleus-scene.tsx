'use client';

/**
 * The Nucleus scene without the hero's status cards: the levitating sphere, its two orbits and the module nodes,
 * drawn in one SVG that scales to its box (fixed viewBox, so no layout reads). Decorative (aria-hidden).
 *
 * `busy` is the shared control: true eases the orbits up to 6× with a pulsing core and streaming nodes (see
 * scene-motion.ts); false eases back to 1×. The phase is handed to the next scene on client-side navigation, so the
 * log in → workspace loading → workspace sequence keeps one continuous motion.
 *
 * Nodes behind the core (sin θ < 0) are drawn in the back layer, the others in the front layer: every node exists in
 * both layers and the frame loop toggles which copy is visible, so React never has to move DOM nodes.
 * Reduced motion: one static frame, no loop.
 */
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  FIRST_FRAME,
  IDLE_RAMP,
  ORBIT_SCALE,
  VIEW_BOX,
  advance,
  multiplierAt,
  rampTowards,
  resumeScenePhase,
  saveScenePhase,
  sceneFrame,
  type NodeFrame,
  type ScenePhase,
  type SceneFrame,
} from './scene-motion';
import { ORBITS } from '@/features/landing/hero/hero-geometry';
import styles from './nucleus-scene.module.css';

/** Product name on the sphere; a brand name, never translated. */
const PRODUCT_NAME = 'Nucleus';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const RAD_TO_DEG = 180 / Math.PI;

const NODE_CLASS: Readonly<Record<NodeFrame['color'], string | undefined>> = {
  sky: styles.nodeSky,
  violet: styles.nodeViolet,
  emerald: styles.nodeEmerald,
  amber: styles.nodeAmber,
  rose: styles.nodeRose,
  indigo: styles.nodeIndigo,
  cyan: styles.nodeCyan,
};

export interface NucleusSceneProps {
  /** Revolve fast (a request is in flight or the next page is loading). */
  readonly busy: boolean;
  readonly className?: string;
}

interface NodeCopy {
  readonly group: SVGGElement;
  readonly body: SVGGElement | null;
  readonly dots: readonly SVGCircleElement[];
}

/** Elements the frame loop writes to (queried once per mount). */
interface Parts {
  readonly core: Element | null;
  readonly bloom: Element | null;
  readonly shadow: Element | null;
  readonly back: readonly NodeCopy[];
  readonly front: readonly NodeCopy[];
}

function NodeGlyph({ node, layer }: { readonly node: NodeFrame; readonly layer: 'back' | 'front' }): ReactNode {
  const visible = node.front === (layer === 'front');
  return (
    <g className={NODE_CLASS[node.color]} data-node={node.id} visibility={visible ? 'visible' : 'hidden'}>
      {node.stream.map((dot, index) => (
        <circle key={index} className={styles.streamDot} cx={dot.cx} cy={dot.cy} r={5 - 0.7 * index} opacity={dot.opacity} />
      ))}
      <g data-node-body="" transform={node.transform} opacity={node.opacity}>
        <circle className={styles.nodeHalo} r="28" />
        <circle className={styles.nodeRing} r="18" />
        <circle className={styles.nodeDot} r="6" />
      </g>
    </g>
  );
}

function copies(svg: SVGSVGElement, layer: 'back' | 'front'): NodeCopy[] {
  return Array.from(svg.querySelectorAll<SVGGElement>(`[data-layer="${layer}"] > [data-node]`), (group) => ({
    group,
    body: group.querySelector<SVGGElement>('[data-node-body]'),
    dots: Array.from(group.querySelectorAll<SVGCircleElement>(':scope > circle')),
  }));
}

function collect(svg: SVGSVGElement): Parts {
  return {
    core: svg.querySelector('[data-core]'),
    bloom: svg.querySelector('[data-bloom]'),
    shadow: svg.querySelector('[data-shadow]'),
    back: copies(svg, 'back'),
    front: copies(svg, 'front'),
  };
}

function apply(parts: Parts, frame: SceneFrame): void {
  parts.core?.setAttribute('transform', frame.core);
  parts.bloom?.setAttribute('opacity', frame.bloomOpacity);
  parts.shadow?.setAttribute('transform', frame.shadow);
  parts.shadow?.setAttribute('opacity', frame.shadowOpacity);
  frame.nodes.forEach((node, index) => {
    for (const [copy, visible] of [
      [parts.back[index], !node.front],
      [parts.front[index], node.front],
    ] as const) {
      copy.group.setAttribute('visibility', visible ? 'visible' : 'hidden');
      if (!visible) continue;
      copy.body?.setAttribute('transform', node.transform);
      copy.body?.setAttribute('opacity', node.opacity);
      node.stream.forEach((dot, dotIndex) => {
        const circle = copy.dots[dotIndex];
        circle.setAttribute('cx', dot.cx);
        circle.setAttribute('cy', dot.cy);
        circle.setAttribute('opacity', dot.opacity);
      });
    }
  });
}

export function NucleusScene({ busy, className }: NucleusSceneProps): ReactNode {
  const svgRef = useRef<SVGSVGElement>(null);
  const partsRef = useRef<Parts | null>(null);
  const stateRef = useRef<ScenePhase | null>(null);
  const reducedRef = useRef(false);
  const busyRef = useRef(busy);
  const ids = useId();
  const gradient = (name: string): string => `${ids}-${name}`;

  // Resume a hand-off (or start fresh) and draw that frame before the first paint.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const parts = collect(svg);
    partsRef.current = parts;
    reducedRef.current = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const now = performance.now();
    const resumed = resumeScenePhase(now) ?? { phase: 0, ramp: IDLE_RAMP, at: now, origin: now };
    const state: ScenePhase = { ...resumed, ramp: rampTowards(resumed.ramp, busyRef.current, now) };
    stateRef.current = state;
    apply(parts, sceneFrame(state.phase, multiplierAt(state.ramp, now), now - state.origin, reducedRef.current));
  }, []);

  // The busy control: ease towards the new speed from the current one.
  useEffect(() => {
    busyRef.current = busy;
    const state = stateRef.current;
    if (state) stateRef.current = { ...state, ramp: rampTowards(state.ramp, busy, performance.now()) };
  }, [busy]);

  // Frame loop (none under reduced motion; re-evaluated when the preference changes).
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    let handle = 0;
    const tick = (now: number): void => {
      const previous = stateRef.current;
      if (!previous) return;
      const state = advance(previous, now);
      stateRef.current = state;
      saveScenePhase(state);
      apply(parts, sceneFrame(state.phase, multiplierAt(state.ramp, now), now - state.origin, reducedRef.current));
      handle = requestAnimationFrame(tick);
    };
    const start = (): void => {
      cancelAnimationFrame(handle);
      reducedRef.current = query.matches;
      const state = stateRef.current;
      if (query.matches) {
        if (state) apply(parts, sceneFrame(state.phase, 1, 0, true));
        return;
      }
      if (state) stateRef.current = { ...state, at: performance.now() };
      handle = requestAnimationFrame(tick);
    };
    start();
    query.addEventListener('change', start);
    return () => {
      query.removeEventListener('change', start);
      cancelAnimationFrame(handle);
    };
  }, []);

  return (
    <svg ref={svgRef} className={[styles.scene, className].filter(Boolean).join(' ')} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={gradient('bloom')}>
          <stop offset="0" className={styles.stopGlowStrong} />
          <stop offset="0.55" className={styles.stopGlowSoft} />
          <stop offset="1" className={styles.stopGlowNone} />
        </radialGradient>
        <radialGradient id={gradient('body')} cx="0.42" cy="0.4" r="0.62">
          <stop offset="0" className={styles.stopBody} />
          <stop offset="0.52" className={styles.stopMid} />
          <stop offset="1" className={styles.stopDeep} />
        </radialGradient>
        <radialGradient id={gradient('light')} cx="0.52" cy="0.88" r="0.44">
          <stop offset="0" className={styles.stopLight} />
          <stop offset="0.36" className={styles.stopLightSoft} />
          <stop offset="1" className={styles.stopLightNone} />
        </radialGradient>
        <radialGradient id={gradient('specular')} cx="0.33" cy="0.26" r="0.16">
          <stop offset="0" className={styles.stopSpecular} />
          <stop offset="0.3" className={styles.stopSpecularSoft} />
          <stop offset="1" className={styles.stopSpecularNone} />
        </radialGradient>
        <radialGradient id={gradient('shadow')}>
          <stop offset="0" className={styles.stopShadow} />
          <stop offset="1" className={styles.stopShadowNone} />
        </radialGradient>
      </defs>

      <g data-shadow="" transform={FIRST_FRAME.shadow} opacity={FIRST_FRAME.shadowOpacity}>
        <ellipse rx="68" ry="11" fill={`url(#${gradient('shadow')})`} />
      </g>
      <circle data-bloom="" className={styles.bloom} r="196" fill={`url(#${gradient('bloom')})`} opacity={FIRST_FRAME.bloomOpacity} />

      {ORBITS.map((orbit, index) => (
        <ellipse
          key={index}
          className={orbit.dashed ? styles.orbitDashed : styles.orbit}
          rx={orbit.a * ORBIT_SCALE}
          ry={orbit.b * ORBIT_SCALE}
          transform={`rotate(${(orbit.tilt * RAD_TO_DEG).toFixed(2)})`}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <g data-layer="back">
        {FIRST_FRAME.nodes.map((node) => (
          <NodeGlyph key={node.id} node={node} layer="back" />
        ))}
      </g>

      <g data-core="" transform={FIRST_FRAME.core}>
        <circle className={styles.halo} r="81" />
        <circle className={styles.haloMid} r="104" />
        <circle className={styles.haloOuter} r="130" />
        <circle className={styles.sphereGlow} r="61" />
        <circle r="58" fill={`url(#${gradient('body')})`} />
        <circle r="58" fill={`url(#${gradient('light')})`} />
        <circle r="58" fill={`url(#${gradient('specular')})`} />
        <circle className={styles.sphereRim} r="57.5" />
        <text className={styles.label} textAnchor="middle" dominantBaseline="central">
          {PRODUCT_NAME}
        </text>
      </g>

      <g data-layer="front">
        {FIRST_FRAME.nodes.map((node) => (
          <NodeGlyph key={node.id} node={node} layer="front" />
        ))}
      </g>
    </svg>
  );
}

