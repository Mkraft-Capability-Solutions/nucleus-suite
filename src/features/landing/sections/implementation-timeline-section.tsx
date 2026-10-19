'use client';

/**
 * "No six-month rollout." Five rollout steps joined by a connector path. A dot travels along the path (start → end in
 * reading order) with scroll progress p: 0 when the steps' top is 85% down the viewport, 1 when it reaches 30%; its
 * position is path.getPointAtLength(p · L). Each step glows while the dot passes its badge and keeps a dimmer "done"
 * glow afterwards (steps behind the dot lit, ahead unlit). Geometry is measured on layout changes only
 * (timeline-geometry.ts), never in the frame loop. Scrolling back up runs the dot back.
 */
import { useRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { formatNumber } from '../i18n/format.js';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp, type Frame } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';
import { connectorThrough, stepState, type Connector } from '../implementation-timeline/timeline-geometry';
import { SectionHeader } from '../section-kit/section-header';

const STEPS = ['discovery', 'live', 'migration', 'configure', 'goLive'] as const;
const PROMISES = ['setup', 'enablement', 'person', 'optimisation'] as const;

interface Geometry {
  readonly connector: Connector;
  readonly length: number;
  /** Document Y of the steps' top. */
  readonly top: number;
}

export function ImplementationTimelineSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const lastDot = useRef(-1);
  useSectionMotion(sectionRef);

  const measure = (): void => {
    const track = trackRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!track || !svg || !path) return;
    const origin = track.getBoundingClientRect();
    // Offsets (not client rects), so the reveal transforms on the steps never skew the geometry.
    const centres = [...track.querySelectorAll<HTMLElement>('[data-step-badge]')].map((badge) => {
      let x = badge.offsetWidth / 2;
      let y = badge.offsetHeight / 2;
      let node: HTMLElement | null = badge;
      while (node && node !== track) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
      }
      return { x, y };
    });
    const connector = connectorThrough(centres);
    if (!connector) return;
    svg.setAttribute('viewBox', `0 0 ${origin.width.toFixed(1)} ${origin.height.toFixed(1)}`);
    for (const line of svg.querySelectorAll('.tl-line')) line.setAttribute('d', connector.d);
    geometryRef.current = { connector, length: path.getTotalLength(), top: origin.top + window.scrollY };
    lastDot.current = -1;
  };

  const render = (frame: Frame): void => {
    const geometry = geometryRef.current;
    const track = trackRef.current;
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!geometry || !track || !path || !dot) return;
    const vh = frame.viewportHeight;
    const p = clamp((0.85 * vh - (geometry.top - frame.scroll)) / (0.55 * vh));
    const along = p * geometry.length;
    if (Math.abs(along - lastDot.current) < 0.25) return;
    lastDot.current = along;
    const point = path.getPointAtLength(along);
    dot.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    trailRef.current?.style.setProperty('stroke-dashoffset', String(1 - p));
    track.querySelectorAll<HTMLElement>('[data-step]').forEach((step, index) => {
      const stop = geometry.connector.stops[index] ?? 0;
      const state = stepState(along, stop, geometry.connector.halfWindow);
      if (step.dataset.state !== state) step.dataset.state = state;
    });
  };

  useScene(sectionRef, (frame) => {
    render(frame);
  }, { onMeasure: measure });

  return (
    <section ref={sectionRef} className="lp-section impl lp-motion-root" id="implementation" aria-labelledby="impl-title">
      <div className="lp-glow" data-parallax-glow="0.24" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <SectionHeader kicker={t('impl.pill')} title={t('impl.title')} titleId="impl-title" lead={t('impl.lead')} />
          <div className="tl" ref={trackRef}>
            <svg ref={svgRef} className="tl-path" aria-hidden="true" focusable="false">
              <path ref={pathRef} className="tl-line" />
              <path ref={trailRef} className="tl-line tl-line-trail" pathLength="1" />
              <g ref={dotRef} className="tl-dot">
                <circle r="14" className="tl-dot-halo" />
                <circle r="6" className="tl-dot-core" />
              </g>
            </svg>
            <ol className="tl-list">
              {STEPS.map((id, index) => (
                <li className="st" key={id} data-step="" data-state="idle" data-reveal-item="">
                  <div className="nn" data-step-badge="" aria-hidden="true">
                    {formatNumber(index + 1)}
                  </div>
                  <h3>{t(`impl.steps.${id}.title`)}</h3>
                  <p>{t(`impl.steps.${id}.text`)}</p>
                  <span className="w">{t(`impl.steps.${id}.when`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <ul className="promise">
            {PROMISES.map((id) => (
              <li key={id} className="lp-lift" data-reveal-item="">
                <Check aria-hidden="true" />
                {t(`impl.promises.${id}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
