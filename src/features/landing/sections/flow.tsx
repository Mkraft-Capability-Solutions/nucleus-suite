'use client';

/**
 * Section 3 · "From chaos to clarity" (original content and layout). Six manual tasks on the start side, the Nucleus
 * hub in the middle and six automated results on the end side. The hub: an outer Horizon-gradient ring (gold → sky →
 * indigo → violet) carrying twelve ports, an inner dashed ring, and a disc with an icon chip, the gradient italic
 * "Nucleus", the live status in spaced caps and a "{done} of 06 tasks automated" count. Smooth connectors join each
 * task to its port (amber) and each result-side port to its result (teal), measured from the layout and recomputed
 * on resize (flow-geometry.ts has the maths).
 *
 * Clicking a task (or Enter / Space on it) sends a glowing pulse card → port → through the hub (the ring spins up, the
 * disc glows, the status reads "processing") → result-side port → result card, which lights up. Pulse positions use
 * getTotalLength / getPointAtLength eased with the shared quartic ease-in-out. While the board is in view and idle,
 * the tasks run on their own every 2.6 s (paused on hover, on focus inside the board and under reduced motion, where
 * a click lights the result at once). Rows reveal in a stagger as the section enters; the heading splits into lines.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Calendar, Check, Clock, FileText, Target, Wallet, Workflow, type LucideIcon } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { approach } from '../hero/hero-geometry';
import { clamp, easeInOut, easeOut, enterProgress, range, type Frame, type SceneBox } from '../motion/scroll-engine';
import { SectionHeading } from '../components/section-heading';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';
import { AUTO_INTERVAL, FLOW_PAIRS, PULSE, boxWithin, cardToPort, portAt, portToCard, throughHub, type Port } from '../flow/flow-geometry';

const ICONS: Readonly<Record<(typeof FLOW_PAIRS)[number]['icon'], LucideIcon>> = {
  doc: FileText,
  clock: Clock,
  calendar: Calendar,
  wallet: Wallet,
  target: Target,
};

type Status = 'orchestrating' | 'processing' | 'done';
type Phase = 'in' | 'core' | 'out' | 'settle';

interface Run {
  readonly index: number;
  readonly start: number;
  /** Started by the visitor (announced) rather than by the auto-cycle. */
  readonly user: boolean;
  phase: Phase;
}

/** Ring drift (deg/s) at rest and the extra spin while the hub orchestrates: a slight, eased turn. */
const RING_SPEED = 6;
const RING_BOOST = 72;
const GLOW_TAU = 160;
/** Ring stroke width (px): ports sit on its centre line. */
const RING_WIDTH = 3;
const TOTAL = FLOW_PAIRS.length;

