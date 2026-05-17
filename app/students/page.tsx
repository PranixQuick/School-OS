'use client';
import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface Student {
  id: string; name: string; class: string | null; section: string | null;
  roll_number: string | null; admission_number: string | null;
  phone_parent: string | null; parent_name: string | null;
  date_of_birth: string | null; is_active: boolean; status: string; created_at: string;
}

const emptyForm = {
  name: '', class: '', section: 'A',
  roll_number: '', admission_number: '',
  phone_parent: '', parent_name: '', date_of_birth: '',
};

const STATUS_COLORS: Record<string, [string, string]> = {
  active:      ['#D1FAE5', '#065F46'],
  transferred: ['#DBEAFE', '#1E40AF'],
  graduated:   ['#E0E7FF', '#3730A3'],
  withdrawn:   ['#FEF9C3', '#92400E'],
  archived:    ['#F3F4F6', '#6B7280'],
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [lifecycleModal, setLifecycleModal] = useState<{ student: Student; action: string } | null>(null);
  const [lifecycleNotes, setLifecycleNotes] = useState('');
  const [transferSchool, setTransferSchool] = useState('');
  const [gradYear, setGradYear] = useState(String(new Date().getFullYear()));
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const classes = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'];

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  }

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (classFilter) p.set('class', classFilter);
      p.set('status', statusFilter);
      const r = await fetch(`/api/students?${p}`);
      const d = await r.json() as { students?: Student[] };
      setStudents(d.students ?? []);
    } finally { setLoading(false); }
  }, [classFilter, statusFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  function openCreate() { setEditStudent(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(s: Student) {
    setEditStudent(s);
    setForm({ name: s.name, class: s.class ?? '', section: s.section ?? 'A',
      roll_number: s.roll_number ?? '', admission_number: s.admission_number ?? '',
      phone_parent: s.phone_parent ?? '', parent_name: s.parent_name ?? '',
      date_of_birth: s.date_of_birth ?? '' });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const method = editStudent ? 'PATCH' : 'POST';
      const body = editStudent ? { id: editStudent.id, ...form } : form;
      const r = await fetch('/api/students', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json() as { error?: string };
      if (!r.ok) { showToast(d.error ?? 'Save failed', 'error'); return; }
      showToast(editStudent ? 'Student updated' : 'Student added'); setShowModal(false); fetchStudents();
    } finally { setSaving(false); }
  }

  async function handleLifecycle() {
    if (!lifecycleModal) return;
    setLifecycleLoading(true);
    const { student, action } = lifecycleModal;
    const body: Record<string, unknown> = { id: student.id, action, notes: lifecycleNotes };
    if (action === 'transfer') body.transfer_school = transferSchool;
    if (action === 'graduate') body.graduation_year = Number(gradYear);
    const r = await fetch('/api/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json() as { error?: string };
    setLifecycleLoading(false);
    if (!r.ok) { showToast(d.error ?? 'Action failed', 'error'); return; }
    const labels: Record<string, string> = { transfer: 'transferred', graduate: 'marked as graduated', withdraw: 'withdrawn', archive: 'archived', reactivate: 'reactivated' };
    showToast(`${student.name} ${labels[action] ?? action}`);
    setLifecycleModal(null); setLifecycleNotes(''); setTransferSchool('');
    fetchStudents();
  }

  async function quickDeactivate(s: Student) {
    const r = await fetch(`/api/students?id=${s.id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Student archived'); fetchStudents(); }
    else showToast('Failed', 'error');
  }

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const inp = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, color: '#111827' };

  return (
    <Layout title="Students" subtitle={`${filtered.length} students shown`}
      actions={<button onClick={openCreate} className="btn btn-primary btn-sm">+ Add Student</button>}>

      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: toastType === 'success' ? '#15803D' : '#B91C1C', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>{toastType === 'success' ? '✓' : '✗'} {toast}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search name or parent..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 220 }} />
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ ...inp, width: 130 }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 130 }}>
          <option value="active">Active</option>
          <option value="transferred">Transferred</option>
          <option value="graduated">Graduated</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👨‍🎓</div><div className="empty-state-title">Loading...</div></div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👨‍🎓</div><div className="empty-state-title">No students found</div></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Name</th><th>Class</th><th>Status</th><th>Parent</th><th>Phone</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(s => {
                const [bg, fg] = STATUS_COLORS[s.status] ?? ['#F3F4F6', '#6B7280'];
                return (
                  <tr key={s.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>{s.admission_number && <div style={{ fontSize: 11, color: '#9CA3AF' }}>#{s.admission_number}</div>}</td>
                    <td>{s.class ? <span className="badge badge-indigo">{s.class}{s.section ? `-${s.section}` : ''}</span> : '—'}</td>
                    <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{s.status}</span></td>
                    <td style={{ fontSize: 13, color: '#374151' }}>{s.parent_name ?? '—'}</td>
                    <td style={{ fontSize: 13, color: '#6B7280' }}>{s.phone_parent ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button onClick={() => openEdit(s)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Edit</button>
                        {s.status === 'active' && <>
                          <button onClick={() => { setLifecycleModal({ student: s, action: 'transfer' }); setLifecycleNotes(''); setTransferSchool(''); }} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1E40AF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Transfer</button>
                          <button onClick={() => { setLifecycleModal({ student: s, action: 'graduate' }); setLifecycleNotes(''); }} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #A5B4FC', background: '#EEF2FF', color: '#3730A3', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Graduate</button>
                          <button onClick={() => { setLifecycleModal({ student: s, action: 'withdraw' }); setLifecycleNotes(''); }} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Withdraw</button>
                        </>}
                        {s.status !== 'active' && <button onClick={() => { setLifecycleModal({ student: s, action: 'reactivate' }); setLifecycleNotes(''); }} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#065F46', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reactivate</button>}
                        {s.status === 'active' && <button onClick={() => quickDeactivate(s)} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Archive</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 20 }}>{editStudent ? 'Edit Student' : 'Add New Student'}</div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>STUDENT NAME *</label><input required style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CLASS *</label><select required style={inp} value={form.class} onChange={e => setForm(p => ({ ...p, class: e.target.value }))}><option value="">Select</option>{classes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>SECTION</label><select style={inp} value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}>{['A','B','C','D','E'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ROLL NO.</label><input style={inp} value={form.roll_number} onChange={e => setForm(p => ({ ...p, roll_number: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ADMISSION NO.</label><input style={inp} value={form.admission_number} onChange={e => setForm(p => ({ ...p, admission_number: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>PARENT NAME</label><input style={inp} value={form.parent_name} onChange={e => setForm(p => ({ ...p, parent_name: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>PARENT PHONE</label><input style={inp} value={form.phone_parent} onChange={e => setForm(p => ({ ...p, phone_parent: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>DATE OF BIRTH</label><input type="date" style={inp} value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Saving...' : editStudent ? 'Update' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Modal */}
      {lifecycleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 4 }}>
              {lifecycleModal.action === 'transfer' ? '🔄 Transfer Student' : lifecycleModal.action === 'graduate' ? '🎓 Mark as Graduated' : lifecycleModal.action === 'withdraw' ? '📤 Withdraw Student' : '✅ Reactivate Student'}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{lifecycleModal.student.name}</div>

            {lifecycleModal.action === 'transfer' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>DESTINATION SCHOOL</label>
                <input value={transferSchool} onChange={e => setTransferSchool(e.target.value)} placeholder="School name or town" style={{ ...inp, width: '100%' }} />
              </div>
            )}
            {lifecycleModal.action === 'graduate' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>GRADUATION YEAR</label>
                <input type="number" value={gradYear} onChange={e => setGradYear(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>NOTES (optional)</label>
              <textarea value={lifecycleNotes} onChange={e => setLifecycleNotes(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setLifecycleModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleLifecycle} disabled={lifecycleLoading} className="btn btn-primary" style={{ flex: 2 }}>
                {lifecycleLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
