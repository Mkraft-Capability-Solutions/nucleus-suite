'use client';
import { useTranslation } from '@/context/I18nContext';
import Link from 'next/link';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import AccessTime from '@mui/icons-material/AccessTime';
import Insights from '@mui/icons-material/Insights';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import DashboardCustomizeOutlined from '@mui/icons-material/DashboardCustomizeOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ArrowForward from '@mui/icons-material/ArrowForward';
import HomeStory from './HomeStory';
import LifecycleOrbit from './LifecycleOrbit';
import PublicMotion from './PublicMotion';
import content from '@/config/public-site.json';
import ContactForm from './ContactForm';
import PublicHeader from './PublicHeader';
import styles from './Website.module.css';

export type PublicPageKey = keyof typeof content.pages;

const icons = {
  people: PeopleOutline,
  clock: AccessTime,
  insights: Insights,
  layers: LayersOutlined,
  shield: ShieldOutlined,
  wallet: AccountBalanceWalletOutlined,
  school: SchoolOutlined,
  dashboard: DashboardCustomizeOutlined,
  keyboard: KeyboardOutlined,
  check: CheckCircleOutline,
};

export default function PublicPage({ pageKey }: { pageKey: PublicPageKey }) {
  const { t } = useTranslation();
  const page = content.pages[pageKey];

  return (
    <PublicMotion className={styles.site}>
      <a className={styles.skip} href="#main-content">
        {t('Skip to content')}
      </a>
      <PublicHeader content={content} currentPath={pageKey === 'home' ? '/' : `/${pageKey}`} />
      <main id="main-content" className={styles.main}>
        <section data-reveal="rise" data-pointer="glow" className={pageKey === 'home' ? styles.hero : styles.innerHero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>{t(page.eyebrow)}</div>
            <h1>{t(page.title)}</h1>
            <p>{t(page.description)}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/login">
                {t(content.cta)}
                <ArrowForward fontSize="small" />
              </Link>
              {pageKey === 'home' && (
                <Link className={styles.secondary} href="/features">
                  {t('Discover the features')}
                </Link>
              )}
            </div>
            <p className={styles.preview}>{t(content.preview)}</p>
          </div>
          {pageKey === 'home' && (
            <div data-pointer="tilt" className={styles.productStage}>
              <LifecycleOrbit copy={content.homeStory} />
            </div>
          )}
        </section>
        {pageKey === 'home' && (
          <>
            <div data-reveal className={styles.capabilityRail}>
              {content.homeExperience.capabilities.map((label) => (
                <span key={label}>
                  <CheckCircleOutline fontSize="small" />
                  {t(label)}
                </span>
              ))}
            </div>
            <HomeStory copy={content.homeStory} preview={content.homeExperience} />
          </>
        )}
        {pageKey !== 'home' && (
          <section data-reveal className={styles.section}>
            <h2>{t(page.sectionTitle)}</h2>
            <p className={styles.intro}>{t(page.sectionDescription)}</p>
            {pageKey === 'contact' ? (
              <ContactForm copy={content.contactForm} />
            ) : (
              <div
                data-reveal={pageKey === 'features' ? 'scale' : pageKey === 'docs' ? 'slide' : 'rise'}
                data-stagger
                className={styles.grid}
              >
                {page.cards.map((card: { id?: string; icon: string; title: string; description: string; href?: string }) => {
                  const Icon = icons[card.icon as keyof typeof icons] || LayersOutlined;
                  return (
                    <article data-pointer="glow" className={styles.card} key={card.title} id={card.id}>
                      <div className={styles.cardIcon}>
                        <Icon />
                      </div>
                      <h3>{t(card.title)}</h3>
                      <p>{t(card.description)}</p>
                      {card.href && (
                        <Link href={card.href}>
                          {t('Explore ')}
                          <ArrowForward fontSize="small" />
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <section data-reveal="scale" data-pointer="glow" className={styles.closing}>
          <div>
            <h2>{t(page.closingTitle)}</h2>
            <p>{t(page.closingDescription)}</p>
          </div>
          <Link className={styles.primary} href="/login">
            {t(content.cta)}
            <ArrowForward fontSize="small" />
          </Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>{t(content.footer)}</span>
        <span>
          {t(content.preview)} · <Link href="/docs">{t('Read the guides')}</Link>
        </span>
      </footer>
    </PublicMotion>
  );
}
