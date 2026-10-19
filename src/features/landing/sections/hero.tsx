/**
 * Section 1 · Hero (server-rendered). Pinned for 220vh on large screens; the HeroMotion island drives the entrance
 * timeline, the orbit scene and the scroll choreography through the shared motion engine. Without JavaScript the copy,
 * the core and the status cards render in their final resting layout, and the chaos labels in their scattered rest.
 * The trust block (partner marquee + module strip) sits between copy and stage in the DOM: an overlay at the bottom of
 * the pinned screen on large screens, a row anchored to the first screen's bottom in the stacked layout (hero.css).
 */
import type { ReactNode } from 'react';
import { ArrowRight, Check, Play } from 'lucide-react';
import { formatList, formatNumber } from '../i18n/format.js';
import type { LandingText } from '../i18n/landing-text';
import { CARDS, NODES, ORBITS, chaosLayout } from '../hero/hero-geometry';
import { NODE_TARGETS } from '../hero/node-targets';
import { HeroMotion } from '../hero/hero-motion';
import { ModuleStrip, MODULE_STRIP } from '../partners/module-strip';
import { PartnerMarquee } from '../partners/partner-marquee';

const ASSURANCES = ['isolated', 'minutes', 'deploy'] as const;
/** Share of Q2 reviews closed, shown on the ring card. */
const REVIEWS_CLOSED = 0.92;
/** Scattered chaos-label anchors (deterministic, computed once on the server). */
const CHAOS_ANCHORS = chaosLayout();

function CardBody({ id, t }: { readonly id: (typeof CARDS)[number]['id']; readonly t: LandingText }): ReactNode {
  switch (id) {
    case 'hire':
      return (
        <>
          <b className="lp-card-title"><span className="lp-card-dot"><Check aria-hidden="true" /></span>{t('hero.cards.hireTitle')}</b>
          {t('hero.cards.hireText')}
        </>
      );
    case 'perform':
      return (
        <>
          <svg className="lp-ring" viewBox="0 0 46 46" aria-hidden="true">
            <defs>
              <linearGradient id="lp-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" className="lp-ring-stop-start" />
                <stop offset="1" className="lp-ring-stop-end" />
              </linearGradient>
            </defs>
            <circle className="lp-ring-track" cx="23" cy="23" r="19.5" />
            <circle className="lp-ring-fill" cx="23" cy="23" r="19.5" pathLength="100" data-hero-ring="" />
          </svg>
          <span>
            <b className="lp-card-title lp-card-figure" data-hero-percent="">{formatNumber(REVIEWS_CLOSED, { style: 'percent' })}</b>
            {t('hero.cards.performText')}
          </span>
        </>
      );
    case 'pay':
      return (
        <>
          <b className="lp-card-title"><span className="lp-card-dot"><Check aria-hidden="true" /></span>{t('hero.cards.payTitle')}</b>
          {t('hero.cards.payText')}
          <span className="lp-meter" aria-hidden="true"><i data-hero-meter="" /></span>
        </>
      );
    case 'volt':
      return (
        <>
          <b className="lp-card-title"><span className="lp-card-dot lp-card-dot-pending" aria-hidden="true">!</span>{t('hero.cards.voltTitle')}</b>
          {t('hero.cards.voltText')}
        </>
      );
  }
}

