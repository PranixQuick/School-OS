'use client';
// app/teacher/leave/page.tsx
// Teacher leave request submission and history.
// Uses inline styles consistent with all other EdProSys pages.
// Tailwind classes removed — they were causing unstyled rendering in production.

import { useCallback, useEffect, useState } from 'react';
import Layout from '@/components/Layout';

interface LeaveRequest {
  id: string; leave_type: string; from_date: string;
  to_date: string; reason: string; status: string;
  approved_at: string | null; created_at: string;
}

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick',   label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other',  label: 'Other' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FFF7ED', color: '#D97706' },
  approved:  { bg: '#F0FDF4', color: '#15803D' },
  rejected:  { bg: '#FEF2F2', color: '#B91C1C' },
  cancelled: { bg: '#F9FAFB', color: '#6B7280' },
};

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'casual', from_date: '', to_date: '', reason: '',
  });

  const loadRequests = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/teacher/leave', { credentials: 'same-origin' });
      if (!res.ok) { const b = await res.json().catch(() => ({}) as { error?: string }); throw new Error(b.error ?? `HTTP ${res.status}`); }
      const data = await res.json() as { requests?: LeaveRequest[] };
      setRequests(data.requests ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  async function submitLeave() {
    if (!form.from_date || !form.to_date) { setSubmitError('Please choose both from and to dates.'); return; }
    if (!form.reason.trim() || form.reason.length < 3) { setSubmitError('Please enter a reason (min 3 characters).'); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch('/api/teacher/leave', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type: form.leave_type, from_date: form.from_date, to_date: form.to_date, reason: form.reason.trim() }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setSubmitError(d.error ?? 'Submission failed'); }
      else { setSubmitSuccess(true); setForm({ leave_type: 'casual', from_date: '', to_date: '', reason: '' }); setTimeout(() => setSubmitSuccess(false), 4000); void loadRequests(); }
    } catch (e) { setSubmitError(e instanceof Error ? e.message : 'Network error'); }
    setSubmitting(false);
  }

  const inp = { width: '100%', height: 44, borderRadius: 9, border: '1px solid #D1D5DB', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box' as const, color: '#111827' };

  return (
    <Layout title="Leave Requests" subtitle="Submit new requests and track status.">
      {/* Request form */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 14 }}>Request leave</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Leave type</label>
            <select value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))} style={inp}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={form.to_date} min={form.from_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Reason <span style={{ fontWeight: 400 }}>({form.reason.length}/500)</span>
          </label>
          <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Brief reason for leave" maxLength={500} rows={3}
            style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
        </div>
        {submitError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 10 }}>
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803D', marginBottom: 10 }}>
            ✅ Leave request submitted successfully.
          </div>
        )}
        <button onClick={() => void submitLeave()} disabled={submitting}
          style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', background: submitting ? '#9CA3AF' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </div>

      {/* Request history */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Your requests (last 90 days)
        </div>
        {loading && <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 13 }}>Loading…</div>}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#B91C1C' }}>
            {error}
          </div>
        )}
        {!loading && !error && requests.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12 }}>
            No leave requests in the last 90 days.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => {
            const ss = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 11, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>{r.leave_type} leave</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ss.bg, color: ss.color }}>
                    {r.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{r.from_date} → {r.to_date}</div>
                <div style={{ fontSize: 13, color: '#374151' }}>{r.reason}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
