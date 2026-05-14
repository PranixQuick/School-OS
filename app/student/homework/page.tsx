'use client';
// app/student/homework/page.tsx
// Batch 4D — Homework list: tabs Pending | Submitted | All.

import { useState, useEffect, useCallback } from 'react';

interface HomeworkItem { id: string; title: string; description: string; due_date: string; subject_name: string; submission_status: string | null; marks_obtained: number | null; teacher_remarks: string | null; is_overdue: boolean; }
type HWStatus = 'pending' | 'submitted' | 'all';

const STATUS_LABEL: Record<string, [string,string]> = {
  null: ['#F3F4F6','#6B7280'],
  pending: ['#FEF9C3','#92400E'],
  submitted: ['#D1FAE5','#065F46'],
  graded: ['#DBEAFE','#1E40AF'],
  late: ['#FEE2E2','#991B1B'],
};

export default function HomeworkPage() {
  const [tab, setTab] = useState<HWStatus>('pending');
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/student/homework?status=${tab}`);
    const d = await res.json() as { homework?: HomeworkItem[] };
    setItems(d.homework ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 10 };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 14 }}>📚 Homework</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['pending','submitted','all'] as HWStatus[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '5px 14px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: tab===t ? '#4F46E5' : '#fff', color: tab===t ? '#fff' : '#374151', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#9CA3AF', fontSize: 13, padding: 20 }}>Loading…</div>
      : items.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 30 }}>
          {tab === 'pending' ? '🎉 No pending homework!' : 'No homework found.'}
        </div>
      ) : (
        items.map(h => {
          const [bg, fg] = STATUS_LABEL[h.submission_status ?? 'null'] ?? ['#F3F4F6','#6B7280'];
          const dueToday = h.due_date === new Date().toISOString().slice(0,10);
          return (
            <div key={h.id} style={{ ...cardStyle, borderLeft: h.is_overdue ? '3px solid #DC2626' : dueToday ? '3px solid #F59E0B' : '3px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{h.subject_name}</div>
                  {h.description && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 1.4 }}>{h.description}</div>}
                </div>
                <span style={{ background: bg, color: fg, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>
                  {h.submission_status ?? 'not submitted'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: '#9CA3AF', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: h.is_overdue ? '#DC2626' : dueToday ? '#D97706' : '#6B7280' }}>
                  Due: {h.due_date}{h.is_overdue ? ' (overdue)' : dueToday ? ' (today!)' : ''}
                </span>
                {h.marks_obtained != null && <span style={{ color: '#4F46E5', fontWeight: 600 }}>Marks: {h.marks_obtained}</span>}
              </div>
              {h.teacher_remarks && (
                <div style={{ marginTop: 6, padding: '5px 8px', background: '#F0FDF4', borderRadius: 5, fontSize: 11, color: '#065F46' }}>
                  Teacher: {h.teacher_remarks}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
