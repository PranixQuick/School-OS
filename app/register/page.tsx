'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    school_name: '', admin_email: '', admin_name: '',
    contact_phone: '', board: 'CBSE',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ school: string; password: string } | null>(null);

  function set(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');

    try {
      const res = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string; school?: { name: string }; login?: { password: string } };

      if (!res.ok) { setError(data.error ?? 'Registration failed'); return; }

      setSuccess({ school: data.school?.name ?? form.school_name, password: data.login?.password ?? 'admin@123' });
    } catch { setError('Network error. Please try again.');
    } finally { setLoading(false); }
  }

  const inputStyle = {
    width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
    background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none',
    fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 } as const;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>S</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Create your school</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Set up School OS for your institution in 30 seconds</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{success.school} is ready!</div>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>Your school has been created and configured with demo data.</div>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#374151', marginBottom: 20, textAlign: 'left' }}>
                <strong>Login credentials:</strong><br />
                Email: {form.admin_email}<br />
                Password: {success.password}
              </div>
              <button onClick={() => router.push('/login')} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Go to Login →
              </button>
            </div>
          ) : (
            <>
              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 18 }}>{error}</div>}

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>SCHOOL NAME *</label>
                  <input required style={inputStyle} value={form.school_name} onChange={e => set('school_name', e.target.value)} placeholder="e.g. Sunrise Academy" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>ADMIN NAME *</label>
                    <input required style={inputStyle} value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label style={labelStyle}>BOARD</label>
                    <select style={inputStyle} value={form.board} onChange={e => set('board', e.target.value)}>
                      {['CBSE','ICSE','IB','State','Cambridge'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>ADMIN EMAIL *</label>
                  <input required type="email" style={inputStyle} value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@yourschool.edu.in" />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>PHONE (optional)</label>
                  <input style={inputStyle} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: loading ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Creating school...' : 'Create School →'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#6B7280' }}>
          Already registered? <a href="/login" style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}>Sign in →</a>
        </div>
      </div>
    </div>
  );
}
