import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogInScreen } from '@/features/auth/log-in-screen';
import { staticT } from '@/i18n/catalog';
import authCatalog from '@/i18n/catalogs/auth';

const t = staticT(authCatalog);

export const metadata: Metadata = {
  title: t('meta.title'),
};

export default function LogInPage(): ReactNode {
  return <LogInScreen />;
}
