'use client';
// Teacher Dashboard — "Today's Teaching Operations Cockpit"
// Role-native: shows ONLY what a teacher needs to act on today.
// Institution-aware: geo-attendance indicator for govt school teachers.
// Mobile-first, offline-tolerant, Telugu-primary support.
// Sections: urgent alerts → today's ops → student risks → VIDYA GRID intelligence → quick actions.
//
// Bible Phase 4e: added "Learning Intelligence (VIDYA GRID)" section that
// shows students flagged by VIDYA GRID for learning stagnation. Only renders
// when data exists — if no VIDYA GRID integration is active, nothing shows.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { T, LANG_LABELS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface ScheduleItem  { time: string; class: string; subject: string; period: number; }
interface HomeworkItem  { id: string; title: string; class: string; due: string; submissions: number; total: number; }
interface LowAttStudent { name: string; class: string; pct: number; }
interface SubstituteAlert { class: string; period: string; original_teacher: string; }
interface DashData {
  name: string; school_name: string; school_mode?: string;
  schedule: ScheduleItem[];
  recent_homework: HomeworkItem[];
  leave_pending: number; leave_approved: number;
  students_count: number; attendance_today: number | null;
  low_att_students: LowAttStudent[];
  substitute_duties: SubstituteAlert[];
  health_alerts: number;
  meal_duty_today: boolean;
  exam_count_this_week: number;
  complaint_escalations: number;
  geo_required: boolean;
  geo_checked_in: boolean;
}

// Phase 4e: VIDYA GRID risk flag shape (from student_risk_flags WHERE source='vidya_grid')
interface VGRiskFlag {
  student_id: string;
  risk_level: string;
  risk_factors: string[];
  ai_summary: string;
  flagged_at: string;
  students?: { name: string; class: string } | { name: string; class: string }[];
}

const LANG_SHORT: Partial<Record<Lang, string>> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', mr: 'म', ml: 'മ',
};
const LANG_ORDER: Lang[] = ['te', 'en', 'hi', 'ta', 'kn', 'mr', 'ml'];

