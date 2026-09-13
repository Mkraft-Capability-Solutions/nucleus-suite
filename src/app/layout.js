import './globals.css';
import { appearanceBootstrap, appearances } from '@/lib/appearance';

export const metadata = {
  title: 'Nucleus AI | HRMS',
  icons: {
    icon: [
      { url: '/images/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/images/favicon_io/apple-touch-icon.png',
  },
  manifest: '/images/favicon_io/site.webmanifest',
  description: 'AI-Powered Human Resource Management System',
};

import { Providers } from '../components/Providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" data-appearance="light" style={appearances[0].tokens} suppressHydrationWarning>
      <head><script id="nucleus-appearance" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /></head>
      <body suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
