'use client';

// PATH: app/teacher/homework/page.tsx
//
// Teacher's homework dashboard.
// Three view states managed by `screen`:
//   - 'auth': phone+PIN login screen (mirrors /teacher login pattern)
//   - 'list': recent homework with create CTA
//   - 'detail': drill into a homework -> see submissions, grade per row
//
// Auth model: phone+PIN passed on every API call (Item 9 pattern).
// Stored in component state, NOT localStorage (artifacts-style restriction).
//
// Status enum (DB CHECK): pending | submitted | late | graded | missed.

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

type Screen = 'auth' | 'list' | 'detail';

interface HomeworkRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  attachments: string[];
  created_at: string;
  class: { id: string; grade_level: string; section: string } | null;
  subject: { id: string; name: string; code: string } | null;
  submissions: { total: number; pending: number; submitted: number; late: number; graded: number; missed: number };
}

interface SubmissionRow {
  id: string;
  student: { id: string; name: string; parent_name: string | null };
  status: string;
  submitted_at: string | null;
  marks_obtained: number | null;
  teacher_remarks: string | null;
  attachments: string[];
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-pending',
  submitted: 'badge-medium',
  late: 'badge-low',
  graded: 'badge-done',
  missed: 'badge-failed',
};

const VALID_GRADE_STATUSES = ['graded', 'pending', 'submitted', 'late', 'missed'] as const;

