'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Department { id: string; code: string; name: string; description: string | null; hod_staff_id: string | null; is_active: boolean; staff?: { name: string; email: string } | null; }
interface StaffRow { id: string; name: string; role: string; email: string | null; }

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', hod_staff_id: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [dR, sR] = await Promise.all([fetch('/api/admin/departments'), fetch('/api/admin/staff')]);
    const [dD, sD] = await Promise.all([dR.json(), sR.json()]);
    setDepts(dD.departments ?? []);
    setStaffList(sD.staff ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.code || !form.name) { setFormError('Code and name required'); return; }
    setSubmitting(true); setFormError('');
    const r = await fetch('/api/admin/departments', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editId ? { id: editId, ...form } : form),
    });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    setToast(editId ? 'Department updated' : 'Department created'); setTimeout(() => setToast(''), 3000);
    setShowForm(false); setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' });
    load();
  }

  function editDept(d: Department) {
    setEditId(d.id);
    setForm({ code: d.code, name: d.name, description: d.description ?? '', hod_staff_id: d.hod_staff_id ?? '' });
    setShowForm(true);
  }

  async function toggleActive(d: Department) {
    await fetch('/api/admin/departments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, is_active: !d.is_active }) });
    setToast(d.is_active ? 'Department deactivated' : 'Department activated'); setTimeout(() => setToast(''), 3000);
    load();
  }

  return (
    <Layout title="Departments" subtitle="Academic departments with HOD assignment">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ code: '', name: '', description: '', hod_staff_id: '' }); }}
          style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm && !editId ? 'Cancel' : '+ Add Department'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editId ? 'Edit Department' : 'New Department'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[['Code *', 'code'], ['Name *', 'name'], ['Description', 'description']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>HOD (Head of Department)</label>
              <select value={form.hod_staff_id} onChange={e => setForm(f => ({ ...f, hod_staff_id: e.target.value }))}
                style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                <option value="">— None —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select></div>
          </div>
          {formError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={submit} disabled={submitting} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {submitting ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {depts.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No departments yet. Add your first department above.</div>}
          {depts.map(d => (
            <div key={d.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, opacity: d.is_active ? 1 : 0.6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#E0E7FF', color: '#3730A3', padding: '2px 8px', borderRadius: 5 }}>{d.code}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{d.name}</span>
                </div>
                {d.description && <div style={{ fontSize: 12, color: '#6B7280' }}>{d.description}</div>}
                {d.staff?.name && <div style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600 }}>HOD: {d.staff.name}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => editDept(d)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => toggleActive(d)} style={{ padding: '5px 10px', background: d.is_active ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${d.is_active ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: d.is_active ? '#991B1B' : '#065F46' }}>
                  {d.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
