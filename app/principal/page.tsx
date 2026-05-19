'use client';

// PATH: app/principal/page.tsx
// Principal Dashboard — real-time decision-focused view.
// Modernized: AI briefing now shows structured card when credits unavailable.
// Mobile-first section hierarchy.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface AttData { today_pct: number | null; today_present: number; today_total: number; today_marked: boolean; month_avg_pct: number; status: string; }
interface FeeData { pending_amount: number; pending_students: number; overdue_count: number; collected_month: number; collection_pct: number; status: string; }
interface RiskCase { name: string; class: string; risk_level: string; summary: string; }
interface RiskData { critical: number; high: number; medium: number; total: number; top_cases: RiskCase[]; }
interface AdmissionsData { total_30d: number; new: number; contacted: number; visit_scheduled: number; high_priority: number; admitted_month: number; conversion_rate: number; }
interface TeacherData { present_today: number; total_tracked: number; absent_today: string[]; avg_eval_score: number | null; evals_this_week: number; status: string; }
interface Event { title: string; event_date: string; is_holiday: boolean; }
interface Briefing { briefing_text: string; generated_at: string; }

interface ExtraKPIs {
  pending_leave_count: number;
  proofs_to_review_count: number;
  comm_last_24h_count: number;
}

interface AdmissionsStatusGroup { status: string; count: number; avg_score: number; oldest_age_days: number; high_priority: number; }
interface AdmissionsInquiry { id: string; parent_name: string | null; child_name: string | null; priority: string | null; status: string | null; score: number | null; age_days: number; }
interface OverdueFee { id: string; student_name: string; class_label: string; amount: number; fee_type: string | null; status: string; due_date: string; days_past_due: number; intervention_status: string | null; intervention_notes: string | null; }
interface LeaveItem { id: string; staff_name: string; leave_type: string; from_date: string; to_date: string; reason: string | null; }
interface ProofItem { id: string; staff_name: string; class_label: string; taken_at: string; signed_url: string | null; }
interface CommGroup { module: string; total: number; last_24h: number; }

interface DashboardData {
  as_of: string;
  today: string;
  attendance: AttData;
  fees: FeeData;
  risk: RiskData;
  admissions: AdmissionsData;
  teachers: TeacherData;
  upcoming_events: Event[];
  briefing: Briefing | null;
}

