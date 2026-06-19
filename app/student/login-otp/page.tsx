'use client';
// app/student/login-otp/page.tsx
// ISS-OTP PR6 (students) — passwordless sign-in via OTP to the parent phone.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'id' | 'otp';

export default function StudentLoginOtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('id');
  const [admission, setAdmission] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [needSchool, setNeedSchool] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 16, boxSizing: 'border-box', outline: 'none', marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151' };

  async function send() {
    if (!admission.trim()) { setError('Enter your admission number.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/student/login-otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_number: admission.trim(), school_id: schoolId.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.code === 'MULTI_SCHOOL') { setNeedSchool(true); setError('Please enter your school ID.'); return; }
      if (!r.ok) { setError(d.error || 'Could not send OTP.'); return; }
      setStep('otp');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!code.trim()) { setError('Enter the OTP.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/student/login-otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_number: admission.trim(), school_id: schoolId.trim() || undefined, code: code.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Sign-in failed.'); return; }
      router.push(d.redirectTo ?? '/student');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🎓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Sign in with OTP</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {step === 'id' ? 'We’ll send a code to your registered parent number.' : 'Enter the code we sent.'}
          </div>
        </div>

        {step === 'id' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Admission Number</label>
              <input value={admission} onChange={e => setAdmission(e.target.value)} placeholder="e.g. 2024-001" style={inputStyle} />
            </div>
            {needSchool && (
              <div>
                <label style={label}>School ID</label>
                <input value={schoolId} onChange={e => setSchoolId(e.target.value)} placeholder="Provided by your school" style={inputStyle} />
              </div>
            )}
            <button onClick={() => void send()} disabled={busy}
              style={{ marginTop: 6, padding: '12px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>OTP</label>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" style={inputStyle} />
            </div>
            <button onClick={() => void verify()} disabled={busy}
              style={{ padding: '12px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>{error}</div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
          <Link href="/student/login" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Sign in with PIN instead</Link>
        </div>
      </div>
    </div>
  );
}