export default function TeacherPage() {
  const { lang, setLang } = useLang();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  // Phase 4e: VIDYA GRID learning intelligence data
  const [vgFlags, setVgFlags] = useState<VGRiskFlag[]>([]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';

  const load = useCallback(() => {
    const t = setTimeout(() => setLoading(false), 7000);
    fetch('/api/teacher/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as DashData); })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Phase 4e: fetch VIDYA GRID risk flags for the teacher's school.
  // Uses the student_risk_flags table with source='vidya_grid'.
  // Best-effort: if the API doesn't exist or returns empty, the section
  // simply doesn't render. No error state needed.
  useEffect(() => {
    fetch('/api/teacher/vidya-grid-flags')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d.flags) && d.flags.length > 0) {
          setVgFlags(d.flags as VGRiskFlag[]);
        }
      })
      .catch(() => {});
  }, []);

  const hasUnmarkedAtt  = data?.attendance_today === null || data?.attendance_today === 0;
  const scheduleCount   = data?.schedule?.length ?? 0;
  const isGovt          = data?.school_mode === 'govt_high_school' || data?.school_mode === 'govt_primary';
  const needsGeoCheckin = isGovt && data?.geo_required && !data?.geo_checked_in;

  // Compute urgent alerts
  const alerts: { icon: string; text: string; href: string; sev: 'red'|'amber'|'blue' }[] = [];
  if (needsGeoCheckin)                    alerts.push({ icon: '📍', text: 'GPS Check-in required', href: '/teacher/check-in', sev: 'red' });
  if (hasUnmarkedAtt && scheduleCount > 0) alerts.push({ icon: '⚠️', text: 'Attendance not marked today', href: '/teacher/attendance', sev: 'red' });
  if ((data?.substitute_duties?.length ?? 0) > 0) alerts.push({ icon: '🔄', text: `${data!.substitute_duties.length} substitute class(es) assigned`, href: '/teacher/attendance', sev: 'amber' });
  if ((data?.health_alerts ?? 0) > 0)     alerts.push({ icon: '🏥', text: `${data!.health_alerts} health incident(s) need attention`, href: '/admin/health-incidents', sev: 'amber' });
  if ((data?.complaint_escalations ?? 0) > 0) alerts.push({ icon: '📩', text: `${data!.complaint_escalations} complaint escalation(s)`, href: '/admin/complaints', sev: 'amber' });
  if (data?.meal_duty_today)              alerts.push({ icon: '🍽️', text: 'Meal duty today — mark MDM attendance', href: '/teacher/meal-attendance', sev: 'blue' });
  if ((data?.exam_count_this_week ?? 0) > 0) alerts.push({ icon: '📝', text: `${data!.exam_count_this_week} exam(s) this week`, href: '/admin/assessments', sev: 'blue' });

  const SEV_STYLE = {
    red:   { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', btn: '#B91C1C' },
    amber: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C', btn: '#D97706' },
    blue:  { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', btn: '#4F46E5' },
  };

  // Phase 4e: resolve student name from the join result (Supabase returns
  // object or array depending on FK cardinality)
  function vgStudentName(flag: VGRiskFlag): string {
    if (!flag.students) return 'Unknown';
    if (Array.isArray(flag.students)) return flag.students[0]?.name ?? 'Unknown';
    return flag.students.name ?? 'Unknown';
  }
  function vgStudentClass(flag: VGRiskFlag): string {
    if (!flag.students) return '';
    if (Array.isArray(flag.students)) return flag.students[0]?.class ?? '';
    return flag.students.class ?? '';
  }

  const VG_RISK_COLOR: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#FEF2F2', text: '#B91C1C' },
    high:     { bg: '#FFF7ED', text: '#C2410C' },
    medium:   { bg: '#FFFBEB', text: '#A16207' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: 80 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .skel{background:#F3F4F6;border-radius:8px;animation:pulse 1.5s ease-in-out infinite}
        .t-action{display:block;padding:14px 12px;border-radius:13px;text-decoration:none;background:#fff;border:1px solid #F3F4F6;box-shadow:0 1px 3px rgba(0,0,0,0.06);position:relative}
        .t-badge{position:absolute;top:8px;right:8px;background:#EF4444;color:#fff;border-radius:10px;font-size:10px;font-weight:800;padding:1px 6px}
        .lang-btn{background:rgba(255,255,255,0.18);border:none;color:#fff;padding:5px 10px;border-radius:7px;font-size:12px;cursor:pointer;font-weight:600;font-family:inherit;min-height:32px}
        .lang-btn.active{background:rgba(255,255,255,0.92);color:#4F46E5}
        .alert-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid;margin-bottom:6px}
      `}</style>

      {/* Header */}
      <div style={{ background: '#4F46E5', padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{data?.school_name ?? ''}</div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          {LANG_ORDER.map(l => (
            <button key={l} onClick={() => setLang(l)} className={`lang-btn${lang === l ? ' active' : ''}`}>
              {LANG_SHORT[l]}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
          {loading ? '…' : `${T(greetingKey, lang as never)}, ${data?.name?.split(' ')[0] ?? ''} 👋`}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{today}</div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {[
            { v: loading ? '—' : scheduleCount,               l: 'Classes' },
            { v: loading ? '—' : (data?.attendance_today ?? '✓'), l: hasUnmarkedAtt ? '⚠ Unmark' : 'Marked' },
            { v: loading ? '—' : (data?.substitute_duties?.length ?? 0), l: 'Subs' },
            { v: loading ? '—' : (data?.leave_pending ?? 0),  l: 'Leave' },
          ].map(s => (
            <div key={s.l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 14px 0' }}>
        {/* URGENT ALERTS — institution and role aware */}
        {alerts.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚡ Needs Attention
            </div>
            {alerts.map((a, i) => {
              const st = SEV_STYLE[a.sev];
              return (
                <div key={i} className="alert-row" style={{ background: st.bg, borderColor: st.border }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: st.color }}>
                    {a.icon} {a.text}
                  </div>
                  <Link href={a.href} style={{ padding: '5px 12px', background: st.btn, color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                    Go →
                  </Link>
                </div>
              );
            })}
          </>
        )}

        {/* Today's schedule */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8, marginTop: 14 }}>
          {T('todays_schedule', lang as never)}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 13, overflow: 'hidden', marginBottom: 14 }}>
          {loading ? (
            <div style={{ padding: 16 }}><div className="skel" style={{ height: 40 }} /></div>
          ) : scheduleCount > 0 ? (
            data!.schedule.map((s, i) => (
              <div key={i} style={{ padding: '11px 14px', borderBottom: i < data!.schedule.length-1 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Class {s.class} — {s.subject}</div>
                  {data?.substitute_duties?.some(d => d.class === s.class) && (
                    <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>🔄 Substitute duty</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 6 }}>{s.time}</div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 14 }}>
              {T('no_classes_today', lang as never)}
            </div>
          )}
        </div>

        {/* Low attendance students */}
        {(data?.low_att_students?.length ?? 0) > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚠️ Low Attendance Students
            </div>
            <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 13, overflow: 'hidden', marginBottom: 14 }}>
              {data!.low_att_students.slice(0, 5).map((s, i) => (
                <div key={i} style={{ padding: '10px 14px', borderBottom: i < 4 ? '1px solid #FFF5F5' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Class {s.class}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: s.pct < 60 ? '#B91C1C' : '#D97706', background: s.pct < 60 ? '#FEF2F2' : '#FFF7ED', padding: '3px 10px', borderRadius: 8 }}>
                    {s.pct}%
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Phase 4e: Learning Intelligence (VIDYA GRID) — only renders when
            VIDYA GRID risk flags exist for students in this school. Graceful
            degradation: if the /api/teacher/vidya-grid-flags endpoint doesn't
            exist or returns empty, this section is hidden entirely. */}
        {vgFlags.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              🧠 Learning Intelligence (VIDYA GRID)
            </div>
            <div style={{ background: '#fff', border: '1px solid #C7D2FE', borderRadius: 13, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '10px 14px', background: '#EEF2FF', borderBottom: '1px solid #C7D2FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>
                  {vgFlags.length} student{vgFlags.length !== 1 ? 's' : ''} flagged for learning stagnation
                </div>
                <div style={{ fontSize: 10, color: '#6366F1', background: '#C7D2FE', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  VIDYA GRID
                </div>
              </div>
              {vgFlags.slice(0, 5).map((flag, i) => {
                const riskStyle = VG_RISK_COLOR[flag.risk_level] ?? VG_RISK_COLOR.medium;
                return (
                  <div key={flag.student_id} style={{ padding: '11px 14px', borderBottom: i < Math.min(vgFlags.length, 5) - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{vgStudentName(flag)}</span>
                        {vgStudentClass(flag) && (
                          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>Class {vgStudentClass(flag)}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: riskStyle.text, background: riskStyle.bg, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        {flag.risk_level}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>
                      {flag.ai_summary.length > 120 ? flag.ai_summary.slice(0, 120) + '…' : flag.ai_summary}
                    </div>
                  </div>
                );
              })}
              {vgFlags.length > 5 && (
                <div style={{ padding: '8px 14px', textAlign: 'center', fontSize: 12, color: '#4F46E5', fontWeight: 600 }}>
                  +{vgFlags.length - 5} more flagged students
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
          {T('quick_actions', lang as never)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
          {[
            { href: '/teacher/attendance',   icon: '✅', label: T('attendance', lang as never),    bg: '#F0FDF4', color: '#16A34A', alert: hasUnmarkedAtt && scheduleCount > 0 },
            { href: '/teacher/marks',        icon: '📊', label: T('marks', lang as never),         bg: '#FFFBEB', color: '#D97706', alert: false },
            { href: '/teacher/homework',     icon: '📚', label: T('homework', lang as never),      bg: '#FDF4FF', color: '#9333EA', alert: false },
            { href: '/teacher/lesson-plans', icon: '📄', label: T('lesson_plans', lang as never),  bg: '#F0F9FF', color: '#0284C7', alert: false },
            { href: '/teacher/check-in',     icon: '📍', label: T('check_in', lang as never),      bg: '#EEF2FF', color: '#4F46E5', alert: needsGeoCheckin },
            { href: '/teacher/leave',        icon: '📅', label: T('leave', lang as never),         bg: '#FFF7ED', color: '#EA580C', alert: (data?.leave_pending ?? 0) > 0 },
            { href: '/teacher/meal-attendance', icon: '🍽️', label: 'Meal Duty',                   bg: '#F0FDFA', color: '#0D9488', alert: !!data?.meal_duty_today },
            { href: '/teacher/marks',        icon: '📝', label: 'Exam Entry',                      bg: '#F5F3FF', color: '#7C3AED', alert: (data?.exam_count_this_week ?? 0) > 0 },
          ].map(a => (
            <Link key={a.href + a.label} href={a.href} className="t-action">
              {a.alert && <div className="t-badge">!</div>}
              <div style={{ width: 38, height: 38, borderRadius: 9, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{a.label}</div>
            </Link>
          ))}
        </div>

        {/* Recent homework */}
        {(data?.recent_homework?.length ?? 0) > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              {T('recent_homework_label', lang as never)}
            </div>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 13, overflow: 'hidden' }}>
              {data!.recent_homework.slice(0, 3).map((h, i) => (
                <div key={i} style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Class {h.class} · {h.submissions}/{h.total} submitted
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', background: '#F9FAFB', padding: '4px 8px', borderRadius: 6 }}>Due: {h.due}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
