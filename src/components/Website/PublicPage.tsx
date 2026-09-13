import Link from 'next/link';
import Image from 'next/image';
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
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import { getPublicContent, type PublicPageKey } from '@/services/public-content';
import ContactForm from './ContactForm';
import AppearanceToggle from '@/components/AppearanceToggle';
import styles from './Website.module.css';
const icons = { people: PeopleOutline, clock: AccessTime, insights: Insights, layers: LayersOutlined, shield: ShieldOutlined, wallet: AccountBalanceWalletOutlined, school: SchoolOutlined, dashboard: DashboardCustomizeOutlined, keyboard: KeyboardOutlined, check: CheckCircleOutline };

export default async function PublicPage({ pageKey }: { pageKey: PublicPageKey }) {
    const content = await getPublicContent();
    const page = content.pages[pageKey];
    const nav = <nav className={styles.nav} aria-label="Main navigation">{content.nav.map(item => <Link key={item.href} href={item.href} aria-current={(item.href === '/' ? pageKey === 'home' : item.href === `/${pageKey}`) ? 'page' : undefined}>{item.label}</Link>)}<Link className={styles.login} href="/login">{content.login}</Link></nav>;
    return <div className={styles.site}>
        <a className={styles.skip} href="#main-content">Skip to content</a>
        <header className={styles.header}>
            <Link className={styles.brand} href="/" aria-label="Nucleus home"><Image src="/images/logo.png" alt="" width={64} height={64} priority />{content.brand}</Link>
            {nav}<AppearanceToggle /><details className={styles.mobileMenu}><summary>Menu</summary>{nav}</details>
        </header>
        <main id="main-content" className={styles.main}>
            <section className={pageKey === 'home' ? styles.hero : styles.innerHero}>
                <div><div className={styles.eyebrow}>{page.eyebrow}</div><h1>{page.title}</h1><p>{page.description}</p>
                    <div className={styles.actions}><Link className={styles.primary} href="/login">{content.cta}<ArrowForward fontSize="small" /></Link>{pageKey === 'home' && <Link className={styles.secondary} href="/features">Discover the features</Link>}</div>
                    <p className={styles.preview}>{content.preview}</p>
                </div>
                {pageKey === 'home' && <div className={styles.showcase} aria-label="Illustrative workspace preview">
                    <div className={styles.showcaseTop}><div className={styles.eyebrow} style={{ margin: 0 }}>{content.showcase.label}</div><div className={styles.symbol}><AutoAwesomeOutlined /></div></div>
                    <h2>{content.showcase.title}</h2><div className={styles.tabs}>{content.showcase.tabs.map(tab => <span key={tab}>{tab}</span>)}</div>
                    {content.showcase.cards.map((card, index) => <div className={styles.previewCard} key={card.title}><div className={styles.symbol}>{index === 0 ? <CheckCircleOutline /> : index === 1 ? <DashboardCustomizeOutlined /> : <PeopleOutline />}</div><div><small>{card.title}</small><strong>{card.value}</strong><p>{card.detail}</p></div></div>)}
                    <div className={styles.badge}><CheckCircleOutline fontSize="small" />{content.showcase.badge}</div>
                </div>}
            </section>
            <section className={styles.section}><h2>{page.sectionTitle}</h2><p className={styles.intro}>{page.sectionDescription}</p>
                {pageKey === 'contact' ? <ContactForm copy={content.contactForm} /> : <div className={styles.grid}>{page.cards.map((card: { id?: string; icon: string; title: string; description: string; href?: string }) => {
                    const Icon = icons[card.icon as keyof typeof icons] || LayersOutlined;
                    return <article className={styles.card} key={card.title} id={card.id}><div className={styles.cardIcon}><Icon /></div><h3>{card.title}</h3><p>{card.description}</p>{card.href && <Link href={card.href}>Explore <ArrowForward fontSize="small" /></Link>}</article>;
                })}</div>}
            </section>
            <section className={styles.closing}><div><h2>{page.closingTitle}</h2><p>{page.closingDescription}</p></div><Link className={styles.primary} href="/login">{content.cta}<ArrowForward fontSize="small" /></Link></section>
        </main>
        <footer className={styles.footer}><span>{content.footer}</span><span>{content.preview} · <Link href="/docs">Read the guides</Link></span></footer>
    </div>;
}
