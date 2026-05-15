'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'creating' | 'done'>('form');
  const [form, setForm] = useState({
    school_name: '', admin_email: '', admin_name: '',
    contact_phone: '', board: 'CBSE',
    institution_type: 'school_k10', ownership_type: 'private',
  });
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  function set(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setStep('creating'); setError('');

    try {
      // Step 1: Create school
      const createRes = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const createData = await createRes.json() as { error?: string; school?: { id: string; name: string }; login?: { email: string; password: string } };

      if (!createRes.ok) {
        setError(createData.error ?? 'Registration failed');
        setStep('form');
        return;
      }

      setSchoolName(createData.school?.name ?? form.school_name);
      setLoginPassword(createData.login?.password ?? '');

      // Step 2: Auto-login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.admin_email, password: createData.login?.password ?? '' }),
      });

      if (loginRes.ok) {
        setStep('done');
        setTimeout(() => router.push('/dashboard'), 1800);
      } else {
        setStep('done'); // still show success, manual login
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('form');
    }
  }

  const inputStyle = {
    width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
    background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none',
    fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 } as const;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>S</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>School OS</span>
          </Link>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>Start your 14-day free trial</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

          {step === 'creating' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ width: 48, height: 48, border: '4px solid #E5E7EB', borderTop: '4px solid #4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
              <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 6 }}>Setting up your school...</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Creating account, loading demo data, configuring AI</div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{schoolName} is ready!</div>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>
                Your school is configured with demo data.<br />Logging you in automatically...
              </div>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: 'left', marginBottom: 20 }}>
                <strong>Your login:</strong><br />
                Email: {form.admin_email}<br />
                Password: {loginPassword}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Redirecting to dashboard...</div>
            </div>
          )}

          {step === 'form' && (
            <>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#111827', marginBottom: 4 }}>Create your school account</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Free forever · No credit card needed</div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 18 }}>{error}</div>
              )}

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>SCHOOL NAME *</label>
                  <input required style={inputStyle} value={form.school_name} onChange={e => set('school_name', e.target.value)} placeholder="e.g. Sunrise Academy" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>YOUR NAME *</label>
                    <input required style={inputStyle} value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Principal / Admin" />
                  </div>
                  <div>
                    <label style={labelStyle}>BOARD</label>
                    <select style={inputStyle} value={form.board} onChange={e => set('board', e.target.value)}>
                      {['CBSE', 'ICSE', 'IB', 'State', 'Cambridge'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>ADMIN EMAIL *</label>
                  <input required type="email" style={inputStyle} value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="you@yourschool.edu.in" />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>PHONE (optional)</label>
                  <input style={inputStyle} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>

                <button type="submit" style={{ width: '100%', height: 48, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(79,70,229,0.35)' }}>
                  Create My School Account →
                </button>

                <div style={{ marginTop: 16, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  By registering, you agree to our terms of service.
                </div>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Sign in →</a>
        </div>
      </div>
    </div>
  );
}
