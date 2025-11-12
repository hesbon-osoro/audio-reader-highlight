import './globals.css';
import { Toaster } from 'sonner';
import React from 'react';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

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
    'Natural TTS with synchronized highlighting for currencies, abbreviations, and units.',
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
      'Natural TTS with synchronized highlighting for currencies, abbreviations, and units.',
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
      'Natural TTS with synchronized highlighting for currencies, abbreviations, and units.',
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
    <html lang="en">
      <body>
        {/* Enhanced 3D Floating Background Elements */}
        <div className="floating-elements">
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
        </div>
        
        {/* Additional particle effects for wide screens */}
        <div className="particle-field">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>

        <SiteHeader />
        <main className="container">{children}</main>
        <SiteFooter />
        <Toaster
          richColors
          position="top-right"
          expand={true}
          visibleToasts={5}
          closeButton={true}
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            },
          }}
        />
      </body>
    </html>
  );
}
