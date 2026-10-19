import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_MODE_PREFERENCE, DEFAULT_THEME_ID } from '@nucleus/design-tokens';
import { ThemeProvider } from '@/features/theming/theme-provider';
import { MOTION_FLAG_SCRIPT } from '@/features/landing/motion/motion-flag';
import { THEME_INIT_SCRIPT } from '@/features/theming/theme-preference';
import { staticT } from '@/i18n/catalog';
import appCatalog from '@/i18n/catalogs/app';
import { DEFAULT_LOCALE, getLocale, localeFontProperties } from '@/i18n/locales';
import { uiFont } from '@/styles/fonts';
import '@/styles/tokens.css';
import './globals.css';

const t = staticT(appCatalog);

export const metadata: Metadata = {
  title: t('meta.title'),
  description: t('meta.description'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const locale = getLocale(DEFAULT_LOCALE);

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html
      lang={locale.tag}
      dir={locale.dir}
      data-theme={DEFAULT_THEME_ID}
      data-mode={DEFAULT_MODE_PREFERENCE}
      className={uiFont.variable}
      style={localeFontProperties(locale.code)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
