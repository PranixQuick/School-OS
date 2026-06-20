'use client';
// app/super-admin/vidya-grid-plans/page.tsx
// VG-2 — super-admin sets each school's Vidya Grid plan (none/free/paid),
// paid-until, and seat cap. Saves via the read-modify-write PATCH (never clears
// other feature_flags). Access is enforced server-side (super-admin only).

import { useState, useEffect } from 'react';

interface Row {
  school_id: string;
  name: string;
  vidya_grid_plan: 'none' | 'free' | 'paid';
  vidya_grid_paid_until: string | null;
  vidya_grid_seat_cap: number | null;
}

const PLANS: Row['vidya_grid_plan'][] = ['none', 'free', 'paid'];

export default function VidyaGridPlansPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/super-admin/vidya-grid/plan')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Super-admin only.' : 'Failed to load')))
      .then((d: { schools?: Row[] }) => setRows(d.schools ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function patch(id: string, p: Partial<Row>) {
    setRows(rs => rs.map(r => r.school_id === id ? { ...r, ...p } : r));
  }

  async function save(row: Row) {
    setSavingId(row.school_id);
    setMsg(m => ({ ...m, [row.school_id]: '' }));
    try {
      const r = await fetch('/api/super-admin/vidya-grid/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: row.school_id,
          vidya_grid_plan: row.vidya_grid_plan,
          vidya_grid_paid_until: row.vidya_grid_paid_until || null,
          vidya_grid_seat_cap: row.vidya_grid_seat_cap === null || Number.isNaN(row.vidya_grid_seat_cap) ? null : Number(row.vidya_grid_seat_cap),
        }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(m => ({ ...m, [row.school_id]: r.ok ? 'Saved ✓' : (d.error || 'Failed') }));
    } catch {
      setMsg(m => ({ ...m, [row.school_id]: 'Network error' }));
    } finally {
      setSavingId(null);
    }
  }

  const visible = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F3F4F6', fontSize: 13, verticalAlign: 'middle' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, color: '#374151', fontSize: 12 };
  const input: React.CSSProperties = { padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Vidya Grid — School Plans</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 16 }}>
          Set each school&apos;s Vidya Grid tier. <b>paid</b> needs a paid-until date (school pays via EdProSys renewal). Saving changes only the Vidya Grid keys — other settings are preserved.
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#B91C1C' }}>{error}</div>
        ) : (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schools…"
              style={{ ...input, width: '100%', maxWidth: 320, marginBottom: 14 }} />
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={th}>School</th>
                    <th style={th}>Plan</th>
                    <th style={th}>Paid until</th>
                    <th style={th}>Seat cap</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.school_id}>
                      <td style={{ ...cell, fontWeight: 600, color: '#111827' }}>{r.name}</td>
                      <td style={cell}>
                        <select value={r.vidya_grid_plan} onChange={e => patch(r.school_id, { vidya_grid_plan: e.target.value as Row['vidya_grid_plan'] })} style={input}>
                          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={cell}>
                        <input type="date" value={(r.vidya_grid_paid_until ?? '').slice(0, 10)}
                          onChange={e => patch(r.school_id, { vidya_grid_paid_until: e.target.value ? new Date(e.target.value + 'T00:00:00Z').toISOString() : null })}
                          disabled={r.vidya_grid_plan !== 'paid'} style={{ ...input, opacity: r.vidya_grid_plan === 'paid' ? 1 : 0.5 }} />
                      </td>
                      <td style={cell}>
                        <input type="number" min={0} value={r.vidya_grid_seat_cap ?? ''} placeholder="∞"
                          onChange={e => patch(r.school_id, { vidya_grid_seat_cap: e.target.value === '' ? null : Number(e.target.value) })}
                          style={{ ...input, width: 80 }} />
                      </td>
                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => void save(r)} disabled={savingId === r.school_id}
                            style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: savingId === r.school_id ? 'wait' : 'pointer' }}>
                            {savingId === r.school_id ? 'Saving…' : 'Save'}
                          </button>
                          {msg[r.school_id] && <span style={{ fontSize: 12, color: msg[r.school_id] === 'Saved ✓' ? '#15803D' : '#B91C1C' }}>{msg[r.school_id]}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td style={{ ...cell, textAlign: 'center', color: '#9CA3AF' }} colSpan={5}>No schools.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
