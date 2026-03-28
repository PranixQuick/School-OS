'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@suchitracademy.edu.in');
  const [password, setPassword] = useState('admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { error?: string; school?: string };

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F9FAFB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

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
            Enter your admin credentials to continue
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              color: '#991B1B', marginBottom: 18,
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
                style={{
                  width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
                  background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none',
                  fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
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
                style={{
                  width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
                  background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none',
                  fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 44, borderRadius: 10, border: 'none',
                background: loading ? '#818CF8' : '#4F46E5', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
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

          <div style={{ marginTop: 24, padding: '12px 14px', background: '#F9FAFB', borderRadius: 8, fontSize: 12, color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Demo credentials:</strong><br />
            Email: admin@suchitracademy.edu.in<br />
            Password: admin@123
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
