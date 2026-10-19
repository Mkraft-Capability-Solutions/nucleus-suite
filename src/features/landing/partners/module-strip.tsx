/**
 * Module-name strip: the row under the trust marquee naming the suite's fourteen modules (catalog keys marquee.*),
 * scrolling continuously. Same mechanics as the partner marquee (styles/hero.css): the list is rendered twice and the
 * track loops seamlessly at −50%, the edges fade, hovering pauses it and it runs the other way in right-to-left layouts.
 * Decorative (the modules are named in the hero scene and the platform tour), so the whole strip is hidden from
 * assistive technology. It keeps moving under reduced motion (owner decision: the landing motion always plays).
 */
import type { ReactNode } from 'react';

/** Catalog ids under marquee.*, in display order. */
export const MODULE_STRIP = [
  'hiring',
  'onboarding',
  'attendance',
  'shifts',
  'leave',
  'payroll',
  'reviews',
  'feedback',
  'learning',
  'pulse',
  'recognition',
  'helpdesk',
  'ai',
  'volt',
] as const;

export type ModuleStripId = (typeof MODULE_STRIP)[number];

export function ModuleStrip({ names }: { readonly names: readonly string[] }): ReactNode {
  const loop = [...names, ...names];
  return (
    <div className="lp-wrap lp-module-strip" aria-hidden="true">
      <div className="lp-marquee lp-module-marquee">
        <ul className="lp-module-track">
          {loop.map((name, index) => (
            <li key={`${index >= names.length ? 'b' : 'a'}-${index % names.length}`} className="lp-module-item">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
