import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Sofia_Sans_Extra_Condensed } from 'next/font/google';
import './globals.css';

const disp = Sofia_Sans_Extra_Condensed({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-disp', display: 'swap' });
const text = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-text', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'LFSTYL',
  description: 'Tasks, goals and a per-paycheck budget that all move the same money.',
  applicationName: 'LFSTYL',
  appleWebApp: { capable: true, title: 'LFSTYL', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#121018' },
    { media: '(prefers-color-scheme: light)', color: '#f1efec' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${disp.variable} ${text.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
