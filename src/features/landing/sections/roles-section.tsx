'use client';

/**
 * "Your HR team, your managers, your people. All happier." Three role cards with a hover lift; the heading lines rise,
 * the cards and their points stagger in and the background glow drifts (shared section motion).
 */
import { useRef, type ReactNode } from 'react';
import { Briefcase, Check, User, Users, type LucideIcon } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { useSectionMotion } from '../motion/use-section-motion';
import { SectionHeader } from '../section-kit/section-header';

const ROLES: readonly { readonly id: 'hr' | 'managers' | 'employees'; readonly icon: LucideIcon }[] = [
  { id: 'hr', icon: Briefcase },
  { id: 'managers', icon: Users },
  { id: 'employees', icon: User },
];
const POINTS = ['a', 'b', 'c', 'd'] as const;

export function RolesSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  useSectionMotion(sectionRef);
  return (
    <section ref={sectionRef} className="lp-section roles lp-motion-root" id="roles" aria-labelledby="roles-title">
      <div className="lp-glow lp-glow-start" data-parallax-glow="0.2" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <SectionHeader kicker={t('roles.pill')} title={t('roles.title')} titleId="roles-title" />
          <div className="role-grid">
            {ROLES.map(({ id, icon: Icon }) => (
              <article key={id} className="role lp-lift" data-reveal-item="">
                <div className="ico">
                  <Icon aria-hidden="true" />
                </div>
                <h3>{t(`roles.items.${id}.title`)}</h3>
                <p className="q">{t(`roles.items.${id}.quote`)}</p>
                <ul>
                  {POINTS.map((point) => (
                    <li key={point}>
                      <Check aria-hidden="true" />
                      {t(`roles.items.${id}.points.${point}`)}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
