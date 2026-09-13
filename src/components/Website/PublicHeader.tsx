'use client';
import { useContext } from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useTranslation} from '@/context/I18nContext';
import Image from 'next/image';
import AppearanceToggle from '@/components/AppearanceToggle';
import { PublicSiteContext, type PublicNavigation } from '@/context/PublicSiteContext';
import styles from './Website.module.css';

export default function PublicHeader({content, currentPath}: {content?: PublicNavigation; currentPath?: string}) {
    const pathname=usePathname();
    const activePath=pathname || currentPath || '/';
    const {t: translateText}=useTranslation();
    const inherited = useContext(PublicSiteContext);
    const navigation = content ?? inherited;
    if (!navigation) throw new Error('Public navigation content is required.');
    const nav = <nav className={styles.nav} aria-label={translateText("public","navigation")}>
        {navigation.nav.map(item => <Link key={item.href} href={item.href} aria-current={item.href === activePath ? 'page' : undefined}>{item.label}</Link>)}
        <Link className={styles.login} href="/login" aria-current={activePath === '/login' ? 'page' : undefined}>{navigation.login}</Link>
    </nav>;
    return <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label={translateText("public","home")}><Image src="/images/logo.png" alt="" width={64} height={64} priority /><span>{navigation.brand}<small>{translateText("public","tagline")}</small></span></Link>
        {nav}<AppearanceToggle /><details className={styles.mobileMenu} onClick={event => {
            if ((event.target as Element).closest('a')) event.currentTarget.open = false;
        }} onKeyDown={event => {
            if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
            }
        }}><summary>{translateText("public","menu")}</summary>{nav}</details>
    </header>;
}
