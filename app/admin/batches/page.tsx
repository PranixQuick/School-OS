'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Batch { id: string; label: string; entry_year: number | null; current_level: string | null; capacity: number | null; group_code: string | null; student_count: number; department?: { name: string; code: string } | null; }

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', entry_year: String(new Date().getFullYear()), capacity: '', group_code: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/batches');
    const d = await r.json();
    setBatches(d.batches ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addBatch() {
    if (!form.label) { setFormError('Batch label required (e.g. "2024–28 CSE")'); return; }
    setSubmitting(true); setFormError('');
    const r = await fetch('/api/admin/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, entry_year: Number(form.entry_year) || null, capacity: form.capacity ? Number(form.capacity) : null }) });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    setToast('Batch created'); setTimeout(() => setToast(''), 3000);
    setShowAdd(false); setForm({ label: '', entry_year: String(new Date().getFullYear()), capacity: '', group_code: '' });
    load();
  }

  async function archiveBatch(id: string, label: string) {
    if (!confirm(`Archive batch "${label}"? Students will remain but batch will be hidden.`)) return;
    const r = await fetch('/api/admin/batches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'archive' }) });
    if (r.ok) { setToast('Batch archived'); setTimeout(() => setToast(''), 3000); load(); }
  }

  return (
    <Layout title="Batches" subtitle="Intake batches for colleges and coaching centres">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showAdd ? 'Cancel' : '+ New Batch'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Create Batch</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Label * (e.g. 2024–28 CSE)', 'label'], ['Entry Year', 'entry_year'], ['Capacity', 'capacity'], ['Group Code', 'group_code']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={['entry_year', 'capacity'].includes(key) ? 'number' : 'text'} value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
          </div>
          {formError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={addBatch} disabled={submitting} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {submitting ? 'Creating...' : 'Create Batch'}
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {batches.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No batches yet. Create your first batch above.</div>}
          {batches.map(b => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{b.label}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {b.entry_year ? `Entry: ${b.entry_year}` : ''}{b.capacity ? ` · Capacity: ${b.capacity}` : ''}{b.group_code ? ` · ${b.group_code}` : ''}
                </div>
                {b.department && <div style={{ fontSize: 11, color: '#4F46E5' }}>{b.department.code} – {b.department.name}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#4F46E5' }}>{b.student_count}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>students</div>
                </div>
                <button onClick={() => archiveBatch(b.id, b.label)} style={{ padding: '5px 10px', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#92400E' }}>Archive</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
