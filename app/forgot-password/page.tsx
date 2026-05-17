'use client';
// app/forgot-password/page.tsx
// Forgot password flow for staff (owner, teacher, admin, principal, accountant)
// Parents do NOT use this — they use phone+PIN. Admin resends PIN for them.
import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>EdProSys</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            {submitted ? 'Check your email' : 'Reset your password'}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 10 }}>
                Check your inbox
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                If <strong>{email}</strong> is registered, you&apos;ll receive a sign-in link shortly.<br />
                Click the link to log in and set up your access.
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
                Didn&apos;t receive it? Check your spam folder or contact your school administrator.
              </div>
              <Link href="/login" style={{ display: 'inline-block', padding: '10px 20px', background: '#4F46E5', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 6 }}>Forgot your password?</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
                Enter your registered email address. We&apos;ll send you a one-click sign-in link.
                <br /><br />
                <span style={{ fontSize: 12 }}>🔑 <strong>Parents:</strong> Contact your school admin to resend your PIN via WhatsApp.</span>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.edu.in"
                  style={{ width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 20 }}
                />
                <button
                  type="submit" disabled={loading}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {loading ? 'Sending...' : 'Send Sign-in Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          Remember your password?{' '}
          <Link href="/login" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
