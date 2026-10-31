import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0b10' },
    { media: '(prefers-color-scheme: light)', color: '#f7f6f2' },
  ],
};

const siteUrl =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
  'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Audio Reader Highlight',
    template: '%s · Audio Reader Highlight',
  },
  description:
    'Text-to-speech that reads science, currencies and units naturally, and highlights the exact word being spoken.',
  keywords: [
    'text-to-speech',
    'tts',
    'speech synthesis',
    'react',
    'nextjs',
    'highlight',
    'accessibility',
    'units',
    'currencies',
  ],
  authors: [{ name: 'Hesbon Osoro', url: 'https://github.com/hesbon-osoro' }],
  creator: 'Hesbon Osoro',
  publisher: 'Hesbon Osoro',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Audio Reader Highlight',
    description:
      'Text-to-speech that reads science, currencies and units naturally, and highlights the exact word being spoken.',
    siteName: 'Audio Reader Highlight',
    images: [
      {
        url: '/images/audio-reader-highlight_cropped.png',
        width: 1200,
        height: 630,
        alt: 'Audio Reader Highlight preview',
      },
      {
        url: '/images/audio-reader-highlight.webp',
        width: 1200,
        height: 630,
        alt: 'Audio Reader Highlight preview (webp fallback)',
      },
      {
        url: '/images/audio-reader-highlight.png',
        width: 1200,
        height: 630,
        alt: 'Audio Reader Highlight preview (png fallback)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Audio Reader Highlight',
    description:
      'Text-to-speech that reads science, currencies and units naturally, and highlights the exact word being spoken.',
    creator: '@hesbon_osoro',
    images: ['/images/audio-reader-highlight_cropped.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [{ rel: 'android-chrome', url: '/android-chrome-192x192.png' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
