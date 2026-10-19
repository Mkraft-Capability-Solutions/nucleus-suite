'use client';

/**
 * Tenant logo for the current mode (logoDark on dark backgrounds, falling back to logoLight), or the Nucleus mark
 * plus wordmark when the tenant has no logo. Rendered at a fixed token height with explicit intrinsic dimensions
 * (no layout shift); the alt text comes from the theming catalog.
 */
import type { ReactNode } from 'react';
import themingCatalog from '@/i18n/catalogs/theming';
import { useTranslations } from '@/i18n/use-translations';
import type { TenantBranding } from './tenant-branding';
import { NucleusLogo } from './nucleus-logo';
import { useTheme } from './use-theme';
import styles from './brand-logo.module.css';

/** Product name; a brand name, never translated. */
const PRODUCT_NAME = 'Nucleus';

export interface BrandLogoProps {
  readonly branding?: Pick<TenantBranding, 'displayName' | 'logoLight' | 'logoDark'>;
}

export function BrandLogo({ branding }: BrandLogoProps): ReactNode {
  const t = useTranslations(themingCatalog);
  const { resolvedMode } = useTheme();
  const logo = resolvedMode === 'dark' ? (branding?.logoDark ?? branding?.logoLight) : branding?.logoLight;

  if (branding && logo) {
    return (
      <img
        className={styles.logo}
        src={logo.url}
        width={logo.widthPx}
        height={logo.heightPx}
        alt={t('logo.alt', { name: branding.displayName })}
        decoding="async"
      />
    );
  }

  return (
    <span className={styles.fallback}>
      <NucleusLogo label={t('logo.alt', { name: PRODUCT_NAME })} />
      <span className={styles.wordmark} aria-hidden="true">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
