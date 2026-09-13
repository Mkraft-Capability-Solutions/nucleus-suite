import {t as translateText} from '@/lib/i18n';
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
import { getPublicContent, type PublicPageKey } from '@/services/public-content';
import ContactForm from './ContactForm';
import PublicHeader from './PublicHeader';
import styles from './Website.module.css';
const icons = { people: PeopleOutline, clock: AccessTime, insights: Insights, layers: LayersOutlined, shield: ShieldOutlined, wallet: AccountBalanceWalletOutlined, school: SchoolOutlined, dashboard: DashboardCustomizeOutlined, keyboard: KeyboardOutlined, check: CheckCircleOutline };

export default async function PublicPage({ pageKey }: { pageKey: PublicPageKey }) {
    const content = await getPublicContent();
    const page = content.pages[pageKey];
    return <PublicMotion className={styles.site}>
        <a className={styles.skip} href="#main-content">{translateText("components.Website.PublicPage","text_ac576a66d4")}</a>
        <PublicHeader content={content} currentPath={pageKey === 'home' ? '/' : `/${pageKey}`} />
        <main id="main-content" className={styles.main}>
            <section data-reveal className={pageKey === 'home' ? styles.hero : styles.innerHero}>
                <div className={styles.heroCopy}><div className={styles.eyebrow}>{page.eyebrow}</div><h1>{page.title}</h1><p>{page.description}</p>
                    <div className={styles.actions}><Link className={styles.primary} href="/login">{content.cta}<ArrowForward fontSize="small" /></Link>{pageKey === 'home' && <Link className={styles.secondary} href="/features">{translateText("components.Website.PublicPage","text_ef7f82c49e")}</Link>}</div>
                    <p className={styles.preview}>{content.preview}</p>
                </div>
                {pageKey === 'home' && <div className={styles.productStage}><LifecycleOrbit copy={content.homeStory} /></div>}
            </section>
            {pageKey === 'home' && <>
                <div data-reveal className={styles.capabilityRail}>{content.homeExperience.capabilities.map(label => <span key={label}><CheckCircleOutline fontSize="small" />{label}</span>)}</div>
                <HomeStory copy={content.homeStory} preview={content.homeExperience} />

            </>}
            {pageKey !== 'home' && <section data-reveal className={styles.section}><h2>{page.sectionTitle}</h2><p className={styles.intro}>{page.sectionDescription}</p>
                {pageKey === 'contact' ? <ContactForm copy={content.contactForm} /> : <div className={styles.grid}>{page.cards.map((card: { id?: string; icon: string; title: string; description: string; href?: string }) => {
                    const Icon = icons[card.icon as keyof typeof icons] || LayersOutlined;
                    return <article data-reveal className={styles.card} key={card.title} id={card.id}><div className={styles.cardIcon}><Icon /></div><h3>{card.title}</h3><p>{card.description}</p>{card.href && <Link href={card.href}>{translateText("components.Website.PublicPage","text_2e1ac6e929")}<ArrowForward fontSize="small" /></Link>}</article>;
                })}</div>}
            </section>}
            <section data-reveal className={styles.closing}><div><h2>{page.closingTitle}</h2><p>{page.closingDescription}</p></div><Link className={styles.primary} href="/login">{content.cta}<ArrowForward fontSize="small" /></Link></section>
        </main>
        <footer className={styles.footer}><span>{content.footer}</span><span>{content.preview}{translateText("components.Website.PublicPage","text_588da41053")}<Link href="/docs">{translateText("components.Website.PublicPage","text_bcecd61864")}</Link></span></footer>
    </PublicMotion>;
}
