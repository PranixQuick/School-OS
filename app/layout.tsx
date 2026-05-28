import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
};

export const metadata: Metadata = {
  title: 'School OS — The Operating System for Indian Schools',
  description: 'AI-first school operating system for Indian K-12 schools. WhatsApp parent bot, AI report cards, teacher evaluation, and automated principal briefings.',
  keywords: 'school management software India,AI school ERP,WhatsApp school app,CBSE report card AI,School OS,school management system,AI teacher evaluation,parent communication app India',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  manifest: '/manifest.json',
  appleWebApp: { title: 'School OS', statusBarStyle: 'black-translucent', capable: true },
  openGraph: {
    title: 'School OS — Powering Institutions. Empowering Futures.',
    description: 'WhatsApp parent bot, AI report cards, teacher evaluation — all automated. Built for Indian K-12 schools.',
    siteName: 'School OS', locale: 'en_IN',
    images: [{ url: 'https://www.schoolos.in/api/og', width: 1200, height: 630, alt: 'School OS — Education Infrastructure Platform' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'School OS — The Operating System for Indian Schools',
    description: 'AI school management for Indian K-12 schools. WhatsApp bot, report cards, teacher eval — automated.',
    images: ['https://www.schoolos.in/api/og'],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/brand/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

function ServiceWorkerRegistration() {
  // Guard: only run in browser, catch all errors to prevent Android WebView crashes
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(reg) { console.log('[SW] registered scope:', reg.scope); })
        .catch(function(err) { console.warn('[SW] registration failed (non-fatal):', err); });
    });
  }
} catch(e) { console.warn('[SW] init error (non-fatal):', e); }
`,
      }}
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
