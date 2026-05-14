'use client';
// app/teacher/page.tsx
// Batch 10 — Teacher dashboard homepage. Replaces the 1.6KB stub.
// Inherits layout from app/teacher/layout.tsx (no Layout import needed).
// Fetches today's timetable, recent homework, leave status.

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TimetableSlot { id: string; start_time: string; end_time: string; subject_name: string; class_grade: string; class_section: string; }
interface HomeworkItem { id: string; title: string; subject: string; due_date: string; }
interface LeaveCount { pending: number; approved: number; }

const QUICK_ACTIONS = [
  { href: '/teacher/checkin',      label: '📍 Check In',       desc: 'Mark yourself present' },
  { href: '/teacher/attendance',   label: '✓ Attendance',      desc: 'Mark student attendance' },
  { href: '/teacher/marks',        label: '📊 Marks',          desc: 'Enter student marks' },
  { href: '/teacher/homework',     label: '📖 Homework',       desc: 'Assign and grade' },
  { href: '/teacher/lesson-plans', label: '📄 Lesson Plans',   desc: 'Plan and track' },
  { href: '/teacher/leave',        label: '🗓 Leave',          desc: 'Request and view status' },
  { href: '/teacher/proofs',       label: '📷 Proofs',         desc: 'Capture classroom proofs' },
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function TeacherDashboard() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const todayStr = today.toISOString().slice(0, 10);

  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [leave, setLeave] = useState<LeaveCount>({ pending: 0, approved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ttRes, hwRes, lvRes] = await Promise.allSettled([
          fetch(`/api/teacher/timetable?day_of_week=${dayOfWeek}`),
          fetch('/api/teacher/homework'),
          fetch('/api/teacher/leave'),
        ]);

        if (ttRes.status === 'fulfilled' && ttRes.value.ok) {
          const d = await ttRes.value.json() as { slots?: TimetableSlot[] };
          setTimetable(d.slots ?? []);
        }
        if (hwRes.status === 'fulfilled' && hwRes.value.ok) {
          const d = await hwRes.value.json() as { homework?: HomeworkItem[] };
          // Show today's or recent homework
          const hw = (d.homework ?? []).slice(0, 5);
          setHomework(hw);
        }
        if (lvRes.status === 'fulfilled' && lvRes.value.ok) {
          const d = await lvRes.value.json() as { requests?: { status: string }[] };
          const reqs = d.requests ?? [];
          setLeave({
            pending: reqs.filter(r => r.status === 'pending').length,
            approved: reqs.filter(r => r.status === 'approved').length,
          });
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    void fetchAll();
  }, [dayOfWeek]);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Date header */}
      <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          {DAY_NAMES[dayOfWeek]}, {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Quick actions grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 24 }}>
        {QUICK_ACTIONS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{a.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

        {/* Today's timetable */}
        <Card title={`📅 Today's Schedule — ${DAY_NAMES[dayOfWeek]}`}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div>
          ) : timetable.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>No classes scheduled today.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {timetable.map(slot => (
                <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#F9FAFB', borderRadius: 7 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{slot.subject_name}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>Grade {slot.class_grade}-{slot.class_section}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600 }}>
                    {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Homework */}
        <Card title="📖 Recent Homework">
          {loading ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div>
          ) : homework.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>No homework assigned recently.</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {homework.map(hw => (
                  <div key={hw.id} style={{ padding: '5px 8px', background: '#F9FAFB', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{hw.title}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{hw.subject} · Due {hw.due_date}</div>
                  </div>
                ))}
              </div>
              <Link href="/teacher/homework" style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600 }}>
                View all →
              </Link>
            </>
          )}
        </Card>

        {/* Leave status */}
        <Card title="🗓 Leave Requests">
          {loading ? (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', flex: 1, padding: 10, background: '#FEF3C7', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#92400E' }}>{leave.pending}</div>
                  <div style={{ fontSize: 10, color: '#92400E' }}>Pending</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: 10, background: '#D1FAE5', borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#065F46' }}>{leave.approved}</div>
                  <div style={{ fontSize: 10, color: '#065F46' }}>Approved</div>
                </div>
              </div>
              <Link href="/teacher/leave" style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600 }}>
                Request leave →
              </Link>
            </>
          )}
        </Card>

        {/* Attendance reminder */}
        <Card title="✓ Attendance">
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
            Mark attendance for {todayStr}
          </div>
          <Link href="/teacher/attendance" style={{ display: 'inline-block', padding: '6px 14px', background: '#4F46E5', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Mark Now →
          </Link>
        </Card>

      </div>
    </div>
  );
}
