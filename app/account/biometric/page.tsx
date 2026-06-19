'use client';
// app/account/biometric/page.tsx
// ISS-OTP PR7 — enable/disable fingerprint unlock. Uniform for every role.
// Feature-detected: on web or unsupported devices it explains it's app-only.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, authenticateBiometric } from '@/lib/biometric';

export default function BiometricSettingsPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      setAvailable(await isBiometricAvailable());
      setEnabled(isBiometricEnabled());
    })();
  }, []);

  async function enable() {
    setBusy(true); setMsg('');
    const ok = await authenticateBiometric('Confirm to enable fingerprint unlock');
    setBusy(false);
    if (ok) { setBiometricEnabled(true); setEnabled(true); setMsg('Fingerprint unlock enabled.'); }
    else setMsg('Could not verify. Fingerprint unlock was not enabled.');
  }

  function disable() {
    setBiometricEnabled(false); setEnabled(false); setMsg('Fingerprint unlock disabled.');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 36 }}>🔐</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', marginTop: 6 }}>Fingerprint unlock</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Lock the app and reopen it with your fingerprint. Your PIN / password always works as a fallback.</div>
        </div>

        {available === null ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 16 }}>Checking…</div>
        ) : !available ? (
          <div style={{ background: '#F3F4F6', borderRadius: 10, padding: 14, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
            Fingerprint unlock is available only in the installed EdProSys app on a device with a fingerprint set up.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Status</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: enabled ? '#15803D' : '#9CA3AF' }}>{enabled ? 'Enabled' : 'Off'}</span>
            </div>
            {enabled ? (
              <button onClick={disable}
                style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Turn off fingerprint unlock
              </button>
            ) : (
              <button onClick={() => void enable()} disabled={busy}
                style={{ background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? 'Verifying…' : 'Enable fingerprint unlock'}
              </button>
            )}
          </div>
        )}

        {msg && <div style={{ marginTop: 14, fontSize: 13, color: '#374151', textAlign: 'center' }}>{msg}</div>}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12 }}>
          <Link href="/settings" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Back</Link>
        </div>
      </div>
    </div>
  );
}
