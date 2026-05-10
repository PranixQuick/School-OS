'use client';

// PATH: app/teacher/lesson-plans/page.tsx
//
// Teacher's lesson plan calendar (week view default).
// Pager: ← Prev | Current Week | Next →
// Tap a date+class cell to upsert a plan inline.
//
// completion_status enum (DB CHECK): planned | in_progress | completed | skipped.
// week_start defaults to current Monday IST; ?week_start=YYYY-MM-DD overrides.

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface PlanRow {
  id: string;
  planned_date: string;
  completion_status: string;
  completed_at: string | null;
  notes: string | null;
  topic_id: string | null;
  class: { id: string; grade_level: string; section: string } | null;
  subject: { id: string; name: string; code: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  planned: 'badge-pending',
  in_progress: 'badge-medium',
  completed: 'badge-done',
  skipped: 'badge-low',
};

const VALID_STATUSES = ['planned', 'in_progress', 'completed', 'skipped'] as const;

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getMondayOfWeekIST(dateStr: string): string {
  // Parse YYYY-MM-DD as IST midnight, find Monday of that ISO week.
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const dowName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'short',
  }).format(d);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dowName);
  // Days back to Monday: Sun=6 (back to prev Mon), Mon=0, Tue=1, ..., Sat=5.
  const back = (dow + 6) % 7;
  const monday = new Date(d.getTime() - back * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(monday);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const shifted = new Date(d.getTime() + days * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted);
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short',
  }).format(d);
}

