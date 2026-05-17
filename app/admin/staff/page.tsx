'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface StaffMember {
  id: string; name: string; role: string; email: string | null; phone: string | null;
  is_active: boolean; department_id: string | null; designation: string | null;
  joined_at: string | null; created_at: string;
}
interface Dept { id: string; code: string; name: string; }

const ROLES = ['teacher','admin','principal','counsellor','librarian','hostel_admin','placement_officer','transport_staff','hod','exam_staff','accountant','reception'];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'teacher', email: '', phone: '', department_id: '', designation: '', joined_at: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, dr] = await Promise.all([fetch('/api/admin/staff'), fetch('/api/admin/departments')]);
    const [sd, dd] = await Promise.all([sr.json(), dr.json()]);
    setStaff(sd.staff ?? []);
    setDepts(dd.departments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showMsg(m: string) { setToast(m); setTimeout(() => setToast(''), 3000); }

  async function submit() {
    if (!form.name) { setFormError('Name required'); return; }
    setSubmitting(true); setFormError('');
    const r = await fetch('/api/admin/staff', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editId ? { id: editId, ...form } : form),
    });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    showMsg(editId ? 'Staff updated' : 'Staff added');
    setShowForm(false); setEditId(null); setForm({ name: '', role: 'teacher', email: '', phone: '', department_id: '', designation: '', joined_at: '' });
    load();
  }

  function openEdit(s: StaffMember) {
    setEditId(s.id);
    setForm({ name: s.name, role: s.role, email: s.email ?? '', phone: s.phone ?? '', department_id: s.department_id ?? '', designation: s.designation ?? '', joined_at: s.joined_at ?? '' });
    setShowForm(true);
  }

  async function toggleActive(s: StaffMember) {
    const r = await fetch('/api/admin/staff', { method: s.is_active ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s.is_active ? { id: s.id } : { id: s.id, is_active: true }) });
    if (r.ok) { showMsg(s.is_active ? 'Staff deactivated' : 'Staff reactivated'); load(); }
  }

  const visible = staff.filter(s => {
    if (!showInactive && !s.is_active) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inp = { width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' as const, fontFamily: 'inherit' };

  const ROLE_COLOR: Record<string, string> = { teacher: '#DBEAFE', principal: '#E0E7FF', admin: '#FEF9C3', librarian: '#D1FAE5', hod: '#FCE7F3', counsellor: '#F3F4F6', hostel_admin: '#FED7AA', placement_officer: '#CFFAFE', transport_staff: '#E5E7EB' };

  return (
    <Layout title="Staff" subtitle={`${staff.filter(s => s.is_active).length} active staff members`}
      actions={<button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ name: '', role: 'teacher', email: '', phone: '', department_id: '', designation: '', joined_at: '' }); }} className="btn btn-primary btn-sm">+ Add Staff</button>}>

      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#15803D', color: '#fff' }}>{toast}</div>}

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editId ? 'Edit Staff' : 'Add Staff Member'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Role</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ ...inp, height: 36 }}>{ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}</select></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Department</label><select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ ...inp, height: 36 }}><option value="">— None —</option>{depts.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}</select></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Designation</label><input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} style={inp} placeholder="e.g. Senior Lecturer" /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Joining Date</label><input type="date" value={form.joined_at} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))} style={inp} /></div>
          </div>
          {formError && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={submit} disabled={submitting} style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{submitting ? 'Saving...' : editId ? 'Update' : 'Add'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name..." style={{ height: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 12px', fontSize: 14, width: 200 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: '#6B7280' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading...</div> : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Dept</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map(s => (
                <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                  <td><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>{s.designation && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.designation}</div>}</td>
                  <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: ROLE_COLOR[s.role] ?? '#F3F4F6', color: '#374151' }}>{s.role.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: 12, color: '#6B7280' }}>{depts.find(d => d.id === s.department_id)?.code ?? '—'}</td>
                  <td><div style={{ fontSize: 12, color: '#374151' }}>{s.email ?? '—'}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.phone ?? ''}</div></td>
                  <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: s.is_active ? '#D1FAE5' : '#F3F4F6', color: s.is_active ? '#065F46' : '#9CA3AF' }}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(s)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => toggleActive(s)} style={{ padding: '5px 10px', background: s.is_active ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${s.is_active ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: s.is_active ? '#991B1B' : '#065F46' }}>
                        {s.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No staff found.</div>}
        </div>
      )}
    </Layout>
  );
}
