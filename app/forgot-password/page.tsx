'use client';
// app/forgot-password/page.tsx
// Standalone forgot password page — sends magic link to registered email
// Already linked from login page via "Forgot password?" button
import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email required'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const d = await r.json();
      if (r.ok) { setSent(true); }
      else { setError(d.error ?? 'Something went wrong. Please try again.'); }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24, fontWeight: 800, color: '#fff' }}>E</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>EdProSys</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Password reset</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '32px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {!sent ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Reset your password</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>
                Enter your registered email. We&apos;ll send you a one-click sign-in link.
              </div>
              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>EMAIL ADDRESS</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@yourschool.edu.in"
                  style={{ width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box', marginBottom: 20 }} />
                <button type="submit" disabled={loading}
                  style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: loading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Sending...' : 'Send sign-in link'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#065F46', marginBottom: 8 }}>Check your inbox</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                A sign-in link was sent to <strong>{email}</strong>.<br />Click the link to sign in — it expires in 1 hour.
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Don&apos;t see it? Check your spam folder.</div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          <Link href="/login" style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
