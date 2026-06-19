import type { Metadata, Viewport } from 'next';
import './globals.css';
import BiometricLock from '@/components/BiometricLock';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
};

export const metadata: Metadata = {
  title: 'EdProSys — The Operating System for Indian Education',
  description: 'AI-first school operating system for Indian K-12 schools. WhatsApp parent bot, AI report cards, teacher evaluation, and automated principal briefings.',
  keywords: 'school management software India,AI school ERP,WhatsApp school app,CBSE report card AI,school OS,school management system,AI teacher evaluation,parent communication app India',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  manifest: '/manifest.json',
  appleWebApp: { title: 'EdProSys', statusBarStyle: 'black-translucent', capable: true },
  openGraph: {
    title: 'EdProSys — Powering Institutions. Empowering Futures.',
    description: 'WhatsApp parent bot, AI report cards, teacher evaluation — all automated. Built for Indian K-12 schools.',
    siteName: 'EdProSys', locale: 'en_IN',
    images: [{ url: 'https://www.edprosys.com/api/og', width: 1200, height: 630, alt: 'EdProSys — Education Infrastructure Platform' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EdProSys — The Operating System for Indian Education',
    description: 'AI school management for Indian K-12 schools. WhatsApp bot, report cards, teacher eval — automated.',
    images: ['https://www.edprosys.com/api/og'],
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

// MCP-BR-02 Human Workflow Recorder embed.
// Inert by default. Activates ONLY when the URL carries ?br02=1, loading the
// reusable rrweb recorder from the agent-engine and exposing window.PranixBR02.
// The event key is read from a server-injected <meta name="br02-event-key">
// (never hardcoded). Masked-by-default + consent-gated inside the recorder.
function BR02Recorder() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
try {
  if (typeof window !== 'undefined' && /[?&]br02=1/.test(window.location.search)) {
    var s = document.createElement('script');
    s.src = 'https://pranix-agent-engine.vercel.app/br02-recorder.js';
    s.async = true;
    s.onload = function () {
      try {
        var keyEl = document.querySelector('meta[name="br02-event-key"]');
        window.__BR02_READY = true;
        console.log('[BR02] recorder loaded. Call PranixBR02.start({product,role,consentRef,certItem,endpoint,eventKey}) to record.');
        window.__br02EventKey = keyEl ? keyEl.getAttribute('content') : '';
      } catch (e) { console.warn('[BR02] init warning (non-fatal):', e); }
    };
    s.onerror = function () { console.warn('[BR02] recorder load failed (non-fatal)'); };
    document.head.appendChild(s);
  }
} catch (e) { console.warn('[BR02] embed error (non-fatal):', e); }
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
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&family=Noto+Sans+Telugu:wght@400;500;700&family=Noto+Sans+Tamil:wght@400;500;700&family=Noto+Sans+Kannada:wght@400;500;700&family=Noto+Sans+Malayalam:wght@400;500;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
        <BR02Recorder />
      </body>
    </html>
  );
}
