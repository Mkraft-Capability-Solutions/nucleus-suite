import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LandingPage } from '@/features/landing/landing-page';
import { landingText } from '@/features/landing/i18n/landing-text';
import { displayFont } from '@/styles/fonts';

const t = landingText();

export const metadata: Metadata = {
  title: t('meta.title'),
  description: t('meta.description'),
};

/** Home: the Nucleus landing page (server-rendered). The display face (Fraunces) is preloaded on this route only. */
export default function HomePage(): ReactNode {
  return (
    <div className={displayFont.variable} data-font-scope="">
      <LandingPage />
    </div>
  );
}
