// components/teacher/LeaveForm.tsx
// Embedded leave submission form — used by /teacher/leave page.
// Uses inline styles consistent with EdProSys app-wide UI system.

'use client';
import { useState } from 'react';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual leave' },
  { value: 'sick',   label: 'Sick leave' },
  { value: 'earned', label: 'Earned leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
  { value: 'other',  label: 'Other' },
];

interface Props { onSubmitted?: () => void; }

export default function LeaveForm({ onSubmitted }: Props) {
  const [form, setForm] = useState({ leave_type: 'casual', from_date: '', to_date: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!form.from_date || !form.to_date) { setError('Please choose both from and to dates.'); return; }
    if (!form.reason.trim() || form.reason.length < 3) { setError('Please enter a reason (min 3 characters).'); return; }
    setLoading(true); setError(null);
    const res = await fetch('/api/teacher/leave', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave_type: form.leave_type, from_date: form.from_date, to_date: form.to_date, reason: form.reason.trim() }),
    });
    const d = await res.json() as { error?: string };
    if (!res.ok) { setError(d.error ?? 'Submission failed'); }
    else { setSuccess(true); setForm({ leave_type: 'casual', from_date: '', to_date: '', reason: '' }); setTimeout(() => setSuccess(false), 3000); onSubmitted?.(); }
    setLoading(false);
  }

  const inp = { width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' as const };

  return (
    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Request leave</div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Leave type</label>
        <select value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))} style={inp}>
          {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>From</label>
          <input type="date" value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>To</label>
          <input type="date" value={form.to_date} min={form.from_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} style={inp} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Reason ({form.reason.length}/500)</label>
        <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
          placeholder="Brief reason for leave" maxLength={500} rows={2}
          style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      </div>
      {error   && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#B91C1C', marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#15803D', marginBottom: 8 }}>✅ Leave request submitted.</div>}
      <button onClick={() => void handleSubmit()} disabled={loading}
        style={{ width: '100%', height: 44, borderRadius: 9, border: 'none', background: loading ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
        {loading ? 'Submitting…' : 'Submit request'}
      </button>
    </div>
  );
}
