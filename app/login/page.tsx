'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// F7: DemoPreFill reads ?demo=1 — must be in its own component for Suspense
function DemoPreFill({ setEmail, setPassword }: { setEmail: (v: string) => void; setPassword: (v: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      setEmail('admin@suchitracademy.edu.in');
      setPassword('schoolos0000');
    }
  }, [searchParams, setEmail, setPassword]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Triggered when /api/auth/login returns code === 'USE_MAGIC_LINK'.
  // Disables the password form and reveals the magic-link CTA for this email.
  const [needsMagicLink, setNeedsMagicLink] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (needsMagicLink) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string; code?: string; school?: string; redirectTo?: string };

      if (!res.ok) {
        if (data.code === 'USE_MAGIC_LINK') {
          setNeedsMagicLink(true);
          setError('Your account has been upgraded. Click below to receive a magic link to sign in.');
        } else {
          setError(data.error ?? 'Login failed');
        }
        return;
      }

      router.push(data.redirectTo ?? '/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    setMagicLinkLoading(true);
    setMagicLinkError('');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setMagicLinkError(data.error ?? 'Could not send link. Please try again.');
        return;
      }
      setMagicLinkSent(true);
    } catch {
      setMagicLinkError('Network error. Please try again.');
    } finally {
      setMagicLinkLoading(false);
    }
  }

  const inputsDisabled = needsMagicLink || loading;

  return (
    <div style={{
      minHeight: '100vh', background: '#F9FAFB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Suspense fallback={null}>
          <DemoPreFill setEmail={setEmail} setPassword={setPassword} />
        </Suspense>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: '#4F46E5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 24, fontWeight: 800, color: '#fff',
          }}>S</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            School OS
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            AI-first school management platform
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: '32px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            Sign in to your school
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
            Sign in with your school credentials
          </div>

          {error && (
            <div style={{
              background: needsMagicLink ? '#EFF6FF' : '#FEF2F2',
              border: `1px solid ${needsMagicLink ? '#BFDBFE' : '#FECACA'}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              color: needsMagicLink ? '#1E3A8A' : '#991B1B', marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={inputsDisabled}
                style={{
                  width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
                  background: inputsDisabled ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px',
                  outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
                  cursor: inputsDisabled ? 'not-allowed' : 'text',
                }}
                placeholder="admin@yourschool.edu.in"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={inputsDisabled}
                style={{
                  width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
                  background: inputsDisabled ? '#F3F4F6' : '#F9FAFB', fontSize: 14, padding: '0 14px',
                  outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
                  cursor: inputsDisabled ? 'not-allowed' : 'text',
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={inputsDisabled}
              style={{
                width: '100%', height: 44, borderRadius: 10, border: 'none',
                background: inputsDisabled ? '#9CA3AF' : (loading ? '#818CF8' : '#4F46E5'),
                color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: inputsDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, boxSizing: 'border-box',
              }}
            >
              {loading ? (
                <>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {needsMagicLink && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #E5E7EB' }}>
              {magicLinkSent ? (
                <div style={{
                  background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
                  padding: '12px 14px', fontSize: 13, color: '#166534',
                }}>
                  Check your email — we sent you a link to sign in.
                </div>
              ) : (
                <>
                  {magicLinkError && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 12,
                    }}>
                      {magicLinkError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={magicLinkLoading || !email}
                    style={{
                      width: '100%', height: 44, borderRadius: 10, border: 'none',
                      background: magicLinkLoading ? '#818CF8' : '#4F46E5', color: '#fff',
                      fontSize: 15, fontWeight: 600,
                      cursor: magicLinkLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8, boxSizing: 'border-box',
                    }}
                  >
                    {magicLinkLoading ? (
                      <>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Sending...
                      </>
                    ) : 'Send me a magic link'}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#6B7280', marginTop: 10 }}>
                    Refresh the page to go back to password sign-in.
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, padding: '12px 14px', background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Demo credentials:</strong><br />
            Email: your-email@school.edu.in<br />
            Password: schoolos&lt;first-4-of-school-id&gt;
          </div>
        </div>

        {/* Register link */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          New school?{' '}
          <a href="/register" style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>
            Create account →
          </a>
        </div>
      </div>
    </div>
  );
}
