'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Complaint {
  id: string;
  complaint_type: string;
  subject: string;
  description: string;
  status: string;
  resolution?: string | null;
  created_at: string;
}

const TYPES = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'fees', label: 'Fees / Billing' },
  { value: 'transport', label: 'Transport' },
  { value: 'safety', label: 'Safety' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'teacher_conduct', label: 'Teacher Conduct' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:         { bg: '#FEF3C7', color: '#92400E' },
  under_review: { bg: '#DBEAFE', color: '#1E40AF' },
  escalated:    { bg: '#FEE2E2', color: '#B91C1C' },
  resolved:     { bg: '#D1FAE5', color: '#065F46' },
  closed:       { bg: '#E5E7EB', color: '#374151' },
};

export default function ParentComplaintsPage() {
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('general');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function loadList() {
    try {
      const r = await fetch('/api/parent/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      if (r.ok) {
        const d = await r.json();
        setList(d.complaints ?? d.data ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadList(); }, []);

  async function submit() {
    if (!subject.trim() || !description.trim()) {
      setMsg({ kind: 'err', text: 'Please enter a subject and description.' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const r = await fetch('/api/parent/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', complaint_type: type, subject: subject.trim(), description: description.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) {
        setMsg({ kind: 'ok', text: 'Complaint submitted. The school has been notified.' });
        setSubject('');
        setDescription('');
        setType('general');
        loadList();
      } else {
        setMsg({ kind: 'err', text: d.error || 'Could not submit. Please try again.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 40 }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Complaints &amp; Concerns</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Raise a concern with the school</div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Raise a new complaint</div>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, marginBottom: 12, background: '#fff' }}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief subject"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, marginBottom: 12 }} />

          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your concern" rows={4}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, marginBottom: 12, resize: 'vertical', fontFamily: 'inherit' }} />

          {msg && (
            <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              background: msg.kind === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>
              {msg.text}
            </div>
          )}

          <button onClick={submit} disabled={submitting}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: submitting ? '#A5B4FC' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}>
            {submitting ? 'Submitting…' : 'Submit Complaint'}
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', marginBottom: 10 }}>Your complaints</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>No complaints filed yet.</div>
          </div>
        ) : list.map(c => {
          const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.open;
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.subject}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.color, textTransform: 'capitalize' }}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'capitalize' }}>{c.complaint_type.replace('_', ' ')}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.description}</div>
              {c.resolution && (
                <div style={{ fontSize: 13, color: '#065F46', marginTop: 8, padding: '8px 10px', background: '#F0FDF4', borderRadius: 8 }}>
                  <strong>School response:</strong> {c.resolution}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
