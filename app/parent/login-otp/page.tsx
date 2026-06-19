'use client';
// app/parent/login-otp/page.tsx
// ISS-OTP PR6 (parents) — passwordless sign-in with a phone OTP (no PIN).

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'phone' | 'otp';

// Seconds to wait before another code can be requested. Kept above MSG91's
// ~10s duplicate-suppression window so a resend is never silently dropped.
const RESEND_COOLDOWN = 30;

export default function ParentLoginOtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Tick the resend cooldown down to zero, one second at a time.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const inputStyle: React.CSSProperties = { width: '100%', padding: '14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', outline: 'none', marginTop: 4 };
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 };

  // Request (or re-request) a code for the entered phone. Starts the cooldown on
  // success; surfaces the server error otherwise. Returns whether it succeeded.
  async function requestCode(): Promise<boolean> {
    const r = await fetch('/api/parent/login-otp/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || 'Could not send OTP.'); return false; }
    setResendIn(RESEND_COOLDOWN);
    return true;
  }

  async function send() {
    if (!phone.trim()) { setError('Enter your phone number.'); return; }
    setBusy(true); setError('');
    try {
      if (await requestCode()) setStep('otp');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setBusy(true); setError(''); setCode('');
    try {
      await requestCode();
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!code.trim()) { setError('Enter the OTP.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/parent/login-otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Sign-in failed.'); return; }
      router.push(d.redirectTo ?? '/parent');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: '#EEF2FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>🏫</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Sign in with OTP</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            {step === 'phone' ? 'We’ll text a one-time code to your number.' : 'Enter the code we sent you.'}
          </p>
        </div>

        {step === 'phone' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Phone Number</label>
              <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') void send(); }} />
            </div>
            <button onClick={() => void send()} disabled={busy}
              style={{ padding: '15px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', marginTop: 4 }}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>OTP</label>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') void verify(); }} />
            </div>
            <button onClick={() => void verify()} disabled={busy}
              style={{ padding: '15px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button onClick={() => void resend()} disabled={busy || resendIn > 0}
              style={{ padding: '8px', background: 'transparent', color: (busy || resendIn > 0) ? '#9CA3AF' : '#4F46E5', border: 'none', fontSize: 13, fontWeight: 600, cursor: (busy || resendIn > 0) ? 'default' : 'pointer' }}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>{error}</div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
          <Link href="/parent/login" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Sign in with PIN instead</Link>
        </div>
      </div>
    </div>
  );
}
