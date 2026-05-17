'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const INSTITUTION_TYPES = [
  { value: 'school_k10',       label: 'School (Class 1–10)' },
  { value: 'school_k12',       label: 'School (Class 1–12)' },
  { value: 'govt_school',      label: 'Government School' },
  { value: 'govt_aided_school',label: 'Government-Aided School' },
  { value: 'welfare_school',   label: 'Welfare / Residential School' },
  { value: 'anganwadi',        label: 'Anganwadi / Balwadi' },
  { value: 'junior_college',   label: 'Junior College (11–12 / PUC)' },
  { value: 'degree_college',   label: 'Degree College (BA / BSc / BCom)' },
  { value: 'engineering',      label: 'Engineering College' },
  { value: 'polytechnic',      label: 'Polytechnic / ITI' },
  { value: 'mba',              label: 'MBA / Business School' },
  { value: 'medical',          label: 'Medical / Pharmacy / Nursing College' },
  { value: 'university',       label: 'University' },
  { value: 'coaching',         label: 'Coaching / Training Institute' },
];

const OWNERSHIP_TYPES = [
  { value: 'private',    label: 'Private (Self-funded)' },
  { value: 'government', label: 'Government' },
  { value: 'aided',      label: 'Government-Aided' },
  { value: 'franchise',  label: 'Franchise' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'creating' | 'done'>('form');
  const [form, setForm] = useState({
    school_name: '',
    admin_email: '',
    admin_name: '',
    contact_phone: '',
    board: 'CBSE',
    institution_type: 'school_k10',
    ownership_type: 'private',
  });
  const [error, setError] = useState('');
  const [doneData, setDoneData] = useState<{
    schoolName: string;
    loginEmail: string;
    loginPassword: string;
  } | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setStep('creating');
    setError('');

    try {
      // Step 1: Create school + institution
      const createRes = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const createData = await createRes.json() as {
        error?: string;
        school?: { id: string; name: string };
        login?: { email: string; password: string };
        next_step?: string;
      };

      if (!createRes.ok) {
        setError(createData.error ?? 'Registration failed. Please try again.');
        setStep('form');
        return;
      }

      const schoolName = createData.school?.name ?? form.school_name;
      const loginEmail = createData.login?.email ?? form.admin_email;
      const loginPassword = createData.login?.password ?? '';

      // Step 2: Auto-login with the generated password
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      setDoneData({ schoolName, loginEmail, loginPassword });
      setStep('done');

      if (loginRes.ok) {
        // Redirect to /onboarding to complete the setup wizard.
        // We delay briefly so the owner can read their credentials.
        setTimeout(() => {
          setRedirecting(true);
          router.push('/onboarding');
        }, 4000);
      }
      // If auto-login failed (edge case), owner can use the credentials shown to log in manually.
    } catch {
      setError('Network error. Please try again.');
      setStep('form');
    }
  }

  const inputStyle = {
    width: '100%', height: 42, borderRadius: 9,
    border: '1px solid #D1D5DB', background: '#F9FAFB',
    fontSize: 14, padding: '0 14px', outline: 'none',
    fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#374151', marginBottom: 6,
  } as const;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff',
            }}>E</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>EdProSys</span>
          </Link>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
            Register your institution — free to start
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 18,
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>

          {/* Creating state */}
          {step === 'creating' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{
                width: 48, height: 48,
                border: '4px solid #E5E7EB',
                borderTop: '4px solid #4F46E5',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }} />
              <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 6 }}>
                Setting up your account...
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                Creating institution profile and configuring your dashboard
              </div>
            </div>
          )}

          {/* Done state — show credentials clearly before redirect */}
          {step === 'done' && doneData && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: '#DCFCE7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 28,
              }}>✓</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
                {doneData.schoolName} is ready!
              </div>

              {/* Credentials box — prominently displayed */}
              <div style={{
                background: '#F0FDF4', border: '2px solid #86EFAC',
                borderRadius: 12, padding: '16px 20px',
                textAlign: 'left', marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📋 Save your login credentials
                </div>
                <div style={{ fontSize: 14, color: '#111827', lineHeight: 2 }}>
                  <strong>Email:</strong> {doneData.loginEmail}<br />
                  <strong>Password:</strong>{' '}
                  <span style={{
                    fontFamily: 'monospace', background: '#E0F2FE',
                    padding: '2px 8px', borderRadius: 4, fontSize: 15,
                    letterSpacing: '0.05em',
                  }}>
                    {doneData.loginPassword}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 10, lineHeight: 1.5 }}>
                  Write this down now. After first login, use &ldquo;Sign in with email link&rdquo;
                  to set up passwordless access.
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
                {redirecting
                  ? 'Taking you to the setup wizard...'
                  : 'Logging you in — redirecting to setup wizard in a moment...'}
              </div>

              <button
                onClick={() => router.push('/onboarding')}
                style={{
                  width: '100%', height: 44, borderRadius: 10, border: 'none',
                  background: '#4F46E5', color: '#fff',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Go to setup wizard now →
              </button>
            </div>
          )}

          {/* Form state */}
          {step === 'form' && (
            <>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#111827', marginBottom: 4 }}>
                Create your institution account
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
                Free to start · No credit card needed
              </div>

              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#991B1B', marginBottom: 18,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>INSTITUTION NAME *</label>
                  <input
                    required
                    style={inputStyle}
                    value={form.school_name}
                    onChange={e => set('school_name', e.target.value)}
                    placeholder="e.g. Sunrise Academy / Govt. High School, Hyderabad"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>YOUR NAME *</label>
                    <input
                      required
                      style={inputStyle}
                      value={form.admin_name}
                      onChange={e => set('admin_name', e.target.value)}
                      placeholder="Principal / Admin"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>OWNERSHIP *</label>
                    <select
                      style={inputStyle}
                      value={form.ownership_type}
                      onChange={e => set('ownership_type', e.target.value)}
                    >
                      {OWNERSHIP_TYPES.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>INSTITUTION TYPE *</label>
                  <select
                    style={inputStyle}
                    value={form.institution_type}
                    onChange={e => set('institution_type', e.target.value)}
                  >
                    {INSTITUTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>ADMIN EMAIL *</label>
                  <input
                    required
                    type="email"
                    style={inputStyle}
                    value={form.admin_email}
                    onChange={e => set('admin_email', e.target.value)}
                    placeholder="you@yourschool.edu.in"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                  <div>
                    <label style={labelStyle}>PHONE (optional)</label>
                    <input
                      style={inputStyle}
                      value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>BOARD / AFFILIATION</label>
                    <select
                      style={inputStyle}
                      value={form.board}
                      onChange={e => set('board', e.target.value)}
                    >
                      {['CBSE', 'ICSE', 'IB', 'State Board', 'Cambridge', 'IGCSE', 'UGC', 'AICTE', 'Other'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%', height: 48, borderRadius: 11, border: 'none',
                    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
                  }}
                >
                  Create Account →
                </button>

                <div style={{ marginTop: 14, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  By registering, you agree to our terms of service.
                </div>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            Sign in →
          </a>
        </div>
      </div>
    </div>
  );
}
