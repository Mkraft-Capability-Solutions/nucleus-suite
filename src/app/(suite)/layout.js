import './globals.css';
import {t} from '@/lib/i18n';
import {loadInterfaceMessages} from '@/services/localization';
import { appearanceBootstrap, appearances } from '@/lib/appearance';
import { uiModeBootstrap } from '@/lib/ui-mode';
import { accentBootstrap } from '@/lib/accent';
import { uiFont } from '@/styles/fonts';

export const metadata = {
  title: t('metadata','title'),
  icons: {
    icon: [
      { url: '/images/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/images/favicon_io/apple-touch-icon.png',
  },
  manifest: '/images/favicon_io/site.webmanifest',
  description: t('metadata','description'),
};

import { Providers } from '@/components/Providers';

export default async function RootLayout({ children }) {
  const {locale,messages}=await loadInterfaceMessages();
  return (
    <html lang={locale} data-theme="light" data-appearance="light" data-ui-mode="classic" data-accent="indigo" className={uiFont.variable} style={appearances[0].tokens} suppressHydrationWarning>
      <head>
        <script id="nucleus-appearance" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
        <script id="nucleus-ui-mode" dangerouslySetInnerHTML={{ __html: uiModeBootstrap }} />
        <script id="nucleus-accent" dangerouslySetInnerHTML={{ __html: accentBootstrap }} />
      </head>
      <body suppressHydrationWarning={true}>
        <Providers locale={locale} messages={messages}>{children}</Providers>
      </body>
    </html>
  );
}
