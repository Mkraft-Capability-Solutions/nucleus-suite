/**
 * Site footer: the MultipliersKraft website footer (new/Closing.jsx SiteFooter), rebuilt on the Nucleus tokens.
 * Server-rendered; only the newsletter form and the motion wrapper are client islands. Same structure as the original:
 *   CTA row ("Capability, multiplied." + Book a demo) · brand column (logo, about, newsletter, social row) and four
 *   link columns (absolute multiplierskraft.com URLs) · contact cards · the big wordmark (reads "Nucleus": subtle
 *   gradient fill with a sheen, rising on entry, scroll parallax) · legal row (copyright, motto).
 * Deviation: the original's language switcher is omitted (this route is English-only today). "Book a demo" goes to
 * this page's #demo booking section.
 */
import type { ReactNode } from 'react';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { SectionHeading } from '../components/section-heading';
import type { LandingText } from '../i18n/landing-text';
import { CONTACT, FOOTER_COLUMNS, SITE, SOCIAL } from '../site-footer/footer-links';
import { FooterMotion } from '../site-footer/footer-motion';
import { MultipliersKraftLogo } from '../site-footer/multiplierskraft-logo';
import { NewsletterForm } from '../site-footer/newsletter-form';
import { SocialIcon } from '../site-footer/social-icons';
import '../styles/site-footer.css';

export function SiteFooter({ t, year }: { readonly t: LandingText; readonly year: number }): ReactNode {
  return (
    <FooterMotion label={t('footer.label')}>
      <div className="lp-glow lp-glow-end" data-parallax-glow="0.2" aria-hidden="true" />
      <div className="ft-container">
        <div className="ft-cta">
          <SectionHeading text={t('footer.big')} as="p" className="ft-big" />
          <a href="#demo" className="lp-btn lp-btn-primary ft-cta-btn" data-reveal-item="">
            {t('footer.bookDemo')}
            <ArrowRight aria-hidden="true" className="lp-flip-rtl" />
          </a>
        </div>
        <div className="ft-grid">
          <div className="ft-brand" data-reveal-item="">
            <a href={`${SITE}/`} className="ft-logo" aria-label={t('footer.brand')}>
              <MultipliersKraftLogo />
            </a>
            <p className="ft-about">{t('footer.about')}</p>
            <NewsletterForm />
            <ul className="ft-social" aria-label={t('footer.follow')}>
              {SOCIAL.map((item) => (
                <li key={item.id}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={`ft-social-link ft-social-${item.id}`} aria-label={t('footer.newTab', { label: item.label })} title={item.label}>
                    <SocialIcon id={item.id} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.id} className="ft-col" aria-label={t(`footer.columns.${column.id}`)} data-reveal-item="">
              <p className="ft-overline">{t(`footer.columns.${column.id}`)}</p>
              <ul>
                {column.links.map(([id, href]) => (
                  <li key={id}>
                    <a href={`${SITE}${href}`}>{t(`footer.links.${id}`)}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <address className="ft-contact">
          <span className="lp-lift" data-reveal-item="">
            <MapPin aria-hidden="true" />
            {t('footer.city')}
          </span>
          <a className="lp-lift" href={`mailto:${CONTACT.email}`} data-reveal-item="">
            <Mail aria-hidden="true" />
            <span dir="ltr">{CONTACT.email}</span>
          </a>
          <a className="lp-lift" href={`tel:${CONTACT.tel}`} data-reveal-item="">
            <Phone aria-hidden="true" />
            <span dir="ltr">{CONTACT.phone}</span>
          </a>
          <a className="lp-lift" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" data-reveal-item="">
            <SocialIcon id="linkedin" />
            {t('footer.linkedin')}
          </a>
        </address>
      </div>
      <div className="ft-bigword" aria-hidden="true">
        <span className="ft-bigword-text" data-bigword="">
          Nucleus
        </span>
      </div>
      <div className="ft-container ft-legal">
        <span>{t('footer.copyright', { year: String(year) })}</span>
        <span>{t('footer.motto')}</span>
      </div>
    </FooterMotion>
  );
}
