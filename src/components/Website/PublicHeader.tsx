'use client';
import { useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AppearanceToggle from '@/components/AppearanceToggle';
import { PublicSiteContext, type PublicNavigation } from '@/context/PublicSiteContext';
import styles from './Website.module.css';

export default function PublicHeader({content, currentPath = '/login'}: {content?: PublicNavigation; currentPath?: string}) {
    const inherited = useContext(PublicSiteContext);
    const navigation = content ?? inherited;
    if (!navigation) throw new Error('Public navigation content is required.');
    const nav = <nav className={styles.nav} aria-label="Main navigation">
        {navigation.nav.map(item => <Link key={item.href} href={item.href} aria-current={item.href === currentPath ? 'page' : undefined}>{item.label}</Link>)}
        <Link className={styles.login} href="/login" aria-current={currentPath === '/login' ? 'page' : undefined}>{navigation.login}</Link>
    </nav>;
    return <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Nucleus home"><Image src="/images/logo.png" alt="" width={64} height={64} priority />{navigation.brand}</Link>
        {nav}<AppearanceToggle /><details className={styles.mobileMenu}><summary>Menu</summary>{nav}</details>
    </header>;
}