const STATUS_COLOR = {
  good:    { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
  warning: { bg: '#FEF9C3', color: '#A16207', dot: '#F59E0B' },
  critical:{ bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' },
  not_marked:{ bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
};
const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: '#B91C1C' },
  high:     { bg: '#FEF3C7', color: '#D97706' },
  medium:   { bg: '#EFF6FF', color: '#2563EB' },
};

export default function PrincipalPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [extras, setExtras] = useState<ExtraKPIs | null>(null);
  const [admissionsDetail, setAdmissionsDetail] = useState<{ status_groups: AdmissionsStatusGroup[]; top_inquiries: AdmissionsInquiry[] } | null>(null);
  const [overdueDetail, setOverdueDetail] = useState<OverdueFee[] | null>(null);
  const [leaveDetail, setLeaveDetail] = useState<LeaveItem[] | null>(null);
  const [proofsDetail, setProofsDetail] = useState<ProofItem[] | null>(null);
  const [commDetail, setCommDetail] = useState<CommGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10000);
    fetch('/api/principal/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setData(d);
          if (d.briefing === null) setAiUnavailable(true);
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!data) return;
    // Load extras in background
    Promise.allSettled([
      fetch('/api/principal/extras').then(r => r.ok ? r.json() : null),
    ]).then(([ex]) => {
      if (ex.status === 'fulfilled' && ex.value) setExtras(ex.value);
    });
  }, [data]);

  if (loading && !data) {
    return (
      <Layout title="Principal Dashboard" subtitle={today}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 88, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        <div style={{ height: 160, borderRadius: 12, background: '#F3F4F6', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </Layout>
    );
  }

  if (!data) return <Layout title="Principal Dashboard" subtitle={today}><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Dashboard unavailable. Please try again.</div></Layout>;

  const att = data.attendance;
  const fee = data.fees;
  const risk = data.risk;
  const teachers = data.teachers;
  const admissions = data.admissions;
  const attStatus = STATUS_COLOR[att.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.not_marked;
  const feeStatus = STATUS_COLOR[fee.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.warning;

  return (
    <Layout title="Principal Dashboard" subtitle={today}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .kpi2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
        @media(min-width:640px){.kpi2{grid-template-columns:repeat(4,1fr)}}
        .section-cards{display:grid;grid-template-columns:1fr;gap:14px}
        @media(min-width:768px){.section-cards{grid-template-columns:1fr 1fr}}
        .kpi-chip{background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:14px 16px}
      `}</style>

      {/* AI Briefing Card */}
      <div style={{ marginBottom: 20, background: aiUnavailable ? '#F9FAFB' : '#1E1B4B', borderRadius: 16, padding: '18px 20px', border: aiUnavailable ? '1px dashed #E5E7EB' : 'none' }}>
        {aiUnavailable ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>AI Daily Briefing</div>
              <div style={{ padding: '2px 8px', background: '#FEF3C7', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#92400E' }}>UNAVAILABLE</div>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              AI briefings require Anthropic API credits. Your school data is shown below — add Anthropic credits to enable automated intelligence summaries.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E0E7FF' }}>AI Briefing</div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {data.briefing?.generated_at ? new Date(data.briefing.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxHeight: briefingExpanded ? 'none' : 120, overflow: 'hidden' }}>
              {data.briefing?.briefing_text}
            </div>
            {(data.briefing?.briefing_text?.length ?? 0) > 300 && (
              <button onClick={() => setBriefingExpanded(!briefingExpanded)}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#A5B4FC', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                {briefingExpanded ? 'Show less ↑' : 'Read full briefing ↓'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="kpi2">
        {[
          {
            label: 'Attendance Today',
            value: att.today_marked ? `${Math.round(att.today_pct ?? 0)}%` : 'Not marked',
            sub: att.today_marked ? `${att.today_present}/${att.today_total} present` : 'No data yet',
            ...attStatus, href: '/students',
          },
          {
            label: 'Fees Pending',
            value: `₹${(fee.pending_amount / 1000).toFixed(1)}K`,
            sub: `${fee.pending_students} students · ${fee.overdue_count} overdue`,
            ...feeStatus, href: '/admin/fees',
          },
          {
            label: 'At-Risk Students',
            value: risk.total,
            sub: `${risk.critical} critical · ${risk.high} high`,
            bg: risk.critical > 0 ? '#FEE2E2' : '#FEF9C3',
            color: risk.critical > 0 ? '#B91C1C' : '#A16207',
            dot: risk.critical > 0 ? '#EF4444' : '#F59E0B',
            href: '/students',
          },
          {
            label: 'Teachers Present',
            value: teachers.total_tracked > 0 ? `${teachers.present_today}/${teachers.total_tracked}` : 'N/A',
            sub: teachers.absent_today.length > 0 ? `Absent: ${teachers.absent_today.slice(0,2).join(', ')}${teachers.absent_today.length > 2 ? '…' : ''}` : 'All present',
            bg: teachers.absent_today.length > 0 ? '#FEF9C3' : '#DCFCE7',
            color: teachers.absent_today.length > 0 ? '#A16207' : '#15803D',
            dot: teachers.absent_today.length > 0 ? '#F59E0B' : '#22C55E',
            href: '/admin/staff',
          },
        ].map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
            <div className="kpi-chip" style={{ borderLeft: `3px solid ${k.dot}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginBottom: 3 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Risk cases */}
      {risk.total > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>⚠️ At-Risk Students</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{risk.total} flagged</div>
          </div>
          {risk.top_cases.slice(0, 5).map((c, i) => {
            const rc = RISK_COLORS[c.risk_level] ?? RISK_COLORS.medium;
            return (
              <div key={i} style={{ padding: '11px 16px', borderBottom: i < Math.min(4, risk.top_cases.length - 1) ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Class {c.class} · {c.summary?.slice(0, 60) ?? ''}</div>
                </div>
                <div style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: rc.bg, color: rc.color, flexShrink: 0, marginLeft: 10 }}>
                  {c.risk_level.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming events */}
      {data.upcoming_events.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>📅 Upcoming Events</div>
          </div>
          {data.upcoming_events.slice(0, 5).map((ev, i) => {
            const d = new Date(ev.event_date);
            return (
              <div key={i} style={{ padding: '10px 16px', borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: ev.is_holiday ? '#FEF9C3' : '#EEF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ev.is_holiday ? '#A16207' : '#4F46E5', lineHeight: 1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: ev.is_holiday ? '#A16207' : '#4F46E5', fontWeight: 600 }}>{d.toLocaleString('en-IN', { month: 'short' })}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.title}</div>
                {ev.is_holiday && <span style={{ fontSize: 10, background: '#FEF9C3', color: '#A16207', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>HOLIDAY</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { href: '/admin/broadcasts', icon: '📢', label: 'Send Broadcast', color: '#4F46E5' },
          { href: '/admin/fees', icon: '💰', label: 'View Fees', color: '#065F46' },
          { href: '/teacher-eval', icon: '🎙', label: 'Teacher Eval', color: '#7C3AED' },
          { href: '/admin/staff', icon: '👥', label: 'View Staff', color: '#0284C7' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
