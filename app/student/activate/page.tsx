'use client';
// app/student/activate/page.tsx
// ISS-OTP PR5 (students) — first-time activation via OTP sent to the parent phone.
// Step 1: admission number (+ school id if multiple schools match) -> send OTP.
// Step 2: enter OTP + choose a new PIN -> activate + sign in.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'id' | 'otp';

export default function StudentActivatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('id');
  const [admission, setAdmission] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [needSchool, setNeedSchool] = useState(false);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', outline: 'none', marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151' };

  async function sendOtp() {
    if (!admission.trim()) { setError('Enter your admission number.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/student/activate/request', {
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
    if (!/^\d{4,6}$/.test(pin)) { setError('New PIN must be 4 to 6 digits.'); return; }
    if (pin !== confirm) { setError('PIN and confirmation do not match.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/student/activate/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_number: admission.trim(), school_id: schoolId.trim() || undefined, code: code.trim(), new_pin: pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Activation failed.'); return; }
      router.push(d.redirectTo ?? '/student');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🎓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Activate your login</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {step === 'id' ? 'We’ll send an OTP to your registered parent number.' : 'Enter the OTP and choose a PIN.'}
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
            <button onClick={() => void sendOtp()} disabled={busy}
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
              style={{ padding: '12px', background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Activating…' : 'Activate & Sign In'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>{error}</div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12 }}>
          <Link href="/student/login" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
