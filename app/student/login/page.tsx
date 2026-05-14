'use client';
// app/student/login/page.tsx
// Batch 4D — Student login: admission number + PIN.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ admission_number: '', pin: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!form.admission_number || !form.pin) { setError('Please enter your admission number and PIN'); return; }
    setLoading(true); setError(null);
    const res = await fetch('/api/student/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admission_number: form.admission_number.trim(), pin: form.pin.trim() }),
    });
    const d = await res.json() as { redirectTo?: string; error?: string; name?: string };
    if (res.ok) {
      router.push(d.redirectTo ?? '/student');
    } else {
      setError(d.error ?? 'Login failed');
    }
    setLoading(false);
  }

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const, outline: 'none', marginTop: 4 };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 36, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>Student Portal</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Sign in with your admission number and PIN</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Admission Number</label>
            <input
              value={form.admission_number}
              onChange={e => setForm(f => ({ ...f, admission_number: e.target.value }))}
              placeholder="e.g. 2024-001"
              style={inputStyle}
              autoComplete="username"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>PIN</label>
            <input
              type="password"
              value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
              placeholder="4-6 digit PIN"
              maxLength={6}
              style={inputStyle}
              autoComplete="current-password"
              onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 12, color: '#DC2626' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => void handleLogin()}
          disabled={loading}
          style={{ marginTop: 20, width: '100%', padding: '11px', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
          Forgot your PIN? Contact your school admin.
        </div>
      </div>
    </div>
  );
}
