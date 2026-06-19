'use client';
// app/student/security/page.tsx
// ISS-1 (#1 / P4.6) — Student self-service PIN change.
// Rendered inside the student layout (header + bottom nav provided by layout).
// Posts to /api/student/change-pin.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentSecurityPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function validate(): string | null {
    if (!current || !next || !confirm) return 'All fields are required.';
    if (!/^\d{4,6}$/.test(next)) return 'New PIN must be 4 to 6 digits.';
    if (next !== confirm) return 'New PIN and confirmation do not match.';
    if (next === current) return 'New PIN must be different from the current PIN.';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/student/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_pin: current, new_pin: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && String(d.error ?? '').toLowerCase().includes('session')) {
        router.push('/student/login');
        return;
      }
      if (!r.ok) throw new Error(d.error || 'Could not update PIN.');
      setDone(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 46, borderRadius: 10, border: '1px solid #D1D5DB',
    background: '#F9FAFB', fontSize: 16, padding: '0 14px', outline: 'none',
    fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box', letterSpacing: 2,
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Change PIN</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Update your login PIN</div>

      {done ? (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: 20, color: '#065F46' }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>✅ PIN updated</div>
          <div style={{ fontSize: 14 }}>Use your new PIN the next time you sign in.</div>
        </div>
      ) : (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Current PIN</label>
            <input type={show ? 'text' : 'password'} inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>New PIN</label>
            <input type={show ? 'text' : 'password'} inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} />
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>4 to 6 digits.</div>
          </div>
          <div>
            <label style={labelStyle}>Confirm new PIN</label>
            <input type={show ? 'text' : 'password'} inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show PIN
          </label>

          {error && <div style={{ fontSize: 14, color: '#B91C1C' }}>{error}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{ background: busy ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 18px', fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Updating…' : 'Update PIN'}
          </button>
        </form>
      )}
    </div>
  );
}