export function Flow(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const pulseRef = useRef<SVGGElement>(null);
  const crossRef = useRef<SVGPathElement>(null);
  const taskRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inRefs = useRef<(SVGPathElement | null)[]>([]);
  const outRefs = useRef<(SVGPathElement | null)[]>([]);
  const inPortRefs = useRef<(SVGGElement | null)[]>([]);
  const outPortRefs = useRef<(SVGGElement | null)[]>([]);
  const revealRefs = useRef<(HTMLLIElement | null)[]>([]);
  const portsRef = useRef<{ readonly inPorts: Port[]; readonly outPorts: Port[]; readonly center: { x: number; y: number } } | null>(null);

  const runRef = useRef<Run | null>(null);
  const pendingRef = useRef<{ index: number; user: boolean } | null>(null);
  const lastStartRef = useRef(Number.NEGATIVE_INFINITY);
  const nextRef = useRef(0);
  const pausedRef = useRef(false);
  const glowValueRef = useRef(0);
  const angleRef = useRef(0);

  const [active, setActive] = useState<number | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const [status, setStatus] = useState<Status>('orchestrating');
  const [announcement, setAnnouncement] = useState('');

  useSectionMotion(sectionRef);

  const measure = (): void => {
    const board = boardRef.current;
    const svg = svgRef.current;
    const hub = hubRef.current;
    if (!board || !svg || !hub) return;
    const rtl = getComputedStyle(board).direction === 'rtl';
    const hubBox = boxWithin(hub, board);
    const center = { x: hubBox.x + hubBox.w / 2, y: hubBox.y + hubBox.h / 2 };
    const radius = hubBox.w / 2 - RING_WIDTH / 2;
    const taskSide: -1 | 1 = rtl ? 1 : -1;
    const resultSide: -1 | 1 = rtl ? -1 : 1;
    svg.setAttribute('viewBox', `0 0 ${board.offsetWidth} ${board.offsetHeight}`);
    const inPorts: Port[] = [];
    const outPorts: Port[] = [];
    FLOW_PAIRS.forEach((_, i) => {
      const inPort = portAt(center, radius, i, taskSide);
      const outPort = portAt(center, radius, i, resultSide);
      inPorts.push(inPort);
      outPorts.push(outPort);
      const task = taskRefs.current[i];
      const result = resultRefs.current[i];
      inRefs.current[i]?.setAttribute('d', task ? cardToPort(boxWithin(task, board), inPort) : '');
      outRefs.current[i]?.setAttribute('d', result ? portToCard(outPort, boxWithin(result, board)) : '');
      inPortRefs.current[i]?.setAttribute('transform', `translate(${inPort.x} ${inPort.y})`);
      outPortRefs.current[i]?.setAttribute('transform', `translate(${outPort.x} ${outPort.y})`);
    });
    portsRef.current = { inPorts, outPorts, center };
  };

  const finish = (run: Run): void => {
    const pair = FLOW_PAIRS[run.index];
    setLit(run.index);
    setDone((previous) => (previous.has(run.index) ? previous : new Set(previous).add(run.index)));
    setStatus('done');
    if (run.user && pair) {
      setAnnouncement(t('flow.announce', { task: t(`flow.pairs.${pair.id}.task`), result: t(`flow.pairs.${pair.id}.result`) }));
    }
  };

  const start = (index: number, time: number, user: boolean, reduced: boolean): void => {
    const run: Run = { index, start: time, user, phase: reduced ? 'settle' : 'in' };
    runRef.current = run;
    lastStartRef.current = time;
    nextRef.current = (index + 1) % TOTAL;
    setActive(index);
    setLit(null);
    const ports = portsRef.current;
    const from = ports?.inPorts[index];
    const to = ports?.outPorts[index];
    if (ports && from && to) crossRef.current?.setAttribute('d', throughHub(from, ports.center, to));
    if (reduced) finish(run);
    else setStatus('orchestrating');
  };

  const placePulse = (path: SVGPathElement | null | undefined, progress: number): void => {
    const pulse = pulseRef.current;
    if (!pulse || !path) return;
    const length = path.getTotalLength();
    const point = path.getPointAtLength(length * progress);
    pulse.setAttribute('transform', `translate(${point.x} ${point.y})`);
  };

  const update = (frame: Frame, box: SceneBox): void => {
    // Staggered entrance of the rows (from their own side) and the hub.
    const s = frame.reduced ? 1 : enterProgress(box, frame);
    revealRefs.current.forEach((row, i) => {
      if (!row) return;
      const order = i % TOTAL;
      const side = i < TOTAL ? -1 : 1;
      const p = easeOut(range(s, 0.1 + 0.06 * order, 0.5 + 0.06 * order));
      row.style.opacity = String(p);
      row.style.transform = `translateX(${side * 16 * (1 - p)}px)`;
    });
    const hubIn = easeOut(range(s, 0.2, 0.7));
    if (hubRef.current) {
      hubRef.current.style.opacity = String(hubIn);
      hubRef.current.style.transform = `scale(${0.9 + 0.1 * hubIn})`;
    }

    // Queued visitor run, else the auto-cycle (in view, idle, not paused, motion allowed).
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      start(pending.index, frame.time, pending.user, frame.reduced);
    } else {
      const visible = box.top - frame.scroll < frame.viewportHeight * 0.75 && box.top + box.height - frame.scroll > frame.viewportHeight * 0.25;
      if (visible && runRef.current === null && !pausedRef.current && !frame.reduced && frame.time - lastStartRef.current >= AUTO_INTERVAL) {
        start(nextRef.current, frame.time, false, false);
      }
    }

    // Pulse state machine: card → port → through the hub → port → card.
    const run = runRef.current;
    const pulse = pulseRef.current;
    let orchestrating = 0;
    if (run && pulse) {
      const local = frame.time - run.start;
      if (run.phase === 'in') {
        placePulse(inRefs.current[run.index], easeInOut(clamp(local / PULSE.inEnd)));
        pulse.style.opacity = '1';
        if (local >= PULSE.inEnd) {
          run.phase = 'core';
          setStatus('processing');
        }
      } else if (run.phase === 'core') {
        orchestrating = 1;
        placePulse(crossRef.current, easeInOut(clamp((local - PULSE.inEnd) / (PULSE.coreEnd - PULSE.inEnd))));
        pulse.style.opacity = '0.85';
        if (local >= PULSE.coreEnd) run.phase = 'out';
      } else if (run.phase === 'out') {
        placePulse(outRefs.current[run.index], easeInOut(clamp((local - PULSE.coreEnd) / (PULSE.outEnd - PULSE.coreEnd))));
        pulse.style.opacity = '1';
        if (local >= PULSE.outEnd) {
          run.phase = 'settle';
          pulse.style.opacity = '0';
          finish(run);
        }
      } else if (local >= PULSE.settleEnd) {
        runRef.current = null;
        setActive(null);
        setStatus('orchestrating');
      }
    } else if (pulse) {
      pulse.style.opacity = '0';
    }

    // Ring: a slow drift that spins up while orchestrating; the disc glow rises with it (τ = 160 ms).
    glowValueRef.current = frame.reduced ? 0 : approach(glowValueRef.current, orchestrating, frame.delta, GLOW_TAU);
    if (!frame.reduced) angleRef.current = (angleRef.current + ((RING_SPEED + RING_BOOST * glowValueRef.current) * frame.delta) / 1000) % 360;
    if (ringRef.current) ringRef.current.style.transform = `rotate(${angleRef.current}deg)`;
    if (glowRef.current) {
      glowRef.current.style.opacity = String(0.3 + 0.7 * glowValueRef.current);
      glowRef.current.style.transform = `scale(${1 + 0.1 * glowValueRef.current})`;
    }
  };

  useScene(sectionRef, update, { onMeasure: measure });

  const runTask = (index: number): void => {
    // Picked up on the next engine frame (the section is on screen, so its scene is active).
    pendingRef.current = { index, user: true };
  };

  const setPaused = (paused: boolean): void => {
    pausedRef.current = paused;
  };

  const twoDigits = (value: number): string => new Intl.NumberFormat(t.locale, { minimumIntegerDigits: 2 }).format(value);

  return (
    <section ref={sectionRef} id="flow" className="lp-section lp-flow lp-motion-root" aria-labelledby="flow-title">
      <div className="lp-glow" data-parallax-glow="0.25" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-flow-head">
          <p className="lp-kicker" data-reveal-item="">{t('flow.pill')}</p>
          <SectionHeading text={t('flow.title')} id="flow-title" />
          <p className="lp-lead" data-reveal-item="">{t('flow.lead')}</p>
        </div>
        <div className="lp-flow-panel">
          <div
            ref={boardRef}
            className="lp-flow-board"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
            }}
          >
            <div className="lp-flow-col lp-flow-today">
              <h3 className="lp-flow-col-title">{t('flow.today')}</h3>
              <ul>
                {FLOW_PAIRS.map((pair, i) => {
                  const Icon = ICONS[pair.icon];
                  return (
                    <li
                      key={pair.id}
                      ref={(element) => {
                        revealRefs.current[i] = element;
                      }}
                    >
                      <button
                        type="button"
                        ref={(element) => {
                          taskRefs.current[i] = element;
                        }}
                        className={`lp-task${active === i ? ' is-active' : ''}`}
                        onClick={() => runTask(i)}
                      >
                        <span className="lp-row-icon" aria-hidden="true"><Icon /></span>
                        <span className="lp-row-label">{t(`flow.pairs.${pair.id}.task`)}</span>
                        <span className="lp-badge-pending">{t(`flow.pairs.${pair.id}.today`)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="lp-flow-core-cell">
              <div ref={hubRef} className="lp-hub">
                <span ref={glowRef} className="lp-hub-glow" aria-hidden="true" />
                <span ref={ringRef} className="lp-hub-ring" aria-hidden="true" />
                <span className="lp-hub-dashed" aria-hidden="true" />
                <span className="lp-hub-disc">
                  <span className="lp-hub-chip" aria-hidden="true"><Workflow /></span>
                  <b className="lp-hub-word">{t('hero.coreName')}</b>
                  <small className="lp-hub-status" aria-hidden="true">{t(`flow.status.${status}`)}</small>
                  <span className="lp-hub-count">{t('flow.count', { done: twoDigits(done.size), total: twoDigits(TOTAL) })}</span>
                </span>
              </div>
            </div>

            <div className="lp-flow-col lp-flow-auto">
              <h3 className="lp-flow-col-title">{t('flow.with')}</h3>
              <ul>
                {FLOW_PAIRS.map((pair, i) => (
                  <li
                    key={pair.id}
                    ref={(element) => {
                      revealRefs.current[TOTAL + i] = element;
                    }}
                  >
                    <div
                      ref={(element) => {
                        resultRefs.current[i] = element;
                      }}
                      className={`lp-result${lit === i ? ' is-lit' : ''}${done.has(i) ? ' is-done' : ''}`}
                    >
                      <span className="lp-row-icon lp-row-icon-resolved" aria-hidden="true"><Check /></span>
                      <span className="lp-row-label">{t(`flow.pairs.${pair.id}.result`)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <svg ref={svgRef} className="lp-flow-links" aria-hidden="true">
              {FLOW_PAIRS.map((pair, i) => (
                <path
                  key={`in-${pair.id}`}
                  ref={(element) => {
                    inRefs.current[i] = element;
                  }}
                  className={`lp-link lp-link-in${active === i ? ' is-hot' : ''}`}
                />
              ))}
              {FLOW_PAIRS.map((pair, i) => (
                <path
                  key={`out-${pair.id}`}
                  ref={(element) => {
                    outRefs.current[i] = element;
                  }}
                  className={`lp-link lp-link-out${active === i ? ' is-hot' : ''}${done.has(i) ? ' is-done' : ''}`}
                />
              ))}
              <path ref={crossRef} className="lp-link-cross" />
              {FLOW_PAIRS.map((pair, i) => (
                <g
                  key={`in-port-${pair.id}`}
                  ref={(element) => {
                    inPortRefs.current[i] = element;
                  }}
                >
                  <circle r="4.5" className={`lp-port lp-port-in${active === i ? ' is-active' : ''}`} />
                </g>
              ))}
              {FLOW_PAIRS.map((pair, i) => (
                <g
                  key={`out-port-${pair.id}`}
                  ref={(element) => {
                    outPortRefs.current[i] = element;
                  }}
                >
                  <circle r="4.5" className={`lp-port lp-port-out${lit === i ? ' is-active' : ''}${done.has(i) ? ' is-done' : ''}`} />
                </g>
              ))}
              <g ref={pulseRef} className="lp-pulse">
                <circle className="lp-pulse-glow" r="14" />
                <circle className="lp-pulse-dot" r="5.5" />
              </g>
            </svg>
          </div>
          <p className="lp-flow-note">{t('flow.note')}</p>
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</p>
        </div>
      </div>
    </section>
  );
}
