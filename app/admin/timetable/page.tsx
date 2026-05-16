'use client';

// PR-7: Admin Timetable Management Page
// Lets owner/admin pick a class, view its 5-day × N-period grid, add new entries,
// and delete existing ones. Backed by:
//   GET    /api/admin/classes
//   GET    /api/admin/staff
//   GET    /api/admin/subjects
//   GET    /api/admin/timetable?class_id=X
//   POST   /api/admin/timetable
//   DELETE /api/admin/timetable?id=X
//
// DB-side guarantees (already in schema):
//   - UNIQUE (school_id, class_id, day_of_week, period) → no class double-booking
//   - UNIQUE (school_id, staff_id, day_of_week, period) → no teacher double-booking
// Both will surface as 500 errors with helpful message when the user tries to
// create a clashing entry. We catch and translate to a user-readable message.

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Layout from '@/components/Layout';

interface ClassRow {
  id: string;
  grade_level: string;
  section: string | null;
  capacity: number | null;
  class_teacher_id: string | null;
}

interface StaffRow {
  id: string;
  name: string;
  role: string;
  subject: string | null;
  is_active: boolean;
}

interface SubjectRow {
  id: string;
  code: string | null;
  name: string;
}

interface TimetableRow {
  id: string;
  class_id: string;
  subject_id: string;
  staff_id: string;
  day_of_week: number;
  period: number | null;
  start_time: string;
  end_time: string;
  classes: { grade_level: string; section: string | null } | null;
  subjects: { name: string } | null;
  staff: { name: string } | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_INDICES = [1, 2, 3, 4, 5]; // Mon–Fri grid

// Default period count and time slots — admin can override per entry
const DEFAULT_PERIODS = 8;
const DEFAULT_TIMES: Array<{ period: number; start: string; end: string }> = [
  { period: 1, start: '09:00', end: '09:45' },
  { period: 2, start: '09:45', end: '10:30' },
  { period: 3, start: '10:45', end: '11:30' },
  { period: 4, start: '11:30', end: '12:15' },
  { period: 5, start: '13:00', end: '13:45' },
  { period: 6, start: '13:45', end: '14:30' },
  { period: 7, start: '14:30', end: '15:15' },
  { period: 8, start: '15:15', end: '16:00' },
];

function classLabel(c: ClassRow): string {
  return c.section ? `${c.grade_level}-${c.section}` : c.grade_level;
}

export default function TimetablePage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [entries, setEntries] = useState<TimetableRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState('');

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addDay, setAddDay] = useState<number>(1);
  const [addPeriod, setAddPeriod] = useState<number>(1);
  const [addSubject, setAddSubject] = useState('');
  const [addStaff, setAddStaff] = useState('');
  const [addStart, setAddStart] = useState('09:00');
  const [addEnd, setAddEnd] = useState('09:45');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Initial load: classes + staff + subjects
  useEffect(() => {
    async function load() {
      setLoadingMeta(true);
      setError('');
      try {
        const [cRes, sRes, sbRes] = await Promise.all([
          fetch('/api/admin/classes'),
          fetch('/api/admin/staff'),
          fetch('/api/admin/subjects'),
        ]);
        const cData = await cRes.json();
        const sData = await sRes.json();
        const sbData = await sbRes.json();

        if (!cRes.ok) throw new Error(cData.error ?? 'Failed to load classes');
        if (!sRes.ok) throw new Error(sData.error ?? 'Failed to load staff');
        if (!sbRes.ok) throw new Error(sbData.error ?? 'Failed to load subjects');

        setClasses(cData.classes ?? []);
        setStaff(sData.staff ?? []);
        setSubjects(sbData.subjects ?? []);

        // Auto-select first class
        if ((cData.classes?.length ?? 0) > 0 && !selectedClass) {
          setSelectedClass(cData.classes[0].id);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingMeta(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load timetable entries when selectedClass changes
  const loadEntries = useCallback(async () => {
    if (!selectedClass) {
      setEntries([]);
      return;
    }
    setLoadingEntries(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/timetable?class_id=${encodeURIComponent(selectedClass)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load timetable');
      setEntries(data.timetable ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingEntries(false);
    }
  }, [selectedClass]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  // Open add modal pre-filled for a cell (day, period)
  function openAddFor(day: number, period: number) {
    if (!selectedClass) {
      setError('Pick a class first');
      return;
    }
    setAddDay(day);
    setAddPeriod(period);
    const slot = DEFAULT_TIMES.find(t => t.period === period);
    setAddStart(slot?.start ?? '09:00');
    setAddEnd(slot?.end ?? '09:45');
    setAddSubject('');
    setAddStaff('');
    setAddError('');
    setShowAdd(true);
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!addSubject || !addStaff) {
      setAddError('Subject and Teacher are required');
      return;
    }
    setSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass,
          subject_id: addSubject,
          staff_id: addStaff,
          day_of_week: addDay,
          period: addPeriod,
          start_time: addStart,
          end_time: addEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Translate DB unique-violation errors to readable messages
        const raw = String(data.error ?? 'Failed to add entry');
        if (raw.includes('timetable_no_class_period_clash')) {
          setAddError(`This class already has another subject in period ${addPeriod} on ${DAY_LABELS[addDay]}. Delete that entry first.`);
        } else if (raw.includes('timetable_no_teacher_period_clash')) {
          setAddError(`This teacher is already assigned to another class in period ${addPeriod} on ${DAY_LABELS[addDay]}.`);
        } else if (raw.includes('timetable_class_id_day_of_week_period_key')) {
          setAddError(`This class already has another subject in period ${addPeriod} on ${DAY_LABELS[addDay]}.`);
        } else {
          setAddError(raw);
        }
        return;
      }
      setShowAdd(false);
      await loadEntries();
    } catch (e) {
      setAddError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this timetable entry?')) return;
    try {
      const res = await fetch(`/api/admin/timetable?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Delete failed');
        return;
      }
      await loadEntries();
    } catch (e) {
      setError(String(e));
    }
  }

  // Build grid: entries indexed by `${day}-${period}`
  const grid: Map<string, TimetableRow> = new Map();
  for (const e of entries) {
    if (e.period !== null && e.period !== undefined) {
      grid.set(`${e.day_of_week}-${e.period}`, e);
    }
  }

  const periodNumbers = Array.from({ length: DEFAULT_PERIODS }, (_, i) => i + 1);
  const selectedClassRow = classes.find(c => c.id === selectedClass);

  return (
    <Layout title="Timetable" subtitle="Class period schedule — Mon–Fri × 8 periods">

      {loadingMeta && <div style={{ padding: 20, color: '#6B7280' }}>Loading…</div>}

      {!loadingMeta && classes.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', background: '#FEF3C7', color: '#92400E', borderRadius: 10, fontSize: 13 }}>
          No classes set up yet for this school. Create classes first via the admissions or settings flow before scheduling.
        </div>
      )}

      {!loadingMeta && classes.length > 0 && (
        <>
          {/* Class picker */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>CLASS:</span>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, minWidth: 180, background: '#fff' }}>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
            {selectedClassRow && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                Capacity {selectedClassRow.capacity ?? '—'}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Grid */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #E5E7EB', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Period</th>
                  {WEEKDAY_INDICES.map(d => (
                    <th key={d} style={{ padding: '10px 8px', borderBottom: '1px solid #E5E7EB', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                      {DAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodNumbers.map(period => {
                  const slot = DEFAULT_TIMES.find(t => t.period === period);
                  return (
                    <tr key={period} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#374151', background: '#FAFAFA', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12 }}>P{period}</div>
                        {slot && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{slot.start}–{slot.end}</div>}
                      </td>
                      {WEEKDAY_INDICES.map(day => {
                        const entry = grid.get(`${day}-${period}`);
                        return (
                          <td key={day} style={{ padding: 4, verticalAlign: 'top', minWidth: 100 }}>
                            {entry ? (
                              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 6, padding: '6px 8px', position: 'relative' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#3730A3' }}>{entry.subjects?.name ?? '—'}</div>
                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{entry.staff?.name ?? '—'}</div>
                                <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{entry.start_time?.slice(0,5)}–{entry.end_time?.slice(0,5)}</div>
                                <button onClick={() => void deleteEntry(entry.id)}
                                  title="Delete entry"
                                  style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', color: '#991B1B', fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: 2 }}>
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => openAddFor(day, period)}
                                style={{ width: '100%', height: 56, background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 6, color: '#9CA3AF', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
                                title={`Add entry — ${DAY_LABELS[day]}, period ${period}`}>
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {loadingEntries && <div style={{ padding: 12, color: '#9CA3AF', fontSize: 12 }}>Loading entries…</div>}

          <div style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}>
            Click + to add an entry. The same class cannot have two subjects in the same period.
            The same teacher cannot be assigned to two classes in the same period.
          </div>
        </>
      )}

      {/* Add modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
        }} onClick={() => !saving && setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Add Timetable Entry</h3>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              {selectedClassRow && classLabel(selectedClassRow)} · {DAY_LABELS[addDay]} · Period {addPeriod}
            </div>

            <form onSubmit={submitAdd}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Subject *</label>
                <select value={addSubject} onChange={e => setAddSubject(e.target.value)} required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}>
                  <option value="">— Select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Teacher *</label>
                <select value={addStaff} onChange={e => setAddStaff(e.target.value)} required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13 }}>
                  <option value="">— Select teacher —</option>
                  {staff.filter(s => s.role === 'teacher' || s.role === 'principal' || !s.role).map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.subject ? ` · ${s.subject}` : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Start *</label>
                  <input type="time" value={addStart} onChange={e => setAddStart(e.target.value)} required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>End *</label>
                  <input type="time" value={addEnd} onChange={e => setAddEnd(e.target.value)} required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              {addError && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>{addError}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowAdd(false)} disabled={saving}
                  style={{ flex: 1, padding: '10px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: '10px', background: saving ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
