'use client';
// app/vendor/login/page.tsx
// ISS-7 (#7) — Vendor portal login (portal_email + PIN).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VendorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !pin.trim()) { setError('Please enter your email and PIN.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/vendor/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_email: email.trim(), pin: pin.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { router.push(d.redirectTo ?? '/vendor'); return; }
      setError(d.error ?? 'Invalid email or PIN.');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#0EA5E9,#1E40AF)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700 }}>∞</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>EdPro<span style={{ color: '#0EA5E9' }}>Sys</span></span>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: '#EEF2FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>🏷️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Vendor Portal</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Sign in with the email & PIN from your school</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
              placeholder="vendor@example.com"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>PIN</label>
            <div style={{ position: 'relative' }}>
              <input type={showPin ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value)}
                placeholder="Your PIN" autoComplete="current-password"
                style={{ width: '100%', padding: '12px 56px 12px 14px', border: `1px solid ${error ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }} />
              <button type="button" onClick={() => setShowPin(v => !v)} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                style={{ position: 'absolute', right: 12, top: 0, bottom: 0, background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showPin ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>{error}</div>
          )}

          <button onClick={() => void handleLogin()} disabled={loading}
            style={{ padding: '14px', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
          No access yet? Ask the school to enable your vendor portal login.
        </div>
      </div>
    </div>
  );
}
