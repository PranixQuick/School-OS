'use client';
// app/parent/curriculum/page.tsx
// P1.4 (#4) — Read-only syllabus view for parents.
// Lists the child's curriculum_topics grouped by subject. No writes.

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Topic { id: string; topic: string; sequence_order: number; expected_hours: number | null }
interface Group { subject: string; subject_code: string; topics: Topic[] }

export default function ParentCurriculumPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [gradeLevel, setGradeLevel] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parent/curriculum')
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => { setGroups(d.groups ?? []); setGradeLevel(d.grade_level ?? ''); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <Link href="/parent" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 8 }}>← Back</Link>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Syllabus</div>
        {total > 0 && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{gradeLevel} · {total} topic{total === 1 ? '' : 's'}</div>
        )}
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
            <div style={{ fontWeight: 700, color: '#374151' }}>No syllabus published yet.</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Please check back later.</div>
          </div>
        ) : groups.map(g => (
          <div key={g.subject} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 10 }}>{g.subject}</div>
            {g.topics.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < g.topics.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
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
      </div>
    </div>
  );
}