export function Hero({ t }: { readonly t: LandingText }): ReactNode {
  const moduleNames = NODES.map((node) => t(`modules.${node.id}.name`));
  return (
    <HeroMotion percentValue={REVIEWS_CLOSED}>
      <div className="lp-hero-pin" data-hero-pin="">
        <div className="lp-hero-bg" data-hero-bg="" aria-hidden="true" />
        <div className="lp-wrap lp-grid lp-hero-grid">
          <div className="lp-hero-copy" data-hero-copy="">
            <p className="lp-kicker" data-enter="120">{t('hero.pill')}</p>
            <h1 className="lp-hero-title" id="hero-title">
              <span className="lp-line"><span data-rise="220">{t('hero.titleLine1')}</span></span>
              <span className="lp-line"><span data-rise="310">{t('hero.titleLine2')}</span></span>
              <span className="lp-line">
                <span data-rise="400">
                  <em className="lp-grad lp-hero-shimmer">
                    {t('hero.titleEm')}
                    <span className="lp-shimmer-band" data-shimmer="1150" aria-hidden="true" />
                  </em>
                </span>
              </span>
            </h1>
            <p className="lp-lead lp-hero-lead" data-enter="560">{t.rich('hero.lead', { b: (children, key) => <b key={key}>{children}</b> })}</p>
            <div className="lp-hero-ctas">
              <a href="#demo" className="lp-btn lp-btn-primary" data-pop="680">{t('hero.cta')}<ArrowRight aria-hidden="true" className="lp-flip-rtl" /></a>
              <a href="#story" className="lp-btn lp-btn-ghost" data-pop="750"><Play aria-hidden="true" className="lp-play-icon" />{t('hero.film')}</a>
            </div>
            <ul className="lp-hero-assure">
              {ASSURANCES.map((id, index) => <li key={id} data-enter={820 + 70 * index}>{t(`hero.chips.${id}`)}</li>)}
            </ul>
          </div>

          <PartnerMarquee label={t('hero.trustedBy')}>
            <ModuleStrip names={MODULE_STRIP.map((id) => t(`marquee.${id}`))} />
          </PartnerMarquee>

          <div className="lp-stage" data-hero-stage="" role="group" aria-label={t('hero.sceneLabel', { modules: formatList(moduleNames) })}>
            <svg className="lp-orbits" data-hero-orbits="" aria-hidden="true">
              {ORBITS.map((orbit, index) => (
                <g key={index} data-hero-orbit={index} className={orbit.dashed ? 'lp-orbit lp-orbit-dashed' : 'lp-orbit'}>
                  <ellipse cx="0" cy="0" rx={orbit.a} ry={orbit.b} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </svg>
            <div className="lp-chaos" aria-hidden="true">
              {CHAOS_ANCHORS.map((anchor) => (
                <span
                  key={anchor.id}
                  className="lp-chaos-label"
                  data-hero-chaos={anchor.id}
                  style={{ '--lp-chaos-x': String(anchor.fx), '--lp-chaos-y': String(anchor.fy) }}
                >
                  {t(`chaos.${anchor.id}`)}
                </span>
              ))}
            </div>
            <div className="lp-contact-shadow" data-hero-shadow="" aria-hidden="true" />
            <div className="lp-core" data-hero-core="" aria-hidden="true">
              <div className="lp-core-bloom" data-hero-bloom="" />
              <div className="lp-core-halo lp-core-halo-1" />
              <div className="lp-core-halo lp-core-halo-2" />
              <div className="lp-core-halo lp-core-halo-3" />
              <div className="lp-sphere">
                <span className="lp-sphere-rim" />
                <span className="lp-sphere-label">{t('hero.coreName')}</span>
              </div>
            </div>
            {NODES.map((node) => {
              const name = t(`modules.${node.id}.name`);
              return (
                <a
                  key={node.id}
                  href={`#${NODE_TARGETS[node.id].section}`}
                  className={`lp-node lp-node-${node.color}`}
                  data-hero-node={node.id}
                  aria-label={t('hero.moduleLink', { module: name })}
                >
                  <i>
                    <span className="lp-node-glow" />
                  </i>
                  <span className="lp-node-label">{name}</span>
                </a>
              );
            })}
            {CARDS.map((card) => (
              <div key={card.id} className={`lp-card lp-glass lp-card-${card.id}`} data-hero-card={card.id} aria-hidden="true">
                <CardBody id={card.id} t={t} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </HeroMotion>
  );
}
