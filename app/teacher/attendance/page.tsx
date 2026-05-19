'use client';
// app/teacher/attendance/page.tsx
// Previously MISSING — caused 404 when teachers tapped Attendance.
// Mark class attendance with present/absent/late status.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClassOption { id: string; grade: string; section: string; label: string; }
interface StudentRow { id: string; name: string; roll_number: string | null; status: 'present' | 'absent' | 'late' | null; }
interface AttRecord { student_id: string; status: string; }

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [existingDate, setExistingDate] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  // Load teacher's assigned classes
  useEffect(() => {
    fetch('/api/teacher/classes')
      .then(r => r.ok ? r.json() : { classes: [] })
      .then(d => {
        const cls: ClassOption[] = (d.classes ?? []).map((c: { id: string; grade: string; section: string }) => ({
          id: c.id, grade: c.grade, section: c.section,
          label: `Class ${c.grade}${c.section ? '-' + c.section : ''}`,
        }));
        setClasses(cls);
        if (cls.length > 0) setSelectedClass(cls[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
  }, []);

  // Load students + existing attendance when class changes
  const loadStudents = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    setSaved(false);
    setExistingDate(null);

    const [studRes, attRes] = await Promise.allSettled([
      fetch(`/api/teacher/students?class_id=${selectedClass}`),
      fetch(`/api/teacher/attendance?class_id=${selectedClass}&date=${today}`),
    ]);

    let studentList: StudentRow[] = [];
    if (studRes.status === 'fulfilled' && studRes.value.ok) {
      const sd = await studRes.value.json();
      studentList = (sd.students ?? []).map((s: { id: string; name: string; roll_number: string | null }) => ({
        id: s.id, name: s.name, roll_number: s.roll_number, status: null,
      }));
    }

    if (attRes.status === 'fulfilled' && attRes.value.ok) {
      const ad = await attRes.value.json();
      const existing: AttRecord[] = ad.records ?? [];
      if (existing.length > 0) {
        setExistingDate(today);
        studentList = studentList.map(s => {
          const rec = existing.find((r: AttRecord) => r.student_id === s.id);
          return { ...s, status: (rec?.status ?? 'present') as StudentRow['status'] };
        });
      } else {
        studentList = studentList.map(s => ({ ...s, status: 'present' as const }));
      }
    } else {
      studentList = studentList.map(s => ({ ...s, status: 'present' as const }));
    }

    setStudents(studentList);
    setLoadingStudents(false);
  }, [selectedClass, today]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function toggleStatus(id: string) {
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s;
      const cycle: StudentRow['status'][] = ['present', 'absent', 'late'];
      const next = cycle[(cycle.indexOf(s.status!) + 1) % cycle.length];
      return { ...s, status: next };
    }));
    setSaved(false);
  }

  function markAll(status: StudentRow['status']) {
    setStudents(prev => prev.map(s => ({ ...s, status })));
    setSaved(false);
  }

  async function save() {
    if (students.length === 0) return;
    setSaving(true);
    const res = await fetch('/api/teacher/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_id: selectedClass,
        date: today,
        records: students.map(s => ({ student_id: s.id, status: s.status ?? 'present' })),
      }),
    });
    if (res.ok) { setSaved(true); setExistingDate(today); }
    setSaving(false);
  }

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    present: { bg: '#D1FAE5', color: '#065F46', label: 'P' },
    absent:  { bg: '#FEE2E2', color: '#B91C1C', label: 'A' },
    late:    { bg: '#FEF9C3', color: '#A16207', label: 'L' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Back
          </button>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Mark Attendance</div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Class selector */}
        {loadingClasses ? (
          <div style={{ background: '#F3F4F6', borderRadius: 10, height: 44, marginBottom: 14, animation: 'pulse 1.5s infinite' }} />
        ) : classes.length === 0 ? (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: '#92400E', fontSize: 13 }}>No classes assigned</div>
            <div style={{ color: '#92400E', fontSize: 12, marginTop: 2 }}>Contact admin to assign classes to your account.</div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Select Class</div>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, padding: '0 12px', outline: 'none', fontFamily: 'inherit', color: '#111827' }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}

        {/* Existing attendance note */}
        {existingDate && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#065F46', fontWeight: 600 }}>
            ✓ Attendance already marked today — editing existing records
          </div>
        )}

        {/* Quick mark all */}
        {students.length > 0 && !loadingStudents && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => markAll('present')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#D1FAE5', color: '#065F46', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>All Present</button>
            <button onClick={() => markAll('absent')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>All Absent</button>
          </div>
        )}

        {/* Summary */}
        {students.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Present', count: presentCount, color: '#065F46', bg: '#D1FAE5' },
              { label: 'Absent', count: absentCount, color: '#B91C1C', bg: '#FEE2E2' },
              { label: 'Late', count: lateCount, color: '#A16207', bg: '#FEF9C3' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Student list */}
        {loadingStudents ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Loading students…</div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>No students found for this class.</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 16 }}>
            {students.map((s, i) => {
              const st = STATUS_STYLE[s.status ?? 'present'];
              return (
                <div key={s.id}
                  onClick={() => toggleStatus(s.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < students.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#4F46E5', flexShrink: 0 }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.name}</div>
                      {s.roll_number && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Roll {s.roll_number}</div>}
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: st.color, flexShrink: 0 }}>
                    {st.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save button */}
        {students.length > 0 && (
          <button onClick={save} disabled={saving}
            style={{ width: '100%', height: 50, borderRadius: 12, border: 'none', background: saved ? '#16A34A' : saving ? '#818CF8' : '#4F46E5', color: '#fff', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 20, fontFamily: 'inherit' }}>
            {saved ? '✓ Attendance Saved' : saving ? 'Saving…' : `Save Attendance (${students.length} students)`}
          </button>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
