'use client';
// app/admin/timetable/page.tsx
// ISS-3 (#3) — Admin timetable editor. Pick a class, manage its periods
// (add/edit/delete) against /api/admin/timetable CRUD.

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { T } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface ClassRow { id: string; grade_level: string; section: string }
interface SubjectRow { id: string; name: string; subject_kind: string }
interface StaffRow { id: string; name: string }
interface Nested { name?: string }
interface Slot {
  id: string; class_id: string; subject_id: string; staff_id: string | null;
  day_of_week: number; period: number; start_time: string; end_time: string;
  subjects?: Nested | Nested[]; staff?: Nested | Nested[];
}

const DAYS = [
  { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' },
];

function one(v: Nested | Nested[] | undefined | null): Nested | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const BLANK = { id: '', day_of_week: 1, period: 1, subject_id: '', staff_id: '', start_time: '09:00', end_time: '09:45' };

export default function TimetablePage() {
  const { lang } = useLang();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [classId, setClassId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...BLANK });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/classes').then(r => r.ok ? r.json() : { classes: [] }),
      fetch('/api/admin/subjects').then(r => r.ok ? r.json() : { subjects: [] }),
      fetch('/api/admin/staff').then(r => r.ok ? r.json() : { staff: [] }),
    ]).then(([c, s, t]) => {
      const cls: ClassRow[] = c.classes ?? [];
      setClasses(cls);
      setSubjects(s.subjects ?? []);
      setStaff(t.staff ?? []);
      if (cls.length) setClassId(cls[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const loadSlots = useCallback(async (cid: string) => {
    if (!cid) { setSlots([]); return; }
    const r = await fetch(`/api/admin/timetable?class_id=${cid}`);
    if (r.ok) { const d = await r.json(); setSlots((d.timetable ?? []).filter((x: Slot) => x.class_id === cid)); }
  }, []);
  useEffect(() => { void loadSlots(classId); }, [classId, loadSlots]);

  function startAdd() { setForm({ ...BLANK }); setShowForm(true); setMsg(null); }
  function startEdit(s: Slot) {
    setForm({ id: s.id, day_of_week: s.day_of_week, period: s.period, subject_id: s.subject_id, staff_id: s.staff_id ?? '', start_time: (s.start_time ?? '').slice(0, 5), end_time: (s.end_time ?? '').slice(0, 5) });
    setShowForm(true); setMsg(null);
  }

  async function save() {
    if (!form.subject_id) { setMsg({ kind: 'err', text: 'Please choose a subject.' }); return; }
    setBusy(true); setMsg(null);
    const fields = { subject_id: form.subject_id, staff_id: form.staff_id || null, day_of_week: form.day_of_week, period: form.period, start_time: form.start_time, end_time: form.end_time };
    const r = form.id
      ? await fetch('/api/admin/timetable', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, ...fields }) })
      : await fetch('/api/admin/timetable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ class_id: classId, ...fields }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setShowForm(false); setMsg({ kind: 'ok', text: form.id ? 'Period updated.' : 'Period added.' }); await loadSlots(classId); }
    else setMsg({ kind: 'err', text: d.error ?? 'Could not save.' });
    setBusy(false);
  }

  async function del(s: Slot) {
    if (!confirm('Delete this period?')) return;
    setMsg(null);
    const r = await fetch(`/api/admin/timetable?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    if (r.ok) { setMsg({ kind: 'ok', text: 'Period deleted.' }); await loadSlots(classId); }
    else { const d = await r.json().catch(() => ({})); setMsg({ kind: 'err', text: d.error ?? 'Could not delete.' }); }
  }

  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, fontFamily: 'inherit', outline: 'none' as const, background: '#fff' };

  return (
    <Layout title={T('timetable', lang as never)} subtitle="Manage class periods">
      <div style={{ marginBottom: 12 }}>
        <a href="/admin/subjects" style={{ fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none' }}>📘 Manage subjects →</a>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>{T('loading', lang as never)}</div>
      ) : classes.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🗓</div><div className="empty-state-title">No classes yet</div><div className="empty-state-sub">Add classes first to build a timetable.</div></div>
      ) : (
        <>
          {/* Class selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={{ ...inp }}>
              {classes.map(c => <option key={c.id} value={c.id}>Grade {c.grade_level}{c.section ? `-${c.section}` : ''}</option>)}
            </select>
            <button onClick={startAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add period</button>
          </div>

          {msg && <div style={{ marginBottom: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#065F46' : '#B91C1C' }}>{msg.text}</div>}

          {/* Add/Edit form */}
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 12 }}>{form.id ? 'Edit period' : 'Add period'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <label style={{ fontSize: 12, color: '#6B7280' }}>Day
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} style={{ ...inp, width: '100%', marginTop: 4 }}>
                    {DAYS.map(d => <option key={d.n} value={d.n}>{d.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>Period #
                  <input type="number" min={1} value={form.period} onChange={e => setForm(f => ({ ...f, period: Number(e.target.value) }))} style={{ ...inp, width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>Subject
                  <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} style={{ ...inp, width: '100%', marginTop: 4 }}>
                    <option value="">— choose —</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.subject_kind})</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>Teacher (optional)
                  <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} style={{ ...inp, width: '100%', marginTop: 4 }}>
                    <option value="">— none —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>Start
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={{ ...inp, width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>End
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={{ ...inp, width: '100%', marginTop: 4 }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => void save()} disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: busy ? '#A5B4FC' : '#4F46E5', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setShowForm(false); setMsg(null); }} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Periods grouped by day */}
          {slots.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🗓</div><div className="empty-state-title">No periods for this class yet</div><div className="empty-state-sub">Use “+ Add period” to build the timetable.</div></div>
          ) : DAYS.map(day => {
            const daySlots = slots.filter(s => s.day_of_week === day.n).sort((a, b) => a.period - b.period);
            if (daySlots.length === 0) return null;
            return (
              <div key={day.n} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{day.label}</div>
                {daySlots.map(s => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 28 }}>P{s.period}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', minWidth: 86 }}>{(s.start_time ?? '').slice(0, 5)}–{(s.end_time ?? '').slice(0, 5)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{one(s.subjects)?.name ?? '—'}</div>
                      {one(s.staff)?.name && <div style={{ fontSize: 11, color: '#6B7280' }}>{one(s.staff)?.name}</div>}
                    </div>
                    <button onClick={() => startEdit(s)} style={{ background: 'none', border: '1px solid #E5E7EB', color: '#4F46E5', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => void del(s)} style={{ background: 'none', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </Layout>
  );
}