export default function HomeworkPage() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; grade_level: string; section: string }[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string; code: string }[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ class_id: '', subject_id: '', title: '', description: '', due_date: '', attachments: '' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [activeHomework, setActiveHomework] = useState<HomeworkRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [gradingFor, setGradingFor] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState<Record<string, { marks: string; remarks: string; status: string }>>({});

  // Load class + subject options after auth.
  async function loadOptions() {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/teacher/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, pin }),
        }),
        fetch('/api/teacher/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, pin }),
        }).catch(() => null),
      ]);
      if (cRes.ok) {
        const cd = await cRes.json();
        // Schedule entries have classes nested. Dedupe by class.id.
        const classMap = new Map<string, { id: string; grade_level: string; section: string }>();
        for (const e of cd.schedule ?? []) {
          if (e.classes) classMap.set(e.classes.id, e.classes);
        }
        setClassOptions(Array.from(classMap.values()));
      }
      if (sRes && sRes.ok) {
        const sd = await sRes.json();
        setSubjectOptions(sd.subjects ?? []);
      }
    } catch {
      // Non-fatal: options stay empty, user can retype.
    }
  }

  async function loadHomework() {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher/homework/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await res.json();
      if (res.ok) setHomework(d.homework ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (!phone || !pin) {
      setAuthError('Phone and PIN required');
      return;
    }
    setLoading(true);
    try {
      // Sanity-check credentials with the homework list call (it returns 401 on bad creds).
      const res = await fetch('/api/teacher/homework/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      if (!res.ok) {
        const d = await res.json();
        setAuthError(d.error ?? 'Login failed');
        return;
      }
      const d = await res.json();
      setHomework(d.homework ?? []);
      setScreen('list');
      void loadOptions();
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!createForm.class_id || !createForm.title || !createForm.due_date) {
      setCreateError('Class, title, and due date required');
      return;
    }
    setCreating(true);
    try {
      const attachments = createForm.attachments
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/teacher/homework/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, pin,
          class_id: createForm.class_id,
          subject_id: createForm.subject_id || undefined,
          title: createForm.title,
          description: createForm.description || undefined,
          due_date: createForm.due_date,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setCreateError(d.error ?? 'Failed to create homework');
        return;
      }
      setShowCreate(false);
      setCreateForm({ class_id: '', subject_id: '', title: '', description: '', due_date: '', attachments: '' });
      await loadHomework();
    } finally {
      setCreating(false);
    }
  }

  async function openHomework(h: HomeworkRow) {
    setActiveHomework(h);
    setScreen('detail');
    setSubmissions([]);
    try {
      const res = await fetch('/api/teacher/homework/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, homework_id: h.id }),
      });
      const d = await res.json();
      if (res.ok) {
        setSubmissions(d.submissions ?? []);
        // Pre-fill grade forms with current values.
        const initialForms: typeof gradeForm = {};
        for (const s of d.submissions ?? []) {
          initialForms[s.id] = {
            marks: s.marks_obtained?.toString() ?? '',
            remarks: s.teacher_remarks ?? '',
            status: s.status === 'pending' ? 'graded' : s.status,
          };
        }
        setGradeForm(initialForms);
      }
    } catch {
      // silent
    }
  }

  async function handleGrade(submissionId: string) {
    const form = gradeForm[submissionId];
    if (!form) return;
    setGradingFor(submissionId);
    try {
      const marks = form.marks.trim() === '' ? null : Number(form.marks);
      if (marks !== null && (isNaN(marks) || marks < 0 || marks > 1000)) {
        alert('Marks must be a number between 0 and 1000');
        return;
      }
      const res = await fetch('/api/teacher/homework/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, pin,
          submission_id: submissionId,
          marks_obtained: marks,
          teacher_remarks: form.remarks || undefined,
          status: form.status,
        }),
      });
      if (res.ok && activeHomework) {
        // Refetch submissions to reflect the change.
        await openHomework(activeHomework);
      } else {
        const d = await res.json();
        alert(d.error ?? 'Failed to grade');
      }
    } finally {
      setGradingFor(null);
    }
  }

  function fmtDate(s: string): string {
    return new Date(s + (s.length === 10 ? 'T00:00:00+05:30' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // === Auth screen ===
  if (screen === 'auth') {
    return (
      <Layout title="Homework" subtitle="Teacher login">
        <div className="card">
          <form onSubmit={handleAuth}>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit phone" />
            <label className="label" style={{ marginTop: 12 }}>PIN</label>
            <input className="input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="4-6 digit PIN" />
            {authError && <div className="alert alert-error" style={{ marginTop: 12 }}>{authError}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
              {loading ? 'Loading...' : 'Login'}
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  // === List screen ===
  if (screen === 'list') {
    return (
      <Layout
        title="Homework"
        subtitle={`${homework.length} assignment${homework.length === 1 ? '' : 's'} this period`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            + New
          </button>
        }
      >
        {homework.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">No homework yet</div>
            <div className="empty-state-sub">Tap + New to assign your first.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {homework.map(h => {
              const ungraded = h.submissions.pending + h.submissions.submitted + h.submissions.late;
              return (
                <button key={h.id} onClick={() => openHomework(h)}
                  style={{ textAlign: 'left', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>Due {fmtDate(h.due_date)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                    {h.class ? `Class ${h.class.grade_level}-${h.class.section}` : 'Unassigned class'}
                    {h.subject ? ` · ${h.subject.name}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                    <span className="badge badge-pending">{h.submissions.pending} pending</span>
                    <span className="badge badge-done">{h.submissions.graded} graded</span>
                    {ungraded > 0 && <span style={{ color: '#B91C1C', fontWeight: 600 }}>{ungraded} need action</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
               onClick={() => setShowCreate(false)}>
            <div style={{ background: '#fff', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}
                 onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New Homework</div>
              <form onSubmit={handleCreate}>
                <label className="label">Class</label>
                <select className="input" value={createForm.class_id} onChange={e => setCreateForm({ ...createForm, class_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {classOptions.map(c => <option key={c.id} value={c.id}>{c.grade_level}-{c.section}</option>)}
                </select>

                <label className="label" style={{ marginTop: 12 }}>Subject (optional)</label>
                <select className="input" value={createForm.subject_id} onChange={e => setCreateForm({ ...createForm, subject_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>

                <label className="label" style={{ marginTop: 12 }}>Title</label>
                <input className="input" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} maxLength={200} />

                <label className="label" style={{ marginTop: 12 }}>Description (optional)</label>
                <textarea className="input" rows={3} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} maxLength={4000} />

                <label className="label" style={{ marginTop: 12 }}>Due date</label>
                <input className="input" type="date" value={createForm.due_date} onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })} />

                <label className="label" style={{ marginTop: 12 }}>Attachment URLs (optional, one per line)</label>
                <textarea className="input" rows={2} value={createForm.attachments} onChange={e => setCreateForm({ ...createForm, attachments: e.target.value })} placeholder="https://..." />

                {createError && <div className="alert alert-error" style={{ marginTop: 12 }}>{createError}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 2 }}>
                    {creating ? 'Creating...' : 'Create homework'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  // === Detail screen (grading) ===
  const h = activeHomework!;
  return (
    <Layout
      title={h.title}
      subtitle={h.class ? `Class ${h.class.grade_level}-${h.class.section} · Due ${fmtDate(h.due_date)}` : `Due ${fmtDate(h.due_date)}`}
      actions={<button onClick={() => setScreen('list')} className="btn btn-ghost btn-sm">← Back</button>}
    >
      {h.description && (
        <div className="card-sm" style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>{h.description}</div>
      )}

      {submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Loading submissions...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {submissions.map(s => {
            const f = gradeForm[s.id] ?? { marks: '', remarks: '', status: 'graded' };
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.student.name}</div>
                    {s.student.parent_name && <div style={{ fontSize: 11, color: '#6B7280' }}>Parent: {s.student.parent_name}</div>}
                  </div>
                  <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-gray'}`}>{s.status}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="label">Marks (optional)</label>
                    <input className="input" type="number" min={0} max={1000}
                      value={f.marks}
                      onChange={e => setGradeForm({ ...gradeForm, [s.id]: { ...f, marks: e.target.value } })} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input"
                      value={f.status}
                      onChange={e => setGradeForm({ ...gradeForm, [s.id]: { ...f, status: e.target.value } })}>
                      {VALID_GRADE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                </div>

                <label className="label" style={{ marginTop: 8 }}>Remarks (optional)</label>
                <input className="input" value={f.remarks} maxLength={2000}
                  onChange={e => setGradeForm({ ...gradeForm, [s.id]: { ...f, remarks: e.target.value } })} />

                <button onClick={() => handleGrade(s.id)} disabled={gradingFor === s.id}
                  className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }}>
                  {gradingFor === s.id ? 'Saving...' : 'Save grade'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
