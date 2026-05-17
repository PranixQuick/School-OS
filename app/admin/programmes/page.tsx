'use client';
// app/admin/programmes/page.tsx
// Programme management for higher-ed: B.Tech CSE, MBA Finance, B.Pharm etc.
// Real workflow: registrar creates programmes once at institution setup
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Programme {
  id: string; code: string; name: string; duration_years: number | null;
  has_semesters: boolean; credit_system: boolean; is_active: boolean;
  description: string | null;
  department?: { name: string; code: string } | null;
}
interface Department { id: string; code: string; name: string; }

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', duration_years: '3', has_semesters: true, credit_system: false, department_id: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pR, dR] = await Promise.all([fetch('/api/admin/programmes'), fetch('/api/admin/departments')]);
    const [pD, dD] = await Promise.all([pR.json(), dR.json()]);
    setProgrammes(pD.programmes ?? []);
    setDepartments(dD.departments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.code || !form.name) { setFormError('Code and name required'); return; }
    setSubmitting(true); setFormError('');
    const payload = { ...form, duration_years: Number(form.duration_years) || 3, department_id: form.department_id || null };
    const r = await fetch('/api/admin/programmes', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
    });
    const d = await r.json(); setSubmitting(false);
    if (!r.ok) { setFormError(d.error ?? 'Failed'); return; }
    setToast(editId ? 'Programme updated' : 'Programme created'); setTimeout(() => setToast(''), 3000);
    setShowForm(false); setEditId(null);
    setForm({ code: '', name: '', duration_years: '3', has_semesters: true, credit_system: false, department_id: '', description: '' });
    load();
  }

  function startEdit(p: Programme) {
    setEditId(p.id);
    setForm({ code: p.code, name: p.name, duration_years: String(p.duration_years ?? 3), has_semesters: p.has_semesters, credit_system: p.credit_system, department_id: '', description: p.description ?? '' });
    setShowForm(true);
  }

  async function toggleActive(p: Programme) {
    await fetch('/api/admin/programmes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) });
    setToast(p.is_active ? 'Programme deactivated' : 'Programme activated'); setTimeout(() => setToast(''), 3000); load();
  }

  return (
    <Layout title="Programmes" subtitle="Academic programmes — B.Tech, MBA, B.Pharm etc.">
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ code: '', name: '', duration_years: '3', has_semesters: true, credit_system: false, department_id: '', description: '' }); }}
          style={{ padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm && !editId ? 'Cancel' : '+ Add Programme'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editId ? 'Edit Programme' : 'New Programme'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {[['Code * (e.g. BTECH-CSE)', 'code'], ['Name * (e.g. B.Tech Computer Science)', 'name'], ['Duration (years)', 'duration_years'], ['Description', 'description']].map(([label, key]) => (
              <div key={key}><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
                <input type={key === 'duration_years' ? 'number' : 'text'} min="1" max="7"
                  value={(form as Record<string, unknown>)[key] as string}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} /></div>
            ))}
            <div><label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={{ width: '100%', height: 36, border: '1px solid #D1D5DB', borderRadius: 7, padding: '0 8px', fontSize: 13 }}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.has_semesters} onChange={e => setForm(f => ({ ...f, has_semesters: e.target.checked }))} />
              Semester system
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.credit_system} onChange={e => setForm(f => ({ ...f, credit_system: e.target.checked }))} />
              Credit system
            </label>
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
          {programmes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No programmes yet. Add your first programme above.</div>}
          {programmes.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, opacity: p.is_active ? 1 : 0.6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 5 }}>{p.code}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {p.duration_years ? `${p.duration_years} years` : ''}{p.has_semesters ? ' · Semester' : ' · Annual'}{p.credit_system ? ' · Credit' : ''}
                  {p.department ? ` · ${p.department.code}` : ''}
                </div>
                {p.description && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(p)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => toggleActive(p)} style={{ padding: '5px 10px', background: p.is_active ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${p.is_active ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: p.is_active ? '#991B1B' : '#065F46' }}>
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
