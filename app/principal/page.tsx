'use client';
// Principal Dashboard — "School Operations Command Center"
// Governance-aware: shows inst-type-specific alerts (DISE pending for govt, etc.)
// Mobile-first, role-native orchestration, not a generic admin panel.

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface AttData    { today_pct: number|null; today_present: number; today_total: number; today_marked: boolean; month_avg_pct: number; status: string; }
interface FeeData    { pending_amount: number; pending_students: number; overdue_count: number; collected_month: number; collection_pct: number; status: string; }
interface RiskCase   { name: string; class: string; risk_level: string; summary: string; }
interface RiskData   { critical: number; high: number; medium: number; total: number; top_cases: RiskCase[]; }
interface TeacherData{ present_today: number; total_tracked: number; absent_today: string[]; avg_eval_score: number|null; status: string; }
interface Event      { title: string; event_date: string; is_holiday: boolean; }
interface Briefing   { briefing_text: string; generated_at: string; }
interface DashboardData {
  as_of: string; today: string;
  attendance: AttData; fees: FeeData; risk: RiskData;
  teachers: TeacherData;
  upcoming_events: Event[];
  briefing: Briefing | null;
  school_mode?: string;
}
interface ExtraKPIs {
  pending_leave_count: number;
  proofs_to_review_count: number;
  sanitary_low_stock_count: number;
  open_complaints_count: number;
  transport_alert_count: number;
  govt_reporting_pending: boolean;
  compliance_score?: number;
}

