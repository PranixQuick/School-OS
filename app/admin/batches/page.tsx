'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Batch { id: string; label: string; entry_year: number; capacity: number | null; group_code: string | null; student_count: number; department?: { name: string; code: string } | null; }
interface Dept { id: string; code: string; name: string; }

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', entry_year: new Date().getFullYear(), capacity: '', group_code: '', department_id: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [b, d] = await Promise.all([
      fetch('/api/admin/batches?include_archived=0').then(r => r.json()),
      fetch('/api/admin/departments').then(r => r.json()),
    ]);
    setBatches(b.batches ?? []);
    setDepts(d.departments ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = { ...(editId ? { id: editId } : {}), ...form, entry_year: Number(form.entry_year), capacity: form.capacity ? Number(form.capacity) : null, group_code: form.group_code || null, department_id: form.department_id || null };
    const res = await fetch('/api/admin/batches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Saved'); setShowForm(false); setEditId(null); setForm({ label: '', entry_year: new Date().getFullYear(), capacity: '', group_code: '', department_id: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function archive(id: string) {
    if (!confirm('Archive this batch? It will be hidden from default views.')) return;
    await fetch('/api/admin/batches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'archive' }) });
    void load();
  }

  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 } as React.CSSProperties };

  return (
    <Layout title="Batches" subtitle="Manage student batches for each intake year">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ label: '', entry_year: new Date().getFullYear(), capacity: '', group_code: '', department_id: '' }); }}
            style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Batch
          </button>
        </div>

        {showForm && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{editId ? 'Edit Batch' : 'New Batch'}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>BATCH LABEL *</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. 2024-28 CSE" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>ENTRY YEAR</label>
                <input type="number" value={form.entry_year} onChange={e => setForm(f => ({ ...f, entry_year: Number(e.target.value) }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>CAPACITY</label>
                <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 60" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>DEPARTMENT</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }}>
                <option value="">— None —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>GROUP CODE (optional)</label>
              <input value={form.group_code} onChange={e => setForm(f => ({ ...f, group_code: e.target.value }))} placeholder="e.g. MPC" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || !form.label} style={{ flex: 1, padding: '9px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: '9px 16px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          batches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎒</div>
              <div>No batches yet. Create your first batch to start assigning students.</div>
            </div>
          ) : batches.map(b => (
            <div key={b.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    Entry {b.entry_year}{b.department ? ` · ${b.department.code}` : ''}{b.capacity ? ` · Cap: ${b.capacity}` : ''}{b.group_code ? ` · ${b.group_code}` : ''}
                  </div>
                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    {b.student_count} student{b.student_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(b.id); setForm({ label: b.label, entry_year: b.entry_year, capacity: String(b.capacity ?? ''), group_code: b.group_code ?? '', department_id: '' }); setShowForm(true); }}
                    style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => void archive(b.id)} style={{ padding: '5px 10px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Archive</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
