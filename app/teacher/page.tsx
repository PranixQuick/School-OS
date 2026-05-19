'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashData {
  name: string; school_name: string; today_day: string;
  schedule: { time: string; class: string; subject: string }[];
  recent_homework: { title: string; class: string; due: string }[];
  leave_pending: number; leave_approved: number;
  students_count: number; attendance_today: number | null;
}

export default function TeacherPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); }, 6000);
    fetch('/api/teacher/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  const hasUnmarkedAttendance = data?.attendance_today === null || data?.attendance_today === 0;
  const scheduleCount = data?.schedule?.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 80 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}
        .t-action{display:block;padding:16px 12px;border-radius:14px;text-decoration:none;background:#fff;border:1px solid #F3F4F6;box-shadow:0 1px 3px rgba(0,0,0,0.06);position:relative;transition:transform 0.1s}
        .t-action:active{transform:scale(0.97)}
        .t-badge{position:absolute;top:8px;right:8px;background:#EF4444;color:#fff;border-radius:10px;font-size:10px;font-weight:800;padding:1px 6px;min-width:16px;text-align:center}
      `}</style>

      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '20px 16px 28px' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{data?.school_name ?? ''}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
          {loading ? 'Loading…' : `${greeting}, ${data?.name?.split(' ')[0] ?? 'Teacher'} 👋`}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{today}</div>

        {/* Today's stats strip */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{loading ? '—' : scheduleCount}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Classes today</div>
          </div>
          <div style={{ flex: 1, background: hasUnmarkedAttendance && scheduleCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: hasUnmarkedAttendance && scheduleCount > 0 ? '1px solid rgba(239,68,68,0.5)' : 'none' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{loading ? '—' : (data?.attendance_today ?? '✓')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{hasUnmarkedAttendance ? '⚠ Not marked' : 'Marked today'}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{loading ? '—' : (data?.leave_pending ?? 0)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Leave pending</div>
          </div>
        </div>
      </div>

      {/* Urgent attendance alert */}
      {!loading && hasUnmarkedAttendance && scheduleCount > 0 && (
        <div style={{ margin: '12px 16px 0', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>⚠️ Attendance not marked today</div>
          <Link href="/teacher/attendance" style={{ padding: '6px 12px', background: '#B91C1C', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Mark Now</Link>
        </div>
      )}

      <div style={{ padding: '16px 16px 0' }}>
        {/* Quick actions */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { href: '/teacher/attendance', icon: '✅', label: 'Attendance', sub: 'Mark student presence', bg: '#F0FDF4', color: '#16A34A', alert: hasUnmarkedAttendance && scheduleCount > 0 },
            { href: '/teacher/marks', icon: '📊', label: 'Marks', sub: 'Enter student marks', bg: '#FFFBEB', color: '#D97706', alert: false },
            { href: '/teacher/homework', icon: '📚', label: 'Homework', sub: 'Assign and review', bg: '#FDF4FF', color: '#9333EA', alert: false },
            { href: '/teacher/lesson-plans', icon: '📄', label: 'Lesson Plans', sub: 'Plan and track', bg: '#F0F9FF', color: '#0284C7', alert: false },
            { href: '/teacher/check-in', icon: '📍', label: 'Check In', sub: 'Mark yourself present', bg: '#EEF2FF', color: '#4F46E5', alert: false },
            { href: '/teacher/leave', icon: '📅', label: 'Leave', sub: `${data?.leave_pending ?? 0} pending`, bg: '#FFF7ED', color: '#EA580C', alert: (data?.leave_pending ?? 0) > 0 },
          ].map(a => (
            <Link key={a.href} href={a.href} className="t-action">
              {a.alert && <div className="t-badge">!</div>}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{a.sub}</div>
            </Link>
          ))}
        </div>

        {/* Today's schedule */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Today's Schedule</div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          {loading ? (
            <div style={{ padding: 16 }}><div className="skel" style={{ height: 40 }} /></div>
          ) : scheduleCount > 0 ? (
            data!.schedule.map((s, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i < data!.schedule.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Class {s.class} — {s.subject}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '3px 8px', borderRadius: 6 }}>{s.time}</div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>No classes scheduled today.</div>
          )}
        </div>

        {/* Recent homework */}
        {(data?.recent_homework?.length ?? 0) > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Recent Homework</div>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              {data!.recent_homework.slice(0, 3).map((h, i) => (
                <div key={i} style={{ padding: '11px 16px', borderBottom: i < 2 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Class {h.class}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', background: '#F9FAFB', padding: '3px 8px', borderRadius: 6 }}>Due {h.due}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
