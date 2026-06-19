'use client';
// components/BiometricLock.tsx
// ISS-OTP PR7 — on-open biometric gate, mounted app-wide in the root layout.
//
// SAFE BY CONSTRUCTION: renders null unless running on a native build with
// biometry available AND the user has enabled it. On the web (Vercel) it is
// always null — isBiometricAvailable() returns false off-native — so it can
// never lock a web user out.

import { useState, useEffect } from 'react';
import { isBiometricAvailable, isBiometricEnabled, authenticateBiometric, setBiometricEnabled } from '@/lib/biometric';

export default function BiometricLock() {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function attempt() {
    setBusy(true);
    const ok = await authenticateBiometric();
    setBusy(false);
    if (ok) setLocked(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isBiometricEnabled()) return;
      const avail = await isBiometricAvailable();
      if (cancelled || !avail) return;
      setLocked(true);
      const ok = await authenticateBiometric();
      if (!cancelled && ok) setLocked(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!locked) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0F172A', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 44 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>EdProSys is locked</div>
      <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 280 }}>Unlock with your fingerprint or device PIN to continue.</div>
      <button onClick={() => void attempt()} disabled={busy}
        style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 26px', fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Verifying…' : 'Unlock'}
      </button>
      <button
        onClick={() => { setBiometricEnabled(false); setLocked(false); }}
        style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
        Can’t unlock? Turn off fingerprint lock
      </button>
    </div>
  );
}
