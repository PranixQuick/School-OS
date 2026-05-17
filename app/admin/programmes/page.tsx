'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Programme { id: string; code: string; name: string; duration_years: number; has_semesters: boolean; credit_system: boolean; is_active: boolean; description: string | null; department?: { name: string; code: string } | null; }
interface Dept { id: string; code: string; name: string; }

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', duration_years: '4', has_semesters: true, credit_system: false, department_id: '', description: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [p, d] = await Promise.all([
      fetch('/api/admin/programmes').then(r => r.json()),
      fetch('/api/admin/departments').then(r => r.json()),
    ]);
    setProgrammes(p.programmes ?? []);
    setDepts(d.departments ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = { ...(editId ? { id: editId } : {}), ...form, duration_years: Number(form.duration_years), department_id: form.department_id || null, description: form.description || null };
    const res = await fetch('/api/admin/programmes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg('Saved'); setShowForm(false); setEditId(null); setForm({ code: '', name: '', duration_years: '4', has_semesters: true, credit_system: false, department_id: '', description: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function toggleActive(prog: Programme) {
    await fetch('/api/admin/programmes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: prog.id, is_active: !prog.is_active }) });
    void load();
  }

  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 } as React.CSSProperties };

  return (
    <Layout title="Programmes" subtitle="B.Tech, MBA, B.Pharm and other degree programmes">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{programmes.length} programme{programmes.length !== 1 ? 's' : ''}</div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ code: '', name: '', duration_years: '4', has_semesters: true, credit_system: false, department_id: '', description: '' }); }}
            style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Programme
          </button>
        </div>

        {showForm && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{editId ? 'Edit Programme' : 'New Programme'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>CODE *</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="BTECH" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>PROGRAMME NAME *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Bachelor of Technology" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>DURATION (YEARS)</label>
                <input type="number" value={form.duration_years} onChange={e => setForm(f => ({ ...f, duration_years: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>DEPARTMENT</label>
                <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }}>
                  <option value="">— None —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.has_semesters} onChange={e => setForm(f => ({ ...f, has_semesters: e.target.checked }))} />
                Semester-based
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.credit_system} onChange={e => setForm(f => ({ ...f, credit_system: e.target.checked }))} />
                Credit system
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || !form.code || !form.name}
                style={{ flex: 1, padding: '9px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: '9px 16px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          programmes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
              <div>No programmes yet. Add your degree/diploma programmes here.</div>
            </div>
          ) : programmes.map(p => (
            <div key={p.id} style={{ ...S.card, opacity: p.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.code}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {p.duration_years}y{p.has_semesters ? ' · Semester' : ''}{p.credit_system ? ' · Credits' : ''}{p.department ? ` · ${p.department.code}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(p.id); setForm({ code: p.code, name: p.name, duration_years: String(p.duration_years), has_semesters: p.has_semesters, credit_system: p.credit_system, department_id: '', description: p.description ?? '' }); setShowForm(true); }}
                    style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => void toggleActive(p)} style={{ padding: '5px 10px', background: p.is_active ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: p.is_active ? '#991B1B' : '#065F46', fontWeight: 600 }}>
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
