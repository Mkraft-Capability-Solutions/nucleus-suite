'use client';

/**
 * The 90-second film inside the story frame. Idle: the four "scattered work" file chips on the stage gradient and a
 * pulsing play button. Playing: a privacy-enhanced YouTube embed (youtube-nocookie) that pauses itself when scrolled out of view.
 * Ended: a short end card with the demo CTA and "Watch again".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { clamp, easeOut } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';

const VIDEO_ID = 'JWUT7TPNULI';
const POSTER = '/media/nucleus/nucleus-film-v1-poster.webp';
const EMBED_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
/** Play-button pulse period (ms): a glow grows 84 → 136 px (scale 1.62) while fading out. */
const PULSE_PERIOD = 2400;
const PULSE_SCALE = 0.62;

type FilmState = 'idle' | 'playing' | 'paused' | 'ended';

function embedUrl(origin: string): string {
  const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', playsinline: '1', enablejsapi: '1' });
  if (origin) params.set('origin', origin);
  return `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${params.toString()}`;
}

function tellPlayer(frame: HTMLIFrameElement | null, event: string, func?: string): void {
  frame?.contentWindow?.postMessage(JSON.stringify({ event, func, args: [], id: VIDEO_ID, channel: 'widget' }), EMBED_ORIGINS[0] ?? '*');
}

/** YouTube player state from an iframe API message (0 ended, 1 playing, 2 paused). */
function playerStateOf(data: unknown): number | undefined {
  let message: unknown = data;
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  if (typeof message !== 'object' || message === null) return undefined;
  const record = message as { readonly event?: unknown; readonly info?: unknown };
  if (record.event === 'onStateChange' && typeof record.info === 'number') return record.info;
  if (record.event === 'infoDelivery' && typeof record.info === 'object' && record.info !== null) {
    const state = (record.info as { readonly playerState?: unknown }).playerState;
    return typeof state === 'number' ? state : undefined;
  }
  return undefined;
}

export interface FilmLabels {
  readonly play: string;
  /** Visible label beside the play button ("Watch the film"). */
  readonly watch: string;
  /** Visible duration hint ("1:33 · sound on"). */
  readonly meta: string;
  readonly frameTitle: string;
  readonly finished: string;
  readonly end: string;
  readonly cta: string;
  readonly again: string;
}

export interface FilmPlayerProps {
  readonly labels: FilmLabels;
  /** Server-rendered file chips (idle state only). */
  readonly chips: ReactNode;
}

export function FilmPlayer({ labels, chips }: FilmPlayerProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<FilmState>('idle');
  const [take, setTake] = useState(0);
  const [src, setSrc] = useState('');

  // Play-button pulse, driven by the shared engine (transform and opacity only).
  useScene(rootRef, (frame) => {
    const ring = pulseRef.current;
    if (!ring) return;
    if (frame.reduced) {
      ring.style.opacity = '0';
      return;
    }
    const phase = (frame.time % PULSE_PERIOD) / PULSE_PERIOD;
    ring.style.transform = `scale(${1 + PULSE_SCALE * easeOut(phase)})`;
    ring.style.opacity = String(0.55 * clamp(1 - phase));
  });

  // Pause when the film leaves the viewport.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || state !== 'playing') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) tellPlayer(frameRef.current, 'command', 'pauseVideo');
    }, { threshold: 0.25 });
    observer.observe(root);
    return () => observer.disconnect();
  }, [state]);

  // Follow the player's state (ended → end card).
  useEffect(() => {
    if (state === 'idle') return undefined;
    const onMessage = (event: MessageEvent): void => {
      if (!EMBED_ORIGINS.includes(event.origin) || event.source !== frameRef.current?.contentWindow) return;
      const playerState = playerStateOf(event.data);
      if (playerState === 0) setState('ended');
      else if (playerState === 1) setState('playing');
      else if (playerState === 2) setState('paused');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [state]);

  const play = (): void => {
    setSrc(embedUrl(window.location.origin));
    setTake((value) => value + 1);
    setState('playing');
  };

  const onFrameLoad = (): void => {
    tellPlayer(frameRef.current, 'listening');
    frameRef.current?.focus();
  };

  const started = state !== 'idle';

  return (
    <div ref={rootRef} className={`lp-film is-${state}`}>
      {started ? (
        <>
          {/* The poster covers the frame while the embed loads (idle shows the approved chips-on-stage design). */}
          <img className="lp-film-poster" src={POSTER} alt="" width={1920} height={1080} decoding="async" />
          <iframe
            key={take}
            ref={frameRef}
            className="lp-film-embed"
            src={src}
            title={labels.frameTitle}
            onLoad={onFrameLoad}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </>
      ) : (
        <>
          {chips}
          <button type="button" className="lp-play" onClick={play} aria-label={labels.play}>
            <span className="lp-play-pulse" ref={pulseRef} aria-hidden="true" />
            <Play aria-hidden="true" />
            <span className="lp-play-meta" aria-hidden="true">
              <b>{labels.watch}</b>
              <span>{labels.meta}</span>
            </span>
          </button>
        </>
      )}
      {state === 'ended' ? (
        <div className="lp-film-end" role="group" aria-label={labels.finished}>
          <p>{labels.end}</p>
          <div className="lp-film-end-actions">
            <a href="#demo" className="lp-btn lp-btn-primary">{labels.cta}<ArrowRight aria-hidden="true" className="lp-flip-rtl" /></a>
            <button type="button" className="lp-btn lp-btn-ghost lp-btn-on-stage" onClick={play}><Play aria-hidden="true" />{labels.again}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
