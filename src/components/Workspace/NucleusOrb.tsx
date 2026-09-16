"use client";

import { useEffect, useRef } from 'react';
import type { OrbLevels } from '@/context/NucleusSessionProvider';

/**
 * Nucleus Talk voice orb — uses the real transparent Nucleus N-logo SVG.
 * Audio levels animate glow rings and the center nucleus dot via CSS custom
 * properties on an rAF loop — zero React state during live audio.
 *
 * Visual language:
 * - Idle: gentle slow pulse
 * - User speaking (--user level): blue outer ring + nucleus dot expansion
 * - AI speaking (--assistant level): purple halo + faster rotation
 * - prefers-reduced-motion: animation stops, level still shown
 */

const ATTACK = 0.35;   // fast rise so each syllable registers
const RELEASE = 0.08;  // slow fall so the meter doesn't flicker

type Props = {
  getLevels: () => OrbLevels;
  active: boolean;
  label: string;
  size?: number;
  isListening?: boolean;
  isSpeaking?: boolean;
  onClick?: () => void;
};

export function NucleusOrb({ getLevels, active, label, size = 96, isListening = false, isSpeaking = false, onClick }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const shown = useRef<OrbLevels>({ user: 0, assistant: 0 });

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.dataset.calm = calm ? 'true' : 'false';

    if (!active) {
      shown.current = { user: 0, assistant: 0 };
      element.style.setProperty('--user', '0');
      element.style.setProperty('--assistant', '0');
      element.style.setProperty('--spin', '0deg');
      return;
    }

    let frame = 0;
    let angle = 0;
    const step = () => {
      const measured = getLevels();
      for (const key of ['user', 'assistant'] as const) {
        const target = Math.max(0, Math.min(1, measured[key]));
        const current = shown.current[key];
        const next = current + (target - current) * (target > current ? ATTACK : RELEASE);
        shown.current[key] = next;
        element.style.setProperty(`--${key}`, next.toFixed(3));
      }
      if (!calm) {
        angle = (angle + 0.3 + shown.current.assistant * 1.8) % 360;
        element.style.setProperty('--spin', `${angle.toFixed(1)}deg`);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, getLevels]);

  return (
    <div
      ref={host}
      role="button"
      aria-label={label}
      tabIndex={onClick ? 0 : undefined}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {/* Halo ring — expands with assistant audio */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          border: '2px solid transparent',
          background: `radial-gradient(circle, transparent 60%, rgba(139,92,246,calc(var(--assistant,0)*0.55 + var(--user,0)*0.25 + ${isSpeaking ? 0.4 : isListening ? 0.25 : 0.08})) 100%) border-box`,
          transform: `rotate(var(--spin,0deg)) scale(calc(1 + var(--user,0)*0.08 + var(--assistant,0)*0.12))`,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Outer glow pulse ring */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '50%',
          boxShadow: `0 0 calc(${isListening ? 14 : isSpeaking ? 18 : 8}px + var(--user,0)*16px + var(--assistant,0)*20px) rgba(${isListening ? '56,189,248' : isSpeaking ? '236,72,153' : '139,92,246'},calc(0.3 + var(--user,0)*0.4 + var(--assistant,0)*0.45))`,
        }}
      />


      {/* The Nucleus N-logo — transparent background, SVG only */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        style={{
          width: size * 0.82,
          height: size * 0.82,
          position: 'relative',
          zIndex: 1,
          filter: `
            drop-shadow(0 0 calc(4px + var(--assistant,0)*10px) rgba(139,92,246,calc(0.5 + var(--assistant,0)*0.4)))
            drop-shadow(0 0 calc(2px + var(--user,0)*8px) rgba(56,189,248,calc(0.3 + var(--user,0)*0.5)))
          `,
          transform: `scale(calc(1 + var(--user,0)*0.04 + var(--assistant,0)*0.05))`,
          transition: 'transform 0.1s ease',
          animation: isListening
            ? 'nucleusListen 1.1s ease-in-out infinite'
            : isSpeaking
              ? 'nucleusSpeak 0.85s ease-in-out infinite'
              : 'nucleusIdle 3.2s ease-in-out infinite',
        }}
      >
        <defs>
          <linearGradient id="nucOrbLeftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isListening ? '#38bdf8' : '#4f46e5'} />
            <stop offset="50%" stopColor={isListening ? '#6366f1' : '#6366f1'} />
            <stop offset="100%" stopColor={isListening ? '#818cf8' : '#3b82f6'} />
          </linearGradient>
          <linearGradient id="nucOrbRightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isSpeaking ? '#f472b6' : '#a855f7'} />
            <stop offset="50%" stopColor={isSpeaking ? '#ec4899' : '#8b5cf6'} />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="nucOrbDiagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#6366f1" />
            <stop offset="80%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <radialGradient id="nucOrbSphereGrad" cx="38%" cy="36%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="25%" stopColor="#c084fc" />
            <stop offset="65%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4338ca" />
          </radialGradient>
        </defs>

        {/* Left Vertical Pillar */}
        <path
          d="M 22 74 C 22 78.5, 25.5 82, 30 82 C 34.5 82, 38 78.5, 38 74 L 38 36 C 38 27, 30 20, 21 20 C 16.5 20, 13 23.5, 13 28 L 13 74 C 13 78.5, 16.5 82, 21 82"
          fill="url(#nucOrbLeftGrad)"
        />
        {/* Inner Curved Ribbon & Diagonal Stroke */}
        <path
          d="M 22 30 C 26 24, 38 22, 46 30 C 53 37, 51 52, 43 56 C 37 59, 30 55, 27 49 L 68 79 C 72 82, 77 79, 77 74 L 77 28 C 77 23.5, 73.5 20, 69 20 C 64.5 20, 61 23.5, 61 28 L 61 62 L 32 38 C 29 35, 24 33, 22 30 Z"
          fill="url(#nucOrbDiagGrad)"
        />
        {/* Right Vertical Pillar */}
        <path
          d="M 68 28 L 68 74 C 68 78.5, 71.5 82, 76 82 C 80.5 82, 84 78.5, 84 74 L 84 28 C 84 23.5, 80.5 20, 76 20 C 71.5 20, 68 23.5, 68 28 Z"
          fill="url(#nucOrbRightGrad)"
        />
        {/* Center Nucleus Sphere */}
        <circle cx="48" cy="44" r="12" fill="url(#nucOrbSphereGrad)" />
        {/* Specular highlight */}
        <circle cx="45" cy="41" r="3.5" fill="#ffffff" opacity="0.8" />
      </svg>

      <style>{`
        @keyframes nucleusIdle {
          0%, 100% { opacity: 0.88; }
          50% { opacity: 1; }
        }
        @keyframes nucleusListen {
          0%, 100% { transform: scale(0.96); }
          50% { transform: scale(1.06); }
        }
        @keyframes nucleusSpeak {
          0% { transform: scale(0.94) rotate(-1deg); }
          33% { transform: scale(1.06) rotate(1deg); }
          66% { transform: scale(0.98) rotate(-0.5deg); }
          100% { transform: scale(0.94) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}
