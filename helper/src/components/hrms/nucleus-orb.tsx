"use client";

import { useEffect, useRef } from "react";

/**
 * The voice sphere.
 *
 * It reacts to two levels: what the microphone is hearing and what the
 * assistant is speaking. Both arrive as audio chunks many times a second, which
 * is far too often to put through React — rendering the whole page on every PCM
 * chunk is what made the old meter stutter. So the levels stay in refs the page
 * owns, this component reads them once per animation frame, and the only thing
 * that changes is a handful of CSS custom properties on one element. No state,
 * no re-render, no work at all while the session is idle.
 *
 * The two directions are visually distinct on purpose: a person needs to know
 * whether the thing is listening to them or talking at them, and a single
 * pulsing blob that means both tells them neither.
 */

export type OrbLevels = { user: number; assistant: number };

type Props = {
  /** Read once per frame. Returns the live levels, each 0..1. */
  getLevels: () => OrbLevels;
  /** False while idle: the sphere rests and the frame loop does not run. */
  active: boolean;
  /** Announced to assistive technology, which cannot see any of this. */
  label: string;
  /**
   * Rendered diameter in pixels. The sphere is built from one custom property so
   * a smaller instance is a real size, not a CSS `scale()` on a full-size one -
   * scaling would shrink the blur radii and the specular highlight with it and
   * leave the element still occupying its original box.
   */
  size?: number;
};

/** How fast the rendered level chases the measured one (0..1 per frame). */
const ATTACK = 0.35;
const RELEASE = 0.08;

export function NucleusOrb({ getLevels, active, label, size }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const shown = useRef<OrbLevels>({ user: 0, assistant: 0 });

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    // Respect the OS setting: the sphere still shows level, it just stops
    // breathing and rotating on its own.
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.dataset.calm = calm ? "true" : "false";

    if (!active) {
      shown.current = { user: 0, assistant: 0 };
      element.style.setProperty("--user", "0");
      element.style.setProperty("--assistant", "0");
      element.style.setProperty("--spin", "0deg");
      return;
    }

    let frame = 0;
    let angle = 0;
    const step = () => {
      const measured = getLevels();
      for (const key of ["user", "assistant"] as const) {
        const target = Math.max(0, Math.min(1, measured[key]));
        const current = shown.current[key];
        // Rise quickly so a syllable registers, fall slowly so it does not flicker.
        const next = current + (target - current) * (target > current ? ATTACK : RELEASE);
        shown.current[key] = next;
        element.style.setProperty(`--${key}`, next.toFixed(3));
      }
      if (!calm) {
        angle = (angle + 0.35 + shown.current.assistant * 2.2) % 360;
        element.style.setProperty("--spin", `${angle.toFixed(1)}deg`);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, getLevels]);

  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      data-active={active ? "true" : "false"}
      className="nucleus-orb relative grid shrink-0 place-items-center"
      style={size ? ({ "--orb-size": `${size}px` } as React.CSSProperties) : undefined}
    >
      <span aria-hidden className="nucleus-orb__halo" />
      <span aria-hidden className="nucleus-orb__ring nucleus-orb__ring--outer" />
      <span aria-hidden className="nucleus-orb__ring nucleus-orb__ring--inner" />
      <span aria-hidden className="nucleus-orb__sheen" />
      <span aria-hidden className="nucleus-orb__core" />
      <span aria-hidden className="nucleus-orb__gloss" />
    </div>
  );
}
