'use client';
// app/activate/page.tsx
// ISS-OTP PR5 (staff) — self-service login activation via phone OTP.
// Step 1: phone -> send OTP. Step 2: OTP + new password -> provision login.
// Covers all shared-login roles (staff, principal, admin_staff, teacher,
// accountant, librarian, hod, meo, deo, registrar, ...).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'phone' | 'otp' | 'done';

export default function StaffActivatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151' };

  async function sendOtp() {
    if (!phone.trim()) { setError('Enter your registered phone number.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/staff/activate/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not send OTP.'); return; }
      setStep('otp');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!code.trim()) { setError('Enter the OTP.'); return; }
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/staff/activate/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), new_password: pw }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Activation failed.'); return; }
      setStep('done');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Activate your login</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {step === 'phone' ? 'We’ll send an OTP to your registered number.'
              : step === 'otp' ? 'Enter the OTP and choose a password.'
              : 'All set!'}
          </div>
        </div>

        {step === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Registered phone</label>
              <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" style={inputStyle} />
            </div>
            <button onClick={() => void sendOtp()} disabled={busy}
              style={{ marginTop: 6, padding: '12px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>OTP</label>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" style={inputStyle} />
            </div>
            <div>
              <label style={label}>New password</label>
              <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
            </div>
            <div>
              <label style={label}>Confirm password</label>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show password
            </label>
            <button onClick={() => void verify()} disabled={busy}
              style={{ padding: '12px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Activating…' : 'Activate login'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 18, color: '#065F46', fontSize: 14 }}>
              ✅ Your login is active. Sign in with your email and new password.
            </div>
            <button onClick={() => router.push('/login')}
              style={{ marginTop: 16, padding: '12px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Go to sign in
            </button>
          </div>
        )}

        {error && step !== 'done' && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>{error}</div>
        )}

        {step !== 'done' && (
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
            <Link href="/login" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
