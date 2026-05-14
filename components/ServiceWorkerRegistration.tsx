'use client';
// components/ServiceWorkerRegistration.tsx
// Batch 3B — Registers service worker + lazily initialises OneSignal
// if NEXT_PUBLIC_ONESIGNAL_APP_ID env var is set.
// Founder action: set NEXT_PUBLIC_ONESIGNAL_APP_ID in Vercel env vars.

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered, scope:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }

    // OneSignal init — lazy import, only runs if env var is configured.
    // No errors thrown if var is absent.
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (appId && typeof window !== 'undefined') {
      import('react-onesignal')
        .then(({ default: OneSignal }) => {
          OneSignal.init({
            appId,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
          }).then(() => console.log('[OneSignal] Initialized'));
        })
        .catch((err) => console.warn('[OneSignal] Init failed:', err));
    }
  }, []);

  return null;
}
