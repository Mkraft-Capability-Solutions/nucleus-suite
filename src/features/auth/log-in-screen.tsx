'use client';

/**
 * Log in screen: the shared auth split layout with the Nucleus scene (columns 1–6) and the form (columns 8–12).
 * Owns the scene's busy state: the form turns it on when it submits and off when the request fails.
 */
import { useId, useState, type ReactNode } from 'react';
import authCatalog from '@/i18n/catalogs/auth';
import { useTranslations } from '@/i18n/use-translations';
import { AuthShell } from './auth-shell';
import { LogInForm } from './log-in-form';
import styles from './log-in.module.css';

export function LogInScreen(): ReactNode {
  const t = useTranslations(authCatalog);
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell busy={busy} labelledBy={headingId}>
      <div>
        <h1 id={headingId} className={styles.heading}>
          {t('heading')}
        </h1>
        <p className={styles.subheading}>{t('subheading')}</p>
        <LogInForm onBusyChange={setBusy} />
      </div>
    </AuthShell>
  );
}
