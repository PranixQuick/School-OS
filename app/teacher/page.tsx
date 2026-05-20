'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { T, LANG_LABELS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface DashData {
  name: string; school_name: string; today_day: string;
  schedule: { time: string; class: string; subject: string }[];
  recent_homework: { title: string; class: string; due: string }[];
  leave_pending: number; leave_approved: number;
  students_count: number; attendance_today: number | null;
}

const LANG_SHORT: Partial<Record<Lang, string>> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', mr: 'म', ml: 'മ',
};
const LANG_ORDER: Lang[] = ['te', 'en', 'hi', 'ta', 'kn', 'mr', 'ml'];

export default function TeacherPage() {
  const { lang, setLang } = useLang();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';

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
        .lang-btn{background:rgba(255,255,255,0.18);border:none;color:#fff;padding:5px 10px;border-radius:7px;font-size:13px;cursor:pointer;font-weight:600;font-family:inherit;min-height:34px;min-width:34px}
        .lang-btn.active{background:rgba(255,255,255,0.92);color:#4F46E5}
      `}</style>

      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '16px 16px 24px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
          {data?.school_name ?? ''}
        </div>

        {/* Language selector strip */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {LANG_ORDER.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`lang-btn${lang === l ? ' active' : ''}`}
              title={LANG_LABELS[l]}
              aria-label={LANG_LABELS[l]}
            >
              {LANG_SHORT[l]}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
          {loading ? T('loading', lang as never) : `${T(greetingKey, lang as never)}, ${data?.name?.split(' ')[0] ?? ''} 👋`}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{today}</div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{loading ? '—' : scheduleCount}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{T('classes_today', lang as never)}</div>
          </div>
          <div style={{
            flex: 1,
            background: hasUnmarkedAttendance && scheduleCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '10px 12px', textAlign: 'center',
            border: hasUnmarkedAttendance && scheduleCount > 0 ? '1px solid rgba(239,68,68,0.5)' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{loading ? '—' : (data?.attendance_today ?? '✓')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
              {hasUnmarkedAttendance ? T('not_marked', lang as never) : T('marked_today', lang as never)}
            </div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{loading ? '—' : (data?.leave_pending ?? 0)}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{T('leave_pending_label', lang as never)}</div>
          </div>
        </div>
      </div>

      {/* Attendance alert */}
      {!loading && hasUnmarkedAttendance && scheduleCount > 0 && (
        <div style={{ margin: '12px 16px 0', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>⚠️ {T('attendance_not_marked', lang as never)}</div>
          <Link href="/teacher/attendance"
            style={{ padding: '8px 14px', background: '#B91C1C', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            {T('mark_now', lang as never)}
          </Link>
        </div>
      )}

      <div style={{ padding: '16px 16px 0' }}>
        {/* Quick actions */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          {T('quick_actions', lang as never)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { href: '/teacher/attendance',  icon: '✅', labelKey: 'attendance',   subKey: 'attendance', bg: '#F0FDF4', color: '#16A34A', alert: hasUnmarkedAttendance && scheduleCount > 0 },
            { href: '/teacher/marks',       icon: '📊', labelKey: 'marks',        subKey: 'reports',    bg: '#FFFBEB', color: '#D97706', alert: false },
            { href: '/teacher/homework',    icon: '📚', labelKey: 'homework',     subKey: 'homework',   bg: '#FDF4FF', color: '#9333EA', alert: false },
            { href: '/teacher/lesson-plans',icon: '📄', labelKey: 'lesson_plans', subKey: 'timetable',  bg: '#F0F9FF', color: '#0284C7', alert: false },
            { href: '/teacher/check-in',    icon: '📍', labelKey: 'check_in',     subKey: 'check_in',   bg: '#EEF2FF', color: '#4F46E5', alert: false },
            { href: '/teacher/leave',       icon: '📅', labelKey: 'leave',        subKey: 'leave',      bg: '#FFF7ED', color: '#EA580C', alert: (data?.leave_pending ?? 0) > 0 },
          ].map(a => (
            <Link key={a.href} href={a.href} className="t-action">
              {a.alert && <div className="t-badge">!</div>}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{T(a.labelKey, lang as never)}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>
                {a.labelKey === 'leave' ? `${data?.leave_pending ?? 0} ${T('pending', lang as never)}` : T(a.subKey, lang as never)}
              </div>
            </Link>
          ))}
        </div>

        {/* Today's schedule */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          {T('todays_schedule', lang as never)}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          {loading ? (
            <div style={{ padding: 16 }}><div className="skel" style={{ height: 40 }} /></div>
          ) : scheduleCount > 0 ? (
            data!.schedule.map((s, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i < data!.schedule.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {T('class_', lang as never)} {s.class} — {s.subject}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', background: '#F9FAFB', padding: '4px 10px', borderRadius: 6 }}>{s.time}</div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 14 }}>
              {T('no_classes_today', lang as never)}
            </div>
          )}
        </div>

        {/* Recent homework */}
        {(data?.recent_homework?.length ?? 0) > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
              {T('recent_homework_label', lang as never)}
            </div>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              {data!.recent_homework.slice(0, 3).map((h, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: i < 2 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{h.title}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{T('class_', lang as never)} {h.class}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', padding: '4px 10px', borderRadius: 6 }}>
                    {T('due_date', lang as never)}: {h.due}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
