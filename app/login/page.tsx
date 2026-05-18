'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function QueryReader({
  setEmail, setPassword, setShowMagicLink,
}: {
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setShowMagicLink: (v: boolean) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('magic') === '1') setShowMagicLink(true);
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
  }, [searchParams, setEmail, setPassword, setShowMagicLink]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (showMagicLink) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string; code?: string; redirectTo?: string };
      if (!res.ok) {
        if (data.code === 'USE_MAGIC_LINK') { setShowMagicLink(true); setError(''); }
        else setError(data.error ?? 'Login failed. Check your email and password.');
        return;
      }
      router.push(data.redirectTo ?? '/dashboard');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleMagicLink() {
    if (!email.trim()) { setMagicLinkError('Please enter your email address above first.'); return; }
    setMagicLinkLoading(true); setMagicLinkError('');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setMagicLinkError(data.error ?? 'Could not send link.'); return; }
      setMagicLinkSent(true);
    } catch { setMagicLinkError('Network error. Please try again.'); }
    finally { setMagicLinkLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Suspense fallback={null}>
          <QueryReader setEmail={setEmail} setPassword={setPassword} setShowMagicLink={setShowMagicLink} />
        </Suspense>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>E</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>EdProSys</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>School management platform</div>
        </div>

        {/* Role selector buttons — shown before the form */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <a href="/parent/login" style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#EEF2FF', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4338CA', textDecoration: 'none', border: '1px solid #C7D2FE' }}>
            🏠 Parent Login
          </a>
          <a href="/student/login" style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#F0FDF4', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#16A34A', textDecoration: 'none', border: '1px solid #BBF7D0' }}>
            🎓 Student Login
          </a>
        </div>

        {/* Staff/Admin card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {!showMagicLink ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Staff / School Login</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>For school owner, admin, principal, teacher accounts</div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>EMAIL ADDRESS</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                    style={{ width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: loading ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' }}
                    placeholder="admin@yourschool.edu.in" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>PASSWORD</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                    style={{ width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: loading ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' }}
                    placeholder="Enter your password" />
                </div>
                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <button type="button" onClick={() => setShowMagicLink(true)}
                    style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                    Forgot password? Sign in with email link
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: loading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
                  {loading ? (
                    <>
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Signing in...
                    </>
                  ) : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Sign in with email link</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a secure one-click sign-in link.
              </div>
              {!magicLinkSent ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>EMAIL ADDRESS</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' }}
                      placeholder="admin@yourschool.edu.in" />
                  </div>
                  {magicLinkError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 14 }}>{magicLinkError}</div>
                  )}
                  <button type="button" onClick={handleMagicLink} disabled={magicLinkLoading}
                    style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: magicLinkLoading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: magicLinkLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', marginBottom: 12 }}>
                    {magicLinkLoading ? 'Sending...' : 'Send sign-in link'}
                  </button>
                  <button type="button" onClick={() => { setShowMagicLink(false); setMagicLinkError(''); }}
                    style={{ width: '100%', background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0' }}>
                    ← Back to password sign-in
                  </button>
                </>
              ) : (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginBottom: 6 }}>Check your inbox</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    We sent a sign-in link to <strong>{email}</strong>.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6B7280' }}>
          New school?{' '}
          <a href="/register" style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>Create account →</a>
        </div>
      </div>
    </div>
  );
}
