import './globals.css';
import {t} from '@/lib/i18n';
import {loadInterfaceMessages} from '@/services/localization';
import { appearanceBootstrap, appearances } from '@/lib/appearance';

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

import { Providers } from '../components/Providers';

export default async function RootLayout({ children }) {
  const {locale,messages}=await loadInterfaceMessages();
  return (
    <html lang={locale} data-theme="light" data-appearance="light" style={appearances[0].tokens} suppressHydrationWarning>
      <head><script id="nucleus-appearance" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /></head>
      <body suppressHydrationWarning={true}>
        <Providers locale={locale} messages={messages}>{children}</Providers>
      </body>
    </html>
  );
}
