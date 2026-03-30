import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.easyvenuez.com'),
  title: {
    default: 'School OS — AI School Management for Indian Schools',
    template: '%s | School OS',
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
    siteName: 'School OS',
    title: 'School OS — AI-First School Management for Indian Schools',
    description: 'WhatsApp parent bot, AI report cards, teacher evaluation — all automated. Built for Indian K-12 schools.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'School OS — AI School Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'School OS — AI School Management',
    description: 'AI school management for Indian K-12 schools. WhatsApp bot, report cards, teacher eval — automated.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
