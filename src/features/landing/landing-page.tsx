/**
 * The Nucleus landing page (server component). Static content is server-rendered for a fast LCP; interactive and
 * animated parts are small client islands driven by one shared motion engine (motion/scroll-engine.ts).
 *
 * Order: header (banner, sticky bar, progress) · 1 hero (pinned) · 2 the 90-second story · 3 from chaos to clarity ·
 * 4 numbers · 5–14 before/after, platform, roles, AI, Volt, time saved, security, rollout, FAQ, demo · footer.
 */
import type { ReactNode } from 'react';
import { landingText } from './i18n/landing-text';
import { LocaleProvider } from './i18n/locale-provider.jsx';
import { Hero } from './sections/hero';
import { LandingSections } from './sections/landing-sections';
import { DeferredSection } from './sections/section-registry';
import { SiteFooter } from './sections/site-footer';
import { SiteHeader } from './sections/site-header';
import { Story } from './sections/story';
import './styles/base.css';
import './styles/flow.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/numbers.css';
import './styles/story.css';

export function LandingPage(): ReactNode {
  const t = landingText();
  return (
    <LocaleProvider locale="en" path="/">
      <div className="lp" id="top">
        <SiteHeader t={t} />
        <main id="main" tabIndex={-1}>
          <Hero t={t} />
          <Story t={t} />
          <DeferredSection name="flow" serverRender />
          <LandingSections />
        </main>
        <SiteFooter t={t} year={new Date().getFullYear()} />
      </div>
    </LocaleProvider>
  );
}
