'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Batch { id: string; label: string; entry_year: number; capacity: number | null; group_code: string | null; student_count: number; department?: { name: string; code: string } | null; }
interface Dept { id: string; code: string; name: string; }

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: '', department_id: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    const [b, d] = await Promise.all([
      fetch(`/api/admin/batches${showArchived ? '?include_archived=1' : ''}`).then(r => r.json()),
      fetch('/api/admin/departments').then(r => r.json()),
    ]);
    setBatches(b.batches ?? []);
    setDepts(d.departments ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [showArchived]);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = editId
      ? { id: editId, label: form.label, entry_year: Number(form.entry_year), capacity: form.capacity ? Number(form.capacity) : null, group_code: form.group_code || null, department_id: form.department_id || null }
      : { label: form.label, entry_year: Number(form.entry_year), capacity: form.capacity ? Number(form.capacity) : null, group_code: form.group_code || null, department_id: form.department_id || null };
    const res = await fetch('/api/admin/batches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (res.ok) { setMsg('Saved'); setEditId(null); setForm({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: '', department_id: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function archive(id: string) {
    await fetch('/api/admin/batches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'archive' }) });
    void load();
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Batches" subtitle="Manage student batches for colleges and coaching centres">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editId ? 'Edit Batch' : 'Add Batch'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input placeholder="Label (e.g. 2024-28 CSE)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputStyle} />
            <input type="number" placeholder="Entry year" value={form.entry_year} onChange={e => setForm(f => ({ ...f, entry_year: e.target.value }))} style={inputStyle} />
            <input type="number" placeholder="Capacity (optional)" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input placeholder="Group code (e.g. MPC, BiPC)" value={form.group_code} onChange={e => setForm(f => ({ ...f, group_code: e.target.value }))} style={inputStyle} />
            <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">Department (optional)</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !form.label} style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Batch'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm({ label: '', entry_year: new Date().getFullYear().toString(), capacity: '', group_code: '', department_id: '' }); }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
            {msg && <span style={{ fontSize: 13, color: msg === 'Saved' ? '#065F46' : '#991B1B' }}>{msg}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</div>
          <label style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
          </label>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {batches.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No batches yet.</div>
            ) : batches.map(b => {
              const archived = b.label.startsWith('[archived]');
              return (
                <div key={b.id} style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: archived ? 0.5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {b.entry_year} · {b.student_count} students{b.capacity ? ` / ${b.capacity} capacity` : ''}{b.group_code ? ` · ${b.group_code}` : ''}{b.department ? ` · ${b.department.code}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!archived && <button onClick={() => { setEditId(b.id); setForm({ label: b.label, entry_year: String(b.entry_year), capacity: b.capacity ? String(b.capacity) : '', group_code: b.group_code ?? '', department_id: '' }); }} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>}
                    {!archived && <button onClick={() => archive(b.id)} style={{ padding: '5px 12px', background: '#FEF3C7', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#92400E' }}>Archive</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
