/**
 * Landing header (server-rendered): the "NEW Nucleus Volt" banner, the sticky bar (logo + wordmark, centred section
 * nav with the current-section state, theme popover, Log in, primary CTA) and the gradient scroll-progress hairline.
 * The SectionNav island tracks the current section and the progress through the shared motion engine.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ThemeSwitcher } from '@/features/theming/theme-switcher';
import type { LandingText } from '../i18n/landing-text';
import { NAV_SECTIONS } from '../header/nav-sections';
import { SectionNav } from '../header/section-nav';
import { SectionDots } from '../section-dots/section-dots';
import { SECTION_DOTS } from '../section-dots/section-dot-ids';

export function SiteHeader({ t }: { readonly t: LandingText }): ReactNode {
  const links = NAV_SECTIONS.map((id) => ({ id, label: t(`nav.${id}`) }));
  const dots = SECTION_DOTS.map((id) => ({ id, label: t(`dots.${id}`) }));
  return (
    <>
      <a className="lp-skip" href="#main">{t('a11y.skip')}</a>
      <div className="lp-banner">
        <p className="lp-wrap">
          <span className="lp-banner-tag">{t('announce.badge')}</span>
          {t.rich('announce.text', { b: (children, key) => <b key={key}>{children}</b> })}
          <a href="#volt" className="lp-banner-link">{t('announce.link')}</a>
        </p>
      </div>
      <header className="lp-header">
        <div className="lp-wrap lp-grid lp-header-grid">
          <a href="#top" className="lp-brand" aria-label={t('nav.brand')}>
            <span className="lp-mark" aria-hidden="true" />
            <span aria-hidden="true">Nucleus</span>
          </a>
          <SectionNav label={t('nav.label')} menuLabel={t('nav.menu')} links={links}>
            <Link href="/login" className="lp-login">{t('nav.logIn')}</Link>
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-sm">{t('hero.cta')}<ArrowRight aria-hidden="true" className="lp-flip-rtl" /></a>
          </SectionNav>
          <div className="lp-actions">
            <ThemeSwitcher placement="header" />
            <Link href="/login" className="lp-login lp-wide-only">{t('nav.logIn')}</Link>
            <a href="#demo" className="lp-btn lp-btn-primary lp-btn-sm lp-wide-only">{t('hero.cta')}<ArrowRight aria-hidden="true" className="lp-flip-rtl" /></a>
          </div>
        </div>
      </header>
      <SectionDots label={t('dots.label')} items={dots} />
    </>
  );
}
