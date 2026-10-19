/**
 * Trust marquee: the bottom row of the hero's first screen (server-rendered, CSS-animated with a transform-only
 * keyframe). The list is rendered twice so the track can loop seamlessly at −50%; the copy is hidden from assistive
 * technology. Pauses on hover and focus, fades at both edges, runs the other way in right-to-left layouts and is a
 * static row under reduced motion (styles/hero.css). `children` render as further rows of the block (the module strip).
 * The block is anchored to the bottom of the hero's first screen and fades with the hero copy (hero-motion.tsx).
 */
import type { ReactNode } from 'react';
import { PARTNERS } from './partners';

export function PartnerMarquee({ label, children }: { readonly label: string; readonly children?: ReactNode }): ReactNode {
  const loop = [...PARTNERS, ...PARTNERS];
  return (
    <div className="lp-trust" data-hero-trust="">
      <div className="lp-wrap lp-trust-row">
        <p className="lp-trust-label" id="lp-trust-label">{label}</p>
        <div className="lp-marquee">
          <ul className="lp-marquee-track" aria-labelledby="lp-trust-label">
            {loop.map((partner, index) => {
              const copy = index >= PARTNERS.length;
              return (
                <li key={`${partner.id}-${copy ? 'b' : 'a'}`} className="lp-marquee-item" aria-hidden={copy ? true : undefined}>
                  <img
                    className={partner.ink === 'light' ? 'lp-logo lp-logo-light-ink' : 'lp-logo'}
                    src={partner.logo}
                    alt={copy ? '' : partner.name}
                    width={Math.round((partner.displayHeight * partner.width) / partner.height)}
                    height={partner.displayHeight}
                    decoding="async"
                    fetchPriority="low"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {children}
    </div>
  );
}