export default function LessonPlansPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [weekStart, setWeekStart] = useState(getMondayOfWeekIST(todayIST()));
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; grade_level: string; section: string }[]>([]);

  const [editingCell, setEditingCell] = useState<{ date: string; classId: string } | null>(null);
  const [editForm, setEditForm] = useState({ status: 'planned', notes: '', subject_id: '', plan_id: '' });
  const [savingCell, setSavingCell] = useState(false);
  const [cellError, setCellError] = useState('');

  async function loadPlans(start: string) {
    setLoading(true);
    try {
      const until = shiftDate(start, 6);
      const res = await fetch('/api/teacher/lesson-plans/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, since_date: start, until_date: until }),
      });
      const d = await res.json();
      if (res.ok) setPlans(d.plans ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadClasses() {
    try {
      const res = await fetch('/api/teacher/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      if (res.ok) {
        const d = await res.json();
        const classMap = new Map<string, { id: string; grade_level: string; section: string }>();
        for (const e of d.schedule ?? []) {
          if (e.classes) classMap.set(e.classes.id, e.classes);
        }
        setClassOptions(Array.from(classMap.values()));
      }
    } catch {
      // silent
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
      const res = await fetch('/api/teacher/lesson-plans/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, since_date: weekStart, until_date: shiftDate(weekStart, 6) }),
      });
      if (!res.ok) {
        const d = await res.json();
        setAuthError(d.error ?? 'Login failed');
        return;
      }
      const d = await res.json();
      setPlans(d.plans ?? []);
      setAuthed(true);
      void loadClasses();
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function openCell(date: string, classId: string) {
    const existing = plans.find(p => p.planned_date === date && p.class?.id === classId);
    if (existing) {
      setEditForm({
        status: existing.completion_status,
        notes: existing.notes ?? '',
        subject_id: existing.subject?.id ?? '',
        plan_id: existing.id,
      });
    } else {
      setEditForm({ status: 'planned', notes: '', subject_id: '', plan_id: '' });
    }
    setCellError('');
    setEditingCell({ date, classId });
  }

  async function saveCell() {
    if (!editingCell) return;
    setSavingCell(true);
    setCellError('');
    try {
      const body: Record<string, unknown> = {
        phone, pin,
        class_id: editingCell.classId,
        planned_date: editingCell.date,
        completion_status: editForm.status,
      };
      if (editForm.subject_id) body.subject_id = editForm.subject_id;
      if (editForm.notes) body.notes = editForm.notes;
      if (editForm.plan_id) body.lesson_plan_id = editForm.plan_id;

      const res = await fetch('/api/teacher/lesson-plans/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setCellError(d.error ?? 'Failed to save');
        return;
      }
      setEditingCell(null);
      await loadPlans(weekStart);
    } finally {
      setSavingCell(false);
    }
  }

  async function shiftWeek(deltaWeeks: number) {
    const newStart = shiftDate(weekStart, deltaWeeks * 7);
    setWeekStart(newStart);
    if (authed) await loadPlans(newStart);
  }

  // Build week dates Mon..Sun.
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

  // === Auth screen ===
  if (!authed) {
    return (
      <Layout title="Lesson Plans" subtitle="Teacher login">
        <div className="card">
          <form onSubmit={handleAuth}>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <label className="label" style={{ marginTop: 12 }}>PIN</label>
            <input className="input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} />
            {authError && <div className="alert alert-error" style={{ marginTop: 12 }}>{authError}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
              {loading ? 'Loading...' : 'Login'}
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  // === Calendar screen ===
  return (
    <Layout
      title="Lesson Plans"
      subtitle={`Week of ${fmtDayLabel(weekStart)}`}
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => shiftWeek(-1)} className="btn btn-ghost btn-sm">← Prev</button>
          <button onClick={() => { setWeekStart(getMondayOfWeekIST(todayIST())); void loadPlans(getMondayOfWeekIST(todayIST())); }}
                  className="btn btn-ghost btn-sm">This week</button>
          <button onClick={() => shiftWeek(1)} className="btn btn-ghost btn-sm">Next →</button>
        </div>
      }
    >
      {classOptions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No classes assigned</div>
          <div className="empty-state-sub">You need timetable rows before you can plan lessons.</div>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #E5E7EB', position: 'sticky', left: 0, background: '#fff' }}>Class</th>
                {weekDates.map(d => (
                  <th key={d} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #E5E7EB', minWidth: 80, fontWeight: 600, color: '#6B7280' }}>
                    {fmtDayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classOptions.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: 6, fontWeight: 700, color: '#111827', borderBottom: '1px solid #F3F4F6', position: 'sticky', left: 0, background: '#fff' }}>
                    {c.grade_level}-{c.section}
                  </td>
                  {weekDates.map(d => {
                    const p = plans.find(pl => pl.planned_date === d && pl.class?.id === c.id);
                    return (
                      <td key={d} style={{ padding: 4, borderBottom: '1px solid #F3F4F6', verticalAlign: 'top' }}>
                        <button onClick={() => openCell(d, c.id)}
                          style={{ width: '100%', minHeight: 48, padding: 6, background: p ? '#F9FAFB' : '#fff', border: '1px dashed #E5E7EB', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
                          {p ? (
                            <>
                              <span className={`badge ${STATUS_BADGE[p.completion_status] ?? 'badge-gray'}`} style={{ fontSize: 9 }}>
                                {p.completion_status}
                              </span>
                              {p.subject && <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{p.subject.code}</div>}
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>+ Plan</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell edit modal */}
      {editingCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
             onClick={() => setEditingCell(null)}>
          <div style={{ background: '#fff', width: '100%', maxHeight: '80vh', overflowY: 'auto', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}
               onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editForm.plan_id ? 'Edit lesson plan' : 'New lesson plan'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
              {fmtDayLabel(editingCell.date)} · Class {classOptions.find(c => c.id === editingCell.classId)?.grade_level}-{classOptions.find(c => c.id === editingCell.classId)?.section}
            </div>

            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              {VALID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label className="label" style={{ marginTop: 12 }}>Notes (optional)</label>
            <textarea className="input" rows={3} maxLength={4000}
              value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />

            {cellError && <div className="alert alert-error" style={{ marginTop: 12 }}>{cellError}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setEditingCell(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button type="button" onClick={saveCell} disabled={savingCell} className="btn btn-primary" style={{ flex: 2 }}>
                {savingCell ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
