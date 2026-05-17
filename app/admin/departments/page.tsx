'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Dept { id: string; code: string; name: string; description: string | null; hod_staff_id: string | null; is_active: boolean; staff?: { name: string } | null; }
interface Staff { id: string; name: string; role: string; }

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
    setStaffList(s.staff ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMsg('');
    const method = editId ? 'PATCH' : 'POST';
    const body = editId ? { id: editId, ...form } : form;
    const res = await fetch('/api/admin/departments', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setMsg(editId ? 'Updated' : 'Department created'); setShowForm(false); setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' }); void load(); }
    else setMsg(d.error ?? 'Error');
  }

  async function toggleActive(dept: Dept) {
    await fetch('/api/admin/departments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dept.id, is_active: !dept.is_active }) });
    void load();
  }

  function startEdit(d: Dept) { setEditId(d.id); setForm({ code: d.code, name: d.name, description: d.description ?? '', hod_staff_id: d.hod_staff_id ?? '' }); setShowForm(true); }

  const S = { card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 } as React.CSSProperties };

  return (
    <Layout title="Departments" subtitle="Manage academic departments and HOD assignments">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {msg && <div style={{ background: msg.includes('rror') ? '#FEE2E2' : '#D1FAE5', color: msg.includes('rror') ? '#991B1B' : '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{depts.length} department{depts.length !== 1 ? 's' : ''}</div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' }); }}
            style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Add Department
          </button>
        </div>

        {showForm && (
          <div style={{ ...S.card, border: '2px solid #4F46E5', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{editId ? 'Edit Department' : 'New Department'}</div>
            {(['code', 'name', 'description'] as const).map(k => (
              <div key={k} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{k.toUpperCase()}</label>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  placeholder={k === 'code' ? 'e.g. CSE' : k === 'name' ? 'e.g. Computer Science & Engineering' : 'Optional description'}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>HOD (HEAD OF DEPARTMENT)</label>
              <select value={form.hod_staff_id} onChange={e => setForm(f => ({ ...f, hod_staff_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 14 }}>
                <option value="">— Not assigned —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving || !form.code || !form.name}
                style={{ flex: 1, padding: '9px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: '9px 16px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div> :
          depts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏛</div>
              <div>No departments yet. Add your first department to get started.</div>
            </div>
          ) : depts.map(d => (
            <div key={d.id} style={{ ...S.card, opacity: d.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{d.code}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{d.name}</span>
                  </div>
                  {d.description && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{d.description}</div>}
                  <div style={{ fontSize: 12, color: d.staff?.name ? '#374151' : '#9CA3AF' }}>
                    HOD: {d.staff?.name ?? 'Not assigned'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(d)} style={{ padding: '5px 10px', background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => void toggleActive(d)} style={{ padding: '5px 10px', background: d.is_active ? '#FEE2E2' : '#D1FAE5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: d.is_active ? '#991B1B' : '#065F46', fontWeight: 600 }}>
                    {d.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
