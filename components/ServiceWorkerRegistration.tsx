'use client';
// components/ServiceWorkerRegistration.tsx
// Batch 3B — Registers service worker + lazily initialises OneSignal
// if NEXT_PUBLIC_ONESIGNAL_APP_ID env var is set.
// Uses OneSignal Web SDK v16 via script tag (no npm package needed).
// Founder action: set NEXT_PUBLIC_ONESIGNAL_APP_ID in Vercel env vars.

import { useEffect } from 'react';

// Minimal type shim for OneSignal window global
declare global {
  interface Window {
    OneSignalDeferred?: ((os: { init: (opts: Record<string, unknown>) => void }) => void)[];
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register our custom service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered, scope:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }

    // OneSignal init — only runs if env var is configured.
    // Uses script-tag loading (SDK v16) — no npm package required.
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    // OneSignal Web SDK v16 deferred init pattern
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(function (OneSignal) {
      OneSignal.init({
        appId,
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
      });
    });

    // Inject OneSignal SDK script if not already present
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
