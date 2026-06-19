'use client';
// app/vendor/activate/page.tsx
// ISS-OTP PR5 (vendors) — first-time activation via OTP to the contact phone.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'email' | 'otp';

export default function VendorActivatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151' };

  async function sendOtp() {
    if (!email.trim()) { setError('Enter your portal email.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/vendor/activate/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not send OTP.'); return; }
      setStep('otp');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!code.trim()) { setError('Enter the OTP.'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError('New PIN must be 4 to 6 digits.'); return; }
    if (pin !== confirm) { setError('PIN and confirmation do not match.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/vendor/activate/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_email: email.trim(), code: code.trim(), new_pin: pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Activation failed.'); return; }
      router.push(d.redirectTo ?? '/vendor');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: '#EEF2FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>🏷️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>Activate vendor login</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {step === 'email' ? 'We’ll send an OTP to your registered number.' : 'Enter the OTP and choose a PIN.'}
          </p>
        </div>

        {step === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Portal email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" style={inputStyle} />
            </div>
            <button onClick={() => void sendOtp()} disabled={busy}
              style={{ marginTop: 6, padding: '13px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>OTP</label>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" style={inputStyle} />
            </div>
            <div>
              <label style={label}>New PIN</label>
              <input type={show ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value)} inputMode="numeric" placeholder="4–6 digit PIN" style={inputStyle} />
            </div>
            <div>
              <label style={label}>Confirm PIN</label>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} inputMode="numeric" placeholder="Re-enter PIN" style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show PIN
            </label>
            <button onClick={() => void verify()} disabled={busy}
              style={{ padding: '13px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Activating…' : 'Activate & Sign In'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>{error}</div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
          <Link href="/vendor/login" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
