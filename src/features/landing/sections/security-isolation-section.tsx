'use client';

/**
 * "Enterprise-ready. Isolated. Yours." With the section's entry progress s (scroll-driven, eased):
 *   - the three tenant blocks start stacked on the middle lane and slide apart into separate lanes over s .1 → .6,
 *     while the lane dividers draw in;
 *   - the shield and its lock draw themselves (SVG stroke, pathLength 1 so dashoffset = 1 − p) over s .2 → .8;
 *   - the six guarantees stagger in (shared section motion);
 *   - a single scanning sweep crosses the tenant panel over s .55 → .95 (transform only).
 * Everything is a function of scroll position, so it reverses when scrolling back up.
 */
import { useRef, type ReactNode } from 'react';
import { Ban, Globe, KeyRound, Layers, RefreshCw, Server, type LucideIcon } from 'lucide-react';
import { useLandingText } from '../i18n/use-landing-text';
import { clamp, easeInOut, easeOut, enterProgress, range } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { useSectionMotion } from '../motion/use-section-motion';
import { SectionHeader } from '../section-kit/section-header';

const ITEMS: readonly { readonly id: 'isolation' | 'failClosed' | 'rbac' | 'sessions' | 'subdomain' | 'onPrem'; readonly icon: LucideIcon }[] = [
  { id: 'isolation', icon: Layers },
  { id: 'failClosed', icon: Ban },
  { id: 'rbac', icon: KeyRound },
  { id: 'sessions', icon: RefreshCw },
  { id: 'subdomain', icon: Globe },
  { id: 'onPrem', icon: Server },
];
const TENANTS = ['a', 'you', 'c'] as const;
const SWEEP_FROM = 0.55;
const SWEEP_TO = 0.95;

export function SecurityIsolationSection(): ReactNode {
  const t = useLandingText();
  const sectionRef = useRef<HTMLElement>(null);
  const lastS = useRef(-1);
  useSectionMotion(sectionRef);

  useScene(sectionRef, (frame, box) => {
    const root = sectionRef.current;
    if (!root) return;
    const s = enterProgress(box, frame);
    if (s === lastS.current) return;
    lastS.current = s;
    const lanes = easeInOut(range(s, 0.1, 0.6));
    root.querySelectorAll<HTMLElement>('[data-tenant]').forEach((tenant, index) => {
      tenant.style.transform = `translateY(${String((1 - index) * 100 * (1 - lanes))}%)`;
    });
    root.querySelectorAll<HTMLElement>('[data-lane-line]').forEach((line) => {
      line.style.transform = `scaleX(${String(lanes)})`;
    });
    const draw = easeOut(range(s, 0.2, 0.8));
    root.querySelectorAll<SVGPathElement>('[data-draw]').forEach((path, index) => {
      path.style.strokeDashoffset = String(1 - clamp(draw * 1.4 - index * 0.4));
    });
    const sweep = root.querySelector<HTMLElement>('[data-sweep]');
    if (!sweep) return;
    // One scanning sweep across s .55 → .95 (scroll-scrubbed, so it runs back when scrolling up).
    const p = range(s, SWEEP_FROM, SWEEP_TO);
    sweep.style.transform = `translateX(${(-100 + 300 * easeInOut(p)).toFixed(2)}%)`;
    sweep.style.opacity = p > 0 && p < 1 ? '1' : '0';
  });

  return (
    <section ref={sectionRef} className="lp-section secu lp-motion-root" id="security" aria-labelledby="security-title">
      <div className="lp-glow lp-glow-start" data-parallax-glow="0.28" aria-hidden="true" />
      <div className="lp-wrap">
        <div className="lp-grid">
          <div className="secu-txt">
            <SectionHeader kicker={t('security.pill')} title={t('security.title')} titleId="security-title" lead={t('security.lead')} className="secu-head" />
            <div className="secu-visual lp-lift" data-reveal-item="" aria-hidden="true">
              <svg className="secu-shield" viewBox="0 0 64 64">
                <path data-draw="" pathLength="1" d="M32 6l20 7.5v15c0 12-8.6 21.6-20 23.5-11.4-1.9-20-11.5-20-23.5v-15z" />
                <path data-draw="" pathLength="1" d="M24 34.5h16v11.5H24zM27 34.5v-4.5a5 5 0 0110 0v4.5" />
              </svg>
              <div className="tenants">
                {TENANTS.map((id) => (
                  <div key={id} className={id === 'you' ? 'tn you' : 'tn'} data-tenant="">
                    {t(`security.tenants.${id}`)}
                    <i />
                    <i className="w60" />
                  </div>
                ))}
                <span className="lane-line lane-line-1" data-lane-line="" />
                <span className="lane-line lane-line-2" data-lane-line="" />
                <span className="secu-sweep" data-sweep="" />
              </div>
            </div>
          </div>
          <div className="sgrid">
            {ITEMS.map(({ id, icon: Icon }) => (
              <div key={id} className="sitem lp-lift" data-reveal-item="">
                <span className="si">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{t(`security.items.${id}.title`)}</h3>
                <p>{t(`security.items.${id}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
