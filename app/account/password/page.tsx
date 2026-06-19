'use client';
// app/account/password/page.tsx
// ISS-1 (#1 / P4.6) — Self-service change password for signed-in staff.
// Posts to /api/auth/change-password. Read-only until the user submits.

import { useState } from 'react';
import Layout from '@/components/Layout';

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function clientValidate(): string | null {
    if (!current || !next || !confirm) return 'All fields are required.';
    if (next.length < 8) return 'New password must be at least 8 characters.';
    if (next !== confirm) return 'New password and confirmation do not match.';
    if (next === current) return 'New password must be different from the current password.';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const v = clientValidate();
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not update password.');
      setDone(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, borderRadius: 9, border: '1px solid #D1D5DB',
    background: '#F9FAFB', fontSize: 14, padding: '0 14px', outline: 'none',
    fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };

  return (
    <Layout title="Change Password" subtitle="Update your sign-in password">
      <div style={{ maxWidth: 440 }}>
        {done ? (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: 20, color: '#065F46' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>✅ Password updated</div>
            <div style={{ fontSize: 13 }}>Your password has been changed. Use it the next time you sign in.</div>
            <button
              onClick={() => setDone(false)}
              style={{ marginTop: 14, background: '#fff', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Change again
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Current password</label>
              <input type={show ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>New password</label>
              <input type={show ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>At least 8 characters.</div>
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" style={inputStyle} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>

            {error && <div style={{ fontSize: 13, color: '#B91C1C' }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              style={{ background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
