'use client';
// app/hod/directives/page.tsx
// HOD — Directives (workflow #9). Send a directive to staff (this institution or
// all branches); principal(s) + owner get visibility. Read/POST: /api/hod/directives

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Directive {
  id: string;
  scope: string;
  title: string;
  body: string;
  priority: string;
  department: string | null;
  created_at: string;
}

export default function HodDirectivesPage() {
  const [items, setItems] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [form, setForm] = useState({ title: '', body: '', scope: 'institution', priority: 'normal' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/hod/directives');
      if (!r.ok) throw new Error('Could not load directives. If you were just given HOD access, sign out and back in.');
      const d = await r.json();
      setItems(d.directives ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    if (!form.title.trim() || !form.body.trim()) { setFormMsg('Title and message are required.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/hod/directives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send the directive.');
      setForm({ title: '', body: '', scope: 'institution', priority: 'normal' });
      await load();
    } catch (err: any) {
      setFormMsg(err.message ?? 'Could not send the directive.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' as const };

  return (
    <Layout title="Directives" subtitle="Send instructions to staff">
      <form onSubmit={send} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Title</label>
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Submit internal marks by Friday" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Message</label>
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} placeholder="Write the directive…" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Send to</label>
            <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
              <option value="institution">This institution</option>
              <option value="all_branches">All branches</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Priority</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        {formMsg && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{formMsg}</div>}
        <button type="submit" disabled={saving} style={{ background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Sending…' : 'Send directive'}
        </button>
      </form>

      <h2 style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Sent</h2>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 20, background: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: 12, color: '#6B7280', fontSize: 13 }}>No directives sent yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(d => (
            <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.title}</span>
                {d.priority === 'high' && <span style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>HIGH</span>}
              </div>
              <div style={{ fontSize: 13, color: '#4B5563', whiteSpace: 'pre-wrap' }}>{d.body}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{d.scope === 'all_branches' ? 'All branches' : 'This institution'}</div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
