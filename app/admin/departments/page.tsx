'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Dept { id: string; code: string; name: string; description: string | null; hod_staff_id: string | null; is_active: boolean; staff?: { name: string; email: string } | null; }
interface Staff { id: string; name: string; role: string; }

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: '', name: '', description: '', hod_staff_id: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [d, s] = await Promise.all([
      fetch('/api/admin/departments').then(r => r.json()),
      fetch('/api/admin/staff').then(r => r.json()),
    ]);
    setDepts(d.departments ?? []);
    setStaff(s.staff ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/admin/departments', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (res.ok) { setMsg('Saved'); setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
    setSaving(false);
  }

  async function toggleActive(dept: Dept) {
    await fetch('/api/admin/departments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dept.id, is_active: !dept.is_active }) });
    void load();
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const };

  return (
    <Layout title="Departments" subtitle="Manage departments and assign HODs">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editId ? 'Edit Department' : 'Add Department'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <input placeholder="Code (e.g. CSE)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} />
            <input placeholder="Name (e.g. Computer Science & Engineering)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
            <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
            <select value={form.hod_staff_id} onChange={e => setForm(f => ({ ...f, hod_staff_id: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">Assign HOD (optional)</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={saving || !form.code || !form.name} style={{ padding: '8px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Department'}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' }); }} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
            {msg && <span style={{ fontSize: 13, color: msg === 'Saved' ? '#065F46' : '#991B1B' }}>{msg}</span>}
          </div>
        </div>

        {/* Table */}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div> : (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            {depts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No departments yet. Add your first department above.</div>
            ) : depts.map(d => (
              <div key={d.id} style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12, opacity: d.is_active ? 1 : 0.5 }}>
                <div style={{ width: 48, height: 36, background: '#EEF2FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#4F46E5', flexShrink: 0 }}>{d.code}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{d.name}</div>
                  {d.description && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{d.description}</div>}
                  {d.staff && <div style={{ fontSize: 11, color: '#4F46E5', marginTop: 2 }}>HOD: {d.staff.name}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(d.id); setForm({ code: d.code, name: d.name, description: d.description ?? '', hod_staff_id: d.hod_staff_id ?? '' }); }} style={{ padding: '5px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => toggleActive(d)} style={{ padding: '5px 12px', background: d.is_active ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: d.is_active ? '#991B1B' : '#065F46' }}>{d.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
