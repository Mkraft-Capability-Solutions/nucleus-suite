/**
 * Split layout shared by the log in screen, the workspace loading state and the workspace page, so the Nucleus scene
 * keeps exactly the same geometry across the hand-off: a header (logo, theme icon) above the 12-column grid
 * (container 1536 px, margin max(40px, (100vw − 1536px) / 2)). The scene fills columns 1–6, the content columns
 * 8–12. Below 900 px the scene shrinks above the content. No hooks: usable from server and client components.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/features/theming/brand-logo';
import { ThemeSwitcher } from '@/features/theming/theme-switcher';
import { NucleusScene } from './nucleus-scene';
import styles from './auth-shell.module.css';

export interface AuthShellProps {
  /** Revolve the scene fast (request in flight, next page loading). */
  readonly busy: boolean;
  /** Labelled region for the content column. */
  readonly labelledBy?: string;
  readonly children: ReactNode;
}

export function AuthShell({ busy, labelledBy, children }: AuthShellProps): ReactNode {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.home}>
          <BrandLogo />
        </Link>
        <ThemeSwitcher placement="header" />
      </header>
      <main className={styles.main}>
        <div className={styles.scene}>
          <NucleusScene busy={busy} className={styles.stage} />
        </div>
        <section className={styles.content} aria-labelledby={labelledBy}>
          {children}
        </section>
      </main>
    </div>
  );
}
