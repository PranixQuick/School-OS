import type { Metadata } from 'next';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.edprosys.com'),
  title: {
    default: 'EdProSys — The Operating System for Indian Education',
    template: '%s | EdProSys',
  },
  description: 'AI-first school operating system for Indian K-12 schools. WhatsApp parent bot, AI report cards, teacher evaluation, and automated principal briefings.',
  keywords: [
    'school management software India',
    'AI school ERP',
    'WhatsApp school app',
    'CBSE report card AI',
    'school OS',
    'school management system',
    'AI teacher evaluation',
    'parent communication app India',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'EdProSys',
    title: 'EdProSys — Powering Institutions. Empowering Futures.',
    description: 'WhatsApp parent bot, AI report cards, teacher evaluation — all automated. Built for Indian K-12 schools.',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'EdProSys — Education Infrastructure Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EdProSys — The Operating System for Indian Education',
    description: 'AI school management for Indian K-12 schools. WhatsApp bot, report cards, teacher eval — automated.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'EdProSys',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366F1" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}
