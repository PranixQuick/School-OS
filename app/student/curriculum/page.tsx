'use client';
// app/student/curriculum/page.tsx
// P1.4 (#4) — Read-only syllabus view for students.
// Lists curriculum_topics for the student's grade, grouped by subject.
// No writes — purely a read-only stakeholder view.

import { useState, useEffect } from 'react';

interface Topic { id: string; topic: string; sequence_order: number; expected_hours: number | null }
interface Group { subject: string; subject_code: string; topics: Topic[] }

export default function StudentCurriculumPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [gradeLevel, setGradeLevel] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/student/curriculum')
      .then(r => r.ok ? r.json() : null)
      .then((d: { grade_level?: string; total?: number; groups?: Group[] } | null) => {
        setGroups(d?.groups ?? []);
        setGradeLevel(d?.grade_level ?? '');
        setTotal(d?.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading…</div>
  );

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>📖 Syllabus</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
        {total > 0 ? `${gradeLevel} · ${total} topic${total === 1 ? '' : 's'}` : 'Your course topics'}
      </div>

      {groups.length === 0 ? (
        <div style={cardStyle}>
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No syllabus published for your class yet. Please check back later.
          </div>
        </div>
      ) : groups.map(g => (
        <div key={g.subject} style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>{g.subject}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.topics.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < g.topics.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 22, textAlign: 'right' }}>{i + 1}.</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.topic}</div>
                  {t.expected_hours != null && (
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{t.expected_hours} hrs</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
