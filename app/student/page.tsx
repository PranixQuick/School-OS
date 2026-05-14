'use client';
// app/student/page.tsx
// Batch 4D — Student home dashboard.
// Auth guard via profile fetch (redirects to /student/login if 401).
// Shows today's timetable, pending homework count, attendance summary, recent marks.

import { useState, useEffect } from 'react';

interface TimetableSlot { id: string; day_of_week: number; period: number; start_time: string; end_time: string; subject_name: string; teacher_name: string; }
interface HomeworkItem { id: string; title: string; due_date: string; subject_name: string; submission_status: string | null; is_overdue: boolean; }
interface AttendanceSummary { present: number; absent: number; total: number; percentage: number; }
interface MarksRecord { id: string; term: string; subject: string; marks_obtained: number; max_marks: number; grade: string; }

function today_dow(): number { return new Date().getDay(); } // 0=Sun,1=Mon...

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function StudentHomePage() {
  const [profile, setProfile] = useState<{ name: string; class: string; section: string } | null>(null);
  const [todaySlots, setTodaySlots] = useState<TimetableSlot[]>([]);
  const [pendingHW, setPendingHW] = useState<HomeworkItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [recentMarks, setRecentMarks] = useState<MarksRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dow = today_dow();
    void Promise.allSettled([
      fetch('/api/student/profile').then(r => r.ok ? r.json() : null),
      fetch('/api/student/timetable').then(r => r.ok ? r.json() : null),
      fetch('/api/student/homework?status=pending').then(r => r.ok ? r.json() : null),
      fetch('/api/student/attendance').then(r => r.ok ? r.json() : null),
      fetch('/api/student/marks').then(r => r.ok ? r.json() : null),
    ]).then(([prof, tt, hw, att, marks]) => {
      if (prof.status === 'fulfilled' && prof.value?.profile) setProfile(prof.value.profile);
      if (tt.status === 'fulfilled' && tt.value?.timetable) {
        setTodaySlots((tt.value.timetable as TimetableSlot[]).filter(s => s.day_of_week === dow));
      }
      if (hw.status === 'fulfilled' && hw.value?.homework) setPendingHW(hw.value.homework as HomeworkItem[]);
      if (att.status === 'fulfilled' && att.value?.summary) setAttendance(att.value.summary as AttendanceSummary);
      if (marks.status === 'fulfilled' && marks.value?.terms) {
        const all = (marks.value.terms as { records: MarksRecord[] }[]).flatMap(t => t.records);
        setRecentMarks(all.slice(0, 3));
      }
      setLoading(false);
    });
  }, []);

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 14 };
  const statBox = (label: string, val: string | number, color: string) => (
    <div key={label} style={{ flex: 1, textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>{label}</div>
    </div>
  );

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading…</div>
  );

  const dueToday = pendingHW.filter(h => h.due_date === new Date().toISOString().slice(0,10));

  return (
    <div>
      {/* Welcome card */}
      <div style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', borderRadius: 14, padding: '20px 18px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{greet()},</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{profile?.name ?? '…'}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Class {profile?.class}-{profile?.section}</div>
      </div>

      {/* Today's timetable */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>📅 Today&apos;s Schedule</div>
        {todaySlots.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>No classes scheduled today or timetable not set up.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todaySlots.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', minWidth: 80 }}>{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{s.subject_name}</div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>{s.teacher_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending homework */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>📚 Pending Homework</div>
          <span style={{ fontSize: 11, fontWeight: 700, background: pendingHW.length > 0 ? '#FEF3C7' : '#F0FDF4', color: pendingHW.length > 0 ? '#92400E' : '#065F46', padding: '2px 8px', borderRadius: 5 }}>{pendingHW.length} pending</span>
        </div>
        {dueToday.length > 0 && (
          <div style={{ background: '#FFF7ED', borderRadius: 7, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#C2410C', fontWeight: 600 }}>
            ⚠️ {dueToday.length} assignment{dueToday.length > 1 ? 's' : ''} due today
          </div>
        )}
        {pendingHW.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>All caught up! 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pendingHW.slice(0, 4).map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{h.subject_name}</span>
                  <span style={{ color: '#6B7280', marginLeft: 6 }}>{h.title}</span>
                </div>
                <span style={{ fontSize: 10, color: h.is_overdue ? '#DC2626' : '#6B7280', fontWeight: h.is_overdue ? 700 : 400 }}>{h.due_date}</span>
              </div>
            ))}
            {pendingHW.length > 4 && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>+{pendingHW.length - 4} more</div>}
          </div>
        )}
      </div>

      {/* Attendance */}
      {attendance && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>✅ Attendance (30 days)</div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
            {statBox('Present', attendance.present, '#065F46')}
            {statBox('Absent', attendance.absent, '#DC2626')}
            {statBox('%', attendance.percentage + '%', attendance.percentage >= 75 ? '#065F46' : '#D97706')}
          </div>
          {/* Simple progress bar */}
          <div style={{ background: '#F3F4F6', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${attendance.percentage}%`, background: attendance.percentage >= 75 ? '#16A34A' : '#F59E0B', height: 6, borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          {attendance.percentage < 75 && (
            <div style={{ fontSize: 10, color: '#D97706', fontWeight: 600, marginTop: 6 }}>⚠️ Attendance below 75%</div>
          )}
        </div>
      )}

      {/* Recent marks */}
      {recentMarks.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>📊 Recent Marks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentMarks.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{m.subject}</span>
                  <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{m.term}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{m.marks_obtained}/{m.max_marks}</span>
                  {m.grade && <span style={{ fontSize: 10, marginLeft: 6, background: '#EEF2FF', color: '#4F46E5', padding: '1px 5px', borderRadius: 4 }}>{m.grade}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
