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

const QUICK_ACTIONS = [
  { href: '/teacher/check-in', icon: '📍', label: 'Check In',   sub: 'Mark yourself present',     bg: '#EEF2FF', color: '#4F46E5' },
  { href: '/teacher/attendance', icon: '✅', label: 'Attendance', sub: 'Mark student attendance', bg: '#F0FDF4', color: '#16A34A' },
  { href: '/teacher/marks',      icon: '📊', label: 'Marks',      sub: 'Enter student marks',      bg: '#FFFBEB', color: '#D97706' },
  { href: '/teacher/homework',   icon: '📚', label: 'Homework',   sub: 'Assign and grade',         bg: '#FDF4FF', color: '#9333EA' },
  { href: '/teacher/lesson-plans', icon: '📄', label: 'Plans',   sub: 'Plan and track',            bg: '#F0F9FF', color: '#0284C7' },
  { href: '/teacher/leave',      icon: '📅', label: 'Leave',      sub: 'Request and view status',  bg: '#FFF7ED', color: '#EA580C' },
];

export default function TeacherPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); }, 6000);
    fetch('/api/teacher/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: '0 0 8px' }}>
      <style>{`
        .td-section { padding: 16px 16px 0; }
        .td-greeting { font-size: 20px; font-weight: 800; color: #111827; }
        .td-date { font-size: 13px; color: #6B7280; margin-top: 2px; }
        .td-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px; }
        .td-action {
          display: block; padding: 14px 12px; border-radius: 14px; text-decoration: none;
          background: #fff; border: 1px solid #F3F4F6;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .td-action-icon { font-size: 22px; margin-bottom: 6px; }
        .td-action-label { font-size: 14px; font-weight: 700; color: #111827; }
        .td-action-sub { font-size: 11px; color: #6B7280; margin-top: 2px; line-height: 1.3; }
        .td-card { margin: 0 16px 12px; background: #fff; border-radius: 14px; border: 1px solid #E5E7EB; overflow: hidden; }
        .td-card-header { padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 13px; font-weight: 700; color: #111827; }
        .td-card-body { padding: 12px 16px; font-size: 13px; color: #6B7280; }
        .td-empty { text-align: center; padding: 20px; font-size: 13px; color: #9CA3AF; }
        .td-stat { display: flex; gap: 10px; }
        .td-stat-item { flex: 1; background: #F9FAFB; border-radius: 10px; padding: 12px; text-align: center; }
        .td-stat-val { font-size: 22px; font-weight: 800; color: #4F46E5; }
        .td-stat-label { font-size: 11px; color: #6B7280; margin-top: 2px; }
        .td-leave-link { display: block; text-align: center; padding: 10px; font-size: 13px; font-weight: 600; color: #4F46E5; text-decoration: none; border-top: 1px solid #F3F4F6; }
        .skel { background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* Greeting */}
      <div className="td-section">
        <div className="td-greeting">
          {loading ? 'Loading…' : `Hi, ${data?.name?.split(' ')[0] ?? 'Teacher'} 👋`}
        </div>
        <div className="td-date">{today}</div>
      </div>

      {/* Quick actions grid */}
      <div className="td-actions">
        {QUICK_ACTIONS.map(a => (
          <Link key={a.href} href={a.href} className="td-action">
            <div className="td-action-icon" style={{ background: a.bg, display: 'inline-block', padding: '6px 8px', borderRadius: 10 }}>{a.icon}</div>
            <div className="td-action-label">{a.label}</div>
            <div className="td-action-sub">{a.sub}</div>
          </Link>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="td-card">
        <div className="td-card-header">📅 Today&apos;s Schedule</div>
        {loading ? (
          <div className="td-card-body"><div className="skel" style={{ height: 40 }} /></div>
        ) : (data?.schedule?.length ?? 0) > 0 ? (
          data!.schedule.map((s, i) => (
            <div key={i} style={{ padding: '10px 16px', borderBottom: i < data!.schedule.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Class {s.class} — {s.subject}</div>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{s.time}</div>
            </div>
          ))
        ) : (
          <div className="td-empty">No classes scheduled today.</div>
        )}
      </div>

      {/* Leave summary */}
      <div className="td-card">
        <div className="td-card-header">📅 Leave Requests</div>
        <div className="td-card-body">
          <div className="td-stat">
            <div className="td-stat-item">
              <div className="td-stat-val" style={{ color: '#D97706' }}>{loading ? '—' : (data?.leave_pending ?? 0)}</div>
              <div className="td-stat-label">Pending</div>
            </div>
            <div className="td-stat-item">
              <div className="td-stat-val" style={{ color: '#16A34A' }}>{loading ? '—' : (data?.leave_approved ?? 0)}</div>
              <div className="td-stat-label">Approved</div>
            </div>
          </div>
        </div>
        <Link href="/teacher/leave" className="td-leave-link">Request leave →</Link>
      </div>
    </div>
  );
}
