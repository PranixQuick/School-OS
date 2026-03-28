'use client';

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface Student {
  id: string; name: string; class: string; section: string;
  roll_number: string | null; admission_number: string | null;
  phone_parent: string | null; parent_name: string | null;
  date_of_birth: string | null; is_active: boolean; created_at: string;
}

interface Toast { message: string; type: 'success' | 'error'; }

const emptyForm = {
  name: '', class: '', section: 'A',
  roll_number: '', admission_number: '',
  phone_parent: '', parent_name: '', date_of_birth: '',
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [classes] = useState(['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10']);

  useEffect(() => { fetchStudents(); }, [classFilter]);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchStudents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classFilter) params.set('class', classFilter);
      const res = await fetch(`/api/students?${params}`);
      const d = await res.json() as { students?: Student[] };
      setStudents(d.students ?? []);
    } finally { setLoading(false); }
  }

  function openCreate() {
    setEditStudent(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(s: Student) {
    setEditStudent(s);
    setForm({
      name: s.name, class: s.class, section: s.section,
      roll_number: s.roll_number ?? '', admission_number: s.admission_number ?? '',
      phone_parent: s.phone_parent ?? '', parent_name: s.parent_name ?? '',
      date_of_birth: s.date_of_birth ?? '',
    });
    setShowModal(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editStudent ? 'PATCH' : 'POST';
      const body = editStudent ? { id: editStudent.id, ...form } : form;
      const res = await fetch('/api/students', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json() as { error?: string };
      if (!res.ok) { showToast(d.error ?? 'Save failed', 'error'); return; }
      showToast(editStudent ? 'Student updated successfully' : 'Student added successfully', 'success');
      setShowModal(false);
      fetchStudents();
    } finally { setSaving(false); }
  }

  async function handleDelete(student: Student) {
    const res = await fetch('/api/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: student.id }) });
    if (res.ok) { showToast('Student deactivated', 'success'); fetchStudents(); }
    else showToast('Delete failed', 'error');
    setDeleteConfirm(null);
  }

  const filtered = students.filter(s =>
    search === '' || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.parent_name?.toLowerCase().includes(search.toLowerCase()) || false
  );

  const inputStyle = {
    width: '100%', height: 40, borderRadius: 8, border: '1px solid #D1D5DB',
    background: '#F9FAFB', fontSize: 14, padding: '0 12px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const, color: '#111827',
  };

  return (
    <Layout
      title="Students"
      subtitle={`${students.length} active students`}
      actions={
        <button onClick={openCreate} className="btn btn-primary btn-sm">+ Add Student</button>
      }
    >
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: toast.type === 'success' ? '#15803D' : '#B91C1C', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search by name or parent..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 260 }}
        />
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280', alignSelf: 'center' }}>
          {filtered.length} students shown
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👨‍🎓</div><div className="empty-state-title">Loading students...</div></div></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🎓</div>
            <div className="empty-state-title">{search ? 'No students match your search' : 'No students yet'}</div>
            <div className="empty-state-sub">Add your first student using the button above.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Class</th><th>Roll No.</th><th>Parent</th><th>Phone</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(student => (
                <tr key={student.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name}</div>
                    {student.admission_number && <div style={{ fontSize: 11, color: '#9CA3AF' }}>#{student.admission_number}</div>}
                  </td>
                  <td><span className="badge badge-indigo">{student.class}-{student.section}</span></td>
                  <td style={{ fontSize: 13, color: '#6B7280' }}>{student.roll_number ?? '—'}</td>
                  <td style={{ fontSize: 13, color: '#374151' }}>{student.parent_name ?? '—'}</td>
                  <td style={{ fontSize: 13, color: '#6B7280' }}>{student.phone_parent ?? '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(student)} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleteConfirm(student)} style={{ height: 32, padding: '0 10px', borderRadius: 7, border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#B91C1C', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 20 }}>
              {editStudent ? 'Edit Student' : 'Add New Student'}
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>STUDENT NAME *</label>
                  <input required style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CLASS *</label>
                  <select required style={inputStyle} value={form.class} onChange={e => setForm(p => ({ ...p, class: e.target.value }))}>
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>SECTION</label>
                  <select style={inputStyle} value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}>
                    {['A','B','C','D','E'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ROLL NUMBER</label>
                  <input style={inputStyle} value={form.roll_number} onChange={e => setForm(p => ({ ...p, roll_number: e.target.value }))} placeholder="01" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ADMISSION NO.</label>
                  <input style={inputStyle} value={form.admission_number} onChange={e => setForm(p => ({ ...p, admission_number: e.target.value }))} placeholder="ADM-2024-001" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>PARENT NAME</label>
                  <input style={inputStyle} value={form.parent_name} onChange={e => setForm(p => ({ ...p, parent_name: e.target.value }))} placeholder="Father / Mother name" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>PARENT PHONE</label>
                  <input style={inputStyle} value={form.phone_parent} onChange={e => setForm(p => ({ ...p, phone_parent: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>DATE OF BIRTH</label>
                  <input type="date" style={inputStyle} value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
                  {saving ? 'Saving...' : editStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 8 }}>Remove {deleteConfirm.name}?</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
              This will deactivate the student. Their data (attendance, fees, reports) will be preserved.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger" style={{ flex: 1 }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
