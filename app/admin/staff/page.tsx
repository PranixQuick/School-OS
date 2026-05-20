'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T, type Lang } from '@/lib/i18n';

interface StaffMember {
  id: string; name: string; role: string; email?: string; phone?: string;
  subject?: string; is_active: boolean; joined_at?: string; designation?: string;
}

const ROLE_LABEL: Record<string, string> = {
  teacher: 'Teacher', principal: 'Principal', admin_staff: 'Admin Staff',
  accountant: 'Accountant', librarian: 'Librarian', owner: 'Owner', admin: 'Admin',
};
const ROLE_COLOR: Record<string, string> = {
  teacher: '#4F46E5', principal: '#065F46', admin_staff: '#9333EA',
  accountant: '#B45309', librarian: '#0369A1', owner: '#B91C1C', admin: '#374151',
};

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher', subject: '', phone: '', designation: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) { const d = await res.json(); setStaff(d.staff ?? []); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function addStaff() {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ name: '', email: '', role: 'teacher', subject: '', phone: '', designation: '' });
      setShowAdd(false);
      await loadStaff();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this staff member?')) return;
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    });
    await loadStaff();
  }

  const roles = ['all', ...Array.from(new Set(staff.map(s => s.role)))];
  const visible = staff.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !(s.email ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Layout title="Staff Management" subtitle={`${staff.length} staff members`}
      actions={<button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">+ Add Staff</button>}>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…" className="input"
          style={{ flex: 1, minWidth: 160, height: 36, fontSize: 13 }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ height: 36, borderRadius: 8, border: '1px solid #D1D5DB', padding: '0 10px',
            fontSize: 13, background: '#fff', color: '#374151' }}>
          {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : (ROLE_LABEL[r] ?? r)}</option>)}
        </select>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Add New Staff</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { key: 'name', label: 'Full Name', placeholder: 'Ravi Kumar' },
              { key: 'email', label: 'Email', placeholder: 'ravi@school.edu.in' },
              { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
              { key: 'designation', label: 'Designation', placeholder: 'Class Teacher' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} className="input" style={{ width: '100%', height: 34, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, padding: '0 8px', boxSizing: 'border-box' }}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form.role === 'teacher' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Subject</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Mathematics" className="input" style={{ width: '100%', height: 34, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button onClick={addStaff} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Adding…' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading staff…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No staff found</div>
          <div className="empty-state-sub">Add your first staff member to get started.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {visible.map((s, i) => (
            <div key={s.id} style={{
              padding: '12px 16px', borderBottom: i < visible.length-1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: (ROLE_COLOR[s.role] ?? '#6B7280') + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: ROLE_COLOR[s.role] ?? '#6B7280'
              }}>
                {s.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {s.email}{s.subject ? ` · ${s.subject}` : ''}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                  background: (ROLE_COLOR[s.role] ?? '#6B7280') + '18',
                  color: ROLE_COLOR[s.role] ?? '#6B7280', fontSize: 11, fontWeight: 700
                }}>
                  {ROLE_LABEL[s.role] ?? s.role}
                </span>
                <button onClick={() => deactivate(s.id)}
                  style={{ display: 'block', marginTop: 4, background: 'none', border: 'none',
                    color: '#EF4444', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
