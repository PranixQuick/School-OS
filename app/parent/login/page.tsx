'use client';
// app/parent/login/page.tsx
// Batch 10 — Parent login page.
// Phone + PIN authentication. On success redirects to /parent.
// Parent accounts created by school admin — no self-service signup.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!phone.trim() || !pin.trim()) { setError('Please enter your phone number and PIN.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/parent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        router.push('/parent');
      } else {
        setError(data.error ?? 'Invalid phone number or PIN. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#EEF2FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>
            🏫
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Parent Portal</h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Sign in to view your child{"'"}s progress</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              PIN
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="4–6 digit PIN"
              maxLength={6}
              autoComplete="current-password"
              inputMode="numeric"
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 8, fontSize: 14, outline: 'none', letterSpacing: 6, boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }}
            />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>
              {error}
            </div>
          )}

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            style={{ padding: '11px', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        {/* Help text */}
        <div style={{ marginTop: 20, padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
          <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', lineHeight: 1.5 }}>
            First time? Contact your school admin to get your login PIN.
            PINs are sent to your registered phone number via WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
