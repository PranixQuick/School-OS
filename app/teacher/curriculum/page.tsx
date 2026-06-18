'use client';
// app/teacher/curriculum/page.tsx
// P1.4 (#4) — Read-only curriculum reference for teachers.
// Grade selector + topics grouped by subject. No writes.

import { useState, useEffect } from 'react';

interface Topic { id: string; topic: string; sequence_order: number; expected_hours: number | null }
interface Group { subject: string; topics: Topic[] }
interface GradeBlock { grade_level: string; groups: Group[] }

export default function TeacherCurriculumPage() {
  const [grades, setGrades] = useState<GradeBlock[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teacher/curriculum')
      .then(r => r.ok ? r.json() : { grades: [] })
      .then((d: { grades?: GradeBlock[] }) => {
        const g = d.grades ?? [];
        setGrades(g);
        if (g.length > 0) setSelected(g[0].grade_level);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const current = grades.find(g => g.grade_level === selected) ?? null;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 12 }}>📖 Curriculum</div>

      {loading ? (
        <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
      ) : grades.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 20 }}>No curriculum topics found.</div>
        </div>
      ) : (
        <>
          {/* Grade selector */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
            {grades.map(g => (
              <button key={g.grade_level} onClick={() => setSelected(g.grade_level)}
                style={{ whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: 20, border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: selected === g.grade_level ? '#4F46E5' : '#fff', color: selected === g.grade_level ? '#fff' : '#374151' }}>
                {g.grade_level}
              </button>
            ))}
          </div>

          {current && current.groups.map(grp => (
            <div key={grp.subject} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 10 }}>{grp.subject}</div>
              {grp.topics.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < grp.topics.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 22, textAlign: 'right' }}>{i + 1}.</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{t.topic}</div>
                    {t.expected_hours != null && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{t.expected_hours} hrs</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