const STATUS_COLOR = {
  good:      { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
  warning:   { bg: '#FEF9C3', color: '#A16207', dot: '#F59E0B' },
  critical:  { bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' },
  not_marked:{ bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' },
};
const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FEE2E2', color: '#B91C1C' },
  high:     { bg: '#FEF3C7', color: '#D97706' },
  medium:   { bg: '#EFF6FF', color: '#2563EB' },
};

export default function PrincipalPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [extras, setExtras]   = useState<ExtraKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const isGovt = data?.school_mode === 'govt_high_school' || data?.school_mode === 'govt_primary';

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10000);
    fetch('/api/principal/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setData(d); if (d.briefing === null) setAiUnavailable(true); }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); clearTimeout(t); });
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!data) return;
    fetch('/api/principal/extras')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExtras(d as ExtraKPIs); })
      .catch(() => {});
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
  if (!data) return <Layout title="Principal Dashboard" subtitle={today}><div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Dashboard unavailable.</div></Layout>;

  const att      = data.attendance;
  const fee      = data.fees;
  const risk     = data.risk;
  const teachers = data.teachers;
  const attSt    = STATUS_COLOR[att.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.not_marked;
  const feeSt    = STATUS_COLOR[fee.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.warning;

  // Operational alerts — institution and context aware
  const alerts: { icon: string; text: string; href: string; sev: 'red'|'amber'|'blue' }[] = [];
  if (teachers.absent_today.length > 0) alerts.push({ icon: '🧑‍🏫', text: `${teachers.absent_today.length} teacher(s) absent — substitute needed`, href: '/admin/staff', sev: 'red' });
  if ((extras?.open_complaints_count ?? 0) > 0) alerts.push({ icon: '📩', text: `${extras!.open_complaints_count} unresolved complaint(s)`, href: '/admin/complaints', sev: 'red' });
  if ((extras?.sanitary_low_stock_count ?? 0) > 0) alerts.push({ icon: '🧼', text: `${extras!.sanitary_low_stock_count} sanitary item(s) low on stock`, href: '/admin/sanitary-inventory', sev: 'amber' });
  if ((extras?.pending_leave_count ?? 0) > 0) alerts.push({ icon: '📅', text: `${extras!.pending_leave_count} leave request(s) pending approval`, href: '/principal/leave-approvals', sev: 'amber' });
  if ((extras?.transport_alert_count ?? 0) > 0) alerts.push({ icon: '🚌', text: `${extras!.transport_alert_count} transport alert(s)`, href: '/admin/transport', sev: 'amber' });
  if (isGovt && extras?.govt_reporting_pending) alerts.push({ icon: '📋', text: 'DISE/government reporting data pending verification', href: '/admin/dise-export', sev: 'amber' });
  if (risk.critical > 0) alerts.push({ icon: '⚠️', text: `${risk.critical} student(s) at critical attendance/fee risk`, href: '/students', sev: 'amber' });

  const SEV_STYLE = {
    red:   { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' },
    amber: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
    blue:  { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  };

  return (
    <Layout title="Principal Dashboard" subtitle={today}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .kpi2{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;margin-bottom:14px}
        @media(min-width:640px){.kpi2{grid-template-columns:repeat(4,1fr)}}
        .kpi-chip{background:#fff;border:1px solid #E5E7EB;border-radius:13px;padding:13px 14px;text-decoration:none;display:block}
        .kpi-chip:hover{background:#FAFAFA}
        .alert-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid;margin-bottom:6px}
      `}</style>

      {/* AI Briefing */}
      <div style={{ marginBottom: 16, background: aiUnavailable ? '#F9FAFB' : '#1E1B4B', borderRadius: 14, padding: '16px 18px', border: aiUnavailable ? '1px dashed #E5E7EB' : 'none' }}>
        {aiUnavailable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>AI Daily Briefing — Unavailable</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Add Anthropic credits to enable automated summaries</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E0E7FF' }}>AI Briefing</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
                {data.briefing?.generated_at ? new Date(data.briefing.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxHeight: briefingExpanded ? 'none' : 100, overflow: 'hidden' }}>
              {data.briefing?.briefing_text}
            </div>
            {(data.briefing?.briefing_text?.length ?? 0) > 250 && (
              <button onClick={() => setBriefingExpanded(!briefingExpanded)}
                style={{ marginTop: 6, background: 'none', border: 'none', color: '#A5B4FC', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                {briefingExpanded ? 'Less ↑' : 'Full briefing ↓'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* OPERATIONAL ALERTS */}
      {alerts.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            ⚡ Needs Your Attention ({alerts.length})
          </div>
          {alerts.map((a, i) => {
            const st = SEV_STYLE[a.sev];
            return (
              <Link key={i} href={a.href} className="alert-row" style={{ background: st.bg, borderColor: st.border, color: st.color, textDecoration: 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.icon} {a.text}</span>
                <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>→</span>
              </Link>
            );
          })}
          <div style={{ marginBottom: 14 }} />
        </>
      )}

      {/* KPI GRID */}
      <div className="kpi2">
        {[
          { label: 'Attendance', value: att.today_marked ? `${Math.round(att.today_pct ?? 0)}%` : '—', sub: `${att.today_present}/${att.today_total}`, ...attSt, href: '/students' },
          { label: 'Fees Pending', value: `₹${(fee.pending_amount/1000).toFixed(1)}K`, sub: `${fee.overdue_count} overdue`, ...feeSt, href: '/admin/fees' },
          { label: 'Student Risk', value: risk.total, sub: `${risk.critical} critical`, bg: risk.critical > 0 ? '#FEE2E2' : '#FEF9C3', color: risk.critical > 0 ? '#B91C1C' : '#A16207', dot: risk.critical > 0 ? '#EF4444' : '#F59E0B', href: '/students' },
          { label: 'Staff Today', value: teachers.total_tracked > 0 ? `${teachers.present_today}/${teachers.total_tracked}` : 'N/A', sub: teachers.absent_today.length > 0 ? `${teachers.absent_today.length} absent` : 'All in', bg: teachers.absent_today.length > 0 ? '#FEF9C3' : '#DCFCE7', color: teachers.absent_today.length > 0 ? '#A16207' : '#15803D', dot: teachers.absent_today.length > 0 ? '#F59E0B' : '#22C55E', href: '/admin/staff' },
        ].map(k => (
          <Link key={k.label} href={k.href} className="kpi-chip" style={{ borderLeft: `3px solid ${k.dot}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, marginBottom: 2 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
          </Link>
        ))}
      </div>

      {/* EXTRAS ROW */}
      {extras && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Leave Pending', value: extras.pending_leave_count, href: '/principal/leave-approvals', icon: '📅', color: extras.pending_leave_count > 0 ? '#D97706' : '#15803D' },
            { label: 'Complaints', value: extras.open_complaints_count, href: '/admin/complaints', icon: '📩', color: extras.open_complaints_count > 0 ? '#B91C1C' : '#15803D' },
            { label: 'Proof Review', value: extras.proofs_to_review_count, href: '/teacher-eval', icon: '🎙', color: extras.proofs_to_review_count > 0 ? '#7C3AED' : '#15803D' },
          ].map(e => (
            <Link key={e.label} href={e.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 11, padding: '10px 12px', textAlign: 'center', display: 'block' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{e.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: e.color }}>{e.value}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{e.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* AT-RISK STUDENTS */}
      {risk.total > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 13, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>⚠️ At-Risk Students</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{risk.total} flagged</div>
          </div>
          {risk.top_cases.slice(0, 4).map((c, i) => {
            const rc = RISK_COLORS[c.risk_level] ?? RISK_COLORS.medium;
            return (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < 3 ? '1px solid #F9FAFB' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Class {c.class} · {(c.summary ?? '').slice(0, 55)}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: rc.bg, color: rc.color, flexShrink: 0, marginLeft: 8 }}>
                  {c.risk_level.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* UPCOMING EVENTS */}
      {data.upcoming_events.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 13, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>📅 Upcoming</div>
          </div>
          {data.upcoming_events.slice(0, 4).map((ev, i) => {
            const d = new Date(ev.event_date);
            return (
              <div key={i} style={{ padding: '10px 14px', borderBottom: i < 3 ? '1px solid #F9FAFB' : 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 7, background: ev.is_holiday ? '#FEF9C3' : '#EEF2FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: ev.is_holiday ? '#A16207' : '#4F46E5' }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: ev.is_holiday ? '#A16207' : '#4F46E5', fontWeight: 600 }}>{d.toLocaleString('en-IN', { month: 'short' })}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ev.title}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 9 }}>
        {[
          { href: '/admin/broadcasts',        icon: '📢', label: 'Broadcast',          color: '#4F46E5' },
          { href: '/principal/leave-approvals',icon: '📅', label: 'Leave Approvals',    color: '#C2410C' },
          { href: '/admin/complaints',        icon: '📩', label: 'Complaints',          color: '#B91C1C' },
          { href: '/admin/sanitary-inventory',icon: '🧼', label: 'Sanitary Stock',      color: '#0D9488' },
          { href: '/teacher-eval',            icon: '🎙', label: 'Teacher Eval',        color: '#7C3AED' },
          { href: '/admin/staff',             icon: '👥', label: 'Staff',               color: '#0284C7' },
          { href: '/admin/fees',              icon: '💰', label: 'Fees',                color: '#065F46' },
          { href: '/report-cards',            icon: '📄', label: 'Report Cards',        color: '#D97706' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
